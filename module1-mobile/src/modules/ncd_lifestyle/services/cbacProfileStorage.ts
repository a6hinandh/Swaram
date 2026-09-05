/**
 * Swaram - CBAC Longitudinal Profile Storage Service
 * Persists beneficiary profiles and multi-survey history offline on the device.
 * Tracks risk score progression across multiple visits and supports score-based filtering.
 */

import { BeneficiaryProfile, CbacOfficialRecord } from '../types';

let FileSystem: any = null;
try {
  FileSystem = require('expo-file-system/legacy');
} catch {
  try {
    FileSystem = require('expo-file-system');
  } catch {
    // In-memory fallback
  }
}

const inMemoryProfiles: Map<string, BeneficiaryProfile> = new Map();

function getStorageDirectory(): string | null {
  if (FileSystem && FileSystem.documentDirectory) {
    return `${FileSystem.documentDirectory}cbac_profiles/`;
  }
  return null;
}

async function ensureDirectory(): Promise<string | null> {
  const dir = getStorageDirectory();
  if (!dir) return null;
  try {
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    return dir;
  } catch (err) {
    console.warn('[CbacProfileStorage] Failed to create directory:', err);
    return null;
  }
}

function normalizeId(name: string, identifier?: string): string {
  if (identifier && identifier.trim()) {
    return `ben-${identifier.replace(/[^a-zA-Z0-9]/g, '')}`;
  }
  return `ben-${name.toLowerCase().trim().replace(/[^a-z0-9]/g, '-')}`;
}

/**
 * Seed realistic initial profile data for immediate testing
 */
