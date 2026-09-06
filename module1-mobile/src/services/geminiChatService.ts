/**
 * Google Gemini Chatbot Service for Swaram ASHA Copilot
 * 
 * Provides conversational clinical decision support, maternal & child health guidelines,
 * immunization schedules, and NCD protocols for frontline ASHA workers in Kerala.
 * 
 * Powered by Google Gemini (gemini-2.5-flash / gemini-2.0-flash / gemini-1.5-flash)
 * Bilingual: Malayalam (മലയാളം) & English
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  isError?: boolean;
}

let customGeminiApiKey = '';

export function setCustomGeminiChatApiKey(key: string) {
  customGeminiApiKey = (key || '').trim();
}

export function getCustomGeminiChatApiKey(): string {
  if (customGeminiApiKey) return customGeminiApiKey;

  // 1. Check dedicated chatbot key in .env
  const chatbotKey = process.env.EXPO_PUBLIC_GEMINI_CHATBOT_API_KEY || '';
  if (chatbotKey && !chatbotKey.includes('placeholder') && !chatbotKey.includes('your_gemini_api_key')) {
    return chatbotKey;
  }

  // 2. Check general Gemini API key in .env
  const generalKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
  if (generalKey && !generalKey.includes('placeholder') && !generalKey.includes('your_gemini_api_key')) {
    return generalKey;
  }

  return '';
}

export function getGeminiModel(): string {
  return process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-2.5-flash';
}

const ASHA_SYSTEM_PROMPT = `
You are "Swaram Copilot" (സ്വരം എഐ സഹായി), an intelligent clinical and operational companion for Accredited Social Health Activists (ASHA workers) in Kerala, India.

Your Responsibilities:
1. Support ASHA workers during household visits, maternal checkups, child immunization tracking, malnutrition screening, and non-communicable disease (NCD/CBAC) surveys.
2. Provide concise, clear, and actionable advice adhering strictly to National Health Mission (NHM) India and Directorate of Health Services (DHS) Kerala guidelines.
3. Be fluent in both Malayalam (മലയാളം) and simple English. If the worker asks in Malayalam or Manglish, reply in clear, natural Malayalam. If asked in English, reply in English.
4. Key Clinical & Operational Domains:
   - Maternal Health: Antenatal care (ANC) schedule (4 mandatory visits), IFA tablet compliance, danger signs in pregnancy (severe headache, blurring of vision, pedal edema, bleeding, decreased fetal movement), referral to PHC/CHC.
   - Child Health: WHO Growth charts, Mid-Upper Arm Circumference (MUAC) triage (Green: >12.5cm Normal; Yellow: 11.5-12.5cm Moderate Acute Malnutrition; Red: <11.5cm Severe Acute Malnutrition), National Immunization Schedule (BCG, OPV, Pentavalent, Rotavirus, MR, Vitamin A).
   - Infant Nutrition: Exclusive breastfeeding for 6 months, complementary feeding from 6 months with diverse food groups (eggs, milk, pulses, greens), avoiding junk foods.
   - Non-Communicable Diseases (NCDs): Normal BP (<120/80 mmHg), Hypertensive crisis (>140/90 mmHg), Random Blood Sugar (RBS) thresholds, CBAC questionnaire scoring (>4 needs referral to PHC Medical Officer).
   - Kerala Health Schemes: Karunya Arogya Suraksha Padhathi (KASP), Janani Suraksha Yojana (JSY), Mathru Samridhi.
5. Format your replies with short bullet points, friendly encouraging tone, and practical advice.
6. Safety First: You are an assistive decision aid, NOT an independent medical diagnostic engine. Always advise consulting the Primary Health Centre (PHC) Medical Officer or Staff Nurse for red-flag symptoms.
`.trim();

/**
 * Common offline fallback knowledge base for when API key is not yet set or device is offline.
 */
