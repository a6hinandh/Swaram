/**
 * Environmental & Climate Risk Monitoring Types — Swaram
 * Integrated with ASHA Voice Workflow & Proactive Care-Gap Engine
 */

export type HeatRiskTier = 'normal' | 'caution' | 'extreme_caution' | 'danger';

export type CookingFuelType = 'lpg' | 'electric' | 'biomass_chulha' | 'other' | 'unknown';

export type DrinkingWaterSafety = 'safe' | 'open_well_untested' | 'stagnant_near_home' | 'unknown';

export interface EnvironmentalContext {
  temperatureCelsius: number;
  humidityPercent: number;
  heatRisk: HeatRiskTier;

  precipitationMm: number;
  heavyRain: boolean;
  floodProne: boolean;

  aqi: number;

  waterStagnation: boolean;
  drinkingWaterSafety: DrinkingWaterSafety;

  cookingFuel: CookingFuelType;
}

export interface HouseholdVulnerability {
  hasInfant: boolean;
  hasChild: boolean;
  hasElderly: boolean;
  hasPregnantMember: boolean;

  hasChronicIllness: boolean;
  hasRespiratoryCondition: boolean;

  hasPendingCare: boolean;
  hasPendingReferral: boolean;
  hasPendingVaccination: boolean;
  hasPendingANC: boolean;
  hasMedicationDependency: boolean;
}

export type ScenarioType =
  | 'extreme_heat'
  | 'heavy_rain_care_access'
  | 'standing_water_vector'
  | 'unsafe_drinking_water'
  | 'floodwater_mud_exposure'
  | 'poor_aqi_smoke';

export interface TargetedQuestion {
  id: string;
  scenario: ScenarioType;
  titleEn: string;
  titleMl: string;
  contextReason: string;
  questionEn: string;
  questionMl: string;
  yesOutcomeEn: string;
  yesOutcomeMl: string;
  noOutcomeEn: string;
  noOutcomeMl: string;
  followUpQuestion?: {
    id: string;
    condition: 'if_yes' | 'if_no';
    questionEn: string;
    questionMl: string;
    actionEn: string;
    actionMl: string;
  };
  urgency: 'routine' | 'medium' | 'high' | 'urgent';
  impactsCareGap: boolean;
  careGapType?: 'maternal' | 'immunization' | 'chronic_disease' | 'referral' | 'general';
}

export interface CareGapImpact {
  gap_type: 'maternal' | 'immunization' | 'chronic_disease' | 'referral' | 'general';
  description: string;
  status: 'confirmed' | 'suspected' | 'closed';
  recommended_action: string;
  priority: 'routine' | 'medium' | 'high' | 'urgent';
  access_barrier_type?: 'weather_road_blocked' | 'flooding' | 'transport_unavailable' | 'none';
}

export interface EnvironmentalRiskResult {
  environmental_risk: {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    evidence: string[];
  };
  care_gap?: CareGapImpact;
  action_summary: string;
  action_summary_ml: string;
}

export interface WeatherData {
  locationName: string;
  latitude: number;
  longitude: number;
  temperatureCelsius: number;
  apparentTemperatureCelsius: number;
  humidityPercent: number;
  precipitationMm: number;
  weatherCode: number;
  weatherCondition: string;
  aqiUs: number;
  aqiCategory: 'good' | 'moderate' | 'unhealthy_sensitive' | 'unhealthy' | 'hazardous';
  isLiveFetched: boolean;
  fetchedAt: string;
}
