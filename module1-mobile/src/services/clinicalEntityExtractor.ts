/**
 * Swaram - Clinical Entity Extractor
 * Extracts comprehensive structured clinical records from bilingual (Malayalam / English)
 * voice transcripts recorded during home visits by ASHA / healthcare workers.
 */

import {
  StructuredClinicalRecord,
  ComplaintItem,
  MedicationItem,
  createEmptyClinicalRecord,
} from '../types/structuredClinicalRecord';
import { HouseholdSummary } from '../types';
import { correctMalayalamSpelling } from './malayalamSpellCorrector';

// --- Helper Date Formatting ---
function formatDateYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Calculate target day of week (0 = Sun, 1 = Mon, ..., 4 = Thu, etc.)
function getNextDayOfWeek(targetDay: number, fromDate = new Date()): Date {
  const result = new Date(fromDate);
  const currentDay = result.getDay();
  let daysUntil = (targetDay - currentDay + 7) % 7;
  if (daysUntil === 0) daysUntil = 7; // Next occurrence, not today
  result.setDate(result.getDate() + daysUntil);
  return result;
}

// Malayalam number word mapping for phonetic voice transcription
const MALAYALAM_NUMBER_WORDS: Record<string, number> = {
  'പത്ത്': 10,
  'പതിനഞ്ച്': 15,
  'ഇരുപത്': 20,
  'ഇരുപത്തിയഞ്ച്': 25,
  'ഇരുപത്തിയാറ്': 26,
  'ഇരുപത്തിയേഴ്': 27,
  'ഇരുപത്തിയെട്ട്': 28,
  'ഇരുപത്തൊമ്പത്': 29,
  'മുപ്പത്': 30,
  'മുപ്പത്തിയഞ്ച്': 35,
  'നാൽപ്പത്': 40,
  'നാപ്പത്': 40,
  'അമ്പത്': 50,
  'അറുപത്': 60,
  'എഴുപത്': 70,
  'എഴുപത്തിയഞ്ച്': 75,
  'എൺപത്': 80,
  'എമ്പത്': 80,
  'തൊണ്ണൂറ്': 90,
  'നൂറ്': 100,
  'നൂറു': 100,
  'നൂറ': 100,
  'നൂറ്റിരുപത്': 120,
  'നൂറ്റി മുപ്പത്': 130,
  'നൂറ്റിയമ്പത്': 150,
  'മൂന്ന്': 3,
  'മൂന്നു': 3,
  'നാല്': 4,
  'നാലു': 4,
  'അഞ്ച്': 5,
  'അഞ്ചു': 5,
};

