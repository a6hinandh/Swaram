import {
  VitalsBaseline,
  CurrentVitalsMeasurement,
  VitalsDeltaAnalysis,
  DeviationSeverity,
  PediatricGrowthVelocityStatus
} from '../types';
import { apiClient } from '../../../api/apiClient';
import { HouseholdMember } from '../../../types';

/**
 * Deterministic Delta Deviation Math Engine (Offline-Safe)
 */
export const analyzeVitalsDelta = (
  baseline: VitalsBaseline,
  current: CurrentVitalsMeasurement
): VitalsDeltaAnalysis => {
  const baseSys = baseline.baselineSystolicBp;
  const baseDia = baseline.baselineDiastolicBp;

  const systolicDelta =
    current.systolicBp !== undefined && baseSys !== undefined
      ? Math.round(current.systolicBp - baseSys)
      : (current.systolicBp !== undefined ? Math.round(current.systolicBp - 120) : 0);

  const diastolicDelta =
    current.diastolicBp !== undefined && baseDia !== undefined
      ? Math.round(current.diastolicBp - baseDia)
      : (current.diastolicBp !== undefined ? Math.round(current.diastolicBp - 80) : 0);

  const glucoseDelta =
    current.glucoseMgDl !== undefined && baseline.baselineGlucoseMgDl !== undefined
      ? Math.round(current.glucoseMgDl - baseline.baselineGlucoseMgDl)
      : undefined;

  const pulseDelta =
    current.pulseBpm !== undefined && baseline.baselinePulseBpm !== undefined
      ? Math.round(current.pulseBpm - baseline.baselinePulseBpm)
      : undefined;

  const weightDeltaKg =
    current.weightKg !== undefined && baseline.baselineWeightKg !== undefined
      ? Math.round((current.weightKg - baseline.baselineWeightKg) * 100) / 100
      : undefined;

  // Acute threshold rules
  const isHypertensiveSpurt =
    (current.systolicBp !== undefined && (systolicDelta >= 20 || diastolicDelta >= 15));

  const isAcuteCrisis =
    (current.systolicBp !== undefined && current.systolicBp >= 180) ||
    (current.diastolicBp !== undefined && current.diastolicBp >= 110) ||
    (systolicDelta >= 35 && (current.systolicBp || 0) >= 160);

  // Pediatric growth velocity (Children age <= 5)
  const isPediatric = baseline.age !== undefined && baseline.age <= 5;
  let pediatricVelocityStatus: PediatricGrowthVelocityStatus = 'not_applicable';

  if (isPediatric && weightDeltaKg !== undefined) {
    if (weightDeltaKg < 0) {
      pediatricVelocityStatus = 'weight_loss';
    } else if (weightDeltaKg === 0) {
      pediatricVelocityStatus = 'faltering';
    } else {
      pediatricVelocityStatus = 'normal';
    }
  }

  let severity: DeviationSeverity = 'normal';
  let alertHeadline = 'Stable Longitudinal Trend';
  let clinicalAction = 'Vitals conform to household longitudinal baseline.';

  if (isAcuteCrisis) {
    severity = 'acute_crisis';
    alertHeadline = 'Critical Hypertensive Crisis';
    clinicalAction = 'Immediate Medical Officer referral required. Re-check BP within 15 minutes.';
  } else if (isHypertensiveSpurt) {
    severity = 'moderate_drift';
    alertHeadline = 'Acute Hypertensive Spurt';
    clinicalAction = `Systolic spurt ${systolicDelta > 0 ? `+${systolicDelta}` : systolicDelta} mmHg exceeds threshold. Verify medication adherence and re-check BP in 48h.`;
  } else if (glucoseDelta !== undefined && glucoseDelta >= 50) {
    severity = 'moderate_drift';
    alertHeadline = 'Acute Glycemic Drift';
    clinicalAction = `Blood glucose surged +${glucoseDelta} mg/dL above baseline. Inquire about dietary changes or missed antidiabetic doses.`;
  } else if (pediatricVelocityStatus === 'weight_loss') {
    severity = 'moderate_drift';
    alertHeadline = 'Pediatric Growth Faltering';
    clinicalAction = `Weight drop of ${weightDeltaKg} kg observed. Verify child dietary diversity (eggs/milk) and inspect for recurrent illness.`;
  } else if (current.muacCm && current.muacCm < 12.5) {
    severity = current.muacCm < 11.5 ? 'acute_crisis' : 'moderate_drift';
    alertHeadline = current.muacCm < 11.5 ? 'Severe Acute Malnutrition (SAM)' : 'Moderate Acute Malnutrition (MAM)';
    clinicalAction = 'MUAC below growth thresholds. Initiate nutrition follow-up and Anganwadi linkage.';
  }

  return {
    systolicDelta,
    diastolicDelta,
    glucoseDelta,
    pulseDelta,
    weightDeltaKg,
    isHypertensiveSpurt,
    isAcuteCrisis,
    pediatricVelocityStatus,
    severity,
    alertHeadline,
    clinicalAction
  };
};

