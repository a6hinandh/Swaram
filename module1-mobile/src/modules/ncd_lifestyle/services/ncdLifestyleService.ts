/**
 * Swaram - NCD Lifestyle & Official CBAC Integration Service
 */

import {
  TobaccoHabit,
  AlcoholIntake,
  PhysicalActivityLevel,
  DietarySaltRisk,
  MedicationCompliance,
  CbacOfficialRecord
} from '../types';

export * from './cbacEntityExtractor';
export * from './cbacProfileStorage';

/**
 * Legacy Lifestyle Risk Score Calculator
 */
export const calculateLifestyleRiskScore = (
  tobacco: TobaccoHabit,
  alcohol: AlcoholIntake,
  activity: PhysicalActivityLevel,
  salt: DietarySaltRisk,
  medication: MedicationCompliance
): { score: number; level: 'low' | 'moderate' | 'high' } => {
  let score = 0;

  if (tobacco === 'both' || tobacco === 'smoking') score += 2;
  else if (tobacco === 'smokeless_chewing') score += 1;

  if (alcohol === 'frequent') score += 2;
  else if (alcohol === 'occasional') score += 1;

  if (activity === 'sedentary') score += 1;
  if (salt === 'excessive_pickles_papads') score += 1;

  if (medication.hasChronicCondition && medication.dosesTakenPastWeek < 5) {
    score += 2;
  }

  const level = score >= 4 ? 'high' : score >= 2 ? 'moderate' : 'low';
  return { score, level };
};

/**
 * Calculate Official MoHFW Part A Score and Classification
 */
export function calculatePartAScore(record: CbacOfficialRecord): {
  totalScore: number;
  isHighRisk: boolean;
} {
  const pa = record.partA;
  const total =
    pa.ageScore +
    pa.tobaccoScore +
    pa.alcoholScore +
    pa.waistScore +
    pa.physicalActivityScore +
    pa.familyHistoryScore;

  pa.totalScore = total;
  pa.isHighRisk = total > 4;

  return { totalScore: total, isHighRisk: total > 4 };
}
