/**
 * Structured Clinical Record Contract
 * Canonical schema for voice-extracted clinical visits strictly matching the required specification.
 */

export type VisitType = 'routine' | 'follow_up' | 'referral';
export type Sex = 'male' | 'female' | 'other' | 'unknown';
export type LifeStage = 'infant' | 'child' | 'adolescent' | 'adult' | 'elderly';
export type PregnancyStatus = 'pregnant' | 'postpartum' | 'not_pregnant' | 'unknown';
export type Severity = 'mild' | 'moderate' | 'severe' | 'unknown';
export type Trend = 'improving' | 'worsening' | 'unchanged' | 'unknown';
export type ConditionStatus = 'active' | 'resolved' | 'unknown';
export type YesNoUnknown = 'yes' | 'no' | 'unknown';
export type Adherence = 'regular' | 'irregular' | 'stopped' | 'unknown';
export type ImmunizationStatus = 'up_to_date' | 'pending' | 'overdue' | 'unknown';
export type MaternalSupplements = 'taking' | 'not_taking' | 'unknown';
export type Breastfeeding = 'exclusive' | 'partial' | 'none' | 'unknown';
export type FeedingStatus = 'started' | 'not_started' | 'unknown';
export type MalnutritionRisk = 'normal' | 'mam' | 'sam' | 'unknown';
export type MoodAffect = 'normal' | 'depressed' | 'anxious' | 'confused' | 'unknown';
export type GapType = 'immunization' | 'screening' | 'medication' | 'maternal' | 'referral';
export type GapSeverity = 'low' | 'medium' | 'high';
export type GapStatus = 'open' | 'resolved';
export type FollowUpAssignedTo = 'asha' | 'anm' | 'mo' | 'none';
export type LanguageDetected = 'ml' | 'en' | 'mixed';

export interface VisitInfo {
  visit_id: string;
  household_id: string;
  date: string; // YYYY-MM-DD
  visit_type: VisitType;
}

export interface PersonInfo {
  person_id: string;
  name: string;
  age: number | null;
  sex: Sex;
  relationship: string;
  life_stage: LifeStage;
  pregnancy_status: PregnancyStatus;
}

export interface ComplaintItem {
  symptom: string;
  duration: string;
  severity: Severity;
  trend: Trend;
}

export interface KnownConditionItem {
  condition: string;
  status: ConditionStatus;
}

export interface MedicationItem {
  name: string;
  taking: YesNoUnknown;
  adherence: Adherence;
  available: YesNoUnknown;
}

export interface HealthStatus {
  complaints: ComplaintItem[];
  known_conditions: KnownConditionItem[];
  medications: MedicationItem[];
}

export interface Measurements {
  blood_pressure: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  temperature_f: number | null;
  pulse_bpm: number | null;
  spo2_percent: number | null;
  blood_sugar_mg_dl: number | null;
  hemoglobin_g_dl: number | null;
}

export interface ImmunizationInfo {
  status: ImmunizationStatus;
  vaccines_due: string[];
  vaccines_given: string[];
}

export interface ScreeningItem {
  test: string;
  result: string;
  date: string; // YYYY-MM-DD
}

export interface MaternalCareInfo {
  anc_visits_done: number | null;
  ifa_tablets_received: number | null;
  edd: string | null; // YYYY-MM-DD
  complications: string[];
  supplements: MaternalSupplements;
}

export interface PreventiveCare {
  immunization: ImmunizationInfo;
  screenings: ScreeningItem[];
  maternal_care: MaternalCareInfo;
}

export interface ChildNutritionInfo {
  breastfeeding: Breastfeeding;
  complementary_feeding: FeedingStatus;
  sam_mam_risk: MalnutritionRisk;
}

export interface GeneralDietInfo {
  meals_per_day: number | null;
  dietary_concerns: string[];
}

export interface NutritionInfo {
  child_nutrition: ChildNutritionInfo;
  general_diet: GeneralDietInfo;
}

export interface SubstanceUseInfo {
  tobacco: YesNoUnknown;
  alcohol: YesNoUnknown;
  other: string;
}

export interface MentalSocialInfo {
  mood_affect: MoodAffect;
  substance_use: SubstanceUseInfo;
  social_risk_factors: string[];
}

export interface RecentHospitalizationItem {
  reason: string;
  approx_date: string; // YYYY-MM
}

export interface CareHistory {
  recent_hospitalizations: RecentHospitalizationItem[];
  allergies: string[];
}

export interface CareGapItem {
  gap_type: GapType;
  description: string;
  severity: GapSeverity;
  status: GapStatus;
}

export interface FollowUpInfo {
  required: 'yes' | 'no';
  due_date: string | null; // YYYY-MM-DD
  reason: string | null;
  assigned_to: FollowUpAssignedTo;
}

export interface ExtractionMetadata {
  source_transcript: string;
  extraction_timestamp: string; // ISO 8601
  confidence_score: number; // 0 to 1
  language_detected: LanguageDetected;
}

/**
 * Complete Canonical Structured Clinical Record Schema
 */
export interface StructuredClinicalRecord {
  visit: VisitInfo;
  person: PersonInfo;
  health_status: HealthStatus;
  measurements: Measurements;
  preventive_care: PreventiveCare;
  nutrition: NutritionInfo;
  mental_social: MentalSocialInfo;
  care_history: CareHistory;
  care_gaps: CareGapItem[];
  follow_up: FollowUpInfo;
  extraction: ExtractionMetadata;
}

/**
 * Creates an empty, fully initialized record satisfying all schema constraints
 */
export function createEmptyClinicalRecord(
  visitId: string = `visit_${Date.now()}`,
  householdId: string = 'hh_default'
): StructuredClinicalRecord {
  const today = new Date().toISOString().split('T')[0];

  return {
    visit: {
      visit_id: visitId,
      household_id: householdId,
      date: today,
      visit_type: 'routine',
    },
    person: {
      person_id: `p_${Date.now()}`,
      name: '',
      age: null,
      sex: 'unknown',
      relationship: 'Self',
      life_stage: 'adult',
      pregnancy_status: 'unknown',
    },
    health_status: {
      complaints: [],
      known_conditions: [],
      medications: [],
    },
    measurements: {
      blood_pressure: null,
      weight_kg: null,
      height_cm: null,
      temperature_f: null,
      pulse_bpm: null,
      spo2_percent: null,
      blood_sugar_mg_dl: null,
      hemoglobin_g_dl: null,
    },
    preventive_care: {
      immunization: {
        status: 'unknown',
        vaccines_due: [],
        vaccines_given: [],
      },
      screenings: [],
      maternal_care: {
        anc_visits_done: null,
        ifa_tablets_received: null,
        edd: null,
        complications: [],
        supplements: 'unknown',
      },
    },
    nutrition: {
      child_nutrition: {
        breastfeeding: 'unknown',
        complementary_feeding: 'unknown',
        sam_mam_risk: 'unknown',
      },
      general_diet: {
        meals_per_day: null,
        dietary_concerns: [],
      },
    },
    mental_social: {
      mood_affect: 'unknown',
      substance_use: {
        tobacco: 'unknown',
        alcohol: 'unknown',
        other: '',
      },
      social_risk_factors: [],
    },
    care_history: {
      recent_hospitalizations: [],
      allergies: [],
    },
    care_gaps: [],
    follow_up: {
      required: 'no',
      due_date: null,
      reason: null,
      assigned_to: 'none',
    },
    extraction: {
      source_transcript: '',
      extraction_timestamp: new Date().toISOString(),
      confidence_score: 0,
      language_detected: 'ml',
    },
  };
}
