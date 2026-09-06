export * from '../../../contracts/types';

export interface HouseholdSummary {
  id: string;
  external_id: string;
  head_of_household: string;
  address: string;
  members_count: number;
  open_care_gaps: number;
  priority_score: number;
  priority_reasons: string[];
  malnutrition_risk?: string;
}

export interface HouseholdMember {
  person_id: string;
  household_id: string;
  name: string;
  age?: number;
  gender?: string;
  relationship?: string;
  life_stage?: string;
  pregnancy_status?: string;
  pregnancy_weeks?: number;
  chronic_conditions?: string[];
  created_at?: string;
}

export interface AudioRecordingState {
  isRecording: boolean;
  durationMs: number;
  audioUri: string | null;
}

