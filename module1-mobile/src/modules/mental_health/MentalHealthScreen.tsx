import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView
} from 'react-native';
import { AppIcon } from '../shared/navigation/AppIcon';
import { PhqFrequencyScore } from './types';
import { calculatePhq2Score } from './services/mentalHealthService';

export const MentalHealthScreen: React.FC = () => {
  const [anxQ1Score, setAnxQ1Score] = useState<PhqFrequencyScore>(0);
  const [anxQ2Score, setAnxQ2Score] = useState<PhqFrequencyScore>(0);
  const [depQ1Score, setDepQ1Score] = useState<PhqFrequencyScore>(0);
  const [depQ2Score, setDepQ2Score] = useState<PhqFrequencyScore>(0);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const anxietyTotal = anxQ1Score + anxQ2Score;
  const depressionTotal = depQ1Score + depQ2Score;
  const phq4Total = anxietyTotal + depressionTotal;
  const referralNeeded = anxietyTotal >= 3 || depressionTotal >= 3;

  const options: { label: string; value: PhqFrequencyScore }[] = [
    { label: '0 - Never', value: 0 },
    { label: '1 - Several days', value: 1 },
    { label: '2 - Half the days', value: 2 },
    { label: '3 - Daily', value: 3 }
  ];

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Module Header */}
        <View style={styles.headerBlock}>
          <Text style={styles.title}>Mental Health Voice Protocol</Text>
          <Text style={styles.subtitle}>Frontline conversational distress, Anxiety (GAD-2) & Depression (PHQ-2) screening</Text>
        </View>

        {/* --- ANXIETY SECTION (GAD-2) --- */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#1E40AF', marginBottom: 8 }}>
            ‍🩺 1. ഉത്കണ്ഠാ നിർണ്ണയം (Anxiety Screening - GAD-2)
          </Text>

          {/* Anxiety Question 1 */}
          <View style={styles.card}>
            <Text style={styles.questionNumber}>Question 1 of 4 (Anxiety)</Text>
            <Text style={styles.questionText}>
              Feeling nervous, anxious, or on edge over past 2 weeks
            </Text>
            <Text style={styles.questionSubtext}>
              കഴിഞ്ഞ രണ്ടാഴ്ചയായി പരിഭ്രമമോ ഉത്കണ്ഠയോ അസ്വസ്ഥതയോ അനുഭവപ്പെടുക
            </Text>
            <View style={styles.scoreRow}>
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.scoreButton,
                    anxQ1Score === opt.value && styles.scoreButtonActive
                  ]}
                  onPress={() => setAnxQ1Score(opt.value)}
                >
                  <Text
                    style={[
                      styles.scoreButtonText,
                      anxQ1Score === opt.value && styles.scoreButtonTextActive
                    ]}
                  >
                    {opt.value}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Anxiety Question 2 */}
          <View style={styles.card}>
            <Text style={styles.questionNumber}>Question 2 of 4 (Anxiety)</Text>
            <Text style={styles.questionText}>
              Not being able to stop or control worrying over past 2 weeks
            </Text>
            <Text style={styles.questionSubtext}>
              ആകുലതകളും ഉത്കണ്ഠകളും നിയന്ത്രിക്കാൻ കഴിയാതെ വരിക
            </Text>
            <View style={styles.scoreRow}>
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.scoreButton,
                    anxQ2Score === opt.value && styles.scoreButtonActive
                  ]}
                  onPress={() => setAnxQ2Score(opt.value)}
                >
                  <Text
                    style={[
                      styles.scoreButtonText,
                      anxQ2Score === opt.value && styles.scoreButtonTextActive
                    ]}
                  >
                    {opt.value}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* --- DEPRESSION SECTION (PHQ-2) --- */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#991B1B', marginBottom: 8 }}>
            🧠 2. വിഷാദ രോഗ നിർണ്ണയം (Depression Screening - PHQ-2)
          </Text>

          {/* Depression Question 1 */}
          <View style={styles.card}>
            <Text style={styles.questionNumber}>Question 3 of 4 (Depression)</Text>
            <Text style={styles.questionText}>
              Little interest or pleasure in doing things over past 2 weeks
            </Text>
            <Text style={styles.questionSubtext}>
              കഴിഞ്ഞ രണ്ടാഴ്ചയായി കാര്യങ്ങൾ ചെയ്യുന്നതിൽ താല്പര്യക്കുറവ്
            </Text>
            <View style={styles.scoreRow}>
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.scoreButton,
                    depQ1Score === opt.value && styles.scoreButtonActive
                  ]}
                  onPress={() => setDepQ1Score(opt.value)}
                >
                  <Text
                    style={[
                      styles.scoreButtonText,
                      depQ1Score === opt.value && styles.scoreButtonTextActive
                    ]}
                  >
                    {opt.value}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Depression Question 2 */}
          <View style={styles.card}>
            <Text style={styles.questionNumber}>Question 4 of 4 (Depression)</Text>
            <Text style={styles.questionText}>
              Feeling down, depressed, or hopeless over past 2 weeks
            </Text>
            <Text style={styles.questionSubtext}>
              വിഷാദമോ പ്രതീക്ഷയില്ലായ്മയോ അനുഭവപ്പെടുക
            </Text>
            <View style={styles.scoreRow}>
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.scoreButton,
                    depQ2Score === opt.value && styles.scoreButtonActive
                  ]}
                  onPress={() => setDepQ2Score(opt.value)}
                >
                  <Text
                    style={[
                      styles.scoreButtonText,
                      depQ2Score === opt.value && styles.scoreButtonTextActive
                    ]}
                  >
                    {opt.value}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Live Score Triage Result */}
        <View style={[styles.resultCard, referralNeeded ? styles.resultCardWarning : styles.resultCardNormal]}>
          <View style={styles.resultHeader}>
            <View style={styles.resultIconWrapper}>
              <AppIcon
                name={referralNeeded ? 'alert' : 'check'}
                size={20}
                color={referralNeeded ? '#B45309' : '#047857'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultTitle}>
                Anxiety: {anxietyTotal}/6 | Depression: {depressionTotal}/6
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: referralNeeded ? '#92400E' : '#065F46', marginTop: 2 }}>
                Total Score (PHQ-4): {phq4Total} / 12
              </Text>
              <Text style={styles.resultDescription}>
                {referralNeeded
                  ? 'Sub-score >= 3 detected. Initiate detailed clinical screening and counselor referral.'
                  : 'Scores within normal baseline threshold. Routine follow-up recommended.'}
              </Text>
            </View>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity style={styles.primaryButton} onPress={handleSave}>
          <AppIcon name="check" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>
            {savedSuccess ? 'Screening Saved' : 'Save Screening Record'}
          </Text>
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
    marginBottom: 14
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2
  },
  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12
  },
  patientInfo: {
    flex: 1
  },
  patientName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937'
  },
  patientMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2
  },
  patientTag: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  patientTagText: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: '600'
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12
  },
  questionNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  questionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: 20
  },
  questionSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 3,
    marginBottom: 10
  },
  scoreRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4
  },
  scoreButton: {
    flex: 1,
    height: 40,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  scoreButtonActive: {
    backgroundColor: '#065F46',
    borderColor: '#065F46'
  },
  scoreButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151'
  },
  scoreButtonTextActive: {
    color: '#FFFFFF'
  },
  resultCard: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12
  },
  resultCardNormal: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0'
  },
  resultCardWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A'
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  resultIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827'
  },
  resultDescription: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 2,
    lineHeight: 16
  },
  voiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827'
  },
  cardSectionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1
  },
  miniButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 6
  },
  miniButtonActive: {
    backgroundColor: '#065F46'
  },
  miniButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151'
  },
  miniButtonTextActive: {
    color: '#FFFFFF'
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 8
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  metricLabel: {
    fontSize: 11,
    color: '#6B7280'
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginTop: 2
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#065F46',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600'
  },
  devNote: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB'
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
    color: '#374151'
  },
  devNoteBody: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 16
  }
});
