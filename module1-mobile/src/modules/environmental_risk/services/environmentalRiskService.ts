import {
  EnvironmentalContext,
  HouseholdVulnerability,
  TargetedQuestion,
  EnvironmentalRiskResult,
  HeatRiskTier,
  WeatherData
} from '../types';

/**
 * IMD & Indian Meteorological Department / Kerala Health Climate Calibration:
 * In tropical humid climates (65-95% humidity), heat stress occurs at lower dry-bulb temperatures.
 */
export const calculateHeatRisk = (tempC: number, humidityPercent: number): HeatRiskTier => {
  const heatIndex = tempC + ((humidityPercent - 50) * 0.15) + (tempC > 34 ? (tempC - 34) * 0.8 : 0);
  if (heatIndex >= 42 || tempC >= 38) return 'danger';
  if (heatIndex >= 36 || tempC >= 34) return 'extreme_caution';
  if (heatIndex >= 31 || tempC >= 31) return 'caution';
  return 'normal';
};

/**
 * Maps live WeatherData + physical hazard toggles into EnvironmentalContext
 */
export const buildEnvironmentalContext = (
  weather: WeatherData,
  waterStagnation: boolean,
  drinkingWaterSafety: 'safe' | 'open_well_untested' | 'stagnant_near_home' | 'unknown',
  cookingFuel: 'lpg' | 'electric' | 'biomass_chulha' | 'other' | 'unknown',
  floodProne: boolean
): EnvironmentalContext => {
  const heatRisk = calculateHeatRisk(weather.temperatureCelsius, weather.humidityPercent);
  const heavyRain = weather.precipitationMm >= 10 || weather.weatherCode >= 80;

  return {
    temperatureCelsius: weather.temperatureCelsius,
    humidityPercent: weather.humidityPercent,
    heatRisk,
    precipitationMm: weather.precipitationMm,
    heavyRain,
    floodProne,
    aqi: weather.aqiUs,
    waterStagnation,
    drinkingWaterSafety,
    cookingFuel
  };
};

/**
 * Identifies targeted, person/household-specific conversational questions.
 * Rule: Never create questions just because weather is abnormal.
 * Trigger = Environmental Trigger + Relevant Household Vulnerability / Care Context.
 */
