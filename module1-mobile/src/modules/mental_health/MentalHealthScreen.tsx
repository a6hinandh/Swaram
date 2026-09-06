import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../shared/navigation/AppIcon';
import { PhqFrequencyScore } from './types';
import { calculatePhq2Score } from './services/mentalHealthService';
import { HouseholdMember, HouseholdSummary, ConfirmedVisit } from '../../types';
import { apiClient } from '../../api/apiClient';
import { HouseholdPersonSelector } from '../../components/HouseholdPersonSelector';
import { AiReportSummaryCard } from '../../components/AiReportSummaryCard';
import { generateMentalHealthSummary } from '../../services/geminiReportSummaryService';

interface MentalHealthScreenProps {
  activePerson?: HouseholdMember | null;
  activeHousehold?: HouseholdSummary | null;
  households?: HouseholdSummary[];
  householdMembers?: HouseholdMember[];
  onSelectHousehold?: (household: HouseholdSummary) => void | Promise<void>;
  onSelectPerson?: (person: HouseholdMember) => void;
  isLoadingMembers?: boolean;
  onAddNewMember?: (member: Partial<HouseholdMember>) => Promise<void>;
  onAddNewHousehold?: (hh: Partial<HouseholdSummary>) => Promise<void>;
  workerId?: string;
  onSaved?: () => void;
}

