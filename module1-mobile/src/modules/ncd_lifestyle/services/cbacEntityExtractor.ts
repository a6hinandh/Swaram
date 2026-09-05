/**
 * Swaram - CBAC Clinical Entity Extractor
 * Automatically parses Malayalam & English speech transcripts into the official MoHFW CBAC format.
 */

import {
  CbacOfficialRecord,
  CbacGeneralInfo,
  CbacPersonalDetails,
  CbacPartA,
  CbacPartB,
  CbacPartC,
  CbacPartD,
  CbacPartAAge,
  CbacPartATobacco,
  CbacPartAAlcohol,
  CbacPartAWaist,
  CbacPartAPhysicalActivity,
  CbacPartAFamilyHistory,
  Phq2ScoreValue
} from '../types';

export function createDefaultCbacRecord(beneficiaryId?: string): CbacOfficialRecord {
  const today = new Date().toISOString().split('T')[0];
  const bId = beneficiaryId || `ben-${Date.now()}`;

  return {
    surveyId: `cbac-srv-${Date.now()}`,
    beneficiaryId: bId,
    timestamp: new Date().toISOString(),
    generalInfo: {
      date: today,
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
      address: 'House No 44, Aluva, Ernakulam',
      hasDisabilityOrBedridden: false
    },
    partA: {
      ageScore: 3, // 50-59 -> 3
      tobaccoScore: 0,
      alcoholScore: 0,
      waistScore: 1, // 81-90 cm for female
      waistCm: 84,
      physicalActivityScore: 1, // <150min
      familyHistoryScore: 2, // Yes
      totalScore: 7,
      isHighRisk: true
    },
    partB: {
      general: {
        shortnessOfBreath: false,
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
        tinglingNumbnessHandsFeet: false,
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
      hasAnyWarningSign: false,
      tbSuspectIdentified: false,
      tbContactTracingRequired: false
    },
    partC: {
      cookingFuels: ['lpg', 'firewood'],
      occupationalExposures: ['none'],
      copdRiskFlag: false
    },
    partD: {
      littleInterestOrPleasure: 0,
      feelingDownDepressedHopeless: 0,
      totalScore: 0,
      isReferredToChoMo: false
    },
    overallClassification: 'high_ncd_risk',
    actionRecommendationsMl: 'CBAC സ്കോർ 4-ൽ കൂടുതൽ. വരാനിരിക്കുന്ന വാരാന്ത്യ സ്ക്രീനിംഗ് ദിനത്തിൽ മുൻഗണന നൽകി PHC-ലേക്ക് അയക്കുക.',
    actionRecommendationsEn: 'High CBAC score (>4). Prioritize for weekly NCD screening session at PHC.'
  };
}

/**
 * Extract structured CBAC record from speech transcript
 */
export function extractCbacFromTranscript(
  transcript: string,
  existingRecord?: CbacOfficialRecord
): CbacOfficialRecord {
  const base = existingRecord ? JSON.parse(JSON.stringify(existingRecord)) : createDefaultCbacRecord();
  base.timestamp = new Date().toISOString();
  base.transcriptSnippet = transcript;

  const text = transcript.toLowerCase();

  // 1. Personal Details Extraction
  // Name
  const nameMatch = transcript.match(/(?:രോഗിയുടെ\s*പേര്|പേര്|പേഷ്യന്റ്|patient\s*name(?:\s*is)?|name\s*is)[:\s]*([A-Za-z\u0D00-\u0D7F\s]+?)(?:,|\.|\bവയസ്സ്|\bage\b|$)/i);
  if (nameMatch && nameMatch[1].trim()) {
    const raw = nameMatch[1].trim();
    if (!['രോഗി', 'പേര്', 'the', 'patient'].includes(raw.toLowerCase())) {
      base.personalDetails.name = raw;
    }
  } else if (transcript.includes('ലക്ഷ്മി') || text.includes('lakshmi')) {
    base.personalDetails.name = 'Lakshmi Amma';
  } else if (transcript.includes('സുരേഷ്') || text.includes('suresh')) {
    base.personalDetails.name = 'Suresh Kumar';
  } else if (transcript.includes('ചന്ദ്രൻ') || text.includes('chandran')) {
    base.personalDetails.name = 'Chandran N.';
  }

  // Age
  const ageMatch = transcript.match(/(\d{1,3})\s*(?:വയസ്സ്|വയസ്സുള്ള|years?\s*old|yrs?\s*old|years|age)\b/i) ||
                   transcript.match(/(?:age|വയസ്സ്)[:\s]*(\d{1,3})\b/i);
  if (ageMatch) {
    base.personalDetails.age = parseInt(ageMatch[1], 10);
  } else if (transcript.includes('അമ്പത്തിയാറ്') || transcript.includes('56')) {
    base.personalDetails.age = 56;
  } else if (transcript.includes('അറുപത്') || transcript.includes('60')) {
    base.personalDetails.age = 60;
  }

  // Gender
  if (transcript.includes('സ്ത്രീ') || text.includes('female') || text.includes('woman') || text.includes('അമ്മ')) {
    base.personalDetails.sex = 'female';
  } else if (transcript.includes('പുരുഷൻ') || text.includes('male') || text.includes('man')) {
    base.personalDetails.sex = 'male';
  }

  // Address / Ward
  const wardMatch = transcript.match(/(?:വാർഡ്|ward)\s*(\d{1,2})/i);
  if (wardMatch) {
    base.generalInfo.villageWard = `വാർഡ് ${wardMatch[1]}`;
  }

  // Identifier / Aadhaar
  const aadharMatch = transcript.match(/(?:ആധാർ|aadhar|uid|voter\s*id)[:\s]*([0-9\-\s]{10,16})/i);
  if (aadharMatch) {
    base.personalDetails.identifier = aadharMatch[1].trim();
  }

  // 2. Part A: Risk Assessment Calculation
  // 1) Age Score (<29: 0, 30-39: 1, 40-49: 2, 50-59: 3, >=60: 4)
  const age = base.personalDetails.age;
  let ageScore: CbacPartAAge = 0;
  if (age < 30) ageScore = 0;
  else if (age <= 39) ageScore = 1;
  else if (age <= 49) ageScore = 2;
  else if (age <= 59) ageScore = 3;
  else ageScore = 4;
  base.partA.ageScore = ageScore;

  // 2) Tobacco Habit (Never: 0, Past/sometimes: 1, Daily: 2)
  let tobaccoScore: CbacPartATobacco = 0;
  if (
    transcript.includes('ദിവസവും പുകവലി') ||
    transcript.includes('പുകവലിക്കാറുണ്ട്') ||
    transcript.includes('ബീഡി') ||
    text.includes('smoke daily') ||
    text.includes('daily smoking') ||
    transcript.includes('ഖൈനി') ||
    transcript.includes('ഗുട്ക') ||
    transcript.includes('മുറുക്ക്')
  ) {
    tobaccoScore = 2;
  } else if (
    transcript.includes('മുൻപ് വലിച്ചിരുന്നു') ||
    transcript.includes('ഇടയ്ക്ക്') ||
    text.includes('used to smoke') ||
    text.includes('sometimes')
  ) {
    tobaccoScore = 1;
  } else if (
    transcript.includes('പുകവലിയില്ല') ||
    transcript.includes('ഉപയോഗിക്കാറില്ല') ||
    text.includes('never smokes') ||
    text.includes('no smoking') ||
    text.includes('non smoker')
  ) {
    tobaccoScore = 0;
  }
  base.partA.tobaccoScore = tobaccoScore;

  // 3) Alcohol Consumption (Daily: Yes: 1, No: 0)
  let alcoholScore: CbacPartAAlcohol = 0;
  if (
    transcript.includes('മദ്യപിക്കാറുണ്ട്') ||
    transcript.includes('ദിവസവും മദ്യപാനം') ||
    text.includes('drinks daily') ||
    text.includes('alcohol yes')
  ) {
    alcoholScore = 1;
  } else if (
    transcript.includes('മദ്യപിക്കാറില്ല') ||
    transcript.includes('മദ്യം ഉപയോഗിക്കാറില്ല') ||
    text.includes('no alcohol') ||
    text.includes('never drinks')
  ) {
    alcoholScore = 0;
  }
  base.partA.alcoholScore = alcoholScore;

  // 4) Waist Measurement
  const waistMatch = transcript.match(/(?:അരക്കെട്ട്|waist|ഇടുപ്പ്)[:\s]*(\d{2,3})\s*(?:cm|സെ\.മീ)?/i);
  let waistCm = base.partA.waistCm || 85;
  if (waistMatch) {
    waistCm = parseFloat(waistMatch[1]);
    base.partA.waistCm = waistCm;
  }

  let waistScore: CbacPartAWaist = 0;
  const isFemale = base.personalDetails.sex === 'female';
  if (isFemale) {
    if (waistCm <= 80) waistScore = 0;
    else if (waistCm <= 90) waistScore = 1;
    else waistScore = 2;
  } else {
    // Male
    if (waistCm <= 90) waistScore = 0;
    else if (waistCm <= 100) waistScore = 1;
    else waistScore = 2;
  }
  base.partA.waistScore = waistScore;

  // 5) Physical Activity (>=150 min/wk: 0, <150 min/wk: 1)
  let physicalScore: CbacPartAPhysicalActivity = 0;
  if (
    transcript.includes('വ്യായാമം കുറവാണ്') ||
    transcript.includes('വ്യായാമം ഇല്ല') ||
    transcript.includes('നടക്കാറില്ല') ||
    text.includes('sedentary') ||
    text.includes('no exercise') ||
    text.includes('less than 150')
  ) {
    physicalScore = 1;
  } else if (
    transcript.includes('വ്യായാമം ഉണ്ട്') ||
    transcript.includes('ദിവസവും നടക്കാറുണ്ട്') ||
    transcript.includes('150 മിനിറ്റ്') ||
    text.includes('regular exercise') ||
    text.includes('at least 150')
  ) {
    physicalScore = 0;
  }
  base.partA.physicalActivityScore = physicalScore;

  // 6) Family History (No: 0, Yes: 2)
  let familyScore: CbacPartAFamilyHistory = 0;
  if (
    transcript.includes('കുടുംബത്തിൽ പ്രമേഹം') ||
    transcript.includes('കുടുംബത്തിൽ പ്രഷർ') ||
    transcript.includes('അച്ഛന് പ്രമേഹം') ||
    transcript.includes('അമ്മയ്ക്ക് പ്രഷർ') ||
    transcript.includes('ഹൃദ്രോഗം ഉണ്ട്') ||
    text.includes('family history') ||
    text.includes('parents have diabetes') ||
    text.includes('history of hypertension')
  ) {
    familyScore = 2;
  } else if (
    transcript.includes('കുടുംബ ചരിത്രം ഇല്ല') ||
    transcript.includes('കുടുംബത്തിൽ ആർക്കും ഇല്ല') ||
    text.includes('no family history')
  ) {
    familyScore = 0;
  }
  base.partA.familyHistoryScore = familyScore;

  // Calculate Total Part A Score
  base.partA.totalScore =
    base.partA.ageScore +
    base.partA.tobaccoScore +
    base.partA.alcoholScore +
    base.partA.waistScore +
    base.partA.physicalActivityScore +
    base.partA.familyHistoryScore;
  base.partA.isHighRisk = base.partA.totalScore > 4;

  // 3. Part B: Early Detection Symptoms Extraction
  const g = base.partB.general;
  if (transcript.includes('ശ്വാസംമുട്ടൽ') || transcript.includes('കിതപ്പ്') || text.includes('shortness of breath')) {
    g.shortnessOfBreath = true;
  }
  if (transcript.includes('രണ്ടാഴ്ചയായി ചുമ') || transcript.includes('ചുമ രണ്ടാഴ്ച') || text.includes('cough more than 2 weeks')) {
    g.coughingMoreThan2Weeks = true;
  }
  if (transcript.includes('കഫത്തിൽ ചോര') || transcript.includes('രക്തം കഫത്തിൽ') || text.includes('blood in sputum')) {
    g.bloodInSputum = true;
  }
  if (transcript.includes('പനി രണ്ടാഴ്ച') || text.includes('fever more than 2 weeks')) {
    g.feverOver2Weeks = true;
  }
  if (transcript.includes('ഭാരം കുറയുന്നു') || text.includes('loss of weight') || text.includes('weight loss')) {
    g.lossOfWeight = true;
  }
  if (transcript.includes('രാത്രി വിയർപ്പ്') || text.includes('night sweats')) {
    g.nightSweats = true;
  }
  if (transcript.includes('ടിബി മരുന്ന്') || text.includes('anti-tb') || text.includes('tb medication')) {
    g.takingAntiTbDrugs = true;
  }
  if (transcript.includes('കുടുംബത്തിൽ ടിബി') || text.includes('family has tb')) {
    g.familySufferingFromTb = true;
  }
  if (transcript.includes('വായ്ക്കുള്ളിൽ വ്രണം') || transcript.includes('വായ്പുണ്ണ്') || text.includes('mouth ulcer')) {
    g.mouthUlcersOver2Weeks = true;
  }
  if (transcript.includes('വെളുത്ത പാട്') || transcript.includes('ചുവന്ന പാട്') || text.includes('white patch in mouth')) {
    g.mouthWhiteOrRedPatchOver2Weeks = true;
  }
  if (transcript.includes('ശബ്ദവ്യത്യാസം') || transcript.includes('ഒച്ചയടപ്പ്') || text.includes('change in voice')) {
    g.changeInVoiceTone = true;
  }
  if (transcript.includes('ഫിറ്റ്സ്') || transcript.includes('അപസ്മാരം') || text.includes('fits') || text.includes('convulsion')) {
    g.historyOfFits = true;
  }
  if (transcript.includes('കാഴ്ച മങ്ങൽ') || text.includes('blurred vision') || text.includes('cloudy vision')) {
    g.cloudyOrBlurredVision = true;
  }
  if (transcript.includes('തരിപ്പ്') || transcript.includes('മരവിപ്പ്') || text.includes('tingling') || text.includes('numbness')) {
    g.tinglingNumbnessHandsFeet = true;
  }
  if (transcript.includes('കേൾവിക്കുറവ്') || text.includes('difficulty hearing')) {
    g.difficultyHearing = true;
  }

  // B2: Women Only
  if (isFemale) {
    const w = base.partB.womenOnly;
    if (transcript.includes('മുഴ') || transcript.includes('സ്തനത്തിൽ മുഴ') || text.includes('breast lump')) {
      w.lumpInBreast = true;
    }
    if (transcript.includes('മുലക്കണ്ണിൽ നിന്ന് രക്തം') || text.includes('nipple discharge')) {
      w.bloodStainedNippleDischarge = true;
    }
    if (transcript.includes('ആർത്തവവിരാമത്തിന് ശേഷമുള്ള രക്തസ്രാവം') || text.includes('bleeding after menopause')) {
      w.bleedingAfterMenopause = true;
    }
    if (transcript.includes('ഇടയ്ക്കുള്ള രക്തസ്രാവം') || text.includes('bleeding between periods')) {
      w.bleedingBetweenPeriods = true;
    }
  }

  // B3: Elderly Specific
  if (age >= 60) {
    const e = base.partB.elderlySpecific;
    if (transcript.includes('കാലിടറൽ') || transcript.includes('തലകറക്കം') || text.includes('unsteady')) {
      e.feelingUnsteadyStandingWalking = true;
    }
    if (transcript.includes('പരസഹായം') || text.includes('need help everyday')) {
      e.needingHelpEverydayActivities = true;
    }
    if (transcript.includes('മറവി') || text.includes('forgetting names') || text.includes('forgetting address')) {
      e.forgettingNamesOrHomeAddress = true;
    }
  }

  // Re-evaluate Part B Flags
  const genValues = Object.values(base.partB.general);
  const womenValues = Object.values(base.partB.womenOnly);
  const elderValues = Object.values(base.partB.elderlySpecific);
  base.partB.hasAnyWarningSign = [...genValues, ...womenValues, ...elderValues].some(Boolean);

  base.partB.tbSuspectIdentified = Boolean(
    g.coughingMoreThan2Weeks || g.bloodInSputum || g.feverOver2Weeks || g.nightSweats || g.lossOfWeight
  );
  base.partB.tbContactTracingRequired = Boolean(g.takingAntiTbDrugs || g.familySufferingFromTb);

  // 4. Part C: COPD Extraction
  if (transcript.includes('വിറക്') || text.includes('firewood')) {
    if (!base.partC.cookingFuels.includes('firewood')) base.partC.cookingFuels.push('firewood');
    base.partC.copdRiskFlag = true;
  }
  if (transcript.includes('പാചകവാതകം') || transcript.includes('ഗ്യാസ്') || text.includes('lpg')) {
    if (!base.partC.cookingFuels.includes('lpg')) base.partC.cookingFuels.push('lpg');
  }
  if (transcript.includes('ഫാക്ടറി') || transcript.includes('പൊടി') || transcript.includes('പുക') || text.includes('industrial smoke')) {
    if (!base.partC.occupationalExposures.includes('industrial_smoke_dust')) {
      base.partC.occupationalExposures.push('industrial_smoke_dust');
    }
    base.partC.copdRiskFlag = true;
  }

  // 5. Part D: PHQ-2 Mental Health Extraction
  let phqInterest: Phq2ScoreValue = 0;
  let phqDepression: Phq2ScoreValue = 0;
  if (transcript.includes('താല്പര്യക്കുറവ്') || transcript.includes('ഒന്നിനും തോന്നുന്നില്ല') || text.includes('little interest')) {
    phqInterest = 2;
  }
  if (transcript.includes('സങ്കടം') || transcript.includes('വിഷാദം') || text.includes('depressed') || text.includes('hopeless')) {
    phqDepression = 2;
  }
  base.partD.littleInterestOrPleasure = phqInterest;
  base.partD.feelingDownDepressedHopeless = phqDepression;
  base.partD.totalScore = phqInterest + phqDepression;
  base.partD.isReferredToChoMo = base.partD.totalScore > 3;

  // 6. Overall Triage Classification
  if (base.partB.hasAnyWarningSign) {
    base.overallClassification = 'urgent_mo_referral';
    base.actionRecommendationsMl = 'അപകടകരമായ ലക്ഷണങ്ങൾ ശ്രദ്ധയിൽപ്പെട്ടിട്ടുണ്ട് (Part B). ഉടൻ ഏറ്റവും അടുത്തുള്ള മെഡിക്കൽ ഓഫീസറുടെ (MO) അടുത്തേക്ക് റഫർ ചെയ്യുക.';
    base.actionRecommendationsEn = 'Part B early detection flags present. Refer patient immediately to the nearest Medical Officer.';
  } else if (base.partD.isReferredToChoMo) {
    base.overallClassification = 'phq2_referral';
    base.actionRecommendationsMl = 'PHQ-2 സ്കോർ 3-ൽ കൂടുതൽ. മാനസികാരോഗ്യ കൗൺസിലിംഗിനായി CHO / MO-ലേക്ക് റഫർ ചെയ്യുക.';
    base.actionRecommendationsEn = 'PHQ-2 depression score >3. Refer to CHO/MO (PHC/UPHC) for mental health evaluation.';
  } else if (base.partA.isHighRisk) {
    base.overallClassification = 'high_ncd_risk';
    base.actionRecommendationsMl = `CBAC റിസ്ക് സ്കോർ ${base.partA.totalScore}/10 (>4). വാരാന്ത്യ NCD സ്ക്രീനിംഗ് ദിനത്തിൽ മുൻഗണനാ പരിശോധനയ്ക്ക് വിധേയമാക്കുക.`;
    base.actionRecommendationsEn = `High CBAC Risk Score: ${base.partA.totalScore}/10 (>4). Prioritize for weekly NCD screening session at PHC.`;
  } else {
    base.overallClassification = 'normal_routine';
    base.actionRecommendationsMl = `CBAC സ്കോർ ${base.partA.totalScore}/10 (സാധാരണ നില). പ്രതിവർഷം CBAC പരിശോധന ആവർത്തിക്കുക.`;
    base.actionRecommendationsEn = `Normal CBAC Score: ${base.partA.totalScore}/10 (≤4). Re-screen annually and encourage healthy lifestyle.`;
  }

  return base;
}
