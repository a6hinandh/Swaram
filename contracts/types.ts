/**
 * Swaram Shared TypeScript Contracts
 * Cross-module type definitions frozen across all four team members.
 */

export interface Vitals {
  systolic_bp?: number;
  diastolic_bp?: number;
  weight_kg?: number;
  temperature_c?: number;
  hemoglobin_g_dl?: number;
}

export interface PersonUpdate {
  person_id: string;
  name: string;
  pregnancy_weeks?: number;
  vitals?: Vitals;
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
}

export interface ConfirmedVisit {
  visit_id: string;
  household_id: string;
  worker_id: string;
  timestamp: string;
  person_updates: PersonUpdate[];
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

export type ProgrammeType = 'maternal' | 'child_immunisation' | 'nutrition' | 'ncd' | 'mental_health';

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
  target_portal: 'mock_anmol_portal' | 'mock_rch_portal' | 'mock_ncd_portal';
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
