/**
 * Swaram Multi-Domain Shared Module Contracts
 * Root definitions for backend services & reporting pipelines
 */

export interface PatientContext {
  household_id: string;
  member_id: string;
  name: string;
  age: number;
  gender: 'female' | 'male' | 'other';
  ward_number: number;
}

export interface MentalHealthPayload {
  screening_id: string;
  phq2_score: number;
  referral_needed: boolean;
  voice_distress_tier: 'low' | 'moderate' | 'high';
  postpartum_flag: boolean;
  urgent_safety_alert: boolean;
}

export interface EnvironmentalRiskPayload {
  assessment_id: string;
  heat_index_tier: 'normal' | 'caution' | 'extreme_caution' | 'danger';
  indoor_smoke_exposure: 'none' | 'moderate' | 'heavy_biomass';
  water_source_safety: 'piped_treated' | 'boiled' | 'open_well_untested' | 'stagnant_near_home';
  vector_risk_present: boolean;
  overall_climate_risk: 'low' | 'moderate' | 'high';
}

export interface NcdLifestylePayload {
  assessment_id: string;
  cbac_score: number;
  tobacco_user: boolean;
  alcohol_frequency: 'never' | 'occasional' | 'frequent';
  dietary_salt_risk: boolean;
  physical_inactivity_flag: boolean;
  medication_compliance_days: number; // 0-7
  overall_lifestyle_risk: 'low' | 'moderate' | 'high';
}

export interface VitalsDeltaPayload {
  assessment_id: string;
  baseline_systolic: number;
  baseline_diastolic: number;
  current_systolic: number;
  current_diastolic: number;
  systolic_delta: number;
  diastolic_delta: number;
  is_hypertensive_spurt: boolean;
  severity: 'normal' | 'moderate_drift' | 'acute_crisis';
}

export interface SwaramExtendedAssessmentPayload {
  patient: PatientContext;
  recorded_by_worker_id: string;
  recorded_at: string;
  mental_health?: MentalHealthPayload;
  environmental_risk?: EnvironmentalRiskPayload;
  ncd_lifestyle?: NcdLifestylePayload;
  vitals_delta?: VitalsDeltaPayload;
}
