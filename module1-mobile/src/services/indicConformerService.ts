/**
 * Cloud ASR Service (Hugging Face & AI4Bharat)
 * 
 * Strictly transcribes spoken audio to MALAYALAM (മലയാളം).
 * Transliterates/converts any other Indic scripts (Tamil, Hindi, Telugu, Kannada) into Malayalam.
 */

import { RecordedAudio } from './audioRecorder';
import {
  enforceEnglishOrMalayalam,
  LanguageMode,
} from './malayalamSpellCorrector';
import {
  transcribeWithSarvamAI,
  getCustomSarvamApiKey,
  setCustomSarvamApiKey,
  SarvamAsrResponse,
} from './sarvamAsrService';

export {
  enforceEnglishOrMalayalam,
  LanguageMode,
  transcribeWithSarvamAI,
  getCustomSarvamApiKey,
  setCustomSarvamApiKey,
  SarvamAsrResponse,
};

export interface IndicConformerResponse {
  transcript: string;
  confidence: number;
  isMock: boolean;
  message: string;
  detectedLanguage?: 'Malayalam';
  executionTimeMs: number;
}

// Backward compatibility alias
export const ensureMalayalamScript = (text: string) => enforceEnglishOrMalayalam(text, 'ml');

export async function transcribeWithIndicConformer(
  audio: RecordedAudio,
  langMode: LanguageMode = 'ml'
): Promise<IndicConformerResponse> {
  const startTime = Date.now();

  // 1. PRIMARY ENGINE: Sarvam AI Speech-to-Text (Saaras v4)
  const sarvamKey = getCustomSarvamApiKey();
  if (sarvamKey) {
    try {
      console.log('[ASR Service] Using Sarvam AI Saaras v4 engine for Malayalam transcription...');
      const sarvamRes = await transcribeWithSarvamAI(audio, langMode);
      if (sarvamRes.transcript) {
        return sarvamRes;
      }
    } catch (sarvamErr: any) {
      console.warn('[ASR Service] Sarvam AI attempt returned error, evaluating fallback:', sarvamErr.message);
    }
  }

  // 2. Secondary Fallback: Hugging Face Serverless Inference API
  const hfToken =
    process.env.EXPO_PUBLIC_HF_TOKEN ||
    (process.env.EXPO_PUBLIC_AI4BHARAT_API_KEY?.startsWith('hf_') ? process.env.EXPO_PUBLIC_AI4BHARAT_API_KEY : '') ||
    '';
  const hfEndpoint =
    process.env.EXPO_PUBLIC_HF_ENDPOINT ||
    'https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3-turbo';

  if (hfToken && hfToken.startsWith('hf_')) {
    try {
      console.log(`[Hugging Face ASR Fallback] Sending audio to ${hfEndpoint} (Language: MALAYALAM)...`);

      let bodyData: any = null;
      let contentType = 'audio/wav';

      if (audio.arrayBuffer) {
        bodyData = audio.arrayBuffer;
        contentType = 'audio/wav';
      } else if (audio.blob) {
        bodyData = audio.blob;
        contentType = audio.blob.type || 'audio/wav';
      } else if (audio.uri) {
        const fileRes = await fetch(audio.uri);
        bodyData = await fileRes.arrayBuffer();
        contentType = audio.uri.endsWith('.m4a') ? 'audio/m4a' : 'audio/wav';
      } else if (audio.base64) {
        const binaryString = atob(audio.base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        bodyData = bytes.buffer;
        contentType = 'audio/wav';
      }

      if (bodyData) {
        const response = await fetch(hfEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hfToken}`,
            'Content-Type': contentType,
          },
          body: bodyData,
        });

        if (response.ok) {
          const json = await response.json();
          const rawText = (json.text || json[0]?.text || '').trim();

          // Enforce strictly Malayalam
          const extractedText = enforceEnglishOrMalayalam(rawText, 'ml');

          if (extractedText) {
            const executionTimeMs = Date.now() - startTime;

            console.log('\n======================================================');
            console.log('🗣️ HUGGING FACE INFERENCE TRANSCRIPTION (MALAYALAM):');
            console.log(extractedText);
            console.log('======================================================\n');

            return {
              transcript: extractedText,
              confidence: 0.98,
              isMock: false,
              detectedLanguage: 'Malayalam',
              message: 'Transcribed to Malayalam via Hugging Face Whisper (Fallback).',
              executionTimeMs,
            };
          }
        } else {
          const errText = await response.text();
          console.warn(`[Hugging Face ASR] Status ${response.status}: ${errText}`);
        }
      }
    } catch (err: any) {
      console.warn(`[Hugging Face ASR] Network error: ${err.message}`);
    }
  }

  // 3. Tertiary Fallback: AI4Bharat Dhruva
  const ai4bharatKey = process.env.EXPO_PUBLIC_AI4BHARAT_API_KEY || '';
  const ai4bharatEndpoint = process.env.EXPO_PUBLIC_INDIC_CONFORMER_ENDPOINT || '';

  if (
    ai4bharatKey &&
    !ai4bharatKey.includes('placeholder') &&
    !ai4bharatKey.startsWith('hf_') &&
    ai4bharatEndpoint.startsWith('http')
  ) {
    try {
      const srcLang = 'ml';
      console.log(`[AI4Bharat IndicConformer Fallback] Sending to ${ai4bharatEndpoint} (Lang: ${srcLang})...`);
      const payload = {
        pipelineTasks: [
          {
            taskType: 'asr',
            config: {
              language: { sourceLanguage: srcLang },
              serviceId: process.env.EXPO_PUBLIC_AI4BHARAT_SERVICE_ID || 'ai4bharat/conformer-hi-gpu--gpu',
              audioFormat: 'wav',
              samplingRate: 16000,
            },
          },
        ],
        inputData: {
          audio: [{ audioContent: audio.base64 || '' }],
        },
      };

      const response = await fetch(ai4bharatEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': ai4bharatKey,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const json = await response.json();
        const extracted =
          json?.pipelineResponse?.[0]?.output?.[0]?.source ||
          json?.output?.[0]?.source ||
          '';
        const cleaned = enforceEnglishOrMalayalam(extracted, 'ml');
        if (cleaned) {
          console.log('\n======================================================');
          console.log('🗣️ AI4BHARAT INDICCONFORMER TRANSCRIPTION (MALAYALAM):');
          console.log(cleaned);
          console.log('======================================================\n');

          return {
            transcript: cleaned,
            confidence: 0.95,
            isMock: false,
            detectedLanguage: 'Malayalam',
            message: 'Transcribed via AI4Bharat IndicConformer in Malayalam.',
            executionTimeMs: Date.now() - startTime,
          };
        }
      }
    } catch (e) {
      console.warn('AI4Bharat request failed:', e);
    }
  }

  // 4. Error if no engine succeeded
  const executionTimeMs = Date.now() - startTime;
  throw new Error(
    sarvamKey || hfToken
      ? 'ASR transcription service did not detect speech. Please speak clearly into microphone and try again.'
      : 'Sarvam AI API key is not configured. Please add EXPO_PUBLIC_SARVAM_API_KEY to module1-mobile/.env.'
  );
}

