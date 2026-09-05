/**
 * Mental Health Voice Screening Protocol Types
 * Module 1 - Frontend Contracts
 */

export type PhqFrequencyScore = 0 | 1 | 2 | 3;

export interface Phq2Item {
  id: 'interest_pleasure' | 'feeling_down';
  promptMl: string;
  promptEn: string;
  selectedScore: PhqFrequencyScore;
}

export interface VoiceBiomarkers {
  pitchVariabilityHz: number; // Low variability can correlate with flat affect/depression
  speakingRateWpm: number;    // Syllables/words per minute
  pauseRatioPercent: number;  // Ratio of silence to active speech
  acousticEnergyDb: number;
  confidenceScore: number;    // 0.0 - 1.0
}

export interface MentalHealthScreeningResult {
  screeningId: string;
  patientId: string;
  patientName: string;
  timestamp: string;
  phq2TotalScore: number;
  phq9ReferralNeeded: boolean;
  voiceBiomarkers?: VoiceBiomarkers;
  voiceDistressTier: 'low' | 'moderate' | 'high';
  postpartumCheckFlag: boolean;
  urgentSafetyAlert: boolean;
  ashaNotes?: string;
}