function initializeSeedProfiles() {
  if (inMemoryProfiles.size > 0) return;

  const lakshmiId = 'ben-lakshmi-amma';
  const survey1Date = '2026-08-01T10:30:00Z';
  const survey2Date = '2026-09-05T09:15:00Z';

  const survey1: CbacOfficialRecord = {
    surveyId: 'cbac-seed-lakshmi-01',
    beneficiaryId: lakshmiId,
    timestamp: survey1Date,
    generalInfo: {
      date: '2026-08-01',
      nameOfAsha: 'Radhamani ASHA',
      villageWard: 'വാർഡ് 4 (ആലുവ)',
      nameOfMpwAnm: 'Sister Sunitha',
      subCentre: 'കീഴ്മാട് SC',
      ayushDispensary: 'ആലുവ ആയുഷ്',
      phcUphc: 'ആലുവ താലൂക്ക് PHC'
    },
    personalDetails: {
      name: 'Lakshmi Amma',
      identifier: '9842-1102-4412',
      age: 56,
      sex: 'female',
      stateInsuranceScheme: true,
      insuranceDetails: 'KASP / Karunya Health Scheme',
      telephone: '9847123456',
      address: 'House No 44, Aluva',
      hasDisabilityOrBedridden: false
    },
    partA: {
      ageScore: 3,
      tobaccoScore: 0,
      alcoholScore: 0,
      waistScore: 2, // >90 cm initially
      waistCm: 92,
      physicalActivityScore: 1, // inactive
      familyHistoryScore: 2, // family history
      totalScore: 8,
      isHighRisk: true
    },
    partB: {
      general: {
        shortnessOfBreath: true,
        historyOfFits: false,
        coughingMoreThan2Weeks: false,
        difficultyOpeningMouth: false,
        bloodInSputum: false,
        mouthUlcersOver2Weeks: false,
        feverOver2Weeks: false,
        mouthGrowthOver2Weeks: false,
        lossOfWeight: false,
        mouthWhiteOrRedPatchOver2Weeks: false,
        nightSweats: false,
        painWhileChewing: false,
        takingAntiTbDrugs: false,
        changeInVoiceTone: false,
        familySufferingFromTb: false,
        hypopigmentedPatchesLossOfSensation: false,
        historyOfTb: false,
        thickenedSkin: false,
        recurrentUlcerationPalmOrSole: false,
        skinNodules: false,
        recurrentTinglingPalmOrSole: false,
        recurrentNumbnessPalmOrSole: false,
        cloudyOrBlurredVision: false,
        clawingOfFingers: false,
        difficultyReading: false,
        tinglingNumbnessHandsFeet: true,
        painInEyesOver1Week: false,
        inabilityToCloseEyelid: false,
        rednessInEyesOver1Week: false,
        difficultyHoldingObjects: false,
        difficultyHearing: false,
        weaknessInFeetWalkingDifficulty: false
      },
      womenOnly: {
        lumpInBreast: false,
        bleedingAfterMenopause: false,
        bloodStainedNippleDischarge: false,
        bleedingAfterIntercourse: false,
        changeInBreastShapeOrSize: false,
        foulSmellingVaginalDischarge: false,
        bleedingBetweenPeriods: false
      },
      elderlySpecific: {
        feelingUnsteadyStandingWalking: false,
        needingHelpEverydayActivities: false,
        physicalDisabilityRestrictingMovement: false,
        forgettingNamesOrHomeAddress: false
      },
      hasAnyWarningSign: true,
      tbSuspectIdentified: false,
      tbContactTracingRequired: false
    },
    partC: {
      cookingFuels: ['firewood', 'lpg'],
      occupationalExposures: ['none'],
      copdRiskFlag: false
    },
    partD: {
      littleInterestOrPleasure: 1,
      feelingDownDepressedHopeless: 1,
      totalScore: 2,
      isReferredToChoMo: false
    },
    overallClassification: 'urgent_mo_referral',
    actionRecommendationsMl: 'പ്രാരംഭ ലക്ഷണങ്ങൾ (ശ്വാസംമുട്ടൽ, തരിപ്പ്) ഉള്ളതിനാൽ മെഡിക്കൽ ഓഫീസർക്ക് റഫർ ചെയ്തു.',
    actionRecommendationsEn: 'Referred to Medical Officer for breathing difficulty and peripheral numbness.'
  };

  const survey2: CbacOfficialRecord = {
    ...survey1,
    surveyId: 'cbac-seed-lakshmi-02',
    timestamp: survey2Date,
    generalInfo: { ...survey1.generalInfo, date: '2026-09-05' },
    partA: {
      ...survey1.partA,
      waistScore: 1, // reduced to 86 cm
      waistCm: 86,
      physicalActivityScore: 0, // started walking 150min
      totalScore: 6, // improved from 8 to 6
      isHighRisk: true
    },
    partB: {
      ...survey1.partB,
      general: {
        ...survey1.partB.general,
        shortnessOfBreath: false // resolved
      },
      hasAnyWarningSign: true // numbness remains
    },
    overallClassification: 'high_ncd_risk',
    actionRecommendationsMl: 'ജീവിതശൈലിയിൽ പുരോഗതി (സ്കോർ 8-ൽ നിന്ന് 6-ലേക്ക് കുറഞ്ഞു). വാരാന്ത്യ NCD സ്ക്രീനിംഗ് തുടരുക.',
    actionRecommendationsEn: 'Lifestyle risk improved (Score reduced from 8 to 6). Continue weekly screening.'
  };

  const lakshmiProfile: BeneficiaryProfile = {
    beneficiaryId: lakshmiId,
    name: 'Lakshmi Amma',
    age: 56,
    sex: 'female',
    identifier: '9842-1102-4412',
    telephone: '9847123456',
    address: 'House No 44, Aluva',
    villageWard: 'വാർഡ് 4 (ആലുവ)',
    createdAt: survey1Date,
    updatedAt: survey2Date,
    surveys: [survey2, survey1],
    latestSurveyDate: survey2Date,
    latestScore: 6,
    initialScore: 8,
    scoreTrend: 'improved',
    latestClassification: 'high_ncd_risk'
  };

  // Seed Chandran N. (Score <= 4, Normal risk)
  const chandranId = 'ben-chandran-n';
  const chandranDate = '2026-09-02T11:00:00Z';
  const chandranSurvey: CbacOfficialRecord = {
    ...survey1,
    surveyId: 'cbac-seed-chandran-01',
    beneficiaryId: chandranId,
    timestamp: chandranDate,
    generalInfo: { ...survey1.generalInfo, date: '2026-09-02' },
    personalDetails: {
      name: 'Chandran N.',
      identifier: '4410-9921-3318',
      age: 44,
      sex: 'male',
      stateInsuranceScheme: true,
      telephone: '9447112233',
      address: 'Ward 4, North Block',
      hasDisabilityOrBedridden: false
    },
    partA: {
      ageScore: 2, // 40-49 -> 2
      tobaccoScore: 0,
      alcoholScore: 0,
      waistScore: 0, // <=90 cm
      waistCm: 84,
      physicalActivityScore: 0, // active
      familyHistoryScore: 0, // no
      totalScore: 2,
      isHighRisk: false
    },
    partB: {
      ...survey1.partB,
      general: {
        ...survey1.partB.general,
        shortnessOfBreath: false,
        tinglingNumbnessHandsFeet: false
      },
      hasAnyWarningSign: false
    },
    partD: {
      littleInterestOrPleasure: 0,
      feelingDownDepressedHopeless: 0,
      totalScore: 0,
      isReferredToChoMo: false
    },
    overallClassification: 'normal_routine',
    actionRecommendationsMl: 'CBAC സ്കോർ 2/10 (സാധാരണ നില). വാർഷിക പരിശോധന മതിയാകും.',
    actionRecommendationsEn: 'Normal CBAC Score (2/10). Annual re-screening recommended.'
  };

  const chandranProfile: BeneficiaryProfile = {
    beneficiaryId: chandranId,
    name: 'Chandran N.',
    age: 44,
    sex: 'male',
    identifier: '4410-9921-3318',
    telephone: '9447112233',
    address: 'Ward 4, North Block',
    villageWard: 'വാർഡ് 4 (ആലുവ)',
    createdAt: chandranDate,
    updatedAt: chandranDate,
    surveys: [chandranSurvey],
    latestSurveyDate: chandranDate,
    latestScore: 2,
    initialScore: 2,
    scoreTrend: 'stable',
    latestClassification: 'normal_routine'
  };

  inMemoryProfiles.set(lakshmiId, lakshmiProfile);
}

