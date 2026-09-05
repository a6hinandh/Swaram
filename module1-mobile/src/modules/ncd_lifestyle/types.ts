/**
 * Official MoHFW Community Based Assessment Checklist (CBAC) Types
 * Module 3 - Frontend & Longitudinal Tracking Contracts
 */

// Legacy types preserved for backward compatibility
export type TobaccoHabit = 'none' | 'smoking' | 'smokeless_chewing' | 'both';
export type AlcoholIntake = 'none' | 'occasional' | 'frequent';
export type PhysicalActivityLevel = 'adequate_150min' | 'sedentary';
export type DietarySaltRisk = 'normal' | 'excessive_pickles_papads';

export interface MedicationCompliance {
  hasChronicCondition: boolean;
  prescribedConditions: ('hypertension' | 'diabetes' | 'cardiovascular')[];
  dosesTakenPastWeek: number;
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

// ============================================================================
// OFFICIAL CBAC QUESTIONNAIRE STRUCTURE (Matches MoHFW 4-Page Standard Form)
// ============================================================================

export interface CbacGeneralInfo {
  date: string;
  nameOfAsha: string;
  villageWard: string;
  nameOfMpwAnm: string;
  subCentre: string;
  ayushDispensary: string;
  phcUphc: string;
}

export interface CbacPersonalDetails {
  name: string;
  identifier: string; // Aadhar Card / UID / Voter ID
  age: number;
  sex: 'female' | 'male' | 'other';
  stateInsuranceScheme: boolean; // Yes/No
  insuranceDetails?: string;
  telephone: string;
  address: string;
  hasDisabilityOrBedridden: boolean; // Visible defect, disability, bedridden, ADL support
  disabilityDetails?: string;
}

// --- Part A: Risk Assessment (Score 0 to 10) ---
export type CbacPartAAge = 0 | 1 | 2 | 3 | 4; // <=29:0, 30-39:1, 40-49:2, 50-59:3, >60:4
export type CbacPartATobacco = 0 | 1 | 2; // Never:0, Past/Sometimes:1, Daily:2
export type CbacPartAAlcohol = 0 | 1; // No:0, Yes:1
export type CbacPartAWaist = 0 | 1 | 2; // F<=80/M<=90:0, F81-90/M91-100:1, F>90/M>100:2
export type CbacPartAPhysicalActivity = 0 | 1; // >=150min/wk:0, <150min/wk:1
export type CbacPartAFamilyHistory = 0 | 2; // No:0, Yes:2

export interface CbacPartA {
  ageScore: CbacPartAAge;
  tobaccoScore: CbacPartATobacco;
  alcoholScore: CbacPartAAlcohol;
  waistScore: CbacPartAWaist;
  waistCm?: number;
  physicalActivityScore: CbacPartAPhysicalActivity;
  familyHistoryScore: CbacPartAFamilyHistory;
  totalScore: number; // 0 to 10
  isHighRisk: boolean; // totalScore > 4
}

// --- Part B: Early Detection Symptoms (Y/N) ---
export interface CbacPartB1General {
  shortnessOfBreath: boolean;
  historyOfFits: boolean;
  coughingMoreThan2Weeks: boolean; // TB suspect *
  difficultyOpeningMouth: boolean;
  bloodInSputum: boolean; // TB suspect *
  mouthUlcersOver2Weeks: boolean;
  feverOver2Weeks: boolean; // TB suspect *
  mouthGrowthOver2Weeks: boolean;
  lossOfWeight: boolean; // TB suspect *
  mouthWhiteOrRedPatchOver2Weeks: boolean;
  nightSweats: boolean; // TB suspect *
  painWhileChewing: boolean;
  takingAntiTbDrugs: boolean; // **
  changeInVoiceTone: boolean;
  familySufferingFromTb: boolean; // **
  hypopigmentedPatchesLossOfSensation: boolean;
  historyOfTb: boolean; // *
  thickenedSkin: boolean;
  recurrentUlcerationPalmOrSole: boolean;
  skinNodules: boolean;
  recurrentTinglingPalmOrSole: boolean;
  recurrentNumbnessPalmOrSole: boolean;
  cloudyOrBlurredVision: boolean;
  clawingOfFingers: boolean;
  difficultyReading: boolean;
  tinglingNumbnessHandsFeet: boolean;
  painInEyesOver1Week: boolean;
  inabilityToCloseEyelid: boolean;
  rednessInEyesOver1Week: boolean;
  difficultyHoldingObjects: boolean;
  difficultyHearing: boolean;
  weaknessInFeetWalkingDifficulty: boolean;
}

export interface CbacPartB2WomenOnly {
  lumpInBreast: boolean;
  bleedingAfterMenopause: boolean;
  bloodStainedNippleDischarge: boolean;
  bleedingAfterIntercourse: boolean;
  changeInBreastShapeOrSize: boolean;
  foulSmellingVaginalDischarge: boolean;
  bleedingBetweenPeriods: boolean;
}

export interface CbacPartB3ElderlySpecific {
  feelingUnsteadyStandingWalking: boolean;
  needingHelpEverydayActivities: boolean; // Eating, dressing, grooming, bathing, toilet
  physicalDisabilityRestrictingMovement: boolean;
  forgettingNamesOrHomeAddress: boolean;
}

export interface CbacPartB {
  general: CbacPartB1General;
  womenOnly: CbacPartB2WomenOnly;
  elderlySpecific: CbacPartB3ElderlySpecific;
  hasAnyWarningSign: boolean; // Any Yes requires immediate Medical Officer referral
  tbSuspectIdentified: boolean; // Sputum sample collection action
  tbContactTracingRequired: boolean; // Family contact tracing by ANM/MPW
}

// --- Part C: Risk Factors for COPD ---
export type CbacCookingFuel = 'firewood' | 'crop_residue' | 'cow_dung' | 'coal' | 'kerosene' | 'lpg';
export type CbacOccupationalExposure = 'crop_burning' | 'garbage_burning' | 'industrial_smoke_dust' | 'none';

export interface CbacPartC {
  cookingFuels: CbacCookingFuel[];
  occupationalExposures: CbacOccupationalExposure[];
  copdRiskFlag: boolean; // Biomass fuel or industrial exposure present
}

// --- Part D: PHQ-2 Mental Health Screening ---
export type Phq2ScoreValue = 0 | 1 | 2 | 3; // 0: Not at all, 1: Several days, 2: > half days, 3: Nearly every day

export interface CbacPartD {
  littleInterestOrPleasure: Phq2ScoreValue;
  feelingDownDepressedHopeless: Phq2ScoreValue;
  totalScore: number; // 0 to 6
  isReferredToChoMo: boolean; // totalScore > 3
}

// --- Full Official Record ---
export interface CbacOfficialRecord {
  surveyId: string;
  beneficiaryId: string;
  timestamp: string;
  transcriptSnippet?: string;
  generalInfo: CbacGeneralInfo;
  personalDetails: CbacPersonalDetails;
  partA: CbacPartA;
  partB: CbacPartB;
  partC: CbacPartC;
  partD: CbacPartD;
  overallClassification: 'normal_routine' | 'high_ncd_risk' | 'urgent_mo_referral' | 'phq2_referral';
  actionRecommendationsMl: string;
  actionRecommendationsEn: string;
}

// --- Beneficiary Longitudinal Profile ---
export interface BeneficiaryProfile {
  beneficiaryId: string;
  name: string;
  age: number;
  sex: 'female' | 'male' | 'other';
  identifier?: string;
  telephone?: string;
  address?: string;
  villageWard?: string;
  createdAt: string;
  updatedAt: string;
  surveys: CbacOfficialRecord[];
  latestSurveyDate: string;
  latestScore: number;
  initialScore: number;
  scoreTrend: 'improved' | 'worsened' | 'stable';
  latestClassification: 'normal_routine' | 'high_ncd_risk' | 'urgent_mo_referral' | 'phq2_referral';
}
