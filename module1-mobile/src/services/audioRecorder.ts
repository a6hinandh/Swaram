/**
 * Universal Audio Recorder for Swaram React Native App
 * Captures raw 16kHz PCM audio and encodes standard WAV format
 * for direct compatibility with Hugging Face Whisper and AI4Bharat.
 */

import { Platform } from 'react-native';
import {
  AudioModule,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';

export interface RecordedAudio {
  uri?: string;
  base64?: string;
  blob?: any;
  arrayBuffer?: ArrayBuffer;
  durationMs: number;
}

/**
 * Encodes 16-bit PCM samples into a standard 44-byte WAV ArrayBuffer
 */
export function encodeWav(samples: Uint8Array, sampleRate = 16000, numChannels = 1): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF chunk descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length, true);
  writeString(8, 'WAVE');

  // "fmt " sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * numChannels * 2, true); // ByteRate (16-bit = 2 bytes)
  view.setUint16(32, numChannels * 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample

  // "data" sub-chunk
  writeString(36, 'data');
  view.setUint32(40, samples.length, true);

  // Copy PCM data
  new Uint8Array(buffer, 44).set(samples);

  return buffer;
}

/**
 * Converts an ArrayBuffer to clean base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  const len = bytes.length;

  for (let i = 0; i < len; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < len ? bytes[i + 1] : 0;
    const b3 = i + 2 < len ? bytes[i + 2] : 0;

    result += chars[b1 >> 2];
    result += chars[((b1 & 3) << 4) | (b2 >> 4)];
    result += i + 1 < len ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    result += i + 2 < len ? chars[b3 & 63] : '=';
  }

  return result;
}

class AudioRecorderService {
  private nativeStream: any = null;
  private nativeRecorder: any = null;
  private streamSubscription: any = null;
  private pcmChunks: Uint8Array[] = [];

  private webMediaRecorder: any = null;
  private webAudioChunks: any[] = [];
  private webStream: any = null;

  private startTime: number = 0;

  /**
   * Request microphone permission from user
   */
  async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'web') {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.warn('MediaDevices API not supported on this browser');
          return false;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        return true;
      } catch (err) {
        console.error('Web microphone permission error:', err);
        return false;
      }
    } else {
      try {
        const result = await requestRecordingPermissionsAsync();
        return result.granted || result.status === 'granted';
      } catch (err) {
        console.error('Native microphone permission error:', err);
        return false;
      }
    }
  }

  /**
   * Start microphone recording
   */
  async startRecording(): Promise<void> {
    this.startTime = Date.now();

    if (Platform.OS === 'web') {
      this.webAudioChunks = [];
      this.webStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = (window as any).MediaRecorder?.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

      this.webMediaRecorder = mimeType
        ? new (window as any).MediaRecorder(this.webStream, { mimeType })
        : new (window as any).MediaRecorder(this.webStream);

      this.webMediaRecorder.ondataavailable = (event: any) => {
        if (event.data && event.data.size > 0) {
          this.webAudioChunks.push(event.data);
        }
      };

      this.webMediaRecorder.start(100);
    } else {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      this.pcmChunks = [];

      // Try raw PCM AudioStream first for 100% pure WAV output
      try {
        if ((AudioModule as any).AudioStream) {
          this.nativeStream = new (AudioModule as any).AudioStream({
            sampleRate: 16000,
            channels: 1,
            encoding: 'int16',
          });

          this.streamSubscription = this.nativeStream.addListener(
            'audioStreamBuffer',
            (buffer: any) => {
              if (buffer?.data) {
                this.pcmChunks.push(new Uint8Array(buffer.data));
              }
            }
          );

          await this.nativeStream.start();
          return;
        }
      } catch (streamErr) {
        console.warn('Native AudioStream unavailable, using AudioRecorder fallback:', streamErr);
      }

      // Fallback: AudioRecorder
      this.nativeRecorder = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
      await this.nativeRecorder.prepareToRecordAsync();
      this.nativeRecorder.record();
    }
  }

  /**
   * Stop microphone recording and return audio payload
   */
  async stopRecording(): Promise<RecordedAudio> {
    const durationMs = Date.now() - this.startTime;

    if (Platform.OS === 'web') {
      return new Promise((resolve, reject) => {
        if (!this.webMediaRecorder) {
          return reject(new Error('No active web recorder found'));
        }

        this.webMediaRecorder.onstop = async () => {
          try {
            const blob = new Blob(this.webAudioChunks, { type: 'audio/webm' });
            const uri = URL.createObjectURL(blob);
            const arrayBuffer = await blob.arrayBuffer();
            const base64 = arrayBufferToBase64(arrayBuffer);

            resolve({
              uri,
              blob,
              arrayBuffer,
              base64,
              durationMs,
            });
          } catch (e) {
            reject(e);
          } finally {
            if (this.webStream) {
              this.webStream.getTracks().forEach((track: any) => track.stop());
            }
          }
        };

        this.webMediaRecorder.stop();
      });
    } else {
      // 1. If native AudioStream was active (WAV)
      if (this.nativeStream) {
        try {
          this.nativeStream.stop();
        } catch (e) {}
        this.streamSubscription?.remove?.();
        this.nativeStream = null;

        // Concatenate PCM chunks
        const totalBytes = this.pcmChunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const pcm = new Uint8Array(totalBytes);
        let offset = 0;
        for (const chunk of this.pcmChunks) {
          pcm.set(chunk, offset);
          offset += chunk.length;
        }
        this.pcmChunks = [];

        // Encode to genuine 16kHz 16-bit mono WAV
        const wavBuffer = encodeWav(pcm, 16000, 1);
        const base64 = arrayBufferToBase64(wavBuffer);

        return {
          arrayBuffer: wavBuffer,
          base64,
          durationMs,
        };
      }

      // 2. Fallback: AudioRecorder
      if (!this.nativeRecorder) {
        throw new Error('No active native recorder found');
      }

      await this.nativeRecorder.stop();
      const uri = this.nativeRecorder.uri;
      this.nativeRecorder = null;

      if (!uri) {
        throw new Error('Failed to retrieve recording URI');
      }

      let arrayBuffer: ArrayBuffer | undefined;
      let base64 = '';

      try {
        const response = await fetch(uri);
        arrayBuffer = await response.arrayBuffer();
        base64 = arrayBufferToBase64(arrayBuffer);
      } catch (e) {
        console.warn('Could not read recording URI:', e);
      }

      return {
        uri,
        arrayBuffer,
        base64,
        durationMs,
      };
    }
  }
}

export const audioRecorder = new AudioRecorderService();
