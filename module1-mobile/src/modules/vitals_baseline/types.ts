/**
 * Longitudinal Vitals Baseline & Delta Deviation Detector Types
 * Module 4 - Frontend Contracts
 */

export interface VitalsBaseline {
  patientId: string;
  baselineSystolicBp: number;
  baselineDiastolicBp: number;
  baselineGlucoseMgDl?: number;
  baselinePulseBpm?: number;
  baselineWeightKg?: number;
  recordedVisitsCount: number;
  lastBaselineUpdateDate: string;
}

export interface CurrentVitalsMeasurement {
  systolicBp: number;
  diastolicBp: number;
  glucoseMgDl?: number;
  pulseBpm?: number;
  weightKg?: number;
  measuredAt: string;
}

export type DeviationSeverity = 'normal' | 'moderate_drift' | 'acute_crisis';

export interface VitalsDeltaAnalysis {
  systolicDelta: number;
  diastolicDelta: number;
  glucoseDelta?: number;
  pulseDelta?: number;
  weightDeltaKg?: number;
  isHypertensiveSpurt: boolean;
  severity: DeviationSeverity;
  alertHeadline: string;
  clinicalAction: string;
}