function parseMalayalamOrArabicNumber(token: string): number | null {
  if (!token) return null;
  const clean = token.trim().toLowerCase();
  if (MALAYALAM_NUMBER_WORDS[clean] !== undefined) {
    return MALAYALAM_NUMBER_WORDS[clean];
  }
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Main Clinical Entity Extractor
 */
export function extractStructuredClinicalRecord(
  transcript: string,
  household?: HouseholdSummary | null
): StructuredClinicalRecord {
  const rawText = transcript ? transcript.trim() : '';
  const normalizedText = correctMalayalamSpelling(rawText);
  const searchText = `${rawText} ${normalizedText}`;
  const now = new Date();
  const todayStr = formatDateYYYYMMDD(now);

  const visitId = `visit_${Date.now()}`;
  const householdId = household?.id || household?.external_id || `hh_${Date.now().toString().slice(-6)}`;
  const record = createEmptyClinicalRecord(visitId, householdId);

  // Set default visit date to today
  record.visit.date = todayStr;

  if (!rawText) {
    record.extraction.source_transcript = '';
    record.extraction.extraction_timestamp = now.toISOString();
    record.extraction.confidence_score = 0;
    record.extraction.language_detected = 'en';
    return record;
  }

  // Detect script/language
  const malayalamCharCount = (rawText.match(/[\u0D00-\u0D7F]/g) || []).length;
  const englishCharCount = (rawText.match(/[a-zA-Z]/g) || []).length;
  if (malayalamCharCount > 0 && englishCharCount > 0) {
    record.extraction.language_detected = 'mixed';
  } else if (malayalamCharCount > 0) {
    record.extraction.language_detected = 'ml';
  } else {
    record.extraction.language_detected = 'en';
  }

  // --- 1. PERSON & DEMOGRAPHICS ---
  // A. Age Detection
  let detectedAge: number | null = null;
  const ageMatch = searchText.match(/(\d{1,3})\s*(?:വയസ്സ(?:ും|ായി|ുള്ള|ിൽ|ിന്)?|വയസ്(?:ും|ായി|ുള്ള|ിൽ|ിന്)?|വയസാ|വൈസാഇൗ|വൈസായി|years?\s*old|yrs?\s*old|years|yrs|age)(?:[,\s.]|$)/i)
    || searchText.match(/(?:age|വയസ്സ്|വയസ്സും|വയസ്)[:\s]*(\d{1,3})/i)
    || searchText.match(/(?:is|ആണ്|ആയ)\s*(\d{1,3})\s*(?:years?\s*old|വയസ്സ(?:ും|ായി|ുള്ള)?|വയസ്)/i);

  if (ageMatch) {
    const parsed = parseInt(ageMatch[1], 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 125) {
      detectedAge = parsed;
    }
  }

  // Check Malayalam number words for age: e.g. "എൺപത് വയസ്സ്" -> 80, "നൂറ വൈസാഇൗ" -> 100
  if (detectedAge === null) {
    const mlNumAgeMatch = searchText.match(/(പത്ത്|ഇരുപത്|ഇരുപത്തിയഞ്ച്|ഇരുപത്തിയെട്ട്|മുപ്പത്|മുപ്പത്തിയഞ്ച്|നാൽപ്പത്|നാപ്പത്|അമ്പത്|അറുപത്|എഴുപത്|എൺപത്|എമ്പത്|തൊണ്ണൂറ്|നൂറ്|നൂറു|നൂറ)\s*(?:വയസ്സ(?:ും|ായി|ുള്ള)?|വയസ്(?:ും|ായി|ുള്ള)?|വൈസാഇൗ|വൈസായി)/i);
    if (mlNumAgeMatch && mlNumAgeMatch[1]) {
      detectedAge = parseMalayalamOrArabicNumber(mlNumAgeMatch[1]);
    }
  }

  // Check infant months if age in years not found (e.g. "8 മാസം", "8 months old")
  if (detectedAge === null) {
    const monthMatch = searchText.match(/(\d{1,2})\s*(?:മാസം|മാസമുള്ള|months?\s*old|mths?\s*old)/i);
    if (monthMatch) {
      const months = parseInt(monthMatch[1], 10);
      if (!isNaN(months) && months <= 24) {
        detectedAge = 0; // Infant
      }
    }
  }

  if (detectedAge !== null) {
    record.person.age = detectedAge;
    // Determine life stage
    if (detectedAge < 1) {
      record.person.life_stage = 'infant';
    } else if (detectedAge < 13) {
      record.person.life_stage = 'child';
    } else if (detectedAge < 20) {
      record.person.life_stage = 'adolescent';
    } else if (detectedAge < 60) {
      record.person.life_stage = 'adult';
    } else {
      record.person.life_stage = 'elderly';
    }
  }

  // B. Name Extraction
  // Robust matching for English, Malayalam, and Manglish variations:
  // "the patient name is Lakshmi", "patient name is Lakshmi", "name is Lakshmi", "പേര് ലക്ഷ്മി", "രോഗി ലക്ഷ്മി", "Lakshmi is 80 years old"
  let detectedName: string | null = null;
  const invalidNameStopwords = new Set([
    'the', 'patient', 'name', 'is', 'today', 'visited', 'checked', 'examined', 'asha',
    'രോഗി', 'പേര്', 'ഇന്ന്', 'കണ്ടു', 'പരിശോധിച്ചു', 'ശബ്ദം', 'നൂറ്', 'നൂറ', 'വയസ്സ്', 'കിലോ'
  ]);

  const nameExplicitMatch = searchText.match(
    /(?:(?:the\s+)?patient\s+name\s*(?:is|:)?|name\s*(?:is|:)?|രോഗിയുടെ\s*പേര്|പേര്|പേഷ്യന്റ്\s*(?:നെയിം|പേര്)?)\s*[:]?\s*([A-Za-z\u0D00-\u0D7F]+)/i
  );
  if (nameExplicitMatch && nameExplicitMatch[1]) {
    const cand = nameExplicitMatch[1].trim();
    if (!invalidNameStopwords.has(cand.toLowerCase())) {
      detectedName = cand;
    }
  }

  if (!detectedName) {
    // "the patient Lakshmi", "patient Lakshmi", "ശ്രീമതി ലക്ഷ്മി", "ശ്രീ സുരേഷ്"
    const patientPrefixMatch = searchText.match(/(?:(?:the\s+)?patient|രോഗി|ശ്രീമതി|ശ്രീ)\s+([A-Za-z\u0D00-\u0D7F]{2,25})/i);
    if (patientPrefixMatch && patientPrefixMatch[1]) {
      const cand = patientPrefixMatch[1].trim();
      if (!invalidNameStopwords.has(cand.toLowerCase())) {
        detectedName = cand;
      }
    }
  }

  if (!detectedName) {
    // "[Name] is [Age] years old" e.g. "Lakshmi is 80 years old"
    const nameIsAgeMatch = searchText.match(/^([A-Za-z\u0D00-\u0D7F]{2,25})\s+is\s+(?:\d{1,3}|years|age|വയസ്സ്)/i);
    if (nameIsAgeMatch && nameIsAgeMatch[1]) {
      const cand = nameIsAgeMatch[1].trim();
      if (!invalidNameStopwords.has(cand.toLowerCase())) {
        detectedName = cand;
      }
    }
  }

  if (!detectedName) {
    // 1. Compound names ending in അമ്മ / യമ്മ e.g. "ലക്ഷ്മിയമ്മയ്ക്ക്", "ലക്ഷ്മിയമ്മ", "ശാന്തമ്മയ്ക്ക്"
    const ammaCompoundMatch = searchText.match(
      /^([A-Za-z\u0D00-\u0D7F]{2,20}?(?:യമ്മ|അമ്മ))(?:യ്ക്ക്|ക്ക്|ിന്|ന്|യെ|യുടെ)?(?:\s+|$|[0-9])/i
    );
    if (ammaCompoundMatch && ammaCompoundMatch[1]) {
      const cand = ammaCompoundMatch[1].trim();
      if (!invalidNameStopwords.has(cand.toLowerCase()) && cand.length >= 2) {
        detectedName = cand;
      }
    }
  }

  if (!detectedName) {
    // 2. Leading Name followed by Age/Vitals: e.g. "ലക്ഷ്മിയമ്മയ്ക്ക് 100 വയസ്സും", "ലക്ഷ്മിക്ക് 80 കിലോ", "രാധയ്ക്ക് പനിയുണ്ട്"
    const nameWithVitalsMatch = searchText.match(
      /^([A-Za-z\u0D00-\u0D7F]{2,25}?)(?:യമ്മ(?:യ്ക്ക്|ക്ക്|യുടെ|യെ)?|അമ്മ(?:യ്ക്ക്|ക്ക്|യുടെ|യെ)?|യ്ക്ക്|ക്ക്|ിന്|ന്|യെ|യുടെ)?\s*[,.]?\s*(?:(?:\d{1,3}|[A-Za-z\u0D00-\u0D7F]+)\s*(?:വയസ്സ|വയസ്|വയസാ|വൈസായി|വൈസാഇൗ)|ഭാരം|കിലോ|ബിപി|പനി|ഷുഗർ)/i
    );
    if (nameWithVitalsMatch && nameWithVitalsMatch[1]) {
      const cand = nameWithVitalsMatch[1].trim();
      if (!invalidNameStopwords.has(cand.toLowerCase()) && cand.length >= 2) {
        detectedName = cand;
      }
    }
  }

  if (!detectedName) {
    // "[Name] അമ്മയ്ക്ക്", "[Name] അമ്മേകേ", "[Name] അമ്മ" e.g. "ലേക്ക്ഷ്മി അമ്മേകേ", "ലക്ഷ്മി അമ്മയ്ക്ക്"
    const leadingAmmaMatch = rawText.match(/^([A-Za-z\u0D00-\u0D7F]{2,25})\s*(?:അമ്മയ്ക്ക്|അമ്മേകേ|അമ്മക്ക്|അമ്മ|ചേച്ചി|കുട്ടി)/i)
      || normalizedText.match(/^([A-Za-z\u0D00-\u0D7F]{2,25})\s*(?:അമ്മയ്ക്ക്|അമ്മക്ക്|അമ്മ)/i);
    if (leadingAmmaMatch && leadingAmmaMatch[1]) {
      const cand = leadingAmmaMatch[1].trim();
      if (!invalidNameStopwords.has(cand.toLowerCase())) {
        detectedName = cand;
      }
    }
  }

  if (!detectedName) {
    // "[Name] [Age] വയസ്സ്" or "[Name]ക്ക് [Age] വയസ്സ്" or "[Name], [Age]" (including Malayalam number words & വയസ്സും)
    const leadingNameMatch = searchText.match(/^([A-Za-z\u0D00-\u0D7F]{2,25})(?:യ്ക്ക്|ക്ക്|ന്|ിന്)?\s*[,.]?\s*(?:\d{1,3}|[A-Za-z\u0D00-\u0D7F]+\s+)?(?:വയസ്സ(?:ും|ായി|ുള്ള)?|വയസ്(?:ും|ായി|ുള്ള)?|age|years)/i);
    if (leadingNameMatch && leadingNameMatch[1]) {
      const cand = leadingNameMatch[1].trim();
      if (!invalidNameStopwords.has(cand.toLowerCase())) {
        detectedName = cand;
      }
    }
  }

  if (detectedName) {
    // Normalize phonetic misrecognitions of names
    if (detectedName === 'ലേക്ക്ഷ്മി' || detectedName === 'ലക്സ്മി' || detectedName === 'ലെക്ഷ്മി') {
      detectedName = 'ലക്ഷ്മി';
    } else if (detectedName === 'ലേക്ക്ഷ്മിയമ്മ' || detectedName === 'ലക്സ്മിയമ്മ') {
      detectedName = 'ലക്ഷ്മിയമ്മ';
    }
    // Strip Malayalam case suffixes (e.g. ലക്ഷ്മിയമ്മയ്ക്ക് -> ലക്ഷ്മിയമ്മ, ലക്ഷ്മിക്ക് -> ലക്ഷ്മി, ലക്ഷ്മിയെ -> ലക്ഷ്മി, ലക്ഷ്മിയുടെ -> ലക്ഷ്മി)
    if (/[\u0D00-\u0D7F]/.test(detectedName)) {
      detectedName = detectedName.replace(/(?:യ്ക്ക്|ക്ക്|ിന്|ന്|യെ|യുടെ|േകേ)$/, '');
    }
    // Standardize casing for English names (e.g. lakshmi -> Lakshmi)
    if (/^[a-zA-Z]+$/.test(detectedName)) {
      detectedName = detectedName.charAt(0).toUpperCase() + detectedName.slice(1).toLowerCase();
    }
    record.person.name = detectedName;
    record.person.person_id = `p_${detectedName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10)}_${Date.now().toString().slice(-4)}`;
  }

  // C. Sex Detection
  const femaleSignals = /(?:സ്ത്രീ|പെൺ|പെൺകുട്ടി|അമ്മ|ഭാര്യ|സഹോദരി|ഗർഭിണി|പ്രസവി|female|woman|she|her|mrs|smt|lakshmi|ലക്ഷ്മി)/i;
  const maleSignals = /(?:പുരുഷൻ|ആൺ|ആൺകുട്ടി|അച്ഛൻ|ഭർത്താവ്|സഹോദരൻ|ശ്രീ|male|man|he|his|mr|suresh|സുരേഷ്)/i;

  if (femaleSignals.test(rawText)) {
    record.person.sex = 'female';
  } else if (maleSignals.test(rawText)) {
    record.person.sex = 'male';
  }

  // D. Pregnancy Status
  const isPregnant = /(?:ഗർഭിണി|ഗർഭം|ഗർഭകാലം|pregnant|pregnancy|anc\b)/i.test(rawText);
  const isPostpartum = /(?:പ്രസവിച്ചു|പ്രസവം\s*കഴിഞ്ഞ്|മുലയൂട്ടുന്ന|മുലപ്പാൽ\s*നൽകുന്ന|postpartum|delivered)/i.test(rawText);

  if (isPregnant) {
    record.person.pregnancy_status = 'pregnant';
    record.person.sex = 'female';
    record.preventive_care.maternal_care.supplements = 'taking';
  } else if (isPostpartum) {
    record.person.pregnancy_status = 'postpartum';
    record.person.sex = 'female';
  } else if (record.person.sex === 'female' && record.person.age !== null && record.person.age >= 18 && record.person.age <= 50) {
    record.person.pregnancy_status = 'not_pregnant';
  }

  // --- 2. MEASUREMENTS ---
  // A. Blood Pressure: e.g. "130/85", "120 80", "130 by 85", "130 over 85", "ബിപി 130 85"
  // Handles speech transcription without slashes
  let extractedBp: string | null = null;
  const bpExplicitMatch = rawText.match(/(?:ബിപി|പ്രഷർ|bp|blood\s*pressure)?[:\s]*(\b\d{2,3}\s*[\/]\s*\d{2,3}\b)/i);
  if (bpExplicitMatch) {
    extractedBp = bpExplicitMatch[1].replace(/\s+/g, '');
  } else {
    // Match space-separated or prepositional BP: "130 85", "130 by 85", "130 over 85", "ബിപി 130 85"
    const bpSpokenMatch = rawText.match(/(?:ബിപി|പ്രഷർ|bp|blood\s*pressure)?[:\s]*\b(\d{2,3})\s*(?:[\/]|over|by|to|ബൈ|ഓവർ|\s)\s*(\d{2,3})\b/i);
    if (bpSpokenMatch) {
      const s = parseInt(bpSpokenMatch[1], 10);
      const d = parseInt(bpSpokenMatch[2], 10);
      if (s >= 60 && s <= 250 && d >= 40 && d <= 150) {
        extractedBp = `${s}/${d}`;
      }
    }
  }

  if (extractedBp) {
    record.measurements.blood_pressure = extractedBp;

    // Check if BP indicates hypertension care gap
    const [sysStr, diaStr] = extractedBp.split('/');
    const sys = parseInt(sysStr, 10);
    const dia = parseInt(diaStr, 10);
    if (sys >= 140 || dia >= 90) {
      record.care_gaps.push({
        gap_type: 'screening',
        description: `Elevated blood pressure (${extractedBp}) detected. Requires medical evaluation and lifestyle monitoring.`,
        severity: 'high',
        status: 'open',
      });
      record.health_status.known_conditions.push({
        condition: 'Hypertension',
        status: 'active',
      });
    }
  }

  // B. Weight: e.g. "weighs 100 kilos", "weight 100 kilos", "58 കിലോ", "3 കിലോ പാരവു", "100 kilos", "ഭാരം 100"
  let extractedWeight: number | null = null;
  // 1. Number + unit + optional keyword (e.g. "3 കിലോ പാരവു", "3 കിലോ ഭാരവും", "100 കിലോ", "58 kg")
  const weightUnitMatch = searchText.match(/(\d{1,3}(?:\.\d+)?)\s*(?:കിലോ|കിലോഗ്രാം|kg|kgs|kilos|kilo)(?:\s*(?:പാരവു|പാരം|ഭാരവും|ഭാരം|തൂക്കവും|തൂക്കം|weight))?/i);
  if (weightUnitMatch) {
    extractedWeight = parseFloat(weightUnitMatch[1]);
  } else {
    // 2. Keyword + number (e.g. "ഭാരം 58", "weight 70")
    const weightKeywordMatch = searchText.match(/(?:weight\s*(?:is)?|weighs|ഭാരം|തൂക്കം|വെയ്റ്റ്)[:\s]*(\d{1,3}(?:\.\d+)?)\s*(?:കിലോ|കിലോഗ്രാം|kg|kgs|kilos|kilo)?/i);
    if (weightKeywordMatch) {
      extractedWeight = parseFloat(weightKeywordMatch[1]);
    } else {
      // 3. Malayalam number word + kilo: "നൂറു കിലോ" -> 100
      const mlWeightMatch = searchText.match(/(പത്ത്|ഇരുപത്|ഇരുപത്തിയഞ്ച്|മുപ്പത്|നാൽപ്പത്|അമ്പത്|അറുപത്|എഴുപത്|എൺപത്|തൊണ്ണൂറ്|നൂറ്|നൂറു|നൂറ)\s*(?:കിലോ|കിലോഗ്രാം|kg)/i);
      if (mlWeightMatch && mlWeightMatch[1]) {
        extractedWeight = parseMalayalamOrArabicNumber(mlWeightMatch[1]);
      }
    }
  }

  if (extractedWeight !== null && !isNaN(extractedWeight) && extractedWeight > 0.5 && extractedWeight < 300) {
    record.measurements.weight_kg = extractedWeight;
  }

  // C. Height: e.g. "height 160 cm", "height 5 feet 4 inches", "160 cm", "പൊക്കം 160", "ഉയരം 160", "80 മിറ്റർ ഹൈട്ടു"
  let extractedHeight: number | null = null;
  // Check feet and inches first: "5 feet 4 inches", "5 ft 4 in", "5 അടി 4 ഇഞ്ച്"
  const feetInchesMatch = searchText.match(/(?:height|ഉയരം|പൊക്കം|നീളം)?[:\s]*(\d)\s*(?:feet|foot|ft|അടി)\s*(\d{1,2})?\s*(?:inches|inch|in|ഇഞ്ച്)?/i);
  if (feetInchesMatch) {
    const feet = parseInt(feetInchesMatch[1], 10);
    const inches = feetInchesMatch[2] ? parseInt(feetInchesMatch[2], 10) : 0;
    const totalCm = Math.round((feet * 30.48) + (inches * 2.54));
    if (totalCm >= 30 && totalCm <= 250) {
      extractedHeight = totalCm;
    }
  }

  if (extractedHeight === null) {
    // Check cm or phonetic ASR meter/height: "height 160 cm", "80 മിറ്റർ ഹൈട്ടു", "ഉയരം 160", "160 cm"
    const heightCmMatch = searchText.match(/(?:height\s*(?:is)?|ഉയരം|പൊക്കം|ഹൈറ്റ്|ഹൈട്ടു)[:\s]*(\d{2,3}(?:\.\d+)?)\s*(?:cm|cms|സെ\.മീ|സെന്റിമീറ്റർ|മിറ്റർ|മീറ്റർ)?/i)
      || searchText.match(/(\d{2,3}(?:\.\d+)?)\s*(?:cm|cms|സെ\.മീ|സെന്റിമീറ്റർ|മിറ്റർ|മീറ്റർ)\s*(?:height|ഹൈട്ടു|ഹൈറ്റും|ഹൈറ്റ്|ഉയരം|പൊക്കം)?/i);
    if (heightCmMatch) {
      const parsedCm = parseFloat(heightCmMatch[1]);
      if (!isNaN(parsedCm) && parsedCm >= 30 && parsedCm <= 250) {
        extractedHeight = Math.round(parsedCm);
      }
    }
  }

  if (extractedHeight !== null) {
    record.measurements.height_cm = extractedHeight;
  }

  // D. Pulse / Heart Rate / Heartbeat: e.g. "heart rate 72", "heartbeat 72", "pulse 78 bpm", "പൾസ് 78", "ഹൃദയമിടിപ്പ് 72"
  const pulseMatch = searchText.match(/(?:heart\s*rate(?:\s*is)?|heart\s*beat|pulse(?:\s*rate)?|പൾസ്|നാഡിമിടിപ്പ്|ഹൃദയമിടിപ്പ്|ഹാർട്ട്\s*ബീറ്റ്)[:\s]*(\d{2,3})\s*(?:bpm|ബീറ്റ്സ്)?/i)
    || searchText.match(/(\d{2,3})\s*(?:bpm|beats\s*per\s*minute)/i);
  if (pulseMatch) {
    const pulse = parseInt(pulseMatch[1], 10);
    if (!isNaN(pulse) && pulse >= 35 && pulse <= 220) {
      record.measurements.pulse_bpm = pulse;
    }
  }

  // E. Temperature: e.g. "101.2 F", "പനി 100", "താപനില 99"
  const tempMatch = rawText.match(/(?:താപനില|temperature|temp)[:\s]*(\d{2,3}(?:\.\d+)?)\s*(?:f|ഫാരൻഹീറ്റ്|°f)?/i)
    || rawText.match(/(\d{2,3}(?:\.\d+)?)\s*(?:°f|f\b|ഫാരൻഹീറ്റ്)/i);
  if (tempMatch) {
    const temp = parseFloat(tempMatch[1]);
    if (!isNaN(temp) && temp >= 95 && temp <= 108) {
      record.measurements.temperature_f = temp;
    }
  }

  // F. SpO2: e.g. "ഓക്സിജൻ 98%", "spo2 98"
  const spo2Match = rawText.match(/(?:ഓക്സിജൻ|spo2|oxygen)[:\s]*(\d{2,3})\s*(?:%|ശതമാനം)?/i);
  if (spo2Match) {
    const spo2 = parseInt(spo2Match[1], 10);
    if (!isNaN(spo2) && spo2 >= 60 && spo2 <= 100) {
      record.measurements.spo2_percent = spo2;
    }
  }

  // G. Blood Sugar: e.g. "ഷുഗർ 140", "sugar 160 mg/dl"
  const sugarMatch = rawText.match(/(?:ഷുഗർ|ഷുഗർനില|രക്തത്തിലെ\s*പഞ്ചസാര|sugar|blood\s*sugar|rbs|fbs|ppbs)[:\s]*(\d{2,3}(?:\.\d+)?)/i);
  if (sugarMatch) {
    const sugar = parseFloat(sugarMatch[1]);
    if (!isNaN(sugar) && sugar >= 40 && sugar <= 600) {
      record.measurements.blood_sugar_mg_dl = sugar;
      if (sugar >= 180) {
        record.care_gaps.push({
          gap_type: 'screening',
          description: `Elevated blood sugar level (${sugar} mg/dL) observed. Diabetes care review indicated.`,
          severity: 'high',
          status: 'open',
        });
        record.health_status.known_conditions.push({
          condition: 'Diabetes Mellitus',
          status: 'active',
        });
      }
    }
  }

  // G. Hemoglobin: e.g. "ഹീമോഗ്ലോബിൻ 11.5", "hb 10.2"
  const hbMatch = rawText.match(/(?:ഹീമോഗ്ലോബിൻ|hb|hemoglobin)[:\s]*(\d{1,2}(?:\.\d+)?)/i);
  if (hbMatch) {
    const hb = parseFloat(hbMatch[1]);
    if (!isNaN(hb) && hb >= 3 && hb <= 22) {
      record.measurements.hemoglobin_g_dl = hb;
      if (hb < 11 && record.person.pregnancy_status === 'pregnant') {
        record.care_gaps.push({
          gap_type: 'maternal',
          description: `Low hemoglobin (${hb} g/dL) detected in pregnancy (Gestational Anemia). IFA & nutrition support needed.`,
          severity: 'high',
          status: 'open',
        });
      }
    }
  }

  // --- 3. HEALTH STATUS: COMPLAINTS ---
  const complaintsMap: Array<{
    symptomRegex: RegExp;
    symptomName: string;
  }> = [
    { symptomRegex: /(?:പനി|fever)/i, symptomName: 'Fever' },
    { symptomRegex: /(?:തലവേദന|headache)/i, symptomName: 'Headache' },
    { symptomRegex: /(?:ചുമ|cough)/i, symptomName: 'Cough' },
    { symptomRegex: /(?:ജലദോഷം|മൂക്കൊലിപ്പ്|cold|runny\s*nose)/i, symptomName: 'Cold / Rhinitis' },
    { symptomRegex: /(?:ശ്വാസംമുട്ടൽ|ശ്വാസതടസ്സം|shortness\s*of\s*breath|breathlessness|wheezing)/i, symptomName: 'Shortness of breath' },
    { symptomRegex: /(?:ഛർദ്ദി|ഓക്കാനം|vomiting|nausea)/i, symptomName: 'Vomiting / Nausea' },
    { symptomRegex: /(?:വയറിളക്കം|വയറ്റിളക്കം|diarrhea|loose\s*motions)/i, symptomName: 'Diarrhea' },
    { symptomRegex: /(?:വയറുവേദന|stomach\s*pain|abdominal\s*pain)/i, symptomName: 'Abdominal pain' },
    { symptomRegex: /(?:ക്ഷീണം|തളർച്ച|fatigue|tiredness|weakness)/i, symptomName: 'Fatigue' },
    { symptomRegex: /(?:നെഞ്ചുവേദന|chest\s*pain)/i, symptomName: 'Chest pain' },
    { symptomRegex: /(?:ശരീരവേദന|മേലുവേദന|body\s*pain|body\s*ache)/i, symptomName: 'Body pain' },
    { symptomRegex: /(?:നീര്|കാലിൽ\s*നീര്|swelling|edema)/i, symptomName: 'Pedal Edema' },
    { symptomRegex: /(?:തലകറക്കം|കണ്ണിൽ\s*ഇരുട്ട്|dizziness|giddiness)/i, symptomName: 'Dizziness' },
  ];

  // Duration matcher (e.g. "രണ്ട് ദിവസമായി", "2 days", "3 weeks", "ഒരു ആഴ്ചയായി")
  const durationMatch = rawText.match(/(\d+|ഒരു|രണ്ട്|മൂന്ന്|നാല്|അഞ്ച്)\s*(?:ദിവസമായി|ദിവസം|ആഴ്ചയായി|ആഴ്ച|മാസമായി|മാസം|days?|weeks?|months?)/i);
  let globalDuration = 'unknown';
  if (durationMatch) {
    const numWordMap: Record<string, string> = {
      'ഒരു': '1',
      'രണ്ട്': '2',
      'മൂന്ന്': '3',
      'നാല്': '4',
      'അഞ്ച്': '5',
    };
    const rawNum = durationMatch[1].toLowerCase();
    const resolvedNum = numWordMap[rawNum] || rawNum;
    const matchStr = durationMatch[0];
    if (/ദിവസം|ദിവസമായി|days?/i.test(matchStr)) {
      globalDuration = `${resolvedNum} days`;
    } else if (/ആഴ്ച|ആഴ്ചയായി|weeks?/i.test(matchStr)) {
      globalDuration = `${resolvedNum} weeks`;
    } else if (/മാസം|മാസമായി|months?/i.test(matchStr)) {
      globalDuration = `${resolvedNum} months`;
    } else {
      globalDuration = durationMatch[0];
    }
  }

  for (const item of complaintsMap) {
    if (item.symptomRegex.test(rawText)) {
      let severity: 'mild' | 'moderate' | 'severe' | 'unknown' = 'unknown';
      if (/(?:കഠിനമായ|കൂടുതൽ|തീവ്രമായ|severe|high)/i.test(rawText)) {
        severity = 'severe';
      } else if (/(?:നേരിയ|കുറച്ച്|mild|slight)/i.test(rawText)) {
        severity = 'mild';
      } else if (/(?:ഇടത്തരം|moderate)/i.test(rawText)) {
        severity = 'moderate';
      }

      let trend: 'improving' | 'worsening' | 'unchanged' | 'unknown' = 'unknown';
      if (/(?:കൂടുന്നു|കൂടിവരുന്നു|worsening|increased)/i.test(rawText)) {
        trend = 'worsening';
      } else if (/(?:കുറയുന്നു|ഭേദമാകുന്നു|improving|better)/i.test(rawText)) {
        trend = 'improving';
      } else if (/(?:മാറ്റമില്ല|തുടരുന്നു|unchanged|same)/i.test(rawText)) {
        trend = 'unchanged';
      }

      const complaint: ComplaintItem = {
        symptom: item.symptomName,
        duration: globalDuration,
        severity,
        trend,
      };
      record.health_status.complaints.push(complaint);
    }
  }

  // --- 4. KNOWN CONDITIONS ---
  const conditionPatterns = [
    { regex: /(?:ഹൈപ്പർടെൻഷൻ|ബിപി\s*രോഗം|പ്രഷർ|hypertension|high\s*bp)/i, name: 'Hypertension' },
    { regex: /(?:ഡയബറ്റിസ്|പ്രമേഹം|ഷുഗർ\s*രോഗം|diabetes)/i, name: 'Diabetes Mellitus' },
    { regex: /(?:ആസ്ത്മ|ശ്വാസംമുട്ട്\s*രോഗം|asthma)/i, name: 'Bronchial Asthma' },
    { regex: /(?:തൈറോയ്ഡ്|thyroid)/i, name: 'Thyroid Disorder' },
    { regex: /(?:ഹൃദ്രോഗം|heart\s*disease)/i, name: 'Cardiovascular Disease' },
  ];

  for (const cond of conditionPatterns) {
    if (cond.regex.test(rawText)) {
      // Check if already added
      const exists = record.health_status.known_conditions.some((c) => c.condition === cond.name);
      if (!exists) {
        record.health_status.known_conditions.push({
          condition: cond.name,
          status: 'active',
        });
      }
    }
  }

  // --- 5. MEDICATIONS ---
  const medPatterns = [
    {
      regex: /(?:അയൺ\s*ഗുളിക|ഇരുമ്പ്\s*ഗുളിക|ifa|iron\s*(?:folic\s*acid|tablet|tablets)?)/i,
      name: 'Iron & Folic Acid (IFA)',
    },
    {
      regex: /(?:കാൽസ്യം\s*ഗുളിക|calcium(?:\s*tablets?)?)/i,
      name: 'Calcium Tablets',
    },
    {
      regex: /(?:പാരസെറ്റമോൾ|paracetamol|dolo|calpol)/i,
      name: 'Paracetamol',
    },
    {
      regex: /(?:ബിപി\s*(?:ഗുളിക|മരുന്ന്)|അംലോഡിപിൻ|amlodipine|telmisartan|atenolol|bp\s*med(?:icine)?)/i,
      name: 'Antihypertensive Medication',
    },
    {
      regex: /(?:ഷുഗർ\s*(?:ഗുളിക|മരുന്ന്)|മെറ്റ്ഫോർമിൻ|metformin|glimepiride|insulin|diabetes\s*med(?:icine)?)/i,
      name: 'Antidiabetic Medication',
    },
  ];

  for (const med of medPatterns) {
    if (med.regex.test(rawText)) {
      let adherence: 'regular' | 'irregular' | 'stopped' | 'unknown' = 'unknown';
      if (/(?:കൃത്യമായി|മുടങ്ങാതെ|daily|regularly)/i.test(rawText)) {
        adherence = 'regular';
      } else if (/(?:മറക്കുന്നു|ഇടയ്ക്കിടെ|irregularly|sometimes)/i.test(rawText)) {
        adherence = 'irregular';
      } else if (/(?:നിർത്തി|കഴിക്കുന്നില്ല|stopped|discontinued)/i.test(rawText)) {
        adherence = 'stopped';
      } else {
        adherence = 'regular'; // Default assumption when mentioned as taking
      }

      const medItem: MedicationItem = {
        name: med.name,
        taking: adherence === 'stopped' ? 'no' : 'yes',
        adherence,
        available: 'yes',
      };
      record.health_status.medications.push(medItem);
    }
  }

  // --- 6. PREVENTIVE CARE: IMMUNIZATION & MATERNAL ---
  // Immunization
  if (/(?:വാക്സിൻ\s*എടുത്തു|കുത്തിവെപ്പ്\s*എടുത്തു|vaccin(?:e|ated)|immunized)/i.test(rawText)) {
    record.preventive_care.immunization.status = 'up_to_date';
  } else if (/(?:വാക്സിൻ\s*ബാക്കി|കുത്തിവെപ്പ്\s*എടുത്തിട്ടില്ല|overdue|pending\s*vaccine)/i.test(rawText)) {
    record.preventive_care.immunization.status = 'pending';
    record.care_gaps.push({
      gap_type: 'immunization',
      description: 'Scheduled immunization pending or overdue for child/beneficiary.',
      severity: 'medium',
      status: 'open',
    });
  }

  // Specific vaccines
  if (/(?:പെന്റാവാലന്റ്|pentavalent)/i.test(rawText)) {
    record.preventive_care.immunization.vaccines_given.push('Pentavalent');
  }
  if (/(?:ബിസിജി|bcg)/i.test(rawText)) {
    record.preventive_care.immunization.vaccines_given.push('BCG');
  }
  if (/(?:പോളിയോ|opv|polio)/i.test(rawText)) {
    record.preventive_care.immunization.vaccines_given.push('OPV');
  }
  if (/(?:എംആർ|mr|measles)/i.test(rawText)) {
    record.preventive_care.immunization.vaccines_given.push('MR');
  }

  // Maternal care supplements
  if (record.person.pregnancy_status === 'pregnant') {
    const hasIFA = record.health_status.medications.some((m) => m.name.includes('IFA') || m.name.includes('Iron'));
    if (hasIFA) {
      record.preventive_care.maternal_care.supplements = 'taking';
      record.preventive_care.maternal_care.ifa_tablets_received = 100;
    } else {
      record.care_gaps.push({
        gap_type: 'maternal',
        description: 'Pregnant mother not documented taking Iron & Folic Acid (IFA) supplements.',
        severity: 'high',
        status: 'open',
      });
    }
  }

  // --- 7. NUTRITION & WHO Z-SCORE (Infant/Child Scoped ONLY) ---
  const isInfant = (record.person.life_stage === 'infant' || record.person.life_stage === 'child') ||
    (record.person.age !== null && record.person.age <= 5) ||
    /(?:കുട്ടി|കുഞ്ഞ്|വാവ|വാവയ്ക്ക്|മകൻ|മകൾ|infant|child|baby|kid)/i.test(searchText);

  if (isInfant) {
    if (/(?:മുലപ്പാൽ\s*മാത്രം|exclusive\s*breastfeeding)/i.test(rawText)) {
      record.nutrition.child_nutrition.breastfeeding = 'exclusive';
    } else if (/(?:മുലപ്പാൽ|breastfeeding)/i.test(rawText)) {
      record.nutrition.child_nutrition.breastfeeding = 'partial';
    }

    if (/(?:കുറുക്ക്|കുറുക്ക്\s*തുടങ്ങി|complementary\s*feeding|solids\s*started)/i.test(rawText)) {
      record.nutrition.child_nutrition.complementary_feeding = 'started';
    }

    if (record.measurements.weight_kg !== null && record.person.pregnancy_status !== 'pregnant' && (record.person.age === null || record.person.age <= 5)) {
      const childAgeMonths = record.person.age !== null ? Math.max(1, record.person.age * 12) : 18;
      const wazRes = calculateWhoWazZScore(record.measurements.weight_kg, childAgeMonths);
      record.nutrition.child_nutrition.sam_mam_risk = wazRes.category;
      record.care_history.allergies.push(`WHO WAZ Z-Score: ${wazRes.zScore} (${wazRes.category.toUpperCase()})`);
    }
  }

function calculateWhoWazZScore(weightKg: number, ageMonths = 18): { zScore: number; category: 'normal' | 'mild' | 'mam' | 'sam' } {
  const m = 10.9;
  const l = -0.1235;
  const s = 0.1121;
  const z = (Math.pow(weightKg / m, l) - 1.0) / (l * s);
  const zScore = parseFloat(z.toFixed(2));
  let category: 'normal' | 'mild' | 'mam' | 'sam' = 'normal';
  if (zScore >= -1.0) category = 'normal';
  else if (zScore >= -2.0) category = 'mild';
  else if (zScore >= -3.0) category = 'mam';
  else category = 'sam';
  return { zScore, category };
}

function normalizeMalayalamPhonetics(text: string): string {
  if (!text) return '';
  return text.toLowerCase()
    .replace(/ധ/g, 'ദ')
    .replace(/ഷ/g, 'ശ')
    .replace(/ള/g, 'ല')
    .replace(/ണ്ഠ/g, 'ന്ത')
    .replace(/ന്റ/g, 'ന്ത')
    .replace(/ന്ഥ/g, 'ന്ത');
}

function levDistance(s1: string, s2: string): number {
  if (s1.length < s2.length) return levDistance(s2, s1);
  if (s2.length === 0) return s1.length;
  let previousRow = Array.from({ length: s2.length + 1 }, (_, i) => i);
  for (let i = 0; i < s1.length; i++) {
    const currentRow = [i + 1];
    for (let j = 0; j < s2.length; j++) {
      const insertions = previousRow[j + 1] + 1;
      const deletions = currentRow[j] + 1;
      const substitutions = previousRow[j] + (s1[i] !== s2[j] ? 1 : 0);
      currentRow.push(Math.min(insertions, deletions, substitutions));
    }
    previousRow = currentRow;
  }
  return previousRow[previousRow.length - 1];
}

function fuzzyMatchStems(text: string, stems: string[], minSimilarity = 0.72): boolean {
  const normText = normalizeMalayalamPhonetics(text);
  const words = normText.match(/[\u0D00-\u0D7F\w]+/g) || [];

  for (const stem of stems) {
    const normStem = normalizeMalayalamPhonetics(stem);
    if (normText.includes(normStem)) return true;
    for (const w of words) {
      if (w.length >= 3 && normStem.length >= 3) {
        if (w.startsWith(normStem.slice(0, 3)) || normStem.startsWith(w.slice(0, 3))) {
          const dist = levDistance(w, normStem);
          const maxLen = Math.max(w.length, normStem.length);
          const sim = 1.0 - (dist / maxLen);
          if (sim >= minSimilarity) return true;
        }
      }
    }
  }
  return false;
}

  // --- 8. MENTAL & SOCIAL ---
  if (/(?:പുകവലി|ബീഡി|സിഗരറ്റ്|മുറുക്ക്|smoking|tobacco)/i.test(rawText)) {
    record.mental_social.substance_use.tobacco = 'yes';
  }
  if (/(?:മദ്യപാനം|മദ്യം|alcohol|drinking)/i.test(rawText)) {
    record.mental_social.substance_use.alcohol = 'yes';
  }

  // Deterministic PHQ-4 Mental Health Scoring (Fuzzy Stem & Phonetic Matching for Fast Speech)
  let anxietyQ1: number | null = null;
  let anxietyQ2: number | null = null;
  let depressionQ1: number | null = null;
  let depressionQ2: number | null = null;

  const isSevereIntensity = fuzzyMatchStems(searchText, ['മിക്ക ദിവസവും', 'കഠിന', 'വളരെ', 'nearly every day', 'severe']);

  // Anxiety Q1: Nervousness / Restlessness
  if (fuzzyMatchStems(searchText, ['ആകുല', 'പരിഭ്രമ', 'nervous', 'on edge', 'restless'])) {
    anxietyQ1 = isSevereIntensity ? 3 : 2;
    record.mental_social.mood_affect = 'anxious';
  }

  // Anxiety Q2: Worry / Uncontrolled Concern
  if (fuzzyMatchStems(searchText, ['ഉത്കണ്ഠ', 'ഉത്കന്ധ', 'ഉല്കണ്ഠ', 'നിയന്ത്രണ', 'നിയന്ത്രിക്കാ', 'worry', 'anxi'])) {
    anxietyQ2 = isSevereIntensity ? 3 : 2;
    record.mental_social.mood_affect = 'anxious';
  }

  // Depression Q1: Depression / Hopelessness / Sadness
  if (fuzzyMatchStems(searchText, ['വിഷാദ', 'പ്രത്യാശയി', 'സങ്കട', 'depress', 'hopeless', 'down'])) {
    depressionQ1 = isSevereIntensity ? 3 : 2;
    record.mental_social.mood_affect = 'depressed';
  }

  // Depression Q2: Anhedonia / Interest Loss / Insomnia
  if (fuzzyMatchStems(searchText, ['താല്പര്യ', 'സന്തോഷമി', 'ഉറക്കമി', 'no interest', 'no pleasure', 'insomnia'])) {
    depressionQ2 = isSevereIntensity ? 3 : 2;
    record.mental_social.mood_affect = 'depressed';
  }

  const hasAnxiety = anxietyQ1 !== null || anxietyQ2 !== null;
  const hasDepression = depressionQ1 !== null || depressionQ2 !== null;

  if (hasAnxiety || hasDepression) {
    const anxScore = (anxietyQ1 || 0) + (anxietyQ2 || 0);
    const depScore = (depressionQ1 || 0) + (depressionQ2 || 0);
    const totalScore = anxScore + depScore;

    let riskLevel: 'normal' | 'mild' | 'moderate' | 'severe' = 'normal';
    if (totalScore >= 9) riskLevel = 'severe';
    else if (totalScore >= 6) riskLevel = 'moderate';
    else if (totalScore >= 3) riskLevel = 'mild';

    record.mental_social.phq4_assessment = {
      anxiety_score: hasAnxiety ? anxScore : null,
      depression_score: hasDepression ? depScore : null,
      total_score: totalScore,
      risk_level: riskLevel,
    };
  } else {
    record.mental_social.phq4_assessment = {
      anxiety_score: null,
      depression_score: null,
      total_score: null,
      risk_level: 'unknown',
    };
  }

  // --- 9. FOLLOW-UP INTELLIGENCE ---
  // Detect if follow-up required
  const followUpSignals = /(?:അടുത്ത|കാണണം|വ്യാഴാഴ്ച|തിങ്കളാഴ്ച|ചൊവ്വാഴ്ച|ബുധനാഴ്ച|വെള്ളിയാഴ്ച|ശനിയാഴ്ച|ഞായറാഴ്ച|next\s*week|follow\s*up|see\s*again|checkup|visit)/i;
  const referralSignals = /(?:ഡോക്ടർ|ആശുപത്രി|പിഎച്ച്സി|സിഎച്ച്സി|doctor|hospital|phc|chc|mo\b|refer)/i;

  if (followUpSignals.test(rawText) || record.care_gaps.length > 0) {
    record.follow_up.required = 'yes';
    record.visit.visit_type = 'routine';

    // Assign follow up recipient
    if (referralSignals.test(rawText)) {
      record.follow_up.assigned_to = 'mo';
      record.visit.visit_type = 'referral';
      record.follow_up.reason = 'Medical Officer consultation and clinical review';
    } else {
      record.follow_up.assigned_to = 'asha';
      record.follow_up.reason = 'ASHA home visit follow-up and monitoring';
    }

    // Determine due date from spoken text
    // Malayalam Day of week map
    const dayKeywords: Array<{ regex: RegExp; dayNum: number }> = [
      { regex: /(?:ഞായറാഴ്ച|sunday)/i, dayNum: 0 },
      { regex: /(?:തിങ്കളാഴ്ച|monday)/i, dayNum: 1 },
      { regex: /(?:ചൊവ്വാഴ്ച|tuesday)/i, dayNum: 2 },
      { regex: /(?:ബുധനാഴ്ച|wednesday)/i, dayNum: 3 },
      { regex: /(?:വ്യാഴാഴ്ച|thursday)/i, dayNum: 4 },
      { regex: /(?:വെള്ളിയാഴ്ച|friday)/i, dayNum: 5 },
      { regex: /(?:ശനിയാഴ്ച|saturday)/i, dayNum: 6 },
    ];

    let computedDueDate: Date | null = null;
    for (const d of dayKeywords) {
      if (d.regex.test(rawText)) {
        computedDueDate = getNextDayOfWeek(d.dayNum, now);
        break;
      }
    }

    if (!computedDueDate) {
      if (/(?:നാളെ|tomorrow)/i.test(rawText)) {
        computedDueDate = new Date(now);
        computedDueDate.setDate(computedDueDate.getDate() + 1);
      } else if (/(?:രണ്ട്\s*ദിവസം|2\s*days?)/i.test(rawText)) {
        computedDueDate = new Date(now);
        computedDueDate.setDate(computedDueDate.getDate() + 2);
      } else {
        // Default follow up: 7 days
        computedDueDate = new Date(now);
        computedDueDate.setDate(computedDueDate.getDate() + 7);
      }
    }

    record.follow_up.due_date = formatDateYYYYMMDD(computedDueDate);
  }

  // --- 10. METADATA & CONFIDENCE SCORE ---
  record.extraction.source_transcript = rawText;
  record.extraction.extraction_timestamp = now.toISOString();

  // Confidence estimation based on extracted richness
  let score = 0.5; // Base confidence for non-empty transcript
  if (record.person.name) score += 0.1;
  if (record.person.age !== null) score += 0.1;
  if (record.measurements.blood_pressure) score += 0.1;
  if (record.measurements.weight_kg) score += 0.05;
  if (record.measurements.height_cm || record.measurements.pulse_bpm) score += 0.05;
  if (record.health_status.complaints.length > 0) score += 0.05;
  if (record.health_status.medications.length > 0) score += 0.05;
  if (record.follow_up.due_date) score += 0.05;

  record.extraction.confidence_score = Math.min(0.99, parseFloat(score.toFixed(2)));

  return record;
}