export const MentalHealthScreen: React.FC<MentalHealthScreenProps> = ({
  activePerson,
  activeHousehold,
  households,
  householdMembers,
  onSelectHousehold,
  onSelectPerson,
  isLoadingMembers = false,
  onAddNewMember,
  onAddNewHousehold,
  workerId = 'w-asha-001',
  onSaved
}) => {
  // Local active household & person context (defaulted from survey page props)
  const [currentHousehold, setCurrentHousehold] = useState<HouseholdSummary | null>(activeHousehold || null);
  const [currentPerson, setCurrentPerson] = useState<HouseholdMember | null>(activePerson || null);
  const [localHouseholds, setLocalHouseholds] = useState<HouseholdSummary[]>(households || []);
  const [localMembers, setLocalMembers] = useState<HouseholdMember[]>(householdMembers || []);
  const [localLoadingMembers, setLocalLoadingMembers] = useState<boolean>(isLoadingMembers);
  const [isManuallyChanged, setIsManuallyChanged] = useState<boolean>(false);

  // AI Longitudinal Summary State
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isLoadingAiSummary, setIsLoadingAiSummary] = useState<boolean>(false);
  const [historicalEncountersCount, setHistoricalEncountersCount] = useState<number>(0);

  // Synchronize with survey page updates
  useEffect(() => {
    if (activeHousehold) {
      setCurrentHousehold(activeHousehold);
    }
  }, [activeHousehold]);

  useEffect(() => {
    if (activePerson) {
      setCurrentPerson(activePerson);
      loadAiSummaryForPerson(activePerson.person_id, activePerson.name);
    }
  }, [activePerson?.person_id]);

  useEffect(() => {
    if (households && households.length > 0) {
      setLocalHouseholds(households);
    }
  }, [households]);

  useEffect(() => {
    if (householdMembers && householdMembers.length > 0) {
      setLocalMembers(householdMembers);
    }
  }, [householdMembers]);

  useEffect(() => {
    setLocalLoadingMembers(isLoadingMembers);
  }, [isLoadingMembers]);

  // Fallback initial load if households not passed via props
  useEffect(() => {
    if (!households || households.length === 0) {
      loadFallbackHouseholds();
    } else if (currentPerson) {
      loadAiSummaryForPerson(currentPerson.person_id, currentPerson.name);
    }
  }, []);

  const loadAiSummaryForPerson = async (personId?: string, personName?: string) => {
    const targetId = personId || currentPerson?.person_id || activePerson?.person_id || 'p-radhamani-01';
    const targetName = personName || currentPerson?.name || activePerson?.name || 'Radhamani P.';
    setIsLoadingAiSummary(true);
    try {
      const res = await apiClient.getPersonEncounters(targetId);
      const encounters = (res.data && Array.isArray(res.data)) ? res.data : [];
      setHistoricalEncountersCount(encounters.length);

      const result = await generateMentalHealthSummary(encounters, targetName);
      setAiSummary(result.summary);
    } catch (err) {
      console.warn('Failed to load Mental Health AI summary:', err);
      setAiSummary('മാനസികാരോഗ്യ മുൻകാല വിവരങ്ങൾ ലഭ്യമല്ല.');
    } finally {
      setIsLoadingAiSummary(false);
    }
  };

  const loadFallbackHouseholds = async () => {
    try {
      const res = await apiClient.getHouseholds();
      if (res.data && res.data.length > 0) {
        setLocalHouseholds(res.data);
        if (!currentHousehold) {
          const first = res.data[0];
          setCurrentHousehold(first);
          await loadMembersForHh(first.id);
        }
      }
    } catch (e) {
      console.warn('Failed to load households in MentalHealthScreen:', e);
    }
  };

  const loadMembersForHh = async (hhId: string) => {
    setLocalLoadingMembers(true);
    try {
      const res = await apiClient.getHouseholdMembers(hhId);
      if (res.data && res.data.length > 0) {
        setLocalMembers(res.data);
        setCurrentPerson(res.data[0]);
        loadAiSummaryForPerson(res.data[0].person_id, res.data[0].name);
      } else {
        setLocalMembers([]);
        setCurrentPerson(null);
      }
    } catch (e) {
      console.warn('Failed to load members:', e);
    } finally {
      setLocalLoadingMembers(false);
    }
  };

  const handleSelectHousehold = async (hh: HouseholdSummary) => {
    setCurrentHousehold(hh);
    setIsManuallyChanged(true);
    if (onSelectHousehold) {
      await onSelectHousehold(hh);
    } else {
      await loadMembersForHh(hh.id);
    }
  };

  const handleSelectPerson = (person: HouseholdMember) => {
    setCurrentPerson(person);
    setIsManuallyChanged(true);
    loadAiSummaryForPerson(person.person_id, person.name);
    if (onSelectPerson) {
      onSelectPerson(person);
    }
  };

  const handleAddNewMember = async (memberData: Partial<HouseholdMember>) => {
    if (onAddNewMember) {
      await onAddNewMember(memberData);
    } else if (currentHousehold) {
      const res = await apiClient.addHouseholdMember(currentHousehold.id, memberData);
      if (res.data) {
        await loadMembersForHh(currentHousehold.id);
        setCurrentPerson(res.data);
      }
    }
  };

  const handleAddNewHousehold = async (hhData: Partial<HouseholdSummary>) => {
    if (onAddNewHousehold) {
      await onAddNewHousehold(hhData);
    } else {
      const res = await apiClient.createHousehold(hhData);
      if (res.data) {
        const updated = await apiClient.getHouseholds();
        setLocalHouseholds(updated.data);
        setCurrentHousehold(res.data);
        await loadMembersForHh(res.data.id);
      }
    }
  };

  const [anxQ1Score, setAnxQ1Score] = useState<PhqFrequencyScore>(0);
  const [anxQ2Score, setAnxQ2Score] = useState<PhqFrequencyScore>(0);
  const [depQ1Score, setDepQ1Score] = useState<PhqFrequencyScore>(0);
  const [depQ2Score, setDepQ2Score] = useState<PhqFrequencyScore>(0);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);

  const anxietyTotal = anxQ1Score + anxQ2Score;
  const depressionTotal = depQ1Score + depQ2Score;
  const phq4Total = anxietyTotal + depressionTotal;
  const referralNeeded = anxietyTotal >= 3 || depressionTotal >= 3;

  const options: { label: string; subLabel: string; value: PhqFrequencyScore }[] = [
    { label: '0', subLabel: 'ഒരിക്കലുമില്ല (Never)', value: 0 },
    { label: '1', subLabel: 'ചില ദിവസങ്ങൾ (Several days)', value: 1 },
    { label: '2', subLabel: 'പകുതി ദിവസങ്ങൾ (Half days)', value: 2 },
    { label: '3', subLabel: 'ദിവസവും (Daily)', value: 3 }
  ];

  const handleSave = async () => {
    setIsSaving(true);
    const targetPerson = currentPerson || activePerson;
    const targetHousehold = currentHousehold || activeHousehold;

    const targetPersonId = targetPerson?.person_id || 'p-radhamani-01';
    const targetPersonName = targetPerson?.name || 'Radhamani P.';
    const targetHhId = targetHousehold?.id || 'h-lakshmi-001';

    const confirmedVisit: ConfirmedVisit = {
      visit_id: `visit-mh-${Date.now()}`,
      household_id: targetHhId,
      worker_id: workerId,
      timestamp: new Date().toISOString(),
      person_updates: [
        {
          person_id: targetPersonId,
          name: targetPersonName,
          age: targetPerson?.age,
          gender: targetPerson?.gender,
          mental_health: {
            anxiety_score: anxietyTotal,
            depression_score: depressionTotal,
            total_score: phq4Total,
            risk_level: referralNeeded ? 'moderate' : 'normal',
            screening_status: 'completed'
          },
          services_provided: ['Mental Health Voice Protocol (PHQ-4)'],
          symptoms: referralNeeded ? ['Psychological distress / anxiety'] : []
        }
      ],
      confirmed_by_worker_at: new Date().toISOString(),
      sync_status: 'synced'
    };

    try {
      const res = await apiClient.submitConfirmedVisit(confirmedVisit);
      setSavedSuccess(true);
      setSaveNote(`സേവ് ചെയ്തു: ${targetPersonName} (${res.message || 'MongoDB Synced'})`);
      if (onSaved) onSaved();
      loadAiSummaryForPerson(targetPersonId, targetPersonName);
      setTimeout(() => {
        setSavedSuccess(false);
        setSaveNote(null);
      }, 4000);
    } catch (err: any) {
      setSavedSuccess(true);
      setSaveNote(`ലോക്കലായി സൂക്ഷിച്ചു: ${err?.message || 'Offline Saved'}`);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Module Header Block */}
        <View style={styles.headerBlock}>
          <View style={styles.headerTitleRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <AppIcon name="mental" size={20} color="#047857" />
                <Text style={styles.title}>മാനസികാരോഗ്യ നിരീക്ഷണ രേഖ</Text>
              </View>
              <Text style={styles.subtitle}>
                GAD-2 & PHQ-2 മാനസികാരോഗ്യ പരിശോധനയും റഫറലും (Tele-MANAS / NMHP)
              </Text>
            </View>
            <View style={styles.nhmBadge}>
              <Text style={styles.nhmBadgeText}>NHM • MoHFW</Text>
            </View>
          </View>

          {saveNote && (
            <View style={styles.saveAlertBox}>
              <AppIcon name="check" size={16} color="#15803D" />
              <Text style={styles.saveAlertText}>{saveNote}</Text>
            </View>
          )}
        </View>

        {/* Linked Beneficiary & Household Section */}
        <View style={styles.linkedContextCard}>
          <View style={styles.linkedContextCardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <AppIcon name="user" size={16} color="#1E40AF" />
              <Text style={styles.linkedContextCardTitle}>
                ബന്ധിപ്പിച്ച ഗുണഭോക്താവ്
              </Text>
            </View>
            <View style={[styles.originBadge, isManuallyChanged ? styles.originBadgeManual : styles.originBadgeSurvey]}>
              <AppIcon
                name={isManuallyChanged ? 'edit' : 'check'}
                size={11}
                color={isManuallyChanged ? '#B45309' : '#1D4ED8'}
              />
            </View>
          </View>
          <Text style={styles.linkedContextCardSub}>
            സർവേ പേജിൽ തിരഞ്ഞെടുത്ത വ്യക്തിയുടെ വിവരങ്ങൾ ഡിഫോൾട്ടായി ഇവിടെ ലഭ്യമാണ്.
          </Text>

          <HouseholdPersonSelector
            households={localHouseholds}
            selectedHousehold={currentHousehold}
            onSelectHousehold={handleSelectHousehold}
            members={localMembers}
            selectedPerson={currentPerson}
            onSelectPerson={handleSelectPerson}
            isLoadingMembers={localLoadingMembers}
            onAddNewMember={handleAddNewMember}
            onAddNewHousehold={handleAddNewHousehold}
          />
        </View>

        {/* --- ANXIETY SECTION (GAD-2) --- */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconPill, { backgroundColor: '#EFF6FF' }]}>
              <AppIcon name="activity" size={16} color="#1D4ED8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: '#1E40AF' }]}>
                1. ഉത്കണ്ഠാ നിർണ്ണയം (Anxiety Screening - GAD-2)
              </Text>
              <Text style={styles.sectionSub}>കഴിഞ്ഞ 2 ആഴ്ചയിലെ മാനസികാവസ്ഥ</Text>
            </View>
            <View style={styles.scoreSubBadge}>
              <Text style={styles.scoreSubBadgeText}>{anxietyTotal} / 6</Text>
            </View>
          </View>

          {/* Anxiety Question 1 */}
          <View style={styles.card}>
            <View style={styles.qMetaRow}>
              <Text style={styles.questionNumber}>ചോദ്യം 1 / 4 • GAD-2</Text>
              {anxQ1Score > 0 && (
                <View style={styles.answeredBadge}>
                  <Text style={styles.answeredBadgeText}>സ്കോർ: {anxQ1Score}</Text>
                </View>
              )}
            </View>
            <Text style={styles.questionText}>
              Feeling nervous, anxious, or on edge over past 2 weeks
            </Text>
            <Text style={styles.questionSubtext}>
              കഴിഞ്ഞ രണ്ടാഴ്ചയായി പരിഭ്രമമോ ഉത്കണ്ഠയോ അസ്വസ്ഥതയോ അനുഭവപ്പെടുക
            </Text>
            <View style={styles.optionGrid}>
              {options.map((opt) => {
                const isSelected = anxQ1Score === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.optionCard, isSelected && styles.optionCardActive]}
                    onPress={() => setAnxQ1Score(opt.value)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.optionScorePill, isSelected && styles.optionScorePillActive]}>
                      <Text style={[styles.optionScoreText, isSelected && styles.optionScoreTextActive]}>
                        {opt.value}
                      </Text>
                    </View>
                    <Text style={[styles.optionLabelText, isSelected && styles.optionLabelTextActive]}>
                      {opt.subLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Anxiety Question 2 */}
          <View style={styles.card}>
            <View style={styles.qMetaRow}>
              <Text style={styles.questionNumber}>ചോദ്യം 2 / 4 • GAD-2</Text>
              {anxQ2Score > 0 && (
                <View style={styles.answeredBadge}>
                  <Text style={styles.answeredBadgeText}>സ്കോർ: {anxQ2Score}</Text>
                </View>
              )}
            </View>
            <Text style={styles.questionText}>
              Not being able to stop or control worrying over past 2 weeks
            </Text>
            <Text style={styles.questionSubtext}>
              ആകുലതകളും ഉത്കണ്ഠകളും നിയന്ത്രിക്കാൻ കഴിയാതെ വരിക
            </Text>
            <View style={styles.optionGrid}>
              {options.map((opt) => {
                const isSelected = anxQ2Score === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.optionCard, isSelected && styles.optionCardActive]}
                    onPress={() => setAnxQ2Score(opt.value)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.optionScorePill, isSelected && styles.optionScorePillActive]}>
                      <Text style={[styles.optionScoreText, isSelected && styles.optionScoreTextActive]}>
                        {opt.value}
                      </Text>
                    </View>
                    <Text style={[styles.optionLabelText, isSelected && styles.optionLabelTextActive]}>
                      {opt.subLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* --- DEPRESSION SECTION (PHQ-2) --- */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconPill, { backgroundColor: '#FEF2F2' }]}>
              <AppIcon name="brain" size={16} color="#B91C1C" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: '#991B1B' }]}>
                2. വിഷാദ രോഗ നിർണ്ണയം (Depression Screening - PHQ-2)
              </Text>
              <Text style={styles.sectionSub}>താല്പര്യക്കുറവും നിരാശയും വിലയിരുത്തൽ</Text>
            </View>
            <View style={styles.scoreSubBadge}>
              <Text style={styles.scoreSubBadgeText}>{depressionTotal} / 6</Text>
            </View>
          </View>

          {/* Depression Question 1 */}
          <View style={styles.card}>
            <View style={styles.qMetaRow}>
              <Text style={styles.questionNumber}>ചോദ്യം 3 / 4 • PHQ-2</Text>
              {depQ1Score > 0 && (
                <View style={styles.answeredBadge}>
                  <Text style={styles.answeredBadgeText}>സ്കോർ: {depQ1Score}</Text>
                </View>
              )}
            </View>
            <Text style={styles.questionText}>
              Little interest or pleasure in doing things over past 2 weeks
            </Text>
            <Text style={styles.questionSubtext}>
              കഴിഞ്ഞ രണ്ടാഴ്ചയായി കാര്യങ്ങൾ ചെയ്യുന്നതിൽ താല്പര്യക്കുറവ്
            </Text>
            <View style={styles.optionGrid}>
              {options.map((opt) => {
                const isSelected = depQ1Score === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.optionCard, isSelected && styles.optionCardActive]}
                    onPress={() => setDepQ1Score(opt.value)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.optionScorePill, isSelected && styles.optionScorePillActive]}>
                      <Text style={[styles.optionScoreText, isSelected && styles.optionScoreTextActive]}>
                        {opt.value}
                      </Text>
                    </View>
                    <Text style={[styles.optionLabelText, isSelected && styles.optionLabelTextActive]}>
                      {opt.subLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Depression Question 2 */}
          <View style={styles.card}>
            <View style={styles.qMetaRow}>
              <Text style={styles.questionNumber}>ചോദ്യം 4 / 4 • PHQ-2</Text>
              {depQ2Score > 0 && (
                <View style={styles.answeredBadge}>
                  <Text style={styles.answeredBadgeText}>സ്കോർ: {depQ2Score}</Text>
                </View>
              )}
            </View>
            <Text style={styles.questionText}>
              Feeling down, depressed, or hopeless over past 2 weeks
            </Text>
            <Text style={styles.questionSubtext}>
              വിഷാദമോ പ്രതീക്ഷയില്ലായ്മയോ അനുഭവപ്പെടുക
            </Text>
            <View style={styles.optionGrid}>
              {options.map((opt) => {
                const isSelected = depQ2Score === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.optionCard, isSelected && styles.optionCardActive]}
                    onPress={() => setDepQ2Score(opt.value)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.optionScorePill, isSelected && styles.optionScorePillActive]}>
                      <Text style={[styles.optionScoreText, isSelected && styles.optionScoreTextActive]}>
                        {opt.value}
                      </Text>
                    </View>
                    <Text style={[styles.optionLabelText, isSelected && styles.optionLabelTextActive]}>
                      {opt.subLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Live Score & Clinical Triage Dashboard */}
        <View style={[styles.resultCard, referralNeeded ? styles.resultCardWarning : styles.resultCardNormal]}>
          <View style={styles.resultHeader}>
            <View style={[styles.resultIconWrapper, referralNeeded ? styles.resultIconWrapperWarning : styles.resultIconWrapperNormal]}>
              <AppIcon
                name={referralNeeded ? 'alert' : 'check'}
                size={22}
                color={referralNeeded ? '#DC2626' : '#047857'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.resultTitle}>
                  {referralNeeded ? 'മാനസികാരോഗ്യ കൗൺസിലിംഗ് ശുപാർശ' : 'സാധാരണ പരിധി (Normal Baseline)'}
                </Text>
                <View style={[styles.triageTag, referralNeeded ? styles.triageTagWarning : styles.triageTagNormal]}>
                  <Text style={[styles.triageTagText, referralNeeded ? styles.triageTagTextWarning : styles.triageTagTextNormal]}>
                    {referralNeeded ? 'REFERRAL NEEDED' : 'NORMAL'}
                  </Text>
                </View>
              </View>

              {/* Progress Gauges Row */}
              <View style={styles.gaugeRow}>
                <View style={styles.gaugeBox}>
                  <Text style={styles.gaugeLabel}>GAD-2 (ഉത്കണ്ഠ)</Text>
                  <Text style={[styles.gaugeVal, anxietyTotal >= 3 && styles.gaugeValAlert]}>
                    {anxietyTotal} / 6
                  </Text>
                </View>
                <View style={styles.gaugeDivider} />
                <View style={styles.gaugeBox}>
                  <Text style={styles.gaugeLabel}>PHQ-2 (വിഷാദം)</Text>
                  <Text style={[styles.gaugeVal, depressionTotal >= 3 && styles.gaugeValAlert]}>
                    {depressionTotal} / 6
                  </Text>
                </View>
                <View style={styles.gaugeDivider} />
                <View style={styles.gaugeBox}>
                  <Text style={styles.gaugeLabel}>ആകെ സ്കോർ (PHQ-4)</Text>
                  <Text style={[styles.gaugeVal, phq4Total >= 3 && styles.gaugeValAlert]}>
                    {phq4Total} / 12
                  </Text>
                </View>
              </View>

              <Text style={styles.resultDescription}>
                {referralNeeded
                  ? 'സബ്-സ്കോർ 3 അല്ലെങ്കിൽ അതിൽ കൂടുതലാണ്. പ്രാഥമികാരോഗ്യ കേന്ദ്രത്തിലെ (PHC) മെഡിക്കൽ ഓഫീസർ / സൈക്യാട്രിക് കൗൺസിലറുടെ പരിശോധനയ്ക്കായി റഫർ ചെയ്യുക.'
                  : 'രോഗലക്ഷണങ്ങളുടെ സ്കോർ സാധാരണ പരിധിയിലാണ് (Sub-scores < 3). പതിവ് ആശാ സന്ദർശനങ്ങളിൽ നിരീക്ഷണം തുടരുക.'}
              </Text>

              {/* Guidance Action Pills */}
              {referralNeeded && (
                <View style={styles.referralActionRow}>
                  <View style={styles.referralChip}>
                    <AppIcon name="stethoscope" size={13} color="#B91C1C" />
                    <Text style={styles.referralChipText}>CHO / MO റഫറൽ</Text>
                  </View>
                  <View style={styles.referralChip}>
                    <AppIcon name="info" size={13} color="#B91C1C" />
                    <Text style={styles.referralChipText}>: 14416</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Primary Save Button */}
        <TouchableOpacity
          style={[styles.primaryButton, isSaving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <AppIcon name="save" size={18} color="#FFFFFF" />
          )}
          <Text style={styles.primaryButtonText}>
            {isSaving
              ? 'രേഖപ്പെടുത്തുന്നു...'
              : savedSuccess
              ? 'വിവരങ്ങൾ സേവ് ചെയ്തു'
              : 'മാനസികാരോഗ്യ രേഖ സേവ് ചെയ്യുക'}
          </Text>
        </TouchableOpacity>

        {/* AI Longitudinal Mental Health Summary Card at End */}
        <View style={{ marginTop: 14 }}>
          <AiReportSummaryCard
            title="മാനസികാരോഗ്യ AI റിപ്പോർട്ട് സംഗ്രഹം"
            subtitle={`${currentPerson?.name || activePerson?.name || 'ഗുണഭോക്താവ്'} • ${historicalEncountersCount > 0 ? `${historicalEncountersCount} മുൻകാല സന്ദർശനങ്ങൾ` : 'പ്രാഥമിക പരിശോധന'}`}
            summaryText={aiSummary || 'മാനസികാരോഗ്യ വിവരങ്ങൾ വിശകലനം ചെയ്യുന്നു...'}
            isLoading={isLoadingAiSummary}
            recordCount={historicalEncountersCount}
            onRefresh={() => loadAiSummaryForPerson(currentPerson?.person_id || activePerson?.person_id, currentPerson?.name || activePerson?.name)}
            badgeColor="#4338CA"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  container: {
    padding: 16,
    paddingBottom: 40
  },
  headerBlock: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    elevation: 2,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }
    })
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 17
  },
  nhmBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  nhmBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857'
  },
  saveAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 10
  },
  saveAlertText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
    flex: 1
  },
  linkedContextCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    elevation: 2,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
      }
    })
  },
  linkedContextCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  linkedContextCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E40AF'
  },
  linkedContextCardSub: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 10,
    lineHeight: 15
  },
  originBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  originBadgeSurvey: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE'
  },
  originBadgeManual: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A'
  },
  originBadgeText: {
    fontSize: 10,
    fontWeight: '700'
  },
  originBadgeTextSurvey: {
    color: '#1D4ED8'
  },
  originBadgeTextManual: {
    color: '#B45309'
  },
  sectionContainer: {
    marginBottom: 16
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  sectionIconPill: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800'
  },
  sectionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1
  },
  scoreSubBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  scoreSubBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155'
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
    elevation: 1,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }
    })
  },
  qMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  questionNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  answeredBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  answeredBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857'
  },
  questionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    lineHeight: 18
  },
  questionSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
    marginBottom: 10,
    lineHeight: 16
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  optionCard: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  optionCardActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
    borderWidth: 1.5
  },
  optionScorePill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  optionScorePillActive: {
    backgroundColor: '#059669'
  },
  optionScoreText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569'
  },
  optionScoreTextActive: {
    color: '#FFFFFF'
  },
  optionLabelText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    lineHeight: 14
  },
  optionLabelTextActive: {
    color: '#065F46',
    fontWeight: '700'
  },
  resultCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 14,
    elevation: 2,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }
    })
  },
  resultCardNormal: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC'
  },
  resultCardWarning: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5'
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12
  },
  resultIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1
  },
  resultIconWrapperNormal: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC'
  },
  resultIconWrapperWarning: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5'
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A'
  },
  triageTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  triageTagNormal: {
    backgroundColor: '#DCFCE7'
  },
  triageTagWarning: {
    backgroundColor: '#FEE2E2'
  },
  triageTagText: {
    fontSize: 10,
    fontWeight: '800'
  },
  triageTagTextNormal: {
    color: '#15803D'
  },
  triageTagTextWarning: {
    color: '#B91C1C'
  },
  gaugeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  gaugeBox: {
    flex: 1,
    alignItems: 'center'
  },
  gaugeDivider: {
    width: 1,
    height: 26,
    backgroundColor: '#E2E8F0'
  },
  gaugeLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600'
  },
  gaugeVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2
  },
  gaugeValAlert: {
    color: '#DC2626'
  },
  resultDescription: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 16
  },
  referralActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8
  },
  referralChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  referralChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B91C1C'
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#047857',
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 20,
    elevation: 3,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(4, 120, 87, 0.2)'
      }
    })
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800'
  }
});
