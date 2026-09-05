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
import { TobaccoHabit, AlcoholIntake, DietarySaltRisk, PhysicalActivityLevel, MedicationCompliance } from './types';
import { calculateLifestyleRiskScore } from './services/ncdLifestyleService';

export const NcdLifestyleScreen: React.FC = () => {
  const [tobacco, setTobacco] = useState<TobaccoHabit>('none');
  const [alcohol, setAlcohol] = useState<AlcoholIntake>('none');
  const [saltRisk, setSaltRisk] = useState<DietarySaltRisk>('excessive_pickles_papads');
  const [activity, setActivity] = useState<PhysicalActivityLevel>('sedentary');
  const [dosesTaken, setDosesTaken] = useState<number>(6);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const medication: MedicationCompliance = {
    hasChronicCondition: true,
    prescribedConditions: ['hypertension', 'diabetes'],
    dosesTakenPastWeek: dosesTaken
  };

  const { score, level } = calculateLifestyleRiskScore(
    tobacco,
    alcohol,
    activity,
    saltRisk,
    medication
  );

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.headerBlock}>
          <Text style={styles.title}>NCD Lifestyle Risk Factor Tracking</Text>
          <Text style={styles.subtitle}>Hypertension, diabetes behavioral assessment and CBAC</Text>
        </View>

        {/* Patient Context */}
        <View style={styles.patientCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.patientName}>Chandran N. (Age 56)</Text>
            <Text style={styles.patientMeta}>Known Case: Hypertension + T2DM (Ward 4)</Text>
          </View>
          <View style={styles.patientTag}>
            <Text style={styles.patientTagText}>High Risk Tier</Text>
          </View>
        </View>

        {/* Tobacco & Smoking */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Tobacco & Smoking Habit</Text>
          <Text style={styles.cardSectionSubtitle}>Cigarette, beedi, or smokeless gutkha use</Text>
          <View style={styles.choiceRow}>
            {(['none', 'smoking', 'smokeless_chewing'] as TobaccoHabit[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.choiceBtn, tobacco === t && styles.choiceBtnActive]}
                onPress={() => setTobacco(t)}
              >
                <Text style={[styles.choiceBtnText, tobacco === t && styles.choiceBtnTextActive]}>
                  {t === 'smokeless_chewing' ? 'Chewing' : t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Alcohol Intake */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Alcohol Intake Frequency</Text>
          <Text style={styles.cardSectionSubtitle}>Weekly consumption pattern</Text>
          <View style={styles.choiceRow}>
            {(['none', 'occasional', 'frequent'] as AlcoholIntake[]).map((a) => (
              <TouchableOpacity
                key={a}
                style={[styles.choiceBtn, alcohol === a && styles.choiceBtnActive]}
                onPress={() => setAlcohol(a)}
              >
                <Text style={[styles.choiceBtnText, alcohol === a && styles.choiceBtnTextActive]}>
                  {a.charAt(0).toUpperCase() + a.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Diet & Salt Intake */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Dietary Salt & Fried Food Intake</Text>
          <Text style={styles.cardSectionSubtitle}>Daily intake of pickles, papads, reheated oil</Text>
          <View style={styles.choiceRow}>
            <TouchableOpacity
              style={[
                styles.choiceBtn,
                saltRisk === 'normal' && styles.choiceBtnActive
              ]}
              onPress={() => setSaltRisk('normal')}
            >
              <Text
                style={[
                  styles.choiceBtnText,
                  saltRisk === 'normal' && styles.choiceBtnTextActive
                ]}
              >
                Moderate Salt
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.choiceBtn,
                saltRisk === 'excessive_pickles_papads' && styles.choiceBtnActive
              ]}
              onPress={() => setSaltRisk('excessive_pickles_papads')}
            >
              <Text
                style={[
                  styles.choiceBtnText,
                  saltRisk === 'excessive_pickles_papads' && styles.choiceBtnTextActive
                ]}
              >
                High Salt / Pickles
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Chronic Medication Adherence */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardSectionTitle}>BP & Sugar Medication Adherence</Text>
              <Text style={styles.cardSectionSubtitle}>Pills taken in past 7 days</Text>
            </View>
            <Text style={styles.dosesValueText}>{dosesTaken} / 7 days</Text>
          </View>
          <View style={styles.dosesRow}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((num) => (
              <TouchableOpacity
                key={num}
                style={[
                  styles.dosePill,
                  dosesTaken === num && styles.dosePillActive
                ]}
                onPress={() => setDosesTaken(num)}
              >
                <Text
                  style={[
                    styles.dosePillText,
                    dosesTaken === num && styles.dosePillTextActive
                  ]}
                >
                  {num}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Lifestyle Risk Score Result */}
        <View
          style={[
            styles.scoreCard,
            level === 'high' ? styles.scoreCardHigh : level === 'moderate' ? styles.scoreCardModerate : styles.scoreCardLow
          ]}
        >
          <View style={styles.scoreHeader}>
            <AppIcon
              name={level === 'high' ? 'alert' : 'check'}
              size={20}
              color={level === 'high' ? '#B45309' : '#047857'}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.scoreTitle}>
                Lifestyle Risk Score: {score} ({level.toUpperCase()})
              </Text>
              <Text style={styles.scoreSubtext}>
                {level === 'high'
                  ? 'Significant cardiovascular risk. Advise dietary salt restriction, regular pill compliance, and PHC review.'
                  : 'Maintain current healthy behaviors and annual NCD screening.'}
              </Text>
            </View>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity style={styles.primaryButton} onPress={handleSave}>
          <AppIcon name="check" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>
            {savedSuccess ? 'Record Saved' : 'Save Lifestyle Record'}
          </Text>
        </TouchableOpacity>

        {/* Teammate 3 Scaffold Note */}
        <View style={styles.devNote}>
          <View style={styles.devNoteHeader}>
            <AppIcon name="info" size={16} color="#4B5563" />
            <Text style={styles.devNoteTitle}>Teammate 3 Workspace</Text>
          </View>
          <Text style={styles.devNoteBody}>
            Extend this module in src/modules/ncd_lifestyle. Implement full NPCDCS / CBAC questionnaire, connect pharmacy pill refill alerts, and bridge with Vitals Delta module.
          </Text>
        </View>
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
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  patientTagText: {
    fontSize: 11,
    color: '#DC2626',
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
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
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
  choiceRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10
  },
  choiceBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center'
  },
  choiceBtnActive: {
    backgroundColor: '#065F46',
    borderColor: '#065F46'
  },
  choiceBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151'
  },
  choiceBtnTextActive: {
    color: '#FFFFFF'
  },
  dosesValueText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46'
  },
  dosesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6
  },
  dosePill: {
    flex: 1,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center'
  },
  dosePillActive: {
    backgroundColor: '#065F46',
    borderColor: '#065F46'
  },
  dosePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151'
  },
  dosePillTextActive: {
    color: '#FFFFFF'
  },
  scoreCard: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12
  },
  scoreCardLow: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0'
  },
  scoreCardModerate: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A'
  },
  scoreCardHigh: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA'
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  scoreTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827'
  },
  scoreSubtext: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 2,
    lineHeight: 16
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
