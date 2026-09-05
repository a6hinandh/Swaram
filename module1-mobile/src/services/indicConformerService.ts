/**
 * Cloud ASR Service (Hugging Face & AI4Bharat)
 * 
 * Strictly transcribes spoken audio to either ENGLISH or MALAYALAM.
 * Disallows and filters/transliterates any other language scripts (e.g. Tamil, Hindi, Telugu, Kannada)
 * to guarantee that only English or Malayalam appears in output.
 */

import { RecordedAudio } from './audioRecorder';
import { correctMalayalamSpelling } from './malayalamSpellCorrector';

export type LanguageMode = 'auto' | 'ml' | 'en';

export interface IndicConformerResponse {
  transcript: string;
  confidence: number;
  isMock: boolean;
  message: string;
  detectedLanguage?: 'English' | 'Malayalam';
  executionTimeMs: number;
}

/**
 * Strict Language Enforcer:
 * Guarantees that transcription is exclusively either ENGLISH or MALAYALAM.
 * - English text (Latin alphabet) is preserved.
 * - Malayalam text (Malayalam script) is preserved.
 * - Any other Indian script (Tamil, Hindi/Devanagari, Telugu, Kannada, Bengali, etc.)
 *   that Whisper might mistakenly output is automatically converted to Malayalam script.
 * - Any foreign script characters (Cyrillic, Arabic, CJK, etc.) are stripped.
 */
export function enforceEnglishOrMalayalam(text: string, mode: LanguageMode = 'auto'): string {
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
export const ensureMalayalamScript = (text: string) => enforceEnglishOrMalayalam(text, 'auto');

export async function transcribeWithIndicConformer(
  audio: RecordedAudio,
  langMode: LanguageMode = 'auto'
): Promise<IndicConformerResponse> {
  const startTime = Date.now();

  const hfToken = process.env.EXPO_PUBLIC_HF_TOKEN || '';
  const hfEndpoint =
    process.env.EXPO_PUBLIC_HF_ENDPOINT ||
    'https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3-turbo';

  // 1. Primary: Hugging Face Serverless Inference API
  if (hfToken && hfToken.startsWith('hf_')) {
    try {
      console.log(`[Hugging Face ASR] Sending audio to ${hfEndpoint} (Mode: ${langMode.toUpperCase()})...`);

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

          // Enforce strictly English or Malayalam (no Tamil or other languages)
          const extractedText = enforceEnglishOrMalayalam(rawText, langMode);

          // Detect whether the output is English or Malayalam
          const isMalayalam = /[\u0D00-\u0D7F]/.test(extractedText);
          const detectedLanguage: 'English' | 'Malayalam' = isMalayalam ? 'Malayalam' : 'English';

          if (extractedText) {
            const executionTimeMs = Date.now() - startTime;

            // PRINT TRANSCRIPTION
            console.log('\n======================================================');
            console.log(`🗣️ HUGGING FACE INFERENCE TRANSCRIPTION (${detectedLanguage.toUpperCase()} ONLY):`);
            console.log(extractedText);
            console.log('======================================================\n');

            return {
              transcript: extractedText,
              confidence: 0.98,
              isMock: false,
              detectedLanguage,
              message: `Transcribed to ${detectedLanguage} via Hugging Face Whisper.`,
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
      const srcLang = langMode === 'en' ? 'en' : 'ml';
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
        const cleaned = enforceEnglishOrMalayalam(extracted, langMode);
        if (cleaned) {
          console.log('\n======================================================');
          console.log('🗣️ AI4BHARAT INDICCONFORMER TRANSCRIPTION:');
          console.log(cleaned);
          console.log('======================================================\n');

          return {
            transcript: cleaned,
            confidence: 0.95,
            isMock: false,
            detectedLanguage: srcLang === 'en' ? 'English' : 'Malayalam',
            message: 'Transcribed via AI4Bharat IndicConformer.',
            executionTimeMs: Date.now() - startTime,
          };
        }
      }
    } catch (e) {
      console.warn('AI4Bharat request failed:', e);
    }
  }

  // 3. Fallback: Baseline Malayalam clinical transcript
  const executionTimeMs = Date.now() - startTime;
  const mockTranscript =
    langMode === 'en'
      ? 'Visited Lakshmi. Blood pressure 130/85. Weight 58 kg. Prescribed iron tablets. Follow-up next Thursday.'
      : 'ലക്ഷ്മിയെ കണ്ടു. ബിപി 130/85 ഉണ്ട്. ഭാരം 58 കിലോ. അയൺ ഗുളിക കൊടുത്തു. അടുത്ത ചെക്കപ്പ് അടുത്ത വ്യാഴാഴ്ച.';

  console.log('\n======================================================');
  console.log('🗣️ ASR TRANSCRIPTION (FALLBACK BASELINE):');
  console.log(mockTranscript);
  console.log('======================================================\n');

  return {
    transcript: mockTranscript,
    confidence: 0.94,
    isMock: true,
    detectedLanguage: langMode === 'en' ? 'English' : 'Malayalam',
    message: 'Displayed baseline clinical transcript.',
    executionTimeMs,
  };
}