const OFFLINE_KNOWLEDGE_BASE: Record<string, string> = {
  nutrition: `**ശിശു പോഷകാഹാരം (Infant & Child Nutrition Guidelines):**
• **0-6 മാസം:** മുലപ്പാൽ മാത്രം നൽകുക (Exclusive breastfeeding). വെള്ളം പോലും നൽകരുത്.
• **6 മാസത്തിനു ശേഷം:** മുലപ്പാലിനൊപ്പം കുറുക്കിയ ആഹാരങ്ങൾ നൽകിത്തുടങ്ങുക (കുറുക്ക്, പയറുവർഗ്ഗങ്ങൾ, വേവിച്ച മുട്ടയുടെ മഞ്ഞ).
• **ഡയറ്ററി ഡൈവേഴ്സിറ്റി (Dietary Diversity):** ദിവസവും പാൽ, മുട്ട, പയർ, പച്ചക്കറികൾ എന്നിവ ഉൾപ്പെടുത്തുക.
• **മ്യൂവാക് (MUAC) അളവ്:**
  - [സാധാരണ / Normal] 12.5 cm-ൽ കൂടുതൽ: സാധാരണ പോഷകനില
  - [മിതമായത് / MAM] 11.5 - 12.5 cm: മിതമായ പോഷകാഹാരക്കുറവ് (MAM)
  - [ഗുരുതരം / SAM] 11.5 cm-ൽ താഴെ: കഠിനമായ പോഷകാഹാരക്കുറവ് (SAM) - ഉടൻ PHC-യിലേക്ക് റഫർ ചെയ്യുക.`,

  anc: `**ഗർഭകാല മുന്നറിയിപ്പുകൾ (ANC Danger Signs):**
ഉടൻ പ്രാഥമികാരോഗ്യ കേന്ദ്രത്തിൽ (PHC) എത്തിക്കേണ്ട ലക്ഷണങ്ങൾ:
• കഠിനമായ തലവേദനയും കാഴ്ച മങ്ങലും (Preeclampsia സൂചന)
• മുഖത്തും കൈകാലുകളിലും പെട്ടെന്നുണ്ടാകുന്ന നീര് (Edema)
• രക്തസ്രാവം അല്ലെങ്കിൽ അടിവയറ്റിലെ കഠിനമായ വേദന
• കുഞ്ഞിന്റെ അനക്കം കുറയുക
• ബിപി 140/90 mmHg-ൽ കൂടുതൽ ആകുക
• 3rd Trimester-ൽ നിർബന്ധമായും ആഴ്ചതോറും BP പരിശോധിക്കുക. അയൺ ഗുളികകൾ (IFA) ഭക്ഷണത്തിന് ശേഷം കഴിക്കാൻ നിർദ്ദേശിക്കുക.`,

  hypertension: `**രക്തസമ്മർദ്ദ നിയന്ത്രണം (Hypertension / NCD Care):**
• സാധാരണ അളവ്: 120/80 mmHg.
• 140/90 mmHg-ൽ കൂടുതലായാൽ ഹൈപ്പർടെൻഷൻ സാധ്യത.
• നിർദ്ദേശങ്ങൾ:
  1. ഉപ്പിന്റെ ഉപയോഗം പ്രതിദിനം 5 ഗ്രാമിൽ (1 ചെറിയ സ്പൂൺ) താഴെയാക്കുക.
  2. ഡോക്ടർ നിർദ്ദേശിച്ച ബിപി മരുന്നുകൾ ഒരു ദിവസവും മുടങ്ങാതെ കഴിക്കുക.
  3. രണ്ടാഴ്ചയിലൊരിക്കൽ എങ്കിലും ആശാ വർക്കർ ബിപി പുനഃപരിശോധിക്കുക.
  4. നെഞ്ചുവേദന, തലകറക്കം എന്നിവ കണ്ടാൽ ഉടൻ താലൂക്ക് ആശുപത്രിയിലേക്ക് അയക്കുക.`,

  ifa: `**അയൺ & ഫോളിക് ആസിഡ് (IFA Tablet Guidance):**
• ഗർഭിണികൾക്ക്: 100 ദിവസത്തെ IFA ഗുളികകൾ (ദിവസവും 1 ഗുളിക, ഭക്ഷണത്തിന് ശേഷം).
• കൗമാരപ്രായക്കാർക്ക് (WIFS): ആഴ്ചയിൽ ഒരു നീല IFA ഗുളിക.
• നിർദ്ദേശം: ഗുളിക ചായയോ കാപ്പിയോ ഒപ്പം കഴിക്കരുത്. നാരങ്ങാവെള്ളം അല്ലെങ്കിൽ വിറ്റാമിൻ C അടങ്ങിയ ഭക്ഷണത്തോടൊപ്പം കഴിക്കുന്നത് ആഗിരണം വർദ്ധിപ്പിക്കും.
• മലത്തിന് കറുത്ത നിറം വരുന്നത് സാധാരണമാണെന്ന് ഗുണഭോക്താവിനെ ബോധ്യപ്പെടുത്തുക.`,

  cbac: `**CBAC ഹൈ-റിസ്ക് സ്കോറിംഗ് (CBAC High-Risk Guide):**
• പാർട്ട് A സ്കോർ **4-ൽ കൂടുതൽ** ആയാൽ വ്യക്തിയെ നിർബന്ധമായും PHC-യിലേക്ക് റഫർ ചെയ്യണം.
• പ്രധാന ഘടകങ്ങൾ: പ്രായം (50+ വയസ്സ്), പുകയില ഉപയോഗം, മദ്യപാനം, അരക്കെട്ടിന്റെ അളവ് (പുരുഷന്മാർ >90cm, സ്ത്രീകൾ >80cm), വ്യായാമക്കുറവ്, കുടുംബത്തിലെ പ്രമേഹം/ഹൃദ്രോഗ ചരിത്രം.
• സ്കോർ 4-ൽ കൂടുതലുള്ളവർക്ക് പ്രമേഹം (RBS), രക്തസമ്മർദ്ദം, വായ/സ്തനാർബുദ പരിശോധനകൾ നടത്തണം.`
};

