/**
 * Swaram Shared TypeScript Contracts
 * The Next-Generation ASHA Worker Platform Core Contracts
 */

export interface Vitals {
  systolic_bp?: number;
  diastolic_bp?: number;
  weight_kg?: number;
  height_cm?: number;
  pulse_bpm?: number;
  temperature_c?: number;
  hemoglobin_g_dl?: number;
}

export type MalnutritionRiskLevel = 'normal' | 'moderate' | 'severe';

export interface MalnutritionAssessment {
  child_age_months?: number;
  muac_cm?: number;
  wasting_status?: 'normal' | 'moderate_wasting' | 'severe_acute_malnutrition';
  stunting_status?: 'normal' | 'stunted' | 'severely_stunted';
  waz_zscore?: number;
  haz_zscore?: number;
  growth_velocity_status?: 'normal' | 'faltering' | 'weight_loss' | 'unknown';
  previous_weight_kg?: number;
  weight_delta_kg?: number;
  dietary_diversity_score?: number; // e.g. 0 to 8 food groups
  consumed_milk?: boolean;
  consumed_eggs?: boolean;
  consumed_pulses?: boolean;
  edema_present?: boolean;
  maternal_anemia_flag?: boolean;
  risk_level: MalnutritionRiskLevel;
  clinical_notes?: string;
}

export type SurveySection = 'demographics' | 'ncd_lifestyle' | 'malnutrition' | 'maternal_child';

export interface SwaramSurveyField {
  field_key: string;
  section: SurveySection;
  question_ml: string;
  question_en: string;
  value: string;
  status: 'extracted' | 'clarified_conversationally' | 'missing';
}

export interface MissingFieldPrompt {
  question_id: string;
  field_target: string;
  question_text_ml: string;
  question_text_en: string;
  is_mandatory: boolean;
}

export interface MentalHealthAssessment {
  anxiety_score?: number; // 0 to 6 (GAD-2)
  depression_score?: number; // 0 to 6 (PHQ-2)
  total_score?: number; // 0 to 12 (PHQ-4)
  risk_level?: 'normal' | 'mild' | 'moderate' | 'severe';
  screening_status?: 'completed' | 'partial' | 'pending';
}

export interface PersonUpdate {
  person_id: string;
  name: string;
  age?: number;
  gender?: string;
  pregnancy_weeks?: number;
  vitals?: Vitals;
  malnutrition?: MalnutritionAssessment;
  mental_health?: MentalHealthAssessment;
  symptoms?: string[];
  medications_given?: string[];
  services_provided?: string[];
  follow_up_date?: string;
}

export interface VisitDraft {
  visit_id: string;
  household_id: string;
  worker_id: string;
  timestamp: string;
  language: 'ml' | 'en';
  transcript: string;
  person_updates: PersonUpdate[];
  confidence: number;
  validation_flags: string[];
  confirmation_status: 'pending' | 'confirmed' | 'corrected';
  survey_fields?: SwaramSurveyField[];
  missing_field_prompts?: MissingFieldPrompt[];
  malnutrition_assessment?: MalnutritionAssessment;
}

export interface ConfirmedVisit {
  visit_id: string;
  household_id: string;
  worker_id: string;
  timestamp: string;
  person_updates: PersonUpdate[];
  survey_fields?: SwaramSurveyField[];
  malnutrition_assessment?: MalnutritionAssessment;
  audio_record_ref?: string;
  confirmed_by_worker_at: string;
  corrections_made?: string[];
  sync_status: 'pending' | 'syncing' | 'synced' | 'failed';
}

export interface CareGapEvidence {
  source_record_id?: string;
  source_type: string;
  observed_at: string;
}

export interface QuestionPrompt {
  question_id: string;
  question_text_ml: string;
  question_text_en: string;
  field_target?: string;
}

export type ProgrammeType = 
  | 'maternal' 
  | 'child_immunisation' 
  | 'nutrition' 
  | 'malnutrition' 
  | 'ncd' 
  | 'mental_health' 
  | 'community_survey';

export type CareGapSeverity = 'low' | 'medium' | 'high' | 'critical';

export type CareGapStatus =
  | 'open'
  | 'needs_information'
  | 'action_ready'
  | 'action_in_progress'
  | 'reported'
  | 'resolved'
  | 'declined'
  | 'unable_to_complete';

export interface CareGap {
  id: string;
  household_id: string;
  person_id?: string;
  programme: ProgrammeType;
  gap_type: string;
  description: string;
  evidence: CareGapEvidence[];
  severity: CareGapSeverity;
  status: CareGapStatus;
  due_date?: string;
  owner?: string;
  recommended_action?: string;
  required_questions?: QuestionPrompt[];
  last_reviewed_at: string;
  resolution_evidence?: string;
}

export interface HouseholdCareLedger {
  household_id: string;
  household_name: string;
  updated_at: string;
  open_gaps_count: number;
  care_gaps: CareGap[];
  priority_score: number;
  priority_reasons: string[];
  longitudinal_narrative: string;
  malnutrition_trend?: string;
}

export interface ActionItem {
  action_id: string;
  household_id: string;
  care_gap_id?: string;
  title: string;
  description?: string;
  assigned_to: string;
  due_date: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

export interface PreparedForm {
  form_id: string;
  target_portal: 'swaram_health_portal' | 'mock_shaili_portal' | 'mock_anmol_portal' | 'mock_rch_portal' | 'mock_ncd_portal';
  visit_ref_id?: string;
  mapped_fields: Record<string, string>;
  validation_passed: boolean;
  missing_fields?: string[];
}

export interface SubmissionResult {
  submission_id: string;
  form_id: string;
  status: 'success' | 'failed' | 'pending_worker_confirmation';
  acknowledgement_number?: string;
  error_message?: string;
  timestamp: string;
}

export interface SyncItemPayload {
  client_event_id: string;
  entity: 'visit' | 'care_gap' | 'action';
  operation: 'create' | 'update';
  payload: ConfirmedVisit | CareGap | ActionItem;
}

export interface SyncPushRequest {
  device_id: string;
  items: SyncItemPayload[];
}

export interface SyncPushResponse {
  accepted: string[];
  failed: Array<{ client_event_id: string; reason: string }>;
}