export const identifyTargetedQuestions = (
  env: EnvironmentalContext,
  vuln: HouseholdVulnerability,
  pendingCareItemName?: string
): TargetedQuestion[] => {
  const questions: TargetedQuestion[] = [];

  // =========================================================================
  // SCENARIO B (HIGHEST PRIORITY): Heavy Rain / Flooding + Healthcare Access
  // =========================================================================
  const isRainAccessTriggered =
    (env.heavyRain || env.precipitationMm >= 10 || env.floodProne) &&
    (vuln.hasPendingCare ||
      vuln.hasPendingANC ||
      vuln.hasPendingVaccination ||
      vuln.hasPendingReferral ||
      vuln.hasMedicationDependency ||
      vuln.hasPregnantMember ||
      vuln.hasElderly ||
      vuln.hasChronicIllness);

  if (isRainAccessTriggered) {
    const activityName =
      pendingCareItemName ||
      (vuln.hasPendingANC
        ? 'ANC checkup'
        : vuln.hasPendingVaccination
        ? 'scheduled child vaccination'
        : vuln.hasChronicIllness || vuln.hasMedicationDependency
        ? 'hospital follow-up / regular clinic visit'
        : 'scheduled health centre visit');

    const activityNameMl =
      vuln.hasPendingANC
        ? 'ഗർഭകാല പരിശോധന (ANC)'
        : vuln.hasPendingVaccination
        ? 'കുട്ടികളുടെ പ്രതിരോധ കുത്തിവെയ്പ്പ്'
        : vuln.hasChronicIllness || vuln.hasMedicationDependency
        ? 'തുടർചികിത്സ / ക്ലിനിക്ക്'
        : 'ആരോഗ്യകേന്ദ്രം / ആശുപത്രി';

    questions.push({
      id: 'q-scenario-b-access',
      scenario: 'heavy_rain_care_access',
      titleEn: 'Heavy Rain • Healthcare Access Barrier',
      titleMl: 'കനത്ത മഴ • ആരോഗ്യകേന്ദ്ര സന്ദർശനം',
      contextReason: `Pending ${activityName} during heavy rainfall (${env.precipitationMm}mm) / flood risk`,
      questionEn: `You mentioned that ${activityName} is still pending. Has the rain or flooding made it difficult for the family to reach the health centre?`,
      questionMl: `നേരത്തെ പറഞ്ഞ ${activityNameMl} സന്ദർശനം ഇപ്പോഴും ബാക്കിയാണല്ലോ. ഈ മഴയോ വെള്ളക്കെട്ടോ കാരണം അവിടെ എത്താൻ ബുദ്ധിമുട്ടുണ്ടോ?`,
      yesOutcomeEn: 'Flag active environmental access barrier, escalate care gap priority to High, and arrange transport or reschedule.',
      yesOutcomeMl: 'യാത്രാ തടസ്സം രേഖപ്പെടുത്തി കെയർ ഗ്യാപ്പ് മുൻഗണന ഉയർത്തുക; യാത്രാ സഹായമോ പുനഃക്രമീകരണമോ ചെയ്യുക.',
      noOutcomeEn: 'Patient confirms healthcare access is manageable despite weather. Care gap remains on regular schedule.',
      noOutcomeMl: 'യാത്രാ തടസ്സമില്ലെന്ന് സ്ഥിരീകരിച്ചു. സാധാരണ ഷെഡ്യൂളിൽ തുടരുക.',
      urgency: 'high',
      impactsCareGap: true,
      careGapType: vuln.hasPendingANC
        ? 'maternal'
        : vuln.hasPendingVaccination
        ? 'immunization'
        : vuln.hasChronicIllness
        ? 'chronic_disease'
        : 'general'
    });
  }

  // =========================================================================
  // SCENARIO A: Extreme Heat & Vulnerability
  // =========================================================================
  const isHeatVulnerable = vuln.hasChild || vuln.hasInfant || vuln.hasElderly || vuln.hasPregnantMember;
  const isHeatTriggered = env.heatRisk === 'caution' || env.heatRisk === 'extreme_caution' || env.heatRisk === 'danger';

  if (isHeatTriggered && isHeatVulnerable) {
    questions.push({
      id: 'q-scenario-a-heat',
      scenario: 'extreme_heat',
      titleEn: 'Extreme Heat • Vulnerable Member Health Check',
      titleMl: 'കടുത്ത ചൂട് • ശാരീരിക അസ്വസ്ഥതകൾ',
      contextReason: `Heat risk level: ${env.heatRisk.toUpperCase()} with vulnerable family members present`,
      questionEn: 'Has anyone in the household experienced unusual weakness, dizziness, fainting, or excessive discomfort because of the heat?',
      questionMl: 'ഈ കടുത്ത ചൂടിൽ വീട്ടിൽ ആർക്കെങ്കിലും അസാധാരണമായ തളർച്ച, തലകറക്കം, ബോധക്ഷയം, അല്ലെങ്കിൽ വലിയ അസ്വസ്ഥത അനുഭവപ്പെട്ടിട്ടുണ്ടോ?',
      yesOutcomeEn: 'Record reported heat distress symptoms, create an environmental health concern, and recommend clinical assessment if severe.',
      yesOutcomeMl: 'ചൂട് മൂലമുള്ള അസ്വസ്ഥതകൾ രേഖപ്പെടുത്തുക; തണലിലേക്ക് മാറ്റുക, ആവശ്യമെങ്കിൽ ക്ലിനിക്കൽ പരിശോധന നിർദേശിക്കുക.',
      noOutcomeEn: 'No acute distress reported. Check fluid and hydration intake.',
      noOutcomeMl: 'അടിയന്തര അസ്വസ്ഥതകളില്ല. പതിവായി ദ്രാവകങ്ങൾ കുടിക്കുന്നുണ്ടെന്ന് ഉറപ്പാക്കുക.',
      followUpQuestion: {
        id: 'q-scenario-a-hydration',
        condition: 'if_no',
        questionEn: 'Are the children, elderly members, or other vulnerable people drinking fluids regularly?',
        questionMl: 'കുട്ടികളും പ്രായമായവരും ഇടയ്ക്കിടെ ആവശ്യത്തിന് വെള്ളമോ ദ്രാവകങ്ങളോ കുടിക്കുന്നുണ്ടോ?',
        actionEn: 'Advise general preventive fluid intake (boiled water, buttermilk, rice water, ORS) according to age and comfort.',
        actionMl: 'പ്രായത്തിനനുസരിച്ച് തിളപ്പിച്ചാറിയ വെള്ളം, സംഭാരം, കഞ്ഞിവെള്ളം, ORS എന്നിവ ആവശ്യത്തിന് കുടിക്കാൻ നിർദേശിക്കുക.'
      },
      urgency: env.heatRisk === 'danger' ? 'high' : 'medium',
      impactsCareGap: false
    });
  }

  // =========================================================================
  // SCENARIO C: Standing Water & Vector Risk
  // =========================================================================
  const isVectorTriggered = env.waterStagnation || (env.heavyRain && env.precipitationMm >= 15);

  if (isVectorTriggered) {
    questions.push({
      id: 'q-scenario-c-vector',
      scenario: 'standing_water_vector',
      titleEn: 'Stagnant Water • Mosquito Vector Risk Prevention',
      titleMl: 'കെട്ടിക്കിടക്കുന്ന വെള്ളം • കൊതുക് നിയന്ത്രണം',
      contextReason: 'Standing water reported or heavy rainfall creating potential mosquito breeding sites',
      questionEn: 'Is there stagnant water around the house where mosquitoes could breed?',
      questionMl: 'വീട്ടുപരിസരത്ത് കൊതുകുകൾ പെരുകാൻ സാധ്യതയുള്ള രീതിയിൽ വെള്ളം കെട്ടിക്കിടക്കുന്നുണ്ടോ?',
      yesOutcomeEn: 'Recommend vector-risk preventive actions: empty containers/shells, clear blocked drainage, use mosquito nets.',
      yesOutcomeMl: 'ചിരട്ടകളും പാത്രങ്ങളും കമഴ്ത്തി വെക്കുക, കെട്ടിക്കിടക്കുന്ന വെള്ളം ഒഴുക്കിക്കളയുക, കൊതുകുവല ഉപയോഗിക്കുക.',
      noOutcomeEn: 'No standing water receptacles noted near premises.',
      noOutcomeMl: 'വീട്ടുപരിസരത്ത് വെള്ളക്കെട്ടുകളില്ല.',
      followUpQuestion: {
        id: 'q-scenario-c-cleared',
        condition: 'if_yes',
        questionEn: 'Has the stagnant water or container been cleared or drained?',
        questionMl: 'കെട്ടിക്കിടക്കുന്ന വെള്ളമോ പാത്രങ്ങളോ ഒഴുക്കിക്കളയാൻ സാധിച്ചോ?',
        actionEn: 'Encourage weekly Dry Day source reduction and inspect roof gutters.',
        actionMl: 'ആഴ്ചയിലൊരിക്കൽ ഡ്രൈ ഡേ ആചരിക്കാനും പാത്രങ്ങൾ പരിശോധിക്കാനും ഓർമ്മിപ്പിക്കുക.'
      },
      urgency: 'medium',
      impactsCareGap: false
    });
  }

  // =========================================================================
  // SCENARIO D: Potentially Unsafe Drinking Water
  // =========================================================================
  if (env.drinkingWaterSafety === 'open_well_untested' || env.drinkingWaterSafety === 'stagnant_near_home') {
    questions.push({
      id: 'q-scenario-d-water',
      scenario: 'unsafe_drinking_water',
      titleEn: 'Drinking Water • Water Safety & Treatment',
      titleMl: 'കുടിവെള്ളം • ശുദ്ധീകരണം',
      contextReason: 'Household uses an untested open well or source near standing water',
      questionEn: 'Is the drinking water treated appropriately before the family drinks it?',
      questionMl: 'കുടിവെള്ളം ഉപയോഗിക്കുന്നതിന് മുമ്പ് ശരിയായ രീതിയിൽ ശുദ്ധീകരിക്കുന്നുണ്ടോ?',
      yesOutcomeEn: 'Safe water treatment confirmed. Reiterate continued rolling-boiling habit.',
      yesOutcomeMl: 'വെള്ളം ശുദ്ധീകരിക്കുന്നുണ്ടെന്ന് സ്ഥിരീകരിച്ചു. തിളപ്പിച്ചാറ്റിയ വെള്ളം തന്നെ തുടരാൻ നിർദേശിക്കുക.',
      noOutcomeEn: 'Create preventive water-safety action: advise rolling-boiling drinking water and guide well chlorination.',
      noOutcomeMl: 'കുടിവെള്ളം നന്നായി തിളപ്പിച്ച് ആറിയ ശേഷം മാത്രം കുടിക്കാൻ കർശനമായി നിർദേശിക്കുക; കിണറ്റിൽ മരുന്നിടാൻ സഹായിക്കുക.',
      urgency: 'medium',
      impactsCareGap: false
    });
  }

  // =========================================================================
  // SCENARIO E: Floodwater / Mud Exposure (ONLY if actual rain/flood is present)
  // =========================================================================
  const hasActiveFloodMud =
    (env.precipitationMm >= 10 || env.heavyRain || env.floodProne) &&
    (env.waterStagnation || env.drinkingWaterSafety === 'open_well_untested' || env.floodProne);

  if (hasActiveFloodMud) {
    questions.push({
      id: 'q-scenario-e-mud',
      scenario: 'floodwater_mud_exposure',
      titleEn: 'Floodwater / Mud • Exposure & Symptom Check',
      titleMl: 'മഴവെള്ള / ചെളി സമ്പർക്കം • ലക്ഷണങ്ങൾ',
      contextReason: 'Active flooding / significant rainfall with potential mud/dirty water contact',
      questionEn: 'Has anyone in the household recently had significant contact with floodwater or muddy water?',
      questionMl: 'അടുത്തിടെ വീട്ടിലുള്ള ആർക്കെങ്കിലും മഴവെള്ളക്കെട്ടുമായോ ചെളിയുമായോ കാര്യമായ സമ്പർക്കം ഉണ്ടായിട്ടുണ്ടോ?',
      yesOutcomeEn: 'Record mud/water exposure. Ask regarding fever, severe calf pain, red eyes, or extreme weakness.',
      yesOutcomeMl: 'മലിനജല സമ്പർക്കം രേഖപ്പെടുത്തുക; പനി, കണ്ണ് ചുവക്കൽ, കാൽവണ്ണ വേദന എന്നിവ ഉണ്ടോ എന്ന് പരിശോധിക്കുക.',
      noOutcomeEn: 'No significant floodwater exposure reported.',
      noOutcomeMl: 'മലിനജല സമ്പർക്കമില്ല.',
      followUpQuestion: {
        id: 'q-scenario-e-symptoms',
        condition: 'if_yes',
        questionEn: 'Has anyone developed sudden fever, unusual muscle/calf pain, red eyes, or significant weakness?',
        questionMl: 'ആർക്കെങ്കിലും പെട്ടെന്ന് പനിയോ, കണ്ണ് ചുവക്കലോ, കാൽവണ്ണയിലെ പേശി വേദനയോ, കടുത്ത ക്ഷീണമോ വന്നിട്ടുണ്ടോ?',
        actionEn: 'Create an urgent healthcare follow-up / referral recommendation to the PHC or medical officer.',
        actionMl: 'അടിയന്തരമായി പ്രാഥമികാരോഗ്യ കേന്ദ്രത്തിൽ (PHC) കാണിക്കാൻ നിർദേശിക്കുക; ലക്ഷണങ്ങൾ രേഖപ്പെടുത്തുക.'
      },
      urgency: 'high',
      impactsCareGap: false
    });
  }

  // =========================================================================
  // SCENARIO F: Poor Air Quality / Biomass Smoke
  // =========================================================================
  const isSmokeVulnerable = vuln.hasChild || vuln.hasInfant || vuln.hasElderly || vuln.hasRespiratoryCondition;
  const isAqiOrSmokeTriggered = env.aqi >= 101 || env.cookingFuel === 'biomass_chulha';

  if (isAqiOrSmokeTriggered && isSmokeVulnerable) {
    questions.push({
      id: 'q-scenario-f-air',
      scenario: 'poor_aqi_smoke',
      titleEn: 'Air Quality & Smoke • Respiratory Check',
      titleMl: 'പുകയും വായുവും • ശ്വാസകോശ പരിശോധന',
      contextReason: `Elevated AQI (${env.aqi}) or Biomass cooking smoke with vulnerable/respiratory household members`,
      questionEn: 'Has anyone experienced increased coughing, wheezing, or breathing difficulty recently?',
      questionMl: 'അടുത്തിടെ വീട്ടിലുള്ള ആർക്കെങ്കിലും പതിവിലധികം ചുമയോ ശ്വാസംമുട്ടലോ നെഞ്ചിൽ കുറുകുറുപ്പോ ഉണ്ടായിട്ടുണ്ടോ?',
      yesOutcomeEn: 'Record reported respiratory symptoms. Ensure cooking cross-ventilation and verify regular prescribed medicines are at hand.',
      yesOutcomeMl: 'ചുമയും ശ്വാസംമുട്ടലും രേഖപ്പെടുത്തുക; അടുക്കളയിൽ നല്ല വായുസഞ്ചാരം ഉറപ്പാക്കുക, നിർദേശിച്ച മരുന്നുകൾ കയ്യിലുണ്ടെന്ന് ഉറപ്പാക്കുക.',
      noOutcomeEn: 'No exacerbation of respiratory symptoms noted.',
      noOutcomeMl: 'ശ്വസന ബുദ്ധിമുട്ടുകൾ റിപ്പോർട്ട് ചെയ്തിട്ടില്ല.',
      urgency: env.aqi >= 150 ? 'high' : 'medium',
      impactsCareGap: false
    });
  }

  return questions;
};

