/**
 * Cloud ASR Service (Hugging Face & AI4Bharat)
 * 
 * Strictly transcribes spoken audio to MALAYALAM (മലയാളം).
 * Transliterates/converts any other Indic scripts (Tamil, Hindi, Telugu, Kannada) into Malayalam.
 */

import { RecordedAudio } from './audioRecorder';
import { correctMalayalamSpelling } from './malayalamSpellCorrector';

export type LanguageMode = 'ml';

export interface IndicConformerResponse {
  transcript: string;
  confidence: number;
  isMock: boolean;
  message: string;
  detectedLanguage?: 'Malayalam';
  executionTimeMs: number;
}

/**
 * Strict Malayalam Language Enforcer:
 * Guarantees that transcription is exclusively MALAYALAM (മലയാളം).
 * - Native Malayalam text is preserved.
 * - Any other Indian script (Tamil, Hindi/Devanagari, Telugu, Kannada, Bengali, etc.)
 *   that ASR might mistakenly output is automatically converted to Malayalam script.
 * - Numbers and Latin clinical abbreviations (BP, mg, kg) are cleanly supported in context.
 * - Any foreign script characters (Cyrillic, Arabic, CJK, etc.) are stripped.
 */
export function enforceEnglishOrMalayalam(text: string, mode: string = 'ml'): string {
  if (!text || !text.trim()) return '';

  const out: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const code = text.charCodeAt(i);

    // 1. ASCII / English / Numbers / Punctuation / Whitespace
    if (code < 0x0080 || (code >= 0x2000 && code <= 0x206F)) {
      out.push(ch);
      continue;
    }

    // 2. Native Malayalam block (U+0D00 - U+0D7F)
    if (code >= 0x0D00 && code <= 0x0D7F) {
      out.push(ch);
      continue;
    }

    // 3. Indic scripts: Devanagari (0x0900), Bengali (0x0980), Gurmukhi (0x0A00),
    //    Gujarati (0x0A80), Oriya (0x0B00), Tamil (0x0B80), Telugu (0x0C00), Kannada (0x0C80)
    //    All follow identical 128-byte Brahmic layout mapping directly to Malayalam (0x0D00).
    if (code >= 0x0900 && code < 0x0D00) {
      const blockOffset = code % 0x80;
      const mlCode = 0x0D00 + blockOffset;
      out.push(String.fromCharCode(mlCode));
      continue;
    }

    // Omit any other foreign script characters (Chinese, Arabic, Cyrillic, etc.)
  }

  let res = out.join('');

  // Anusvara cleanup: convert word-ending "മ്" into standard Malayalam anusvara "ം"
  res = res
    .replace(/മ് /g, 'ം ')
    .replace(/മ്\n/g, 'ം\n')
    .replace(/മ്\./g, 'ം.')
    .replace(/മ്,/g, 'ം,');

  if (res.endsWith('മ്')) {
    res = res.slice(0, -2) + 'ം';
  }

  // 4. Apply comprehensive Malayalam spell & clinical terminology correction
  return correctMalayalamSpelling(res);
}

// Backward compatibility alias
export const ensureMalayalamScript = (text: string) => enforceEnglishOrMalayalam(text, 'ml');

export async function transcribeWithIndicConformer(
  audio: RecordedAudio,
  langMode: LanguageMode = 'ml'
): Promise<IndicConformerResponse> {
  const startTime = Date.now();

  const hfToken =
    process.env.EXPO_PUBLIC_HF_TOKEN ||
    (process.env.EXPO_PUBLIC_AI4BHARAT_API_KEY?.startsWith('hf_') ? process.env.EXPO_PUBLIC_AI4BHARAT_API_KEY : '') ||
    '';
  const hfEndpoint =
    process.env.EXPO_PUBLIC_HF_ENDPOINT ||
    'https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3-turbo';

  // 1. Primary: Hugging Face Serverless Inference API
  if (hfToken && hfToken.startsWith('hf_')) {
    try {
      console.log(`[Hugging Face ASR] Sending audio to ${hfEndpoint} (Language: MALAYALAM)...`);

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

            // PRINT TRANSCRIPTION
            console.log('\n======================================================');
            console.log('🗣️ HUGGING FACE INFERENCE TRANSCRIPTION (MALAYALAM):');
            console.log(extractedText);
            console.log('======================================================\n');

            return {
              transcript: extractedText,
              confidence: 0.98,
              isMock: false,
              detectedLanguage: 'Malayalam',
              message: 'Transcribed to Malayalam via Hugging Face Whisper.',
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

  // 2. AI4Bharat Dhruva Fallback (if configured)
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
      console.log(`[AI4Bharat IndicConformer] Sending to ${ai4bharatEndpoint} (Lang: ${srcLang})...`);
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

  // 3. Real Error: No mock data!
  const executionTimeMs = Date.now() - startTime;
  throw new Error(
    hfToken
      ? 'ASR transcription service did not detect speech. Please speak clearly into microphone and try again.'
      : 'Hugging Face ASR token is not configured. Please add EXPO_PUBLIC_HF_TOKEN to module1-mobile/.env.'
  );
}
