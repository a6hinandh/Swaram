/**
 * Gemini Longitudinal Report Summarizer Service
 * Produces structured AI Clinical & Epidemiological Summaries across:
 * 1. CBAC Longitudinal NCD Reports
 * 2. Mental Health / PHQ-2 & GAD-2 Screening Timelines
 * 3. Environmental & Climate Risk Assessment Histories
 */

import { getCustomGeminiApiKey } from './geminiPrivacyService';
import { getCustomGeminiChatApiKey } from './geminiChatService';

export interface ReportSummaryResult {
  summary: string;
  summaryMl: string;
  summaryEn: string;
  isAiGenerated: boolean;
  timestamp: string;
}

function getActiveApiKey(): string {
  const k1 = getCustomGeminiApiKey();
  if (k1 && !k1.startsWith('mock-') && !k1.includes('placeholder')) return k1;

  const k2 = getCustomGeminiChatApiKey();
  if (k2 && !k2.startsWith('mock-') && !k2.includes('placeholder')) return k2;

  return process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
}

async function callGeminiPrompt(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const apiKey = getActiveApiKey();
  if (!apiKey || apiKey.startsWith('mock-')) return null;

  const model = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: `${systemPrompt}\n\nUser Data / Patient Timeline:\n${userPrompt}` }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 500
        }
      })
    });

    if (res.ok) {
      const json = await res.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text && text.trim()) {
        return text.trim();
      }
    }
  } catch (err) {
    console.warn('[GeminiReportSummaryService] Cloud inference error, using local summary engine:', err);
  }

  return null;
}

/**
 * 1. Generate CBAC Longitudinal Report Summary
 */
export async function generateCbacSummary(
  surveys: any[],
  beneficiaryName: string = 'ഗുണഭോക്താവ് (Beneficiary)'
): Promise<ReportSummaryResult> {
  const nowIso = new Date().toISOString();

  if (!surveys || surveys.length === 0) {
    const ml = `${beneficiaryName}: മുൻകാല CBAC സർവേ രേഖകൾ ലഭ്യമല്ല. ഈ സന്ദർശനത്തിൽ പുതിയ CBAC സ്ക്രീനിംഗ് പൂർത്തിയാക്കുക.`;
    const en = `${beneficiaryName}: No prior CBAC records found. Complete a new NCD screening during this visit.`;
    return {
      summary: `${ml}\n\n${en}`,
      summaryMl: ml,
      summaryEn: en,
      isAiGenerated: false,
      timestamp: nowIso
    };
  }

  const sanitizedSurveys = surveys.map((s, idx) => ({
    visit_index: idx + 1,
    date: s.generalInfo?.date || s.timestamp?.slice(0, 10),
    total_score: s.partA?.totalScore,
    waist_cm: s.partA?.waistCm,
    is_high_risk: s.partA?.isHighRisk,
    warning_signs_present: s.partB?.hasAnyWarningSign,
    phq2_referred: s.partD?.isReferredToChoMo,
    classification: s.overallClassification
  }));

  const systemPrompt = `You are Swaram AI Clinical Assistant for ASHA workers in Kerala.
Summarize the longitudinal CBAC NCD screening history for ${beneficiaryName}.
Format your response in TWO concise parts:
1. MALAYALAM SUMMARY (3-4 bullet points in natural Malayalam covering risk trend, score progression, warning signs, and action).
2. ENGLISH SUMMARY (2-3 bullet points).
Keep it clinically precise and actionable for field health workers.`;

  const userPrompt = JSON.stringify(sanitizedSurveys, null, 2);
  const aiOutput = await callGeminiPrompt(systemPrompt, userPrompt);

  if (aiOutput) {
    return {
      summary: aiOutput,
      summaryMl: aiOutput,
      summaryEn: '',
      isAiGenerated: true,
      timestamp: nowIso
    };
  }

  // Deterministic local clinical summary fallback
  const latest = surveys[0];
  const count = surveys.length;
  const score = latest.partA?.totalScore ?? 0;
  const isHigh = score > 4 || latest.partA?.isHighRisk;
  const hasWarn = latest.partB?.hasAnyWarningSign;

  const summaryMl = `• **രേഖപ്പെടുത്തിയ സർവേകൾ:** ${count} സന്ദർശനങ്ങൾ (അവസാന സ്കോർ: ${score}/10)
• **NCD റിസ്ക് നില:** ${isHigh ? 'അടിയന്തിര മുൻഗണന (സ്കോർ > 4 / High Risk)' : 'സാധാരണ നില (Normal Risk)'}
• **ലക്ഷണങ്ങൾ:** ${hasWarn ? 'Part B-ൽ മുന്നറിയിപ്പ് ലക്ഷണങ്ങൾ ശ്രദ്ധയിൽപ്പെട്ടിട്ടുണ്ട് (MO റഫറൽ നൽകുക)' : 'പ്രത്യേക അപകട ലക്ഷണങ്ങൾ ഇല്ല'}
• **ആശാ നിർദ്ദേശം:** ${isHigh ? 'പ്രാഥമികാരോഗ്യ കേന്ദ്രത്തിൽ (PHC) വാരാന്ത്യ സ്ക്രീനിംഗിന് എത്തിക്കുക.' : 'വാർഷിക CBAC പുനഃപരിശോധന തുടരുക.'}`;

  const summaryEn = `• **Total Screenings:** ${count} encounters (Latest Score: ${score}/10)
• **Risk Classification:** ${isHigh ? 'High NCD Risk (>4)' : 'Normal Risk'}
• **Clinical Action:** ${isHigh || hasWarn ? 'Refer to Medical Officer for diagnostic confirmation.' : 'Schedule routine annual re-screening.'}`;

  const combined = `${summaryMl}\n\n${summaryEn}`;

  return {
    summary: combined,
    summaryMl: combined,
    summaryEn,
    isAiGenerated: false,
    timestamp: nowIso
  };
}

