import { HeatIndexRiskTier, CookingFuelType, WaterSourceSafety, EnvironmentalHazardAssessment } from '../types';

export const calculateHeatRiskTier = (tempC: number, humidityPercent: number): HeatIndexRiskTier => {
  // Simplified heat index calculation
  const simpleIndex = tempC + (humidityPercent * 0.1);
  if (simpleIndex >= 44) return 'danger';
  if (simpleIndex >= 38) return 'extreme_caution';
  if (simpleIndex >= 32) return 'caution';
  return 'normal';
};

export const evaluateOverallEnvironmentalRisk = (
  heatTier: HeatIndexRiskTier,
  fuel: CookingFuelType,
  water: WaterSourceSafety,
  stagnation: boolean
): 'low' | 'moderate' | 'high' => {
  let score = 0;
  if (heatTier === 'danger') score += 3;
  else if (heatTier === 'extreme_caution') score += 2;
  else if (heatTier === 'caution') score += 1;

  if (fuel === 'biomass_chulha') score += 2;
  if (water === 'open_well_untested' || water === 'stagnant_near_home') score += 2;
  if (stagnation) score += 2;

  if (score >= 5) return 'high';
  if (score >= 2) return 'moderate';
  return 'low';
};
