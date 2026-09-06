/**
 * Sarvam AI Speech-to-Text (ASR) Service
 * 
 * High-accuracy Malayalam (മലയാളം) Voice-to-Text transcription powered by
 * Sarvam AI Saaras v4 foundation model.
 * 
 * Features:
 * - Direct REST API integration with https://api.sarvam.ai/speech-to-text
 * - Supports 23 Indian languages including Malayalam (ml-IN)
 * - Uses native FileSystem.uploadAsync on iOS & Android to bypass React Native FormDataPart issues
 * - Compatible with modern Expo WinterCG fetch (Blob / .bytes() support)
 * - Automatic Malayalam orthographic normalization and clinical terminology correction
 */

import { Platform } from 'react-native';
import { RecordedAudio } from './audioRecorder';
import {
  correctMalayalamSpelling,
  enforceEnglishOrMalayalam,
  LanguageMode,
} from './malayalamSpellCorrector';

// Dynamic safe load of expo-file-system for native file uploads & file handling
let FileSystem: any = null;
try {
  FileSystem = require('expo-file-system/legacy');
} catch (e1) {
  try {
    FileSystem = require('expo-file-system');
  } catch (e2) {
    // Web or fallback
  }
}

export interface SarvamAsrResponse {
  transcript: string;
  confidence: number;
  isMock: boolean;
  message: string;
  detectedLanguage?: 'Malayalam';
  executionTimeMs: number;
  requestId?: string;
}

// In-memory runtime override for Sarvam AI Key (allows dynamic configuration from UI)
let customSarvamApiKey = '';

export function setCustomSarvamApiKey(key: string) {
  customSarvamApiKey = (key || '').trim();
}

export function getCustomSarvamApiKey(): string {
  return (
    customSarvamApiKey ||
    process.env.EXPO_PUBLIC_SARVAM_API_KEY ||
    'sk_ebmc8i23_GSCwz6j4TNMdVHTZDELsGxgj'
  );
}

function parseAndFormatTranscript(
  json: any,
  model: string,
  startTime: number
): SarvamAsrResponse {
  const rawTranscript = (json.transcript || '').trim();

  if (!rawTranscript) {
    throw new Error(
      'Sarvam AI ASR did not detect any speech in the audio. Please speak clearly into the microphone and try again.'
    );
  }

  // 1. Enforce Malayalam characters and sanitize foreign scripts
  const cleanedText = enforceEnglishOrMalayalam(rawTranscript, 'ml');

  // 2. Terminology and spelling correction
  const finalTranscript = correctMalayalamSpelling(cleanedText);
  const executionTimeMs = Date.now() - startTime;

  // Formatted Console Output
  console.log('\n======================================================');
  console.log(`[Sarvam AI ASR] TRANSCRIPTION (MALAYALAM - ${model}):`);
  console.log(finalTranscript);
  console.log(`Duration: ${executionTimeMs}ms | Request ID: ${json.request_id || 'N/A'}`);
  console.log('======================================================\n');

  return {
    transcript: finalTranscript,
    confidence: 0.98,
    isMock: false,
    detectedLanguage: 'Malayalam',
    message: `Transcribed to Malayalam via Sarvam AI (${model}).`,
    executionTimeMs,
    requestId: json.request_id,
  };
}

/**
 * Transcribes audio to Malayalam using Sarvam AI Saaras v4 speech-to-text API.
 * 
 * @param audio RecordedAudio payload containing audio URI, ArrayBuffer, Blob, or base64
 * @param langMode Language code (defaults to 'ml')
 */
