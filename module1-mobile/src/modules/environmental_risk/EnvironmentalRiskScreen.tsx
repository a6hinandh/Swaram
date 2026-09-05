import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../shared/navigation/AppIcon';
import {
  CookingFuelType,
  DrinkingWaterSafety,
  WeatherData,
  HouseholdVulnerability,
  TargetedQuestion,
  CareGapImpact,
  EnvironmentalRiskResult,
  EnvironmentalContext
} from './types';
import {
  KERALA_LOCATIONS,
  LocationCoordinate,
  fetchLocationWeather,
  fetchCurrentDeviceLocationWeather,
  getOfflinePresetWeather
} from './services/weatherService';
import {
  calculateHeatRisk,
  buildEnvironmentalContext,
  identifyTargetedQuestions,
  evaluateEnvironmentalCareImpact
} from './services/environmentalRiskService';
import { apiClient, getActiveHost } from '../../api/apiClient';

const GPS_DEFAULT_LOCATION: LocationCoordinate = {
  id: 'gps_device',
  name: 'My GPS Location',
  nameMl: 'എന്റെ ലൊക്കേഷൻ (GPS)',
  district: 'Live GPS',
  latitude: 10.1076,
  longitude: 76.3516
};

export const EnvironmentalRiskScreen: React.FC = () => {
  // 1. Selected location & weather state (Defaults to Live GPS)
  const [selectedLocation, setSelectedLocation] = useState<LocationCoordinate>(GPS_DEFAULT_LOCATION);
  const [weather, setWeather] = useState<WeatherData>(getOfflinePresetWeather(GPS_DEFAULT_LOCATION));
  const [isLoadingWeather, setIsLoadingWeather] = useState<boolean>(false);

  // 2. Household Vulnerability Context (All unselected by default)
  const [vulnerability, setVulnerability] = useState<HouseholdVulnerability>({
    hasInfant: false,
    hasChild: false,
    hasElderly: false,
    hasPregnantMember: false,
    hasChronicIllness: false,
    hasRespiratoryCondition: false,
    hasPendingCare: false,
    hasPendingReferral: false,
    hasPendingVaccination: false,
    hasPendingANC: false,
    hasMedicationDependency: false
  });

  // 3. Physical Environmental Hazards (Baseline clean/unselected by default)
  const [cookingFuel, setCookingFuel] = useState<CookingFuelType>('lpg');
  const [drinkingWaterSafety, setDrinkingWaterSafety] = useState<DrinkingWaterSafety>('safe');
  const [hasWaterStagnation, setHasWaterStagnation] = useState<boolean>(false);
  const [isFloodProne, setIsFloodProne] = useState<boolean>(false);

  // 4. Targeted Question & Follow-up State
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, 'yes' | 'no'>>({});
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<string, 'yes' | 'no'>>({});
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Auto-fetch GPS on initial load or fetch on location chip tap
  useEffect(() => {
    if (selectedLocation.id === 'gps_device') {
      handleUseCurrentGps();
    } else {
      loadWeatherData(selectedLocation);
    }
  }, [selectedLocation.id]);

  const loadWeatherData = async (loc: LocationCoordinate) => {
    setIsLoadingWeather(true);
    try {
      const data = await fetchLocationWeather(loc);
      setWeather(data);
    } catch (err) {
      console.log('Weather load failed, using fallback:', err);
    } finally {
      setIsLoadingWeather(false);
    }
  };

  const handleUseCurrentGps = async () => {
    setIsLoadingWeather(true);
    try {
      const data = await fetchCurrentDeviceLocationWeather();
      setWeather(data);
      setSelectedLocation({
        id: 'gps_device',
        name: data.locationName,
        nameMl: data.locationName,
        district: 'Current GPS',
        latitude: data.latitude,
        longitude: data.longitude
      });
    } catch {
      console.log('Could not get exact GPS coordinates. Using fallback cached data.');
    } finally {
      setIsLoadingWeather(false);
    }
  };

  const handleRefresh = () => {
    if (selectedLocation.id === 'gps_device') {
      handleUseCurrentGps();
    } else {
      loadWeatherData(selectedLocation);
    }
  };


  // Toggle vulnerability indicators
  const toggleVulnerability = (key: keyof HouseholdVulnerability) => {
    setVulnerability((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Environmental Context build
  const envContext: EnvironmentalContext = buildEnvironmentalContext(
    weather,
    hasWaterStagnation,
    drinkingWaterSafety,
    cookingFuel,
    isFloodProne
  );

  // Identify targeted questions based on Env Trigger + Household Context
  const targetedQuestions: TargetedQuestion[] = identifyTargetedQuestions(
    envContext,
    vulnerability,
    vulnerability.hasPendingANC ? 'ANC follow-up checkup' : undefined
  );

  // Derive all active Care Gap updates & Risk results based on ASHA answers
  const activeCareGaps: CareGapImpact[] = [];
  const riskResults: EnvironmentalRiskResult[] = [];

  targetedQuestions.forEach((q) => {
    const ans = questionAnswers[q.id];
    if (ans) {
      const result = evaluateEnvironmentalCareImpact(q, ans, envContext, vulnerability);
      riskResults.push(result);
      if (result.care_gap) {
        activeCareGaps.push(result.care_gap);
      }
    }
  });

  const handleAnswer = (questionId: string, answer: 'yes' | 'no') => {
    setQuestionAnswers((prev) => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleFollowUpAnswer = (followUpId: string, answer: 'yes' | 'no') => {
    setFollowUpAnswers((prev) => ({
      ...prev,
      [followUpId]: answer
    }));
  };

  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleSaveAssessment = async () => {
    setIsSaving(true);
    const assessmentPayload = {
      assessment_id: `env_${Date.now()}`,
      household_id: 'HH-KUTTANAD-004',
      timestamp: new Date().toISOString(),
      location: {
        id: selectedLocation.id,
        name: weather.locationName || selectedLocation.name,
        district: selectedLocation.district,
        latitude: weather.latitude,
        longitude: weather.longitude
      },
      weather: weather,
      environmental_context: envContext,
      household_vulnerability: vulnerability,
      physical_hazards: {
        cookingFuel,
        drinkingWaterSafety,
        hasWaterStagnation,
        isFloodProne
      },
      question_answers: questionAnswers,
      follow_up_answers: followUpAnswers,
      care_gaps: activeCareGaps,
      risk_summary: riskResults
    };

    try {
      const res = await apiClient.saveEnvironmentalAssessment(assessmentPayload);
      setSavedSuccess(true);

      const careGapSummary = activeCareGaps.length > 0
        ? `\n\n📌 Care Gaps Updated (${activeCareGaps.length}):\n${activeCareGaps.map(g => `• ${g.description} [${g.priority.toUpperCase()}]`).join('\n')}`
        : '';

      const isMongo = res.data.storage === 'mongodb';
      const storageInfo = isMongo
        ? '🍃 Saved to MongoDB Database (Collection: environmental_assessments)'
        : `💾 Saved to Local Ledger (Backend unreachable at ${getActiveHost()}:8000)`;

      Alert.alert(
        isMongo ? 'പരിസ്ഥിതി ആരോഗ്യ രേഖ സേവ് ചെയ്തു' : 'ഓഫ്‌ലൈൻ രേഖ',
        `${storageInfo}\n\nലൊക്കേഷൻ: ${assessmentPayload.location.name}\nതാപനില: ${weather.temperatureCelsius}°C | മഴ: ${weather.precipitationMm}mm${careGapSummary}`,
        [{ text: 'OK', onPress: () => setTimeout(() => setSavedSuccess(false), 4000) }]
      );
    } catch (e) {
      Alert.alert('പരിസ്ഥിതി രേഖ', 'പരിസ്ഥിതി ആരോഗ്യ വിവരങ്ങൾ ലോക്കൽ ലെഡ്ജറിൽ രേഖപ്പെടുത്തി.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Screen Header */}
        <View style={styles.headerBlock}>
          <Text style={styles.title}>Environmental & Climate Risk Monitoring</Text>
          <Text style={styles.subtitle}>
            പരിസ്ഥിതി സാഹചര്യങ്ങളും വ്യക്തിഗത ആരോഗ്യ മുൻഗണനകളും (Proactive Care-Gap Integration)
          </Text>
        </View>

        {/* 1. Location & Ambient Climate Context Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardSectionTitle}>📍 Ward Location & Ambient Context</Text>
              <Text style={styles.cardSectionSubtitle}>
                {selectedLocation.district} • {weather.isLiveFetched ? '⚡ Live Open-Meteo' : '📱 Local Cached'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={handleRefresh}
              disabled={isLoadingWeather}
            >
              {isLoadingWeather ? (
                <ActivityIndicator size="small" color="#065F46" />
              ) : (
                <Text style={styles.refreshBtnText}>🔄 Refresh</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Location Selector Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.locationScroll}>
            <TouchableOpacity
              style={[
                styles.locChip,
                styles.locGpsChip,
                selectedLocation.id === 'gps_device' && styles.locChipActive
              ]}
              onPress={handleUseCurrentGps}
            >
              <Text
                style={[
                  styles.locChipText,
                  styles.locGpsChipText,
                  selectedLocation.id === 'gps_device' && styles.locChipTextActive
                ]}
              >
                📍 My GPS Location
              </Text>
            </TouchableOpacity>

            {KERALA_LOCATIONS.map((loc) => (
              <TouchableOpacity
                key={loc.id}
                style={[
                  styles.locChip,
                  selectedLocation.id === loc.id && styles.locChipActive
                ]}
                onPress={() => setSelectedLocation(loc)}
              >
                <Text
                  style={[
                    styles.locChipText,
                    selectedLocation.id === loc.id && styles.locChipTextActive
                  ]}
                >
                  {loc.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Detected Area Banner */}
          <View style={styles.detectedAreaBanner}>
            <View style={styles.detectedAreaIconBox}>
              <Text style={styles.detectedAreaIcon}>
                {selectedLocation.id === 'gps_device' ? '🛰️' : '📍'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detectedAreaLabel}>
                {selectedLocation.id === 'gps_device' ? 'Live GPS Location' : 'Selected Health Ward'}:
              </Text>
              <Text style={styles.detectedAreaName}>
                {weather.locationName || selectedLocation.name}
              </Text>
              <Text style={styles.detectedAreaCoords}>
                GPS: {weather.latitude.toFixed(4)}°N, {weather.longitude.toFixed(4)}°E • Updated {weather.fetchedAt}
              </Text>
            </View>
            <View style={[styles.sourceBadge, weather.isLiveFetched ? styles.sourceBadgeLive : styles.sourceBadgeSim]}>
              <Text style={styles.sourceBadgeText}>{weather.isLiveFetched ? 'LIVE' : 'CACHED'}</Text>
            </View>
          </View>

          {/* Ambient Context Grid (Treated as CONTEXT, not diagnosis) */}
          <View style={styles.weatherGrid}>
            <View style={styles.weatherBox}>
              <Text style={styles.weatherLabel}>Temperature</Text>
              <Text style={styles.weatherVal}>{weather.temperatureCelsius}°C</Text>
              <Text style={styles.weatherSub}>Heat: {envContext.heatRisk.toUpperCase()}</Text>
            </View>

            <View style={styles.weatherBox}>
              <Text style={styles.weatherLabel}>Precipitation</Text>
              <Text style={[styles.weatherVal, envContext.heavyRain ? styles.textRain : null]}>
                {weather.precipitationMm} mm
              </Text>
              <Text style={styles.weatherSub}>{envContext.heavyRain ? 'Heavy Rain' : 'Normal'}</Text>
            </View>

            <View style={styles.weatherBox}>
              <Text style={styles.weatherLabel}>Humidity</Text>
              <Text style={styles.weatherVal}>{weather.humidityPercent}%</Text>
              <Text style={styles.weatherSub}>{weather.humidityPercent >= 80 ? 'High' : 'Normal'}</Text>
            </View>

            <View style={styles.weatherBox}>
              <Text style={styles.weatherLabel}>Air Quality (AQI)</Text>
              <Text style={[styles.weatherVal, weather.aqiUs > 100 ? styles.textAqiHigh : styles.textAqiGood]}>
                {weather.aqiUs}
              </Text>
              <Text style={styles.weatherSub}>{weather.aqiCategory.replace('_', ' ')}</Text>
            </View>
          </View>
        </View>

        {/* 2. Household Vulnerability & Care Gap Context */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>🏠 Household Vulnerability & Care Context</Text>
          <Text style={styles.cardSectionSubtitle}>
            Matched against ASHA care register to identify who requires attention:
          </Text>

          <View style={styles.chipGrid}>
            <TouchableOpacity
              style={[styles.vulnChip, vulnerability.hasPregnantMember && styles.vulnChipActive]}
              onPress={() => toggleVulnerability('hasPregnantMember')}
            >
              <Text style={[styles.vulnChipText, vulnerability.hasPregnantMember && styles.vulnChipTextActive]}>
                🤰 ഗർഭിണി (Pregnant)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.vulnChip, vulnerability.hasPendingANC && styles.vulnChipActive]}
              onPress={() => toggleVulnerability('hasPendingANC')}
            >
              <Text style={[styles.vulnChipText, vulnerability.hasPendingANC && styles.vulnChipTextActive]}>
                📅 ബാക്കിയുള്ള ANC (Pending ANC)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.vulnChip, vulnerability.hasChild && styles.vulnChipActive]}
              onPress={() => toggleVulnerability('hasChild')}
            >
              <Text style={[styles.vulnChipText, vulnerability.hasChild && styles.vulnChipTextActive]}>
                👶 കുട്ടികൾ (Child &lt; 5)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.vulnChip, vulnerability.hasElderly && styles.vulnChipActive]}
              onPress={() => toggleVulnerability('hasElderly')}
            >
              <Text style={[styles.vulnChipText, vulnerability.hasElderly && styles.vulnChipTextActive]}>
                👵 മുതിർന്നവർ (Elderly &gt; 65)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.vulnChip, vulnerability.hasChronicIllness && styles.vulnChipActive]}
              onPress={() => toggleVulnerability('hasChronicIllness')}
            >
              <Text style={[styles.vulnChipText, vulnerability.hasChronicIllness && styles.vulnChipTextActive]}>
                🏥 തുടർചികിത്സ / മരുന്ന് (Chronic Care)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.vulnChip, vulnerability.hasPendingVaccination && styles.vulnChipActive]}
              onPress={() => toggleVulnerability('hasPendingVaccination')}
            >
              <Text style={[styles.vulnChipText, vulnerability.hasPendingVaccination && styles.vulnChipTextActive]}>
                💉 വാക്സിനേഷൻ ബാക്കി (Pending Vaccine)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.vulnChip, vulnerability.hasRespiratoryCondition && styles.vulnChipActive]}
              onPress={() => toggleVulnerability('hasRespiratoryCondition')}
            >
              <Text style={[styles.vulnChipText, vulnerability.hasRespiratoryCondition && styles.vulnChipTextActive]}>
                🫁 ശ്വാസകോശ രോഗം (Asthma/COPD)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. Physical Environmental Hazards */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>🏡 Physical Environmental Hazards</Text>
          <Text style={styles.cardSectionSubtitle}>Drinking water source, cooking fuel, and surroundings</Text>

          {/* Cooking Fuel */}
          <Text style={styles.toggleGroupLabel}>Indoor Cooking Fuel:</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, cookingFuel === 'lpg' && styles.toggleBtnActive]}
              onPress={() => setCookingFuel('lpg')}
            >
              <Text style={[styles.toggleBtnText, cookingFuel === 'lpg' && styles.toggleBtnTextActive]}>
                LPG Clean (ഗ്യാസ്)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, cookingFuel === 'biomass_chulha' && styles.toggleBtnActive]}
              onPress={() => setCookingFuel('biomass_chulha')}
            >
              <Text style={[styles.toggleBtnText, cookingFuel === 'biomass_chulha' && styles.toggleBtnTextActive]}>
                Biomass Chulha (വിറക്)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Water Source */}
          <Text style={[styles.toggleGroupLabel, { marginTop: 12 }]}>Drinking Water Safety:</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, drinkingWaterSafety === 'safe' && styles.toggleBtnActive]}
              onPress={() => setDrinkingWaterSafety('safe')}
            >
              <Text style={[styles.toggleBtnText, drinkingWaterSafety === 'safe' && styles.toggleBtnTextActive]}>
                Piped / Safe (ശുദ്ധജലം)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, drinkingWaterSafety === 'open_well_untested' && styles.toggleBtnActive]}
              onPress={() => setDrinkingWaterSafety('open_well_untested')}
            >
              <Text style={[styles.toggleBtnText, drinkingWaterSafety === 'open_well_untested' && styles.toggleBtnTextActive]}>
                Open Well Untested (തുറന്ന കിണർ)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Switches */}
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Water Stagnation Near House</Text>
              <Text style={styles.switchSubtext}>15 മീറ്ററിനുള്ളിൽ കെട്ടിക്കിടക്കുന്ന വെള്ളം (Vector breeding risk)</Text>
            </View>
            <Switch
              value={hasWaterStagnation}
              onValueChange={setHasWaterStagnation}
              trackColor={{ false: '#D1D5DB', true: '#065F46' }}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Lowland Flood Prone Zone</Text>
              <Text style={styles.switchSubtext}>വെള്ളപ്പൊക്ക സാധ്യതയുള്ള താഴ്ന്ന പ്രദേശം (Road waterlogging)</Text>
            </View>
            <Switch
              value={isFloodProne}
              onValueChange={setIsFloodProne}
              trackColor={{ false: '#D1D5DB', true: '#065F46' }}
            />
          </View>
        </View>

        {/* 4. Targeted Conversational Questions (Triggered ONLY when Environmental + Vulnerability Context Align) */}
        <View style={styles.adaptiveSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>
                🎯 Targeted Conversational Follow-Ups ({targetedQuestions.length})
              </Text>
              <Text style={styles.sectionSubtitle}>
                ചൂട്, മഴ, ശുദ്ധജലം എന്നിവ അടിസ്ഥാനമാക്കിയുള്ള വ്യക്തിഗത ചോദ്യങ്ങൾ
              </Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Dynamic Triggers</Text>
            </View>
          </View>

          {targetedQuestions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardTitle}>✓ No Acute Climate-Vulnerability Flags</Text>
              <Text style={styles.emptyCardSub}>
                Ambient conditions and household context are within safe baseline bounds. ASHA workflow is not interrupted.
              </Text>
            </View>
          ) : (
            targetedQuestions.map((q) => {
              const currentAnswer = questionAnswers[q.id];
              const showFollowUp =
                q.followUpQuestion &&
                ((q.followUpQuestion.condition === 'if_yes' && currentAnswer === 'yes') ||
                  (q.followUpQuestion.condition === 'if_no' && currentAnswer === 'no'));

              return (
                <View
                  key={q.id}
                  style={[
                    styles.questionCard,
                    q.impactsCareGap ? styles.questionCardCareGap : q.urgency === 'high' ? styles.questionCardUrgent : styles.questionCardMedium
                  ]}
                >
                  {/* Scenario Header */}
                  <View style={styles.qHeader}>
                    <View style={styles.qTitleGroup}>
                      <Text style={styles.qTriggerTitle}>{q.titleEn}</Text>
                      <Text style={styles.qTriggerTitleMl}>{q.titleMl}</Text>
                    </View>
                    <View
                      style={[
                        styles.urgencyBadge,
                        q.impactsCareGap
                          ? styles.badgeCareGap
                          : q.urgency === 'high'
                          ? styles.badgeUrgent
                          : styles.badgeMedium
                      ]}
                    >
                      <Text style={styles.urgencyBadgeText}>
                        {q.impactsCareGap ? '📌 Care Gap Priority' : q.urgency === 'high' ? '🚨 High Concern' : '⚠️ Preventive'}
                      </Text>
                    </View>
                  </View>

                  {/* Context Reason */}
                  <View style={styles.contextBadge}>
                    <Text style={styles.contextBadgeText}>Trigger: {q.contextReason}</Text>
                  </View>

                  {/* Question Text */}
                  <View style={styles.qBodyBox}>
                    <Text style={styles.qTextMl}>{q.questionMl}</Text>
                    <Text style={styles.qTextEn}>"{q.questionEn}"</Text>
                  </View>

                  {/* ASHA Interactive Answer Buttons */}
                  <View style={styles.answerRow}>
                    <Text style={styles.answerPrompt}>ASHA സ്ഥിരീകരണം:</Text>
                    <View style={styles.btnGroup}>
                      <TouchableOpacity
                        style={[
                          styles.ansBtn,
                          currentAnswer === 'yes' && styles.ansBtnYesActive
                        ]}
                        onPress={() => handleAnswer(q.id, 'yes')}
                      >
                        <Text
                          style={[
                            styles.ansBtnText,
                            currentAnswer === 'yes' && styles.ansBtnTextActive
                          ]}
                        >
                          ✓ Yes (ഉണ്ട്)
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.ansBtn,
                          currentAnswer === 'no' && styles.ansBtnNoActive
                        ]}
                        onPress={() => handleAnswer(q.id, 'no')}
                      >
                        <Text
                          style={[
                            styles.ansBtnText,
                            currentAnswer === 'no' && styles.ansBtnTextActive
                          ]}
                        >
                          ✗ No (ഇല്ല)
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Adaptive Follow-up question if answer triggers it */}
                  {showFollowUp && q.followUpQuestion && (
                    <View style={styles.followUpBox}>
                      <Text style={styles.followUpTitle}>
                        ↳ തുടർചോദ്യം (Adaptive Follow-Up):
                      </Text>
                      <Text style={styles.followUpTextMl}>{q.followUpQuestion.questionMl}</Text>
                      <Text style={styles.followUpTextEn}>"{q.followUpQuestion.questionEn}"</Text>

                      <View style={styles.answerRow}>
                        <View style={styles.btnGroup}>
                          <TouchableOpacity
                            style={[
                              styles.ansBtn,
                              followUpAnswers[q.followUpQuestion.id] === 'yes' && styles.ansBtnYesActive
                            ]}
                            onPress={() => handleFollowUpAnswer(q.followUpQuestion!.id, 'yes')}
                          >
                            <Text
                              style={[
                                styles.ansBtnText,
                                followUpAnswers[q.followUpQuestion.id] === 'yes' && styles.ansBtnTextActive
                              ]}
                            >
                              ✓ Yes
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.ansBtn,
                              followUpAnswers[q.followUpQuestion.id] === 'no' && styles.ansBtnNoActive
                            ]}
                            onPress={() => handleFollowUpAnswer(q.followUpQuestion!.id, 'no')}
                          >
                            <Text
                              style={[
                                styles.ansBtnText,
                                followUpAnswers[q.followUpQuestion.id] === 'no' && styles.ansBtnTextActive
                              ]}
                            >
                              ✗ No
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.actionBox}>
                        <Text style={styles.actionHeader}>💡 തുടർനടപടി (Action):</Text>
                        <Text style={styles.actionTextMl}>{q.followUpQuestion.actionMl}</Text>
                        <Text style={styles.actionTextEn}>{q.followUpQuestion.actionEn}</Text>
                      </View>
                    </View>
                  )}

                  {/* Primary Outcome / Action guidance when answered */}
                  {currentAnswer && !showFollowUp && (
                    <View style={styles.actionBox}>
                      <Text style={styles.actionHeader}>💡 നിർദേശിക്കേണ്ടത് (Recommended Action):</Text>
                      <Text style={styles.actionTextMl}>
                        {currentAnswer === 'yes' ? q.yesOutcomeMl : q.noOutcomeMl}
                      </Text>
                      <Text style={styles.actionTextEn}>
                        {currentAnswer === 'yes' ? q.yesOutcomeEn : q.noOutcomeEn}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* 5. Active Care Gap Integration Banner */}
        {activeCareGaps.length > 0 && (
          <View style={styles.careGapBanner}>
            <View style={styles.careGapBannerHeader}>
              <AppIcon name="alert" size={20} color="#B91C1C" />
              <Text style={styles.careGapBannerTitle}>
                Proactive Care Gap Escalations ({activeCareGaps.length})
              </Text>
            </View>
            {activeCareGaps.map((gap, idx) => (
              <View key={idx} style={styles.careGapItem}>
                <View style={styles.careGapItemTop}>
                  <Text style={styles.careGapItemType}>[{gap.gap_type.toUpperCase()}]</Text>
                  <Text style={styles.careGapItemPriority}>PRIORITY: {gap.priority.toUpperCase()}</Text>
                </View>
                <Text style={styles.careGapItemDesc}>{gap.description}</Text>
                <Text style={styles.careGapItemAction}>↳ Action: {gap.recommended_action}</Text>
                {gap.access_barrier_type && (
                  <Text style={styles.careGapItemBarrier}>
                    🚧 Barrier: {gap.access_barrier_type.replace('_', ' ')}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Save & Confirm Action */}
        <TouchableOpacity
          style={[styles.primaryButton, isSaving && { opacity: 0.7 }]}
          onPress={handleSaveAssessment}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <AppIcon name="check" size={18} color="#FFFFFF" />
          )}
          <Text style={styles.primaryButtonText}>
            {isSaving
              ? 'Saving to MongoDB...'
              : savedSuccess
              ? '✓ Assessment Saved'
              : 'Confirm & Save Climate Health Record'}
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
    fontSize: 19,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3
  },
  subtitle: {
    fontSize: 12,
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
    marginBottom: 8
  },
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827'
  },
  cardSectionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1
  },
  refreshBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#ECFDF5',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46'
  },
  locationScroll: {
    marginVertical: 8
  },
  locChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  locChipActive: {
    backgroundColor: '#065F46',
    borderColor: '#065F46'
  },
  locGpsChip: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD'
  },
  locGpsChipText: {
    color: '#1D4ED8',
    fontWeight: '700'
  },
  locChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563'
  },
  locChipTextActive: {
    color: '#FFFFFF'
  },
  detectedAreaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 10,
    borderRadius: 8,
    marginVertical: 10
  },
  detectedAreaIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center'
  },
  detectedAreaIcon: {
    fontSize: 16
  },
  detectedAreaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
    textTransform: 'uppercase',
    letterSpacing: 0.3
  },
  detectedAreaName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginTop: 1
  },
  detectedAreaCoords: {
    fontSize: 11,
    color: '#4B5563',
    marginTop: 1
  },
  sourceBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6
  },
  sourceBadgeLive: {
    backgroundColor: '#059669'
  },
  sourceBadgeSim: {
    backgroundColor: '#6B7280'
  },
  sourceBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  weatherGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4
  },
  weatherBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  weatherLabel: {
    fontSize: 11,
    color: '#6B7280'
  },
  weatherVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginTop: 2
  },
  weatherSub: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2
  },
  textRain: {
    color: '#2563EB'
  },
  textAqiGood: {
    color: '#059669'
  },
  textAqiHigh: {
    color: '#DC2626'
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10
  },
  vulnChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  vulnChipActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B'
  },
  vulnChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563'
  },
  vulnChipTextActive: {
    color: '#92400E',
    fontWeight: '700'
  },
  toggleGroupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
    marginTop: 6
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center'
  },
  toggleBtnActive: {
    backgroundColor: '#065F46',
    borderColor: '#065F46'
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563'
  },
  toggleBtnTextActive: {
    color: '#FFFFFF'
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    marginTop: 4
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
  adaptiveSection: {
    marginTop: 8,
    marginBottom: 14
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827'
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1
  },
  activeBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE'
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4338CA'
  },
  emptyCard: {
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    alignItems: 'center'
  },
  emptyCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D'
  },
  emptyCardSub: {
    fontSize: 11,
    color: '#4B5563',
    textAlign: 'center',
    marginTop: 4
  },
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12
  },
  questionCardCareGap: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFF5F5'
  },
  questionCardUrgent: {
    borderColor: '#FED7AA',
    backgroundColor: '#FFFAF0'
  },
  questionCardMedium: {
    borderColor: '#E5E7EB'
  },
  qHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6
  },
  qTitleGroup: {
    flex: 1,
    marginRight: 8
  },
  qTriggerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827'
  },
  qTriggerTitleMl: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 1
  },
  urgencyBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6
  },
  badgeCareGap: {
    backgroundColor: '#DC2626'
  },
  badgeUrgent: {
    backgroundColor: '#EA580C'
  },
  badgeMedium: {
    backgroundColor: '#D97706'
  },
  urgencyBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  contextBadge: {
    backgroundColor: '#F3F4F6',
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 8
  },
  contextBadgeText: {
    fontSize: 10,
    color: '#4B5563',
    fontWeight: '600'
  },
  qBodyBox: {
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#065F46',
    marginBottom: 10
  },
  qTextMl: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 18
  },
  qTextEn: {
    fontSize: 12,
    color: '#4B5563',
    fontStyle: 'italic',
    marginTop: 4
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 6
  },
  answerPrompt: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151'
  },
  btnGroup: {
    flexDirection: 'row',
    gap: 8
  },
  ansBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF'
  },
  ansBtnYesActive: {
    backgroundColor: '#065F46',
    borderColor: '#065F46'
  },
  ansBtnNoActive: {
    backgroundColor: '#4B5563',
    borderColor: '#4B5563'
  },
  ansBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151'
  },
  ansBtnTextActive: {
    color: '#FFFFFF'
  },
  followUpBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6
  },
  followUpTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
    marginBottom: 4
  },
  followUpTextMl: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A'
  },
  followUpTextEn: {
    fontSize: 11,
    color: '#475569',
    fontStyle: 'italic',
    marginTop: 2
  },
  actionBox: {
    backgroundColor: '#EFF6FF',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    marginTop: 8
  },
  actionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
    marginBottom: 2
  },
  actionTextMl: {
    fontSize: 11,
    color: '#1E3A8A',
    fontWeight: '600'
  },
  actionTextEn: {
    fontSize: 10,
    color: '#3B82F6',
    marginTop: 2
  },
  careGapBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14
  },
  careGapBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8
  },
  careGapBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#991B1B'
  },
  careGapItem: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 6,
    padding: 8,
    marginBottom: 6
  },
  careGapItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  careGapItemType: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626'
  },
  careGapItemPriority: {
    fontSize: 10,
    fontWeight: '800',
    color: '#991B1B',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4
  },
  careGapItemDesc: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    marginTop: 2
  },
  careGapItemAction: {
    fontSize: 11,
    color: '#4B5563',
    marginTop: 2
  },
  careGapItemBarrier: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B91C1C',
    marginTop: 2
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#065F46',
    paddingVertical: 13,
    borderRadius: 8,
    marginTop: 6
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});
