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
}

export interface AudioRecordingState {
  isRecording: boolean;
  durationMs: number;
  audioUri: string | null;
}
