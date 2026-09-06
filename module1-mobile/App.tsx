import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  TextInput,
  Modal,
  Image,
  Share,
  Platform
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { apiClient, getActiveHost, setActiveHost } from './src/api/apiClient';
import {
  VisitDraft,
  ConfirmedVisit,
  MissingFieldPrompt,
  HouseholdSummary,
  HouseholdMember
} from './src/types';
import { LoginScreen } from './src/screens/LoginScreen';
import { HouseholdPersonSelector } from './src/components/HouseholdPersonSelector';
import { loadSavedSession, clearSession, AshaWorkerProfile } from './src/services/authService';
import { audioRecorder } from './src/services/audioRecorder';
import {
  transcribeWithIndicConformer,
  transcribeWithSarvamAI,
  getCustomSarvamApiKey,
  setCustomSarvamApiKey,
} from './src/services/indicConformerService';
import { QUICK_CORRECTION_SUGGESTIONS } from './src/services/malayalamSpellCorrector';
import { StructuredClinicalRecord } from './src/types/structuredClinicalRecord';
import { extractStructuredClinicalRecord } from './src/services/clinicalEntityExtractor';
import {
  saveStructuredRecord,
  getAllStructuredRecords,
  deleteStructuredRecord,
  exportAllRecordsFormattedText,
  formatStructuredRecordToReport
} from './src/services/structuredStorageService';
import {
  refineTranscriptSentencesWithGemini,
  refineWithPrivacyPreservingGemini,
  SentenceCorrectionDetail,
  getCustomGeminiApiKey,
  setCustomGeminiApiKey
} from './src/services/geminiPrivacyService';
import {
  BottomTabBar,
  AppTab,
  AppIcon,
  MentalHealthScreen,
  EnvironmentalRiskScreen,
  NcdLifestyleScreen,
  VitalsBaselineScreen
} from './src/modules';
import { AshaProfileScreen, ALL_ALUVA_WARDS } from './src/screens/AshaProfileScreen';
import { AshaChatbotModal } from './src/components/AshaChatbotModal';