/**
 * Builds the structured EnvironmentalRiskResult and Care Gap update when ASHA answers questions
 */
export const evaluateEnvironmentalCareImpact = (
  question: TargetedQuestion,
  answer: 'yes' | 'no',
  env: EnvironmentalContext,
  vuln: HouseholdVulnerability
): EnvironmentalRiskResult => {
  // Scenario B: Healthcare access barrier
  if (question.scenario === 'heavy_rain_care_access') {
    if (answer === 'yes') {
      return {
        environmental_risk: {
          type: 'heavy_rain',
          severity: 'high',
          evidence: [
            `Heavy rainfall detected (${env.precipitationMm}mm, floodProne: ${env.floodProne})`,
            'Pending healthcare visit identified on record',
            'ASHA confirmed family faces weather/flooding barrier reaching facility'
          ]
        },
        care_gap: {
          gap_type: question.careGapType || 'general',
          description: 'Pending healthcare follow-up affected by weather-related access difficulty',
          status: 'confirmed',
          recommended_action: 'Arrange emergency transport support / coordinate reschedule with PHC',
          priority: 'high',
          access_barrier_type: env.floodProne ? 'flooding' : 'weather_road_blocked'
        },
        action_summary:
          'The heavy rain is making it difficult for the family to attend the pending follow-up. I have marked this as an access-related care gap and escalated its priority.',
        action_summary_ml:
          'കനത്ത മഴ കാരണം ആശുപത്രിയിൽ പോകാൻ തടസ്സമുള്ളതായി രേഖപ്പെടുത്തി; കെയർ ഗ്യാപ്പ് മുൻഗണന ഉയർത്തി ഫോളോ-അപ്പ് ലിസ്റ്റിൽ ചേർത്തു.'
      };
    } else {
      return {
        environmental_risk: {
          type: 'heavy_rain',
          severity: 'medium',
          evidence: [
            `Heavy rainfall (${env.precipitationMm}mm)`,
            'Family confirmed they are able to manage travel despite weather'
          ]
        },
        action_summary: 'Healthcare access confirmed manageable despite weather conditions.',
        action_summary_ml: 'മഴയുണ്ടെങ്കിലും ആശുപത്രി സന്ദർശനത്തിന് തടസ്സമില്ലെന്ന് സ്ഥിരീകരിച്ചു.'
      };
    }
  }

  // Scenario A: Extreme Heat
  if (question.scenario === 'extreme_heat') {
    if (answer === 'yes') {
      return {
        environmental_risk: {
          type: 'extreme_heat',
          severity: env.heatRisk === 'danger' ? 'critical' : 'high',
          evidence: [
            `Heat Risk Tier: ${env.heatRisk.toUpperCase()} (${env.temperatureCelsius}°C, ${env.humidityPercent}% humidity)`,
            'Vulnerable household members present (children/elderly/pregnant)',
            'Reported symptoms: weakness, dizziness, or heat discomfort'
          ]
        },
        action_summary:
          'Reported heat distress symptoms recorded. Advise rest in cool shade, cool water sponge, and clinic review if symptoms persist.',
        action_summary_ml:
          'ചൂട് കാരണമുള്ള അസ്വസ്ഥതകൾ രേഖപ്പെടുത്തി. തണലിൽ വിശ്രമിക്കാനും തണുത്ത വെള്ളം ഉപയോഗിക്കാനും നിർദേശിക്കുക.'
      };
    } else {
      return {
        environmental_risk: {
          type: 'extreme_heat',
          severity: 'low',
          evidence: ['No acute heat distress symptoms reported by household members']
        },
        action_summary: 'No acute heat symptoms reported. Maintain routine age-appropriate fluid intake.',
        action_summary_ml: 'ചൂടിന്റെ അസ്വസ്ഥതകളില്ല. പതിവായി വെള്ളവും ദ്രാവകങ്ങളും കുടിക്കാൻ ഓർമ്മിപ്പിക്കുക.'
      };
    }
  }

  // Scenario C: Standing Water & Vectors
  if (question.scenario === 'standing_water_vector') {
    return {
      environmental_risk: {
        type: 'vector_risk',
        severity: answer === 'yes' ? 'medium' : 'low',
        evidence: [
          answer === 'yes'
            ? 'Stagnant water receptacles present near house'
            : 'No stagnant water near living area'
        ]
      },
      action_summary:
        answer === 'yes'
          ? 'Recommended vector-risk preventive source reduction: overturn shells and plastic containers, clear blocked drainage.'
          : 'Environmental surroundings clear of standing water.',
      action_summary_ml:
        answer === 'yes'
          ? 'കൊതുക് പെരുകുന്നത് തടയാൻ ചിരട്ടകളും പാത്രങ്ങളും മാറ്റാനും വെള്ളം ഒഴുക്കിക്കളയാനും നിർദേശിച്ചു.'
          : 'വീട്ടുപരിസരത്ത് വെള്ളക്കെട്ടുകളില്ല.'
    };
  }

  // Scenario D: Potentially Unsafe Drinking Water
  if (question.scenario === 'unsafe_drinking_water') {
    return {
      environmental_risk: {
        type: 'unsafe_water',
        severity: answer === 'no' ? 'high' : 'low',
        evidence: [
          `Household water source: ${env.drinkingWaterSafety}`,
          answer === 'no'
            ? 'Drinking water is not treated/boiled regularly'
            : 'Drinking water is properly treated/boiled'
        ]
      },
      action_summary:
        answer === 'no'
          ? 'Created preventive water-safety action: advise rolling-boil drinking water and assist with well disinfection.'
          : 'Safe drinking water boiling practice confirmed.',
      action_summary_ml:
        answer === 'no'
          ? 'കുടിവെള്ളം തിളപ്പിച്ചാറ്റി മാത്രം കുടിക്കാൻ നിർദേശിച്ചു; കിണറ്റിൽ മരുന്നിടാൻ സഹായിക്കുക.'
          : 'വെള്ളം ശുദ്ധീകരിച്ച് ഉപയോഗിക്കുന്നത് സ്ഥിരീകരിച്ചു.'
    };
  }

  // Scenario E: Floodwater / Mud Exposure
  if (question.scenario === 'floodwater_mud_exposure') {
    return {
      environmental_risk: {
        type: 'mud_exposure',
        severity: answer === 'yes' ? 'high' : 'low',
        evidence: [
          `Precipitation: ${env.precipitationMm}mm, Flood Prone: ${env.floodProne}`,
          answer === 'yes' ? 'Significant floodwater/mud exposure reported' : 'No floodwater contact'
        ]
      },
      action_summary:
        answer === 'yes'
          ? 'Significant mud/flood contact recorded. Monitor for fever with muscle pain or red eyes; refer to PHC if symptoms emerge.'
          : 'No significant floodwater exposure reported.',
      action_summary_ml:
        answer === 'yes'
          ? 'മലിനജല സമ്പർക്കം രേഖപ്പെടുത്തി. പനിയോ കാലുവേദനയോ ഉണ്ടായാൽ ഉടൻ PHC-ൽ കാണിക്കാൻ നിർദേശിച്ചു.'
          : 'മലിനജല സമ്പർക്കമില്ല.'
    };
  }

  // Scenario F: Poor AQI / Smoke
  if (question.scenario === 'poor_aqi_smoke') {
    return {
      environmental_risk: {
        type: 'poor_aqi',
        severity: answer === 'yes' ? 'high' : 'medium',
        evidence: [
          `AQI: ${env.aqi}, Fuel: ${env.cookingFuel}`,
          answer === 'yes' ? 'Increased respiratory symptoms reported' : 'No acute respiratory symptoms'
        ]
      },
      action_summary:
        answer === 'yes'
          ? 'Respiratory symptoms noted in smoke/AQI environment. Advise kitchen cross-ventilation and verify medication supply.'
          : 'No acute respiratory distress noted.',
      action_summary_ml:
        answer === 'yes'
          ? 'പുക മൂലമുള്ള ബുദ്ധിമുട്ടുകൾ രേഖപ്പെടുത്തി. നല്ല വായുസഞ്ചാരം ഉറപ്പാക്കാനും മരുന്നുകൾ കരുതാനും നിർദേശിച്ചു.'
          : 'ശ്വസന ബുദ്ധിമുട്ടുകൾ ഇല്ല.'
    };
  }

  return {
    environmental_risk: {
      type: 'none',
      severity: 'low',
      evidence: ['Baseline observation']
    },
    action_summary: 'Observation recorded.',
    action_summary_ml: 'വിവരം രേഖപ്പെടുത്തി.'
  };
};