export async function transcribeWithSarvamAI(
  audio: RecordedAudio,
  langMode: LanguageMode = 'ml'
): Promise<SarvamAsrResponse> {
  const startTime = Date.now();

  const apiKey = getCustomSarvamApiKey();
  if (!apiKey) {
    throw new Error(
      'Sarvam AI API key is not configured. Please set EXPO_PUBLIC_SARVAM_API_KEY in module1-mobile/.env or configure it in Settings.'
    );
  }

  const endpoint =
    process.env.EXPO_PUBLIC_SARVAM_ENDPOINT || 'https://api.sarvam.ai/speech-to-text';
  const model = process.env.EXPO_PUBLIC_SARVAM_MODEL || 'saaras:v4';
  const languageCode = process.env.EXPO_PUBLIC_SARVAM_LANGUAGE_CODE || 'ml-IN';

  console.log(`[Sarvam AI ASR] Connecting to ${endpoint} using model: ${model} (Language: ${languageCode})...`);

  // PATH 1: On Native Mobile (Android/iOS), if audio.uri exists and FileSystem.uploadAsync is available,
  // use Expo's native multipart upload which runs directly in native Android/iOS OkHttp/NSURLSession.
  // This bypasses JS FormData / FormDataPart serialization entirely and avoids "Unsupported FormDataPart implementation".
  if (Platform.OS !== 'web' && audio.uri && FileSystem && typeof FileSystem.uploadAsync === 'function') {
    try {
      console.log('[Sarvam AI ASR] Uploading natively via FileSystem.uploadAsync:', audio.uri);
      const isM4a = audio.uri.toLowerCase().endsWith('.m4a');
      const mimeType = isM4a ? 'audio/m4a' : 'audio/wav';

      const uploadResult = await FileSystem.uploadAsync(endpoint, audio.uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.UploadType?.MULTIPART ?? 1,
        fieldName: 'file',
        mimeType,
        parameters: {
          model,
          language_code: languageCode,
          mode: 'transcribe',
        },
        headers: {
          'api-subscription-key': apiKey,
        },
      });

      if (uploadResult.status >= 200 && uploadResult.status < 300) {
        const json = JSON.parse(uploadResult.body);
        return parseAndFormatTranscript(json, model, startTime);
      } else {
        console.warn(`[Sarvam AI ASR] Native uploadAsync HTTP ${uploadResult.status}:`, uploadResult.body);
        throw new Error(
          `Sarvam AI ASR request failed with status ${uploadResult.status}: ${uploadResult.body}`
        );
      }
    } catch (uploadErr: any) {
      // If native uploadAsync throws an error not related to HTTP status, log and try Blob fallback
      if (uploadErr.message?.includes('status')) {
        throw uploadErr;
      }
      console.warn('[Sarvam AI ASR] Native uploadAsync unavailable or failed, falling back to Blob upload:', uploadErr.message);
    }
  }

  // PATH 2: Standard fetch with FormData (Web & WinterCG-compliant Mobile fallback)
  // Note: Modern Expo fetch (convertFormDataAsync) requires form entries to be either:
  // 1) entry instanceof Blob, or
  // 2) typeof entry === 'object' && 'bytes' in entry
  // A plain object { uri, name, type } will throw "Unsupported FormDataPart implementation".
  let fileEntry: any = null;
  const isM4a = audio.uri?.toLowerCase()?.endsWith('.m4a');
  const mimeType = isM4a ? 'audio/m4a' : 'audio/wav';
  const filename = isM4a ? 'recording.m4a' : 'recording.wav';

  if (audio.blob) {
    fileEntry = audio.blob;
  } else if (audio.arrayBuffer) {
    const bytes = new Uint8Array(audio.arrayBuffer);
    try {
      fileEntry = new Blob([bytes], { type: mimeType });
    } catch (e) {
      fileEntry = {
        name: filename,
        type: mimeType,
        bytes: async () => bytes,
      };
    }
    if (fileEntry) {
      (fileEntry as any).bytes = async () => bytes;
      (fileEntry as any).name = filename;
    }
  } else if (audio.base64) {
    const binaryString = atob(audio.base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    try {
      fileEntry = new Blob([bytes], { type: mimeType });
    } catch (e) {
      fileEntry = {
        name: filename,
        type: mimeType,
        bytes: async () => bytes,
      };
    }
    if (fileEntry) {
      (fileEntry as any).bytes = async () => bytes;
      (fileEntry as any).name = filename;
    }
  } else if (audio.uri) {
    const fileRes = await fetch(audio.uri);
    fileEntry = await fileRes.blob();
    if (fileEntry) {
      (fileEntry as any).name = filename;
    }
  }

  if (!fileEntry) {
    throw new Error('No valid audio payload (Blob, ArrayBuffer, base64, or URI) found in recording.');
  }

  const formData = new FormData();
  formData.append('file', fileEntry, filename);
  formData.append('model', model);
  formData.append('language_code', languageCode);
  formData.append('mode', 'transcribe');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'api-subscription-key': apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[Sarvam AI ASR] HTTP Error ${response.status}:`, errorBody);
    throw new Error(
      `Sarvam AI ASR request failed with status ${response.status}: ${errorBody}`
    );
  }

  const json = await response.json();
  return parseAndFormatTranscript(json, model, startTime);
}
