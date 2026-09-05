import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Modal,
  ActivityIndicator
} from 'react-native';
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

interface NcdLifestyleScreenProps {
  onBack?: () => void;
}

type MainViewTab = 'voice_survey' | 'profiles_progress' | 'filter_scores';

export const NcdLifestyleScreen: React.FC<NcdLifestyleScreenProps> = ({ onBack }) => {
  const [activeView, setActiveView] = useState<'survey' | 'profiles'>('survey');

  // Voice Interaction State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [isProcessingVoice, setIsProcessingVoice] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [voiceStatusMsg, setVoiceStatusMsg] = useState<string>('തയ്യാറാണ് (Ready to record speech)');
  const timerRef = useRef<any>(null);

  // Active Questionnaire Record State
  const [record, setRecord] = useState<CbacOfficialRecord>(createDefaultCbacRecord());
  const [showPartBExpanded, setShowPartBExpanded] = useState<boolean>(true);
  const [showPartCExpanded, setShowPartCExpanded] = useState<boolean>(true);
  const [showPartDExpanded, setShowPartDExpanded] = useState<boolean>(true);

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

  // Recalculate Part A Score whenever relevant fields change
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

  // 1. Voice Recording & Speech Extraction Handler
  const handleToggleVoiceRecording = async () => {
    if (!isRecording) {
      // START RECORDING
      const hasPermission = await audioRecorder.requestPermission();
      if (!hasPermission) {
        setVoiceStatusMsg('മൈക്രോഫോൺ അനുമതി ആവശ്യമാണ് (Microphone permission denied)');
        return;
      }

      try {
        await audioRecorder.startRecording();
        setIsRecording(true);
        setRecordingDuration(0);
        setVoiceStatusMsg('🎙️ തത്സമയം ശബ്ദം റെക്കോർഡ് ചെയ്യുന്നു... സംസാരിക്കുക');

        timerRef.current = setInterval(() => {
          setRecordingDuration((sec) => sec + 1);
        }, 1000);
      } catch (err: any) {
        setVoiceStatusMsg(`Error: ${err.message}`);
      }
    } else {
      // STOP RECORDING & EXTRACT
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setIsRecording(false);
      setIsProcessingVoice(true);
      setVoiceStatusMsg('Sarvam AI ശബ്ദരേഖ തയ്യാറാക്കുന്നു...');

      try {
        const audio = await audioRecorder.stopRecording();
        const asrResult = await transcribeWithIndicConformer(audio, 'ml');
        const capturedText = asrResult.transcript || '';
        setTranscript(capturedText);

        // Auto-extract and populate CBAC checklist from transcript
        const autoExtracted = extractCbacFromTranscript(capturedText, record);
        refreshScores(autoExtracted);
        setVoiceStatusMsg('✓ Sarvam AI ശബ്ദരേഖയിൽ നിന്ന് CBAC ചോദ്യാവലി സ്വയമേവ പൂരിപ്പിച്ചു!');
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
    setVoiceStatusMsg('✓ തിരുത്തിയ ശബ്ദരേഖയിൽ നിന്ന് ഫോം അപ്ഡേറ്റ് ചെയ്തു!');
  };

  // 2. Save Survey to Beneficiary Profile (Supports multiple visits per person)
  const handleSaveSurvey = async () => {
    setIsSaving(true);
    setSaveSuccessMsg('വ്യക്തിഗത പ്രൊഫൈലിലേക്ക് സേവ് ചെയ്യുന്നു...');
    try {
      const updatedProfile = await saveSurveyToProfile(record);
      setSelectedProfile(updatedProfile);
      await loadAllProfiles();
      setSaveSuccessMsg(`✓ സേവ് ചെയ്തു! (${record.personalDetails.name} - സ്കോർ: ${record.partA.totalScore}/10)`);
    } catch (err: any) {
      setSaveSuccessMsg(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
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
    setActiveView('survey');
    setVoiceStatusMsg(`പുതിയ സർവേ ആരംഭിച്ചു (${profile.name})`);
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Module White Header Block */}
      <View style={styles.headerBlock}>
        <Text style={styles.title}>CBAC / CABC സർവേ</Text>
        <Text style={styles.subtitle}>
          കമ്മ്യൂണിറ്റി ബേസ്ഡ് അസസ്സ്മെന്റ് ചെക്ക്‌ലിസ്റ്റ് (NCD & Cancer Early Screening)
        </Text>
        <View style={styles.headerButtonRow}>
          <TouchableOpacity
            style={styles.visitProfilesBtn}
            onPress={() => setActiveView(activeView === 'survey' ? 'profiles' : 'survey')}
          >
            <Text style={styles.visitProfilesBtnText}>
              {activeView === 'survey'
                ? 'പ്രൊഫൈലുകൾ സന്ദർശിക്കുക (Visit Profiles)'
                : '📋 സർവേ ഫോം (Survey Form)'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* VIEW 1: VOICE SURVEY & AUTO-FILLED FORM */}
      {activeView === 'survey' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Voice Recording Studio Card */}
          <View style={styles.voiceStudioCard}>
            <View style={styles.voiceStudioTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.voiceStudioTitle}>🎙️ ശബ്ദരേഖ വഴി സർവേ പൂരിപ്പിക്കുക</Text>
                <Text style={styles.voiceStudioDesc}>
                  രോഗിയുടെ വിവരങ്ങൾ, പുകവലി/മദ്യപാനം, അരക്കെട്ട്, വ്യായാമം, ലക്ഷണങ്ങൾ എന്നിവ സംസാരിക്കുക.
                </Text>
              </View>
              {isRecording && (
                <View style={styles.recordingPill}>
                  <View style={styles.pulsingDot} />
                  <Text style={styles.recordingTimerText}>{formatTimer(recordingDuration)}</Text>
                </View>
              )}
            </View>

            {/* Central Mic Record Button */}
            <TouchableOpacity
              style={[
                styles.voiceStudioBtn,
                isRecording ? styles.voiceStudioBtnActive : styles.voiceStudioBtnIdle,
                isProcessingVoice && styles.voiceStudioBtnProcessing
              ]}
              onPress={handleToggleVoiceRecording}
              disabled={isProcessingVoice}
            >
              {isProcessingVoice ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexShrink: 1 }}>
                  <Text style={{ fontSize: 20 }}>{isRecording ? '⏹' : '🎙️'}</Text>
                  <Text style={styles.voiceStudioBtnText}>
                    {isRecording
                      ? 'നിർത്തുക\n(Stop & Auto-Fill Form)'
                      : 'സംസാരിക്കാൻ ആരംഭിക്കുക\n(Record Speech)'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.voiceStatusText}>{voiceStatusMsg}</Text>

            {/* Editable Transcript Area */}
            {transcript ? (
              <View style={styles.transcriptCard}>
                <View style={styles.transcriptHeaderRow}>
                  <Text style={styles.transcriptLabel}>ലഭിച്ച ശബ്ദരേഖ (Transcript):</Text>
                  <TouchableOpacity
                    style={styles.reanalyzeBtn}
                    onPress={handleReanalyzeTranscript}
                  >
                    <Text style={styles.reanalyzeBtnText}>🔄 Re-Analyze Form</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.transcriptInput}
                  multiline
                  value={transcript}
                  onChangeText={setTranscript}
                  placeholder="Tap here to edit words if needed..."
                />
              </View>
            ) : null}
          </View>

          {/* Real-time Triage Score Meter Card */}
          <View
            style={[
              styles.meterCard,
              record.overallClassification === 'urgent_mo_referral'
                ? styles.meterDanger
                : record.partA.isHighRisk
                ? styles.meterWarning
                : styles.meterSafe
            ]}
          >
            <View style={styles.meterHeader}>
              <View>
                <Text style={styles.meterScoreBig}>
                  {record.partA.totalScore} <Text style={{ fontSize: 16, fontWeight: 'normal' }}>/ 10</Text>
                </Text>
                <Text style={styles.meterScoreLabel}>Part A CBAC റിസ്ക് സ്കോർ</Text>
              </View>
            </View>
            <Text style={styles.meterNoteMl}>{record.actionRecommendationsMl}</Text>
            <Text style={styles.meterNoteEn}>{record.actionRecommendationsEn}</Text>
          </View>

          {/* --- GENERAL INFORMATION --- */}
          <View style={styles.formCard}>
            <Text style={styles.cardHeading}>📋 ജനറൽ വിവരങ്ങൾ (General Information)</Text>
            <View style={styles.grid2}>
              <View style={styles.fieldCol}>
                <Text style={styles.fieldLabel}>തീയതി (Date):</Text>
                <TextInput
                  style={styles.inputBox}
                  value={record.generalInfo.date}
                  onChangeText={(v) => {
                    record.generalInfo.date = v;
                    setRecord({ ...record });
                  }}
                />
              </View>
              <View style={styles.fieldCol}>
                <Text style={styles.fieldLabel}>ASHA പേര് (Name of ASHA):</Text>
                <TextInput
                  style={styles.inputBox}
                  value={record.generalInfo.nameOfAsha}
                  onChangeText={(v) => {
                    record.generalInfo.nameOfAsha = v;
                    setRecord({ ...record });
                  }}
                />
              </View>
            </View>

            <View style={[styles.grid2, { marginTop: 8 }]}>
              <View style={styles.fieldCol}>
                <Text style={styles.fieldLabel}>വാർഡ്/ഗ്രാമം (Village/Ward):</Text>
                <TextInput
                  style={styles.inputBox}
                  value={record.generalInfo.villageWard}
                  onChangeText={(v) => {
                    record.generalInfo.villageWard = v;
                    setRecord({ ...record });
                  }}
                />
              </View>
              <View style={styles.fieldCol}>
                <Text style={styles.fieldLabel}>സബ് സെന്റർ / PHC:</Text>
                <TextInput
                  style={styles.inputBox}
                  value={record.generalInfo.phcUphc}
                  onChangeText={(v) => {
                    record.generalInfo.phcUphc = v;
                    setRecord({ ...record });
                  }}
                />
              </View>
            </View>
          </View>

          {/* --- PERSONAL DETAILS --- */}
          <View style={styles.formCard}>
            <Text style={styles.cardHeading}>👤 വ്യക്തിഗത വിവരങ്ങൾ (Personal Details)</Text>
            <View style={styles.grid3}>
              <View style={[styles.fieldCol, { flex: 2 }]}>
                <Text style={styles.fieldLabel}>പേര് (Name):</Text>
                <TextInput
                  style={styles.inputBox}
                  value={record.personalDetails.name}
                  onChangeText={(v) => {
                    record.personalDetails.name = v;
                    setRecord({ ...record });
                  }}
                />
              </View>
              <View style={[styles.fieldCol, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>പ്രായം (Age):</Text>
                <TextInput
                  style={styles.inputBox}
                  value={record.personalDetails.age.toString()}
                  keyboardType="numeric"
                  onChangeText={(v) => {
                    const parsed = parseInt(v, 10) || 0;
                    record.personalDetails.age = parsed;
                    if (parsed < 30) record.partA.ageScore = 0;
                    else if (parsed <= 39) record.partA.ageScore = 1;
                    else if (parsed <= 49) record.partA.ageScore = 2;
                    else if (parsed <= 59) record.partA.ageScore = 3;
                    else record.partA.ageScore = 4;
                    refreshScores(record);
                  }}
                />
              </View>
            </View>

            {/* Sex Selector */}
            <Text style={[styles.fieldLabel, { marginTop: 8 }]}>ലിംഗം (Sex):</Text>
            <View style={styles.btnChoiceRow}>
              {(['female', 'male', 'other'] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.choiceBtn, record.personalDetails.sex === s && styles.choiceBtnActive]}
                  onPress={() => {
                    record.personalDetails.sex = s;
                    refreshScores(record);
                  }}
                >
                  <Text style={[styles.choiceBtnText, record.personalDetails.sex === s && styles.choiceBtnTextActive]}>
                    {s === 'female' ? 'സ്ത്രീ (Female)' : s === 'male' ? 'പുരുഷൻ (Male)' : 'Other'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.grid2, { marginTop: 8 }]}>
              <View style={styles.fieldCol}>
                <Text style={styles.fieldLabel}>തിരിച്ചറിയൽ രേഖ (Aadhaar/UID):</Text>
                <TextInput
                  style={styles.inputBox}
                  value={record.personalDetails.identifier}
                  onChangeText={(v) => {
                    record.personalDetails.identifier = v;
                    setRecord({ ...record });
                  }}
                />
              </View>
              <View style={styles.fieldCol}>
                <Text style={styles.fieldLabel}>ഫോൺ നമ്പർ (Telephone):</Text>
                <TextInput
                  style={styles.inputBox}
                  value={record.personalDetails.telephone}
                  keyboardType="phone-pad"
                  onChangeText={(v) => {
                    record.personalDetails.telephone = v;
                    setRecord({ ...record });
                  }}
                />
              </View>
            </View>
          </View>

          {/* --- PART A: RISK ASSESSMENT --- */}
          <View style={styles.formCard}>
            <Text style={styles.cardHeading}>ഭാഗം A: റിസ്ക് അസസ്സ്മെന്റ് (Part A: Risk Assessment)</Text>
            <Text style={styles.subtextNotice}>
              സ്കോർ 4-ൽ കൂടുതലാണെങ്കിൽ വ്യക്തിക്ക് NCD മുൻഗണനാ പരിശോധന ഉറപ്പാക്കണം.
            </Text>

            {/* 1. Age Score */}
            <View style={styles.qBox}>
              <Text style={styles.qTitle}>
                1. താങ്കളുടെ പ്രായം എത്രയാണ്? (What is your age?):{' '}
                <Text style={styles.ptsText}>+{record.partA.ageScore} pts</Text>
              </Text>
              <View style={styles.btnChoiceRow}>
                {[
                  { score: 0, label: '≤ 29 (0)' },
                  { score: 1, label: '30-39 (1)' },
                  { score: 2, label: '40-49 (2)' },
                  { score: 3, label: '50-59 (3)' },
                  { score: 4, label: '≥ 60 (4)' }
                ].map((item) => (
                  <TouchableOpacity
                    key={item.score}
                    style={[styles.smallBtn, record.partA.ageScore === item.score && styles.choiceBtnActive]}
                    onPress={() => {
                      record.partA.ageScore = item.score as CbacPartAAge;
                      refreshScores(record);
                    }}
                  >
                    <Text style={[styles.smallBtnText, record.partA.ageScore === item.score && styles.choiceBtnTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 2. Tobacco */}
            <View style={styles.qBox}>
              <Text style={styles.qTitle}>
                2. പുകവലിക്കുകയോ മുറുക്കുകയോ (Gutka/Khaini) ചെയ്യാറുണ്ടോ?:{' '}
                <Text style={styles.ptsText}>+{record.partA.tobaccoScore} pts</Text>
              </Text>
              <View style={styles.btnChoiceRow}>
                {[
                  { score: 0, label: 'ഒരിക്കലുമില്ല (Never: 0)' },
                  { score: 1, label: 'മുൻപ്/ഇടയ്ക്ക് (Past: 1)' },
                  { score: 2, label: 'ദിവസവും (Daily: 2)' }
                ].map((item) => (
                  <TouchableOpacity
                    key={item.score}
                    style={[styles.choiceBtn, record.partA.tobaccoScore === item.score && styles.choiceBtnActive]}
                    onPress={() => {
                      record.partA.tobaccoScore = item.score as CbacPartATobacco;
                      refreshScores(record);
                    }}
                  >
                    <Text style={[styles.choiceBtnText, record.partA.tobaccoScore === item.score && styles.choiceBtnTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 3. Alcohol */}
            <View style={styles.qBox}>
              <Text style={styles.qTitle}>
                3. ദിവസവും മദ്യം കഴിക്കാറുണ്ടോ? (Alcohol daily?):{' '}
                <Text style={styles.ptsText}>+{record.partA.alcoholScore} pts</Text>
              </Text>
              <View style={styles.btnChoiceRow}>
                {[
                  { score: 0, label: 'ഇല്ല (No: 0)' },
                  { score: 1, label: 'ഉണ്ട് (Yes: 1)' }
                ].map((item) => (
                  <TouchableOpacity
                    key={item.score}
                    style={[styles.choiceBtn, record.partA.alcoholScore === item.score && styles.choiceBtnActive]}
                    onPress={() => {
                      record.partA.alcoholScore = item.score as CbacPartAAlcohol;
                      refreshScores(record);
                    }}
                  >
                    <Text style={[styles.choiceBtnText, record.partA.alcoholScore === item.score && styles.choiceBtnTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 4. Waist Circumference */}
            <View style={styles.qBox}>
              <Text style={styles.qTitle}>
                4. അരക്കെട്ടിന്റെ അളവ് (Waist - {record.personalDetails.sex === 'female' ? 'Female' : 'Male'}):{' '}
                <Text style={styles.ptsText}>+{record.partA.waistScore} pts</Text>
              </Text>
              <View style={styles.btnChoiceRow}>
                {[
                  {
                    score: 0,
                    label: record.personalDetails.sex === 'female' ? '≤ 80 cm (0)' : '≤ 90 cm (0)'
                  },
                  {
                    score: 1,
                    label: record.personalDetails.sex === 'female' ? '81-90 cm (1)' : '91-100 cm (1)'
                  },
                  {
                    score: 2,
                    label: record.personalDetails.sex === 'female' ? '> 90 cm (2)' : '> 100 cm (2)'
                  }
                ].map((item) => (
                  <TouchableOpacity
                    key={item.score}
                    style={[styles.choiceBtn, record.partA.waistScore === item.score && styles.choiceBtnActive]}
                    onPress={() => {
                      record.partA.waistScore = item.score as CbacPartAWaist;
                      refreshScores(record);
                    }}
                  >
                    <Text style={[styles.choiceBtnText, record.partA.waistScore === item.score && styles.choiceBtnTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 5. Physical Activity */}
            <View style={styles.qBox}>
              <Text style={styles.qTitle}>
                5. ആഴ്ചയിൽ 150 മിനിറ്റ് വ്യായാമം (Physical Activity):{' '}
                <Text style={styles.ptsText}>+{record.partA.physicalActivityScore} pts</Text>
              </Text>
              <View style={styles.btnChoiceRow}>
                {[
                  { score: 0, label: 'ആഴ്ചയിൽ 150 മിനിറ്റ് എങ്കിലും (0)' },
                  { score: 1, label: '150 മിനിറ്റിൽ താഴെ / ഇല്ല (1)' }
                ].map((item) => (
                  <TouchableOpacity
                    key={item.score}
                    style={[styles.choiceBtn, record.partA.physicalActivityScore === item.score && styles.choiceBtnActive]}
                    onPress={() => {
                      record.partA.physicalActivityScore = item.score as CbacPartAPhysicalActivity;
                      refreshScores(record);
                    }}
                  >
                    <Text style={[styles.choiceBtnText, record.partA.physicalActivityScore === item.score && styles.choiceBtnTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 6. Family History */}
            <View style={styles.qBox}>
              <Text style={styles.qTitle}>
                6. കുടുംബത്തിൽ ഉയർന്ന ബിപി, ഷുഗർ, ഹൃദ്രോഗം ചരിത്രം (Family History):{' '}
                <Text style={styles.ptsText}>+{record.partA.familyHistoryScore} pts</Text>
              </Text>
              <View style={styles.btnChoiceRow}>
                {[
                  { score: 0, label: 'ഇല്ല (No: 0)' },
                  { score: 2, label: 'ഉണ്ട് (Yes: 2)' }
                ].map((item) => (
                  <TouchableOpacity
                    key={item.score}
                    style={[styles.choiceBtn, record.partA.familyHistoryScore === item.score && styles.choiceBtnActive]}
                    onPress={() => {
                      record.partA.familyHistoryScore = item.score as CbacPartAFamilyHistory;
                      refreshScores(record);
                    }}
                  >
                    <Text style={[styles.choiceBtnText, record.partA.familyHistoryScore === item.score && styles.choiceBtnTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* --- PART B: EARLY DETECTION SYMPTOMS --- */}
          <View style={styles.formCard}>
            <TouchableOpacity
              style={styles.expandHeader}
              onPress={() => setShowPartBExpanded(!showPartBExpanded)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeading}>ഭാഗം B: പ്രാരംഭ ലക്ഷണങ്ങൾ (Early Detection)</Text>
                <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: 'bold' }}>
                  {record.partB.hasAnyWarningSign ? '⚠️ ലക്ഷണങ്ങൾ രേഖപ്പെടുത്തിയിട്ടുണ്ട്' : '✓ നിലവിൽ പ്രത്യേക ലക്ഷണങ്ങൾ ഇല്ല'}
                </Text>
              </View>
              <Text style={{ fontSize: 16, color: '#4B5563' }}>{showPartBExpanded ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {showPartBExpanded && (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.subCategoryHeading}>B1: പുരുഷന്മാർക്കും സ്ത്രീകൾക്കും (Men & Women):</Text>
                {[
                  { k: 'shortnessOfBreath', ml: 'ശ്വാസതടസ്സം (Shortness of breath)' },
                  { k: 'coughingMoreThan2Weeks', ml: 'രണ്ടാഴ്ചയിലധികം നീളുന്ന ചുമ (Cough >2 weeks)*' },
                  { k: 'bloodInSputum', ml: 'കഫത്തിൽ രക്തം (Blood in sputum)*' },
                  { k: 'feverOver2Weeks', ml: 'രണ്ടാഴ്ചയിലധികം പനി (Fever >2 weeks)*' },
                  { k: 'lossOfWeight', ml: 'ഭാരം പെട്ടെന്ന് കുറയുന്നു (Loss of weight)*' },
                  { k: 'nightSweats', ml: 'രാത്രി അമിതമായി വിയർക്കുക (Night sweats)*' },
                  { k: 'takingAntiTbDrugs', ml: 'നിലവിൽ ടിബി മരുന്ന് കഴിക്കുന്നുണ്ടോ?**' },
                  { k: 'mouthUlcersOver2Weeks', ml: 'വായ്ക്കുള്ളിൽ ഉണങ്ങാത്ത വ്രണം (>2 weeks)' },
                  { k: 'mouthWhiteOrRedPatchOver2Weeks', ml: 'വായിൽ വെളുത്തതോ ചുവന്നതോ ആയ പാട് (>2 weeks)' },
                  { k: 'historyOfFits', ml: 'അപസ്മാരം / ഫിറ്റ്സ് ഉണ്ടായ ചരിത്രം' },
                  { k: 'changeInVoiceTone', ml: 'ശബ്ദവ്യത്യാസം / ഒച്ചയടപ്പ്' },
                  { k: 'cloudyOrBlurredVision', ml: 'കാഴ്ച മങ്ങൽ (Cloudy or blurred vision)' },
                  { k: 'tinglingNumbnessHandsFeet', ml: 'കൈകാലുകളിൽ മരവിപ്പും തരിപ്പും (Tingling & numbness)' },
                  { k: 'difficultyHearing', ml: 'കേൾവിക്കുറവ് (Difficulty in hearing)' }
                ].map((sym) => {
                  const val = (record.partB.general as any)[sym.k];
                  return (
                    <TouchableOpacity
                      key={sym.k}
                      style={[styles.symRow, val && styles.symRowActive]}
                      onPress={() => {
                        (record.partB.general as any)[sym.k] = !val;
                        refreshScores(record);
                      }}
                    >
                      <View style={[styles.symCheck, val && styles.symCheckActive]}>
                        <Text style={styles.symCheckText}>{val ? '✓' : ''}</Text>
                      </View>
                      <Text style={[styles.symLabel, val && styles.symLabelActive]}>{sym.ml}</Text>
                    </TouchableOpacity>
                  );
                })}

                {/* B2: Women Only */}
                {record.personalDetails.sex === 'female' && (
                  <>
                    <Text style={[styles.subCategoryHeading, { marginTop: 14 }]}>B2: സ്ത്രീകൾക്ക് മാത്രം (Women Only):</Text>
                    {[
                      { k: 'lumpInBreast', ml: 'സ്തനത്തിൽ മുഴ (Lump in breast)' },
                      { k: 'bloodStainedNippleDischarge', ml: 'മുലക്കണ്ണിൽ നിന്ന് രക്തംകലർന്ന സ്രവം' },
                      { k: 'bleedingAfterMenopause', ml: 'ആർത്തവവിരാമത്തിന് ശേഷമുള്ള രക്തസ്രാവം' },
                      { k: 'bleedingBetweenPeriods', ml: 'ആർത്തവങ്ങൾക്കിടയിലുള്ള രക്തസ്രാവം' },
                      { k: 'foulSmellingVaginalDischarge', ml: 'ദുർഗന്ധമുള്ള വെള്ളപോക്ക് (Vaginal discharge)' }
                    ].map((sym) => {
                      const val = (record.partB.womenOnly as any)[sym.k];
                      return (
                        <TouchableOpacity
                          key={sym.k}
                          style={[styles.symRow, val && styles.symRowActive]}
                          onPress={() => {
                            (record.partB.womenOnly as any)[sym.k] = !val;
                            refreshScores(record);
                          }}
                        >
                          <View style={[styles.symCheck, val && styles.symCheckActive]}>
                            <Text style={styles.symCheckText}>{val ? '✓' : ''}</Text>
                          </View>
                          <Text style={[styles.symLabel, val && styles.symLabelActive]}>{sym.ml}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}

                {/* B3: Elderly 60+ */}
                {record.personalDetails.age >= 60 && (
                  <>
                    <Text style={[styles.subCategoryHeading, { marginTop: 14 }]}>B3: 60 വയസ്സിന് മുകളിലുള്ളവർ (Elderly Specific):</Text>
                    {[
                      { k: 'feelingUnsteadyStandingWalking', ml: 'നിൽക്കുമ്പോഴും നടക്കുമ്പോഴും കാലിടറൽ (Unsteady)' },
                      { k: 'needingHelpEverydayActivities', ml: 'കുളിക്കാനും ഭക്ഷണം കഴിക്കാനും മറ്റുള്ളവരുടെ സഹായം വേണം' },
                      { k: 'forgettingNamesOrHomeAddress', ml: 'അടുത്തവരുടെ പേരോ സ്വന്തം വിലാസമോ മറന്നുപോകുന്നു' }
                    ].map((sym) => {
                      const val = (record.partB.elderlySpecific as any)[sym.k];
                      return (
                        <TouchableOpacity
                          key={sym.k}
                          style={[styles.symRow, val && styles.symRowActive]}
                          onPress={() => {
                            (record.partB.elderlySpecific as any)[sym.k] = !val;
                            refreshScores(record);
                          }}
                        >
                          <View style={[styles.symCheck, val && styles.symCheckActive]}>
                            <Text style={styles.symCheckText}>{val ? '✓' : ''}</Text>
                          </View>
                          <Text style={[styles.symLabel, val && styles.symLabelActive]}>{sym.ml}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}
              </View>
            )}
          </View>

          {/* --- PART C: COPD RISK FACTORS --- */}
          <View style={styles.formCard}>
            <TouchableOpacity
              style={styles.expandHeader}
              onPress={() => setShowPartCExpanded(!showPartCExpanded)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeading}>ഭാഗം C: ശ്വാസകോശ രോഗസാധ്യത (Part C: COPD Risk Factors)</Text>
                <Text style={{ fontSize: 11, color: '#059669', fontWeight: 'bold' }}>
                  {record.partC.cookingFuels.includes('firewood') ||
                   record.partC.cookingFuels.includes('coal') ||
                   record.partC.cookingFuels.includes('crop_residue') ||
                   record.partC.cookingFuels.includes('cow_dung') ||
                   record.partC.occupationalExposures.some((e) => e !== 'none')
                    ? '⚠️ ശ്വാസകോശ രോഗസാധ്യത അടയാളപ്പെടുത്തിയിട്ടുണ്ട് (Risk Factors Present)'
                    : '✓ സുരക്ഷിതമായ ഇന്ധനവും അന്തരീക്ഷവും (Normal / Clean Environment)'}
                </Text>
              </View>
              <Text style={{ fontSize: 16, color: '#4B5563', marginLeft: 8 }}>
                {showPartCExpanded ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>

            {showPartCExpanded && (
              <View style={{ marginTop: 12 }}>
                {/* C1: Cooking Fuel */}
                <Text style={styles.subCategoryHeading}>
                  C1. പാചകത്തിന് ഉപയോഗിക്കുന്ന ഇന്ധനം (Type of Cooking Fuel):
                </Text>
                {[
                  { id: 'firewood', ml: '🔥 വിറക് (Firewood / Biomass)' },
                  { id: 'lpg', ml: '🔥 LPG / ഗ്യാസ് (LPG Cooking Gas)' },
                  { id: 'kerosene', ml: '🛢️ മണ്ണെണ്ണ (Kerosene Stove)' },
                  { id: 'coal', ml: '🪨 കൽക്കരി / മറ്റ് ഇന്ധനം (Coal / Charcoal)' },
                  { id: 'crop_residue', ml: '🌾 കൃഷി അവശിഷ്ടങ്ങൾ (Crop Residue)' },
                  { id: 'cow_dung', ml: '🐄 വരളി / ചാണകം (Cow Dung Cakes)' }
                ].map((fuel) => {
                  const val = record.partC.cookingFuels.includes(fuel.id as CbacCookingFuel);
                  return (
                    <TouchableOpacity
                      key={fuel.id}
                      style={[styles.symRow, val && styles.symRowActive]}
                      onPress={() => {
                        if (val) {
                          record.partC.cookingFuels = record.partC.cookingFuels.filter((f) => f !== fuel.id);
                        } else {
                          record.partC.cookingFuels.push(fuel.id as CbacCookingFuel);
                        }
                        refreshScores(record);
                      }}
                    >
                      <View style={[styles.symCheck, val && styles.symCheckActive]}>
                        <Text style={styles.symCheckText}>{val ? '✓' : ''}</Text>
                      </View>
                      <Text style={[styles.symLabel, val && styles.symLabelActive]}>{fuel.ml}</Text>
                    </TouchableOpacity>
                  );
                })}

                {/* C2: Occupational Exposure */}
                <Text style={[styles.subCategoryHeading, { marginTop: 14 }]}>
                  C2. ജോലിസ്ഥലത്തെ പുകയും പൊടിയും (Occupational Exposure to Smoke/Dust):
                </Text>
                {[
                  { id: 'industrial_smoke_dust', ml: '🏭 വ്യവസായ പുക / പൊടി (Industrial Smoke & Dust)' },
                  { id: 'crop_burning', ml: '🌾 കൃഷിയിടങ്ങളിലെ പുക (Crop Residue Burning)' },
                  { id: 'garbage_burning', ml: '🗑️ മാലിന്യ പുക (Garbage / Plastics Burning)' },
                  { id: 'none', ml: '✅ പ്രകടമായ ജോലിസ്ഥല പുകയില്ല (No Exposure / Normal)' }
                ].map((exp) => {
                  const val = record.partC.occupationalExposures.includes(exp.id as CbacOccupationalExposure);
                  return (
                    <TouchableOpacity
                      key={exp.id}
                      style={[styles.symRow, val && styles.symRowActive]}
                      onPress={() => {
                        if (exp.id === 'none') {
                          record.partC.occupationalExposures = ['none'];
                        } else {
                          record.partC.occupationalExposures = record.partC.occupationalExposures.filter((e) => e !== 'none');
                          if (val) {
                            record.partC.occupationalExposures = record.partC.occupationalExposures.filter((e) => e !== exp.id);
                          } else {
                            record.partC.occupationalExposures.push(exp.id as CbacOccupationalExposure);
                          }
                        }
                        refreshScores(record);
                      }}
                    >
                      <View style={[styles.symCheck, val && styles.symCheckActive]}>
                        <Text style={styles.symCheckText}>{val ? '✓' : ''}</Text>
                      </View>
                      <Text style={[styles.symLabel, val && styles.symLabelActive]}>{exp.ml}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* --- PART D: PHQ-2 DEPRESSION --- */}
          <View style={styles.formCard}>
            <TouchableOpacity
              style={styles.expandHeader}
              onPress={() => setShowPartDExpanded(!showPartDExpanded)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeading}>ഭാഗം D: PHQ-2 മാനസികാരോഗ്യം</Text>
                <Text style={{ fontSize: 11, color: '#4B5563' }}>കഴിഞ്ഞ 2 ആഴ്ചയിലെ മാനസികാവസ്ഥ</Text>
              </View>
              <Text style={{ fontSize: 16, color: '#4B5563' }}>{showPartDExpanded ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {showPartDExpanded && (
              <View style={{ marginTop: 10 }}>
                <View style={styles.qBox}>
                  <Text style={styles.qTitle}>1. കാര്യങ്ങൾ ചെയ്യുന്നതിൽ താല്പര്യക്കുറവ് (Little interest/pleasure):</Text>
                  <View style={styles.btnChoiceRow}>
                    {[
                      { s: 0, l: 'ഇല്ല (0)' },
                      { s: 1, l: 'കുറച്ചുദിവസം (+1)' },
                      { s: 2, l: 'പകുതിയിലധികം (+2)' },
                      { s: 3, l: 'ദിവസവും (+3)' }
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.s}
                        style={[styles.smallBtn, record.partD.littleInterestOrPleasure === item.s && styles.choiceBtnActive]}
                        onPress={() => {
                          record.partD.littleInterestOrPleasure = item.s as Phq2ScoreValue;
                          refreshScores(record);
                        }}
                      >
                        <Text style={[styles.smallBtnText, record.partD.littleInterestOrPleasure === item.s && styles.choiceBtnTextActive]}>
                          {item.l}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.qBox}>
                  <Text style={styles.qTitle}>2. സങ്കടം, നിരാശ, വിഷാദം തോന്നുക (Feeling down, depressed):</Text>
                  <View style={styles.btnChoiceRow}>
                    {[
                      { s: 0, l: 'ഇല്ല (0)' },
                      { s: 1, l: 'കുറച്ചുദിവസം (+1)' },
                      { s: 2, l: 'പകുതിയിലധികം (+2)' },
                      { s: 3, l: 'ദിവസവും (+3)' }
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.s}
                        style={[styles.smallBtn, record.partD.feelingDownDepressedHopeless === item.s && styles.choiceBtnActive]}
                        onPress={() => {
                          record.partD.feelingDownDepressedHopeless = item.s as Phq2ScoreValue;
                          refreshScores(record);
                        }}
                      >
                        <Text style={[styles.smallBtnText, record.partD.feelingDownDepressedHopeless === item.s && styles.choiceBtnTextActive]}>
                          {item.l}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Feedback message */}
          {saveSuccessMsg && (
            <View style={styles.feedbackBox}>
              <Text style={styles.feedbackText}>{saveSuccessMsg}</Text>
            </View>
          )}

          {/* Bottom Actions */}
          <View style={styles.bottomActionRow}>
            <TouchableOpacity
              style={styles.saveProfileBtn}
              onPress={handleSaveSurvey}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveProfileBtnText}>
                  💾 പ്രൊഫൈലിലേക്ക് സേവ് ചെയ്യുക (Save Survey)
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.viewJsonBtn}
              onPress={() => {
                setActiveJsonRecord(record);
                setShowJsonModal(true);
              }}
            >
              <Text style={styles.viewJsonBtnText}>📄 View JSON</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* VIEW 2: BENEFICIARY PROFILES, SEARCH, FILTERS & LONGITUDINAL PROGRESS TRACKING */}
      {activeView === 'profiles' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.profilesHeaderRow}>
            <View>
              <Text style={styles.viewHeading}>👥 പ്രൊഫൈലുകൾ സന്ദർശിക്കുക (Profiles & Filters)</Text>
              <Text style={styles.viewSubHeading}>
                വ്യക്തികളെ തിരയാനും റിസ്ക് സ്കോറുകൾ അനുസരിച്ച് ഫിൽട്ടർ ചെയ്യാനും മുൻകാല സർവേകൾ കാണാനും സാധിക്കും.
              </Text>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBarBox}>
            <Text style={{ fontSize: 16, marginRight: 6 }}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by Name, Identifier, or Ward..."
              placeholderTextColor="#9CA3AF"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={{ color: '#6B7280', fontSize: 14 }}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Filter Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChipScroll}>
            {[
              { id: 'all', label: `എല്ലാം (${profiles.length})` },
              { id: 'high_risk', label: `🚨 ഉയർന്ന റിസ്ക് (>4)` },
              { id: 'normal', label: `🟢 സാധാരണ നില (≤4)` },
              { id: 'warning_signs', label: `⚠️ ലക്ഷണങ്ങൾ (Part B)` },
              { id: 'phq2', label: `🧠 PHQ-2 (>3)` }
            ].map((f) => (
              <TouchableOpacity
                key={f.id}
                style={[styles.filterChip, scoreFilter === f.id && styles.filterChipActive]}
                onPress={() => setScoreFilter(f.id as any)}
              >
                <Text style={[styles.filterChipText, scoreFilter === f.id && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Filtered Profiles List */}
          <View style={{ marginTop: 4, marginBottom: 14 }}>
            <Text style={styles.filteredCountText}>
              കണ്ടെത്തിയ വ്യക്തികൾ: {filteredProfiles.length}
            </Text>

            {filteredProfiles.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>ഈ ഫിൽട്ടറിൽ ഉൾപ്പെടുന്ന വ്യക്തികൾ ഇല്ല.</Text>
              </View>
            ) : (
              filteredProfiles.map((p) => (
                <View key={p.beneficiaryId} style={styles.filterResultCard}>
                  <View style={styles.resultCardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultName}>{p.name}</Text>
                      <Text style={styles.resultMeta}>
                        {p.age}y • {p.sex.toUpperCase()} • {p.villageWard} • {p.surveys.length} visits
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.resultScoreBadge,
                        p.latestScore > 4 ? styles.meterWarning : styles.meterSafe
                      ]}
                    >
                      <Text style={styles.resultScoreText}>സ്കോർ: {p.latestScore}/10</Text>
                    </View>
                  </View>

                  <Text style={styles.resultNote}>
                    {p.surveys[0]?.actionRecommendationsMl || 'No survey notes available'}
                  </Text>

                  <View style={styles.resultActions}>
                    <TouchableOpacity
                      style={styles.openProfileBtn}
                      onPress={() => {
                        setSelectedProfile(p);
                      }}
                    >
                      <Text style={styles.openProfileBtnText}>📈 പ്രൊഫൈൽ & ചരിത്രം കാണുക</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.newVisitBtn}
                      onPress={() => handleStartNewSurveyForBeneficiary(p)}
                    >
                      <Text style={styles.newVisitBtnText}>➕ New Survey</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Selected Beneficiary Detail & Longitudinal Timeline */}
          {selectedProfile && (
            <View style={styles.longitudinalCard}>
              <View style={styles.profileSummaryTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileBigName}>{selectedProfile.name}</Text>
                  <Text style={styles.profileMetaText}>
                    {selectedProfile.age} വയസ്സ് • {selectedProfile.sex.toUpperCase()} • {selectedProfile.villageWard}
                  </Text>
                  <Text style={styles.profileMetaText}>ID: {selectedProfile.identifier || 'N/A'} • ഫോൺ: {selectedProfile.telephone || 'N/A'}</Text>
                </View>

                {/* Progress Trend Badge */}
                <View
                  style={[
                    styles.trendBadge,
                    selectedProfile.scoreTrend === 'improved'
                      ? styles.trendBadgeImproved
                      : selectedProfile.scoreTrend === 'worsened'
                      ? styles.trendBadgeWorsened
                      : styles.trendBadgeStable
                  ]}
                >
                  <Text style={styles.trendBadgeText}>
                    {selectedProfile.scoreTrend === 'improved'
                      ? '📉 മെച്ചപ്പെട്ടു (Improved)'
                      : selectedProfile.scoreTrend === 'worsened'
                      ? '📈 റിസ്ക് കൂടി (Worsened)'
                      : '➡️ സ്ഥിരത (Stable)'}
                  </Text>
                  <Text style={styles.trendSubScore}>
                    ആദ്യം: {selectedProfile.initialScore}/10 → ഇപ്പോൾ: {selectedProfile.latestScore}/10
                  </Text>
                </View>
              </View>

              {/* Action Button: Add New Survey for this person */}
              <TouchableOpacity
                style={styles.newSurveyBtn}
                onPress={() => handleStartNewSurveyForBeneficiary(selectedProfile)}
              >
                <Text style={styles.newSurveyBtnText}>
                  ➕ {selectedProfile.name}-ന് പുതിയ സർവേ ആരംഭിക്കുക
                </Text>
              </TouchableOpacity>

              {/* Historical Surveys Timeline */}
              <Text style={styles.timelineSectionTitle}>
                📅 മുൻകാല സർവേ ചരിത്രം ({selectedProfile.surveys.length} visits):
              </Text>

              {selectedProfile.surveys.map((srv, idx) => (
                <View key={srv.surveyId} style={styles.timelineItem}>
                  <View style={styles.timelineItemDot} />
                  <View style={styles.timelineItemCard}>
                    <View style={styles.timelineTopRow}>
                      <Text style={styles.timelineDate}>
                        #{selectedProfile.surveys.length - idx} • {srv.generalInfo.date}
                      </Text>
                      <View
                        style={[
                          styles.timelineScoreBadge,
                          srv.partA.totalScore > 4 ? styles.meterWarning : styles.meterSafe
                        ]}
                      >
                        <Text style={styles.timelineScoreText}>Part A: {srv.partA.totalScore}/10</Text>
                      </View>
                    </View>

                    <Text style={styles.timelineDescMl}>{srv.actionRecommendationsMl}</Text>
                    <Text style={styles.timelineDetails}>
                      അരക്കെട്ട്: {srv.partA.waistCm ? `${srv.partA.waistCm}cm` : 'N/A'} • പുകവലി: {srv.partA.tobaccoScore === 2 ? 'Daily' : srv.partA.tobaccoScore === 1 ? 'Past' : 'Never'} • വ്യായാമം: {srv.partA.physicalActivityScore === 0 ? 'Active' : 'Inactive'}
                    </Text>

                    <View style={styles.timelineActions}>
                      <TouchableOpacity
                        style={styles.timelineViewBtn}
                        onPress={() => {
                          setActiveJsonRecord(srv);
                          setShowJsonModal(true);
                        }}
                      >
                        <Text style={styles.timelineViewBtnText}>👁️ View Full Record</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

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
    backgroundColor: '#F3F4F6'
  },
  headerBlock: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    letterSpacing: -0.3
  },
  subtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2
  },
  headerButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10
  },
  visitProfilesBtn: {
    backgroundColor: '#065F46',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  visitProfilesBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40
  },
  voiceStudioCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    elevation: 2
  },
  voiceStudioTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  voiceStudioTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#111827'
  },
  voiceStudioDesc: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 15
  },
  recordingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444'
  },
  recordingTimerText: {
    color: '#DC2626',
    fontWeight: 'bold',
    fontSize: 12
  },
  voiceStudioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 6,
    minHeight: 50
  },
  voiceStudioBtnIdle: {
    backgroundColor: '#065F46'
  },
  voiceStudioBtnActive: {
    backgroundColor: '#DC2626'
  },
  voiceStudioBtnProcessing: {
    backgroundColor: '#4B5563'
  },
  voiceStudioBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
    flexShrink: 1
  },
  voiceStatusText: {
    fontSize: 11,
    color: '#4B5563',
    textAlign: 'center',
    marginTop: 4
  },
  transcriptCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    marginTop: 10
  },
  transcriptHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  transcriptLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#065F46'
  },
  reanalyzeBtn: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  reanalyzeBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1F2937'
  },
  transcriptInput: {
    fontSize: 13,
    color: '#111827',
    lineHeight: 18,
    minHeight: 48
  },
  meterCard: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    marginBottom: 14
  },
  meterSafe: {
    backgroundColor: '#ECFDF5',
    borderColor: '#6EE7B7'
  },
  meterWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D'
  },
  meterDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5'
  },
  meterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  meterScoreBig: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#111827'
  },
  meterScoreLabel: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '600'
  },
  tierBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB'
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1F2937'
  },
  meterNoteMl: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 8,
    lineHeight: 17
  },
  meterNoteEn: {
    fontSize: 11,
    color: '#4B5563',
    marginTop: 2
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 1
  },
  cardHeading: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 6
  },
  cardHeaderWithBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  scoreBadge: {
    backgroundColor: '#065F46',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  scoreBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold'
  },
  subtextNotice: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 10,
    lineHeight: 15
  },
  grid2: {
    flexDirection: 'row',
    gap: 8
  },
  grid3: {
    flexDirection: 'row',
    gap: 8
  },
  fieldCol: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 4
  },
  inputBox: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    color: '#111827'
  },
  btnChoiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4
  },
  choiceBtn: {
    flex: 1,
    minWidth: '28%',
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6
  },
  choiceBtnActive: {
    backgroundColor: '#065F46',
    borderColor: '#065F46'
  },
  choiceBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center'
  },
  choiceBtnTextActive: {
    color: '#FFFFFF'
  },
  smallBtn: {
    flex: 1,
    minWidth: '18%',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center'
  },
  smallBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center'
  },
  qBox: {
    marginBottom: 12
  },
  qTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4
  },
  ptsText: {
    color: '#059669',
    fontWeight: 'bold'
  },
  expandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  subCategoryHeading: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#7C3AED',
    marginBottom: 6
  },
  symRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 8,
    borderRadius: 6,
    marginBottom: 5
  },
  symRowActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#F87171'
  },
  symCheck: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  symCheckActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626'
  },
  symCheckText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold'
  },
  symLabel: {
    fontSize: 11,
    color: '#374151',
    flex: 1
  },
  symLabelActive: {
    color: '#991B1B',
    fontWeight: '600'
  },
  feedbackBox: {
    backgroundColor: '#D1FAE5',
    borderColor: '#6EE7B7',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12
  },
  feedbackText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  bottomActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20
  },
  saveProfileBtn: {
    flex: 2,
    backgroundColor: '#065F46',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  saveProfileBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold'
  },
  viewJsonBtn: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  viewJsonBtnText: {
    color: '#374151',
    fontSize: 12,
    fontWeight: 'bold'
  },
  profilesHeaderRow: {
    marginBottom: 12
  },
  viewHeading: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827'
  },
  viewSubHeading: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2
  },
  profilesScroll: {
    flexDirection: 'row',
    marginBottom: 14
  },
  profileCardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8
  },
  profileCardChipActive: {
    borderColor: '#065F46',
    backgroundColor: '#ECFDF5'
  },
  chipAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center'
  },
  chipName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1F2937'
  },
  chipNameActive: {
    color: '#065F46'
  },
  chipScore: {
    fontSize: 10,
    color: '#6B7280'
  },
  longitudinalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 2
  },
  profileSummaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 10,
    marginBottom: 10
  },
  profileBigName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827'
  },
  profileMetaText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2
  },
  trendBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center'
  },
  trendBadgeImproved: {
    backgroundColor: '#DCFCE7'
  },
  trendBadgeWorsened: {
    backgroundColor: '#FEE2E2'
  },
  trendBadgeStable: {
    backgroundColor: '#F3F4F6'
  },
  trendBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1F2937'
  },
  trendSubScore: {
    fontSize: 9,
    color: '#4B5563',
    marginTop: 2
  },
  newSurveyBtn: {
    backgroundColor: '#065F46',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 14
  },
  newSurveyBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold'
  },
  timelineSectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 12
  },
  timelineItemDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#065F46',
    marginTop: 6,
    marginRight: 10
  },
  timelineItemCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10
  },
  timelineTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  timelineDate: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#111827'
  },
  timelineScoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  timelineScoreText: {
    fontSize: 11,
    fontWeight: 'bold'
  },
  timelineDescMl: {
    fontSize: 11,
    color: '#1F2937',
    marginTop: 4,
    lineHeight: 16
  },
  timelineDetails: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 4
  },
  timelineActions: {
    marginTop: 6,
    flexDirection: 'row'
  },
  timelineViewBtn: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  timelineViewBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151'
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
    marginBottom: 10
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#111827'
  },
  filterChipScroll: {
    flexDirection: 'row',
    marginBottom: 10
  },
  filterChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6
  },
  filterChipActive: {
    backgroundColor: '#065F46',
    borderColor: '#065F46'
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563'
  },
  filterChipTextActive: {
    color: '#FFFFFF'
  },
  filteredCountText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4B5563',
    marginBottom: 8
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 12,
    color: '#6B7280'
  },
  filterResultCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    elevation: 1
  },
  resultCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  resultName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827'
  },
  resultMeta: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2
  },
  resultScoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  resultScoreText: {
    fontSize: 11,
    fontWeight: 'bold'
  },
  resultNote: {
    fontSize: 11,
    color: '#374151',
    marginTop: 6,
    lineHeight: 16
  },
  resultActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10
  },
  openProfileBtn: {
    flex: 2,
    backgroundColor: '#ECFDF5',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  openProfileBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#065F46'
  },
  newVisitBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  newVisitBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151'
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#1E293B',
    padding: 16
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF'
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#94A3B8'
  },
  modalCloseBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  modalCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold'
  },
  modalJsonInput: {
    flex: 1,
    backgroundColor: '#0F172A',
    color: '#38BDF8',
    fontFamily: 'monospace',
    fontSize: 12,
    padding: 12,
    borderRadius: 8,
    textAlignVertical: 'top'
  }
});