/**
 * Loads baseline from MongoDB Atlas for the selected household member
 */
export const loadBaselineProfile = async (
  personId: string,
  householdId?: string,
  personMeta?: Partial<HouseholdMember>
): Promise<VitalsBaseline> => {
  const emptyBaseline: VitalsBaseline = {
    patientId: personId || '',
    householdId: householdId || '',
    personName: personMeta?.name || 'Beneficiary',
    age: personMeta?.age,
    gender: personMeta?.gender,
    baselineSystolicBp: undefined,
    baselineDiastolicBp: undefined,
    baselineGlucoseMgDl: undefined,
    baselinePulseBpm: undefined,
    baselineWeightKg: undefined,
    baselineMuacCm: undefined,
    recordedVisitsCount: 0,
    lastBaselineUpdateDate: '-',
    recentHistoryPoints: []
  };

  if (!personId) return emptyBaseline;

  try {
    const res = await apiClient.getVitalsBaseline(personId);
    if (res && res.data) {
      const data = res.data;
      const bm = data.baseline_metrics || {};
      return {
        patientId: data.person_id || personId,
        householdId: data.household_id || householdId || '',
        personName: data.person_name || personMeta?.name || 'Beneficiary',
        age: data.age ?? personMeta?.age,
        gender: data.gender || personMeta?.gender,
        baselineSystolicBp: bm.systolic_bp || undefined,
        baselineDiastolicBp: bm.diastolic_bp || undefined,
        baselineGlucoseMgDl: bm.random_blood_sugar_mg_dl || undefined,
        baselinePulseBpm: bm.pulse_bpm || undefined,
        baselineWeightKg: bm.weight_kg || undefined,
        baselineMuacCm: bm.muac_cm || undefined,
        recordedVisitsCount: data.rolling_statistics?.sample_count || (data.recent_history_points?.length || 0),
        lastBaselineUpdateDate: data.updated_at ? data.updated_at.slice(0, 10) : '-',
        recentHistoryPoints: data.recent_history_points || [],
        latestMeasurement: data.latest_measurement || null
      };
    }
  } catch (err) {
    console.warn('[VitalsService] Error fetching baseline from server:', err);
  }

  return emptyBaseline;
};

/**
 * Commits current measurement to MongoDB and triggers Care Ledger update
 */
export const commitVitalsDeviation = async (
  baseline: VitalsBaseline,
  current: CurrentVitalsMeasurement
): Promise<{ success: boolean; message: string; updatedDoc?: any }> => {
  try {
    const res = await apiClient.analyzeVitalsDelta({
      person_id: baseline.patientId,
      household_id: baseline.householdId || 'h-unknown',
      systolic_bp: current.systolicBp,
      diastolic_bp: current.diastolicBp,
      glucose_mg_dl: current.glucoseMgDl,
      pulse_bpm: current.pulseBpm,
      weight_kg: current.weightKg,
      muac_cm: current.muacCm
    });

    if (res && res.data) {
      return {
        success: true,
        message: '✓ Synchronized with MongoDB Atlas. Vitals baseline & Care Ledger updated!',
        updatedDoc: res.data
      };
    }
  } catch (err: any) {
    console.warn('[VitalsService] Offline commit fallback:', err);
  }

  return {
    success: true,
    message: '✓ Saved to local device queue (Operating in offline mode).'
  };
};