// Initialize seed data on load
initializeSeedProfiles();

/**
 * Save a new survey under a beneficiary's profile (supports multiple visits per individual)
 */
export async function saveSurveyToProfile(survey: CbacOfficialRecord): Promise<BeneficiaryProfile> {
  const beneficiaryId = normalizeId(survey.personalDetails.name, survey.personalDetails.identifier);
  survey.beneficiaryId = beneficiaryId;

  let profile = inMemoryProfiles.get(beneficiaryId);

  if (!profile) {
    // Create new profile for this individual
    profile = {
      beneficiaryId,
      name: survey.personalDetails.name,
      age: survey.personalDetails.age,
      sex: survey.personalDetails.sex,
      identifier: survey.personalDetails.identifier,
      telephone: survey.personalDetails.telephone,
      address: survey.personalDetails.address,
      villageWard: survey.generalInfo.villageWard,
      createdAt: survey.timestamp,
      updatedAt: survey.timestamp,
      surveys: [survey],
      latestSurveyDate: survey.timestamp,
      latestScore: survey.partA.totalScore,
      initialScore: survey.partA.totalScore,
      scoreTrend: 'stable',
      latestClassification: survey.overallClassification
    };
  } else {
    // Append to existing profile & calculate longitudinal progress trend
    const existingIndex = profile.surveys.findIndex((s) => s.surveyId === survey.surveyId);
    if (existingIndex >= 0) {
      profile.surveys[existingIndex] = survey;
    } else {
      profile.surveys.unshift(survey);
    }

    // Sort surveys by timestamp descending
    profile.surveys.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const latest = profile.surveys[0];
    const oldest = profile.surveys[profile.surveys.length - 1];

    profile.age = latest.personalDetails.age;
    profile.updatedAt = latest.timestamp;
    profile.latestSurveyDate = latest.timestamp;
    profile.latestScore = latest.partA.totalScore;
    profile.initialScore = oldest.partA.totalScore;
    profile.latestClassification = latest.overallClassification;

    // Longitudinal Score Trend:
    // If user has >= 2 surveys, compare latest with the previous one
    if (profile.surveys.length >= 2) {
      const prev = profile.surveys[1];
      if (latest.partA.totalScore < prev.partA.totalScore) {
        profile.scoreTrend = 'improved';
      } else if (latest.partA.totalScore > prev.partA.totalScore) {
        profile.scoreTrend = 'worsened';
      } else {
        profile.scoreTrend = 'stable';
      }
    } else {
      profile.scoreTrend = 'stable';
    }
  }

  inMemoryProfiles.set(beneficiaryId, profile);

  // Persist to FileSystem
  try {
    const dir = await ensureDirectory();
    if (dir) {
      const filePath = `${dir}${beneficiaryId}.json`;
      await FileSystem.writeAsStringAsync(filePath, JSON.stringify(profile, null, 2));
    }
  } catch (e) {
    console.warn('[CbacProfileStorage] Failed to write profile to disk:', e);
  }

  return profile;
}

