import { TobaccoHabit, AlcoholIntake, PhysicalActivityLevel, DietarySaltRisk, MedicationCompliance } from '../types';

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
    score += 2; // Medication non-adherence is high clinical risk
  }

  const level = score >= 4 ? 'high' : score >= 2 ? 'moderate' : 'low';
  return { score, level };
};
