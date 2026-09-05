import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView
} from 'react-native';
import { AppIcon } from '../shared/navigation/AppIcon';
import { VitalsBaseline, CurrentVitalsMeasurement } from './types';
import { analyzeVitalsDelta } from './services/vitalsBaselineService';

export const VitalsBaselineScreen: React.FC = () => {
  const [systolic, setSystolic] = useState<number>(148);
  const [diastolic, setDiastolic] = useState<number>(92);
  const [glucose, setGlucose] = useState<number>(185);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Established longitudinal baseline (historical 6-month average)
  const baseline: VitalsBaseline = {
    patientId: 'P-104-02',
    baselineSystolicBp: 120,
    baselineDiastolicBp: 80,
    baselineGlucoseMgDl: 115,
    baselinePulseBpm: 72,
    recordedVisitsCount: 6,
    lastBaselineUpdateDate: '2026-08-10'
  };

  const current: CurrentVitalsMeasurement = {
    systolicBp: systolic,
    diastolicBp: diastolic,
    glucoseMgDl: glucose,
    pulseBpm: 76,
    measuredAt: new Date().toISOString()
  };

  const delta = analyzeVitalsDelta(baseline, current);

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.headerBlock}>
          <Text style={styles.title}>Vitals Baseline & Delta Deviation</Text>
          <Text style={styles.subtitle}>Longitudinal moving averages and acute deviation detection</Text>
        </View>

        {/* Patient Context */}
        <View style={styles.patientCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.patientName}>Radhamani P. (Age 62)</Text>
            <Text style={styles.patientMeta}>Baseline established over 6 longitudinal visits</Text>
          </View>
          <View style={styles.patientTag}>
            <Text style={styles.patientTagText}>Tracked Patient</Text>
          </View>
        </View>

        {/* Comparison: Historical Baseline vs Current */}
        <View style={styles.comparisonGrid}>
          {/* Historical Baseline */}
          <View style={styles.halfCard}>
            <Text style={styles.columnLabel}>6-Month Baseline</Text>
            <View style={styles.statRow}>
              <Text style={styles.statItemLabel}>Resting BP</Text>
              <Text style={styles.statItemVal}>
                {baseline.baselineSystolicBp}/{baseline.baselineDiastolicBp}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statItemLabel}>Blood Glucose</Text>
              <Text style={styles.statItemVal}>{baseline.baselineGlucoseMgDl} mg/dL</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statItemLabel}>Resting Pulse</Text>
              <Text style={styles.statItemVal}>{baseline.baselinePulseBpm} bpm</Text>
            </View>
          </View>

          {/* Today's Reading */}
          <View style={[styles.halfCard, styles.halfCardActive]}>
            <Text style={[styles.columnLabel, { color: '#065F46' }]}>Today's Reading</Text>
            <View style={styles.statRow}>
              <Text style={styles.statItemLabel}>Measured BP</Text>
              <Text style={[styles.statItemVal, { color: '#111827' }]}>
                {systolic}/{diastolic}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statItemLabel}>Blood Glucose</Text>
              <Text style={[styles.statItemVal, { color: '#111827' }]}>{glucose} mg/dL</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statItemLabel}>Pulse Rate</Text>
              <Text style={[styles.statItemVal, { color: '#111827' }]}>76 bpm</Text>
            </View>
          </View>
        </View>

        {/* Interactive Delta Simulator Controls */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Adjust Today's Blood Pressure</Text>
          <Text style={styles.cardSectionSubtitle}>Test delta detection engine thresholds</Text>

          <View style={styles.stepperSection}>
            <View style={styles.stepperRow}>
              <Text style={styles.stepperLabel}>Systolic (mmHg): {systolic}</Text>
              <View style={styles.stepperButtons}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setSystolic((prev) => Math.max(90, prev - 10))}
                >
                  <Text style={styles.stepBtnText}>-10</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setSystolic((prev) => Math.min(220, prev + 10))}
                >
                  <Text style={styles.stepBtnText}>+10</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.stepperRow}>
              <Text style={styles.stepperLabel}>Diastolic (mmHg): {diastolic}</Text>
              <View style={styles.stepperButtons}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setDiastolic((prev) => Math.max(50, prev - 5))}
                >
                  <Text style={styles.stepBtnText}>-5</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setDiastolic((prev) => Math.min(130, prev + 5))}
                >
                  <Text style={styles.stepBtnText}>+5</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Delta Output Card */}
        <View
          style={[
            styles.deltaCard,
            delta.severity === 'acute_crisis'
              ? styles.deltaCardCrisis
              : delta.severity === 'moderate_drift'
              ? styles.deltaCardDrift
              : styles.deltaCardNormal
          ]}
        >
          <View style={styles.deltaHeader}>
            <AppIcon
              name={delta.severity === 'normal' ? 'check' : 'alert'}
              size={20}
              color={
                delta.severity === 'acute_crisis'
                  ? '#DC2626'
                  : delta.severity === 'moderate_drift'
                  ? '#B45309'
                  : '#047857'
              }
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.deltaTitle}>{delta.alertHeadline}</Text>
              <Text style={styles.deltaMetrics}>
                Systolic Delta: {delta.systolicDelta > 0 ? `+${delta.systolicDelta}` : delta.systolicDelta} mmHg | Diastolic Delta: {delta.diastolicDelta > 0 ? `+${delta.diastolicDelta}` : delta.diastolicDelta} mmHg
              </Text>
              <Text style={styles.deltaAction}>{delta.clinicalAction}</Text>
            </View>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity style={styles.primaryButton} onPress={handleSave}>
          <AppIcon name="check" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>
            {savedSuccess ? 'Deviation Logged' : 'Save Vitals Reading'}
          </Text>
        </TouchableOpacity>

        {/* Teammate 4 Scaffold Note */}
        <View style={styles.devNote}>
          <View style={styles.devNoteHeader}>
            <AppIcon name="info" size={16} color="#4B5563" />
            <Text style={styles.devNoteTitle}>Teammate 4 Workspace</Text>
          </View>
          <Text style={styles.devNoteBody}>
            Extend this module in src/modules/vitals_baseline. Connect SQLite longitudinal vitals history, implement exponential moving averages, and integrate pediatric growth velocity.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB'
  },
  container: {
    padding: 16,
    paddingBottom: 40
  },
  headerBlock: {
    marginBottom: 14
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2
  },
  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12
  },
  patientName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937'
  },
  patientMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2
  },
  patientTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  patientTagText: {
    fontSize: 11,
    color: '#065F46',
    fontWeight: '600'
  },
  comparisonGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12
  },
  halfCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  halfCardActive: {
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4'
  },
  columnLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8
  },
  statRow: {
    marginBottom: 6
  },
  statItemLabel: {
    fontSize: 11,
    color: '#6B7280'
  },
  statItemVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151'
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12
  },
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827'
  },
  cardSectionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
    marginBottom: 10
  },
  stepperSection: {
    gap: 10
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  stepperLabel: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '500'
  },
  stepperButtons: {
    flexDirection: 'row',
    gap: 6
  },
  stepBtn: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  stepBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151'
  },
  deltaCard: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12
  },
  deltaCardNormal: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0'
  },
  deltaCardDrift: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A'
  },
  deltaCardCrisis: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA'
  },
  deltaHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10
  },
  deltaTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827'
  },
  deltaMetrics: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginTop: 2
  },
  deltaAction: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 4,
    lineHeight: 16
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#065F46',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600'
  },
  devNote: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  devNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4
  },
  devNoteTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151'
  },
  devNoteBody: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 16
  }
});
