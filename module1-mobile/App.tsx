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
  HouseholdSummary,
  HouseholdCareLedger,
  VisitDraft,
  ConfirmedVisit,
  MissingFieldPrompt
} from './src/types';
import { audioRecorder } from './src/services/audioRecorder';
import { transcribeWithIndicConformer, LanguageMode } from './src/services/indicConformerService';
import { QUICK_CORRECTION_SUGGESTIONS } from './src/services/malayalamSpellCorrector';
import { StructuredClinicalRecord } from './src/types/structuredClinicalRecord';
import { extractStructuredClinicalRecord } from './src/services/clinicalEntityExtractor';
import {
  saveStructuredRecord,
  getAllStructuredRecords,
  deleteStructuredRecord,
  exportAllRecordsJson
} from './src/services/structuredStorageService';

export default function App() {
  // State for connectivity & Basic Call demonstration
  const [serverIp, setServerIp] = useState<string>(getActiveHost());
  const [showIpConfig, setShowIpConfig] = useState<boolean>(false);
  const [backendStatus, setBackendStatus] = useState<string>('Checking backend...');
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [isCallingApi, setIsCallingApi] = useState<boolean>(false);

  // Core ASHA Platform State
  const [households, setHouseholds] = useState<HouseholdSummary[]>([]);
  const [selectedHousehold, setSelectedHousehold] = useState<HouseholdSummary | null>(null);
  const [careLedger, setCareLedger] = useState<HouseholdCareLedger | null>(null);

  // Voice Interaction State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [isProcessingVoice, setIsProcessingVoice] = useState<boolean>(false);
  const [indicConformerTranscript, setIndicConformerTranscript] = useState<string | null>(null);
  const [visitDraft, setVisitDraft] = useState<VisitDraft | null>(null);
  const [isResolvingPrompt, setIsResolvingPrompt] = useState<boolean>(false);
  const [syncQueueCount, setSyncQueueCount] = useState<number>(1);
  const [lastActionMessage, setLastActionMessage] = useState<string>('Ready for field visits');
  const [langMode, setLangMode] = useState<LanguageMode>('auto');
  const timerIntervalRef = React.useRef<any>(null);

  // Structured Clinical Record Extraction & Offline Storage State
  const [structuredRecord, setStructuredRecord] = useState<StructuredClinicalRecord | null>(null);
  const [savedRecords, setSavedRecords] = useState<StructuredClinicalRecord[]>([]);
  const [showJsonModal, setShowJsonModal] = useState<boolean>(false);
  const [activeJsonToView, setActiveJsonToView] = useState<string>('');
  const [jsonModalTitle, setJsonModalTitle] = useState<string>('Structured Clinical Record JSON');
  const [saveFeedbackMsg, setSaveFeedbackMsg] = useState<string | null>(null);
  const [isSavingRecord, setIsSavingRecord] = useState<boolean>(false);

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
    // 1. Health check call
    const healthResult = await apiClient.checkBackendHealth();
    setIsBackendConnected(!healthResult.isMockFallback);
    setBackendStatus(
      healthResult.isMockFallback
        ? 'Offline Mode (Local Engine Active)'
        : 'Connected to Central Backend (Port 8000)'
    );

    // 2. Fetch households
    const hhResult = await apiClient.getHouseholds();
    setHouseholds(hhResult.data);
    if (hhResult.data.length > 0) {
      setSelectedHousehold(hhResult.data[0]);
      // 3. Fetch care ledger for selected household
      const ledgerResult = await apiClient.getCareLedger(hhResult.data[0].id);
      setCareLedger(ledgerResult.data);
    }
    setLastActionMessage(hhResult.message);
    setIsCallingApi(false);
  };

  // Real Audio Recording & AI4Bharat IndicConformer Transcription
  const handleToggleVoiceRecording = async () => {
    if (!selectedHousehold) return;

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
      setLastActionMessage('Passing audio to AI4Bharat IndicConformer ASR...');

      try {
        const audio = await audioRecorder.stopRecording();

        // 1. Send to Hugging Face / AI4Bharat with strictly English or Malayalam enforcement
        const conformerResult = await transcribeWithIndicConformer(audio, langMode);

        console.log('\n======================================================');
        console.log('🗣️ AI4BHARAT INDICCONFORMER TRANSCRIPTION:');
        console.log(conformerResult.transcript);
        console.log('======================================================\n');

        setIndicConformerTranscript(conformerResult.transcript);

        // 2. Extract Canonical Structured Clinical Record
        const extractedRecord = extractStructuredClinicalRecord(conformerResult.transcript, selectedHousehold);
        setStructuredRecord(extractedRecord);

        // 3. Pass transcript to legacy visit draft
        const draftResult = await apiClient.processVoiceVisit(conformerResult.transcript);
        setVisitDraft(draftResult.data);
        setLastActionMessage(`Transcription & Structured Extraction complete! ${conformerResult.message}`);
      } catch (err: any) {
        console.error('IndicConformer error:', err);
        setLastActionMessage(`ASR Error: ${err.message}`);
      } finally {
        setIsProcessingVoice(false);
      }
    }
  };

  // Quick Simulation Fallback
  const handleSimulateVoiceCapture = async () => {
    if (!selectedHousehold) return;
    setIsProcessingVoice(true);
    setLastActionMessage('Simulating audio passing to AI4Bharat IndicConformer...');

    setTimeout(async () => {
      const sampleText = 'ലക്ഷ്മി, 28 വയസ്സ്. ഗർഭിണിയാണ്, ബിപി 130/85. ഭാരം 58 കിലോ. തലവേദന ഉണ്ട്, രണ്ട് ദിവസമായി. അയൺ ഗുളിക കൃത്യമായി കഴിക്കുന്നുണ്ട്. അടുത്ത വ്യാഴാഴ്ച വീണ്ടും കാണണം.';
      console.log('\n======================================================');
      console.log('🗣️ AI4BHARAT INDICCONFORMER TRANSCRIPTION (SAMPLE):');
      console.log(sampleText);
      console.log('======================================================\n');

      setIndicConformerTranscript(sampleText);

      // Extract Canonical Structured Clinical Record
      const extractedRecord = extractStructuredClinicalRecord(sampleText, selectedHousehold);
      setStructuredRecord(extractedRecord);

      const draftResult = await apiClient.processVoiceVisit(sampleText);
      setVisitDraft(draftResult.data);
      setIsProcessingVoice(false);
      setLastActionMessage('Sample audio transcribed & structured clinical record extracted.');
    }, 1000);
  };

  // Re-analyze after user edits transcript or taps suggestion chips
  const handleReanalyzeTranscript = async (text: string) => {
    if (!text || !text.trim()) return;
    setIsProcessingVoice(true);
    setLastActionMessage('Re-analyzing corrected transcript...');
    try {
      // Re-extract Canonical Structured Clinical Record
      const extractedRecord = extractStructuredClinicalRecord(text, selectedHousehold);
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
    if (!visitDraft || !selectedHousehold) return;

    const confirmed: ConfirmedVisit = {
      visit_id: visitDraft.visit_id,
      household_id: selectedHousehold.id,
      worker_id: visitDraft.worker_id,
      timestamp: new Date().toISOString(),
      person_updates: visitDraft.person_updates,
      survey_fields: visitDraft.survey_fields,
      malnutrition_assessment: visitDraft.malnutrition_assessment,
      confirmed_by_worker_at: new Date().toISOString(),
      sync_status: isBackendConnected ? 'synced' : 'pending'
    };

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
        <View>
          <Text style={styles.headerTitle}>സ്വരം • SWARAM</Text>
          <Text style={styles.headerSubtitle}>Next-Gen ASHA Worker Platform (വാർഡ് 4, ആലുവ)</Text>
          <View style={styles.conceptPill}>
            <Text style={styles.conceptPillText}>🎙️ Conversational Survey & Care Intelligence</Text>
          </View>
        </View>
        <View style={styles.syncBadge}>
          <Text style={styles.syncBadgeText}>
            {syncQueueCount > 0 ? `⏳ ${syncQueueCount} Queued` : '✓ Synced'}
          </Text>
        </View>
      </View>

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
              <Text style={styles.ipConfigToggleText}>⚙️ IP</Text>
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

        {/* Selected Household & History Overview Card */}
        {selectedHousehold && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{selectedHousehold.head_of_household}</Text>
                <Text style={styles.cardSubtitle}>{selectedHousehold.external_id} • {selectedHousehold.address}</Text>
              </View>
              <View style={styles.badgeColumn}>
                <View style={styles.priorityPill}>
                  <Text style={styles.priorityPillText}>Score: {selectedHousehold.priority_score}</Text>
                </View>
                <View style={styles.malnutritionBadge}>
                  <Text style={styles.malnutritionBadgeText}>
                    Nutrition: {selectedHousehold.malnutrition_risk || 'Moderate'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Overlooked Health Challenges / Urgent Care Gaps */}
            <View style={styles.alertBox}>
              <Text style={styles.alertTitle}>ശ്രദ്ധിക്കേണ്ട കാര്യങ്ങൾ (Longitudinal Care Needs):</Text>
              {selectedHousehold.priority_reasons.map((reason, idx) => (
                <Text key={idx} style={styles.alertItem}>• {reason}</Text>
              ))}
            </View>
          </View>
        )}

        {/* Conversational Survey Capture Section */}
        <View style={styles.voiceSection}>
          <Text style={styles.sectionHeading}>സംഭാഷണ സർവേ (Conversational Survey Entry)</Text>
          <Text style={styles.instructionText}>
            Speak natural Malayalam or English: Describe vitals, symptoms, medicine, and next visit date.
          </Text>

          {/* Language Enforcement Selector: English & Malayalam Only */}
          <View style={styles.langSelectorRow}>
            <Text style={styles.langSelectorLabel}>Language Policy:</Text>
            <View style={styles.langPillContainer}>
              <TouchableOpacity
                style={[styles.langPill, langMode === 'auto' && styles.langPillActive]}
                onPress={() => setLangMode('auto')}
              >
                <Text style={[styles.langPillText, langMode === 'auto' && styles.langPillTextActive]}>
                  🌐 Auto (ML / EN)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.langPill, langMode === 'ml' && styles.langPillActive]}
                onPress={() => setLangMode('ml')}
              >
                <Text style={[styles.langPillText, langMode === 'ml' && styles.langPillTextActive]}>
                  മലയാളം (ML)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.langPill, langMode === 'en' && styles.langPillActive]}
                onPress={() => setLangMode('en')}
              >
                <Text style={[styles.langPillText, langMode === 'en' && styles.langPillTextActive]}>
                  English (EN)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.langPolicyNote}>
            🔒 Strict Policy: Only English or Malayalam are permitted. Any other language is disallowed.
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

          {/* Secondary Quick Benchmark / Sample Button */}
          <TouchableOpacity
            style={styles.testSampleButton}
            onPress={handleSimulateVoiceCapture}
            disabled={isRecording || isProcessingVoice}
          >
            <Text style={styles.testSampleButtonText}>🧪 ടെസ്റ്റ് സാമ്പിൾ റൺ ചെയ്യുക (Test Sample)</Text>
          </TouchableOpacity>

          {/* Dedicated AI4Bharat IndicConformer Transcription Output Display */}
          {indicConformerTranscript && (
            <View style={styles.indicConformerCard}>
              <View style={styles.indicConformerHeader}>
                <View style={styles.indicConformerBadge}>
                  <Text style={styles.indicConformerBadgeText}>HUGGING FACE / INDICCONFORMER</Text>
                </View>
                <Text style={styles.indicConformerLang}>മലയാളം / English</Text>
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
                  <Text style={styles.vitalValue}>{structuredRecord.measurements.weight_kg ?? '--'}</Text>
                  <Text style={styles.vitalUnit}>kg</Text>
                </View>
                <View style={styles.vitalCard}>
                  <Text style={styles.vitalLabel}>പനി (Temp)</Text>
                  <Text style={styles.vitalValue}>{structuredRecord.measurements.temperature_f ?? '--'}</Text>
                  <Text style={styles.vitalUnit}>°F</Text>
                </View>
                <View style={styles.vitalCard}>
                  <Text style={styles.vitalLabel}>ഷുഗർ (Sugar)</Text>
                  <Text style={styles.vitalValue}>{structuredRecord.measurements.blood_sugar_mg_dl ?? '--'}</Text>
                  <Text style={styles.vitalUnit}>mg/dL</Text>
                </View>
              </View>
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

        {/* Unresolved Care Ledger & Malnutrition Memory Section */}
        {careLedger && (
          <View style={styles.ledgerCard}>
            <View style={styles.ledgerHeaderRow}>
              <Text style={styles.sectionHeading}>Unresolved Care Ledger</Text>
              <Text style={styles.ledgerCountPill}>{careLedger.care_gaps.length} Active Items</Text>
            </View>

            <Text style={styles.ledgerNarrative}>{careLedger.longitudinal_narrative}</Text>

            {careLedger.malnutrition_trend && (
              <View style={styles.trendBox}>
                <Text style={styles.trendTitle}>📊 Malnutrition Longitudinal Trend:</Text>
                <Text style={styles.trendText}>{careLedger.malnutrition_trend}</Text>
              </View>
            )}

            {careLedger.care_gaps.map((gap) => (
              <View key={gap.id} style={styles.gapItem}>
                <View style={styles.gapHeader}>
                  <Text style={styles.gapProgramme}>[{gap.programme.toUpperCase()}]</Text>
                  <Text style={styles.gapSeverity}>{gap.severity.toUpperCase()}</Text>
                </View>
                <Text style={styles.gapDescription}>{gap.description}</Text>
                <Text style={styles.gapAction}>Action: {gap.recommended_action}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Status Message Footer */}
        <View style={styles.footerNote}>
          <Text style={styles.footerText}>⚡ Swaram Next-Gen Status: {lastActionMessage}</Text>
        </View>
      </ScrollView>

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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827'
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2
  },
  badgeColumn: {
    alignItems: 'flex-end',
    gap: 4
  },
  priorityPill: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12
  },
  priorityPillText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: 'bold'
  },
  malnutritionBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10
  },
  malnutritionBadgeText: {
    color: '#B45309',
    fontSize: 10,
    fontWeight: '700'
  },
  alertBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444'
  },
  alertTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#991B1B',
    marginBottom: 4
  },
  alertItem: {
    fontSize: 12,
    color: '#7F1D1D',
    marginVertical: 1
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
  langSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0'
  },
  langSelectorLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534'
  },
  langPillContainer: {
    flexDirection: 'row',
    gap: 4
  },
  langPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#DCFCE7'
  },
  langPillActive: {
    backgroundColor: '#15803D'
  },
  langPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#166534'
  },
  langPillTextActive: {
    color: '#FFFFFF'
  },
  langPolicyNote: {
    fontSize: 10,
    color: '#15803D',
    fontStyle: 'italic',
    marginBottom: 12
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
  testSampleButton: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center'
  },
  testSampleButtonText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600'
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
  ledgerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 16
  },
  ledgerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  ledgerCountPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#B45309'
  },
  ledgerNarrative: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 8,
    lineHeight: 18
  },
  trendBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    marginBottom: 4
  },
  trendTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1D4ED8'
  },
  trendText: {
    fontSize: 11,
    color: '#1E40AF',
    marginTop: 2
  },
  gapItem: {
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    paddingLeft: 8,
    marginTop: 8
  },
  gapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  gapProgramme: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1F2937'
  },
  gapSeverity: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#D97706'
  },
  gapDescription: {
    fontSize: 11,
    color: '#4B5563',
    marginTop: 2
  },
  gapAction: {
    fontSize: 11,
    color: '#059669',
    marginTop: 2,
    fontStyle: 'italic'
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
  }
});