/**
 * 2. Generate Mental Health Longitudinal Summary
 */
export async function generateMentalHealthSummary(
  encounters: any[],
  personName: string = 'ഗുണഭോക്താവ് (Beneficiary)'
): Promise<ReportSummaryResult> {
  const nowIso = new Date().toISOString();

  if (!encounters || encounters.length === 0) {
    const ml = `${personName}: മുൻകാല മാനസികാരോഗ്യ സ്ക്രീനിംഗ് രേഖകൾ ലഭ്യമല്ല. ഈ സന്ദർശനത്തിൽ പുതിയ PHQ-2 / GAD-2 പരിശോധന നടത്തുക.`;
    const en = `${personName}: No prior mental health assessments found. Complete standard PHQ-2/GAD-2 screening today.`;
    return {
      summary: `${ml}\n\n${en}`,
      summaryMl: ml,
      summaryEn: en,
      isAiGenerated: false,
      timestamp: nowIso
    };
  }

  const sanitized = encounters.map((e, idx) => ({
    visit_no: idx + 1,
    date: e.visit?.date || e.date || e.timestamp?.slice(0, 10),
    mental_social: e.observations?.mental_social,
    complaints: e.observations?.symptoms,
    action: e.ai_assessment?.recommended_action
  }));

  const systemPrompt = `You are Swaram AI Mental Health Clinical Assistant.
Summarize the mental health screening timeline (PHQ-2, GAD-2, emotional well-being) for ${personName}.
Provide a concise, compassionate 4-bullet summary in Malayalam and English on depressive/anxiety symptom trajectory, suicide risk flags, and community counseling steps.`;

  const aiOutput = await callGeminiPrompt(systemPrompt, JSON.stringify(sanitized, null, 2));

  if (aiOutput) {
    return {
      summary: aiOutput,
      summaryMl: aiOutput,
      summaryEn: '',
      isAiGenerated: true,
      timestamp: nowIso
    };
  }

  // Local fallback
  const count = encounters.length;
  const latest = encounters[0];
  const ms = latest.observations?.mental_social || {};
  const phq = ms.phq2_score ?? 0;
  const isRefer = phq >= 3;

  const summaryMl = `• **മാനസികാരോഗ്യ ചരിത്രം:** ${count} മുൻകാല ക്ലിനിക്കൽ പരിശോധനകൾ രേഖപ്പെടുത്തിയിട്ടുണ്ട്.
• **വിഷാദരോഗ സ്ക്രീനിംഗ് (PHQ-2):** ${isRefer ? 'സ്കോർ 3-ൽ കൂടുതൽ (ഉത്കണ്ഠ / വിഷാദ സാധ്യത)' : 'സ്കോർ സാധാരണ നിലയിൽ'}
• **നിർദ്ദേശം:** ${isRefer ? 'ആശ്വാസം നൽകുന്ന കൗൺസിലിംഗും CHO / MO-ലേക്ക് റഫറലും ഉറപ്പാക്കുക.' : 'കുടുംബ-സാമൂഹിക പിന്തുണയും സൗഹൃദ സംഭാഷണവും തുടരുക.'}`;

  const summaryEn = `• **Screening History:** ${count} prior mental health evaluations.
• **PHQ-2 Status:** ${isRefer ? 'Elevated score (≥3) indicating depressive symptoms.' : 'Low risk (Score <3).'}
• **ASHA Action:** ${isRefer ? 'Immediate referral to Community Health Officer (CHO) for counseling.' : 'Provide routine supportive engagement.'}`;

  const combined = `${summaryMl}\n\n${summaryEn}`;

  return {
    summary: combined,
    summaryMl: combined,
    summaryEn,
    isAiGenerated: false,
    timestamp: nowIso
  };
}