/**
 * Retrieve all beneficiary profiles
 */
export async function getAllBeneficiaryProfiles(): Promise<BeneficiaryProfile[]> {
  try {
    const dir = await ensureDirectory();
    if (dir) {
      const files = await FileSystem.readDirectoryAsync(dir);
      const jsonFiles = files.filter((f: string) => f.endsWith('.json'));

      for (const fileName of jsonFiles) {
        try {
          const content = await FileSystem.readAsStringAsync(`${dir}${fileName}`);
          const parsed: BeneficiaryProfile = JSON.parse(content);
          inMemoryProfiles.set(parsed.beneficiaryId, parsed);
        } catch (e) {
          console.warn(`[CbacProfileStorage] Error reading ${fileName}:`, e);
        }
      }
    }
  } catch (err) {
    console.warn('[CbacProfileStorage] Reading memory cache only:', err);
  }

  const list = Array.from(inMemoryProfiles.values());
  list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return list;
}

/**
 * Filter beneficiary profiles based on score classification
 */
export async function getFilteredProfiles(
  filter: 'all' | 'high_risk' | 'normal' | 'warning_signs' | 'phq2',
  searchQuery: string = ''
): Promise<BeneficiaryProfile[]> {
  const all = await getAllBeneficiaryProfiles();

  return all.filter((p) => {
    // Search query match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = p.name.toLowerCase().includes(q);
      const matchId = (p.identifier || '').toLowerCase().includes(q);
      const matchWard = (p.villageWard || '').toLowerCase().includes(q);
      if (!matchName && !matchId && !matchWard) return false;
    }

    // Filter rule match
    switch (filter) {
      case 'high_risk':
        return p.latestScore > 4;
      case 'normal':
        return p.latestScore <= 4;
      case 'warning_signs':
        return p.latestClassification === 'urgent_mo_referral' ||
               p.surveys.some((s) => s.partB.hasAnyWarningSign);
      case 'phq2':
        return p.latestClassification === 'phq2_referral' ||
               p.surveys.some((s) => s.partD.isReferredToChoMo);
      case 'all':
      default:
        return true;
    }
  });
}

/**
 * Delete a beneficiary profile
 */
export async function deleteBeneficiaryProfile(beneficiaryId: string): Promise<boolean> {
  inMemoryProfiles.delete(beneficiaryId);
  try {
    const dir = await ensureDirectory();
    if (dir) {
      const filePath = `${dir}${beneficiaryId}.json`;
      const info = await FileSystem.getInfoAsync(filePath);
      if (info.exists) {
        await FileSystem.deleteAsync(filePath, { idempotent: true });
      }
    }
    return true;
  } catch {
    return false;
  }
}
