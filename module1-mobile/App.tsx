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
  TextInput
} from 'react-native';
import { apiClient, getActiveHost, setActiveHost } from './src/api/apiClient';
import {
  HouseholdSummary,
  HouseholdCareLedger,
  VisitDraft,
  ConfirmedVisit,
  MissingFieldPrompt
} from './src/types';

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

  // Conversational Survey & Voice Interaction State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState<boolean>(false);
  const [visitDraft, setVisitDraft] = useState<VisitDraft | null>(null);
  const [isResolvingPrompt, setIsResolvingPrompt] = useState<boolean>(false);
  const [syncQueueCount, setSyncQueueCount] = useState<number>(1);
  const [lastActionMessage, setLastActionMessage] = useState<string>('Ready for conversational surveys');

  // Initial Load
  useEffect(() => {
    runBasicCall();
  }, []);

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

  // 1. Conversational Voice Survey Capture (Natural Speech -> ASR -> Auto Extraction)
  const handleSimulateVoiceCapture = async () => {
    if (!selectedHousehold) return;
    setIsRecording(true);
    setLastActionMessage('Listening to natural Malayalam field conversation...');

    setTimeout(async () => {
      setIsRecording(false);
      setIsProcessingVoice(true);
      setLastActionMessage('Converting speech via Malayalam ASR & auto-extracting survey fields...');

      const draftResult = await apiClient.processVoiceVisit('sample-visit-audio.wav');
      setVisitDraft(draftResult.data);
      setIsProcessingVoice(false);
      setLastActionMessage('Survey auto-populated. Check for missing information prompts.');
    }, 1800);
  };

  // 2. Proactive Conversational Follow-up: Resolving Missing Fields via Voice Dialogue
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

  // 3. Human Confirmation Gate & Central Submission
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

          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity
              style={styles.configButton}
              onPress={() => setShowIpConfig(!showIpConfig)}
            >
              <Text style={styles.configButtonText}>{showIpConfig ? 'Close' : 'IP'}</Text>
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
                placeholder="e.g. 172.18.100.139"
                autoCapitalize="none"
                keyboardType="numeric"
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
              <View>
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
            സ്വാഭാവിക സംഭാഷണം: രോഗവിവരങ്ങൾ, രക്തസമ്മർദ്ദം, കുട്ടിയുടെ പോഷകാഹാരം, മരുന്നുകൾ സംസാരിക്കുക. ടൈപ്പിംഗ് ആവശ്യമില്ല!
          </Text>

          <TouchableOpacity
            style={[
              styles.recordButton,
              isRecording ? styles.recordButtonActive : styles.recordButtonIdle
            ]}
            onPress={handleSimulateVoiceCapture}
            disabled={isRecording || isProcessingVoice}
          >
            {isProcessingVoice ? (
              <ActivityIndicator size="large" color="#FFFFFF" />
            ) : (
              <View style={styles.buttonContent}>
                <Text style={styles.micIcon}>{isRecording ? '⏹' : '🎙️'}</Text>
                <Text style={styles.recordButtonText}>
                  {isRecording
                    ? 'റെക്കോർഡ് ചെയ്യുന്നു... (Tap to stop)'
                    : 'സംസാരിക്കുക (Simulate Voice Survey)'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Proactive Missing Information Dialogue Card */}
        {visitDraft && visitDraft.missing_field_prompts && visitDraft.missing_field_prompts.length > 0 && (
          <View style={styles.missingPromptCard}>
            <View style={styles.promptHeader}>
              <Text style={styles.promptBadge}>❓ അപൂർണ്ണ വിവരങ്ങൾ (Missing Survey Information)</Text>
              <Text style={styles.promptCount}>{visitDraft.missing_field_prompts.length} Action Needed</Text>
            </View>
            <Text style={styles.promptSubtext}>
              സർവേ പൂർത്തിയാക്കാൻ Swaram ചോദിക്കുന്ന വിവരങ്ങൾ താഴെ മറുപടി നൽകി പൂർത്തിയാക്കുക:
            </Text>

            {visitDraft.missing_field_prompts.map((prompt) => (
              <View key={prompt.question_id} style={styles.promptBox}>
                <Text style={styles.promptQuestionMl}>🗣️ "{prompt.question_text_ml}"</Text>
                <Text style={styles.promptQuestionEn}>{prompt.question_text_en}</Text>

                <TouchableOpacity
                  style={styles.answerButton}
                  onPress={() => handleAnswerMissingPrompt(prompt)}
                  disabled={isResolvingPrompt}
                >
                  {isResolvingPrompt ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.answerButtonText}>
                      🎙️ മറുപടി പറയുക (Answer: "പാലും മുട്ടയും കൊടുക്കാറുണ്ട്")
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Swaram Survey Review Screen (Review Card) */}
        {visitDraft && (
          <View style={styles.confirmationCard}>
            <View style={styles.confHeader}>
              <Text style={styles.confBadge}>📋 ശൈലി സർവേ അവലോകനം (Survey Review Card)</Text>
              <Text style={styles.confConfidence}>Confidence: {(visitDraft.confidence * 100).toFixed(0)}%</Text>
            </View>

            <Text style={styles.transcriptSnippet}>
              🗣️ സംസാരിച്ചത്: "{visitDraft.transcript}"
            </Text>

            {/* Extracted Survey Fields Table */}
            <View style={styles.surveyTable}>
              <Text style={styles.surveySectionTitle}>രേഖപ്പെടുത്തിയ സർവേ വിവരങ്ങൾ (Extracted Survey Responses):</Text>
              {visitDraft.survey_fields && visitDraft.survey_fields.map((field, idx) => (
                <View key={idx} style={styles.surveyRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>{field.question_ml} ({field.question_en})</Text>
                    <Text style={[styles.fieldValue, field.status === 'missing' ? styles.fieldMissing : styles.fieldFilled]}>
                      {field.value}
                    </Text>
                  </View>
                  <View style={[styles.fieldPill, field.status === 'clarified_conversationally' ? styles.pillClarified : styles.pillExtracted]}>
                    <Text style={styles.fieldPillText}>
                      {field.status === 'clarified_conversationally' ? 'Clarified' : 'Extracted'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Malnutrition Assessment Highlight */}
            {visitDraft.malnutrition_assessment && (
              <View style={styles.malnutritionReviewBox}>
                <Text style={styles.malReviewTitle}>🌱 പോഷകാഹാര നിരീക്ഷണം (Malnutrition Screening):</Text>
                <Text style={styles.malReviewText}>
                  • Dietary Diversity: {visitDraft.malnutrition_assessment.dietary_diversity_score || 3}/8 food groups
                </Text>
                <Text style={styles.malReviewText}>
                  • MUAC (Arm Circumference): {visitDraft.malnutrition_assessment.muac_cm || 12.8} cm (Normal)
                </Text>
                <Text style={styles.malReviewText}>
                  • Risk Category: {visitDraft.malnutrition_assessment.risk_level.toUpperCase()}
                </Text>
              </View>
            )}

            {/* Confirmation Gate Buttons */}
            <View style={styles.confActions}>
              <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmVisit}>
                <Text style={styles.confirmButtonText}>✓ വിവരങ്ങൾ സ്ഥിരീകരിച്ച് സമർപ്പിക്കുക (Confirm & Submit)</Text>
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
  dotGreen: { backgroundColor: '#16A34A' },
  dotAmber: { backgroundColor: '#D97706' },
  bannerText: {
    fontSize: 12,
    color: '#1F2937'
  },
  ipSubtitleText: {
    fontSize: 10,
    color: '#4B5563',
    marginTop: 2
  },
  configButton: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6
  },
  configButtonText: {
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
    fontSize: 11,
    fontWeight: 'bold'
  },
  ipConfigCard: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderColor: '#D1D5DB',
    borderWidth: 1
  },
  ipConfigLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 6
  },
  ipInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },
  ipInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    backgroundColor: '#F8FAFC'
  },
  ipSaveButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6
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
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6
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
    fontSize: 12,
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
    color: '#B91C1C',
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
    fontSize: 13,
    fontWeight: 'bold',
    color: '#991B1B',
    marginBottom: 4
  },
  alertItem: {
    fontSize: 12,
    color: '#7F1D1D',
    marginTop: 2
  },
  voiceSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    alignItems: 'center'
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4
  },
  instructionText: {
    fontSize: 12,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 16
  },
  recordButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
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
    alignItems: 'center'
  },
  micIcon: {
    fontSize: 22,
    marginRight: 10,
    color: '#FFFFFF'
  },
  recordButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold'
  },
  missingPromptCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16
  },
  promptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  promptBadge: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#B45309'
  },
  promptCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8
  },
  promptSubtext: {
    fontSize: 12,
    color: '#78350F',
    marginBottom: 12
  },
  promptBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderColor: '#FDE68A',
    borderWidth: 1
  },
  promptQuestionMl: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 4
  },
  promptQuestionEn: {
    fontSize: 12,
    color: '#78350F',
    fontStyle: 'italic',
    marginBottom: 10
  },
  answerButton: {
    backgroundColor: '#D97706',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  answerButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold'
  },
  confirmationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderColor: '#10B981',
    borderWidth: 1.5
  },
  confHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  confBadge: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#065F46'
  },
  confConfidence: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600'
  },
  transcriptSnippet: {
    fontStyle: 'italic',
    color: '#374151',
    backgroundColor: '#ECFDF5',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
    fontSize: 13
  },
  surveyTable: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12
  },
  surveySectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8
  },
  surveyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  fieldLabel: {
    fontSize: 11,
    color: '#4B5563'
  },
  fieldValue: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2
  },
  fieldFilled: {
    color: '#111827'
  },
  fieldMissing: {
    color: '#DC2626',
    fontStyle: 'italic'
  },
  fieldPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8
  },
  pillExtracted: {
    backgroundColor: '#E0F2FE'
  },
  pillClarified: {
    backgroundColor: '#DCFCE7'
  },
  fieldPillText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0369A1'
  },
  malnutritionReviewBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12
  },
  malReviewTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#B45309',
    marginBottom: 4
  },
  malReviewText: {
    fontSize: 12,
    color: '#78350F',
    marginVertical: 1
  },
  confActions: {
    flexDirection: 'row',
    gap: 10
  },
  confirmButton: {
    flex: 3,
    backgroundColor: '#059669',
    paddingVertical: 12,
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
    backgroundColor: '#E5E7EB',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center'
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
    lineHeight: 18,
    marginVertical: 8,
    backgroundColor: '#F3F4F6',
    padding: 10,
    borderRadius: 6
  },
  trendBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8
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
    paddingLeft: 10,
    marginVertical: 6
  },
  gapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  gapProgramme: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#B45309'
  },
  gapSeverity: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#DC2626'
  },
  gapDescription: {
    fontSize: 12,
    color: '#1F2937',
    marginTop: 2
  },
  gapAction: {
    fontSize: 11,
    color: '#4B5563',
    fontStyle: 'italic',
    marginTop: 2
  },
  footerNote: {
    padding: 12,
    alignItems: 'center'
  },
  footerText: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center'
  }
});
