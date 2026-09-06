import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../shared/navigation/AppIcon';
import {
  CbacOfficialRecord,
  BeneficiaryProfile,
  CbacPartAAge,
  CbacPartATobacco,
  CbacPartAAlcohol,
  CbacPartAWaist,
  CbacPartAPhysicalActivity,
  CbacPartAFamilyHistory,
  Phq2ScoreValue,
  CbacCookingFuel,
  CbacOccupationalExposure
} from './types';
import {
  createDefaultCbacRecord,
  extractCbacFromTranscript
} from './services/cbacEntityExtractor';
import {
  saveSurveyToProfile,
  getAllBeneficiaryProfiles,
  getFilteredProfiles,
  deleteBeneficiaryProfile
} from './services/cbacProfileStorage';
import { calculatePartAScore } from './services/ncdLifestyleService';
import { audioRecorder } from '../../services/audioRecorder';
import { transcribeWithIndicConformer } from '../../services/indicConformerService';
import { apiClient } from '../../api/apiClient';
import { AiReportSummaryCard } from '../../components/AiReportSummaryCard';
import { generateCbacSummary } from '../../services/geminiReportSummaryService';
import { HouseholdMember, HouseholdSummary } from '../../types';

interface NcdLifestyleScreenProps {
  activePerson?: HouseholdMember | null;
  activeHousehold?: HouseholdSummary | null;
  households?: HouseholdSummary[];
  householdMembers?: HouseholdMember[];
  onSelectHousehold?: (household: HouseholdSummary) => void | Promise<void>;
  onSelectPerson?: (person: HouseholdMember) => void;
  onBack?: () => void;
}

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

interface StepInfo {
  step: WizardStep;
  title: string;
  subtitle: string;
  shortLabel: string;
}

const WIZARD_STEPS: StepInfo[] = [
  { step: 1, title: 'ഗുണഭോക്താവിന്റെ വിവരങ്ങൾ', subtitle: 'വ്യക്തിഗത വിവരങ്ങൾ', shortLabel: 'വ്യക്തിവിവരം' },
  { step: 2, title: 'ഭാഗം A: റിസ്ക് ഘടകങ്ങൾ', subtitle: 'റിസ്ക് സ്കോർ നിർണ്ണയം (0-10)', shortLabel: 'പാർട്ട് A' },
  { step: 3, title: 'ഭാഗം B: പ്രാരംഭ ലക്ഷണങ്ങൾ', subtitle: 'പ്രാരംഭ ലക്ഷണങ്ങളുടെ പരിശോധന', shortLabel: 'ലക്ഷണങ്ങൾ' },
  { step: 4, title: 'ഭാഗം C: ശ്വാസകോശ രോഗസാധ്യത', subtitle: 'ശ്വാസകോശ രോഗ സാധ്യത പരിശോധന', shortLabel: 'ശ്വാസകോശം' },
  { step: 5, title: 'ഭാഗം D: മാനസികാരോഗ്യം', subtitle: 'പ്രാഥമിക മാനസികാരോഗ്യ പരിശോധന', shortLabel: 'മാനസികം' },
  { step: 6, title: 'സി.പി.എച്ച്.സി ഔദ്യോഗിക ഫോം', subtitle: 'അന്തിമ വിലയിരുത്തലും സ്കോറും', shortLabel: 'റിവ്യൂ' },
];

