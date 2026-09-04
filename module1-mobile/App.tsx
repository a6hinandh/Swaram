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
import { apiClient, ApiCallStatus, getActiveHost, setActiveHost } from './src/api/apiClient';
import {
  HouseholdSummary,
  HouseholdCareLedger,
  VisitDraft,
  ConfirmedVisit
} from './src/types';

export default function App() {
  // State for connectivity & Basic Call demonstration
  const [serverIp, setServerIp] = useState<string>(getActiveHost());
  const [showIpConfig, setShowIpConfig] = useState<boolean>(false);
  const [backendStatus, setBackendStatus] = useState<string>('Checking backend...');
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [isCallingApi, setIsCallingApi] = useState<boolean>(false);

  // Core ASHA Workflow State
  const [households, setHouseholds] = useState<HouseholdSummary[]>([]);
  const [selectedHousehold, setSelectedHousehold] = useState<HouseholdSummary | null>(null);
  const [careLedger, setCareLedger] = useState<HouseholdCareLedger | null>(null);

  // Voice Interaction State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState<boolean>(false);
  const [visitDraft, setVisitDraft] = useState<VisitDraft | null>(null);
  const [syncQueueCount, setSyncQueueCount] = useState<number>(1);
  const [lastActionMessage, setLastActionMessage] = useState<string>('Ready for field visits');

  // Perform Initial Load & Basic Call
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
        ? 'Offline Mode (Local Mock Active)'
        : 'Connected to Module 3 Server (Port 8000)'
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

  // Simulate Voice Capture & Extraction (Module 1 -> Module 2)
  const handleSimulateVoiceCapture = async () => {
    if (!selectedHousehold) return;
    setIsRecording(true);
    setLastActionMessage('Listening to Malayalam narrative...');

    // Simulate 2 seconds of speaking
    setTimeout(async () => {
      setIsRecording(false);
      setIsProcessingVoice(true);
      setLastActionMessage('Processing speech via Malayalam ASR & extracting clinical entities...');

      // Basic Call to Voice Intelligence
      const draftResult = await apiClient.processVoiceVisit('sample-visit-audio.wav');
      setVisitDraft(draftResult.data);
      setIsProcessingVoice(false);
      setLastActionMessage('Voice extraction complete. Please review and confirm record.');
    }, 1800);
  };

  // Worker Human-Confirmation Gate (No record is committed without worker consent)
  const handleConfirmVisit = async () => {
    if (!visitDraft || !selectedHousehold) return;

    const confirmed: ConfirmedVisit = {
      visit_id: visitDraft.visit_id,
      household_id: selectedHousehold.id,
      worker_id: visitDraft.worker_id,
      timestamp: new Date().toISOString(),
      person_updates: visitDraft.person_updates,
      confirmed_by_worker_at: new Date().toISOString(),
      sync_status: isBackendConnected ? 'synced' : 'pending'
    };

    const submitResult = await apiClient.submitConfirmedVisit(confirmed);
    setVisitDraft(null);
    if (submitResult.isMockFallback) {
      setSyncQueueCount((prev) => prev + 1);
    }
    setLastActionMessage(`Visit Confirmed! ${submitResult.message}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B3D2E" />

      {/* App Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>സ്വരം • SWARAM</Text>
          <Text style={styles.headerSubtitle}>ASHA Field Voice Assistant (വാർഡ് 4, ആലുവ)</Text>
        </View>
        <View style={styles.syncBadge}>
          <Text style={styles.syncBadgeText}>
            {syncQueueCount > 0 ? `⏳ ${syncQueueCount} Pending Sync` : '✓ All Synced'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Basic Call Connectivity Banner */}
        <View style={[styles.networkBanner, isBackendConnected ? styles.bannerOnline : styles.bannerOffline]}>
          <View style={styles.bannerRow}>
            <View style={[styles.statusDot, isBackendConnected ? styles.dotGreen : styles.dotAmber]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerText}>
                Backend: <Text style={{ fontWeight: 'bold' }}>{backendStatus}</Text>
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
                <Text style={styles.testCallButtonText}>Test Call</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Dynamic IP Configuration Bar (Shown when IP button is tapped) */}
        {showIpConfig && (
          <View style={styles.ipConfigCard}>
            <Text style={styles.ipConfigLabel}>Configure Computer / Backend IP:</Text>
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
            <Text style={styles.ipHelpText}>
              Note: Mobile phones cannot use "localhost". Your computer's current Wi-Fi IP is: <Text style={{ fontWeight: 'bold' }}>172.18.100.139</Text>
            </Text>
          </View>
        )}

        {/* Selected Household Overview Card */}
        {selectedHousehold && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.cardTitle}>{selectedHousehold.head_of_household}</Text>
                <Text style={styles.cardSubtitle}>{selectedHousehold.external_id} • {selectedHousehold.address}</Text>
              </View>
              <View style={styles.priorityPill}>
                <Text style={styles.priorityPillText}>Score: {selectedHousehold.priority_score}</Text>
              </View>
            </View>

            {/* Overdue/Care Gaps Alerts */}
            <View style={styles.alertBox}>
              <Text style={styles.alertTitle}>ശ്രദ്ധിക്കേണ്ട കാര്യങ്ങൾ (Urgent Care Gaps):</Text>
              {selectedHousehold.priority_reasons.map((reason, idx) => (
                <Text key={idx} style={styles.alertItem}>• {reason}</Text>
              ))}
            </View>
          </View>
        )}

        {/* Voice Visit Capture Section */}
        <View style={styles.voiceSection}>
          <Text style={styles.sectionHeading}>സന്ദർശനം രേഖപ്പെടുത്തുക (Record Visit)</Text>
          <Text style={styles.instructionText}>
            Speak natural Malayalam: Describe vitals, symptoms, medicine, and next visit date.
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
                    : 'സംസാരിക്കുക (Simulate Voice Visit)'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
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

        {/* Unresolved Care Ledger Section */}
        {careLedger && (
          <View style={styles.ledgerCard}>
            <Text style={styles.sectionHeading}>Unresolved Care Ledger ({careLedger.care_gaps.length} Open)</Text>
            <Text style={styles.ledgerNarrative}>{careLedger.longitudinal_narrative}</Text>

            {careLedger.care_gaps.map((gap) => (
              <View key={gap.id} style={styles.gapItem}>
                <View style={styles.gapHeader}>
                  <Text style={styles.gapProgramme}>[{gap.programme.toUpperCase()}]</Text>
                  <Text style={styles.gapSeverity}>{gap.severity}</Text>
                </View>
                <Text style={styles.gapDescription}>{gap.description}</Text>
                <Text style={styles.gapAction}>Action: {gap.recommended_action}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Status Message Footer */}
        <View style={styles.footerNote}>
          <Text style={styles.footerText}>⚡ System Status: {lastActionMessage}</Text>
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
    backgroundColor: '#0B3D2E',
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
  syncBadge: {
    backgroundColor: '#065F46',
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
    backgroundColor: '#0B3D2E',
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
  ipHelpText: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 6
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
  priorityPill: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  priorityPillText: {
    color: '#B91C1C',
    fontSize: 11,
    fontWeight: 'bold'
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
    backgroundColor: '#0B3D2E'
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
  extractedTable: {
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12
  },
  tableRow: {
    fontSize: 13,
    color: '#1F2937',
    marginVertical: 2
  },
  bold: {
    fontWeight: 'bold'
  },
  confActions: {
    flexDirection: 'row',
    gap: 10
  },
  confirmButton: {
    flex: 2,
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14
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
    fontSize: 14
  },
  ledgerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16
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