function MainApp() {
  // State for connectivity & Diagnostic Ping
  const [serverIp, setServerIp] = useState<string>(getActiveHost());
  const [showIpConfig, setShowIpConfig] = useState<boolean>(false);
  const [backendStatus, setBackendStatus] = useState<string>('Checking backend...');
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [isCallingApi, setIsCallingApi] = useState<boolean>(false);

  // Voice Interaction State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [isProcessingVoice, setIsProcessingVoice] = useState<boolean>(false);
  const [indicConformerTranscript, setIndicConformerTranscript] = useState<string | null>(null);
  const [sentenceDetails, setSentenceDetails] = useState<SentenceCorrectionDetail[]>([]);
  const [showSentenceBreakdown, setShowSentenceBreakdown] = useState<boolean>(false);
  const [visitDraft, setVisitDraft] = useState<VisitDraft | null>(null);
  const [isResolvingPrompt, setIsResolvingPrompt] = useState<boolean>(false);
  const [syncQueueCount, setSyncQueueCount] = useState<number>(0);
  const [lastActionMessage, setLastActionMessage] = useState<string>('Ready for field visits');
  const timerIntervalRef = React.useRef<any>(null);

  // Structured Clinical Record Extraction & Database Storage State
  const [structuredRecord, setStructuredRecord] = useState<StructuredClinicalRecord | null>(null);
  const [savedRecords, setSavedRecords] = useState<StructuredClinicalRecord[]>([]);
  const [selectedRecordToView, setSelectedRecordToView] = useState<StructuredClinicalRecord | null>(null);
  const [showStructuredViewModal, setShowStructuredViewModal] = useState<boolean>(false);
  const [showExportReportModal, setShowExportReportModal] = useState<boolean>(false);
  const [exportReportText, setExportReportText] = useState<string>('');
  const [activeWard, setActiveWard] = useState<string>('വാർഡ് 4, ആലുവ (Ward 4, Aluva)');
  const [showWardModal, setShowWardModal] = useState<boolean>(false);
  const [showMoreMenu, setShowMoreMenu] = useState<boolean>(false);
  const [saveFeedbackMsg, setSaveFeedbackMsg] = useState<string | null>(null);
  const [isSavingRecord, setIsSavingRecord] = useState<boolean>(false);
  const [isGeminiRefining, setIsGeminiRefining] = useState<boolean>(false);
  const [geminiStatusNote, setGeminiStatusNote] = useState<string | null>(null);
  const [showApiKeyConfig, setShowApiKeyConfig] = useState<boolean>(false);
  const [sarvamApiKeyInput, setSarvamApiKeyInput] = useState<string>(getCustomSarvamApiKey());
  const [showSarvamKeyPlaintext, setShowSarvamKeyPlaintext] = useState<boolean>(false);
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState<string>(getCustomGeminiApiKey());
  const [showKeyPlaintext, setShowKeyPlaintext] = useState<boolean>(false);
  const [showZScoreModal, setShowZScoreModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<AppTab>('core');
  const [isChatbotOpen, setIsChatbotOpen] = useState<boolean>(false);

  const handleSaveSarvamKey = () => {
    setCustomSarvamApiKey(sarvamApiKeyInput);
    setLastActionMessage(
      sarvamApiKeyInput.trim()
        ? '✓ Sarvam AI Voice-to-Text Key configured (Saaras v4)!'
        : 'Sarvam AI Key cleared.'
    );
  };

  const handleSaveGeminiKey = () => {
    setCustomGeminiApiKey(geminiApiKeyInput);
    setLastActionMessage(
      geminiApiKeyInput.trim()
        ? '✓ Google Gemini API Key configured for Zero-PII Cloud Engine!'
        : 'Gemini API Key cleared. Local Extractor active.'
    );
  };

  // Authentication & Frontline Role State
  const [currentUser, setCurrentUser] = useState<AshaWorkerProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Active Household & Citizen Context State (Numbered households & members)
  const [households, setHouseholds] = useState<HouseholdSummary[]>([]);
  const [selectedHousehold, setSelectedHousehold] = useState<HouseholdSummary | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<HouseholdMember | null>(null);
  const [isLoadingMembers, setIsLoadingMembers] = useState<boolean>(false);

  // Initial Load
  useEffect(() => {
    initAppSession();
  }, []);

  const initAppSession = async () => {
    setIsAuthLoading(true);
    try {
      const saved = await loadSavedSession();
      if (saved.isLoggedIn && saved.user) {
        setCurrentUser(saved.user);
      }
    } catch (e) {
      console.warn('Session load error:', e);
    }
    await runBasicCall();
    await loadHouseholdsData();
    await refreshSavedRecords();
    setIsAuthLoading(false);
  };

  const loadHouseholdsData = async () => {
    try {
      const res = await apiClient.getHouseholds();
      if (res.data && res.data.length > 0) {
        setHouseholds(res.data);
        const firstHh = res.data[0];
        setSelectedHousehold(firstHh);
        await loadMembersForHousehold(firstHh.id);
      }
    } catch (e) {
      console.warn('Failed to load households:', e);
    }
  };

  const loadMembersForHousehold = async (hhId: string) => {
    setIsLoadingMembers(true);
    try {
      const res = await apiClient.getHouseholdMembers(hhId);
      if (res.data && res.data.length > 0) {
        setHouseholdMembers(res.data);
        setSelectedPerson(res.data[0]);
      } else {
        setHouseholdMembers([]);
        setSelectedPerson(null);
      }
    } catch (e) {
      console.warn('Failed to load members:', e);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const handleSelectHousehold = async (hh: HouseholdSummary) => {
    setSelectedHousehold(hh);
    await loadMembersForHousehold(hh.id);
    setLastActionMessage(`Switched to Household [${hh.external_id || hh.id}]: ${hh.head_of_household}`);
  };

  const handleSelectPerson = (person: HouseholdMember) => {
    setSelectedPerson(person);
    setLastActionMessage(`Active beneficiary: ${person.name} (${person.age || '?'}y)`);
  };

  const handleAddNewMember = async (memberData: Partial<HouseholdMember>) => {
    if (!selectedHousehold) return;
    const res = await apiClient.addHouseholdMember(selectedHousehold.id, memberData);
    if (res.data) {
      await loadMembersForHousehold(selectedHousehold.id);
      setSelectedPerson(res.data);
      setLastActionMessage(`✓ Added ${res.data.name} to ${selectedHousehold.head_of_household}'s household`);
    }
  };

  const handleAddNewHousehold = async (hhData: Partial<HouseholdSummary>) => {
    const res = await apiClient.createHousehold(hhData);
    if (res.data) {
      const updated = await apiClient.getHouseholds();
      setHouseholds(updated.data);
      setSelectedHousehold(res.data);
      await loadMembersForHousehold(res.data.id);
      setLastActionMessage(`✓ Registered new household [${res.data.external_id}]`);
    }
  };

  const handleLogout = async () => {
    await clearSession();
    setCurrentUser(null);
    setLastActionMessage('Logged out from ASHA portal.');
  };

  const refreshSavedRecords = async () => {
    try {
      const records = await getAllStructuredRecords();
      setSavedRecords(records);
    } catch (e) {
      console.warn('Failed to load saved records:', e);
    }
  };

  const runBasicCall = async () => {
    setIsCallingApi(true);
    // Health check call
    const healthResult = await apiClient.checkBackendHealth();
    setIsBackendConnected(!healthResult.isMockFallback);
    setBackendStatus(
      healthResult.isMockFallback
        ? 'Offline Mode (Local Engine Active)'
        : 'Connected to Central Backend (Port 8000)'
    );
    setLastActionMessage(healthResult.message);
    setIsCallingApi(false);
  };

  // Real Audio Recording & AI4Bharat IndicConformer Transcription
  const handleToggleVoiceRecording = async () => {
    if (!isRecording) {
      // START RECORDING
      const hasPermission = await audioRecorder.requestPermission();
      if (!hasPermission) {
        setLastActionMessage('Microphone permission denied. Please allow audio access.');
        return;
      }

      try {
        await audioRecorder.startRecording();
        setIsRecording(true);
        setRecordingDuration(0);
        setLastActionMessage('ശബ്ദം രേഖപ്പെടുത്തുന്നു... പൂർത്തിയാകുമ്പോൾ ബട്ടൺ അമർത്തുക (Recording live speech...)');

        timerIntervalRef.current = setInterval(() => {
          setRecordingDuration((sec) => sec + 1);
        }, 1000);
      } catch (err: any) {
        setLastActionMessage(`Could not start recording: ${err.message}`);
      }
    } else {
      // STOP RECORDING & PASS TO INDICCONFORMER
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      setIsRecording(false);
      setIsProcessingVoice(true);
      setLastActionMessage('ശബ്ദരേഖ തയ്യാറാക്കുന്നു (Transcribing Malayalam audio)...');

      try {
        const audio = await audioRecorder.stopRecording();

        // 1. Transcribe with Sarvam AI ASR (strictly Malayalam)
        const conformerResult = await transcribeWithIndicConformer(audio, 'ml');

        console.log('\n======================================================');
        console.log('SARVAM AI RAW TRANSCRIPTION (MALAYALAM):');
        console.log(conformerResult.transcript);
        console.log('======================================================\n');

        let activeTranscript = conformerResult.transcript;

        // 2. Sentence-by-Sentence Gemini Contextual Refinement (in background)
        setLastActionMessage('ശബ്ദരേഖ വിശകലനം ചെയ്യുന്നു (Analyzing speech with context)...');
        try {
          const sentenceResult = await refineTranscriptSentencesWithGemini(
            conformerResult.transcript,
            geminiApiKeyInput,
            (done, total) => {
              setLastActionMessage(`വിവരങ്ങൾ പരിശോധിക്കുന്നു (${done}/${total})...`);
            }
          );
          if (sentenceResult.correctedTranscript) {
            activeTranscript = sentenceResult.correctedTranscript;
            setSentenceDetails(sentenceResult.sentenceDetails);
            setGeminiStatusNote(sentenceResult.message);
          }
        } catch (e: any) {
          console.warn('Sentence-by-sentence Gemini refinement error:', e);
        }

        setIndicConformerTranscript(activeTranscript);

        // 3. Extract Canonical Structured Clinical Record from refined Malayalam text
        let extractedRecord = extractStructuredClinicalRecord(activeTranscript);

        // If Gemini key is available, also run Gemini Zero-PII Structured Schema Reasoning
        if (geminiApiKeyInput && geminiApiKeyInput.trim() && !geminiApiKeyInput.startsWith('mock-')) {
          try {
            const schemaRes = await refineWithPrivacyPreservingGemini(activeTranscript, null, geminiApiKeyInput);
            if (schemaRes.record) {
              extractedRecord = schemaRes.record;
            }
          } catch (schemaErr) {
            console.warn('Auto schema refinement fallback to local extractor:', schemaErr);
          }
        }

        setStructuredRecord(extractedRecord);

        // 4. Process clinical visit draft
        const draftResult = await apiClient.processVoiceVisit(activeTranscript);
        setVisitDraft(draftResult.data);
        setLastActionMessage('വിവരങ്ങൾ വിജയകരമായി രേഖപ്പെടുത്തി (Record ready for review).');
      } catch (err: any) {
        console.error('IndicConformer error:', err);
        setLastActionMessage(`ASR Error: ${err.message}`);
      } finally {
        setIsProcessingVoice(false);
      }
    }
  };

  // Privacy-Preserving Gemini Assist (Sentence-by-Sentence Malayalam Refinement & Structured Reasoning)
  const handleRefineWithGemini = async () => {
    if (!indicConformerTranscript) return;
    setIsGeminiRefining(true);
    setGeminiStatusNote('Sending sentences to Gemini for contextual Malayalam correction...');
    try {
      // 1. Refine sentences with Gemini
      const sentenceResult = await refineTranscriptSentencesWithGemini(
        indicConformerTranscript,
        geminiApiKeyInput,
        (done, total) => {
          setGeminiStatusNote(`Refining sentence ${done} of ${total} with Gemini...`);
        }
      );
      const refinedText = sentenceResult.correctedTranscript || indicConformerTranscript;
      setIndicConformerTranscript(refinedText);
      setSentenceDetails(sentenceResult.sentenceDetails);

      // 2. Extract structured clinical record with Gemini reasoning
      const res = await refineWithPrivacyPreservingGemini(refinedText, null, geminiApiKeyInput);
      setStructuredRecord(res.record);
      setGeminiStatusNote(`${sentenceResult.message} ${res.message}`);
      setLastActionMessage(sentenceResult.message);

      // 3. Update clinical visit draft
      const draftResult = await apiClient.processVoiceVisit(refinedText);
      setVisitDraft(draftResult.data);
    } catch (e: any) {
      setGeminiStatusNote(`Refinement error: ${e.message}`);
    } finally {
      setIsGeminiRefining(false);
    }
  };

  // Re-analyze after user edits transcript or taps suggestion chips
  const handleReanalyzeTranscript = async (text: string) => {
    if (!text || !text.trim()) return;
    setIsProcessingVoice(true);
    setLastActionMessage('Re-analyzing corrected transcript...');
    try {
      // Re-extract Canonical Structured Clinical Record
      const extractedRecord = extractStructuredClinicalRecord(text);
      setStructuredRecord(extractedRecord);

      const draftResult = await apiClient.processVoiceVisit(text);
      setVisitDraft(draftResult.data);
      setLastActionMessage('✓ Structured clinical record updated from your corrected transcript!');
    } catch (e: any) {
      setLastActionMessage(`Error updating record: ${e.message}`);
    } finally {
      setIsProcessingVoice(false);
    }
  };

  const handleAppendChip = (chipText: string) => {
    const updated = indicConformerTranscript
      ? `${indicConformerTranscript.trim()} ${chipText}`
      : chipText;
    setIndicConformerTranscript(updated);
    handleReanalyzeTranscript(updated);
  };

  // Proactive Conversational Follow-up
  const handleAnswerMissingPrompt = async (prompt: MissingFieldPrompt) => {
    if (!visitDraft) return;
    setIsResolvingPrompt(true);
    setLastActionMessage(`Answering: "${prompt.question_text_ml}"...`);

    const sampleSpokenAnswer = 'കുട്ടിക്ക് ദിവസവും പാലും മുട്ടയും കൊടുക്കാറുണ്ട്. പയറും നൽകുന്നുണ്ട്.';
    const resolvedResult = await apiClient.resolveMissingField(
      visitDraft,
      prompt.question_id,
      sampleSpokenAnswer
    );

    setVisitDraft(resolvedResult.data);
    setIsResolvingPrompt(false);
    setLastActionMessage('Missing information satisfied conversationally! Ready for review.');
  };

  // Structured Clinical Record Actions (Central Database + Offline Resilience)
  const handleSaveCurrentRecord = async () => {
    if (!structuredRecord) return;
    setIsSavingRecord(true);
    setSaveFeedbackMsg('കേന്ദ്ര ഡാറ്റാബേസിലേക്ക് സൂക്ഷിക്കുന്നു (Saving to database)...');
    try {
      if (selectedHousehold) {
        structuredRecord.visit.household_id = selectedHousehold.id;
      }
      if (currentUser) {
        structuredRecord.visit.worker_id = currentUser.worker_id;
      }
      if (selectedPerson) {
        structuredRecord.person.person_id = selectedPerson.person_id;
        structuredRecord.person.name = selectedPerson.name;
        if (selectedPerson.age !== undefined) structuredRecord.person.age = selectedPerson.age;
      }

      // 1. Save to local storage for offline resilience
      await saveStructuredRecord(structuredRecord);

      // 2. Post to central MongoDB Atlas database
      const dbRes = await apiClient.saveStructuredRecordToDatabase(structuredRecord);
      if (dbRes.data && dbRes.data.storage === 'mongodb') {
        setSaveFeedbackMsg(`✓ കേന്ദ്ര ഡാറ്റാബേസിൽ രേഖപ്പെടുത്തി! (ID: ${structuredRecord.visit.visit_id})`);
      } else {
        setSaveFeedbackMsg(`✓ രേഖപ്പെടുത്തി (ഓഫ്‌ലൈൻ കാഷെയിൽ സൂക്ഷിച്ചു - ID: ${structuredRecord.visit.visit_id})`);
      }
      await refreshSavedRecords();
    } catch (err: any) {
      setSaveFeedbackMsg(`സേവ് ചെയ്യുന്നതിൽ തടസ്സം: ${err.message || err}`);
    } finally {
      setIsSavingRecord(false);
      setTimeout(() => setSaveFeedbackMsg(null), 4000);
    }
  };

  const handleOpenStructuredRecordModal = (record: StructuredClinicalRecord) => {
    setSelectedRecordToView(record);
    setShowStructuredViewModal(true);
  };

  const handleOpenBatchExportModal = async () => {
    const exportedText = await exportAllRecordsFormattedText();
    setExportReportText(exportedText);
    setShowExportReportModal(true);
  };

  const handleDeleteRecord = async (visitId: string) => {
    await deleteStructuredRecord(visitId);
    await refreshSavedRecords();
    setSaveFeedbackMsg(`Record ${visitId} deleted.`);
    setTimeout(() => setSaveFeedbackMsg(null), 3000);
  };

  const handleCancelEntry = () => {
    setVisitDraft(null);
    setStructuredRecord(null);
    setIndicConformerTranscript(null);
    setSentenceDetails([]);
    setLastActionMessage('എൻട്രി റദ്ദാക്കി (Entry reset).');
  };

  // Human Confirmation & Direct Database Sync Gate
  const handleConfirmVisit = async () => {
    if (!visitDraft && !structuredRecord) return;
    setIsSavingRecord(true);
    setSaveFeedbackMsg('വിവരങ്ങൾ സമർപ്പിക്കുന്നു (Submitting survey)...');

    let personUpdates = visitDraft?.person_updates || [];
    let sysBp: number | undefined;
    let diaBp: number | undefined;
    if (structuredRecord?.measurements?.blood_pressure) {
      const bpStr = String(structuredRecord.measurements.blood_pressure).trim();
      const parts = bpStr.split(/[\/\s-]+/);
      if (parts.length >= 2) {
        sysBp = parseInt(parts[0], 10) || undefined;
        diaBp = parseInt(parts[1], 10) || undefined;
      } else if (parts.length === 1) {
        sysBp = parseInt(parts[0], 10) || undefined;
      }
    }

    const targetHhId = selectedHousehold?.id || 'h-lakshmi-001';
    const targetWorkerId = currentUser?.worker_id || 'w-asha-001';
    const targetPersonId = selectedPerson?.person_id || `p-${Date.now()}`;
    const targetPersonName = selectedPerson?.name || 'Beneficiary';

    if (personUpdates.length === 0 && structuredRecord) {
      personUpdates = [{
        person_id: targetPersonId,
        name: targetPersonName,
        age: selectedPerson?.age !== undefined ? selectedPerson.age : (structuredRecord.person.age || undefined),
        gender: selectedPerson?.gender || structuredRecord.person.sex,
        vitals: {
          systolic_bp: sysBp,
          diastolic_bp: diaBp,
          weight_kg: structuredRecord.measurements.weight_kg || undefined,
          height_cm: structuredRecord.measurements.height_cm || undefined,
          pulse_bpm: structuredRecord.measurements.pulse_bpm || undefined
        },
        symptoms: structuredRecord.health_status.complaints.map(c => c.symptom),
        medications_given: structuredRecord.health_status.medications.map(m => m.name),
        services_provided: ['Vitals check']
      }];
    } else if (personUpdates.length > 0) {
      if (selectedPerson) {
        personUpdates[0].person_id = selectedPerson.person_id;
        personUpdates[0].name = selectedPerson.name;
        if (selectedPerson.age !== undefined) personUpdates[0].age = selectedPerson.age;
        if (selectedPerson.gender) personUpdates[0].gender = selectedPerson.gender;
      } else if (structuredRecord?.person?.name && (!personUpdates[0].name || personUpdates[0].name === 'Beneficiary' || personUpdates[0].name === 'Patient')) {
        personUpdates[0].name = structuredRecord.person.name;
      }
      if (sysBp && (!personUpdates[0].vitals || !personUpdates[0].vitals.systolic_bp)) {
        personUpdates[0].vitals = {
          ...(personUpdates[0].vitals || {}),
          systolic_bp: sysBp,
          diastolic_bp: diaBp
        };
      }
    }

    const visitId = visitDraft?.visit_id || structuredRecord?.visit?.visit_id || `visit-${Date.now()}`;
    const confirmed: ConfirmedVisit = {
      visit_id: visitId,
      household_id: targetHhId,
      worker_id: targetWorkerId,
      timestamp: new Date().toISOString(),
      person_updates: personUpdates,
      survey_fields: visitDraft?.survey_fields || [],
      malnutrition_assessment: visitDraft?.malnutrition_assessment,
      confirmed_by_worker_at: new Date().toISOString(),
      sync_status: isBackendConnected ? 'synced' : 'pending'
    };

    try {
      if (structuredRecord) {
        structuredRecord.visit.household_id = targetHhId;
        structuredRecord.visit.worker_id = targetWorkerId;
        if (selectedPerson) {
          structuredRecord.person.person_id = selectedPerson.person_id;
          structuredRecord.person.name = selectedPerson.name;
          if (selectedPerson.age !== undefined) structuredRecord.person.age = selectedPerson.age;
        }
        await saveStructuredRecord(structuredRecord);
        await apiClient.saveStructuredRecordToDatabase(structuredRecord);
        await refreshSavedRecords();
      }

      const submitResult = await apiClient.submitConfirmedVisit(confirmed);
      setVisitDraft(null);
      setStructuredRecord(null);
      if (submitResult.isMockFallback) {
        setSyncQueueCount((prev) => prev + 1);
      }
      setSaveFeedbackMsg('വിവരങ്ങൾ വിജയകരമായി സമർപ്പിച്ചു (Survey Filed & Synced)!');
      setLastActionMessage(`വിവരങ്ങൾ സ്ഥിരീകരിച്ചു: ${submitResult.message}`);
    } catch (err: any) {
      setSaveFeedbackMsg(`സമർപ്പിക്കുന്നതിൽ തടസ്സം: ${err.message || err}`);
    } finally {
      setIsSavingRecord(false);
      setTimeout(() => setSaveFeedbackMsg(null), 4000);
    }
  };

  // Auth Loading Gate
  if (isAuthLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#064E3B', justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar barStyle="light-content" backgroundColor="#064E3B" />
        <ActivityIndicator size="large" color="#34D399" />
        <Text style={{ color: '#D1FAE5', marginTop: 14, fontSize: 15, fontWeight: '700' }}>
          സ്വരം സിസ്റ്റം ആരംഭിക്കുന്നു... (Starting Swaram...)
        </Text>
      </SafeAreaView>
    );
  }

  // Authentication Gate: Render LoginScreen if not logged in
  if (!currentUser) {
    return (
      <LoginScreen
        onLoginSuccess={(profile) => {
          setCurrentUser(profile);
          setLastActionMessage(`Logged in as ${profile.name} (${profile.ward})`);
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#064E3B" />

      {/* App Header */}
      <View style={styles.header}>
        <View style={styles.headerBrandRow}>
          <View style={styles.logoCircle}>
            <Image
              source={require('./assets/swaram.png')}
              style={styles.headerLogoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.headerTitle}>സ്വരം (SWARAM)</Text>
        </View>

        <View style={styles.headerRightActions}>
          {/* AI Chatbot / AI Helper Button next to 3-Dot More Button */}
          <TouchableOpacity
            style={styles.headerAiButton}
            onPress={() => setIsChatbotOpen(true)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="സ്വരം AI സഹായി"
          >
            <AppIcon name="bot" size={20} color="#FFFFFF" />
            <View style={styles.headerAiDot} />
          </TouchableOpacity>

          {/* 3-Dot More Menu Button */}
          <TouchableOpacity
            style={styles.moreMenuButton}
            onPress={() => setShowMoreMenu(true)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.moreMenuIcon}>⋮</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 3-Dot More Menu Dropdown Modal */}
      <Modal
        visible={showMoreMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMoreMenu(false)}
      >
        <TouchableOpacity
          style={styles.dropdownBackdrop}
          activeOpacity={1}
          onPress={() => setShowMoreMenu(false)}
        >
          <View style={styles.dropdownMenu}>
            <TouchableOpacity
              style={styles.dropdownMenuItem}
              onPress={() => {
                setShowMoreMenu(false);
                setActiveTab('profile');
              }}
              activeOpacity={0.7}
            >
              <AppIcon name="profile" size={18} color="#047857" />
              <Text style={styles.dropdownMenuText}>പ്രൊഫൈൽ (Profile)</Text>
            </TouchableOpacity>

            <View style={styles.dropdownMenuDivider} />

            <TouchableOpacity
              style={styles.dropdownMenuItem}
              onPress={() => {
                setShowMoreMenu(false);
                handleLogout();
              }}
              activeOpacity={0.7}
            >
              <AppIcon name="logout" size={18} color="#EF4444" />
              <Text style={[styles.dropdownMenuText, styles.dropdownMenuTextDanger]}>
                ലോഗ് ഔട്ട് (Logout)
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sub-Header: Ward for Aluva Section */}
      <View style={styles.subHeader}>
        <View style={styles.subHeaderLeft}>
          <View style={styles.subHeaderPinCircle}>
            <AppIcon name="location" size={18} color="#34D399" />
          </View>
          <View style={styles.subHeaderTextCol}>
            <Text style={styles.subHeaderLabel}>ആരോഗ്യ വാർഡ്</Text>
            <Text style={styles.subHeaderWardTitle} numberOfLines={1}>{activeWard}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.subHeaderChangeBtn}
          onPress={() => setShowWardModal(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.subHeaderChangeText}>മാറ്റുക ▾</Text>
        </TouchableOpacity>
      </View>

      {/* Core Field Survey Tab View */}
      {activeTab === 'core' && (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Numbered Household & Citizen Selector Card (Context Anchor) */}
        <HouseholdPersonSelector
          households={households}
          selectedHousehold={selectedHousehold}
          onSelectHousehold={handleSelectHousehold}
          members={householdMembers}
          selectedPerson={selectedPerson}
          onSelectPerson={handleSelectPerson}
          isLoadingMembers={isLoadingMembers}
          onAddNewMember={handleAddNewMember}
          onAddNewHousehold={handleAddNewHousehold}
        />

        {/* Conversational Survey Capture Section */}
        <View style={styles.voiceSection}>
          <Text style={styles.sectionHeading}>സംഭാഷണ സർവേ</Text>
          <Text style={styles.instructionText}>
            സ്വാഭാവിക മലയാളത്തിൽ സംസാരിക്കുക: വൈറ്റൽസ്, ലക്ഷണങ്ങൾ, മരുന്നുകൾ, അടുത്ത സന്ദർശന തീയതി എന്നിവ പറയുക.
          </Text>

          {/* Live Recording Button */}
          <TouchableOpacity
            style={[
              styles.recordButton,
              isRecording ? styles.recordButtonActive : styles.recordButtonIdle
            ]}
            onPress={handleToggleVoiceRecording}
            disabled={isProcessingVoice}
          >
            {isProcessingVoice ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.recordButtonText}>ശബ്ദം പ്രോസസ്സ് ചെയ്യുന്നു...</Text>
              </View>
            ) : (
              <View style={styles.buttonContent}>
                {isRecording ? (
                  <>
                    <AppIcon name="stop" size={18} color="#FFFFFF" />
                    <View style={styles.recPulseDot} />
                    <Text style={styles.recordButtonText}>
                      {Math.floor(recordingDuration / 60).toString().padStart(2, '0')}:{(recordingDuration % 60).toString().padStart(2, '0')} - നിർത്തുക
                    </Text>
                  </>
                ) : (
                  <>
                    <AppIcon name="mic" size={20} color="#FFFFFF" />
                    <Text style={styles.recordButtonText}>ശബ്ദം രേഖപ്പെടുത്തുക</Text>
                  </>
                )}
              </View>
            )}
          </TouchableOpacity>

          {/* Dedicated Transcription Output Display */}
          {indicConformerTranscript && (
            <View style={styles.indicConformerCard}>
              <View style={styles.indicConformerHeader}>
                <Text style={styles.transcriptCardTitle}>ശബ്ദരേഖ</Text>
                <Text style={styles.indicConformerLang}>മലയാളം (Malayalam)</Text>
              </View>

              {/* Editable Transcript Area */}
              <View style={styles.editTranscriptBox}>
                <View style={styles.editTranscriptHeader}>
                  <View style={styles.editTranscriptTitleRow}>
                    <AppIcon name="edit" size={14} color="#34D399" />
                    <Text style={styles.editTranscriptHint}>തിരുത്താൻ ടാപ്പ് ചെയ്യുക:</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.reanalyzeBtn}
                    onPress={() => handleReanalyzeTranscript(indicConformerTranscript)}
                    disabled={isProcessingVoice}
                    activeOpacity={0.8}
                  >
                    <AppIcon name="refresh" size={12} color="#FFFFFF" />
                    <Text style={styles.reanalyzeBtnText}>അപ്‌ഡേറ്റ്</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.indicConformerInput}
                  multiline
                  value={indicConformerTranscript}
                  onChangeText={(newTxt) => setIndicConformerTranscript(newTxt)}
                  placeholder="ശബ്ദരേഖ ഇവിടെ കാണാം..."
                  placeholderTextColor="#6EE7B7"
                />
              </View>
            </View>
          )}
        </View>

        {/* Structured Clinical Record Extraction Card */}
        {structuredRecord && (
          <View style={styles.structuredRecordCard}>
            <View style={styles.structuredHeader}>
              <View style={styles.structuredTitleRow}>
                <View style={styles.structuredTitleGroup}>
                  <AppIcon name="document" size={18} color="#047857" />
                  <Text style={styles.structuredHeaderTitle}>തിരിച്ചറിഞ്ഞ വിവരങ്ങൾ</Text>
                </View>
                <View style={styles.recordStatusBadge}>
                  <Text style={styles.recordStatusBadgeText}>തയ്യാറാണ്</Text>
                </View>
              </View>
            </View>

            {/* Person & Demographics */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <AppIcon name="user" size={15} color="#047857" />
                <Text style={styles.sectionBlockTitle}>വ്യക്തിഗത വിവരങ്ങൾ</Text>
              </View>
              <View style={styles.gridRow}>
                <View style={styles.gridCol}>
                  <Text style={styles.labelMuted}>പേര്:</Text>
                  <Text style={styles.valueStrong}>{structuredRecord.person.name || selectedPerson?.name || 'രേഖപ്പെടുത്തിയിട്ടില്ല'}</Text>
                </View>
                <View style={styles.gridCol}>
                  <Text style={styles.labelMuted}>പ്രായം:</Text>
                  <Text style={styles.valueStrong}>
                    {structuredRecord.person.age !== null ? `${structuredRecord.person.age} വയസ്സ്` : (selectedPerson?.age !== undefined ? `${selectedPerson.age} വയസ്സ്` : 'N/A')}
                  </Text>
                </View>
                <View style={styles.gridCol}>
                  <Text style={styles.labelMuted}>ലിംഗം:</Text>
                  <Text style={styles.valueStrong}>{(structuredRecord.person.sex || selectedPerson?.gender || 'N/A').toUpperCase()}</Text>
                </View>
              </View>
              {structuredRecord.person.pregnancy_status === 'pregnant' && (
                <View style={styles.pregnantPill}>
                  <Text style={styles.pregnantPillText}>ഗർഭാവസ്ഥ (ANC Care Active)</Text>
                </View>
              )}
            </View>

            {/* Measurements & Vitals */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <AppIcon name="stethoscope" size={15} color="#047857" />
                <Text style={styles.sectionBlockTitle}>പരിശോധനാ ഫലങ്ങൾ (Vitals)</Text>
              </View>
              <View style={styles.vitalsRow}>
                <View style={styles.vitalCard}>
                  <Text style={styles.vitalLabel}>ബിപി (BP)</Text>
                  <Text style={styles.vitalValue}>{structuredRecord.measurements.blood_pressure || '--'}</Text>
                  <Text style={styles.vitalUnit}>mmHg</Text>
                </View>
                <View style={styles.vitalCard}>
                  <Text style={styles.vitalLabel}>പൾസ് (Pulse)</Text>
                  <Text style={styles.vitalValue}>{structuredRecord.measurements.pulse_bpm !== null ? `${structuredRecord.measurements.pulse_bpm}` : '--'}</Text>
                  <Text style={styles.vitalUnit}>bpm</Text>
                </View>
                <View style={styles.vitalCard}>
                  <Text style={styles.vitalLabel}>ഭാരം (Weight)</Text>
                  <Text style={styles.vitalValue}>{structuredRecord.measurements.weight_kg !== null ? `${structuredRecord.measurements.weight_kg}` : '--'}</Text>
                  <Text style={styles.vitalUnit}>kg</Text>
                </View>
              </View>
              <View style={[styles.vitalsRow, { marginTop: 6 }]}>
                <View style={styles.vitalCard}>
                  <Text style={styles.vitalLabel}>ഷുഗർ (Sugar)</Text>
                  <Text style={styles.vitalValue}>{structuredRecord.measurements.blood_sugar_mg_dl !== null ? `${structuredRecord.measurements.blood_sugar_mg_dl}` : '--'}</Text>
                  <Text style={styles.vitalUnit}>mg/dL</Text>
                </View>
                <View style={styles.vitalCard}>
                  <Text style={styles.vitalLabel}>പനി (Temp)</Text>
                  <Text style={styles.vitalValue}>{structuredRecord.measurements.temperature_f !== null ? `${structuredRecord.measurements.temperature_f}` : '--'}</Text>
                  <Text style={styles.vitalUnit}>°F</Text>
                </View>
                <View style={styles.vitalCard}>
                  <Text style={styles.vitalLabel}>ഉയരം (Height)</Text>
                  <Text style={styles.vitalValue}>{structuredRecord.measurements.height_cm !== null ? `${structuredRecord.measurements.height_cm}` : '--'}</Text>
                  <Text style={styles.vitalUnit}>cm</Text>
                </View>
              </View>

              {/* Acute BP alert if high */}
              {(() => {
                const bpStr = String(structuredRecord.measurements.blood_pressure || '').trim();
                const sysVal = parseInt(bpStr.split(/[\/\s-]+/)[0], 10);
                if (sysVal && sysVal >= 135) {
                  return (
                    <View style={styles.alertNoticeBox}>
                      <AppIcon name="alert" size={14} color="#DC2626" />
                      <Text style={styles.alertNoticeText}>
                        രക്തസമ്മർദ്ദത്തിൽ വ്യതിയാനം (High BP: {sysVal} mmHg)
                      </Text>
                    </View>
                  );
                }
                return null;
              })()}

              {/* Mental Health Metrics */}
              {(structuredRecord.mental_social?.phq4_assessment?.anxiety_score !== null || structuredRecord.mental_social?.phq4_assessment?.depression_score !== null) && (
                <View style={[styles.vitalsRow, { marginTop: 6 }]}>
                  <View style={[styles.vitalCard, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                    <Text style={[styles.vitalLabel, { color: '#475569' }]}>Anxiety Score (GAD-2)</Text>
                    <Text style={[styles.vitalValue, { color: '#0F172A' }]}>
                      {structuredRecord.mental_social?.phq4_assessment?.anxiety_score !== null && structuredRecord.mental_social?.phq4_assessment?.anxiety_score !== undefined
                        ? `${structuredRecord.mental_social.phq4_assessment.anxiety_score} / 6`
                        : '-'}
                    </Text>
                    <Text style={styles.vitalUnit}>GAD-2</Text>
                  </View>
                  <View style={[styles.vitalCard, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                    <Text style={[styles.vitalLabel, { color: '#475569' }]}>Depression Score (PHQ-2)</Text>
                    <Text style={[styles.vitalValue, { color: '#0F172A' }]}>
                      {structuredRecord.mental_social?.phq4_assessment?.depression_score !== null && structuredRecord.mental_social?.phq4_assessment?.depression_score !== undefined
                        ? `${structuredRecord.mental_social.phq4_assessment.depression_score} / 6`
                        : '-'}
                    </Text>
                    <Text style={styles.vitalUnit}>PHQ-2</Text>
                  </View>
                </View>
              )}

              {/* Extra Metric Box for WHO Growth Z-Score (Infant/Child Scoped ONLY) */}
              {(structuredRecord.nutrition.child_nutrition.sam_mam_risk !== 'unknown' || (structuredRecord.person.age !== null && structuredRecord.person.age <= 5)) && (
                <TouchableOpacity
                  style={[styles.vitalsRow, { marginTop: 6 }]}
                  onPress={() => setShowZScoreModal(true)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.vitalCard, { flex: 1, backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', paddingVertical: 8 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <Text style={[styles.vitalLabel, { color: '#166534' }]}>WHO Growth Z-Score (WAZ)</Text>
                      <View style={{
                        backgroundColor: structuredRecord.nutrition.child_nutrition.sam_mam_risk === 'sam' ? '#FEE2E2' : (structuredRecord.nutrition.child_nutrition.sam_mam_risk === 'mam' ? '#FEF3C7' : '#DCFCE7'),
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 10
                      }}>
                        <Text style={{
                          fontSize: 10,
                          fontWeight: '700',
                          color: structuredRecord.nutrition.child_nutrition.sam_mam_risk === 'sam' ? '#991B1B' : (structuredRecord.nutrition.child_nutrition.sam_mam_risk === 'mam' ? '#92400E' : '#166534')
                        }}>
                          {structuredRecord.nutrition.child_nutrition.sam_mam_risk.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.vitalValue, { color: '#14532D', marginTop: 4 }]}>
                      {structuredRecord.care_history.allergies.find(a => a.includes('WHO WAZ')) || 'WAZ: -1.53'}
                    </Text>
                    <Text style={[styles.vitalUnit, { color: '#15803D' }]}>വിശദാംശങ്ങൾക്ക് ടാപ്പ് ചെയ്യുക</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* Health Status: Complaints, Conditions, Medications */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <AppIcon name="pill" size={15} color="#047857" />
                <Text style={styles.sectionBlockTitle}>ലക്ഷണങ്ങളും മരുന്നുകളും</Text>
              </View>
              {structuredRecord.health_status.complaints.length > 0 ? (
                structuredRecord.health_status.complaints.map((c, i) => (
                  <Text key={i} style={styles.bulletItem}>
                    • <Text style={styles.bold}>{c.symptom}</Text> ({c.duration}, {c.severity})
                  </Text>
                ))
              ) : (
                <Text style={styles.noDataText}>പ്രത്യേക അസുഖ ലക്ഷണങ്ങൾ ഇല്ല (No acute complaints)</Text>
              )}

              {structuredRecord.health_status.medications.length > 0 && (
                <View style={{ marginTop: 6 }}>
                  <Text style={styles.subHeading}>നൽകിയ മരുന്നുകൾ:</Text>
                  {structuredRecord.health_status.medications.map((m, i) => (
                    <Text key={i} style={styles.bulletItem}>
                      • <Text style={styles.bold}>{m.name}</Text> ({m.adherence.toUpperCase()})
                    </Text>
                  ))}
                </View>
              )}
            </View>

            {/* Care Gaps */}
            {structuredRecord.care_gaps.length > 0 && (
              <View style={styles.careGapsBlock}>
                <View style={styles.sectionHeaderRow}>
                  <AppIcon name="alert" size={14} color="#991B1B" />
                  <Text style={styles.careGapsBlockTitle}>ശ്രദ്ധിക്കേണ്ട കാര്യങ്ങൾ:</Text>
                </View>
                {structuredRecord.care_gaps.map((gap, i) => (
                  <View key={i} style={styles.gapRowItem}>
                    <View style={[styles.gapBadge, gap.severity === 'high' ? styles.gapBadgeHigh : styles.gapBadgeMed]}>
                      <Text style={styles.gapBadgeText}>{gap.gap_type.toUpperCase()} • {gap.severity.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.gapDescText}>{gap.description}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Follow-up */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <AppIcon name="calendar" size={14} color="#047857" />
                <Text style={styles.sectionBlockTitle}>തുടർപരിശോധന (Follow-up)</Text>
              </View>
              <Text style={styles.bulletItem}>
                • ആവശ്യമുള്ളത്: <Text style={styles.bold}>{structuredRecord.follow_up.required.toUpperCase()}</Text>
                {structuredRecord.follow_up.due_date ? ` (തീയതി: ${structuredRecord.follow_up.due_date})` : ''}
              </Text>
              {structuredRecord.follow_up.reason ? (
                <Text style={styles.bulletItem}>
                  • നിർദ്ദേശം: <Text style={styles.bold}>{structuredRecord.follow_up.reason}</Text>
                </Text>
              ) : null}
            </View>

            {/* Save Feedback Alert */}
            {saveFeedbackMsg && (
              <View style={styles.saveAlertBox}>
                <AppIcon name="check" size={14} color="#03543F" />
                <Text style={styles.saveAlertText}>{saveFeedbackMsg}</Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtonRow}>
              <TouchableOpacity
                style={styles.saveRecordBtn}
                onPress={handleConfirmVisit}
                disabled={isSavingRecord}
                activeOpacity={0.85}
              >
                {isSavingRecord ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={styles.saveBtnContent}>
                    <AppIcon name="check" size={16} color="#FFFFFF" />
                    <Text style={styles.saveRecordBtnText}>സ്ഥിരീകരിച്ച് സേവ് ചെയ്യുക</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelDraftBtn}
                onPress={handleCancelEntry}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelDraftBtnText}>റദ്ദാക്കുക</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.viewStructuredBtn}
                onPress={() => handleOpenStructuredRecordModal(structuredRecord)}
                activeOpacity={0.8}
              >
                <Text style={styles.viewStructuredBtnText}>വിശദാംശങ്ങൾ</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Central Stored Clinical Records History */}
        <View style={styles.historyCard}>
          <View style={styles.historyHeader}>
            <View>
              <Text style={styles.historyTitle}>
                സേവ് ചെയ്ത രേഖകൾ ({savedRecords.length})
              </Text>
              <Text style={styles.historySubtitle}>Stored in Central MongoDB Database</Text>
            </View>
            {savedRecords.length > 0 && (
              <TouchableOpacity style={styles.exportAllBtn} onPress={handleOpenBatchExportModal} activeOpacity={0.8}>
                <Text style={styles.exportAllBtnText}>റിപ്പോർട്ട്</Text>
              </TouchableOpacity>
            )}
          </View>

          {savedRecords.length === 0 ? (
            <Text style={styles.emptyHistoryText}>
              ഇതുവരെ രേഖകൾ ഒന്നും സേവ് ചെയ്തിട്ടില്ല. ശബ്ദം റെക്കോർഡ് ചെയ്ത് "സ്ഥിരീകരിച്ച് സേവ് ചെയ്യുക" ക്ലിക്ക് ചെയ്യുക.
            </Text>
          ) : (
            savedRecords.map((item) => (
              <View key={item.visit.visit_id} style={styles.historyItem}>
                <View style={styles.historyItemTop}>
                  <Text style={styles.historyItemName}>
                    {item.person.name || 'Beneficiary'} ({item.person.age !== null ? `${item.person.age}y` : '?'}, {item.person.sex.toUpperCase()})
                  </Text>
                  <Text style={styles.historyItemDate}>{item.visit.date}</Text>
                </View>
                <Text style={styles.historyItemDetails}>
                  BP: {item.measurements.blood_pressure || '--'} | Wt: {item.measurements.weight_kg ? `${item.measurements.weight_kg}kg` : '--'} | Sugar: {item.measurements.blood_sugar_mg_dl ? `${item.measurements.blood_sugar_mg_dl}mg/dL` : '--'}
                </Text>
                <View style={styles.historyItemActions}>
                  <TouchableOpacity
                    style={styles.historyViewBtn}
                    onPress={() => handleOpenStructuredRecordModal(item)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.historyViewBtnText}>വിശദാംശങ്ങൾ</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.historyDelBtn}
                    onPress={() => handleDeleteRecord(item.visit.visit_id)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.historyDelBtnText}>ഡിലീറ്റ്</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>


      </ScrollView>
      )}

      {/* Feature Module Views */}
      {activeTab === 'mental' && (
        <MentalHealthScreen
          activePerson={selectedPerson}
          activeHousehold={selectedHousehold}
          households={households}
          householdMembers={householdMembers}
          onSelectHousehold={handleSelectHousehold}
          onSelectPerson={handleSelectPerson}
          isLoadingMembers={isLoadingMembers}
          onAddNewMember={handleAddNewMember}
          onAddNewHousehold={handleAddNewHousehold}
          workerId={currentUser?.worker_id}
          onSaved={refreshSavedRecords}
        />
      )}
      {activeTab === 'climate' && (
        <EnvironmentalRiskScreen
          activeHousehold={selectedHousehold}
          activePerson={selectedPerson}
          households={households}
          householdMembers={householdMembers}
          onSelectHousehold={handleSelectHousehold}
          onSelectPerson={handleSelectPerson}
        />
      )}
      {activeTab === 'lifestyle' && (
        <NcdLifestyleScreen
          activeHousehold={selectedHousehold}
          activePerson={selectedPerson}
          households={households}
          householdMembers={householdMembers}
          onSelectHousehold={handleSelectHousehold}
          onSelectPerson={handleSelectPerson}
          onBack={() => setActiveTab('core')}
        />
      )}
      {activeTab === 'vitals' && (
        <VitalsBaselineScreen
          activeHousehold={selectedHousehold}
          activePerson={selectedPerson}
          households={households}
          householdMembers={householdMembers}
          onSelectHousehold={handleSelectHousehold}
          onSelectPerson={handleSelectPerson}
          isLoadingMembers={isLoadingMembers}
          onAddNewMember={handleAddNewMember}
          onAddNewHousehold={handleAddNewHousehold}
        />
      )}
      {activeTab === 'profile' && (
        <AshaProfileScreen
          currentUser={currentUser}
          activeWard={activeWard}
          onUpdateWard={(newWard) => {
            setActiveWard(newWard);
            setLastActionMessage(`വാർഡ് മാറ്റി: ${newWard}`);
          }}
          onLogout={handleLogout}
          onBack={() => setActiveTab('core')}
        />
      )}

      {/* Persistent Bottom Tab Navigation Bar */}
      <BottomTabBar activeTab={activeTab} onTabSelect={setActiveTab} />

      {/* Swaram ASHA AI Chatbot Modal */}
      <AshaChatbotModal
        visible={isChatbotOpen}
        onClose={() => setIsChatbotOpen(false)}
      />

      {/* Structured Clinical Record Detail Pop-up Modal (No Raw JSON) */}
      <Modal
        visible={showStructuredViewModal && selectedRecordToView !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowStructuredViewModal(false)}
      >
        <View style={styles.structuredModalOverlay}>
          <View style={styles.structuredModalCard}>
            <View style={styles.structuredModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.structuredModalTitle}>
                  {selectedRecordToView?.person.name || 'ഗുണഭോക്താവ്'} - ക്ലിനിക്കൽ വിവരങ്ങൾ
                </Text>
                <Text style={styles.structuredModalSubtitle}>
                  വിസിറ്റ് തീയതി: {selectedRecordToView?.visit.date} • ID: {selectedRecordToView?.visit.visit_id}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.structuredModalCloseBtn}
                onPress={() => setShowStructuredViewModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.structuredModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedRecordToView && (
              <ScrollView style={styles.structuredModalScroll} showsVerticalScrollIndicator={false}>
                {/* Person Demographics Card */}
                <View style={styles.modalSectionCard}>
                  <Text style={styles.modalSectionHeading}>വ്യക്തിഗത വിവരങ്ങൾ (Beneficiary Details)</Text>
                  <View style={styles.modalDetailGrid}>
                    <View style={styles.modalDetailCol}>
                      <Text style={styles.modalDetailLabel}>പേര് (Name):</Text>
                      <Text style={styles.modalDetailVal}>{selectedRecordToView.person.name || 'രേഖപ്പെടുത്തിയിട്ടില്ല'}</Text>
                    </View>
                    <View style={styles.modalDetailCol}>
                      <Text style={styles.modalDetailLabel}>പ്രായം (Age):</Text>
                      <Text style={styles.modalDetailVal}>
                        {selectedRecordToView.person.age !== null ? `${selectedRecordToView.person.age} വയസ്സ്` : 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.modalDetailCol}>
                      <Text style={styles.modalDetailLabel}>ലിംഗം (Sex):</Text>
                      <Text style={styles.modalDetailVal}>{selectedRecordToView.person.sex.toUpperCase()}</Text>
                    </View>
                  </View>
                  {selectedRecordToView.person.pregnancy_status === 'pregnant' && (
                    <View style={styles.pregnantNoticeBox}>
                      <Text style={styles.pregnantNoticeText}>ഗർഭാവസ്ഥയിലുള്ള ഗുണഭോക്താവ് (ANC Care Active)</Text>
                    </View>
                  )}
                </View>

                {/* Vitals & Measurements Card */}
                <View style={styles.modalSectionCard}>
                  <Text style={styles.modalSectionHeading}>പരിശോധനാ ഫലങ്ങൾ (Measurements & Vitals)</Text>
                  <View style={styles.modalVitalsGrid}>
                    <View style={styles.modalVitalItem}>
                      <Text style={styles.modalVitalLabel}>രക്തസമ്മർദ്ദം (BP)</Text>
                      <Text style={styles.modalVitalVal}>{selectedRecordToView.measurements.blood_pressure || '--'}</Text>
                      <Text style={styles.modalVitalUnit}>mmHg</Text>
                    </View>
                    <View style={styles.modalVitalItem}>
                      <Text style={styles.modalVitalLabel}>ശരീരഭാരം (Weight)</Text>
                      <Text style={styles.modalVitalVal}>
                        {selectedRecordToView.measurements.weight_kg !== null ? `${selectedRecordToView.measurements.weight_kg}` : '--'}
                      </Text>
                      <Text style={styles.modalVitalUnit}>kg</Text>
                    </View>
                    <View style={styles.modalVitalItem}>
                      <Text style={styles.modalVitalLabel}>ഉയരം (Height)</Text>
                      <Text style={styles.modalVitalVal}>
                        {selectedRecordToView.measurements.height_cm !== null ? `${selectedRecordToView.measurements.height_cm}` : '--'}
                      </Text>
                      <Text style={styles.modalVitalUnit}>cm</Text>
                    </View>
                  </View>

                  <View style={[styles.modalVitalsGrid, { marginTop: 6 }]}>
                    <View style={styles.modalVitalItem}>
                      <Text style={styles.modalVitalLabel}>പൾസ് (Pulse)</Text>
                      <Text style={styles.modalVitalVal}>
                        {selectedRecordToView.measurements.pulse_bpm !== null ? `${selectedRecordToView.measurements.pulse_bpm}` : '--'}
                      </Text>
                      <Text style={styles.modalVitalUnit}>bpm</Text>
                    </View>
                    <View style={styles.modalVitalItem}>
                      <Text style={styles.modalVitalLabel}>ഷുഗർ (Sugar)</Text>
                      <Text style={styles.modalVitalVal}>
                        {selectedRecordToView.measurements.blood_sugar_mg_dl !== null ? `${selectedRecordToView.measurements.blood_sugar_mg_dl}` : '--'}
                      </Text>
                      <Text style={styles.modalVitalUnit}>mg/dL</Text>
                    </View>
                    <View style={styles.modalVitalItem}>
                      <Text style={styles.modalVitalLabel}>പനി (Temp)</Text>
                      <Text style={styles.modalVitalVal}>
                        {selectedRecordToView.measurements.temperature_f !== null ? `${selectedRecordToView.measurements.temperature_f}` : '--'}
                      </Text>
                      <Text style={styles.modalVitalUnit}>°F</Text>
                    </View>
                  </View>
                </View>

                {/* Symptoms & Complaints Card */}
                <View style={styles.modalSectionCard}>
                  <Text style={styles.modalSectionHeading}>ലക്ഷണങ്ങളും രോഗവിവരങ്ങളും (Symptoms)</Text>
                  {selectedRecordToView.health_status.complaints.length > 0 ? (
                    selectedRecordToView.health_status.complaints.map((c, i) => (
                      <Text key={i} style={styles.modalBulletItem}>
                        • <Text style={{ fontWeight: '700' }}>{c.symptom}</Text> ({c.duration}, {c.severity})
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.modalEmptyMuted}>പ്രത്യേക അസുഖ ലക്ഷണങ്ങൾ ഇല്ല (No acute complaints)</Text>
                  )}
                </View>

                {/* Medications Given Card */}
                <View style={styles.modalSectionCard}>
                  <Text style={styles.modalSectionHeading}>നൽകിയ മരുന്നുകൾ (Medications Given)</Text>
                  {selectedRecordToView.health_status.medications.length > 0 ? (
                    selectedRecordToView.health_status.medications.map((m, i) => (
                      <Text key={i} style={styles.modalBulletItem}>
                        • <Text style={{ fontWeight: '700' }}>{m.name}</Text> (Adherence: {m.adherence.toUpperCase()}, Taking: {m.taking.toUpperCase()})
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.modalEmptyMuted}>മരുന്നുകൾ നൽകിയിട്ടില്ല (No medications recorded)</Text>
                  )}
                </View>

                {/* Follow-up Plan */}
                <View style={styles.modalSectionCard}>
                  <Text style={styles.modalSectionHeading}>തുടർപരിശോധന (Follow-up & Care Plan)</Text>
                  <Text style={styles.modalBulletItem}>
                    • തുടർപരിശോധന: <Text style={{ fontWeight: '700' }}>{selectedRecordToView.follow_up.required.toUpperCase()}</Text>
                  </Text>
                  {selectedRecordToView.follow_up.due_date && (
                    <Text style={styles.modalBulletItem}>
                      • തീയതി (Due Date): <Text style={{ fontWeight: '700' }}>{selectedRecordToView.follow_up.due_date}</Text>
                    </Text>
                  )}
                  {selectedRecordToView.follow_up.reason && (
                    <Text style={styles.modalBulletItem}>
                      • നിർദ്ദേശം: {selectedRecordToView.follow_up.reason}
                    </Text>
                  )}
                </View>

                {/* Share/Copy Action Button */}
                <TouchableOpacity
                  style={styles.modalShareBtn}
                  onPress={async () => {
                    const report = formatStructuredRecordToReport(selectedRecordToView);
                    try {
                      await Share.share({ message: report, title: 'Swaram Clinical Report' });
                    } catch (e) {
                      console.warn('Share error:', e);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalShareBtnText}>റിപ്പോർട്ട് ഷെയർ ചെയ്യുക</Text>
                </TouchableOpacity>

                <View style={{ height: 16 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Structured Clinical Report Export Modal */}
      <Modal
        visible={showExportReportModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowExportReportModal(false)}
      >
        <View style={styles.structuredModalOverlay}>
          <View style={styles.structuredModalCard}>
            <View style={styles.structuredModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.structuredModalTitle}>ക്ലിനിക്കൽ റിപ്പോർട്ട്</Text>
                <Text style={styles.structuredModalSubtitle}>Formatted structured records for field reporting</Text>
              </View>
              <TouchableOpacity
                style={styles.structuredModalCloseBtn}
                onPress={() => setShowExportReportModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.structuredModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.structuredModalScroll}>
              <TextInput
                style={styles.exportReportTextInput}
                multiline
                editable={false}
                value={exportReportText}
              />
            </ScrollView>

            <TouchableOpacity
              style={styles.modalShareBtn}
              onPress={async () => {
                try {
                  await Share.share({ message: exportReportText, title: 'Swaram All Records Summary' });
                } catch (e) {
                  console.warn('Share error:', e);
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.modalShareBtnText}>മുഴുവൻ റിപ്പോർട്ടും ഷെയർ ചെയ്യുക (Share Report)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Ward Selector Modal (10 Wards) */}
      <Modal
        visible={showWardModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowWardModal(false)}
      >
        <View style={styles.structuredModalOverlay}>
          <View style={[styles.structuredModalCard, { maxHeight: 480 }]}>
            <View style={styles.structuredModalHeader}>
              <View>
                <Text style={styles.structuredModalTitle}>വാർഡ് തിരഞ്ഞെടുക്കുക</Text>
                <Text style={styles.structuredModalSubtitle}>ആലുവ മുനിസിപ്പാലിറ്റി (Select Health Ward)</Text>
              </View>
              <TouchableOpacity
                style={styles.structuredModalCloseBtn}
                onPress={() => setShowWardModal(false)}
              >
                <Text style={styles.structuredModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ marginTop: 8 }}>
              {ALL_ALUVA_WARDS.map((w, idx) => {
                const isSelected = activeWard === w;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.wardModalItem, isSelected && styles.wardModalItemSelected]}
                    onPress={() => {
                      setActiveWard(w);
                      setShowWardModal(false);
                      setLastActionMessage(`വാർഡ് മാറ്റി: ${w}`);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.wardModalItemText, isSelected && styles.wardModalItemTextSelected]}>
                      {w}
                    </Text>
                    {isSelected && <AppIcon name="check" size={16} color="#0D9488" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* WHO Growth Z-Score Interactive Ranges Modal */}
      <Modal
        visible={showZScoreModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowZScoreModal(false)}
      >
        <TouchableOpacity
          style={styles.zModalOverlay}
          activeOpacity={1}
          onPress={() => setShowZScoreModal(false)}
        >
          <View style={styles.zModalContainer}>
            <Text style={styles.zModalTitle}>WHO Child Growth Z-Score Ranges</Text>
            <Text style={styles.zModalSubtitle}>Weight-for-Age (WAZ) Standard Classification</Text>

            {/* Current Active Category Banner */}
            <View style={styles.zModalActiveBanner}>
              <Text style={styles.zModalActiveText}>
                Current Status: <Text style={{ fontWeight: '700' }}>{(structuredRecord?.nutrition?.child_nutrition?.sam_mam_risk || 'mam').toUpperCase()}</Text>
              </Text>
            </View>

            <View style={styles.zRangesList}>
              <View style={[styles.zRangeItem, structuredRecord?.nutrition?.child_nutrition?.sam_mam_risk === 'normal' && styles.zRangeItemActiveNormal]}>
                <View style={styles.zRangeTitleRow}>
                  <View style={[styles.colorChip, { backgroundColor: '#059669' }]} />
                  <Text style={[styles.zRangeTitle, { color: '#065F46' }]}>Normal Growth (Z ≥ -1.0)</Text>
                </View>
                <Text style={styles.zRangeDesc}>Healthy weight trajectory according to WHO growth standards.</Text>
              </View>

              <View style={[styles.zRangeItem, structuredRecord?.nutrition?.child_nutrition?.sam_mam_risk === 'mild' && styles.zRangeItemActiveMild]}>
                <View style={styles.zRangeTitleRow}>
                  <View style={[styles.colorChip, { backgroundColor: '#D97706' }]} />
                  <Text style={[styles.zRangeTitle, { color: '#854D0E' }]}>Mild Underweight {"(-2.0 ≤ Z < -1.0)"}</Text>
                </View>
                <Text style={styles.zRangeDesc}>Slightly lower weight trajectory; monitor dietary intake.</Text>
              </View>

              <View style={[styles.zRangeItem, (structuredRecord?.nutrition?.child_nutrition?.sam_mam_risk === 'mam' || !structuredRecord?.nutrition?.child_nutrition?.sam_mam_risk) && styles.zRangeItemActiveMam]}>
                <View style={styles.zRangeTitleRow}>
                  <View style={[styles.colorChip, { backgroundColor: '#EA580C' }]} />
                  <Text style={[styles.zRangeTitle, { color: '#9A3412' }]}>MAM - Moderate Acute Malnutrition {"(-3.0 ≤ Z < -2.0)"}</Text>
                </View>
                <Text style={styles.zRangeDesc}>Moderate underweight; dietary diversity & IFA supplementation indicated.</Text>
              </View>

              <View style={[styles.zRangeItem, structuredRecord?.nutrition?.child_nutrition?.sam_mam_risk === 'sam' && styles.zRangeItemActiveSam]}>
                <View style={styles.zRangeTitleRow}>
                  <View style={[styles.colorChip, { backgroundColor: '#DC2626' }]} />
                  <Text style={[styles.zRangeTitle, { color: '#991B1B' }]}>SAM - Severe Acute Malnutrition {"(Z < -3.0)"}</Text>
                </View>
                <Text style={styles.zRangeDesc}>Severe underweight; immediate medical officer evaluation required.</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.zModalCloseBtn} onPress={() => setShowZScoreModal(false)}>
              <Text style={styles.zModalCloseBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  header: {
    backgroundColor: '#042F2E',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4
      },
      android: {
        elevation: 4
      },
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
      }
    })
  },
  headerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  logoCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0F766E',
    borderWidth: 1.5,
    borderColor: '#2DD4BF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  headerLogoImage: {
    width: 32,
    height: 32
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: -0.2
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  headerAiButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#34D399',
    position: 'relative'
  },
  headerAiDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#34D399'
  },
  moreMenuButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  moreMenuIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: -2
  },
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: Platform.OS === 'web' ? 56 : (StatusBar.currentHeight ? StatusBar.currentHeight + 50 : 54),
    paddingRight: 16
  },
  dropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    minWidth: 190,
    paddingVertical: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 10
      },
      android: {
        elevation: 8
      },
      web: {
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.18)'
      }
    }),
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12
  },
  dropdownMenuIcon: {
    fontSize: 18
  },
  dropdownMenuText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1E293B'
  },
  dropdownMenuTextDanger: {
    color: '#EF4444'
  },
  dropdownMenuDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 8
  },
  subHeader: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)'
  },
  subHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1
  },
  subHeaderPinCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  subHeaderTextCol: {
    flex: 1
  },
  subHeaderLabel: {
    fontSize: 10.5,
    color: '#A7F3D0',
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase'
  },
  subHeaderWardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 1
  },
  subHeaderChangeBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginLeft: 8
  },
  subHeaderChangeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700'
  },
  syncBadge: {
    backgroundColor: '#047857',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14
  },
  syncBadgeText: {
    color: '#E6FFFA',
    fontSize: 11,
    fontWeight: '600'
  },
  scrollContent: {
    paddingTop: 0,
    paddingHorizontal: 0,
    paddingBottom: 40
  },
  networkBanner: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  bannerOnline: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
    borderWidth: 1
  },
  bannerOffline: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8
  },
  dotGreen: {
    backgroundColor: '#10B981'
  },
  dotAmber: {
    backgroundColor: '#F59E0B'
  },
  bannerText: {
    fontSize: 12,
    color: '#1F2937'
  },
  ipSubtitleText: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2
  },
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  ipConfigToggleBtn: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6
  },
  ipConfigToggleText: {
    color: '#374151',
    fontSize: 11,
    fontWeight: '600'
  },
  testCallButton: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  testCallButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600'
  },
  ipConfigCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  ipConfigLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6
  },
  ipInputRow: {
    flexDirection: 'row',
    gap: 8
  },
  ipInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: '#111827'
  },
  ipSaveButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    justifyContent: 'center'
  },
  ipSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold'
  },

  cbacLauncherCard: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    elevation: 2
  },
  cbacLauncherLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  cbacIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#065F46',
    alignItems: 'center',
    justifyContent: 'center'
  },
  cbacIconEmoji: {
    fontSize: 22
  },
  cbacHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6
  },
  cbacLauncherTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#064E3B'
  },
  cbacTag: {
    backgroundColor: '#047857',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6
  },
  cbacTagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold'
  },
  cbacLauncherSubtitle: {
    fontSize: 11,
    color: '#065F46',
    marginTop: 2,
    lineHeight: 15
  },
  cbacActionPrompt: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#047857',
    marginTop: 6
  },

  voiceSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#0D9488',
    ...Platform.select({
      ios: {
        shadowColor: '#0D9488',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10
      },
      android: {
        elevation: 5
      },
      web: {
        boxShadow: '0 4px 16px rgba(13, 148, 136, 0.16)'
      }
    })
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4
  },
  instructionText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12
  },
  sentenceBreakdownCard: {
    backgroundColor: '#F5F3FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    padding: 10,
    marginTop: 8,
    marginBottom: 8
  },
  sentenceBreakdownHeader: {
    paddingVertical: 2
  },
  sentenceTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sentenceBreakdownTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5B21B6',
    flex: 1
  },
  sentenceBreakdownToggle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7C3AED'
  },
  sentenceSubtext: {
    fontSize: 10,
    color: '#6D28D9',
    marginTop: 2
  },
  sentenceList: {
    marginTop: 8,
    gap: 6
  },
  sentenceItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    gap: 8,
    alignItems: 'flex-start'
  },
  sentenceBadge: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2
  },
  sentenceBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold'
  },
  sentenceBody: {
    flex: 1,
    gap: 2
  },
  sentenceOriginal: {
    fontSize: 11,
    color: '#6B7280'
  },
  sentenceCorrected: {
    fontSize: 12,
    color: '#1E1B4B',
    fontWeight: '600'
  },
  sentenceTagAsr: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#9CA3AF'
  },
  sentenceTagGemini: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#7C3AED'
  },
  recordButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3
  },
  recordButtonIdle: {
    backgroundColor: '#064E3B'
  },
  recordButtonActive: {
    backgroundColor: '#DC2626'
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  recPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginRight: 2
  },
  recordButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold'
  },
  indicConformerCard: {
    backgroundColor: '#062E20',
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: '#059669'
  },
  indicConformerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  transcriptCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E6FFFA'
  },
  indicConformerLang: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '600'
  },
  editTranscriptBox: {
    backgroundColor: '#0F3324',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#10B981'
  },
  editTranscriptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  editTranscriptTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  editTranscriptHint: {
    fontSize: 11,
    color: '#6EE7B7',
    fontWeight: '600'
  },
  reanalyzeBtn: {
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6
  },
  reanalyzeBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700'
  },
  indicConformerInput: {
    color: '#F0FDF4',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
    minHeight: 50,
    padding: 0,
    textAlignVertical: 'top'
  },
  // Structured Record Card Styles
  structuredRecordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: '#10B981',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3
  },
  structuredHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 10,
    marginBottom: 10
  },
  structuredTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  structuredTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  structuredHeaderTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#065F46'
  },
  recordStatusBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12
  },
  recordStatusBadgeText: {
    color: '#065F46',
    fontSize: 10,
    fontWeight: '700'
  },
  sectionBlock: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6
  },
  sectionBlockTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937'
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  gridCol: {
    flex: 1
  },
  labelMuted: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500'
  },
  valueStrong: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
    marginTop: 1
  },
  alertHighlight: {
    color: '#DC2626',
    fontWeight: 'bold'
  },
  vitalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  vitalCard: {
    flex: 1,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  vitalLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#065F46'
  },
  vitalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#047857',
    marginTop: 2
  },
  vitalUnit: {
    fontSize: 9,
    color: '#6B7280'
  },
  subHeading: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 2
  },
  bulletItem: {
    fontSize: 12,
    color: '#1F2937',
    lineHeight: 18,
    marginVertical: 1
  },
  noDataText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic'
  },
  careGapsBlock: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5'
  },
  careGapsBlockTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 6
  },
  gapRowItem: {
    marginVertical: 3
  },
  gapBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 2
  },
  gapBadgeHigh: {
    backgroundColor: '#DC2626'
  },
  gapBadgeMed: {
    backgroundColor: '#D97706'
  },
  gapBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold'
  },
  gapDescText: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 16
  },
  pregnantPill: {
    marginTop: 6,
    backgroundColor: '#FDF2F8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#FBCFE8'
  },
  pregnantPillText: {
    color: '#BE185D',
    fontSize: 10.5,
    fontWeight: '700'
  },
  alertNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    padding: 8,
    borderRadius: 6,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#FCA5A5'
  },
  alertNoticeText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: 'bold'
  },
  saveAlertBox: {
    backgroundColor: '#DEF7EC',
    borderRadius: 6,
    padding: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#84E1BC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  saveAlertText: {
    color: '#03543F',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center'
  },
  actionButtonRow: {
    flexDirection: 'row',
    marginTop: 12,
    alignItems: 'center'
  },
  saveRecordBtn: {
    flex: 2,
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6
  },
  saveBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  saveRecordBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: 'bold'
  },
  cancelDraftBtn: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginRight: 6
  },
  cancelDraftBtnText: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '700'
  },
  viewStructuredBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  viewStructuredBtnText: {
    color: '#0D9488',
    fontSize: 12,
    fontWeight: 'bold'
  },
  // Saved Records History Styles
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6
      },
      android: {
        elevation: 2
      },
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
      }
    })
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A'
  },
  historySubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  exportAllBtn: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  exportAllBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold'
  },
  emptyHistoryText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 8,
    textAlign: 'center'
  },
  historyItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  historyItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  historyItemName: {
    fontSize: 13.5,
    fontWeight: 'bold',
    color: '#0F172A'
  },
  historyItemDate: {
    fontSize: 11,
    color: '#64748B'
  },
  historyItemDetails: {
    fontSize: 11.5,
    color: '#475569',
    marginVertical: 4
  },
  historyItemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4
  },
  historyViewBtn: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginRight: 6
  },
  historyViewBtnText: {
    color: '#0D9488',
    fontSize: 11,
    fontWeight: '700'
  },
  historyDelBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6
  },
  historyDelBtnText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '600'
  },
  // Legacy confirmation card
  confirmationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 2
  },
  confHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  confBadge: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#047857'
  },
  confConfidence: {
    fontSize: 12,
    color: '#6B7280'
  },
  transcriptSnippet: {
    fontStyle: 'italic',
    color: '#4B5563',
    marginBottom: 10,
    fontSize: 12
  },
  extractedTable: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10
  },
  tableRow: {
    fontSize: 12,
    color: '#1F2937',
    marginVertical: 1
  },
  bold: {
    fontWeight: 'bold'
  },
  confActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8
  },
  confirmButton: {
    flex: 2,
    backgroundColor: '#059669',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB'
  },
  cancelButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 13
  },

  footerNote: {
    alignItems: 'center',
    marginTop: 8
  },
  footerText: {
    fontSize: 11,
    color: '#9CA3AF'
  },
  // Structured and Ward Modal Styles
  structuredModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  structuredModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    width: '100%',
    maxWidth: 520,
    maxHeight: '86%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12
  },
  structuredModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  structuredModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#042F2E'
  },
  structuredModalSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  structuredModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  structuredModalCloseText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700'
  },
  structuredModalScroll: {
    marginTop: 12
  },
  modalSectionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  modalSectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D9488',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  modalDetailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  modalDetailCol: {
    flex: 1,
    minWidth: 95
  },
  modalDetailLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2
  },
  modalDetailVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A'
  },
  pregnantNoticeBox: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FDE68A'
  },
  pregnantNoticeText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600'
  },
  modalVitalsGrid: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between'
  },
  modalVitalItem: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  modalVitalLabel: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 2
  },
  modalVitalVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#042F2E'
  },
  modalVitalUnit: {
    fontSize: 10,
    color: '#94A3B8'
  },
  modalBulletItem: {
    fontSize: 12,
    color: '#334155',
    marginBottom: 4,
    lineHeight: 18
  },
  modalEmptyMuted: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic'
  },
  modalShareBtn: {
    backgroundColor: '#0D9488',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10
  },
  modalShareBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  exportReportTextInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#1E293B',
    minHeight: 280,
    textAlignVertical: 'top'
  },
  wardModalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  wardModalItemSelected: {
    backgroundColor: '#F0FDFA',
    borderColor: '#0D9488'
  },
  wardModalItemText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500'
  },
  wardModalItemTextSelected: {
    color: '#042F2E',
    fontWeight: '700'
  },
  wardModalCheck: {
    fontSize: 15,
    color: '#0D9488',
    fontWeight: 'bold'
  },
  // Z-Score Modal Styles
  zModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  zModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    width: '100%',
    maxWidth: 450,
    elevation: 5
  },
  zModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827'
  },
  zModalSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    marginBottom: 10
  },
  zModalActiveBanner: {
    backgroundColor: '#EEF2FF',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginBottom: 10
  },
  zModalActiveText: {
    fontSize: 12,
    color: '#3730A3',
    textAlign: 'center'
  },
  zRangesList: {
    gap: 8,
    marginBottom: 14
  },
  zRangeItem: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB'
  },
  zRangeItemActiveNormal: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC'
  },
  zRangeItemActiveMild: {
    backgroundColor: '#FEF9C3',
    borderColor: '#FDE047'
  },
  zRangeItemActiveMam: {
    backgroundColor: '#FFEDD5',
    borderColor: '#FDBA74'
  },
  zRangeItemActiveSam: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5'
  },
  zRangeTitle: {
    fontSize: 13,
    fontWeight: '700'
  },
  zRangeDesc: {
    fontSize: 11,
    color: '#4B5563',
    marginTop: 2
  },
  zModalCloseBtn: {
    backgroundColor: '#065F46',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center'
  },
  zModalCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  zRangeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2
  },
  colorChip: {
    width: 10,
    height: 10,
    borderRadius: 5
  }
});
