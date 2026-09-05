/**
 * Environmental & Climate Risk Monitoring Types
 * Module 2 - Frontend Contracts
 */

export type HeatIndexRiskTier = 'normal' | 'caution' | 'extreme_caution' | 'danger';

export type CookingFuelType = 'lpg_clean' | 'biomass_chulha' | 'kerosene' | 'mixed';

export type WaterSourceSafety = 'piped_treated' | 'boiled' | 'open_well_untested' | 'stagnant_near_home';

export interface EnvironmentalHazardAssessment {
  assessmentId: string;
  householdId: string;
  timestamp: string;
  temperatureCelsius: number;
  humidityPercent: number;
  heatRiskTier: HeatIndexRiskTier;
  cookingFuel: CookingFuelType;
  indoorVentilationAdequate: boolean;
  waterSource: WaterSourceSafety;
  waterStagnationPresent: boolean;
  floodProneArea: boolean;
  overallRiskLevel: 'low' | 'moderate' | 'high';
  actionableAdviceMl?: string;
}
