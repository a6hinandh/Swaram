/**
 * Shared Module Integration Contracts
 * Connects the four standalone health modules in Swaram:
 * 1. Mental Health Voice Screening
 * 2. Environmental & Climate Risk Monitoring
 * 3. NCD Lifestyle & Behavioral Risk Tracking
 * 4. Longitudinal Vitals Baseline & Delta Deviation Detector
 */

export interface SharedHouseholdContext {
  householdId: string;
  familyHeadName: string;
  memberId: string;
  memberName: string;
  age: number;
  gender: 'female' | 'male' | 'other';
  wardNumber: number;
  lastVisitDate?: string;
}

export interface MentalHealthSummary {
  screeningDate: string;
  phq2Score: number;
  requiresPhq9: boolean;
  voiceDistressTier: 'low' | 'moderate' | 'high';
  postpartumDepressionRisk?: boolean;
  urgentReferralFlag: boolean;
  notes?: string;
}

export interface EnvironmentalRiskSummary {
  assessmentDate: string;
  heatIndexTier: 'normal' | 'caution' | 'extreme_caution' | 'danger';
  indoorSmokeExposure: 'none' | 'moderate' | 'heavy_biomass';
  waterSourceSafety: 'safe_piped' | 'boiled' | 'open_well_untested' | 'stagnant_nearby';
  vectorRiskFlag: boolean;
  overallClimateRisk: 'low' | 'moderate' | 'high';
}

export interface NcdLifestyleSummary {
  assessmentDate: string;
  cbacScore: number;
  tobaccoUser: boolean;
  alcoholFrequency: 'never' | 'occasional' | 'frequent';
  dietaryExcessRisk: boolean;
  physicalInactivityFlag: boolean;
  medicationCompliancePercent?: number;
  overallLifestyleRisk: 'low' | 'moderate' | 'high';
}

export interface VitalsDeltaSummary {
  measurementDate: string;
  baselineBp: string;
  currentBp: string;
  systolicDelta: number;
  diastolicDelta: number;
  isHypertensiveSpike: boolean;
  baselineGlucoseMgDl?: number;
  currentGlucoseMgDl?: number;
  glucoseDelta?: number;
  severityLevel: 'normal' | 'moderate_drift' | 'acute_crisis';
}

/**
 * Unified Patient Multi-Domain Profile
 * Cross-module bridge data model
 */
export interface SwaramMultiDomainAssessment {
  patient: SharedHouseholdContext;
  mentalHealth?: MentalHealthSummary;
  environmentalRisk?: EnvironmentalRiskSummary;
  ncdLifestyle?: NcdLifestyleSummary;
  vitalsDelta?: VitalsDeltaSummary;
  computedPriorityScore?: number; // 0 to 100 triage score
  crossDomainFlags?: string[];
}