/**
 * 3. Generate Environmental & Climate Health Summary
 */
export async function generateEnvironmentalSummary(
  assessments: any[],
  householdName: string = 'കുടുംബം (Household)'
): Promise<ReportSummaryResult> {
  const nowIso = new Date().toISOString();

  if (!assessments || assessments.length === 0) {
    const ml = `${householdName}: മുൻകാല കാലാവസ്ഥാ/പാരിസ്ഥിതിക പരിശോധനാ രേഖകൾ ലഭ്യമല്ല. ഈ സന്ദർശനത്തിൽ പാരിസ്ഥിതിക സർവേ രേഖപ്പെടുത്തുക.`;
    const en = `${householdName}: No prior environmental risk assessments found. Record household climate vulnerability today.`;
    return {
      summary: `${ml}\n\n${en}`,
      summaryMl: ml,
      summaryEn: en,
      isAiGenerated: false,
      timestamp: nowIso
    };
  }

  const sanitized = assessments.map((a, idx) => ({
    assessment_no: idx + 1,
    date: a.timestamp?.slice(0, 10) || a.date,
    heat_index: a.weather?.heat_index_c,
    heat_category: a.risk_result?.heat_category,
    cooking_fuel: a.cooking_fuel,
    water_safety: a.drinking_water,
    vulnerabilities: a.vulnerability,
    care_gaps_count: a.care_gaps?.length || 0
  }));

  const systemPrompt = `You are Swaram AI Climate Health & Environmental Risk Specialist in Kerala.
Summarize the longitudinal environmental & climate health risk for ${householdName}.
Provide a concise 4-bullet summary in Malayalam & English highlighting:
1. Heatwave & thermal stress index trajectory.
2. Indoor air pollution & drinking water quality hazards.
3. Impact on infants, elderly, pregnant members, and chronic patients.
4. Immediate household resilience & cooling/water purification interventions.`;

  const aiOutput = await callGeminiPrompt(systemPrompt, JSON.stringify(sanitized, null, 2));

  if (aiOutput) {
    return {
      summary: aiOutput,
      summaryMl: aiOutput,
      summaryEn: '',
      isAiGenerated: true,
      timestamp: nowIso
    };
  }

  // Local fallback
  const count = assessments.length;
  const latest = assessments[0];
  const fuel = latest.cooking_fuel || 'lpg';
  const water = latest.drinking_water || 'boiled';
  const heatRisk = latest.risk_result?.heat_category || 'moderate';

  const isSmokeHazard = fuel === 'firewood' || fuel === 'biomass';
  const isWaterUnsafe = water === 'unboiled_well' || water === 'untreated_surface';

  const summaryMl = `• **പാരിസ്ഥിതിക രേഖകൾ:** ${count} കാലാവസ്ഥാ പരിശോധനകൾ രേഖപ്പെടുത്തിയിട്ടുണ്ട്.
• **ചൂട് / താപനില മുന്നറിയിപ്പ്:** ${heatRisk === 'extreme' ? 'കഠിനമായ താപ തരംഗ സാധ്യത (Extreme Heat)' : 'മിതമായ ചൂട് (Moderate Heat)'}
• **അന്തരീക്ഷ & കുടിവെള്ള അപായസാധ്യത:** ${isSmokeHazard ? 'വിറകടുപ്പ് പുക ശ്വാസകോശ പ്രശ്നങ്ങൾക്ക് ഇടയാക്കാം' : 'പുക ശല്യം കുറവ്'} • ${isWaterUnsafe ? 'തിളപ്പിച്ചാറ്റാത്ത വെള്ളം ഉപയോഗിക്കുന്നത് ഒഴിവാക്കുക' : 'തിളപ്പിച്ച വെള്ളം ഉപയോഗിക്കുന്നു'}
• **ആശാ നിർദ്ദേശം:** നിർജ്ജലീകരണം ഒഴിവാക്കാൻ ORS, നാരങ്ങാവെള്ളം എന്നിവ നൽകുക. ശരിയായ വായുസഞ്ചാരം ഉറപ്പാക്കുക.`;

  const summaryEn = `• **Assessment Count:** ${count} prior climate health logs.
• **Heat Vulnerability:** ${heatRisk.toUpperCase()} thermal stress level.
• **Environmental Hazards:** ${isSmokeHazard ? 'Indoor biomass smoke exposure' : 'Clean cooking fuel'} • ${isWaterUnsafe ? 'Unsafe drinking water source' : 'Safe boiled water'}.
• **Frontline Guidance:** Hydration protocols, heat protection for elderly/infants, and water purification.`;

  const combined = `${summaryMl}\n\n${summaryEn}`;

  return {
    summary: combined,
    summaryMl: combined,
    summaryEn,
    isAiGenerated: false,
    timestamp: nowIso
  };
}
