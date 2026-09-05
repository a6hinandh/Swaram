import { VitalsBaseline, CurrentVitalsMeasurement, VitalsDeltaAnalysis, DeviationSeverity } from '../types';

export const analyzeVitalsDelta = (
  baseline: VitalsBaseline,
  current: CurrentVitalsMeasurement
): VitalsDeltaAnalysis => {
  const systolicDelta = current.systolicBp - baseline.baselineSystolicBp;
  const diastolicDelta = current.diastolicBp - baseline.baselineDiastolicBp;

  const glucoseDelta =
    current.glucoseMgDl !== undefined && baseline.baselineGlucoseMgDl !== undefined
      ? current.glucoseMgDl - baseline.baselineGlucoseMgDl
      : undefined;

  const pulseDelta =
    current.pulseBpm !== undefined && baseline.baselinePulseBpm !== undefined
      ? current.pulseBpm - baseline.baselinePulseBpm
      : undefined;

  // Acute threshold rules
  const isHypertensiveSpurt = systolicDelta >= 20 || diastolicDelta >= 15;
  const isAcuteCrisis =
    current.systolicBp >= 180 ||
    current.diastolicBp >= 110 ||
    (systolicDelta >= 35 && current.systolicBp >= 160);

  let severity: DeviationSeverity = 'normal';
  let alertHeadline = 'Stable Longitudinal Trend';
  let clinicalAction = 'Vitals conform to household longitudinal baseline.';

  if (isAcuteCrisis) {
    severity = 'acute_crisis';
    alertHeadline = 'Acute Hypertensive Deviation';
    clinicalAction = 'Immediate medical officer referral required. Re-check BP within 15 minutes.';
  } else if (isHypertensiveSpurt || (glucoseDelta && glucoseDelta >= 50)) {
    severity = 'moderate_drift';
    alertHeadline = 'Baseline Drift Detected';
    clinicalAction = 'Systolic deviation exceeds 20 mmHg threshold. Verify medication adherence.';
  }

  return {
    systolicDelta,
    diastolicDelta,
    glucoseDelta,
    pulseDelta,
    isHypertensiveSpurt,
    severity,
    alertHeadline,
    clinicalAction
  };
};
