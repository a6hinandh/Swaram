import { MentalHealthScreeningResult, VoiceBiomarkers, PhqFrequencyScore } from '../types';

export const calculatePhq2Score = (
  interestScore: PhqFrequencyScore,
  depressedScore: PhqFrequencyScore
): { total: number; referralNeeded: boolean } => {
  const total = interestScore + depressedScore;
  return {
    total,
    referralNeeded: total >= 3
  };
};

/**
 * Placeholder voice feature extractor for Teammate 1.
 * Connect with IndicConformer / wav2vec audio feature pipeline.
 */
export const extractMockVoiceBiomarkers = (audioDurationSeconds: number): VoiceBiomarkers => {
  return {
    pitchVariabilityHz: 18.5,
    speakingRateWpm: 95,
    pauseRatioPercent: 38,
    acousticEnergyDb: -24.2,
    confidenceScore: 0.88
  };
};

export const evaluateVoiceDistressTier = (
  markers?: VoiceBiomarkers
): 'low' | 'moderate' | 'high' => {
  if (!markers) return 'low';
  if (markers.pauseRatioPercent > 45 || markers.speakingRateWpm < 80) {
    return 'high';
  }
  if (markers.pauseRatioPercent > 30 || markers.speakingRateWpm < 100) {
    return 'moderate';
  }
  return 'low';
};
