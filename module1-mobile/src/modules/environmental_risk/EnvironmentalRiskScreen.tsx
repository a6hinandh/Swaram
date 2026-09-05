import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch
} from 'react-native';
import { AppIcon } from '../shared/navigation/AppIcon';
import { CookingFuelType, WaterSourceSafety } from './types';
import { calculateHeatRiskTier, evaluateOverallEnvironmentalRisk } from './services/environmentalRiskService';

export const EnvironmentalRiskScreen: React.FC = () => {
  const [cookingFuel, setCookingFuel] = useState<CookingFuelType>('biomass_chulha');
  const [waterSource, setWaterSource] = useState<WaterSourceSafety>('open_well_untested');
  const [hasWaterStagnation, setHasWaterStagnation] = useState<boolean>(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Local climatic reading (can be fetched from IMD / local sensors)
  const tempC = 34;
  const humidity = 75;
  const heatTier = calculateHeatRiskTier(tempC, humidity);
  const overallRisk = evaluateOverallEnvironmentalRisk(
    heatTier,
    cookingFuel,
    waterSource,
    hasWaterStagnation
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
          <Text style={styles.title}>Environmental & Climate Risk</Text>
          <Text style={styles.subtitle}>Household climate vulnerability and environmental health</Text>
        </View>

        {/* Ambient Climate Conditions */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardSectionTitle}>Aluva Ward Weather Station</Text>
              <Text style={styles.cardSectionSubtitle}>Real-time ambient heat and humidity</Text>
            </View>
            <View style={[styles.badge, heatTier === 'danger' || heatTier === 'extreme_caution' ? styles.badgeWarning : styles.badgeNormal]}>
              <Text style={styles.badgeText}>
                {heatTier === 'extreme_caution' ? 'Caution' : heatTier}
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Ambient Temp</Text>
              <Text style={styles.statValue}>{tempC}°C</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Relative Humidity</Text>
              <Text style={styles.statValue}>{humidity}%</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Wet-Bulb Index</Text>
              <Text style={styles.statValue}>High</Text>
            </View>
          </View>
        </View>

        {/* Indoor Air & Fuel */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Indoor Cooking Fuel</Text>
          <Text style={styles.cardSectionSubtitle}>Household smoke exposure risk</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                cookingFuel === 'lpg_clean' && styles.toggleBtnActive
              ]}
              onPress={() => setCookingFuel('lpg_clean')}
            >
              <Text
                style={[
                  styles.toggleBtnText,
                  cookingFuel === 'lpg_clean' && styles.toggleBtnTextActive
                ]}
              >
                LPG Clean
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                cookingFuel === 'biomass_chulha' && styles.toggleBtnActive
              ]}
              onPress={() => setCookingFuel('biomass_chulha')}
            >
              <Text
                style={[
                  styles.toggleBtnText,
                  cookingFuel === 'biomass_chulha' && styles.toggleBtnTextActive
                ]}
              >
                Biomass Chulha
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Water Source & Vector Stagnation */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Water Source & Vector Risks</Text>
          <Text style={styles.cardSectionSubtitle}>Dengue and leptospirosis prevention</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                waterSource === 'piped_treated' && styles.toggleBtnActive
              ]}
              onPress={() => setWaterSource('piped_treated')}
            >
              <Text
                style={[
                  styles.toggleBtnText,
                  waterSource === 'piped_treated' && styles.toggleBtnTextActive
                ]}
              >
                Piped Treated
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                waterSource === 'open_well_untested' && styles.toggleBtnActive
              ]}
              onPress={() => setWaterSource('open_well_untested')}
            >
              <Text
                style={[
                  styles.toggleBtnText,
                  waterSource === 'open_well_untested' && styles.toggleBtnTextActive
                ]}
              >
                Open Well
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Water Stagnation Near House</Text>
              <Text style={styles.switchSubtext}>Mosquito breeding risk within 15 meters</Text>
            </View>
            <Switch
              value={hasWaterStagnation}
              onValueChange={setHasWaterStagnation}
              trackColor={{ false: '#D1D5DB', true: '#065F46' }}
            />
          </View>
        </View>

        {/* Overall Risk Output */}
        <View
          style={[
            styles.summaryCard,
            overallRisk === 'high' ? styles.summaryCardHigh : styles.summaryCardNormal
          ]}
        >
          <View style={styles.summaryHeader}>
            <AppIcon
              name={overallRisk === 'high' ? 'alert' : 'check'}
              size={20}
              color={overallRisk === 'high' ? '#B45309' : '#047857'}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryTitle}>
                Climate Risk Level: {overallRisk.toUpperCase()}
              </Text>
              <Text style={styles.summaryText}>
                {overallRisk === 'high'
                  ? 'Urgent advice: boil well water, clear water stagnation, ensure cross-ventilation during cooking.'
                  : 'Environmental parameters within acceptable frontline bounds.'}
              </Text>
            </View>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity style={styles.primaryButton} onPress={handleSave}>
          <AppIcon name="check" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>
            {savedSuccess ? 'Assessment Saved' : 'Save Environmental Record'}
          </Text>
        </TouchableOpacity>

        {/* Teammate 2 Scaffold Note */}
        <View style={styles.devNote}>
          <View style={styles.devNoteHeader}>
            <AppIcon name="info" size={16} color="#4B5563" />
            <Text style={styles.devNoteTitle}>Teammate 2 Workspace</Text>
          </View>
          <Text style={styles.devNoteBody}>
            Extend this module in src/modules/environmental_risk. Integrate IMD weather API or offline geo-hazard cache, add water chlorination logs, and trigger heatwave alerts.
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
    alignItems: 'center',
    justifyContent: 'space-between',
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
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  badgeNormal: {
    backgroundColor: '#DCFCE7'
  },
  badgeWarning: {
    backgroundColor: '#FEF3C7'
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1F2937',
    textTransform: 'capitalize'
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center'
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280'
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginTop: 2
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center'
  },
  toggleBtnActive: {
    backgroundColor: '#065F46',
    borderColor: '#065F46'
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151'
  },
  toggleBtnTextActive: {
    color: '#FFFFFF'
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6'
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937'
  },
  switchSubtext: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1
  },
  summaryCard: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12
  },
  summaryCardNormal: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0'
  },
  summaryCardHigh: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A'
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827'
  },
  summaryText: {
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
