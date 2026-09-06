import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../shared/navigation/AppIcon';
import {
  VitalsBaseline,
  CurrentVitalsMeasurement
} from './types';
import {
  analyzeVitalsDelta,
  loadBaselineProfile,
  commitVitalsDeviation
} from './services/vitalsBaselineService';
import { HouseholdMember, HouseholdSummary } from '../../types';
import { HouseholdPersonSelector } from '../../components/HouseholdPersonSelector';
import { apiClient } from '../../api/apiClient';

export interface VitalsBaselineScreenProps {
  activeHousehold?: HouseholdSummary | null;
  activePerson?: HouseholdMember | null;
  households?: HouseholdSummary[];
  householdMembers?: HouseholdMember[];
  onSelectHousehold?: (household: HouseholdSummary) => void | Promise<void>;
  onSelectPerson?: (person: HouseholdMember) => void;
  isLoadingMembers?: boolean;
  onAddNewMember?: (member: Partial<HouseholdMember>) => Promise<void>;
  onAddNewHousehold?: (hh: Partial<HouseholdSummary>) => Promise<void>;
}

export const VitalsBaselineScreen: React.FC<VitalsBaselineScreenProps> = ({
  activeHousehold,
  activePerson,
  households = [],
  householdMembers = [],
  onSelectHousehold,
  onSelectPerson,
  isLoadingMembers = false,
  onAddNewMember,
  onAddNewHousehold
}) => {
  // Context synchronization
  const [currentHousehold, setCurrentHousehold] = useState<HouseholdSummary | null>(activeHousehold || null);
  const [currentPerson, setCurrentPerson] = useState<HouseholdMember | null>(activePerson || null);
  const [currentMembers, setCurrentMembers] = useState<HouseholdMember[]>(householdMembers || []);
  const [currentLoadingMembers, setCurrentLoadingMembers] = useState<boolean>(isLoadingMembers);

  // Baseline state from MongoDB
  const [baseline, setBaseline] = useState<VitalsBaseline>({
    patientId: activePerson?.person_id || '',
    householdId: activeHousehold?.id || '',
    personName: activePerson?.name || 'Beneficiary',
    age: activePerson?.age,
    gender: activePerson?.gender,
    recordedVisitsCount: 0,
    lastBaselineUpdateDate: '-',
    recentHistoryPoints: []
  });
  const [isLoadingBaseline, setIsLoadingBaseline] = useState<boolean>(false);

  // Measurement states (Initialized to null until entered or adjusted)
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

  // Sync props when parent updates
  useEffect(() => {
    if (activeHousehold) {
      setCurrentHousehold(activeHousehold);
    }
  }, [activeHousehold]);

  useEffect(() => {
    if (householdMembers && householdMembers.length > 0) {
      setCurrentMembers(householdMembers);
      if (!currentPerson || !householdMembers.some(m => m.person_id === currentPerson.person_id)) {
        setCurrentPerson(householdMembers[0]);
      }
    } else {
      setCurrentMembers([]);
    }
  }, [householdMembers]);

  useEffect(() => {
    if (activePerson) {
      setCurrentPerson(activePerson);
    }
  }, [activePerson]);

  useEffect(() => {
    setCurrentLoadingMembers(isLoadingMembers);
  }, [isLoadingMembers]);

  // Load baseline profile whenever active person changes
  useEffect(() => {
    if (currentPerson) {
      fetchMemberBaseline(currentPerson);
    } else {
      setBaseline({
        patientId: '',
        householdId: currentHousehold?.id || '',
        personName: 'No member selected',
        recordedVisitsCount: 0,
        lastBaselineUpdateDate: '-',
        recentHistoryPoints: []
      });
      setSystolic(null);
      setDiastolic(null);
      setGlucose(null);
      setWeight(null);
      setMuac(null);
      setPulse(null);
    }
  }, [currentPerson?.person_id]);

  const fetchMemberBaseline = async (person: HouseholdMember) => {
    setIsLoadingBaseline(true);
    // Reset measurements initially
    setSystolic(null);
    setDiastolic(null);
    setGlucose(null);
    setWeight(null);
    setMuac(null);
    setPulse(null);

    try {
      const loaded = await loadBaselineProfile(
        person.person_id,
        person.household_id || currentHousehold?.id,
        person
      );
      setBaseline(loaded);

      // Populate Today's measurements from DB if available
      const lm = loaded.latestMeasurement || (loaded.recentHistoryPoints && loaded.recentHistoryPoints.length > 0 ? loaded.recentHistoryPoints[loaded.recentHistoryPoints.length - 1] : null);
      if (lm) {
        const sys = (lm as any).systolic ?? (lm as any).systolic_bp ?? null;
        const dia = (lm as any).diastolic ?? (lm as any).diastolic_bp ?? null;
        const glu = (lm as any).glucose ?? (lm as any).glucose_mg_dl ?? (lm as any).random_blood_sugar_mg_dl ?? null;
        const wt = (lm as any).weight ?? (lm as any).weight_kg ?? null;
        const muacVal = (lm as any).muac ?? (lm as any).muac_cm ?? null;
        const p = (lm as any).pulse ?? (lm as any).pulse_bpm ?? null;

        if (sys !== null) setSystolic(Number(sys));
        if (dia !== null) setDiastolic(Number(dia));
        if (glu !== null) setGlucose(Number(glu));
        if (wt !== null) setWeight(Number(wt));
        if (muacVal !== null) setMuac(Number(muacVal));
        if (p !== null) setPulse(Number(p));
      }
    } catch (err) {
      console.warn('Failed to load baseline profile:', err);
    } finally {
      setIsLoadingBaseline(false);
    }
  };

  const handleSelectHouseholdInternal = async (hh: HouseholdSummary) => {
    setCurrentHousehold(hh);
    if (onSelectHousehold) {
      await onSelectHousehold(hh);
    } else {
      // Local fallback fetch
      setCurrentLoadingMembers(true);
      try {
        const res = await apiClient.getHouseholdMembers(hh.id);
        const membersList = res.data || [];
        setCurrentMembers(membersList);
        if (membersList.length > 0) {
          setCurrentPerson(membersList[0]);
        } else {
          setCurrentPerson(null);
        }
      } catch (e) {
        console.warn('Error fetching members:', e);
      } finally {
        setCurrentLoadingMembers(false);
      }
    }
  };

  const handleSelectPersonInternal = (person: HouseholdMember) => {
    setCurrentPerson(person);
    if (onSelectPerson) {
      onSelectPerson(person);
    }
  };

  // Derive clinical category for selected person
  const isChild = (currentPerson?.age !== undefined && currentPerson.age <= 5);
  const isPregnant = (currentPerson?.pregnancy_status === 'pregnant');
  const isElderly = (currentPerson?.age !== undefined && currentPerson.age >= 60);

  const getCategoryLabel = (): string => {
    if (isChild) return 'Child / Growth (കുട്ടി)';
    if (isPregnant) return 'Maternal / ANC (ഗർഭിണി)';
    if (isElderly) return 'Elderly / NCD (മുതിർന്നവർ)';
    return 'Adult / General (മുതിർന്നവർ)';
  };

  const current: CurrentVitalsMeasurement = {
    systolicBp: !isChild && systolic !== null ? systolic : undefined,
    diastolicBp: !isChild && diastolic !== null ? diastolic : undefined,
    glucoseMgDl: glucose !== null ? glucose : undefined,
    weightKg: weight !== null ? weight : undefined,
    muacCm: isChild && muac !== null ? muac : undefined,
    pulseBpm: pulse !== null ? pulse : undefined,
    measuredAt: new Date().toISOString()
  };

  const delta = analyzeVitalsDelta(baseline, current);

  const handleSaveToCareLedger = async () => {
    if (!currentPerson) {
      setFeedbackMessage('അംഗത്തെ തിരഞ്ഞെടുക്കുക (Please select a household member)');
      return;
    }
    setIsSaving(true);
    try {
      const result = await commitVitalsDeviation(
        {
          ...baseline,
          patientId: currentPerson.person_id,
          householdId: currentHousehold?.id || baseline.householdId,
          personName: currentPerson.name
        },
        current
      );
      setFeedbackMessage(result.message);
      // Reload baseline to reflect the newly saved measurement
      await fetchMemberBaseline(currentPerson);
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      setFeedbackMessage(`Error saving: ${err?.message || 'Failed'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header Block */}
        <View style={styles.headerBlock}>
          <Text style={styles.title}>വൈറ്റൽസ് & ഡെൽറ്റാ വ്യതിയാനം (Vitals & Delta Engine)</Text>
          <Text style={styles.subtitle}>
            മുൻകാല ശരാശരിയും ഇന്നത്തെ പരിശോധനാ അളവുകളും തമ്മിലുള്ള വ്യതിയാനം നിരീക്ഷിക്കുക
          </Text>
        </View>

        {/* Household & Citizen Selector Anchor */}
        <HouseholdPersonSelector
          households={households}
          selectedHousehold={currentHousehold}
          onSelectHousehold={handleSelectHouseholdInternal}
          members={currentMembers}
          selectedPerson={currentPerson}
          onSelectPerson={handleSelectPersonInternal}
          isLoadingMembers={currentLoadingMembers}
          onAddNewMember={onAddNewMember}
          onAddNewHousehold={onAddNewHousehold}
        />

        {/* Household Members Quick Selection Chips */}
        {currentHousehold && currentMembers.length > 0 && (
          <View style={styles.membersChipSection}>
            <Text style={styles.membersChipHeader}>
              കുടുംബാംഗങ്ങൾ ({currentMembers.length} പേർ):
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.membersChipList}
            >
              {currentMembers.map((m) => {
                const isSelected = currentPerson?.person_id === m.person_id;
                return (
                  <TouchableOpacity
                    key={m.person_id}
                    style={[styles.memberChip, isSelected && styles.memberChipActive]}
                    onPress={() => handleSelectPersonInternal(m)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.memberChipText, isSelected && styles.memberChipTextActive]}>
                      {m.name} {m.age ? `(${m.age}y)` : ''}
                    </Text>
                    {isSelected && (
                      <View style={styles.chipCheckDot} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Zero state if no household members */}
        {(!currentMembers || currentMembers.length === 0) && (
          <View style={styles.emptyCard}>
            <AppIcon name="alert" size={28} color="#D97706" />
            <Text style={styles.emptyTitle}>അംഗങ്ങൾ ലഭ്യമല്ല (No Members in Household)</Text>
            <Text style={styles.emptySubtitle}>
              ഈ വീട്ടിൽ അംഗങ്ങളെ ചേർക്കുക അല്ലെങ്കിൽ മുകളിലെ സെലക്ടറിൽ നിന്ന് മറ്റൊരു വീട് തിരഞ്ഞെടുക്കുക.
            </Text>
          </View>
        )}

        {/* Beneficiary Profile Card */}
        {currentPerson && (
          <>
            <View style={styles.patientCard}>
              <View style={{ flex: 1 }}>
                <View style={styles.patientTitleRow}>
                  <Text style={styles.patientName}>
                    {currentPerson.name} {currentPerson.age ? `(Age ${currentPerson.age})` : ''}
                  </Text>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{getCategoryLabel()}</Text>
                  </View>
                </View>
                <Text style={styles.patientDesc}>
                  ലിംഗഭേദം: {currentPerson.gender || 'Unknown'} • ബന്ധം: {currentPerson.relationship || 'Member'} • ID: {currentPerson.person_id}
                </Text>
                <Text style={styles.patientMeta}>
                  {isLoadingBaseline ? (
                    'വിവരങ്ങൾ ശേഖരിക്കുന്നു (Loading baseline from MongoDB)...'
                  ) : baseline.recordedVisitsCount > 0 ? (
                    `മുൻകാല സന്ദർശനങ്ങൾ: ${baseline.recordedVisitsCount} രേഖകൾ • അവസാന അപ്‌ഡേറ്റ്: ${baseline.lastBaselineUpdateDate}`
                  ) : (
                    'മുൻകാല സന്ദർശന രേഖകൾ ലഭ്യമല്ല (First visit will establish baseline)'
                  )}
                </Text>
              </View>
            </View>

            {/* Comparison Grid: Historical Baseline vs Today's Reading */}
            <View style={styles.comparisonGrid}>
              {/* Historical Baseline Card */}
              <View style={styles.halfCard}>
                <Text style={styles.columnLabel}>മുൻകാല ശരാശരി</Text>
                <Text style={styles.columnSubLabel}>Average of previous readings</Text>
                {!isChild && (
                  <View style={styles.statRow}>
                    <Text style={styles.statItemLabel}>Resting BP</Text>
                    <Text style={styles.statItemVal}>
                      {baseline.baselineSystolicBp && baseline.baselineDiastolicBp
                        ? `${baseline.baselineSystolicBp}/${baseline.baselineDiastolicBp} mmHg`
                        : '-'}
                    </Text>
                  </View>
                )}
                {!isChild && (
                  <View style={styles.statRow}>
                    <Text style={styles.statItemLabel}>Blood Glucose</Text>
                    <Text style={styles.statItemVal}>
                      {baseline.baselineGlucoseMgDl ? `${baseline.baselineGlucoseMgDl} mg/dL` : '-'}
                    </Text>
                  </View>
                )}
                <View style={styles.statRow}>
                  <Text style={styles.statItemLabel}>Weight</Text>
                  <Text style={styles.statItemVal}>
                    {baseline.baselineWeightKg ? `${baseline.baselineWeightKg} kg` : '-'}
                  </Text>
                </View>
                {isChild && (
                  <View style={styles.statRow}>
                    <Text style={styles.statItemLabel}>Baseline MUAC</Text>
                    <Text style={styles.statItemVal}>
                      {baseline.baselineMuacCm ? `${baseline.baselineMuacCm} cm` : '-'}
                    </Text>
                  </View>
                )}
                <View style={styles.statRow}>
                  <Text style={styles.statItemLabel}>Pulse Rate</Text>
                  <Text style={styles.statItemVal}>
                    {baseline.baselinePulseBpm ? `${baseline.baselinePulseBpm} bpm` : '-'}
                  </Text>
                </View>
              </View>

              {/* Today's Reading Card */}
              <View style={[styles.halfCard, styles.halfCardActive]}>
                <Text style={[styles.columnLabel, { color: '#065F46' }]}>ഇന്നത്തെ അളവ്</Text>
                <Text style={[styles.columnSubLabel, { color: '#047857' }]}>Today's measurements</Text>
                {!isChild && (
                  <View style={styles.statRow}>
                    <Text style={styles.statItemLabel}>Measured BP</Text>
                    <Text style={[styles.statItemVal, { color: '#111827' }]}>
                      {systolic !== null && diastolic !== null ? `${systolic}/${diastolic} mmHg` : '-'}
                    </Text>
                  </View>
                )}
                {!isChild && (
                  <View style={styles.statRow}>
                    <Text style={styles.statItemLabel}>Blood Glucose</Text>
                    <Text style={[styles.statItemVal, { color: '#111827' }]}>
                      {glucose !== null ? `${glucose} mg/dL` : '-'}
                    </Text>
                  </View>
                )}
                <View style={styles.statRow}>
                  <Text style={styles.statItemLabel}>Measured Weight</Text>
                  <Text style={[styles.statItemVal, { color: '#111827' }]}>
                    {weight !== null ? `${weight} kg` : '-'}
                  </Text>
                </View>
                {isChild && (
                  <View style={styles.statRow}>
                    <Text style={styles.statItemLabel}>Measured MUAC</Text>
                    <Text style={[styles.statItemVal, { color: '#111827' }]}>
                      {muac !== null ? `${muac} cm` : '-'}
                    </Text>
                  </View>
                )}
                <View style={styles.statRow}>
                  <Text style={styles.statItemLabel}>Measured Pulse</Text>
                  <Text style={[styles.statItemVal, { color: '#111827' }]}>
                    {pulse !== null ? `${pulse} bpm` : '-'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Delta Output Severity Banner */}
            {(systolic !== null || diastolic !== null || glucose !== null || weight !== null || muac !== null) && (
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
                      {!isChild && systolic !== null && (
                        <>
                          Systolic $\Delta$: {delta.systolicDelta > 0 ? `+${delta.systolicDelta}` : delta.systolicDelta} mmHg • Diastolic $\Delta$: {delta.diastolicDelta > 0 ? `+${delta.diastolicDelta}` : delta.diastolicDelta} mmHg
                        </>
                      )}
                      {delta.glucoseDelta !== undefined && ` • Glucose $\Delta$: ${delta.glucoseDelta > 0 ? `+${delta.glucoseDelta}` : delta.glucoseDelta} mg/dL`}
                      {delta.weightDeltaKg !== undefined && ` • Weight $\Delta$: ${delta.weightDeltaKg > 0 ? `+${delta.weightDeltaKg}` : delta.weightDeltaKg} kg`}
                    </Text>
                    <Text style={styles.deltaAction}>{delta.clinicalAction}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Interactive Vitals Input / Adjustment Controls */}
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>വൈറ്റൽസ് രേഖപ്പെടുത്തുക (Enter & Adjust Vitals)</Text>
              <Text style={styles.cardSectionSubtitle}>
                ഇന്നത്തെ പരിശോധനാ അളവുകൾ രേഖപ്പെടുത്താൻ ബട്ടണുകൾ ഉപയോഗിക്കുക
              </Text>

              <View style={styles.stepperSection}>
                {!isChild ? (
                  <>
                    {/* Systolic Stepper */}
                    <View style={styles.stepperRow}>
                      <Text style={styles.stepperLabel}>
                        Systolic BP: {systolic !== null ? `${systolic} mmHg` : 'Not set'}
                      </Text>
                      <View style={styles.stepperButtons}>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => setSystolic((prev) => Math.max(70, (prev ?? 120) - 10))}
                        >
                          <Text style={styles.stepBtnText}>-10</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => setSystolic((prev) => Math.min(240, (prev ?? 120) + 10))}
                        >
                          <Text style={styles.stepBtnText}>+10</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Diastolic Stepper */}
                    <View style={styles.stepperRow}>
                      <Text style={styles.stepperLabel}>
                        Diastolic BP: {diastolic !== null ? `${diastolic} mmHg` : 'Not set'}
                      </Text>
                      <View style={styles.stepperButtons}>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => setDiastolic((prev) => Math.max(40, (prev ?? 80) - 5))}
                        >
                          <Text style={styles.stepBtnText}>-5</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => setDiastolic((prev) => Math.min(150, (prev ?? 80) + 5))}
                        >
                          <Text style={styles.stepBtnText}>+5</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Blood Sugar Stepper */}
                    <View style={styles.stepperRow}>
                      <Text style={styles.stepperLabel}>
                        Blood Glucose: {glucose !== null ? `${glucose} mg/dL` : 'Not set'}
                      </Text>
                      <View style={styles.stepperButtons}>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => setGlucose((prev) => Math.max(60, (prev ?? 110) - 15))}
                        >
                          <Text style={styles.stepBtnText}>-15</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => setGlucose((prev) => Math.min(400, (prev ?? 110) + 15))}
                        >
                          <Text style={styles.stepBtnText}>+15</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    {/* Pediatric MUAC Stepper */}
                    <View style={styles.stepperRow}>
                      <Text style={styles.stepperLabel}>
                        Child MUAC: {muac !== null ? `${muac.toFixed(1)} cm` : 'Not set'}
                      </Text>
                      <View style={styles.stepperButtons}>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => setMuac((prev) => Math.max(8.0, Math.round(((prev ?? 13.0) - 0.2) * 10) / 10))}
                        >
                          <Text style={styles.stepBtnText}>-0.2 cm</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => setMuac((prev) => Math.min(20.0, Math.round(((prev ?? 13.0) + 0.2) * 10) / 10))}
                        >
                          <Text style={styles.stepBtnText}>+0.2 cm</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                )}

                {/* Weight Stepper */}
                <View style={styles.stepperRow}>
                  <Text style={styles.stepperLabel}>
                    Weight: {weight !== null ? `${weight.toFixed(1)} kg` : 'Not set'}
                  </Text>
                  <View style={styles.stepperButtons}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setWeight((prev) => Math.max(3.0, Math.round(((prev ?? (isChild ? 10.0 : 55.0)) - (isChild ? 0.2 : 0.5)) * 10) / 10))}
                    >
                      <Text style={styles.stepBtnText}>{isChild ? '-0.2 kg' : '-0.5 kg'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setWeight((prev) => Math.min(150.0, Math.round(((prev ?? (isChild ? 10.0 : 55.0)) + (isChild ? 0.2 : 0.5)) * 10) / 10))}
                    >
                      <Text style={styles.stepBtnText}>{isChild ? '+0.2 kg' : '+0.5 kg'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Pulse Stepper */}
                <View style={styles.stepperRow}>
                  <Text style={styles.stepperLabel}>
                    Pulse Rate: {pulse !== null ? `${pulse} bpm` : 'Not set'}
                  </Text>
                  <View style={styles.stepperButtons}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setPulse((prev) => Math.max(40, (prev ?? 76) - 4))}
                    >
                      <Text style={styles.stepBtnText}>-4</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setPulse((prev) => Math.min(180, (prev ?? 76) + 4))}
                    >
                      <Text style={styles.stepBtnText}>+4</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {/* Longitudinal History Table Accordion */}
            <View style={styles.card}>
              <View style={styles.historyHeaderRow}>
                <Text style={styles.cardSectionTitle}>മുൻകാല ചരിത്രം (Longitudinal History)</Text>
                <TouchableOpacity onPress={() => setShowHistoryTable(!showHistoryTable)}>
                  <Text style={styles.historyToggleText}>{showHistoryTable ? 'Collapse ▲' : 'Expand ▼'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.cardSectionSubtitle}>
                MongoDB Atlas-ൽ രേഖപ്പെടുത്തിയിട്ടുള്ള മുൻ സന്ദർശനങ്ങൾ
              </Text>

              {showHistoryTable && (
                <View style={styles.tableContainer}>
                  {(!baseline.recentHistoryPoints || baseline.recentHistoryPoints.length === 0) ? (
                    <View style={styles.noHistoryBox}>
                      <Text style={styles.noHistoryText}>
                        മുൻ സന്ദർശന രേഖകൾ ലഭ്യമല്ല (No prior encounter points for this member).
                      </Text>
                    </View>
                  ) : (
                    <>
                      <View style={styles.tableHeaderRow}>
                        <Text style={[styles.tableHeadCell, { flex: 1.2 }]}>Date</Text>
                        {!isChild ? (
                          <>
                            <Text style={[styles.tableHeadCell, { flex: 1.4 }]}>BP</Text>
                            <Text style={[styles.tableHeadCell, { flex: 1.4 }]}>Glucose</Text>
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

                      {baseline.recentHistoryPoints.map((pt, idx) => (
                        <View key={idx} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}>
                          <Text style={[styles.tableCell, { flex: 1.2 }]}>{pt.date}</Text>
                          {!isChild ? (
                            <>
                              <Text style={[styles.tableCell, { flex: 1.4, fontWeight: '600' }]}>
                                {pt.systolic && pt.diastolic ? `${pt.systolic}/${pt.diastolic}` : '-'}
                              </Text>
                              <Text style={[styles.tableCell, { flex: 1.4 }]}>
                                {pt.glucose ? `${pt.glucose} mg` : '-'}
                              </Text>
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
                    </>
                  )}
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
              activeOpacity={0.8}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <AppIcon name="check" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>
                    വൈറ്റൽസ് സേവ് ചെയ്യുക (Save Vitals & Sync)
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
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
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2
  },
  membersChipSection: {
    marginBottom: 12
  },
  membersChipHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
    marginBottom: 6
  },
  membersChipList: {
    flexDirection: 'row',
    gap: 8
  },
  memberChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  memberChipActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#059669'
  },
  memberChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563'
  },
  memberChipTextActive: {
    color: '#065F46',
    fontWeight: '700'
  },
  chipCheckDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669'
  },
  emptyCard: {
    backgroundColor: '#FFFBEB',
    padding: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
    alignItems: 'center',
    marginBottom: 16
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginTop: 6
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#B45309',
    textAlign: 'center',
    marginTop: 4
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
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2
  },
  columnSubLabel: {
    fontSize: 10,
    color: '#6B7280',
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
  noHistoryBox: {
    padding: 14,
    alignItems: 'center'
  },
  noHistoryText: {
    fontSize: 11,
    color: '#9CA3AF'
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
  }
});
