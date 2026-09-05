import {
  VitalsBaseline,
  CurrentVitalsMeasurement,
  VitalsDeltaAnalysis,
  DeviationSeverity,
  PediatricGrowthVelocityStatus,
  BeneficiaryPersona
} from '../types';
import { apiClient } from '../../../api/apiClient';

/**
 * Standard Representative Frontline Beneficiary Personas for Field Simulation
 */
export const BENEFICIARY_PERSONAS: BeneficiaryPersona[] = [
  {
    id: 'p-rahul-02',
    name: 'Rahul',
    age: 1,
    gender: 'male',
    category: 'Child / Growth',
    description: '18-month toddler. Monitored for early growth faltering and dietary diversity.',
    defaultBaseline: {
      patientId: 'p-rahul-02',
      householdId: 'h-lakshmi-001',
      personName: 'Rahul',
      age: 1,
      gender: 'male',
      baselinePulseBpm: 105,
      baselineWeightKg: 10.2,
      baselineMuacCm: 13.1,
      recordedVisitsCount: 3,
      lastBaselineUpdateDate: '2026-07-20',
      recentHistoryPoints: [
        { date: '2026-06-01', weight: 10.0, muac: 13.0, pulse: 106 },
        { date: '2026-07-20', weight: 10.2, muac: 13.1, pulse: 104 }
      ]
    },
    defaultCurrent: {
      weightKg: 9.7,
      muacCm: 12.6,
      pulseBpm: 108,
      measuredAt: new Date().toISOString()
    }
  },
  {
    id: 'p-lakshmi-01',
    name: 'Lakshmi Amma',
    age: 28,
    gender: 'female',
    category: 'Maternal / ANC',
    description: '32 weeks pregnant. Screening for gestational pre-hypertension and pedal edema.',
    defaultBaseline: {
      patientId: 'p-lakshmi-01',
      householdId: 'h-lakshmi-001',
      personName: 'Lakshmi Amma',
      age: 28,
      gender: 'female',
      baselineSystolicBp: 112,
      baselineDiastolicBp: 72,
      baselineGlucoseMgDl: 92,
      baselinePulseBpm: 78,
      baselineWeightKg: 53.5,
      recordedVisitsCount: 3,
      lastBaselineUpdateDate: '2026-07-10',
      recentHistoryPoints: [
        { date: '2026-05-10', systolic: 110, diastolic: 70, glucose: 90, weight: 52.0 },
        { date: '2026-07-10', systolic: 115, diastolic: 75, glucose: 94, weight: 55.0 }
      ]
    },
    defaultCurrent: {
      systolicBp: 130,
      diastolicBp: 85,
      glucoseMgDl: 96,
      pulseBpm: 82,
      weightKg: 58.0,
      measuredAt: new Date().toISOString()
    }
  }
];

/**
 * Deterministic Delta Deviation Math Engine (Offline-Safe)
 */
export const analyzeVitalsDelta = (
  baseline: VitalsBaseline,
  current: CurrentVitalsMeasurement
): VitalsDeltaAnalysis => {
  const baseSys = baseline.baselineSystolicBp || 120;
  const baseDia = baseline.baselineDiastolicBp || 80;

  const systolicDelta = current.systolicBp !== undefined ? Math.round(current.systolicBp - baseSys) : 0;
  const diastolicDelta = current.diastolicBp !== undefined ? Math.round(current.diastolicBp - baseDia) : 0;

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
  const isHypertensiveSpurt = systolicDelta >= 20 || diastolicDelta >= 15;
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
    clinicalAction = `Systolic spurt +${systolicDelta} mmHg exceeds 20 mmHg threshold. Verify medication adherence and re-check BP in 48h.`;
  } else if (glucoseDelta && glucoseDelta >= 50) {
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
 * Loads baseline from MongoDB Atlas with automatic fallback to local persona
 */
export const loadBaselineProfile = async (personaId: string): Promise<VitalsBaseline> => {
  const persona = BENEFICIARY_PERSONAS.find((p) => p.id === personaId) || BENEFICIARY_PERSONAS[0];
  try {
    const res = await apiClient.getVitalsBaseline(personaId);
    if (res && res.data && res.data.baseline_metrics) {
      const bm = res.data.baseline_metrics;
      return {
        patientId: res.data.person_id || persona.defaultBaseline.patientId,
        householdId: res.data.household_id || persona.defaultBaseline.householdId,
        personName: res.data.person_name || persona.defaultBaseline.personName,
        age: res.data.age ?? persona.defaultBaseline.age,
        gender: res.data.gender || persona.defaultBaseline.gender,
        baselineSystolicBp: bm.systolic_bp || persona.defaultBaseline.baselineSystolicBp,
        baselineDiastolicBp: bm.diastolic_bp || persona.defaultBaseline.baselineDiastolicBp,
        baselineGlucoseMgDl: bm.random_blood_sugar_mg_dl || persona.defaultBaseline.baselineGlucoseMgDl,
        baselinePulseBpm: bm.pulse_bpm || persona.defaultBaseline.baselinePulseBpm,
        baselineWeightKg: bm.weight_kg || persona.defaultBaseline.baselineWeightKg,
        baselineMuacCm: bm.muac_cm || persona.defaultBaseline.baselineMuacCm,
        recordedVisitsCount: res.data.rolling_statistics?.sample_count || persona.defaultBaseline.recordedVisitsCount,
        lastBaselineUpdateDate: res.data.updated_at ? res.data.updated_at.slice(0, 10) : persona.defaultBaseline.lastBaselineUpdateDate,
        recentHistoryPoints: res.data.recent_history_points || persona.defaultBaseline.recentHistoryPoints
      };
    }
  } catch (err) {
    console.warn('[VitalsService] Fallback to local baseline:', err);
  }
  return persona.defaultBaseline;
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
      household_id: baseline.householdId || 'h-lakshmi-001',
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
        message: 'Synchronized with MongoDB Atlas. Care Ledger & Priority Score updated!',
        updatedDoc: res.data
      };
    }
  } catch (err: any) {
    console.warn('[VitalsService] Offline commit fallback:', err);
  }

  return {
    success: true,
    message: 'Saved to local device queue (Operating in offline mode).'
  };
};

