/**
 * NCD Lifestyle & Behavioral Risk Factor Tracking Types
 * Module 3 - Frontend Contracts
 */

export type TobaccoHabit = 'none' | 'smoking' | 'smokeless_chewing' | 'both';

export type AlcoholIntake = 'none' | 'occasional' | 'frequent';

export type PhysicalActivityLevel = 'adequate_150min' | 'sedentary';

export type DietarySaltRisk = 'normal' | 'excessive_pickles_papads';

export interface MedicationCompliance {
  hasChronicCondition: boolean;
  prescribedConditions: ('hypertension' | 'diabetes' | 'cardiovascular')[];
  dosesTakenPastWeek: number; // 0 to 7
  primaryMissedReason?: 'forgot' | 'cost_shortage' | 'felt_better' | 'side_effects';
}

export interface NcdLifestyleAssessment {
  assessmentId: string;
  patientId: string;
  timestamp: string;
  age: number;
  tobacco: TobaccoHabit;
  alcohol: AlcoholIntake;
  dietarySaltRisk: DietarySaltRisk;
  physicalActivity: PhysicalActivityLevel;
  medication: MedicationCompliance;
  cbacLifestyleScore: number;
  overallLifestyleRisk: 'low' | 'moderate' | 'high';
}
