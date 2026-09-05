import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { AppIcon } from '../shared/navigation/AppIcon';
import {
  VitalsBaseline,
  CurrentVitalsMeasurement,
  BeneficiaryPersona
} from './types';
import {
  BENEFICIARY_PERSONAS,
  analyzeVitalsDelta,
  loadBaselineProfile,
  commitVitalsDeviation
} from './services/vitalsBaselineService';

export const VitalsBaselineScreen: React.FC = () => {
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(BENEFICIARY_PERSONAS[0].id);
  const [activePersona, setActivePersona] = useState<BeneficiaryPersona>(BENEFICIARY_PERSONAS[0]);
  const [baseline, setBaseline] = useState<VitalsBaseline>(BENEFICIARY_PERSONAS[0].defaultBaseline);
  const [isLoadingBaseline, setIsLoadingBaseline] = useState<boolean>(false);

  // Measurement states (Initialized to null - Hyphen display until real values received)
  const [systolic, setSystolic] = useState<number | null>(null);
  const [diastolic, setDiastolic] = useState<number | null>(null);
  const [glucose, setGlucose] = useState<number | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [muac, setMuac] = useState<number | null>(null);
  const [pulse, setPulse] = useState<number | null>(null);

  // Status & Feedback states
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [showHistoryTable, setShowHistoryTable] = useState<boolean>(true);

  // Handle persona change
  const handleSelectPersona = async (personaId: string) => {
    setSelectedPersonaId(personaId);
    const persona = BENEFICIARY_PERSONAS.find((p) => p.id === personaId) || BENEFICIARY_PERSONAS[0];
    setActivePersona(persona);

    // Keep measurements as null until real values are extracted
    setSystolic(null);
    setDiastolic(null);
    setGlucose(null);
    setWeight(null);
    setMuac(null);
    setPulse(null);

    // Load baseline from MongoDB Atlas with fallback
    setIsLoadingBaseline(true);
    try {
      const loaded = await loadBaselineProfile(personaId);
      setBaseline(loaded);
    } catch (err) {
      setBaseline(persona.defaultBaseline);
    } finally {
      setIsLoadingBaseline(false);
    }
  };

  // Initial load
  useEffect(() => {
    handleSelectPersona(BENEFICIARY_PERSONAS[0].id);
  }, []);

  const current: CurrentVitalsMeasurement = {
    systolicBp: activePersona.category !== 'Child / Growth' && systolic !== null ? systolic : undefined,
    diastolicBp: activePersona.category !== 'Child / Growth' && diastolic !== null ? diastolic : undefined,
    glucoseMgDl: activePersona.category === 'Elderly / NCD' && glucose !== null ? glucose : undefined,
    weightKg: weight !== null ? weight : undefined,
    muacCm: activePersona.category === 'Child / Growth' && muac !== null ? muac : undefined,
    pulseBpm: pulse !== null ? pulse : undefined,
    measuredAt: new Date().toISOString()
  };

  const delta = analyzeVitalsDelta(baseline, current);

  const handleSaveToCareLedger = async () => {
    setIsSaving(true);
    try {
      const result = await commitVitalsDeviation(baseline, current);
      setFeedbackMessage(result.message);
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      setFeedbackMessage(`Error saving: ${err?.message || 'Failed'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header Block */}
        <View style={styles.headerBlock}>
          <Text style={styles.title}>Longitudinal Vitals Baseline & Delta Engine</Text>
          <Text style={styles.subtitle}>
            Tracks personal moving averages (EWMA) and detects acute spurts & growth faltering
          </Text>
        </View>

        {/* Persona Switcher Tabs */}
        <View style={styles.personaSelector}>
          {BENEFICIARY_PERSONAS.map((p) => {
            const isSelected = p.id === selectedPersonaId;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.personaTab, isSelected && styles.personaTabActive]}
                onPress={() => handleSelectPersona(p.id)}
              >
                <Text style={[styles.personaTabText, isSelected && styles.personaTabTextActive]}>
                  {p.name.split(' ')[0]} ({p.category.split('/')[0].trim()})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Beneficiary Profile Card */}
        <View style={styles.patientCard}>
          <View style={{ flex: 1 }}>
            <View style={styles.patientTitleRow}>
              <Text style={styles.patientName}>{activePersona.name} (Age {activePersona.age})</Text>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{activePersona.category}</Text>
              </View>
            </View>
            <Text style={styles.patientDesc}>{activePersona.description}</Text>
            <Text style={styles.patientMeta}>
              Baseline: {baseline.recordedVisitsCount} historical encounters in MongoDB Atlas • Updated {baseline.lastBaselineUpdateDate}
            </Text>
          </View>
        </View>

        {/* Comparison: Historical Baseline vs Current Reading */}
        <View style={styles.comparisonGrid}>
          {/* Historical Baseline Card */}
          <View style={styles.halfCard}>
            <Text style={styles.columnLabel}>6-Month Baseline (EWMA)</Text>
            {activePersona.category !== 'Child / Growth' && (
              <View style={styles.statRow}>
                <Text style={styles.statItemLabel}>Resting BP</Text>
                <Text style={styles.statItemVal}>
                  {baseline.baselineSystolicBp && baseline.baselineDiastolicBp ? `${baseline.baselineSystolicBp}/${baseline.baselineDiastolicBp}` : '-'} mmHg
                </Text>
              </View>
            )}
            {activePersona.category === 'Elderly / NCD' && (
              <View style={styles.statRow}>
                <Text style={styles.statItemLabel}>Blood Glucose</Text>
                <Text style={styles.statItemVal}>{baseline.baselineGlucoseMgDl ? `${baseline.baselineGlucoseMgDl}` : '-'} mg/dL</Text>
              </View>
            )}
            <View style={styles.statRow}>
              <Text style={styles.statItemLabel}>Weight</Text>
              <Text style={styles.statItemVal}>{baseline.baselineWeightKg ? `${baseline.baselineWeightKg}` : '-'} kg</Text>
            </View>
            {activePersona.category === 'Child / Growth' && (
              <View style={styles.statRow}>
                <Text style={styles.statItemLabel}>Baseline MUAC</Text>
                <Text style={styles.statItemVal}>{baseline.baselineMuacCm ? `${baseline.baselineMuacCm}` : '-'} cm</Text>
              </View>
            )}
            <View style={styles.statRow}>
              <Text style={styles.statItemLabel}>Pulse Rate</Text>
              <Text style={styles.statItemVal}>{baseline.baselinePulseBpm ? `${baseline.baselinePulseBpm}` : '-'} bpm</Text>
            </View>
          </View>

          {/* Today's Reading Card */}
          <View style={[styles.halfCard, styles.halfCardActive]}>
            <Text style={[styles.columnLabel, { color: '#065F46' }]}>Today's Reading</Text>
            {activePersona.category !== 'Child / Growth' && (
              <View style={styles.statRow}>
                <Text style={styles.statItemLabel}>Measured BP</Text>
                <Text style={[styles.statItemVal, { color: '#111827' }]}>
                  {systolic !== null && diastolic !== null ? `${systolic}/${diastolic}` : '-'} mmHg
                </Text>
              </View>
            )}
            {activePersona.category === 'Elderly / NCD' && (
              <View style={styles.statRow}>
                <Text style={styles.statItemLabel}>Blood Glucose</Text>
                <Text style={[styles.statItemVal, { color: '#111827' }]}>{glucose !== null ? `${glucose}` : '-'} mg/dL</Text>
              </View>
            )}
            <View style={styles.statRow}>
              <Text style={styles.statItemLabel}>Measured Weight</Text>
              <Text style={[styles.statItemVal, { color: '#111827' }]}>{weight !== null ? `${weight}` : '-'} kg</Text>
            </View>
            {activePersona.category === 'Child / Growth' && (
              <View style={styles.statRow}>
                <Text style={styles.statItemLabel}>Measured MUAC</Text>
                <Text style={[styles.statItemVal, { color: '#111827' }]}>{muac !== null ? `${muac}` : '-'} cm</Text>
              </View>
            )}
            <View style={styles.statRow}>
              <Text style={styles.statItemLabel}>Measured Pulse</Text>
              <Text style={[styles.statItemVal, { color: '#111827' }]}>{pulse !== null ? `${pulse}` : '-'} bpm</Text>
            </View>
          </View>
        </View>

        {/* Delta Output Severity Banner */}
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
              size={22}
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
                {activePersona.category !== 'Child / Growth' && (
                  <>
                    Systolic $\Delta$: {delta.systolicDelta > 0 ? `+${delta.systolicDelta}` : delta.systolicDelta} mmHg • Diastolic $\Delta$: {delta.diastolicDelta > 0 ? `+${delta.diastolicDelta}` : delta.diastolicDelta} mmHg
                  </>
                )}
                {delta.glucoseDelta !== undefined && ` • Glucose $\Delta$: +${delta.glucoseDelta} mg/dL`}
                {delta.weightDeltaKg !== undefined && ` • Weight $\Delta$: ${delta.weightDeltaKg > 0 ? `+${delta.weightDeltaKg}` : delta.weightDeltaKg} kg`}
              </Text>
              <Text style={styles.deltaAction}>{delta.clinicalAction}</Text>
            </View>
          </View>
        </View>

        {/* Interactive Delta Controls */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Interactive Vitals Adjustment Controls</Text>
          <Text style={styles.cardSectionSubtitle}>
            Simulate acute spikes, growth faltering, or stabilization to test real-time delta detector rules
          </Text>

          {activePersona.category !== 'Child / Growth' ? (
            <View style={styles.stepperSection}>
              {/* Systolic Stepper */}
              <View style={styles.stepperRow}>
                <Text style={styles.stepperLabel}>Systolic BP: {systolic !== null ? systolic : '-'} mmHg</Text>
                <View style={styles.stepperButtons}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setSystolic((prev) => Math.max(80, (prev ?? 120) - 10))}
                  >
                    <Text style={styles.stepBtnText}>-10</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setSystolic((prev) => Math.min(220, (prev ?? 120) + 10))}
                  >
                    <Text style={styles.stepBtnText}>+10</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Diastolic Stepper */}
              <View style={styles.stepperRow}>
                <Text style={styles.stepperLabel}>Diastolic BP: {diastolic !== null ? diastolic : '-'} mmHg</Text>
                <View style={styles.stepperButtons}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setDiastolic((prev) => Math.max(50, (prev ?? 80) - 5))}
                  >
                    <Text style={styles.stepBtnText}>-5</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setDiastolic((prev) => Math.min(130, (prev ?? 80) + 5))}
                  >
                    <Text style={styles.stepBtnText}>+5</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Blood Sugar Stepper if NCD */}
              {activePersona.category === 'Elderly / NCD' && (
                <View style={styles.stepperRow}>
                  <Text style={styles.stepperLabel}>Blood Sugar: {glucose !== null ? glucose : '-'} mg/dL</Text>
                  <View style={styles.stepperButtons}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setGlucose((prev) => Math.max(70, (prev ?? 110) - 15))}
                    >
                      <Text style={styles.stepBtnText}>-15</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setGlucose((prev) => Math.min(350, (prev ?? 110) + 15))}
                    >
                      <Text style={styles.stepBtnText}>+15</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.stepperSection}>
              {/* Pediatric Weight Stepper */}
              <View style={styles.stepperRow}>
                <Text style={styles.stepperLabel}>Child Weight: {weight !== null ? weight.toFixed(1) : '-'} kg</Text>
                <View style={styles.stepperButtons}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setWeight((prev) => Math.max(5.0, Math.round(((prev ?? 10.0) - 0.2) * 10) / 10))}
                  >
                    <Text style={styles.stepBtnText}>-0.2 kg</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setWeight((prev) => Math.min(18.0, Math.round(((prev ?? 10.0) + 0.2) * 10) / 10))}
                  >
                    <Text style={styles.stepBtnText}>+0.2 kg</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Pediatric MUAC Stepper */}
              <View style={styles.stepperRow}>
                <Text style={styles.stepperLabel}>Child MUAC: {muac !== null ? muac.toFixed(1) : '-'} cm</Text>
                <View style={styles.stepperButtons}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setMuac((prev) => Math.max(9.0, Math.round(((prev ?? 13.0) - 0.2) * 10) / 10))}
                  >
                    <Text style={styles.stepBtnText}>-0.2 cm</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setMuac((prev) => Math.min(18.0, Math.round(((prev ?? 13.0) + 0.2) * 10) / 10))}
                  >
                    <Text style={styles.stepBtnText}>+0.2 cm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Longitudinal History Table Accordion */}
        <View style={styles.card}>
          <View style={styles.historyHeaderRow}>
            <Text style={styles.cardSectionTitle}>6-Month Longitudinal History</Text>
            <TouchableOpacity onPress={() => setShowHistoryTable(!showHistoryTable)}>
              <Text style={styles.historyToggleText}>{showHistoryTable ? 'Collapse ▲' : 'Expand ▼'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.cardSectionSubtitle}>
            Past visits from MongoDB Atlas feeding the rolling Exponential Weighted Moving Average
          </Text>

          {showHistoryTable && (
            <View style={styles.tableContainer}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeadCell, { flex: 1.2 }]}>Date</Text>
                {activePersona.category !== 'Child / Growth' ? (
                  <>
                    <Text style={[styles.tableHeadCell, { flex: 1.4 }]}>BP</Text>
                    {activePersona.category === 'Elderly / NCD' && (
                      <Text style={[styles.tableHeadCell, { flex: 1.4 }]}>Glucose</Text>
                    )}
                    <Text style={[styles.tableHeadCell, { flex: 1.2 }]}>Weight</Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.tableHeadCell, { flex: 1.4 }]}>Weight</Text>
                    <Text style={[styles.tableHeadCell, { flex: 1.4 }]}>MUAC</Text>
                    <Text style={[styles.tableHeadCell, { flex: 1.2 }]}>Pulse</Text>
                  </>
                )}
              </View>

              {(baseline.recentHistoryPoints || []).map((pt, idx) => (
                <View key={idx} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}>
                  <Text style={[styles.tableCell, { flex: 1.2 }]}>{pt.date}</Text>
                  {activePersona.category !== 'Child / Growth' ? (
                    <>
                      <Text style={[styles.tableCell, { flex: 1.4, fontWeight: '600' }]}>
                        {pt.systolic && pt.diastolic ? `${pt.systolic}/${pt.diastolic}` : '-'}
                      </Text>
                      {activePersona.category === 'Elderly / NCD' && (
                        <Text style={[styles.tableCell, { flex: 1.4 }]}>
                          {pt.glucose ? `${pt.glucose} mg` : '-'}
                        </Text>
                      )}
                      <Text style={[styles.tableCell, { flex: 1.2 }]}>
                        {pt.weight ? `${pt.weight} kg` : '-'}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.tableCell, { flex: 1.4, fontWeight: '600' }]}>
                        {pt.weight ? `${pt.weight} kg` : '-'}
                      </Text>
                      <Text style={[styles.tableCell, { flex: 1.4 }]}>
                        {pt.muac ? `${pt.muac} cm` : '-'}
                      </Text>
                      <Text style={[styles.tableCell, { flex: 1.2 }]}>
                        {pt.pulse ? `${pt.pulse}` : '-'}
                      </Text>
                    </>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Feedback Message Banner */}
        {feedbackMessage && (
          <View style={styles.feedbackBanner}>
            <Text style={styles.feedbackText}>{feedbackMessage}</Text>
          </View>
        )}

        {/* Commit & Sync Action Button */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleSaveToCareLedger}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <AppIcon name="check" size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>
                Log Deviation
              </Text>
            </>
          )}
        </TouchableOpacity>
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
    marginBottom: 12
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2
  },
  personaSelector: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    padding: 3,
    marginBottom: 12
  },
  personaTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6
  },
  personaTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2
  },
  personaTabText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500'
  },
  personaTabTextActive: {
    color: '#065F46',
    fontWeight: '700'
  },
  patientCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12
  },
  patientTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  patientName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937'
  },
  categoryBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  categoryBadgeText: {
    fontSize: 10,
    color: '#065F46',
    fontWeight: '700'
  },
  patientDesc: {
    fontSize: 12,
    color: '#4B5563',
    marginBottom: 4
  },
  patientMeta: {
    fontSize: 11,
    color: '#9CA3AF'
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
    fontSize: 10,
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
    fontSize: 10,
    color: '#6B7280'
  },
  statItemVal: {
    fontSize: 13,
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
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC'
  },
  deltaCardDrift: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D'
  },
  deltaCardCrisis: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5'
  },
  deltaHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10
  },
  deltaTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2
  },
  deltaMetrics: {
    fontSize: 11,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 4
  },
  deltaAction: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 16
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
    fontSize: 13,
    fontWeight: '700',
    color: '#111827'
  },
  cardSectionSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    marginBottom: 10
  },
  stepperSection: {
    gap: 8
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4
  },
  stepperLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151'
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
    color: '#1F2937'
  },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  historyToggleText: {
    fontSize: 11,
    color: '#065F46',
    fontWeight: '600'
  },
  tableContainer: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    overflow: 'hidden'
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  tableHeadCell: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563'
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF'
  },
  tableRowAlt: {
    backgroundColor: '#F9FAFB'
  },
  tableCell: {
    fontSize: 11,
    color: '#374151'
  },
  feedbackBanner: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12
  },
  feedbackText: {
    fontSize: 12,
    color: '#065F46',
    fontWeight: '600',
    textAlign: 'center'
  },
  primaryButton: {
    backgroundColor: '#065F46',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 14
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center'
  },
  devNote: {
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0'
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
    color: '#065F46'
  },
  devNoteBody: {
    fontSize: 11,
    color: '#047857',
    lineHeight: 16
  }
});
