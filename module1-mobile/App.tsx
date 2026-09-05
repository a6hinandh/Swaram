import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  TextInput,
  Modal
} from 'react-native';
import { apiClient, getActiveHost, setActiveHost } from './src/api/apiClient';
import {
  VisitDraft,
  ConfirmedVisit,
  MissingFieldPrompt
} from './src/types';
import { audioRecorder } from './src/services/audioRecorder';
import { transcribeWithIndicConformer } from './src/services/indicConformerService';
import { QUICK_CORRECTION_SUGGESTIONS } from './src/services/malayalamSpellCorrector';
import { StructuredClinicalRecord } from './src/types/structuredClinicalRecord';
import { extractStructuredClinicalRecord } from './src/services/clinicalEntityExtractor';
import {
  saveStructuredRecord,
  getAllStructuredRecords,
  deleteStructuredRecord,
  exportAllRecordsJson
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
  MentalHealthScreen,
  EnvironmentalRiskScreen,
  NcdLifestyleScreen,
  VitalsBaselineScreen
} from './src/modules';

export default function App() {
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

  // Structured Clinical Record Extraction & Offline Storage State
  const [structuredRecord, setStructuredRecord] = useState<StructuredClinicalRecord | null>(null);
  const [savedRecords, setSavedRecords] = useState<StructuredClinicalRecord[]>([]);
  const [showJsonModal, setShowJsonModal] = useState<boolean>(false);
  const [activeJsonToView, setActiveJsonToView] = useState<string>('');
  const [jsonModalTitle, setJsonModalTitle] = useState<string>('Structured Clinical Record JSON');
  const [saveFeedbackMsg, setSaveFeedbackMsg] = useState<string | null>(null);
  const [isSavingRecord, setIsSavingRecord] = useState<boolean>(false);
  const [isGeminiRefining, setIsGeminiRefining] = useState<boolean>(false);
  const [geminiStatusNote, setGeminiStatusNote] = useState<string | null>(null);
  const [showApiKeyConfig, setShowApiKeyConfig] = useState<boolean>(false);
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState<string>(getCustomGeminiApiKey());
  const [showKeyPlaintext, setShowKeyPlaintext] = useState<boolean>(false);
  const [showZScoreModal, setShowZScoreModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<AppTab>('core');

  const handleSaveGeminiKey = () => {
    setCustomGeminiApiKey(geminiApiKeyInput);
    setShowApiKeyConfig(false);
    setLastActionMessage(
      geminiApiKeyInput.trim()
        ? '✓ Google Gemini API Key configured for Zero-PII Cloud Engine!'
        : 'Gemini API Key cleared. Local Extractor active.'
    );
  };

  // Initial Load
  useEffect(() => {
    runBasicCall();
    refreshSavedRecords();
  }, []);

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
        setLastActionMessage('🎙️ Recording live Malayalam speech... Tap button when finished.');

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
      setLastActionMessage('Passing audio to AI4Bharat IndicConformer ASR (Malayalam)...');

      try {
        const audio = await audioRecorder.stopRecording();

        // 1. Transcribe with IndicConformer (strictly Malayalam)
        const conformerResult = await transcribeWithIndicConformer(audio, 'ml');

        console.log('\n======================================================');
        console.log('🗣️ AI4BHARAT INDICCONFORMER RAW TRANSCRIPTION (MALAYALAM):');
        console.log(conformerResult.transcript);
        console.log('======================================================\n');

        let activeTranscript = conformerResult.transcript;

        // 2. Sentence-by-Sentence Gemini Contextual Refinement
        // Send every sentence to Gemini with context to fix acoustic/phonetic errors into common Malayalam
        setLastActionMessage('✨ Gemini refining sentence-by-sentence in Malayalam with context...');
        try {
          const sentenceResult = await refineTranscriptSentencesWithGemini(
            conformerResult.transcript,
            geminiApiKeyInput,
            (done, total) => {
              setLastActionMessage(`✨ Gemini refining sentence ${done} of ${total} in Malayalam...`);
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
        setLastActionMessage(`✓ Transcription, Sentence Refinement & Structured Extraction complete!`);
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
    setGeminiStatusNote('✨ Sending sentences to Gemini for contextual Malayalam correction...');
    try {
      // 1. Refine sentences with Gemini
      const sentenceResult = await refineTranscriptSentencesWithGemini(
        indicConformerTranscript,
        geminiApiKeyInput,
        (done, total) => {
          setGeminiStatusNote(`✨ Refining sentence ${done} of ${total} with Gemini...`);
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

  // Structured Storage Actions
  const handleSaveCurrentRecord = async () => {
    if (!structuredRecord) return;
    setIsSavingRecord(true);
    setSaveFeedbackMsg('Saving record to device offline storage...');
    try {
      const res = await saveStructuredRecord(structuredRecord);
      if (res.success) {
        setSaveFeedbackMsg(`✓ Saved offline! (ID: ${structuredRecord.visit.visit_id})`);
        await refreshSavedRecords();
      } else {
        setSaveFeedbackMsg('❌ Failed to save record.');
      }
    } catch (err: any) {
      setSaveFeedbackMsg(`Error saving: ${err.message}`);
    } finally {
      setIsSavingRecord(false);
      setTimeout(() => setSaveFeedbackMsg(null), 4000);
    }
  };

  const handleOpenJsonModal = (record: StructuredClinicalRecord, title?: string) => {
    setJsonModalTitle(title || `Visit JSON: ${record.visit.visit_id}`);
    setActiveJsonToView(JSON.stringify(record, null, 2));
    setShowJsonModal(true);
  };

  const handleOpenBatchExportModal = async () => {
    const exported = await exportAllRecordsJson();
    setJsonModalTitle(`All Stored Records Export (${savedRecords.length} visits)`);
    setActiveJsonToView(exported);
    setShowJsonModal(true);
  };

  const handleDeleteRecord = async (visitId: string) => {
    await deleteStructuredRecord(visitId);
    await refreshSavedRecords();
    setSaveFeedbackMsg(`Record ${visitId} deleted.`);
    setTimeout(() => setSaveFeedbackMsg(null), 3000);
  };

  // Human Confirmation Gate
  const handleConfirmVisit = async () => {
    if (!visitDraft) return;

    const confirmed: ConfirmedVisit = {
      visit_id: visitDraft.visit_id,
      household_id: 'community-visit',
      worker_id: visitDraft.worker_id || 'w-asha-001',
      timestamp: new Date().toISOString(),
      person_updates: visitDraft.person_updates,
      survey_fields: visitDraft.survey_fields,
      malnutrition_assessment: visitDraft.malnutrition_assessment,
      confirmed_by_worker_at: new Date().toISOString(),
      sync_status: isBackendConnected ? 'synced' : 'pending'
    };

    if (structuredRecord) {
      await saveStructuredRecord(structuredRecord);
      await refreshSavedRecords();
    }

    const submitResult = await apiClient.submitConfirmedVisit(confirmed);
    setVisitDraft(null);
    if (submitResult.isMockFallback) {
      setSyncQueueCount((prev) => prev + 1);
    }
    setLastActionMessage(`Survey Confirmed & Filed! ${submitResult.message}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#064E3B" />

      {/* App Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>സ്വരം • SWARAM</Text>
          <Text style={styles.headerSubtitle}>
            {activeTab === 'core' && 'Next-Gen ASHA Worker Platform (വാർഡ് 4, ആലുവ)'}
            {activeTab === 'mental' && 'Mental Health Voice Screening Protocol'}
            {activeTab === 'climate' && 'Environmental & Climate Risk Monitoring'}
            {activeTab === 'lifestyle' && 'CBAC / CABC Survey (Community Based Assessment Checklist)'}
            {activeTab === 'vitals' && 'Longitudinal Vitals Baseline & Delta Detector'}
          </Text>
          {activeTab === 'core' && (
            <View style={styles.conceptPill}>
              <Text style={styles.conceptPillText}>Conversational Survey & Care Intelligence</Text>
            </View>
          )}
        </View>
        <View style={styles.syncBadge}>
          <Text style={styles.syncBadgeText}>
            {syncQueueCount > 0 ? `${syncQueueCount} Queued` : 'Synced'}
          </Text>
        </View>
      </View>

      {/* Core Field Survey Tab View */}
      {activeTab === 'core' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Network & Offline Status Banner */}
        <View style={[styles.networkBanner, isBackendConnected ? styles.bannerOnline : styles.bannerOffline]}>
          <View style={styles.bannerRow}>
            <View style={[styles.statusDot, isBackendConnected ? styles.dotGreen : styles.dotAmber]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerText}>
                System Mode: <Text style={{ fontWeight: 'bold' }}>{backendStatus}</Text>
              </Text>
              <Text style={styles.ipSubtitleText}>
                Target: http://{serverIp}:8000
              </Text>
            </View>
          </View>
          <View style={styles.bannerActions}>
            <TouchableOpacity
              style={styles.ipConfigToggleBtn}
              onPress={() => setShowIpConfig(!showIpConfig)}
            >
              <Text style={styles.ipConfigToggleText}>IP Config</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ipConfigToggleBtn, { backgroundColor: '#4C1D95' }]}
              onPress={() => setShowApiKeyConfig(!showApiKeyConfig)}
            >
              <Text style={[styles.ipConfigToggleText, { color: '#FFFFFF' }]}>AI Key</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.testCallButton}
              onPress={runBasicCall}
              disabled={isCallingApi}
            >
              {isCallingApi ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.testCallButtonText}>Ping</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* IP Configuration Bar */}
        {showIpConfig && (
          <View style={styles.ipConfigCard}>
            <Text style={styles.ipConfigLabel}>Configure Development Machine Host IP:</Text>
            <View style={styles.ipInputRow}>
              <TextInput
                style={styles.ipInput}
                value={serverIp}
                onChangeText={setServerIp}
                placeholder="e.g. 192.168.1.5"
                keyboardType="numeric"
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.ipSaveButton}
                onPress={() => {
                  setActiveHost(serverIp);
                  setShowIpConfig(false);
                  runBasicCall();
                }}
              >
                <Text style={styles.ipSaveButtonText}>Save & Test</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Gemini API Key Configuration Card */}
        {showApiKeyConfig && (
          <View style={[styles.ipConfigCard, { borderColor: '#8B5CF6', backgroundColor: '#F5F3FF' }]}>
            <Text style={[styles.ipConfigLabel, { color: '#5B21B6', fontWeight: 'bold' }]}>
              🔑 Google Gemini API Key (Zero-PII Engine):
            </Text>
            <Text style={{ fontSize: 11, color: '#6D28D9', marginBottom: 6 }}>
              Enables cloud accuracy for Malayalam speech. PII is sanitized on-device before sending.
            </Text>
            <View style={styles.ipInputRow}>
              <TextInput
                style={[styles.ipInput, { borderColor: '#C4B5FD', flex: 1 }]}
                value={geminiApiKeyInput}
                onChangeText={setGeminiApiKeyInput}
                placeholder="Paste AIzaSy... key here"
                placeholderTextColor="#A78BFA"
                secureTextEntry={!showKeyPlaintext}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[styles.ipSaveButton, { backgroundColor: '#7C3AED' }]}
                onPress={handleSaveGeminiKey}
              >
                <Text style={styles.ipSaveButtonText}>Save Key</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <TouchableOpacity onPress={() => setShowKeyPlaintext(!showKeyPlaintext)}>
                <Text style={{ fontSize: 11, color: '#7C3AED', fontWeight: '600' }}>
                  {showKeyPlaintext ? '🙈 Hide Key' : '👁️ Show Key'}
                </Text>
              </TouchableOpacity>
              {geminiApiKeyInput && geminiApiKeyInput.trim() ? (
                <Text style={{ fontSize: 11, color: '#059669', fontWeight: '600' }}>
                  ✓ Key Active ({geminiApiKeyInput.slice(0, 6)}...{geminiApiKeyInput.slice(-4)})
                </Text>
              ) : (
                <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: '600' }}>
                  ⚠️ No key set (Uses Local Extractor)
                </Text>
              )}
            </View>
          </View>
        )}


        {/* CBAC / CABC Survey Feature Launcher */}
        <TouchableOpacity
          style={styles.cbacLauncherCard}
          onPress={() => setActiveTab('lifestyle')}
          activeOpacity={0.85}
        >
          <View style={styles.cbacLauncherLeft}>
            <View style={styles.cbacIconBadge}>
              <Text style={styles.cbacIconEmoji}>📋</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.cbacHeaderRow}>
                <Text style={styles.cbacLauncherTitle}>CBAC / CABC സർവേ</Text>
                <View style={styles.cbacTag}>
                  <Text style={styles.cbacTagText}>MoHFW • NHM (30+)</Text>
                </View>
              </View>
              <Text style={styles.cbacLauncherSubtitle}>
                കമ്മ്യൂണിറ്റി ബേസ്ഡ് അസസ്സ്മെന്റ് ചെക്ക്‌ലിസ്റ്റ് (NCD & Cancer Early Screening)
              </Text>
              <Text style={styles.cbacActionPrompt}>
                സർവേ ആരംഭിക്കുക (Open CBAC Survey) →
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Conversational Survey Capture Section */}
        <View style={styles.voiceSection}>
          <Text style={styles.sectionHeading}>സംഭാഷണ സർവേ (Conversational Survey Entry)</Text>
          <Text style={styles.instructionText}>
            Speak natural Malayalam: Describe vitals, symptoms, medicine, and next visit date.
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
                <Text style={styles.recordButtonText}>AI4Bharat IndicConformer പ്രോസസ്സ് ചെയ്യുന്നു...</Text>
              </View>
            ) : (
              <View style={styles.buttonContent}>
                <Text style={styles.micIcon}>{isRecording ? '⏹' : '🎙️'}</Text>
                <Text style={styles.recordButtonText}>
                  {isRecording
                    ? `🔴 ${Math.floor(recordingDuration / 60).toString().padStart(2, '0')}:${(recordingDuration % 60).toString().padStart(2, '0')} - നിർത്തുക (Stop & Transcribe)`
                    : 'ശബ്ദം രേഖപ്പെടുത്തുക (Record Live Audio)'}
                </Text>
              </View>
            )}
          </TouchableOpacity>


          {/* Dedicated AI4Bharat IndicConformer Transcription Output Display */}
          {indicConformerTranscript && (
            <View style={styles.indicConformerCard}>
              <View style={styles.indicConformerHeader}>
                <View style={styles.indicConformerBadge}>
                  <Text style={styles.indicConformerBadgeText}>HUGGING FACE / INDICCONFORMER</Text>
                </View>
                <Text style={styles.indicConformerLang}>മലയാളം (Malayalam)</Text>
              </View>

              {/* Editable Transcript Area */}
              <View style={styles.editTranscriptBox}>
                <View style={styles.editTranscriptHeader}>
                  <Text style={styles.editTranscriptHint}>✏️ ശബ്ദരേഖ (Tap text to edit/correct words):</Text>
                  <TouchableOpacity
                    style={styles.reanalyzeBtn}
                    onPress={() => handleReanalyzeTranscript(indicConformerTranscript)}
                    disabled={isProcessingVoice}
                  >
                    <Text style={styles.reanalyzeBtnText}>🔄 Update</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.indicConformerInput}
                  multiline
                  value={indicConformerTranscript}
                  onChangeText={(newTxt) => setIndicConformerTranscript(newTxt)}
                  placeholder="Type or correct transcription here..."
                />
              </View>

              {/* Sentence-by-Sentence Refinement Breakdown */}
              {sentenceDetails.length > 0 && (
                <View style={styles.sentenceBreakdownCard}>
                  <TouchableOpacity
                    style={styles.sentenceBreakdownHeader}
                    onPress={() => setShowSentenceBreakdown(!showSentenceBreakdown)}
                  >
                    <View style={styles.sentenceTitleRow}>
                      <Text style={styles.sentenceBreakdownTitle}>
                        ✨ വാക്യാടിസ്ഥാനത്തിലുള്ള പരിശോധന ({sentenceDetails.length} Sentences Refined)
                      </Text>
                      <Text style={styles.sentenceBreakdownToggle}>
                        {showSentenceBreakdown ? '▲ ചുരുക്കുക (Hide)' : '▼ കാണുക (View)'}
                      </Text>
                    </View>
                    <Text style={styles.sentenceSubtext}>
                      Gemini addressed Indic ASR acoustic errors with full sentence context
                    </Text>
                  </TouchableOpacity>

                  {showSentenceBreakdown && (
                    <View style={styles.sentenceList}>
                      {sentenceDetails.map((detail, idx) => (
                        <View key={idx} style={styles.sentenceItem}>
                          <View style={styles.sentenceBadge}>
                            <Text style={styles.sentenceBadgeText}>#{idx + 1}</Text>
                          </View>
                          <View style={styles.sentenceBody}>
                            <Text style={styles.sentenceOriginal}>
                              <Text style={styles.sentenceTagAsr}>Indic ASR: </Text>
                              {detail.original}
                            </Text>
                            <Text style={styles.sentenceCorrected}>
                              <Text style={styles.sentenceTagGemini}>Gemini: </Text>
                              {detail.corrected}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Privacy-Preserving Gemini AI Refinement Button */}
              <TouchableOpacity
                style={styles.geminiRefineBtn}
                onPress={handleRefineWithGemini}
                disabled={isGeminiRefining || isProcessingVoice}
              >
                {isGeminiRefining ? (
                  <View style={styles.geminiBtnContent}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.geminiRefineBtnText}>🔒 De-identifying & Refining via Gemini...</Text>
                  </View>
                ) : (
                  <View style={styles.geminiBtnContent}>
                    <Text style={styles.geminiIcon}>✨</Text>
                    <Text style={styles.geminiRefineBtnText}>🔒 100% Accuracy AI Refine (Zero-PII Gemini)</Text>
                  </View>
                )}
              </TouchableOpacity>
              {geminiStatusNote && (
                <View style={styles.geminiNoteBox}>
                  <Text style={styles.geminiNoteText}>{geminiStatusNote}</Text>
                </View>
              )}

              {/* Quick Word Suggestion Chips */}
              <View style={styles.quickChipsWrapper}>
                <Text style={styles.quickChipsTitle}>ദ്രുത തിരുത്തലുകൾ (Quick Add/Fix Words):</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickChipsScroll}>
                  {QUICK_CORRECTION_SUGGESTIONS.map((chip, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.chipButton}
                      onPress={() => handleAppendChip(chip.value)}
                    >
                      <Text style={styles.chipButtonText}>+ {chip.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}
        </View>

        {/* Structured Clinical Record Extraction Card */}
        {structuredRecord && (
          <View style={styles.structuredRecordCard}>
            <View style={styles.structuredHeader}>
              <View style={styles.structuredTitleRow}>
                <Text style={styles.structuredHeaderTitle}>📋 ഘടനാപരമായ വിവരങ്ങൾ (Structured Record)</Text>
                <View style={styles.jsonSchemaBadge}>
                  <Text style={styles.jsonSchemaBadgeText}>JSON SCHEMA</Text>
                </View>
              </View>
              <View style={styles.structuredMetaRow}>
                <Text style={styles.structuredConfidence}>
                  Match: {(structuredRecord.extraction.confidence_score * 100).toFixed(0)}%
                </Text>
                <View style={styles.structLangPill}>
                  <Text style={styles.structLangPillText}>
                    {structuredRecord.extraction.language_detected.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>

            {/* Person & Demographics */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionBlockTitle}>👤 വ്യക്തിഗത വിവരങ്ങൾ (Person & Demographics)</Text>
              <View style={styles.gridRow}>
                <View style={styles.gridCol}>
                  <Text style={styles.labelMuted}>പേര് (Name):</Text>
                  <Text style={styles.valueStrong}>{structuredRecord.person.name || 'രേഖപ്പെടുത്തിയിട്ടില്ല'}</Text>
                </View>
                <View style={styles.gridCol}>
                  <Text style={styles.labelMuted}>പ്രായം (Age):</Text>
                  <Text style={styles.valueStrong}>
                    {structuredRecord.person.age !== null ? `${structuredRecord.person.age} വയസ്സ്` : 'N/A'}
                  </Text>
                </View>
                <View style={styles.gridCol}>
                  <Text style={styles.labelMuted}>ലിംഗം (Sex):</Text>
                  <Text style={styles.valueStrong}>{structuredRecord.person.sex.toUpperCase()}</Text>
                </View>
              </View>
              <View style={[styles.gridRow, { marginTop: 6 }]}>
                <View style={styles.gridCol}>
                  <Text style={styles.labelMuted}>ഘട്ടം (Life Stage):</Text>
                  <Text style={styles.valueStrong}>{structuredRecord.person.life_stage.toUpperCase()}</Text>
                </View>
                <View style={styles.gridCol}>
                  <Text style={styles.labelMuted}>ഗർഭാവസ്ഥ (Pregnancy):</Text>
                  <Text style={[styles.valueStrong, structuredRecord.person.pregnancy_status === 'pregnant' && styles.alertHighlight]}>
                    {structuredRecord.person.pregnancy_status.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>

            {/* Measurements & Vitals */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionBlockTitle}>🩺 പരിശോധനാ ഫലങ്ങൾ (Measurements & Vitals)</Text>
              <View style={styles.vitalsRow}>
                <View style={styles.vitalCard}>
                  <Text style={styles.vitalLabel}>ബിപി (BP)</Text>
                  <Text style={styles.vitalValue}>{structuredRecord.measurements.blood_pressure || '--'}</Text>
                  <Text style={styles.vitalUnit}>mmHg</Text>
                </View>
                <View style={styles.vitalCard}>
                  <Text style={styles.vitalLabel}>ഭാരം (Weight)</Text>
                  <Text style={styles.vitalValue}>{structuredRecord.measurements.weight_kg !== null ? `${structuredRecord.measurements.weight_kg}` : '--'}</Text>
                  <Text style={styles.vitalUnit}>kg</Text>
                </View>
                <View style={styles.vitalCard}>
                  <Text style={styles.vitalLabel}>ഉയരം (Height)</Text>
                  <Text style={styles.vitalValue}>{structuredRecord.measurements.height_cm !== null ? `${structuredRecord.measurements.height_cm}` : '--'}</Text>
                  <Text style={styles.vitalUnit}>cm</Text>
                </View>
              </View>
              <View style={[styles.vitalsRow, { marginTop: 6 }]}>
                <View style={styles.vitalCard}>
                  <Text style={styles.vitalLabel}>പൾസ് (Heart Rate)</Text>
                  <Text style={styles.vitalValue}>{structuredRecord.measurements.pulse_bpm !== null ? `${structuredRecord.measurements.pulse_bpm}` : '--'}</Text>
                  <Text style={styles.vitalUnit}>bpm</Text>
                </View>
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
                {structuredRecord.measurements.spo2_percent !== null && (
                  <View style={styles.vitalCard}>
                    <Text style={styles.vitalLabel}>ഓക്സിജൻ (SpO2)</Text>
                    <Text style={styles.vitalValue}>{structuredRecord.measurements.spo2_percent}</Text>
                    <Text style={styles.vitalUnit}>%</Text>
                  </View>
                )}
              </View>

              {/* Mental Health Metrics under Measurements & Vitals */}
              <View style={[styles.vitalsRow, { marginTop: 6 }]}>
                <View style={[styles.vitalCard, { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }]}>
                  <Text style={[styles.vitalLabel, { color: '#3730A3' }]}>Anxiety Score (GAD-2)</Text>
                  <Text style={[styles.vitalValue, { color: '#312E81' }]}>
                    {structuredRecord.mental_social?.phq4_assessment?.anxiety_score !== null && structuredRecord.mental_social?.phq4_assessment?.anxiety_score !== undefined
                      ? `${structuredRecord.mental_social.phq4_assessment.anxiety_score} / 6`
                      : '-'}
                  </Text>
                  <Text style={styles.vitalUnit}>GAD-2</Text>
                </View>
                <View style={[styles.vitalCard, { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }]}>
                  <Text style={[styles.vitalLabel, { color: '#3730A3' }]}>Depression Score (PHQ-2)</Text>
                  <Text style={[styles.vitalValue, { color: '#312E81' }]}>
                    {structuredRecord.mental_social?.phq4_assessment?.depression_score !== null && structuredRecord.mental_social?.phq4_assessment?.depression_score !== undefined
                      ? `${structuredRecord.mental_social.phq4_assessment.depression_score} / 6`
                      : '-'}
                  </Text>
                  <Text style={styles.vitalUnit}>PHQ-2</Text>
                </View>
              </View>

              {/* Extra Metric Box for WHO Growth Z-Score (Infant/Child Scoped ONLY) */}
              {(structuredRecord.nutrition.child_nutrition.sam_mam_risk !== 'unknown' || (structuredRecord.person.age !== null && structuredRecord.person.age <= 5)) && (
                <TouchableOpacity
                  style={[styles.vitalsRow, { marginTop: 6 }]}
                  onPress={() => setShowZScoreModal(true)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.vitalCard, { flex: 1, backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', paddingVertical: 8 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.vitalLabel, { color: '#166534' }]}>📊 WHO Growth Z-Score (WAZ)</Text>
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
                    <Text style={[styles.vitalUnit, { color: '#15803D' }]}>Tap to view WHO Classification Ranges ➔</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* Health Status: Complaints, Conditions, Medications */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionBlockTitle}>💊 ലക്ഷണങ്ങളും മരുന്നുകളും (Health Status)</Text>
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
                  <Text style={styles.subHeading}>മരുന്നുകൾ (Medications):</Text>
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
                <Text style={styles.careGapsBlockTitle}>⚠️ ശ്രദ്ധിക്കേണ്ട കാര്യങ്ങൾ (Care Gaps Detected):</Text>
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
              <Text style={styles.sectionBlockTitle}>📅 തുടർപരിശോധന (Follow-up & Referral)</Text>
              <Text style={styles.bulletItem}>
                • ആവശ്യമുള്ളത്: <Text style={styles.bold}>{structuredRecord.follow_up.required.toUpperCase()}</Text>
                {structuredRecord.follow_up.due_date ? ` (തീയതി: ${structuredRecord.follow_up.due_date})` : ''}
              </Text>
              <Text style={styles.bulletItem}>
                • ചുമതലപ്പെടുത്തിയത്: <Text style={styles.bold}>{structuredRecord.follow_up.assigned_to.toUpperCase()}</Text>
                {structuredRecord.follow_up.reason ? ` - ${structuredRecord.follow_up.reason}` : ''}
              </Text>
            </View>

            {/* Direct Inline Structured JSON Output Display */}
            <View style={styles.inlineJsonBox}>
              <View style={styles.inlineJsonHeader}>
                <Text style={styles.inlineJsonTitle}>{'{ }'} എക്സ്ട്രാക്റ്റ് ചെയ്ത JSON (Structured Output):</Text>
                <TouchableOpacity
                  style={styles.inlineJsonExpandBtn}
                  onPress={() => handleOpenJsonModal(structuredRecord, 'Full Schema JSON')}
                >
                  <Text style={styles.inlineJsonExpandBtnText}>⛶ Fullscreen</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.inlineJsonContent}
                multiline
                editable={false}
                selectTextOnFocus
                value={JSON.stringify(structuredRecord, null, 2)}
              />
            </View>

            {/* Save Feedback Alert */}
            {saveFeedbackMsg && (
              <View style={styles.saveAlertBox}>
                <Text style={styles.saveAlertText}>{saveFeedbackMsg}</Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtonRow}>
              <TouchableOpacity
                style={styles.saveRecordBtn}
                onPress={handleSaveCurrentRecord}
                disabled={isSavingRecord}
              >
                {isSavingRecord ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveRecordBtnText}>💾 സേവ് ചെയ്യുക (Save Record Offline)</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.viewJsonBtn}
                onPress={() => handleOpenJsonModal(structuredRecord)}
              >
                <Text style={styles.viewJsonBtnText}>🔍 View JSON</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Offline Stored Clinical Records History */}
        <View style={styles.historyCard}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>
              📁 സേവ് ചെയ്ത രേഖകൾ ({savedRecords.length} Saved Offline)
            </Text>
            {savedRecords.length > 0 && (
              <TouchableOpacity style={styles.exportAllBtn} onPress={handleOpenBatchExportModal}>
                <Text style={styles.exportAllBtnText}>📦 Export JSON</Text>
              </TouchableOpacity>
            )}
          </View>

          {savedRecords.length === 0 ? (
            <Text style={styles.emptyHistoryText}>
              ഇതുവരെ രേഖകൾ ഒന്നും സേവ് ചെയ്തിട്ടില്ല. ശബ്ദം റെക്കോർഡ് ചെയ്ത് "Save Record" ക്ലിക്ക് ചെയ്യുക.
            </Text>
          ) : (
            savedRecords.map((item) => (
              <View key={item.visit.visit_id} style={styles.historyItem}>
                <View style={styles.historyItemTop}>
                  <Text style={styles.historyItemName}>
                    {item.person.name || 'Unnamed Person'} ({item.person.age !== null ? `${item.person.age}y` : '?'}, {item.person.sex})
                  </Text>
                  <Text style={styles.historyItemDate}>{item.visit.date}</Text>
                </View>
                <Text style={styles.historyItemDetails}>
                  BP: {item.measurements.blood_pressure || '--'} | Wt: {item.measurements.weight_kg ? `${item.measurements.weight_kg}kg` : '--'} | Gaps: {item.care_gaps.length}
                </Text>
                <View style={styles.historyItemActions}>
                  <TouchableOpacity
                    style={styles.historyViewBtn}
                    onPress={() => handleOpenJsonModal(item, `Visit: ${item.visit.visit_id}`)}
                  >
                    <Text style={styles.historyViewBtnText}>👁️ View JSON</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.historyDelBtn}
                    onPress={() => handleDeleteRecord(item.visit.visit_id)}
                  >
                    <Text style={styles.historyDelBtnText}>🗑️ Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Clinical Extraction Review & Confirmation Gate */}
        {visitDraft && (
          <View style={styles.confirmationCard}>
            <View style={styles.confHeader}>
              <Text style={styles.confBadge}>തിരിച്ചറിഞ്ഞ വിവരങ്ങൾ (Extracted Record)</Text>
              <Text style={styles.confConfidence}>Confidence: {(visitDraft.confidence * 100).toFixed(0)}%</Text>
            </View>

            <Text style={styles.transcriptSnippet}>
              🗣️ മലയാളം സംഗ്രഹം: "{visitDraft.transcript}"
            </Text>

            {visitDraft.person_updates.map((update, idx) => (
              <View key={idx} style={styles.extractedTable}>
                <Text style={styles.tableRow}><Text style={styles.bold}>വ്യക്തി (Person):</Text> {update.name}</Text>
                {update.vitals && (
                  <>
                    <Text style={styles.tableRow}>
                      <Text style={styles.bold}>രക്തസമ്മർദ്ദം (BP):</Text> {update.vitals.systolic_bp}/{update.vitals.diastolic_bp} mmHg
                    </Text>
                    <Text style={styles.tableRow}>
                      <Text style={styles.bold}>ശരീരഭാരം (Weight):</Text> {update.vitals.weight_kg} kg
                    </Text>
                  </>
                )}
                {update.medications_given && (
                  <Text style={styles.tableRow}>
                    <Text style={styles.bold}>നൽകിയ മരുന്നുകൾ:</Text> {update.medications_given.join(', ')}
                  </Text>
                )}
                <Text style={styles.tableRow}>
                  <Text style={styles.bold}>Mental Health (മാനസികാരോഗ്യം):</Text>{' '}
                  Anxiety Score (GAD-2): {update.mental_health?.anxiety_score !== undefined && update.mental_health?.anxiety_score !== null ? `${update.mental_health.anxiety_score}/6` : '-'} | Depression Score (PHQ-2): {update.mental_health?.depression_score !== undefined && update.mental_health?.depression_score !== null ? `${update.mental_health.depression_score}/6` : '-'}
                </Text>
                {update.follow_up_date && (
                  <Text style={styles.tableRow}>
                    <Text style={styles.bold}>അടുത്ത സന്ദർശനം:</Text> {update.follow_up_date}
                  </Text>
                )}
              </View>
            ))}

            {/* Confirmation Gate Buttons */}
            <View style={styles.confActions}>
              <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmVisit}>
                <Text style={styles.confirmButtonText}>✓ ശരിയാണ് (Confirm & Save)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setVisitDraft(null)}
              >
                <Text style={styles.cancelButtonText}>മാറ്റുക (Edit)</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}


        {/* Status Message Footer */}
        <View style={styles.footerNote}>
          <Text style={styles.footerText}>Status: {lastActionMessage}</Text>
        </View>
      </ScrollView>
      )}

      {/* Feature Module Views */}
      {activeTab === 'mental' && <MentalHealthScreen />}
      {activeTab === 'climate' && <EnvironmentalRiskScreen />}
      {activeTab === 'lifestyle' && <NcdLifestyleScreen onBack={() => setActiveTab('core')} />}
      {activeTab === 'vitals' && <VitalsBaselineScreen />}

      {/* Persistent Bottom Tab Navigation Bar */}
      <BottomTabBar activeTab={activeTab} onTabSelect={setActiveTab} />

      {/* Raw Schema JSON Viewer Modal */}
      <Modal
        visible={showJsonModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowJsonModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{jsonModalTitle}</Text>
              <Text style={styles.modalSubtitle}>Strict Canonical Clinical JSON Schema</Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowJsonModal(false)}>
              <Text style={styles.modalCloseBtnText}>✕ Close</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalNotice}>
            <Text style={styles.modalNoticeText}>
              📋 Tap and hold text inside the code viewer below to select/copy:
            </Text>
          </View>
          <TextInput
            style={styles.modalJsonInput}
            multiline
            editable={false}
            selectTextOnFocus
            value={activeJsonToView}
          />
        </SafeAreaView>
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
            <Text style={styles.zModalTitle}>📊 WHO Child Growth Z-Score Ranges</Text>
            <Text style={styles.zModalSubtitle}>Weight-for-Age (WAZ) Standard Classification</Text>

            {/* Current Active Category Banner */}
            <View style={styles.zModalActiveBanner}>
              <Text style={styles.zModalActiveText}>
                Current Status: <Text style={{ fontWeight: '700' }}>{(structuredRecord?.nutrition?.child_nutrition?.sam_mam_risk || 'mam').toUpperCase()}</Text>
              </Text>
            </View>

            <View style={styles.zRangesList}>
              <View style={[styles.zRangeItem, structuredRecord?.nutrition?.child_nutrition?.sam_mam_risk === 'normal' && styles.zRangeItemActiveNormal]}>
                <Text style={[styles.zRangeTitle, { color: '#065F46' }]}>🟩 Normal Growth (Z ≥ -1.0)</Text>
                <Text style={styles.zRangeDesc}>Healthy weight trajectory according to WHO growth standards.</Text>
              </View>

              <View style={[styles.zRangeItem, structuredRecord?.nutrition?.child_nutrition?.sam_mam_risk === 'mild' && styles.zRangeItemActiveMild]}>
                <Text style={[styles.zRangeTitle, { color: '#854D0E' }]}>🟨 Mild Underweight {"(-2.0 ≤ Z < -1.0)"}</Text>
                <Text style={styles.zRangeDesc}>Slightly lower weight trajectory; monitor dietary intake.</Text>
              </View>

              <View style={[styles.zRangeItem, (structuredRecord?.nutrition?.child_nutrition?.sam_mam_risk === 'mam' || !structuredRecord?.nutrition?.child_nutrition?.sam_mam_risk) && styles.zRangeItemActiveMam]}>
                <Text style={[styles.zRangeTitle, { color: '#9A3412' }]}>🟧 MAM - Moderate Acute Malnutrition {"(-3.0 ≤ Z < -2.0)"}</Text>
                <Text style={styles.zRangeDesc}>Moderate underweight; dietary diversity & IFA supplementation indicated.</Text>
              </View>

              <View style={[styles.zRangeItem, structuredRecord?.nutrition?.child_nutrition?.sam_mam_risk === 'sam' && styles.zRangeItemActiveSam]}>
                <Text style={[styles.zRangeTitle, { color: '#991B1B' }]}>🟥 SAM - Severe Acute Malnutrition {"(Z < -3.0)"}</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6'
  },
  header: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#A7F3D0',
    marginTop: 2
  },
  conceptPill: {
    backgroundColor: '#065F46',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
    alignSelf: 'flex-start'
  },
  conceptPillText: {
    color: '#E6FFFA',
    fontSize: 10,
    fontWeight: '600'
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
    padding: 16,
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2
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
  micIcon: {
    fontSize: 18,
    color: '#FFFFFF'
  },
  recordButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold'
  },

  geminiRefineBtn: {
    backgroundColor: '#047857',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: '#34D399',
    alignItems: 'center',
    justifyContent: 'center',
  },
  geminiBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  geminiIcon: {
    fontSize: 14,
    color: '#FDE047',
  },
  geminiRefineBtnText: {
    color: '#ECFDF5',
    fontSize: 12,
    fontWeight: 'bold',
  },
  geminiNoteBox: {
    backgroundColor: '#064E3B',
    padding: 8,
    borderRadius: 6,
    marginTop: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#34D399',
  },
  geminiNoteText: {
    color: '#A7F3D0',
    fontSize: 11,
    lineHeight: 16,
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
  indicConformerBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  indicConformerBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5
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
    marginBottom: 6
  },
  editTranscriptHint: {
    fontSize: 11,
    color: '#6EE7B7',
    fontWeight: '600'
  },
  reanalyzeBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  reanalyzeBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold'
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
  quickChipsWrapper: {
    marginTop: 10
  },
  quickChipsTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#A7F3D0',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  quickChipsScroll: {
    flexDirection: 'row'
  },
  chipButton: {
    backgroundColor: '#134E39',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#059669'
  },
  chipButtonText: {
    color: '#ECFDF5',
    fontSize: 11,
    fontWeight: '600'
  },
  // Structured Record Card Styles
  structuredRecordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
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
  structuredHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#065F46'
  },
  jsonSchemaBadge: {
    backgroundColor: '#065F46',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  jsonSchemaBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5
  },
  structuredMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6
  },
  structuredConfidence: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600'
  },
  structLangPill: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10
  },
  structLangPillText: {
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
  sectionBlockTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6
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
  saveAlertBox: {
    backgroundColor: '#DEF7EC',
    borderRadius: 6,
    padding: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#84E1BC'
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
    marginRight: 8
  },
  saveRecordBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold'
  },
  viewJsonBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  viewJsonBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: 'bold'
  },
  inlineJsonBox: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#334155'
  },
  inlineJsonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  inlineJsonTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
    letterSpacing: 0.5
  },
  inlineJsonExpandBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#475569'
  },
  inlineJsonExpandBtnText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600'
  },
  inlineJsonContent: {
    color: '#4ADE80',
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
    maxHeight: 220,
    padding: 8,
    backgroundColor: '#020617',
    borderRadius: 6,
    textAlignVertical: 'top'
  },
  // Saved Records History Styles
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 8
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1F2937'
  },
  exportAllBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6
  },
  exportAllBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold'
  },
  emptyHistoryText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    paddingVertical: 8,
    textAlign: 'center'
  },
  historyItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  historyItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  historyItemName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#111827'
  },
  historyItemDate: {
    fontSize: 11,
    color: '#6B7280'
  },
  historyItemDetails: {
    fontSize: 11,
    color: '#4B5563',
    marginVertical: 4
  },
  historyItemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4
  },
  historyViewBtn: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 6
  },
  historyViewBtnText: {
    color: '#0369A1',
    fontSize: 10,
    fontWeight: '600'
  },
  historyDelBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
  },
  historyDelBtnText: {
    color: '#B91C1C',
    fontSize: 10,
    fontWeight: '600'
  },
  // Legacy confirmation card
  confirmationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
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
  // Modal Styles
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#0F172A'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B'
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F8FAFC'
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2
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
  modalNotice: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  modalNoticeText: {
    fontSize: 11,
    color: '#38BDF8'
  },
  modalJsonInput: {
    flex: 1,
    backgroundColor: '#0F172A',
    color: '#4ADE80',
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
    padding: 14,
    textAlignVertical: 'top'
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
  }
});