export const NcdLifestyleScreen: React.FC<NcdLifestyleScreenProps> = ({
  activePerson,
  activeHousehold,
  households,
  householdMembers,
  onSelectHousehold,
  onSelectPerson,
  onBack
}) => {
  // Wizard Step State
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // AI Longitudinal Summary State
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isLoadingAiSummary, setIsLoadingAiSummary] = useState<boolean>(false);
  const [historicalSurveysCount, setHistoricalSurveysCount] = useState<number>(0);

  // Collapsible Header on Scroll State
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState<boolean>(false);
  const lastScrollY = useRef<number>(0);
  const accumulatedScrollDelta = useRef<number>(0);
  const lastToggleTime = useRef<number>(0);
  const surveyScrollRef = useRef<ScrollView>(null);

  // Voice Interaction State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [isProcessingVoice, setIsProcessingVoice] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [voiceStatusMsg, setVoiceStatusMsg] = useState<string>('ശബ്ദം രേഖപ്പെടുത്താൻ തയ്യാറാണ്');
  const timerRef = useRef<any>(null);

  // Active Questionnaire Record State
  const [record, setRecord] = useState<CbacOfficialRecord>(() => {
    const rec = createDefaultCbacRecord(activePerson?.person_id || undefined);
    if (activePerson) {
      rec.beneficiaryId = activePerson.person_id;
      rec.personalDetails.name = activePerson.name || '';
      if (activePerson.age !== undefined) {
        rec.personalDetails.age = activePerson.age;
        if (activePerson.age < 30) rec.partA.ageScore = 0;
        else if (activePerson.age <= 39) rec.partA.ageScore = 1;
        else if (activePerson.age <= 49) rec.partA.ageScore = 2;
        else if (activePerson.age <= 59) rec.partA.ageScore = 3;
        else rec.partA.ageScore = 4;
      }
      if (activePerson.gender) {
        rec.personalDetails.sex = activePerson.gender === 'female' ? 'female' : 'male';
      }
    }
    if (activeHousehold) {
      rec.generalInfo.villageWard = activeHousehold.address || 'വാർഡ് 4 (ആലുവ)';
    }
    return rec;
  });

  // Storage & Longitudinal Profile State
  const [profiles, setProfiles] = useState<BeneficiaryProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<BeneficiaryProfile | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Filter & Search State
  const [scoreFilter, setScoreFilter] = useState<'all' | 'high_risk' | 'normal' | 'warning_signs' | 'phq2'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredProfiles, setFilteredProfiles] = useState<BeneficiaryProfile[]>([]);

  // Raw JSON Modal
  const [showJsonModal, setShowJsonModal] = useState<boolean>(false);
  const [activeJsonRecord, setActiveJsonRecord] = useState<CbacOfficialRecord | null>(null);

  // Load profiles on mount
  useEffect(() => {
    loadAllProfiles();
  }, []);

  // Sync with active person prop change
  useEffect(() => {
    if (activePerson) {
      setRecord((prev) => {
        const updated = { ...prev };
        updated.beneficiaryId = activePerson.person_id;
        if (activePerson.name) updated.personalDetails.name = activePerson.name;
        if (activePerson.age !== undefined) {
          updated.personalDetails.age = activePerson.age;
          if (activePerson.age < 30) updated.partA.ageScore = 0;
          else if (activePerson.age <= 39) updated.partA.ageScore = 1;
          else if (activePerson.age <= 49) updated.partA.ageScore = 2;
          else if (activePerson.age <= 59) updated.partA.ageScore = 3;
          else updated.partA.ageScore = 4;
        }
        if (activePerson.gender) {
          updated.personalDetails.sex = activePerson.gender === 'female' ? 'female' : 'male';
        }
        calculatePartAScore(updated);
        return updated;
      });
      loadAiSummaryForPerson(activePerson.person_id, activePerson.name);
    }
  }, [activePerson?.person_id]);

  const loadAiSummaryForPerson = async (personId?: string, personName?: string) => {
    const targetId = personId || record.beneficiaryId || 'p-radhamani-01';
    const targetName = personName || record.personalDetails.name || 'Radhamani P.';
    setIsLoadingAiSummary(true);
    try {
      // 1. Fetch from MongoDB Atlas API
      const res = await apiClient.getBeneficiaryCbacSurveys(targetId);
      const surveys = (res.data && Array.isArray(res.data)) ? res.data : [];
      
      // Also merge any local profile records if found
      const localList = await getAllBeneficiaryProfiles();
      const localMatched = localList.find((p) => p.beneficiaryId === targetId || p.name.toLowerCase() === targetName.toLowerCase());
      if (localMatched && localMatched.surveys && localMatched.surveys.length > 0) {
        localMatched.surveys.forEach((s) => {
          if (!surveys.some((existing: any) => existing.timestamp === s.timestamp || existing.surveyId === s.surveyId)) {
            surveys.push(s);
          }
        });
      }

      setHistoricalSurveysCount(surveys.length);

      // 2. Generate Gemini longitudinal summary
      const result = await generateCbacSummary(surveys, targetName);
      setAiSummary(result.summary);
    } catch (err) {
      console.warn('Failed to load CBAC AI summary:', err);
      setAiSummary('CBAC മുൻകാല പരിശോധനാ വിവരങ്ങൾ ലഭ്യമല്ല. പുതിയ പരിശോധന നടത്തുക.');
    } finally {
      setIsLoadingAiSummary(false);
    }
  };

  // Sync filtered profiles
  useEffect(() => {
    loadFilteredData();
  }, [scoreFilter, searchQuery, profiles]);

  const loadAllProfiles = async () => {
    const list = await getAllBeneficiaryProfiles();
    setProfiles(list);
    if (!selectedProfile && list.length > 0) {
      setSelectedProfile(list[0]);
    }
  };

  const loadFilteredData = async () => {
    const list = await getFilteredProfiles(scoreFilter, searchQuery);
    setFilteredProfiles(list);
  };

  // Recalculate Part A Score & Triage whenever relevant fields change
  const refreshScores = (updated: CbacOfficialRecord) => {
    calculatePartAScore(updated);

    // Re-check Part B Warnings
    const gVals = Object.values(updated.partB.general);
    const wVals = Object.values(updated.partB.womenOnly);
    const eVals = Object.values(updated.partB.elderlySpecific);
    updated.partB.hasAnyWarningSign = [...gVals, ...wVals, ...eVals].some(Boolean);

    // Re-check Part D
    updated.partD.totalScore = updated.partD.littleInterestOrPleasure + updated.partD.feelingDownDepressedHopeless;
    updated.partD.isReferredToChoMo = updated.partD.totalScore > 3;

    // Overall Triage
    if (updated.partB.hasAnyWarningSign) {
      updated.overallClassification = 'urgent_mo_referral';
      updated.actionRecommendationsMl = 'അപകടകരമായ ലക്ഷണങ്ങൾ ശ്രദ്ധയിൽപ്പെട്ടിട്ടുണ്ട് (Part B). ഉടൻ മെഡിക്കൽ ഓഫീസർക്ക് (MO) റഫർ ചെയ്യുക.';
      updated.actionRecommendationsEn = 'Warning signs detected (Part B). Immediate Medical Officer clinical referral required.';
    } else if (updated.partD.isReferredToChoMo) {
      updated.overallClassification = 'phq2_referral';
      updated.actionRecommendationsMl = 'PHQ-2 സ്കോർ 3-ൽ കൂടുതൽ. മാനസികാരോഗ്യ കൗൺസിലിംഗിനായി CHO / MO-ലേക്ക് റഫർ ചെയ്യുക.';
      updated.actionRecommendationsEn = 'PHQ-2 score >3. Refer to CHO/MO for mental health evaluation.';
    } else if (updated.partA.isHighRisk) {
      updated.overallClassification = 'high_ncd_risk';
      updated.actionRecommendationsMl = `CBAC റിസ്ക് സ്കോർ ${updated.partA.totalScore}/10 (>4). വാരാന്ത്യ NCD സ്ക്രീനിംഗ് ദിനത്തിൽ മുൻഗണനാ പരിശോധന ഉറപ്പാക്കുക.`;
      updated.actionRecommendationsEn = `High CBAC Risk Score: ${updated.partA.totalScore}/10 (>4). Prioritize for weekly NCD screening session at PHC.`;
    } else {
      updated.overallClassification = 'normal_routine';
      updated.actionRecommendationsMl = `CBAC സ്കോർ ${updated.partA.totalScore}/10 (സാധാരണ നില). പ്രതിവർഷം CBAC പരിശോധന ആവർത്തിക്കുക.`;
      updated.actionRecommendationsEn = `Normal CBAC Score: ${updated.partA.totalScore}/10 (≤4). Re-screen annually and encourage healthy lifestyle.`;
    }

    setRecord({ ...updated });
  };

  // Voice Recording & Speech Extraction Handler
  const handleToggleVoiceRecording = async () => {
    if (!isRecording) {
      // START RECORDING
      const hasPermission = await audioRecorder.requestPermission();
      if (!hasPermission) {
        setVoiceStatusMsg('മൈക്രോഫോൺ അനുമതി ആവശ്യമാണ്');
        return;
      }

      try {
        await audioRecorder.startRecording();
        setIsRecording(true);
        setRecordingDuration(0);
        setVoiceStatusMsg('തത്സമയം ശബ്ദം രേഖപ്പെടുത്തുന്നു... സംസാരിക്കുക');

        timerRef.current = setInterval(() => {
          setRecordingDuration((sec) => sec + 1);
        }, 1000);
      } catch (err: any) {
        setVoiceStatusMsg(`പ്രശ്നം: ${err.message}`);
      }
    } else {
      // STOP RECORDING & EXTRACT
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setIsRecording(false);
      setIsProcessingVoice(true);
      setVoiceStatusMsg('ശബ്ദരേഖ തയ്യാറാക്കുന്നു...');

      try {
        const audio = await audioRecorder.stopRecording();
        const asrResult = await transcribeWithIndicConformer(audio, 'ml');
        const capturedText = asrResult.transcript || '';
        setTranscript(capturedText);

        // Auto-extract and populate CBAC checklist from transcript
        const autoExtracted = extractCbacFromTranscript(capturedText, record);
        refreshScores(autoExtracted);
        setVoiceStatusMsg('ശബ്ദരേഖയിൽ നിന്ന് ഫോം സ്വയമേവ പൂരിപ്പിച്ചു');
      } catch (err: any) {
        console.warn('ASR / Extraction error:', err);
        setVoiceStatusMsg(`പ്രോസസ്സിംഗ് തടസ്സപ്പെട്ടു: ${err.message}`);
      } finally {
        setIsProcessingVoice(false);
      }
    }
  };

  const handleReanalyzeTranscript = () => {
    if (!transcript.trim()) return;
    const reAnalyzed = extractCbacFromTranscript(transcript, record);
    refreshScores(reAnalyzed);
    setVoiceStatusMsg('തിരുത്തിയ ശബ്ദരേഖയിൽ നിന്ന് ഫോം അപ്ഡേറ്റ് ചെയ്തു');
  };

  // Save Survey to Beneficiary Profile and MongoDB Atlas
  const handleSaveSurvey = async () => {
    setIsSaving(true);
    setSaveSuccessMsg('ഡാറ്റാബേസിലേക്ക് സേവ് ചെയ്യുന്നു (Saving to MongoDB Atlas)...');
    try {
      // 1. Save locally for offline storage
      const updatedProfile = await saveSurveyToProfile(record);
      setSelectedProfile(updatedProfile);
      await loadAllProfiles();

      // 2. Persist to MongoDB Atlas cbac_surveys & synchronize care ledgers
      const dbRes = await apiClient.saveCbacSurvey(record);
      if (dbRes.data && dbRes.data.storage === 'mongodb') {
        setSaveSuccessMsg(`✓ കേന്ദ്ര ഡാറ്റാബേസിൽ രേഖപ്പെടുത്തി! (${record.personalDetails.name} - സന്ദർശനം #${dbRes.data.visiting_no}, സ്കോർ: ${record.partA.totalScore}/10)`);
      } else {
        setSaveSuccessMsg(`✓ വിജയകരമായി സേവ് ചെയ്തു (${record.personalDetails.name} - സ്കോർ: ${record.partA.totalScore}/10)`);
      }

      // 3. Refresh AI Longitudinal Summary
      loadAiSummaryForPerson(record.beneficiaryId, record.personalDetails.name);
    } catch (err: any) {
      setSaveSuccessMsg(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveSuccessMsg(null), 4500);
    }
  };

  const handleStartNewSurveyForBeneficiary = (profile: BeneficiaryProfile) => {
    const newRecord = createDefaultCbacRecord(profile.beneficiaryId);
    newRecord.personalDetails.name = profile.name;
    newRecord.personalDetails.age = profile.age;
    newRecord.personalDetails.sex = profile.sex;
    newRecord.personalDetails.identifier = profile.identifier || '';
    newRecord.personalDetails.telephone = profile.telephone || '';
    newRecord.personalDetails.address = profile.address || '';
    newRecord.generalInfo.villageWard = profile.villageWard || 'വാർഡ് 4 (ആലുവ)';

    refreshScores(newRecord);
    setCurrentStep(1);
    setVoiceStatusMsg(`പുതിയ സർവേ ആരംഭിച്ചു (${profile.name})`);
    loadAiSummaryForPerson(profile.beneficiaryId, profile.name);
  };

  const handleResetNewSurvey = () => {
    const newRecord = createDefaultCbacRecord();
    refreshScores(newRecord);
    setTranscript('');
    setCurrentStep(1);
    setVoiceStatusMsg('പുതിയ CBAC സർവേ ആരംഭിച്ചു');
    loadAiSummaryForPerson(newRecord.beneficiaryId, newRecord.personalDetails.name);
  };

  const handleDeleteProfile = async (id: string) => {
    await deleteBeneficiaryProfile(id);
    if (selectedProfile?.beneficiaryId === id) {
      setSelectedProfile(null);
    }
    await loadAllProfiles();
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const goToNextStep = () => {
    if (currentStep < 6) {
      setCurrentStep((prev) => (prev + 1) as WizardStep);
      setIsHeaderCollapsed(false);
      lastToggleTime.current = Date.now() + 600;
      accumulatedScrollDelta.current = 0;
      lastScrollY.current = 0;
      surveyScrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  };

  const goToPrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as WizardStep);
      setIsHeaderCollapsed(false);
      lastToggleTime.current = Date.now() + 600;
      accumulatedScrollDelta.current = 0;
      lastScrollY.current = 0;
      surveyScrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  };

  const handleSelectStep = (step: WizardStep) => {
    setCurrentStep(step);
    setIsHeaderCollapsed(false);
    lastToggleTime.current = Date.now() + 600;
    accumulatedScrollDelta.current = 0;
    lastScrollY.current = 0;
    surveyScrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const toggleHeaderCollapse = () => {
    const next = !isHeaderCollapsed;
    setIsHeaderCollapsed(next);
    lastToggleTime.current = Date.now() + 800;
    accumulatedScrollDelta.current = 0;
  };

  const handleSurveyScroll = (e: any) => {
    const currentY = e.nativeEvent?.contentOffset?.y ?? 0;

    // Ignore bounce/overscroll at the very top (iOS negative offsets)
    if (currentY < 0) {
      return;
    }

    // Debounce/cooldown: Ignore synthetic scroll events during layout animations/transitions
    const now = Date.now();
    if (now - lastToggleTime.current < 400) {
      lastScrollY.current = currentY;
      return;
    }

    const diff = currentY - lastScrollY.current;

    // Reset accumulated delta if direction reverses
    if ((diff > 0 && accumulatedScrollDelta.current < 0) || (diff < 0 && accumulatedScrollDelta.current > 0)) {
      accumulatedScrollDelta.current = 0;
    }
    accumulatedScrollDelta.current += diff;

    // Scrolling down into survey: collapse header when scrolling past 50px with solid downward intent
    if (currentY > 50 && accumulatedScrollDelta.current > 30) {
      if (!isHeaderCollapsed) {
        setIsHeaderCollapsed(true);
        lastToggleTime.current = now;
        accumulatedScrollDelta.current = 0;
      }
    } else if (currentY <= 15 || accumulatedScrollDelta.current < -50) {
      // Scrolling up towards top or sustained upward scroll: expand header
      if (isHeaderCollapsed) {
        setIsHeaderCollapsed(false);
        lastToggleTime.current = now;
        accumulatedScrollDelta.current = 0;
      }
    }
    lastScrollY.current = currentY;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header Block (Collapsible on scroll) */}
      {!isHeaderCollapsed && (
        <View style={styles.headerBlock}>
          <View style={styles.headerTitleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>സി.ബി.എ.സി സർവേ</Text>
              <Text style={styles.subtitle}>
                കമ്മ്യൂണിറ്റി ബേസ്ഡ് അസസ്സ്മെന്റ് ചെക്ക്‌ലിസ്റ്റ്
              </Text>
            </View>
            {onBack && (
              <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                <AppIcon name="close" size={14} color="#475569" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Wizard Step Progression Bar (Collapsible on scroll) */}
      {!isHeaderCollapsed && (
        <View style={styles.wizardTrackerContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stepScroll}>
            {WIZARD_STEPS.map((s) => {
              const isActive = currentStep === s.step;
              const isPassed = currentStep > s.step;

              return (
                <TouchableOpacity
                  key={s.step}
                  style={[
                    styles.stepPill,
                    isActive && styles.stepPillActive,
                    isPassed && styles.stepPillPassed
                  ]}
                  onPress={() => handleSelectStep(s.step)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.stepNumberCircle,
                    isActive && styles.stepNumberCircleActive,
                    isPassed && styles.stepNumberCirclePassed
                  ]}>
                    <Text style={[
                      styles.stepNumberText,
                      isActive && styles.stepNumberTextActive,
                      isPassed && styles.stepNumberTextPassed
                    ]}>
                      {isPassed ? '✓' : s.step}
                    </Text>
                  </View>
                  <Text style={[
                    styles.stepPillLabel,
                    isActive && styles.stepPillLabelActive,
                    isPassed && styles.stepPillLabelPassed
                  ]}>
                    {s.shortLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <View style={{ flex: 1 }}>
        {/* Highlighted Real-time Voice Assistant Bar (Remains Pinned Across All Steps) */}
        <View style={[styles.voiceAssistantCard, isHeaderCollapsed && styles.voiceAssistantCardPinned]}>
          <View style={styles.voiceAssistantTopRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <View style={[styles.micIconPill, isRecording && styles.micIconPillRecording]}>
                <AppIcon name={isRecording ? 'stop' : 'mic'} size={18} color={isRecording ? '#DC2626' : '#047857'} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.voiceCardHeading}>
                    {isRecording ? 'ശബ്ദം രേഖപ്പെടുത്തുന്നു...' : 'തത്സമയ വോയ്സ് അസിസ്റ്റന്റ്'}
                  </Text>
                  {isHeaderCollapsed && (
                    <TouchableOpacity
                      style={styles.compactStepBadge}
                      onPress={toggleHeaderCollapse}
                      activeOpacity={0.7}
                      accessibilityLabel="ഹെഡർ തുറക്കുക"
                    >
                      <Text style={styles.compactStepBadgeText}>
                        {currentStep}/6: {WIZARD_STEPS[currentStep - 1].shortLabel} ▾
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.voiceCardSub} numberOfLines={1}>
                  {voiceStatusMsg}
                </Text>
              </View>
            </View>

            {isRecording && (
              <View style={styles.recordingTimeBadge}>
                <View style={styles.pulsingDot} />
                <Text style={styles.recordingTimeText}>{formatTimer(recordingDuration)}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.audioActionBtn,
                isRecording ? styles.audioActionBtnStop : styles.audioActionBtnRecord,
                isProcessingVoice && styles.audioActionBtnProcessing
              ]}
              onPress={handleToggleVoiceRecording}
              disabled={isProcessingVoice}
              activeOpacity={0.8}
            >
              {isProcessingVoice ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <AppIcon name={isRecording ? 'stop' : 'mic'} size={14} color="#FFFFFF" />
                  <Text style={styles.audioActionBtnText}>
                    {isRecording ? 'നിർത്തുക' : 'സംസാരിക്കുക'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Quick Manual Collapse/Expand Toggle */}
            <TouchableOpacity
              style={styles.collapseToggleBtn}
              onPress={toggleHeaderCollapse}
              activeOpacity={0.7}
              accessibilityLabel={isHeaderCollapsed ? 'ഹെഡർ വലുതാക്കുക' : 'ഹെഡർ ചെറുതാക്കുക'}
            >
              <AppIcon name={isHeaderCollapsed ? 'chevron-down' : 'chevron-up'} size={16} color="#047857" />
            </TouchableOpacity>
          </View>

          {/* Transcript collapsible preview */}
          {transcript ? (
            <View style={styles.transcriptSnippetBox}>
              <View style={styles.transcriptSnippetHeader}>
                <Text style={styles.transcriptSnippetTitle}>ലഭിച്ച ശബ്ദരേഖ:</Text>
                <TouchableOpacity
                  style={styles.reanalyzeSmallBtn}
                  onPress={handleReanalyzeTranscript}
                  disabled={isProcessingVoice}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <AppIcon name="sync" size={11} color="#FFFFFF" />
                    <Text style={styles.reanalyzeSmallBtnText}>അപ്‌ഡേറ്റ്</Text>
                  </View>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.transcriptSnippetInput}
                multiline
                value={transcript}
                onChangeText={setTranscript}
                placeholder="ശബ്ദരേഖ തിരുത്താൻ ഇവിടെ ടാപ്പ് ചെയ്യുക..."
                placeholderTextColor="#94A3B8"
              />
            </View>
          ) : null}
        </View>

        {/* Main Step Body Scroll Area */}
        <ScrollView
          ref={surveyScrollRef}
          contentContainerStyle={styles.wizardContentScroll}
          showsVerticalScrollIndicator={false}
          onScroll={handleSurveyScroll}
          scrollEventThrottle={16}
        >
          {/* Step Header Banner */}
          <View style={styles.stepTitleBanner}>
            <Text style={styles.stepCounterText}>ഘട്ടം {currentStep} / 6</Text>
            <Text style={styles.stepMainTitle}>{WIZARD_STEPS[currentStep - 1].title}</Text>
            <Text style={styles.stepSubtitle}>{WIZARD_STEPS[currentStep - 1].subtitle}</Text>
          </View>

            {/* ======================================================================= */}
            {/* STEP 1: ഗുണഭോക്താവിന്റെ വിവരങ്ങൾ (BENEFICIARY DETAILS) */}
            {/* ======================================================================= */}
            {currentStep === 1 && (
              <View>
                {/* ASHA Topic Guidance / Prompt Box */}
                <View style={styles.ashaPromptBox}>
                  <View style={styles.ashaPromptHeader}>
                    <AppIcon name="info" size={14} color="#166534" />
                    <Text style={styles.ashaPromptTitle}>ആശാ പ്രവർത്തക ചോദിക്കേണ്ട കാര്യങ്ങൾ:</Text>
                  </View>
                  <Text style={styles.ashaPromptText}>
                    "രോഗിയുടെ പേര്, പ്രായം, ലിംഗം, ആധാർ നമ്പർ, ഫോൺ നമ്പർ എന്നിവ സൗഹാർദ്ദപരമായി ചോദിക്കുക. ശബ്ദം റെക്കോർഡ് ചെയ്താൽ ഈ വിവരങ്ങൾ സ്വയമേവ ഫോമിലേക്ക് എടുക്കുന്നതാണ്."
                  </Text>
                </View>

                {/* Form Fields Card */}
                <View style={styles.stepCard}>
                  <Text style={styles.cardSectionTitle}>പ്രാഥമിക വിവരങ്ങൾ</Text>

                  <View style={styles.inputRow}>
                    <View style={styles.inputCol}>
                      <Text style={styles.inputLabel}>പേര്:</Text>
                      <TextInput
                        style={styles.textInput}
                        value={record.personalDetails.name}
                        onChangeText={(t) => {
                          record.personalDetails.name = t;
                          setRecord({ ...record });
                        }}
                        placeholder="രോഗിയുടെ പേര്..."
                      />
                    </View>
                  </View>

                  <View style={styles.grid2Row}>
                    <View style={styles.inputCol}>
                      <Text style={styles.inputLabel}>പ്രായം:</Text>
                      <TextInput
                        style={styles.textInput}
                        value={record.personalDetails.age ? record.personalDetails.age.toString() : ''}
                        keyboardType="numeric"
                        onChangeText={(t) => {
                          const age = parseInt(t, 10) || 0;
                          record.personalDetails.age = age;
                          if (age < 30) record.partA.ageScore = 0;
                          else if (age <= 39) record.partA.ageScore = 1;
                          else if (age <= 49) record.partA.ageScore = 2;
                          else if (age <= 59) record.partA.ageScore = 3;
                          else record.partA.ageScore = 4;
                          refreshScores(record);
                        }}
                        placeholder="56"
                      />
                    </View>

                    <View style={styles.inputCol}>
                      <Text style={styles.inputLabel}>ലിംഗം:</Text>
                      <View style={styles.genderRow}>
                        {(['female', 'male', 'other'] as const).map((g) => (
                          <TouchableOpacity
                            key={g}
                            style={[
                              styles.genderBtn,
                              record.personalDetails.sex === g && styles.genderBtnActive
                            ]}
                            onPress={() => {
                              record.personalDetails.sex = g;
                              refreshScores(record);
                            }}
                          >
                            <Text
                              style={[
                                styles.genderBtnText,
                                record.personalDetails.sex === g && styles.genderBtnTextActive
                              ]}
                            >
                              {g === 'female' ? 'സ്ത്രീ' : g === 'male' ? 'പുരുഷൻ' : 'മറ്റുള്ളവർ'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>

                  <View style={styles.grid2Row}>
                    <View style={styles.inputCol}>
                      <Text style={styles.inputLabel}>ആധാർ / തിരിച്ചറിയൽ നമ്പർ:</Text>
                      <TextInput
                        style={styles.textInput}
                        value={record.personalDetails.identifier}
                        onChangeText={(t) => {
                          record.personalDetails.identifier = t;
                          setRecord({ ...record });
                        }}
                        placeholder="XXXX-XXXX-XXXX"
                      />
                    </View>

                    <View style={styles.inputCol}>
                      <Text style={styles.inputLabel}>ഫോൺ നമ്പർ:</Text>
                      <TextInput
                        style={styles.textInput}
                        value={record.personalDetails.telephone}
                        keyboardType="phone-pad"
                        onChangeText={(t) => {
                          record.personalDetails.telephone = t;
                          setRecord({ ...record });
                        }}
                        placeholder="98XXXXXXXX"
                      />
                    </View>
                  </View>

                  <View style={styles.grid2Row}>
                    <View style={styles.inputCol}>
                      <Text style={styles.inputLabel}>വാർഡ് / ഗ്രാമം:</Text>
                      <TextInput
                        style={styles.textInput}
                        value={record.generalInfo.villageWard}
                        onChangeText={(t) => {
                          record.generalInfo.villageWard = t;
                          setRecord({ ...record });
                        }}
                      />
                    </View>

                    <View style={styles.inputCol}>
                      <Text style={styles.inputLabel}>ആശാ പ്രവർത്തകയുടെ പേര്:</Text>
                      <TextInput
                        style={styles.textInput}
                        value={record.generalInfo.nameOfAsha}
                        onChangeText={(t) => {
                          record.generalInfo.nameOfAsha = t;
                          setRecord({ ...record });
                        }}
                      />
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* ======================================================================= */}
            {/* STEP 2: ഭാഗം A: റിസ്ക് ഘടകങ്ങൾ */}
            {/* ======================================================================= */}
            {currentStep === 2 && (
              <View>
                {/* ASHA Topic Guidance */}
                <View style={styles.ashaPromptBox}>
                  <View style={styles.ashaPromptHeader}>
                    <AppIcon name="info" size={14} color="#166534" />
                    <Text style={styles.ashaPromptTitle}>ആശാ പ്രവർത്തക ചോദിക്കേണ്ട കാര്യങ്ങൾ:</Text>
                  </View>
                  <Text style={styles.ashaPromptText}>
                    "പുകവലി/മുറുക്ക് ശീലങ്ങൾ, ദിവസേന മദ്യപാനം, അരക്കെട്ടിന്റെ അളവ്, ആഴ്ചയിൽ 150 മിനിറ്റ് നടത്തം/വ്യായാമം, കുടുംബത്തിൽ പ്രമേഹം അല്ലെങ്കിൽ ബിപി ചരിത്രം എന്നിവ സാധാരണ സംഭാഷണത്തിലൂടെ ചോദിച്ചറിയുക. സ്കോർ 4-ൽ കൂടുതലാണെങ്കിൽ മുൻഗണനാ പരിശോധന വേണം."
                  </Text>
                </View>

                {/* Real-time Part A Score Meter */}
                <View style={[
                  styles.partAScoreMeter,
                  record.partA.isHighRisk ? styles.scoreMeterHigh : styles.scoreMeterNormal
                ]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.partAScoreLabel}>റിസ്ക് സ്കോർ (Part A):</Text>
                    <Text style={styles.partAScoreVal}>
                      {record.partA.totalScore} <Text style={{ fontSize: 16, fontWeight: 'normal' }}>/ 10</Text>
                    </Text>
                  </View>
                  <View style={[
                    styles.scoreRiskPill,
                    record.partA.isHighRisk ? styles.riskPillHigh : styles.riskPillNormal
                  ]}>
                    <Text style={styles.riskPillText}>
                      {record.partA.isHighRisk ? 'ഉയർന്ന റിസ്ക് (>4)' : 'സാധാരണ നില (≤4)'}
                    </Text>
                  </View>
                </View>

                {/* 1. Age Score */}
                <View style={styles.questionCard}>
                  <View style={styles.qHeaderRow}>
                    <Text style={styles.qNumber}>1</Text>
                    <Text style={styles.qTitle}>പ്രായം അനുസരിച്ചുള്ള സ്കോർ:</Text>
                    <Text style={styles.qScoreBadge}>+{record.partA.ageScore}</Text>
                  </View>
                  <View style={styles.choiceOptionsGrid}>
                    {[
                      { s: 0, l: '≤ 29 (0)' },
                      { s: 1, l: '30-39 (1)' },
                      { s: 2, l: '40-49 (2)' },
                      { s: 3, l: '50-59 (3)' },
                      { s: 4, l: '≥ 60 (4)' }
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.s}
                        style={[
                          styles.choiceOptionBtn,
                          record.partA.ageScore === item.s && styles.choiceOptionBtnActive
                        ]}
                        onPress={() => {
                          record.partA.ageScore = item.s as CbacPartAAge;
                          refreshScores(record);
                        }}
                      >
                        <Text style={[
                          styles.choiceOptionText,
                          record.partA.ageScore === item.s && styles.choiceOptionTextActive
                        ]}>
                          {item.l}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* 2. Tobacco */}
                <View style={styles.questionCard}>
                  <View style={styles.qHeaderRow}>
                    <Text style={styles.qNumber}>2</Text>
                    <Text style={styles.qTitle}>പുകവലിക്കുകയോ മുറുക്കുകയോ ചെയ്യാറുണ്ടോ?:</Text>
                    <Text style={styles.qScoreBadge}>+{record.partA.tobaccoScore}</Text>
                  </View>
                  <View style={styles.choiceRowStacked}>
                    {[
                      { s: 0, l: 'ഒരിക്കലുമില്ല (0 പോയിന്റ്)' },
                      { s: 1, l: 'മുൻപ് / വല്ലപ്പോഴും (1 പോയിന്റ്)' },
                      { s: 2, l: 'ദിവസവും (2 പോയിന്റ്)' }
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.s}
                        style={[
                          styles.stackedChoiceBtn,
                          record.partA.tobaccoScore === item.s && styles.stackedChoiceBtnActive
                        ]}
                        onPress={() => {
                          record.partA.tobaccoScore = item.s as CbacPartATobacco;
                          refreshScores(record);
                        }}
                      >
                        <Text style={[
                          styles.stackedChoiceText,
                          record.partA.tobaccoScore === item.s && styles.stackedChoiceTextActive
                        ]}>
                          {item.l}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* 3. Alcohol */}
                <View style={styles.questionCard}>
                  <View style={styles.qHeaderRow}>
                    <Text style={styles.qNumber}>3</Text>
                    <Text style={styles.qTitle}>ദിവസവും മദ്യം കഴിക്കാറുണ്ടോ?:</Text>
                    <Text style={styles.qScoreBadge}>+{record.partA.alcoholScore}</Text>
                  </View>
                  <View style={styles.grid2Row}>
                    {[
                      { s: 0, l: 'ഇല്ല (0 പോയിന്റ്)' },
                      { s: 1, l: 'ഉണ്ട് (1 പോയിന്റ്)' }
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.s}
                        style={[
                          styles.choiceOptionBtn,
                          record.partA.alcoholScore === item.s && styles.choiceOptionBtnActive
                        ]}
                        onPress={() => {
                          record.partA.alcoholScore = item.s as CbacPartAAlcohol;
                          refreshScores(record);
                        }}
                      >
                        <Text style={[
                          styles.choiceOptionText,
                          record.partA.alcoholScore === item.s && styles.choiceOptionTextActive
                        ]}>
                          {item.l}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* 4. Waist Circumference */}
                <View style={styles.questionCard}>
                  <View style={styles.qHeaderRow}>
                    <Text style={styles.qNumber}>4</Text>
                    <Text style={styles.qTitle}>
                      അരക്കെട്ടിന്റെ അളവ് ({record.personalDetails.sex === 'female' ? 'സ്ത്രീകൾ' : 'പുരുഷന്മാർ'}):
                    </Text>
                    <Text style={styles.qScoreBadge}>+{record.partA.waistScore}</Text>
                  </View>
                  <View style={styles.choiceRowStacked}>
                    {[
                      {
                        s: 0,
                        l: record.personalDetails.sex === 'female' ? '≤ 80 cm (സാധാരണ: 0 പോയിന്റ്)' : '≤ 90 cm (സാധാരണ: 0 പോയിന്റ്)'
                      },
                      {
                        s: 1,
                        l: record.personalDetails.sex === 'female' ? '81 - 90 cm (മിതമായ റിസ്ക്: 1 പോയിന്റ്)' : '91 - 100 cm (മിതമായ റിസ്ക്: 1 പോയിന്റ്)'
                      },
                      {
                        s: 2,
                        l: record.personalDetails.sex === 'female' ? '> 90 cm (ഉയർന്ന റിസ്ക്: 2 പോയിന്റ്)' : '> 100 cm (ഉയർന്ന റിസ്ക്: 2 പോയിന്റ്)'
                      }
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.s}
                        style={[
                          styles.stackedChoiceBtn,
                          record.partA.waistScore === item.s && styles.stackedChoiceBtnActive
                        ]}
                        onPress={() => {
                          record.partA.waistScore = item.s as CbacPartAWaist;
                          refreshScores(record);
                        }}
                      >
                        <Text style={[
                          styles.stackedChoiceText,
                          record.partA.waistScore === item.s && styles.stackedChoiceTextActive
                        ]}>
                          {item.l}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* 5. Physical Activity */}
                <View style={styles.questionCard}>
                  <View style={styles.qHeaderRow}>
                    <Text style={styles.qNumber}>5</Text>
                    <Text style={styles.qTitle}>ആഴ്ചയിൽ കുറഞ്ഞത് 150 മിനിറ്റ് വ്യായാമം:</Text>
                    <Text style={styles.qScoreBadge}>+{record.partA.physicalActivityScore}</Text>
                  </View>
                  <View style={styles.choiceRowStacked}>
                    {[
                      { s: 0, l: 'ആഴ്ചയിൽ 150 മിനിറ്റ് എങ്കിലും വ്യായാമം ചെയ്യുന്നു (0 പോയിന്റ്)' },
                      { s: 1, l: '150 മിനിറ്റിൽ താഴെ / വ്യായാമം ഇല്ല (1 പോയിന്റ്)' }
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.s}
                        style={[
                          styles.stackedChoiceBtn,
                          record.partA.physicalActivityScore === item.s && styles.stackedChoiceBtnActive
                        ]}
                        onPress={() => {
                          record.partA.physicalActivityScore = item.s as CbacPartAPhysicalActivity;
                          refreshScores(record);
                        }}
                      >
                        <Text style={[
                          styles.stackedChoiceText,
                          record.partA.physicalActivityScore === item.s && styles.stackedChoiceTextActive
                        ]}>
                          {item.l}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* 6. Family History */}
                <View style={styles.questionCard}>
                  <View style={styles.qHeaderRow}>
                    <Text style={styles.qNumber}>6</Text>
                    <Text style={styles.qTitle}>കുടുംബത്തിൽ ഉയർന്ന ബിപി, ഷുഗർ, ഹൃദ്രോഗം ചരിത്രം:</Text>
                    <Text style={styles.qScoreBadge}>+{record.partA.familyHistoryScore}</Text>
                  </View>
                  <View style={styles.grid2Row}>
                    {[
                      { s: 0, l: 'ഇല്ല (0 പോയിന്റ്)' },
                      { s: 2, l: 'ഉണ്ട് (2 പോയിന്റ്)' }
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.s}
                        style={[
                          styles.choiceOptionBtn,
                          record.partA.familyHistoryScore === item.s && styles.choiceOptionBtnActive
                        ]}
                        onPress={() => {
                          record.partA.familyHistoryScore = item.s as CbacPartAFamilyHistory;
                          refreshScores(record);
                        }}
                      >
                        <Text style={[
                          styles.choiceOptionText,
                          record.partA.familyHistoryScore === item.s && styles.choiceOptionTextActive
                        ]}>
                          {item.l}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* ======================================================================= */}
            {/* STEP 3: ഭാഗം B: പ്രാരംഭ ലക്ഷണങ്ങൾ */}
            {/* ======================================================================= */}
            {currentStep === 3 && (
              <View>
                {/* ASHA Topic Guidance */}
                <View style={styles.ashaPromptBox}>
                  <View style={styles.ashaPromptHeader}>
                    <AppIcon name="info" size={14} color="#166534" />
                    <Text style={styles.ashaPromptTitle}>ആശാ പ്രവർത്തക ചോദിക്കേണ്ട കാര്യങ്ങൾ:</Text>
                  </View>
                  <Text style={styles.ashaPromptText}>
                    "രണ്ടാഴ്ചയിലധികം നീളുന്ന ചുമ, കഫത്തിൽ രക്തം, പനി, പെട്ടെന്ന് ഭാരം കുറയൽ, വായിലെ ഉണങ്ങാത്ത വ്രണങ്ങൾ, സ്തനത്തിലെ മുഴകൾ എന്നിവ ചോദിക്കുക. ഇവിടെ ഏതെങ്കിലും ലക്ഷണം 'ഉണ്ട്' എങ്കിൽ രോഗിയെ ഉടൻ മെഡിക്കൽ ഓഫീസർക്ക് (MO) റഫർ ചെയ്യണം."
                  </Text>
                </View>

                {/* Live Danger Warning Banner */}
                <View style={[
                  styles.warningStatusBanner,
                  record.partB.hasAnyWarningSign ? styles.warningBannerActive : styles.warningBannerClear
                ]}>
                  <Text style={styles.warningBannerTitle}>
                    {record.partB.hasAnyWarningSign
                      ? 'അപായ സൂചനകൾ ശ്രദ്ധയിൽപ്പെട്ടിട്ടുണ്ട് - ഡോക്ടറുടെ പരിശോധന ആവശ്യമാണ്'
                      : 'നിലവിൽ പ്രത്യേക അപായ സൂചനകൾ കണ്ടെത്തിയിട്ടില്ല'}
                  </Text>
                </View>

                {/* B1: General Symptoms */}
                <View style={styles.stepCard}>
                  <Text style={styles.cardSectionTitle}>B1. പൊതുവായ ലക്ഷണങ്ങൾ</Text>
                  {[
                    { k: 'shortnessOfBreath', ml: 'ശ്വാസതടസ്സം / കിതപ്പ്' },
                    { k: 'coughingMoreThan2Weeks', ml: 'രണ്ടാഴ്ചയിലധികം നീളുന്ന ചുമ' },
                    { k: 'bloodInSputum', ml: 'കഫത്തിൽ രക്തം കാണുക' },
                    { k: 'feverOver2Weeks', ml: 'രണ്ടാഴ്ചയിലധികം പനി' },
                    { k: 'lossOfWeight', ml: 'ശരീരഭാരം പെട്ടെന്ന് കുറയുന്നു' },
                    { k: 'nightSweats', ml: 'രാത്രി അമിതമായി വിയർക്കുക' },
                    { k: 'takingAntiTbDrugs', ml: 'നിലവിൽ ടിബി മരുന്ന് കഴിക്കുന്നുണ്ടോ?' },
                    { k: 'mouthUlcersOver2Weeks', ml: 'വായ്ക്കുള്ളിൽ ഉണങ്ങാത്ത വ്രണം' },
                    { k: 'mouthWhiteOrRedPatchOver2Weeks', ml: 'വായിൽ വെളുത്തതോ ചുവന്നതോ ആയ പാട്' },
                    { k: 'changeInVoiceTone', ml: 'ശബ്ദവ്യത്യാസം / ഒച്ചയടപ്പ്' },
                    { k: 'historyOfFits', ml: 'അപസ്മാരം / ഫിറ്റ്സ് ഉണ്ടായ ചരിത്രം' },
                    { k: 'cloudyOrBlurredVision', ml: 'കാഴ്ച മങ്ങൽ' },
                    { k: 'tinglingNumbnessHandsFeet', ml: 'കൈകാലുകളിൽ മരവിപ്പും തരിപ്പും' },
                    { k: 'difficultyHearing', ml: 'കേൾവിക്കുറവ്' }
                  ].map((sym) => {
                    const isChecked = (record.partB.general as any)[sym.k];
                    return (
                      <TouchableOpacity
                        key={sym.k}
                        style={[styles.checkboxRow, isChecked && styles.checkboxRowActive]}
                        onPress={() => {
                          (record.partB.general as any)[sym.k] = !isChecked;
                          refreshScores(record);
                        }}
                      >
                        <View style={[styles.checkboxBox, isChecked && styles.checkboxBoxActive]}>
                          <Text style={styles.checkboxCheckMark}>{isChecked ? '✓' : ''}</Text>
                        </View>
                        <Text style={[styles.checkboxLabel, isChecked && styles.checkboxLabelActive]}>
                          {sym.ml}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* B2: Women Only */}
                {record.personalDetails.sex === 'female' && (
                  <View style={styles.stepCard}>
                    <Text style={styles.cardSectionTitle}>B2. സ്ത്രീകൾക്ക് മാത്രമുള്ള ലക്ഷണങ്ങൾ</Text>
                    {[
                      { k: 'lumpInBreast', ml: 'സ്തനത്തിൽ മുഴ' },
                      { k: 'bloodStainedNippleDischarge', ml: 'മുലക്കണ്ണിൽ നിന്ന് രക്തംകലർന്ന സ്രവം' },
                      { k: 'bleedingBetweenPeriods', ml: 'ആർത്തവങ്ങൾക്കിടയിലുള്ള രക്തസ്രാവം' },
                      { k: 'bleedingAfterMenopause', ml: 'ആർത്തവവിരാമത്തിന് ശേഷമുള്ള രക്തസ്രാവം' },
                      { k: 'foulSmellingVaginalDischarge', ml: 'ദുർഗന്ധമുള്ള വെള്ളപോക്ക്' }
                    ].map((sym) => {
                      const isChecked = (record.partB.womenOnly as any)[sym.k];
                      return (
                        <TouchableOpacity
                          key={sym.k}
                          style={[styles.checkboxRow, isChecked && styles.checkboxRowActive]}
                          onPress={() => {
                            (record.partB.womenOnly as any)[sym.k] = !isChecked;
                            refreshScores(record);
                          }}
                        >
                          <View style={[styles.checkboxBox, isChecked && styles.checkboxBoxActive]}>
                            <Text style={styles.checkboxCheckMark}>{isChecked ? '✓' : ''}</Text>
                          </View>
                          <Text style={[styles.checkboxLabel, isChecked && styles.checkboxLabelActive]}>
                            {sym.ml}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* B3: Elderly Specific 60+ */}
                {record.personalDetails.age >= 60 && (
                  <View style={styles.stepCard}>
                    <Text style={styles.cardSectionTitle}>B3. മുതിർന്ന പൗരന്മാർക്കുള്ള ലക്ഷണങ്ങൾ (60 വയസ്സിന് മുകളിൽ)</Text>
                    {[
                      { k: 'feelingUnsteadyStandingWalking', ml: 'നിൽക്കുമ്പോഴും നടക്കുമ്പോഴും കാലിടറൽ' },
                      { k: 'needingHelpEverydayActivities', ml: 'കുളിക്കാനും ഭക്ഷണം കഴിക്കാനും മറ്റുള്ളവരുടെ സഹായം വേണം' },
                      { k: 'forgettingNamesOrHomeAddress', ml: 'അടുത്തവരുടെ പേരോ സ്വന്തം വിലാസമോ മറന്നുപോകുന്നു' }
                    ].map((sym) => {
                      const isChecked = (record.partB.elderlySpecific as any)[sym.k];
                      return (
                        <TouchableOpacity
                          key={sym.k}
                          style={[styles.checkboxRow, isChecked && styles.checkboxRowActive]}
                          onPress={() => {
                            (record.partB.elderlySpecific as any)[sym.k] = !isChecked;
                            refreshScores(record);
                          }}
                        >
                          <View style={[styles.checkboxBox, isChecked && styles.checkboxBoxActive]}>
                            <Text style={styles.checkboxCheckMark}>{isChecked ? '✓' : ''}</Text>
                          </View>
                          <Text style={[styles.checkboxLabel, isChecked && styles.checkboxLabelActive]}>
                            {sym.ml}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* ======================================================================= */}
            {/* STEP 4: ഭാഗം C: ശ്വാസകോശ രോഗസാധ്യത */}
            {/* ======================================================================= */}
            {currentStep === 4 && (
              <View>
                {/* ASHA Topic Guidance */}
                <View style={styles.ashaPromptBox}>
                  <View style={styles.ashaPromptHeader}>
                    <AppIcon name="info" size={14} color="#166534" />
                    <Text style={styles.ashaPromptTitle}>ആശാ പ്രവർത്തക ചോദിക്കേണ്ട കാര്യങ്ങൾ:</Text>
                  </View>
                  <Text style={styles.ashaPromptText}>
                    "വീട്ടിൽ പാചകത്തിന് ഉപയോഗിക്കുന്ന പ്രധാന ഇന്ധനം (വിറക്, കൽക്കരി, ഗ്യാസ്) എന്താണെന്നും, ജോലിസ്ഥലത്തോ വീടിനടുത്തോ വ്യവസായ പുകയോ പൊടിയോ ഉള്ള സമ്പർക്കമുണ്ടോ എന്നും ചോദിക്കുക."
                  </Text>
                </View>

                {/* C1: Cooking Fuel Selection */}
                <View style={styles.stepCard}>
                  <Text style={styles.cardSectionTitle}>C1. പാചകത്തിന് ഉപയോഗിക്കുന്ന ഇന്ധനം</Text>
                  {[
                    { id: 'firewood', ml: 'വിറക് / ബയോമാസ് അടുപ്പ്' },
                    { id: 'lpg', ml: 'എൽ.പി.ജി / പാചകവാതകം' },
                    { id: 'kerosene', ml: 'മണ്ണെണ്ണ സ്റ്റൗ' },
                    { id: 'coal', ml: 'കൽക്കരി' },
                    { id: 'crop_residue', ml: 'കൃഷി അവശിഷ്ടങ്ങൾ' },
                    { id: 'cow_dung', ml: 'ചാണക വരളി' }
                  ].map((fuel) => {
                    const isSelected = record.partC.cookingFuels.includes(fuel.id as CbacCookingFuel);
                    return (
                      <TouchableOpacity
                        key={fuel.id}
                        style={[styles.checkboxRow, isSelected && styles.checkboxRowActive]}
                        onPress={() => {
                          if (isSelected) {
                            record.partC.cookingFuels = record.partC.cookingFuels.filter((f) => f !== fuel.id);
                          } else {
                            record.partC.cookingFuels.push(fuel.id as CbacCookingFuel);
                          }
                          refreshScores(record);
                        }}
                      >
                        <View style={[styles.checkboxBox, isSelected && styles.checkboxBoxActive]}>
                          <Text style={styles.checkboxCheckMark}>{isSelected ? '✓' : ''}</Text>
                        </View>
                        <Text style={[styles.checkboxLabel, isSelected && styles.checkboxLabelActive]}>
                          {fuel.ml}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* C2: Occupational Smoke & Dust */}
                <View style={styles.stepCard}>
                  <Text style={styles.cardSectionTitle}>C2. ജോലിസ്ഥലത്തെ പുകയും പൊടിയും</Text>
                  {[
                    { id: 'industrial_smoke_dust', ml: 'വ്യവസായ പുക / പൊടി' },
                    { id: 'crop_burning', ml: 'കൃഷിയിടങ്ങളിലെ അവശിഷ്ട പുക' },
                    { id: 'garbage_burning', ml: 'പ്ലാസ്റ്റിക് / മാലിന്യ പുക' },
                    { id: 'none', ml: 'ജോലിസ്ഥലത്ത് പുകയോ പൊടിയോ ഇല്ല' }
                  ].map((exp) => {
                    const isSelected = record.partC.occupationalExposures.includes(exp.id as CbacOccupationalExposure);
                    return (
                      <TouchableOpacity
                        key={exp.id}
                        style={[styles.checkboxRow, isSelected && styles.checkboxRowActive]}
                        onPress={() => {
                          if (exp.id === 'none') {
                            record.partC.occupationalExposures = ['none'];
                          } else {
                            record.partC.occupationalExposures = record.partC.occupationalExposures.filter((e) => e !== 'none');
                            if (isSelected) {
                              record.partC.occupationalExposures = record.partC.occupationalExposures.filter((e) => e !== exp.id);
                            } else {
                              record.partC.occupationalExposures.push(exp.id as CbacOccupationalExposure);
                            }
                          }
                          refreshScores(record);
                        }}
                      >
                        <View style={[styles.checkboxBox, isSelected && styles.checkboxBoxActive]}>
                          <Text style={styles.checkboxCheckMark}>{isSelected ? '✓' : ''}</Text>
                        </View>
                        <Text style={[styles.checkboxLabel, isSelected && styles.checkboxLabelActive]}>
                          {exp.ml}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ======================================================================= */}
            {/* STEP 5: ഭാഗം D: മാനസികാരോഗ്യം */}
            {/* ======================================================================= */}
            {currentStep === 5 && (
              <View>
                {/* ASHA Topic Guidance */}
                <View style={styles.ashaPromptBox}>
                  <View style={styles.ashaPromptHeader}>
                    <AppIcon name="info" size={14} color="#166534" />
                    <Text style={styles.ashaPromptTitle}>ആശാ പ്രവർത്തക ചോദിക്കേണ്ട കാര്യങ്ങൾ:</Text>
                  </View>
                  <Text style={styles.ashaPromptText}>
                    "കഴിഞ്ഞ 2 ആഴ്ചയായി കാര്യങ്ങൾ ചെയ്യുന്നതിൽ താല്പര്യക്കുറവ് തോന്നിയിട്ടുണ്ടോ എന്നും, സങ്കടമോ നിരാശയോ അനുഭവപ്പെടാറുണ്ടോ എന്നും ചോദിക്കുക. സ്കോർ 3-ൽ കൂടുതലാണെങ്കിൽ മാനസികാരോഗ്യ കൗൺസിലിംഗിനായി CHO / MO-ലേക്ക് റഫർ ചെയ്യണം."
                  </Text>
                </View>

                {/* Live PHQ-2 Score Meter */}
                <View style={[
                  styles.partAScoreMeter,
                  record.partD.isReferredToChoMo ? styles.scoreMeterHigh : styles.scoreMeterNormal
                ]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.partAScoreLabel}>മാനസികാരോഗ്യ സ്കോർ (PHQ-2):</Text>
                    <Text style={styles.partAScoreVal}>
                      {record.partD.totalScore} <Text style={{ fontSize: 16, fontWeight: 'normal' }}>/ 6</Text>
                    </Text>
                  </View>
                  <View style={[
                    styles.scoreRiskPill,
                    record.partD.isReferredToChoMo ? styles.riskPillHigh : styles.riskPillNormal
                  ]}>
                    <Text style={styles.riskPillText}>
                      {record.partD.isReferredToChoMo ? 'കൗൺസിലിംഗ് റഫറൽ (>3)' : 'സാധാരണ നില (≤3)'}
                    </Text>
                  </View>
                </View>

                {/* PHQ Question 1 */}
                <View style={styles.questionCard}>
                  <View style={styles.qHeaderRow}>
                    <Text style={styles.qNumber}>1</Text>
                    <Text style={styles.qTitle}>കാര്യങ്ങൾ ചെയ്യുന്നതിൽ താല്പര്യക്കുറവ്:</Text>
                    <Text style={styles.qScoreBadge}>+{record.partD.littleInterestOrPleasure}</Text>
                  </View>
                  <View style={styles.choiceRowStacked}>
                    {[
                      { s: 0, l: 'ഒരിക്കലുമില്ല (0 പോയിന്റ്)' },
                      { s: 1, l: 'കുറച്ചു ദിവസങ്ങളിൽ (1 പോയിന്റ്)' },
                      { s: 2, l: 'പകുതിയിലധികം ദിവസങ്ങളിൽ (2 പോയിന്റ്)' },
                      { s: 3, l: 'മിക്കവാറും എല്ലാ ദിവസവും (3 പോയിന്റ്)' }
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.s}
                        style={[
                          styles.stackedChoiceBtn,
                          record.partD.littleInterestOrPleasure === item.s && styles.stackedChoiceBtnActive
                        ]}
                        onPress={() => {
                          record.partD.littleInterestOrPleasure = item.s as Phq2ScoreValue;
                          refreshScores(record);
                        }}
                      >
                        <Text style={[
                          styles.stackedChoiceText,
                          record.partD.littleInterestOrPleasure === item.s && styles.stackedChoiceTextActive
                        ]}>
                          {item.l}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* PHQ Question 2 */}
                <View style={styles.questionCard}>
                  <View style={styles.qHeaderRow}>
                    <Text style={styles.qNumber}>2</Text>
                    <Text style={styles.qTitle}>സങ്കടം, നിരാശ, വിഷാദം തോന്നുക:</Text>
                    <Text style={styles.qScoreBadge}>+{record.partD.feelingDownDepressedHopeless}</Text>
                  </View>
                  <View style={styles.choiceRowStacked}>
                    {[
                      { s: 0, l: 'ഒരിക്കലുമില്ല (0 പോയിന്റ്)' },
                      { s: 1, l: 'കുറച്ചു ദിവസങ്ങളിൽ (1 പോയിന്റ്)' },
                      { s: 2, l: 'പകുതിയിലധികം ദിവസങ്ങളിൽ (2 പോയിന്റ്)' },
                      { s: 3, l: 'മിക്കവാറും എല്ലാ ദിവസവും (3 പോയിന്റ്)' }
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.s}
                        style={[
                          styles.stackedChoiceBtn,
                          record.partD.feelingDownDepressedHopeless === item.s && styles.stackedChoiceBtnActive
                        ]}
                        onPress={() => {
                          record.partD.feelingDownDepressedHopeless = item.s as Phq2ScoreValue;
                          refreshScores(record);
                        }}
                      >
                        <Text style={[
                          styles.stackedChoiceText,
                          record.partD.feelingDownDepressedHopeless === item.s && styles.stackedChoiceTextActive
                        ]}>
                          {item.l}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* ======================================================================= */}
            {/* STEP 6: സി.പി.എച്ച്.സി അന്തിമ ഫോം */}
            {/* ======================================================================= */}
            {currentStep === 6 && (
              <View>
                {/* Overall Triage Banner Card */}
                <View
                  style={[
                    styles.triageBannerCard,
                    record.overallClassification === 'urgent_mo_referral'
                      ? styles.triageDanger
                      : record.overallClassification === 'phq2_referral'
                      ? styles.triagePhq
                      : record.partA.isHighRisk
                      ? styles.triageWarning
                      : styles.triageSafe
                  ]}
                >
                  <View style={styles.triageHeaderRow}>
                    <View style={styles.triageTitleGroup}>
                      <AppIcon
                        name={record.overallClassification === 'urgent_mo_referral' ? 'alert' : 'check'}
                        size={20}
                        color="#FFFFFF"
                      />
                      <Text style={styles.triageTitleText}>
                        {record.overallClassification === 'urgent_mo_referral'
                          ? 'അടിയന്തര ഡോക്ടർ റഫറൽ ആവശ്യമാണ്'
                          : record.overallClassification === 'phq2_referral'
                          ? 'മാനസികാരോഗ്യ കൗൺസിലിംഗ് റഫറൽ (PHQ-2 > 3)'
                          : record.partA.isHighRisk
                          ? 'ഉയർന്ന റിസ്ക് സ്കോർ (> 4)'
                          : 'സാധാരണ നില'}
                      </Text>
                    </View>
                    <View style={styles.triageScoreBadge}>
                      <Text style={styles.triageScoreBadgeText}>
                        റിസ്ക് സ്കോർ: {record.partA.totalScore}/10
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.triageAdviceMl}>{record.actionRecommendationsMl}</Text>
                </View>

                {/* Structured CPHC Record Cards Container */}
                <View style={styles.structuredRecordCard}>
                  {/* Demographics Card */}
                  <View style={styles.sectionBlock}>
                    <View style={styles.sectionHeaderRow}>
                      <AppIcon name="user" size={16} color="#047857" />
                      <Text style={styles.sectionBlockTitle}>ഗുണഭോക്താവിന്റെ വിവരങ്ങൾ</Text>
                    </View>
                    <View style={styles.demographicsGrid}>
                      <View style={styles.demographicItem}>
                        <Text style={styles.fieldLabelMuted}>പേര്:</Text>
                        <Text style={styles.fieldValueStrong}>{record.personalDetails.name || 'രേഖപ്പെടുത്തിയിട്ടില്ല'}</Text>
                      </View>
                      <View style={styles.demographicItem}>
                        <Text style={styles.fieldLabelMuted}>പ്രായം:</Text>
                        <Text style={styles.fieldValueStrong}>{record.personalDetails.age} വയസ്സ്</Text>
                      </View>
                      <View style={styles.demographicItem}>
                        <Text style={styles.fieldLabelMuted}>ലിംഗം:</Text>
                        <Text style={styles.fieldValueStrong}>{record.personalDetails.sex === 'female' ? 'സ്ത്രീ' : record.personalDetails.sex === 'male' ? 'പുരുഷൻ' : 'മറ്റുള്ളവർ'}</Text>
                      </View>
                      <View style={styles.demographicItem}>
                        <Text style={styles.fieldLabelMuted}>തിരിച്ചറിയൽ നമ്പർ:</Text>
                        <Text style={styles.fieldValueStrong}>{record.personalDetails.identifier || 'ലഭ്യമല്ല'}</Text>
                      </View>
                      <View style={styles.demographicItem}>
                        <Text style={styles.fieldLabelMuted}>ഫോൺ നമ്പർ:</Text>
                        <Text style={styles.fieldValueStrong}>{record.personalDetails.telephone || 'ലഭ്യമല്ല'}</Text>
                      </View>
                      <View style={styles.demographicItem}>
                        <Text style={styles.fieldLabelMuted}>വാർഡ് / കേന്ദ്രം:</Text>
                        <Text style={styles.fieldValueStrong}>{record.generalInfo.villageWard || 'വാർഡ് 4'}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Part A Risk Factor Breakdown Table */}
                  <View style={styles.sectionBlock}>
                    <View style={styles.sectionHeaderRow}>
                      <AppIcon name="lifestyle" size={16} color="#047857" />
                      <Text style={styles.sectionBlockTitle}>ഭാഗം A: റിസ്ക് സ്കോർ വിശദാംശങ്ങൾ</Text>
                    </View>
                    <View style={styles.breakdownTable}>
                      <View style={styles.tableRow}>
                        <Text style={styles.tableColQuestion}>1. പ്രായം ({record.personalDetails.age} വയസ്സ്)</Text>
                        <Text style={styles.tableColScore}>+{record.partA.ageScore}</Text>
                      </View>
                      <View style={styles.tableRow}>
                        <Text style={styles.tableColQuestion}>2. പുകയില / മുറുക്ക് ഉപയോഗം</Text>
                        <Text style={styles.tableColScore}>+{record.partA.tobaccoScore}</Text>
                      </View>
                      <View style={styles.tableRow}>
                        <Text style={styles.tableColQuestion}>3. ദിവസേനയുള്ള മദ്യപാനം</Text>
                        <Text style={styles.tableColScore}>+{record.partA.alcoholScore}</Text>
                      </View>
                      <View style={styles.tableRow}>
                        <Text style={styles.tableColQuestion}>4. അരക്കെട്ടിന്റെ അളവ്</Text>
                        <Text style={styles.tableColScore}>+{record.partA.waistScore}</Text>
                      </View>
                      <View style={styles.tableRow}>
                        <Text style={styles.tableColQuestion}>5. ആഴ്ചയിൽ 150 മിനിറ്റ് വ്യായാമം</Text>
                        <Text style={styles.tableColScore}>+{record.partA.physicalActivityScore}</Text>
                      </View>
                      <View style={styles.tableRow}>
                        <Text style={styles.tableColQuestion}>6. കുടുംബത്തിൽ ഷുഗർ/ബിപി ചരിത്രം</Text>
                        <Text style={styles.tableColScore}>+{record.partA.familyHistoryScore}</Text>
                      </View>
                      <View style={[styles.tableRow, styles.tableTotalRow]}>
                        <Text style={styles.tableTotalText}>ആകെ CBAC റിസ്ക് സ്കോർ:</Text>
                        <Text style={[styles.tableTotalScore, record.partA.isHighRisk ? styles.textHighRisk : styles.textNormal]}>
                          {record.partA.totalScore} / 10
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Part B Warning Signs Alert Box */}
                  <View style={styles.sectionBlock}>
                    <View style={styles.sectionHeaderRow}>
                      <AppIcon name="alert" size={16} color={record.partB.hasAnyWarningSign ? '#DC2626' : '#047857'} />
                      <Text style={styles.sectionBlockTitle}>ഭാഗം B: പ്രാരംഭ അപായ ലക്ഷണങ്ങൾ</Text>
                    </View>
                    {record.partB.hasAnyWarningSign ? (
                      <View style={styles.warningAlertBox}>
                        <Text style={styles.warningAlertHeading}>ശ്രദ്ധയിൽപ്പെട്ട അപകട ലക്ഷണങ്ങൾ:</Text>
                        {Object.entries(record.partB.general)
                          .filter(([_, v]) => v)
                          .map(([k]) => (
                            <Text key={k} style={styles.warningItemText}>• പൊതുവായ ലക്ഷണം: {k}</Text>
                          ))}
                        {Object.entries(record.partB.womenOnly)
                          .filter(([_, v]) => v)
                          .map(([k]) => (
                            <Text key={k} style={styles.warningItemText}>• സ്ത്രീകളുടെ ലക്ഷണം: {k}</Text>
                          ))}
                        {Object.entries(record.partB.elderlySpecific)
                          .filter(([_, v]) => v)
                          .map(([k]) => (
                            <Text key={k} style={styles.warningItemText}>• വയോജന ലക്ഷണം: {k}</Text>
                          ))}
                      </View>
                    ) : (
                      <Text style={styles.noWarningText}>പ്രാരംഭ അപായ ലക്ഷണങ്ങൾ ഒന്നും കണ്ടെത്തിയിട്ടില്ല.</Text>
                    )}
                  </View>

                  {/* Part C & D Overview */}
                  <View style={styles.sectionBlock}>
                    <View style={styles.sectionHeaderRow}>
                      <AppIcon name="stethoscope" size={16} color="#047857" />
                      <Text style={styles.sectionBlockTitle}>ഭാഗം C & D: ശ്വാസകോശവും മാനസികാരോഗ്യവും</Text>
                    </View>
                    <View style={styles.compactStatsGrid}>
                      <View style={styles.statBox}>
                        <Text style={styles.statLabel}>പാചക ഇന്ധനം</Text>
                        <Text style={styles.statValue}>{record.partC.cookingFuels.join(', ') || 'ലഭ്യമല്ല'}</Text>
                      </View>
                      <View style={styles.statBox}>
                        <Text style={styles.statLabel}>ജോലിസ്ഥല പുക</Text>
                        <Text style={styles.statValue}>{record.partC.occupationalExposures.join(', ')}</Text>
                      </View>
                      <View style={styles.statBox}>
                        <Text style={styles.statLabel}>PHQ-2 സ്കോർ</Text>
                        <Text style={[styles.statValue, record.partD.isReferredToChoMo ? styles.textHighRisk : styles.textNormal]}>
                          {record.partD.totalScore} / 6
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Save Feedback message */}
                {saveSuccessMsg && (
                  <View style={styles.saveAlertNotification}>
                    <AppIcon name="check" size={16} color="#065F46" />
                    <Text style={styles.saveAlertNotificationText}>{saveSuccessMsg}</Text>
                  </View>
                )}

                {/* Action Buttons Row */}
                <View style={styles.step6ActionsRow}>
                  <TouchableOpacity
                    style={styles.primarySaveBtn}
                    onPress={handleSaveSurvey}
                    disabled={isSaving}
                    activeOpacity={0.85}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <AppIcon name="save" size={18} color="#FFFFFF" />
                        <Text style={styles.primarySaveBtnText}>
                          പ്രൊഫൈലിലേക്ക് സേവ് ചെയ്യുക
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <View style={styles.secondaryActionRow}>
                    <TouchableOpacity
                      style={styles.viewJsonSecondaryBtn}
                      onPress={() => {
                        setActiveJsonRecord(record);
                        setShowJsonModal(true);
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <AppIcon name="document" size={14} color="#334155" />
                        <Text style={styles.viewJsonSecondaryText}>JSON കാണുക</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.startNewSecondaryBtn}
                      onPress={handleResetNewSurvey}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <AppIcon name="refresh" size={14} color="#334155" />
                        <Text style={styles.startNewSecondaryText}>പുതിയ സർവേ</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* AI Longitudinal Summary Card at End of CBAC Checklist */}
            <View style={{ marginTop: 14 }}>
              <AiReportSummaryCard
                title="CBAC NCD AI റിപ്പോർട്ട് സംഗ്രഹം"
                subtitle={`${record.personalDetails.name || 'ഗുണഭോക്താവ്'} • ${historicalSurveysCount > 0 ? `${historicalSurveysCount} മുൻകാല സർവേകൾ` : 'പ്രാഥമിക സർവേ'}`}
                summaryText={aiSummary || 'CBAC വിവരങ്ങൾ വിശകലനം ചെയ്യുന്നു...'}
                isLoading={isLoadingAiSummary}
                recordCount={historicalSurveysCount}
                onRefresh={() => loadAiSummaryForPerson(record.beneficiaryId, record.personalDetails.name)}
                badgeColor="#059669"
              />
            </View>
          </ScrollView>

          {/* Sticky Bottom Wizard Navigation Bar */}
          <View style={styles.wizardFooterNav}>
            <TouchableOpacity
              style={[styles.wizardNavBtn, currentStep === 1 && styles.wizardNavBtnDisabled]}
              onPress={goToPrevStep}
              disabled={currentStep === 1}
              activeOpacity={0.8}
            >
              <Text style={[styles.wizardNavBtnText, currentStep === 1 && styles.wizardNavBtnTextDisabled]}>
                മുമ്പത്തെ ഘട്ടം
              </Text>
            </TouchableOpacity>

            <View style={styles.wizardStepIndicatorTextGroup}>
              <Text style={styles.wizardStepProgressText}>
                ഘട്ടം {currentStep} / 6
              </Text>
              <Text style={styles.wizardStepProgressName} numberOfLines={1}>
                {WIZARD_STEPS[currentStep - 1].shortLabel}
              </Text>
            </View>

            {currentStep < 6 ? (
              <TouchableOpacity
                style={styles.wizardNavBtnPrimary}
                onPress={goToNextStep}
                activeOpacity={0.8}
              >
                <Text style={styles.wizardNavBtnPrimaryText}>
                  {currentStep === 5 ? 'അവലോകനം' : 'അടുത്ത ഘട്ടം'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.wizardNavBtnPrimary}
                onPress={handleSaveSurvey}
                disabled={isSaving}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <AppIcon name="save" size={14} color="#FFFFFF" />
                  <Text style={styles.wizardNavBtnPrimaryText}>
                    {isSaving ? 'സേവ് ചെയ്യുന്നു...' : 'സേവ് ചെയ്യുക'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

      {/* JSON Schema Viewer Modal */}
      <Modal
        visible={showJsonModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowJsonModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Official CBAC JSON Record</Text>
              <Text style={styles.modalSubtitle}>
                {activeJsonRecord?.personalDetails.name} ({activeJsonRecord?.surveyId})
              </Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowJsonModal(false)}>
              <Text style={styles.modalCloseBtnText}>✕ Close</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.modalJsonInput}
            multiline
            editable={false}
            selectTextOnFocus
            value={activeJsonRecord ? JSON.stringify(activeJsonRecord, null, 2) : ''}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  headerBlock: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  backBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9'
  },
  backBtnText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: 'bold'
  },

  // Wizard Step Tracker
  wizardTrackerContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 8
  },
  stepScroll: {
    paddingHorizontal: 12,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center'
  },
  stepPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  stepPillActive: {
    backgroundColor: '#047857',
    borderColor: '#047857'
  },
  stepPillPassed: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0'
  },
  stepNumberCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepNumberCircleActive: {
    backgroundColor: '#FFFFFF'
  },
  stepNumberCirclePassed: {
    backgroundColor: '#059669'
  },
  stepNumberText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569'
  },
  stepNumberTextActive: {
    color: '#047857'
  },
  stepNumberTextPassed: {
    color: '#FFFFFF'
  },
  stepPillLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600'
  },
  stepPillLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  stepPillLabelPassed: {
    color: '#065F46',
    fontWeight: '600'
  },

  // Persistent Floating Voice Assistant Card (Highlighted)
  voiceAssistantCard: {
    backgroundColor: '#F0FDF4',
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 6,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#059669',
    elevation: 3,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(5,150,105,0.15)'
      }
    })
  },
  voiceAssistantCardPinned: {
    marginHorizontal: 0,
    marginTop: 0,
    borderRadius: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 1.5,
    borderBottomColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  compactStepBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10
  },
  compactStepBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700'
  },
  collapseToggleBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  voiceAssistantTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  micIconPill: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  micIconPillRecording: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA'
  },
  voiceCardHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A'
  },
  voiceCardSub: {
    fontSize: 10,
    color: '#64748B'
  },
  recordingTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  pulsingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#DC2626'
  },
  recordingTimeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626'
  },
  audioActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  audioActionBtnRecord: {
    backgroundColor: '#047857'
  },
  audioActionBtnStop: {
    backgroundColor: '#DC2626'
  },
  audioActionBtnProcessing: {
    backgroundColor: '#64748B'
  },
  audioActionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700'
  },
  transcriptSnippetBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  transcriptSnippetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  transcriptSnippetTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569'
  },
  reanalyzeSmallBtn: {
    backgroundColor: '#047857',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  reanalyzeSmallBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700'
  },
  transcriptSnippetInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    padding: 6,
    fontSize: 11,
    color: '#1E293B',
    maxHeight: 60
  },

  // Main Wizard Content Area
  wizardContentScroll: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 90
  },
  stepTitleBanner: {
    marginBottom: 10
  },
  stepCounterText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  stepMainTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1
  },
  stepSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1
  },

  // ASHA Prompt Guidance Card
  ashaPromptBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12
  },
  ashaPromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4
  },
  ashaPromptIcon: {
    fontSize: 14
  },
  ashaPromptTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534'
  },
  ashaPromptText: {
    fontSize: 11,
    color: '#14532D',
    lineHeight: 16
  },

  // General Step Card
  stepCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1
  },
  cardSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10
  },
  inputRow: {
    marginBottom: 10
  },
  grid2Row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10
  },
  inputCol: {
    flex: 1
  },
  inputLabel: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
    marginBottom: 4
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: '#0F172A'
  },
  genderRow: {
    flexDirection: 'row',
    gap: 4
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center'
  },
  genderBtnActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669'
  },
  genderBtnText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600'
  },
  genderBtnTextActive: {
    color: '#047857',
    fontWeight: '700'
  },

  // Part A Score Meter
  partAScoreMeter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1
  },
  scoreMeterNormal: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0'
  },
  scoreMeterHigh: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA'
  },
  partAScoreLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569'
  },
  partAScoreVal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A'
  },
  scoreRiskPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14
  },
  riskPillNormal: {
    backgroundColor: '#D1FAE5'
  },
  riskPillHigh: {
    backgroundColor: '#FEE2E2'
  },
  riskPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A'
  },

  // Question Cards
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  qHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8
  },
  qNumber: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#047857',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 18
  },
  qTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B'
  },
  qScoreBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  choiceOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  choiceOptionBtn: {
    flex: 1,
    minWidth: '18%',
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center'
  },
  choiceOptionBtnActive: {
    backgroundColor: '#047857',
    borderColor: '#047857'
  },
  choiceOptionText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600'
  },
  choiceOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  choiceRowStacked: {
    gap: 6
  },
  stackedChoiceBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC'
  },
  stackedChoiceBtnActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669'
  },
  stackedChoiceText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500'
  },
  stackedChoiceTextActive: {
    color: '#065F46',
    fontWeight: '700'
  },

  // Checkbox Rows (Part B & C)
  warningStatusBanner: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1
  },
  warningBannerActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5'
  },
  warningBannerClear: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0'
  },
  warningBannerTitle: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    color: '#0F172A'
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 4
  },
  checkboxRowActive: {
    backgroundColor: '#FEF2F2'
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxBoxActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626'
  },
  checkboxCheckMark: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold'
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12,
    color: '#334155'
  },
  checkboxLabelActive: {
    color: '#991B1B',
    fontWeight: '600'
  },

  // Step 6: Structured CPHC Representation (Survey Redesign Style)
  triageBannerCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 3
  },
  triageDanger: {
    backgroundColor: '#991B1B'
  },
  triageWarning: {
    backgroundColor: '#C2410C'
  },
  triagePhq: {
    backgroundColor: '#6D28D9'
  },
  triageSafe: {
    backgroundColor: '#047857'
  },
  triageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  triageTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1
  },
  triageTitleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    flex: 1
  },
  triageScoreBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10
  },
  triageScoreBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700'
  },
  triageAdviceMl: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    lineHeight: 16
  },
  triageAdviceEn: {
    fontSize: 10,
    color: '#E2E8F0',
    marginTop: 2,
    fontStyle: 'italic'
  },

  // Structured Record Card
  structuredRecordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  sectionBlock: {
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8
  },
  sectionBlockTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A'
  },
  demographicsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  demographicItem: {
    width: '48%'
  },
  fieldLabelMuted: {
    fontSize: 10,
    color: '#64748B'
  },
  fieldValueStrong: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A'
  },

  // Breakdown Table
  breakdownTable: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  tableColQuestion: {
    fontSize: 11,
    color: '#334155'
  },
  tableColScore: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857'
  },
  tableTotalRow: {
    borderBottomWidth: 0,
    paddingTop: 6
  },
  tableTotalText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A'
  },
  tableTotalScore: {
    fontSize: 13,
    fontWeight: '800'
  },
  textHighRisk: {
    color: '#DC2626'
  },
  textNormal: {
    color: '#059669'
  },

  // Warning Alerts & Stats
  warningAlertBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  warningAlertHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 4
  },
  warningItemText: {
    fontSize: 11,
    color: '#7F1D1D',
    marginBottom: 2
  },
  noWarningText: {
    fontSize: 11,
    color: '#059669',
    fontStyle: 'italic'
  },
  compactStatsGrid: {
    flexDirection: 'row',
    gap: 8
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  statLabel: {
    fontSize: 9,
    color: '#64748B'
  },
  statValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2
  },

  // Step 6 Actions
  saveAlertNotification: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D1FAE5',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10
  },
  saveAlertNotificationText: {
    fontSize: 11,
    color: '#065F46',
    fontWeight: '700'
  },
  step6ActionsRow: {
    gap: 8,
    marginTop: 4
  },
  primarySaveBtn: {
    backgroundColor: '#047857',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2
  },
  primarySaveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  secondaryActionRow: {
    flexDirection: 'row',
    gap: 8
  },
  viewJsonSecondaryBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  viewJsonSecondaryText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700'
  },
  startNewSecondaryBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  startNewSecondaryText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700'
  },

  // Sticky Bottom Wizard Nav
  wizardFooterNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 6,
    ...Platform.select({
      web: {
        boxShadow: '0 -2px 8px rgba(0,0,0,0.06)'
      }
    })
  },
  wizardNavBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  wizardNavBtnDisabled: {
    opacity: 0.4
  },
  wizardNavBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155'
  },
  wizardNavBtnTextDisabled: {
    color: '#94A3B8'
  },
  wizardStepIndicatorTextGroup: {
    alignItems: 'center'
  },
  wizardStepProgressText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857'
  },
  wizardStepProgressName: {
    fontSize: 9,
    color: '#64748B',
    maxWidth: 90
  },
  wizardNavBtnPrimary: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#047857'
  },
  wizardNavBtnPrimaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF'
  },

  // Profiles Tab Styles
  profilesContentScroll: {
    padding: 14,
    paddingBottom: 40
  },
  profilesHeaderRow: {
    marginBottom: 10
  },
  viewHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A'
  },
  viewSubHeading: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 10
  },
  searchInput: {
    flex: 1,
    height: 38,
    fontSize: 12,
    color: '#1E293B'
  },
  filterChipScroll: {
    marginBottom: 10
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  filterChipActive: {
    backgroundColor: '#047857',
    borderColor: '#047857'
  },
  filterChipText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600'
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  filteredCountText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 6
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  emptyText: {
    fontSize: 12,
    color: '#94A3B8'
  },
  filterResultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  resultCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  resultName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A'
  },
  resultMeta: {
    fontSize: 10,
    color: '#64748B'
  },
  resultScoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10
  },
  meterWarning: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  meterSafe: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  resultScoreText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A'
  },
  resultNote: {
    fontSize: 11,
    color: '#475569',
    marginBottom: 8
  },
  resultActions: {
    flexDirection: 'row',
    gap: 8
  },
  openProfileBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  openProfileBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155'
  },
  newVisitBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#047857',
    alignItems: 'center'
  },
  newVisitBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF'
  },

  // Longitudinal History
  longitudinalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginTop: 6
  },
  profileSummaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  profileBigName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A'
  },
  profileMetaText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1
  },
  trendBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'flex-end'
  },
  trendBadgeImproved: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0'
  },
  trendBadgeWorsened: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA'
  },
  trendBadgeStable: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0'
  },
  trendBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F172A'
  },
  trendSubScore: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 1
  },
  newSurveyBtn: {
    backgroundColor: '#047857',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 12
  },
  newSurveyBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700'
  },
  timelineSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10
  },
  timelineItemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#047857',
    marginTop: 5
  },
  timelineItemCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  timelineTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  timelineDate: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700'
  },
  timelineScoreBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  timelineScoreText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F172A'
  },
  timelineDescMl: {
    fontSize: 11,
    color: '#334155',
    marginBottom: 4
  },
  timelineDetails: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 6
  },
  timelineActions: {
    flexDirection: 'row'
  },
  timelineViewBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0'
  },
  timelineViewBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#334155'
  },

  // Modal
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#1E293B'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#0F172A'
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold'
  },
  modalSubtitle: {
    color: '#94A3B8',
    fontSize: 11
  },
  modalCloseBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  modalCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold'
  },
  modalJsonInput: {
    flex: 1,
    padding: 12,
    color: '#38BDF8',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', web: 'monospace' }),
    fontSize: 11,
    textAlignVertical: 'top'
  }
});
