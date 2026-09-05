/**
 * Longitudinal Vitals Baseline & Delta Deviation Detector Types
 * Production Frontend Contracts (Mobile <-> Backend MongoDB)
 */

export interface HistoricalVitalsPoint {
  date: string;
  systolic?: number | null;
  diastolic?: number | null;
  glucose?: number | null;
  pulse?: number | null;
  weight?: number | null;
  muac?: number | null;
}

export interface VitalsBaseline {
  patientId: string;
  householdId?: string;
  personName: string;
  age?: number;
  gender?: string;
  baselineSystolicBp?: number;
  baselineDiastolicBp?: number;
  baselineGlucoseMgDl?: number;
  baselinePulseBpm?: number;
  baselineWeightKg?: number;
  baselineMuacCm?: number;
  recordedVisitsCount: number;
  lastBaselineUpdateDate: string;
  recentHistoryPoints?: HistoricalVitalsPoint[];
}

export interface CurrentVitalsMeasurement {
  systolicBp?: number;
  diastolicBp?: number;
  glucoseMgDl?: number;
  pulseBpm?: number;
  weightKg?: number;
  muacCm?: number;
  measuredAt: string;
}

export type DeviationSeverity = 'normal' | 'moderate_drift' | 'acute_crisis';
export type PediatricGrowthVelocityStatus = 'normal' | 'faltering' | 'weight_loss' | 'not_applicable';

export interface VitalsDeltaAnalysis {
  systolicDelta: number;
  diastolicDelta: number;
  glucoseDelta?: number;
  pulseDelta?: number;
  weightDeltaKg?: number;
  isHypertensiveSpurt: boolean;
  isAcuteCrisis: boolean;
  pediatricVelocityStatus: PediatricGrowthVelocityStatus;
  severity: DeviationSeverity;
  alertHeadline: string;
  clinicalAction: string;
}

export interface BeneficiaryPersona {
  id: string;
  name: string;
  age: number;
  gender: string;
  category: 'Elderly / NCD' | 'Child / Growth' | 'Maternal / ANC';
  description: string;
  defaultBaseline: VitalsBaseline;
  defaultCurrent: CurrentVitalsMeasurement;
}

