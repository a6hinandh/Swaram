import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  Platform
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
        ? `\n\nCare Gaps Updated (${activeCareGaps.length}):\n${activeCareGaps.map(g => `- ${g.description} [${g.priority.toUpperCase()}]`).join('\n')}`
        : '';

      const isMongo = res.data?.storage === 'mongodb';
      const storageInfo = isMongo
        ? 'സേവ് ചെയ്തു: MongoDB Database (Collection: environmental_assessments)'
        : `സേവ് ചെയ്തു: Local Ledger (Backend offline at ${getActiveHost()}:8000)`;

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
          <View style={styles.headerTitleRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <AppIcon name="climate" size={20} color="#047857" />
                <Text style={styles.title}>കാലാവസ്ഥാ & പരിസ്ഥിതി നിരീക്ഷണം</Text>
              </View>
              <Text style={styles.subtitle}>
                പരിസ്ഥിതി ഘടകങ്ങളും വ്യക്തിഗത ആരോഗ്യ മുൻഗണനകളും (Proactive Care-Gap Integration)
              </Text>
            </View>
            <View style={styles.nhmBadge}>
              <Text style={styles.nhmBadgeText}>Open-Meteo • Live</Text>
            </View>
          </View>
        </View>

        {/* 1. Location & Ambient Climate Context Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <AppIcon name="location" size={16} color="#047857" />
                <Text style={styles.cardSectionTitle}>വാർഡ് ലൊക്കേഷൻ & കാലാവസ്ഥ</Text>
              </View>
              <Text style={styles.cardSectionSubtitle}>
                {selectedLocation.district} • {weather.isLiveFetched ? 'തത്സമയം (Live Open-Meteo)' : 'ഓഫ്‌ലൈൻ (Local Cached)'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={handleRefresh}
              disabled={isLoadingWeather}
              activeOpacity={0.7}
            >
              {isLoadingWeather ? (
                <ActivityIndicator size="small" color="#065F46" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <AppIcon name="refresh" size={12} color="#065F46" />
                  <Text style={styles.refreshBtnText}>പുതുക്കുക</Text>
                </View>
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
              activeOpacity={0.7}
            >
              <AppIcon
                name="satellite"
                size={13}
                color={selectedLocation.id === 'gps_device' ? '#FFFFFF' : '#1D4ED8'}
              />
              <Text
                style={[
                  styles.locChipText,
                  styles.locGpsChipText,
                  selectedLocation.id === 'gps_device' && styles.locChipTextActive
                ]}
              >
                തത്സമയ ലൊക്കേഷൻ (Live GPS)
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
                activeOpacity={0.7}
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
              <AppIcon
                name={selectedLocation.id === 'gps_device' ? 'satellite' : 'location'}
                size={18}
                color="#047857"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detectedAreaLabel}>
                {selectedLocation.id === 'gps_device' ? 'തത്സമയ ലൊക്കേഷൻ (Live GPS)' : 'തിരഞ്ഞെടുത്ത വാർഡ്'}:
              </Text>
              <Text style={styles.detectedAreaName}>
                {weather.locationName || selectedLocation.name}
              </Text>
              <Text style={styles.detectedAreaCoords}>
                GPS: {weather.latitude.toFixed(4)}°N, {weather.longitude.toFixed(4)}°E • {weather.fetchedAt}
              </Text>
            </View>
            <View style={[styles.sourceBadge, weather.isLiveFetched ? styles.sourceBadgeLive : styles.sourceBadgeSim]}>
              <Text style={styles.sourceBadgeText}>{weather.isLiveFetched ? 'LIVE' : 'CACHED'}</Text>
            </View>
          </View>

          {/* Ambient Context Grid */}
          <View style={styles.weatherGrid}>
            <View style={styles.weatherBox}>
              <View style={styles.weatherBoxHeader}>
                <AppIcon name="thermometer" size={15} color="#D97706" />
                <Text style={styles.weatherLabel}>താപനില (Temp)</Text>
              </View>
              <Text style={styles.weatherVal}>{weather.temperatureCelsius}°C</Text>
              <Text style={styles.weatherSub}>ചൂട്: {envContext.heatRisk.toUpperCase()}</Text>
            </View>

            <View style={styles.weatherBox}>
              <View style={styles.weatherBoxHeader}>
                <AppIcon name="cloud-rain" size={15} color="#2563EB" />
                <Text style={styles.weatherLabel}>മഴ (Rain)</Text>
              </View>
              <Text style={[styles.weatherVal, envContext.heavyRain ? styles.textRain : null]}>
                {weather.precipitationMm} mm
              </Text>
              <Text style={styles.weatherSub}>{envContext.heavyRain ? 'ശക്തമായ മഴ' : 'സാധാരണ നില'}</Text>
            </View>

            <View style={styles.weatherBox}>
              <View style={styles.weatherBoxHeader}>
                <AppIcon name="droplet" size={15} color="#0284C7" />
                <Text style={styles.weatherLabel}>ഈർപ്പം (Humidity)</Text>
              </View>
              <Text style={styles.weatherVal}>{weather.humidityPercent}%</Text>
              <Text style={styles.weatherSub}>{weather.humidityPercent >= 80 ? 'ഈർപ്പം കൂടുതൽ' : 'സാധാരണ നില'}</Text>
            </View>

            <View style={styles.weatherBox}>
              <View style={styles.weatherBoxHeader}>
                <AppIcon name="wind" size={15} color={weather.aqiUs > 100 ? '#DC2626' : '#059669'} />
                <Text style={styles.weatherLabel}>വായു ഗുണനിലവാരം</Text>
              </View>
              <Text style={[styles.weatherVal, weather.aqiUs > 100 ? styles.textAqiHigh : styles.textAqiGood]}>
                {weather.aqiUs}
              </Text>
              <Text style={styles.weatherSub}>{weather.aqiCategory.replace('_', ' ')}</Text>
            </View>
          </View>
        </View>

        {/* 2. Household Vulnerability & Care Gap Context */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <AppIcon name="home" size={16} color="#1E40AF" />
            <Text style={styles.cardSectionTitle}>കുടുംബത്തിലെ മുൻഗണനാ വിഭാഗങ്ങൾ</Text>
          </View>
          <Text style={styles.cardSectionSubtitle}>
            ആശാ കെയർ രജിസ്റ്ററുമായി ബന്ധിപ്പിച്ച പ്രത്യേക ശ്രദ്ധ ആവശ്യമുള്ള വിഭാഗങ്ങൾ:
          </Text>

          <View style={styles.chipGrid}>
            <TouchableOpacity
              style={[styles.vulnChip, vulnerability.hasPregnantMember && styles.vulnChipActive]}
              onPress={() => toggleVulnerability('hasPregnantMember')}
              activeOpacity={0.7}
            >
              <AppIcon
                name="pregnant"
                size={15}
                color={vulnerability.hasPregnantMember ? '#047857' : '#475569'}
              />
              <Text style={[styles.vulnChipText, vulnerability.hasPregnantMember && styles.vulnChipTextActive]}>
                ഗർഭിണി (Pregnant)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.vulnChip, vulnerability.hasPendingANC && styles.vulnChipActive]}
              onPress={() => toggleVulnerability('hasPendingANC')}
              activeOpacity={0.7}
            >
              <AppIcon
                name="calendar"
                size={15}
                color={vulnerability.hasPendingANC ? '#047857' : '#475569'}
              />
              <Text style={[styles.vulnChipText, vulnerability.hasPendingANC && styles.vulnChipTextActive]}>
                ബാക്കിയുള്ള ANC (Pending ANC)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.vulnChip, vulnerability.hasChild && styles.vulnChipActive]}
              onPress={() => toggleVulnerability('hasChild')}
              activeOpacity={0.7}
            >
              <AppIcon
                name="baby"
                size={15}
                color={vulnerability.hasChild ? '#047857' : '#475569'}
              />
              <Text style={[styles.vulnChipText, vulnerability.hasChild && styles.vulnChipTextActive]}>
                കുട്ടികൾ (Child &lt; 5)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.vulnChip, vulnerability.hasElderly && styles.vulnChipActive]}
              onPress={() => toggleVulnerability('hasElderly')}
              activeOpacity={0.7}
            >
              <AppIcon
                name="elderly"
                size={15}
                color={vulnerability.hasElderly ? '#047857' : '#475569'}
              />
              <Text style={[styles.vulnChipText, vulnerability.hasElderly && styles.vulnChipTextActive]}>
                മുതിർന്നവർ (Elderly &gt; 65)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.vulnChip, vulnerability.hasChronicIllness && styles.vulnChipActive]}
              onPress={() => toggleVulnerability('hasChronicIllness')}
              activeOpacity={0.7}
            >
              <AppIcon
                name="heart"
                size={15}
                color={vulnerability.hasChronicIllness ? '#047857' : '#475569'}
              />
              <Text style={[styles.vulnChipText, vulnerability.hasChronicIllness && styles.vulnChipTextActive]}>
                തുടർചികിത്സ / മരുന്ന് (Chronic Care)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.vulnChip, vulnerability.hasPendingVaccination && styles.vulnChipActive]}
              onPress={() => toggleVulnerability('hasPendingVaccination')}
              activeOpacity={0.7}
            >
              <AppIcon
                name="syringe"
                size={15}
                color={vulnerability.hasPendingVaccination ? '#047857' : '#475569'}
              />
              <Text style={[styles.vulnChipText, vulnerability.hasPendingVaccination && styles.vulnChipTextActive]}>
                വാക്സിനേഷൻ ബാക്കി (Pending Vaccine)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.vulnChip, vulnerability.hasRespiratoryCondition && styles.vulnChipActive]}
              onPress={() => toggleVulnerability('hasRespiratoryCondition')}
              activeOpacity={0.7}
            >
              <AppIcon
                name="wind"
                size={15}
                color={vulnerability.hasRespiratoryCondition ? '#047857' : '#475569'}
              />
              <Text style={[styles.vulnChipText, vulnerability.hasRespiratoryCondition && styles.vulnChipTextActive]}>
                ശ്വാസകോശ രോഗം (Asthma/COPD)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. Physical Environmental Hazards */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <AppIcon name="shield" size={16} color="#047857" />
            <Text style={styles.cardSectionTitle}>ഭൗതിക പരിസ്ഥിതി അപായ ഘടകങ്ങൾ</Text>
          </View>
          <Text style={styles.cardSectionSubtitle}>കുടിവെള്ള ഉറവിടം, പാചക ഇന്ധനം, പരിസര ശുചിത്വം</Text>

          {/* Cooking Fuel */}
          <Text style={styles.toggleGroupLabel}>അടുക്കള ഇന്ധനം (Indoor Cooking Fuel):</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, cookingFuel === 'lpg' && styles.toggleBtnActive]}
              onPress={() => setCookingFuel('lpg')}
              activeOpacity={0.7}
            >
              <AppIcon
                name="zap"
                size={14}
                color={cookingFuel === 'lpg' ? '#FFFFFF' : '#047857'}
              />
              <Text style={[styles.toggleBtnText, cookingFuel === 'lpg' && styles.toggleBtnTextActive]}>
                LPG Clean (ഗ്യാസ്)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, cookingFuel === 'biomass_chulha' && styles.toggleBtnActive]}
              onPress={() => setCookingFuel('biomass_chulha')}
              activeOpacity={0.7}
            >
              <AppIcon
                name="flame"
                size={14}
                color={cookingFuel === 'biomass_chulha' ? '#FFFFFF' : '#D97706'}
              />
              <Text style={[styles.toggleBtnText, cookingFuel === 'biomass_chulha' && styles.toggleBtnTextActive]}>
                Biomass Chulha (വിറക്)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Water Source */}
          <Text style={[styles.toggleGroupLabel, { marginTop: 12 }]}>കുടിവെള്ള സുരക്ഷ (Drinking Water Safety):</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, drinkingWaterSafety === 'safe' && styles.toggleBtnActive]}
              onPress={() => setDrinkingWaterSafety('safe')}
              activeOpacity={0.7}
            >
              <AppIcon
                name="droplet"
                size={14}
                color={drinkingWaterSafety === 'safe' ? '#FFFFFF' : '#0284C7'}
              />
              <Text style={[styles.toggleBtnText, drinkingWaterSafety === 'safe' && styles.toggleBtnTextActive]}>
                Piped / Safe (ശുദ്ധജലം)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, drinkingWaterSafety === 'open_well_untested' && styles.toggleBtnActive]}
              onPress={() => setDrinkingWaterSafety('open_well_untested')}
              activeOpacity={0.7}
            >
              <AppIcon
                name="alert"
                size={14}
                color={drinkingWaterSafety === 'open_well_untested' ? '#FFFFFF' : '#D97706'}
              />
              <Text style={[styles.toggleBtnText, drinkingWaterSafety === 'open_well_untested' && styles.toggleBtnTextActive]}>
                Open Well Untested (തുറന്ന കിണർ)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Switches */}
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>വീടിന് സമീപം വെള്ളക്കെട്ട് (Water Stagnation)</Text>
              <Text style={styles.switchSubtext}>15 മീറ്ററിനുള്ളിൽ കെട്ടിക്കിടക്കുന്ന വെള്ളം (കൊതുക് പെരുകൽ സാധ്യത)</Text>
            </View>
            <Switch
              value={hasWaterStagnation}
              onValueChange={setHasWaterStagnation}
              trackColor={{ false: '#D1D5DB', true: '#047857' }}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>വെള്ളപ്പൊക്ക സാധ്യതയുള്ള താഴ്ന്ന പ്രദേശം (Flood Prone)</Text>
              <Text style={styles.switchSubtext}>മഴക്കാലത്ത് വെള്ളം കയറാൻ സാധ്യതയുള്ള മേഖല</Text>
            </View>
            <Switch
              value={isFloodProne}
              onValueChange={setIsFloodProne}
              trackColor={{ false: '#D1D5DB', true: '#047857' }}
            />
          </View>
        </View>

        {/* 4. Targeted Conversational Questions */}
        <View style={styles.adaptiveSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <AppIcon name="target" size={18} color="#047857" />
                <Text style={styles.sectionTitle}>
                  വ്യക്തിഗത ഫോളോ-അപ്പ് ചോദ്യങ്ങൾ ({targetedQuestions.length})
                </Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                ചൂട്, മഴ, കുടിവെള്ളം എന്നിവ അടിസ്ഥാനമാക്കിയുള്ള ലക്ഷ്യബോധമുള്ള ചോദ്യങ്ങൾ
              </Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Dynamic Triggers</Text>
            </View>
          </View>

          {targetedQuestions.length === 0 ? (
            <View style={styles.emptyCard}>
              <AppIcon name="check" size={20} color="#047857" />
              <Text style={styles.emptyCardTitle}>പ്രത്യേക കാലാവസ്ഥാ അപായ ഘടകങ്ങൾ ഇല്ല</Text>
              <Text style={styles.emptyCardSub}>
                പരിസ്ഥിതി ഘടകങ്ങളും കുടുംബ സാഹചര്യങ്ങളും സുരക്ഷിത പരിധിയിലാണ്.
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
                      <AppIcon
                        name={q.impactsCareGap ? 'target' : q.urgency === 'high' ? 'alert' : 'shield'}
                        size={11}
                        color="#FFFFFF"
                      />
                      <Text style={styles.urgencyBadgeText}>
                        {q.impactsCareGap ? 'Care Gap Priority' : q.urgency === 'high' ? 'High Concern' : 'Preventive'}
                      </Text>
                    </View>
                  </View>

                  {/* Context Reason */}
                  <View style={styles.contextBadge}>
                    <Text style={styles.contextBadgeText}>ട്രിഗ്ഗർ: {q.contextReason}</Text>
                  </View>

                  {/* Question Text */}
                  <View style={styles.qBodyBox}>
                    <Text style={styles.qTextMl}>{q.questionMl}</Text>
                    <Text style={styles.qTextEn}>"{q.questionEn}"</Text>
                  </View>

                  {/* ASHA Interactive Answer Buttons */}
                  <View style={styles.answerRow}>
                    <Text style={styles.answerPrompt}>ആശാ സ്ഥിരീകരണം:</Text>
                    <View style={styles.btnGroup}>
                      <TouchableOpacity
                        style={[
                          styles.ansBtn,
                          currentAnswer === 'yes' && styles.ansBtnYesActive
                        ]}
                        onPress={() => handleAnswer(q.id, 'yes')}
                        activeOpacity={0.7}
                      >
                        <AppIcon
                          name="check"
                          size={14}
                          color={currentAnswer === 'yes' ? '#FFFFFF' : '#047857'}
                        />
                        <Text
                          style={[
                            styles.ansBtnText,
                            currentAnswer === 'yes' && styles.ansBtnTextActive
                          ]}
                        >
                          ഉണ്ട് (Yes)
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.ansBtn,
                          currentAnswer === 'no' && styles.ansBtnNoActive
                        ]}
                        onPress={() => handleAnswer(q.id, 'no')}
                        activeOpacity={0.7}
                      >
                        <AppIcon
                          name="close"
                          size={14}
                          color={currentAnswer === 'no' ? '#FFFFFF' : '#DC2626'}
                        />
                        <Text
                          style={[
                            styles.ansBtnText,
                            currentAnswer === 'no' && styles.ansBtnTextActive
                          ]}
                        >
                          ഇല്ല (No)
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Adaptive Follow-up question if answer triggers it */}
                  {showFollowUp && q.followUpQuestion && (
                    <View style={styles.followUpBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                        <AppIcon name="chevron-right" size={13} color="#0284C7" />
                        <Text style={styles.followUpTitle}>
                          തുടർചോദ്യം (Adaptive Follow-Up):
                        </Text>
                      </View>
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
                            activeOpacity={0.7}
                          >
                            <AppIcon
                              name="check"
                              size={14}
                              color={followUpAnswers[q.followUpQuestion.id] === 'yes' ? '#FFFFFF' : '#047857'}
                            />
                            <Text
                              style={[
                                styles.ansBtnText,
                                followUpAnswers[q.followUpQuestion.id] === 'yes' && styles.ansBtnTextActive
                              ]}
                            >
                              ഉണ്ട് (Yes)
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.ansBtn,
                              followUpAnswers[q.followUpQuestion.id] === 'no' && styles.ansBtnNoActive
                            ]}
                            onPress={() => handleFollowUpAnswer(q.followUpQuestion!.id, 'no')}
                            activeOpacity={0.7}
                          >
                            <AppIcon
                              name="close"
                              size={14}
                              color={followUpAnswers[q.followUpQuestion.id] === 'no' ? '#FFFFFF' : '#DC2626'}
                            />
                            <Text
                              style={[
                                styles.ansBtnText,
                                followUpAnswers[q.followUpQuestion.id] === 'no' && styles.ansBtnTextActive
                              ]}
                            >
                              ഇല്ല (No)
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.actionBox}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                          <AppIcon name="lightbulb" size={14} color="#1E40AF" />
                          <Text style={styles.actionHeader}>തുടർനടപടി (Action):</Text>
                        </View>
                        <Text style={styles.actionTextMl}>{q.followUpQuestion.actionMl}</Text>
                        <Text style={styles.actionTextEn}>{q.followUpQuestion.actionEn}</Text>
                      </View>
                    </View>
                  )}

                  {/* Primary Outcome / Action guidance when answered */}
                  {currentAnswer && !showFollowUp && (
                    <View style={styles.actionBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                        <AppIcon name="lightbulb" size={14} color="#1E40AF" />
                        <Text style={styles.actionHeader}>നിർദേശിക്കേണ്ട നടപടി (Recommended Action):</Text>
                      </View>
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
              <AppIcon name="alert" size={18} color="#B91C1C" />
              <Text style={styles.careGapBannerTitle}>
                സജീവ പരിചരണ വിടവുകൾ (Active Care Gaps: {activeCareGaps.length})
              </Text>
            </View>
            {activeCareGaps.map((gap, idx) => (
              <View key={idx} style={styles.careGapItem}>
                <View style={styles.careGapItemTop}>
                  <Text style={styles.careGapItemType}>[{gap.gap_type.toUpperCase()}]</Text>
                  <Text style={styles.careGapItemPriority}>PRIORITY: {gap.priority.toUpperCase()}</Text>
                </View>
                <Text style={styles.careGapItemDesc}>{gap.description}</Text>
                <Text style={styles.careGapItemAction}>നടപടി (Action): {gap.recommended_action}</Text>
                {gap.access_barrier_type && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <AppIcon name="alert" size={12} color="#B91C1C" />
                    <Text style={styles.careGapItemBarrier}>
                      തടസ്സം: {gap.access_barrier_type.replace('_', ' ')}
                    </Text>
                  </View>
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
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <AppIcon name="save" size={18} color="#FFFFFF" />
          )}
          <Text style={styles.primaryButtonText}>
            {isSaving
              ? 'ഡാറ്റാബേസിലേക്ക് സൂക്ഷിക്കുന്നു...'
              : savedSuccess
              ? 'പരിസ്ഥിതി രേഖ സേവ് ചെയ്തു'
              : 'പരിസ്ഥിതി രേഖ സേവ് ചെയ്യുക (Save Record)'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  container: {
    padding: 16,
    paddingBottom: 40
  },
  headerBlock: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    elevation: 2,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }
    })
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 17
  },
  nhmBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  nhmBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857'
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    elevation: 2,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }
    })
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A'
  },
  cardSectionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  refreshBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  refreshBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46'
  },
  locationScroll: {
    marginVertical: 8
  },
  locChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  locChipActive: {
    backgroundColor: '#047857',
    borderColor: '#047857'
  },
  locGpsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE'
  },
  locGpsChipText: {
    color: '#1D4ED8',
    fontWeight: '700'
  },
  locChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569'
  },
  locChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  detectedAreaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 10,
    borderRadius: 10,
    marginVertical: 10
  },
  detectedAreaIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#86EFAC'
  },
  detectedAreaLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
    textTransform: 'uppercase',
    letterSpacing: 0.4
  },
  detectedAreaName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1
  },
  detectedAreaCoords: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  sourceBadgeLive: {
    backgroundColor: '#059669'
  },
  sourceBadgeSim: {
    backgroundColor: '#64748B'
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
    minWidth: '46%',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  weatherBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  weatherLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600'
  },
  weatherVal: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4
  },
  weatherSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600'
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  vulnChipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
    borderWidth: 1.5
  },
  vulnChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569'
  },
  vulnChipTextActive: {
    color: '#065F46',
    fontWeight: '700'
  },
  toggleGroupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginTop: 8
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  toggleBtnActive: {
    backgroundColor: '#047857',
    borderColor: '#047857'
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569'
  },
  toggleBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  switchLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B'
  },
  switchSubtext: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2
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
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A'
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  activeBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE'
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1D4ED8'
  },
  emptyCard: {
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    alignItems: 'center',
    gap: 4
  },
  emptyCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D'
  },
  emptyCardSub: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
    marginTop: 2
  },
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    elevation: 2,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }
    })
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
    borderColor: '#E2E8F0'
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
    color: '#0F172A'
  },
  qTriggerTitleMl: {
    fontSize: 11,
    color: '#475569',
    marginTop: 1
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
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
    backgroundColor: '#F1F5F9',
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  contextBadgeText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '600'
  },
  qBodyBox: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#047857',
    marginBottom: 10
  },
  qTextMl: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 18
  },
  qTextEn: {
    fontSize: 11,
    color: '#64748B',
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
    color: '#334155'
  },
  btnGroup: {
    flexDirection: 'row',
    gap: 8
  },
  ansBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF'
  },
  ansBtnYesActive: {
    backgroundColor: '#047857',
    borderColor: '#047857'
  },
  ansBtnNoActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626'
  },
  ansBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155'
  },
  ansBtnTextActive: {
    color: '#FFFFFF'
  },
  followUpBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8
  },
  followUpTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7'
  },
  followUpTextMl: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
    lineHeight: 16
  },
  followUpTextEn: {
    fontSize: 10,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 2
  },
  actionBox: {
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: 8
  },
  actionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF'
  },
  actionTextMl: {
    fontSize: 11,
    color: '#1E3A8A',
    fontWeight: '600',
    lineHeight: 15
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
    borderRadius: 10,
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
    borderRadius: 8,
    padding: 10,
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
    fontSize: 9,
    fontWeight: '800',
    color: '#991B1B',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  careGapItemDesc: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 3
  },
  careGapItemAction: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2
  },
  careGapItemBarrier: {
    fontSize: 10,
    fontWeight: '600',
    color: '#B91C1C'
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#047857',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 20,
    elevation: 3,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(4, 120, 87, 0.2)'
      }
    })
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF'
  }
});