export async function sendChatMessageToGemini(
  conversationHistory: ChatMessage[],
  userPrompt: string
): Promise<string> {
  const apiKey = getCustomGeminiChatApiKey();

  // If no Gemini API Key is configured, use offline frontline knowledge base
  if (!apiKey) {
    const lower = userPrompt.toLowerCase();
    if (lower.includes('പോഷക') || lower.includes('കുട്ടി') || lower.includes('nutrition') || lower.includes('muac') || lower.includes('food') || lower.includes('ഭക്ഷണം')) {
      return OFFLINE_KNOWLEDGE_BASE.nutrition;
    }
    if (lower.includes('ഗർഭ') || lower.includes('anc') || lower.includes('pregnant') || lower.includes('പ്രസവ') || lower.includes('danger')) {
      return OFFLINE_KNOWLEDGE_BASE.anc;
    }
    if (lower.includes('ബിപി') || lower.includes('bp') || lower.includes('hypertension') || lower.includes('രക്തസമ്മർദ്ദം') || lower.includes('പ്രഷർ')) {
      return OFFLINE_KNOWLEDGE_BASE.hypertension;
    }
    if (lower.includes('ifa') || lower.includes('അയൺ') || lower.includes('ഗുളിക') || lower.includes('iron') || lower.includes('tablet')) {
      return OFFLINE_KNOWLEDGE_BASE.ifa;
    }
    if (lower.includes('cbac') || lower.includes('സ്കോർ') || lower.includes('check') || lower.includes('lifestyle') || lower.includes('റിസ്ക്')) {
      return OFFLINE_KNOWLEDGE_BASE.cbac;
    }

    return `നമസ്കാരം! ഞാൻ നിങ്ങളുടെ സ്വരം എഐ സഹായിയാണ് (Swaram ASHA Assistant).

Google Gemini API Key നൽകിയിട്ടില്ലെങ്കിൽ താഴെയുള്ള വിഷയങ്ങളിൽ ക്ലിക്ക് ചെയ്യുക:
• കുഞ്ഞിന്റെ പോഷകാഹാരം (Infant Nutrition)
• ഗർഭകാല മുന്നറിയിപ്പുകൾ (ANC Danger Signs)
• ബിപി / ഹൈപ്പർടെൻഷൻ മാനദണ്ഡങ്ങൾ (BP Protocol)
• IFA ഗുളികകൾ കഴിക്കേണ്ട വിധം (IFA Schedule)
• CBAC ഹൈ-റിസ്ക് മാനദണ്ഡങ്ങൾ (CBAC Guide)

മുകളിലുള്ള കീ (AI Key) ബട്ടൺ അമർത്തിയോ module1-mobile/.env ഫയലിൽ EXPO_PUBLIC_GEMINI_CHATBOT_API_KEY ചേർത്തോ നിങ്ങളുടെ പുതിയ ഗൂഗിൾ ജെമിനി കീ നൽകാവുന്നതാണ്.`;
  }

  // Build Gemini contents array from conversation history
  const contents: { role: string; parts: { text: string }[] }[] = [];

  // Filter out system and error messages from history, take last 8 turns
  const relevantHistory = conversationHistory
    .filter((msg) => msg.role !== 'system' && !msg.isError)
    .slice(-8);

  for (const msg of relevantHistory) {
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    });
  }

  // Append latest user message
  contents.push({
    role: 'user',
    parts: [{ text: userPrompt }]
  });

  const requestBody = {
    systemInstruction: {
      parts: [{ text: ASHA_SYSTEM_PROMPT }]
    },
    contents: contents,
    generationConfig: {
      temperature: 0.25,
      maxOutputTokens: 800
    }
  };

  const primaryModel = getGeminiModel();
  const modelsToTry = [primaryModel, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  // Deduplicate
  const uniqueModels = Array.from(new Set(modelsToTry));

  let lastErrorMessage = '';

  for (const model of uniqueModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      console.log(`[Gemini Chat Service] Calling model ${model}...`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (candidateText) {
          return candidateText;
        }
      } else {
        const errJson = await response.json().catch(() => ({}));
        const errText = errJson?.error?.message || `HTTP ${response.status}`;
        console.warn(`[Gemini Chat Service] Model ${model} returned error: ${errText}`);
        lastErrorMessage = errText;
      }
    } catch (err: any) {
      console.warn(`[Gemini Chat Service] Network error for ${model}:`, err?.message);
      lastErrorMessage = err?.message || 'Network error';
    }
  }

  throw new Error(`Google Gemini Error: ${lastErrorMessage || 'Failed to generate response. Please verify your API key.'}`);
}
