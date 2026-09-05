/**
 * Comprehensive Malayalam Spell Corrector & Normalizer for Voice ASR
 * 
 * Corrects common phonetic errors, Tamil de-voicing artifacts (e.g. ക->ഗ, പ->ബ, ച->സ, ട->ഡ),
 * decomposed chillu characters, and clinical terminology in healthcare field visits.
 */

// Comprehensive dictionary of common ASR phonetic misrecognitions and corrections
export const MALAYALAM_SPELL_DICTIONARY: Record<string, string> = {
  // 1. Tamil De-voicing & Phonetic Substitutions
  'ചുകം': 'സുഖം',
  'ചുകമാണോ': 'സുഖമാണോ',
  'ചുകമായി': 'സുഖമായി',
  'കുളിക': 'ഗുളിക',
  'കുളികകൾ': 'ഗുളികകൾ',
  'കുളികയെടുത്തു': 'ഗുളികയെടുത്തു',
  'കുളികകഴിച്ചു': 'ഗുളികകഴിച്ചു',
  'പിപി': 'ബിപി',
  'പി\.പി': 'ബിപി',
  'ബി\.പി': 'ബിപി',
  'ടാക്ടർ': 'ഡോക്ടർ',
  'ടാക്ടറെ': 'ഡോക്ടറെ',
  'ടോക്ടർ': 'ഡോക്ടർ',
  'ടോക്ടറെ': 'ഡോക്ടറെ',
  'പ്രശർ': 'പ്രഷർ',
  'പ്രശറ്': 'പ്രഷർ',
  'പ്രഷറ്': 'പ്രഷർ',
  'ആശുപതി': 'ആശുപത്രി',
  'ആശുപതിയിൽ': 'ആശുപത്രിയിൽ',
  'ഹോസ്പിറ്റല്': 'ഹോസ്പിറ്റൽ',
  'ഹോസ്പിറ്റലിൽ': 'ഹോസ്പിറ്റലിൽ',
  'ചെക്കപ്': 'ചെക്കപ്പ്',
  'ചെക്കപ്പിന്': 'ചെക്കപ്പിന്',
  'മരുന്തു': 'മരുന്ന്',
  'മരുന്തുകൾ': 'മരുന്നുകൾ',
  'ഇരുമ്പു കുളിക': 'ഇരുമ്പ് ഗുളിക',
  'അയൺ കുളിക': 'അയൺ ഗുളിക',
  'അയൺകുളിക': 'അയൺ ഗുളിക',
  'രക്തസമ്മർദം': 'രക്തസമ്മർദ്ദം',
  'രക്തസമ്മർദ്ധം': 'രക്തസമ്മർദ്ദം',

  // 2. Clinical Vitals & Measurements
  'ഷുഗറ്': 'ഷുഗർ',
  'ഷുഗരില്ല': 'ഷുഗറില്ല',
  'തൂക്കം': 'ഭാരം',
  'കിലോ': 'കിലോ',
  'കിലോഗ്രാം': 'കിലോഗ്രാം',
  'ടെംപറേച്ചർ': 'ടെമ്പറേച്ചർ',
  'പൾസ്': 'പൾസ്',
  'ഹാർട്ട് ബീറ്റ്': 'ഹൃദയമിടിപ്പ്',

  // 3. Symptoms & Conditions
  'പനീ': 'പനി',
  'പനിയുണ്ട്': 'പനിയുണ്ട്',
  'ചുമയുണ്ട്': 'ചുമയുണ്ട്',
  'തലവേദനയുണ്ട്': 'തലവേദനയുണ്ട്',
  'വയറുവേദനയുണ്ട്': 'വയറുവേദനയുണ്ട്',
  'നെഞ്ചുവേദനയുണ്ട്': 'നെഞ്ചുവേദനയുണ്ട്',
  'ക്ഷീണമുണ്ട്': 'ക്ഷീണമുണ്ട്',
  'ശ്വാസംമുട്ടലുണ്ട്': 'ശ്വാസംമുട്ടലുണ്ട്',
  'തലകറക്കമുണ്ട്': 'തലകറക്കമുണ്ട്',
  'ഛർദ്ദിയുണ്ട്': 'ഛർദ്ദിയുണ്ട്',
  'ശർദ്ദി': 'ഛർദ്ദി',

  // 4. Maternal & Child Health
  'ഗർഭിണീ': 'ഗർഭിണി',
  'ഗർഭാവസ്ഥ': 'ഗർഭാവസ്ഥ',
  'പ്രസവതീയതി': 'പ്രസവ തീയതി',
  'തുള്ളിമരുന്തു': 'തുള്ളിമരുന്ന്',
  'വാക്സീൻ': 'വാക്സിൻ',
  'കുഞ്ഞിനു': 'കുഞ്ഞിന്',
  'ഫോളിക് ആസിഡ്': 'ഫോളിക് ആസിഡ്',
  'കാൽസ്യം കുളിക': 'കാൽസ്യം ഗുളിക',

  // 5. Common Colloquial & Grammatical Verbs
  'വണക്കം': 'നമസ്കാരം',
  'കണ്ടൂ': 'കണ്ടു',
  'കഴിച്ചൂ': 'കഴിച്ചു',
  'കൊടുത്തൂ': 'കൊടുത്തു',
  'പറഞ്ഞൂ': 'പറഞ്ഞു',
  'വന്നൂ': 'വന്നു',
  'പോയീ': 'പോയി',
  'ഉൺട്': 'ഉണ്ട്',
  'ഉണ്ടേ': 'ഉണ്ട്',
  'ഇല്ലേ': 'ഇല്ല',
  'അടുത്താഴ്ച': 'അടുത്ത ആഴ്ച',
  'വ്യാഴാച്ച': 'വ്യാഴാഴ്ച',
  'വെള്ളിയാച്ച': 'വെള്ളിയാഴ്ച',
  'തിങ്കളാച്ച': 'തിങ്കളാഴ്ച',
  'ചൊവ്വാച്ച': 'ചൊവ്വാഴ്ച',
  'ബുധനാച്ച': 'ബുധനാഴ്ച',
  'ശനിയാച്ച': 'ശനിയാഴ്ച',
  'ഞായറാച്ച': 'ഞായറാഴ്ച',

  // 6. Common Malayalam ASR Acoustic Misrecognitions (Whisper / IndicConformer)
  'ലേക്ക്ഷ്മി': 'ലക്ഷ്മി',
  'ലക്സ്മി': 'ലക്ഷ്മി',
  'ലെക്ഷ്മി': 'ലക്ഷ്മി',
  'ലക്ഷ്മീകേ': 'ലക്ഷ്മിക്ക്',
  'അമ്മേകേ': 'അമ്മയ്ക്ക്',
  'അമ്മക്കി': 'അമ്മയ്ക്ക്',
  'അമ്മേടെ': 'അമ്മയുടെ',
  'അമ്മക്ക്': 'അമ്മയ്ക്ക്',
  'നൂറ': '100',
  'നൂറു': '100',
  'നൂറ്': '100',
  'വൈസാഇൗ': 'വയസ്സായി',
  'വൈസായി': 'വയസ്സായി',
  'വയസാ': 'വയസ്സ്',
  'വയസ്സായീ': 'വയസ്സായി',
  'വയസായി': 'വയസ്സായി',
  'വയസ്സു': 'വയസ്സ്',
  'വയസ': 'വയസ്സ്',
  'എൺപതു': '80',
  'എമ്പത്': '80',
  'എഴുപതു': '70',
  'അറുപതു': '60',
  'അമ്പതു': '50',
  'നാൽപ്പതു': '40',
  'മുപ്പതു': '30',
  'ഇരുപതു': '20',
  'പാരവു': 'ഭാരവും',
  'പാരം': 'ഭാരം',
  'തൂക്കവും': 'ഭാരവും',
  'ഹൈട്ടു': 'ഉയരം',
  'ഹൈറ്റും': 'ഉയരവും',
  'ഹൈറ്റ്': 'ഉയരം',
  'മുണ്ടു': 'ഉണ്ട്',
  'ഇണ്ട്': 'ഉണ്ട്',
  'ഇണ്ടാ': 'ഉണ്ടോ'
};

/**
 * Normalizes decomposed virama characters into standard atomic chillu letters
 * (e.g. ര് -> ർ, ല് -> ൽ, ള് -> ൾ, ന് -> ൻ, ണ് -> ൺ) only at word boundaries
 * so conjuncts like 'കണ്ടു' or 'ഉണ്ട്' are preserved.
 */
export function normalizeMalayalamChillus(text: string): string {
  // Anusvara normalization: Word-ending "മ്" -> "ം"
  let res = text
    .replace(/മ്(?=[\s.,!?]|$)/g, 'ം')
    .replace(/ല്(?=[\s.,!?]|$)/g, 'ൽ')
    .replace(/ള്(?=[\s.,!?]|$)/g, 'ൾ')
    .replace(/ര്(?=[\s.,!?]|$)/g, 'ർ')
    .replace(/ന്(?=[\s.,!?]|$)/g, 'ൻ')
    .replace(/ണ്(?=[\s.,!?]|$)/g, 'ൺ');

  return res;
}

/**
 * Corrects misspelled Malayalam words using phonetic rules and domain dictionary
 */
export function correctMalayalamSpelling(rawText: string): string {
  if (!rawText || !rawText.trim()) return '';

  // 1. Normalize chillu letters and anusvara
  let text = normalizeMalayalamChillus(rawText);

  // 2. Tokenize preserving whitespace and punctuation
  const tokens = text.split(/(\s+|[.,!?]+)/);

  const correctedTokens = tokens.map((token) => {
    // Exact match in dictionary
    if (MALAYALAM_SPELL_DICTIONARY[token]) {
      return MALAYALAM_SPELL_DICTIONARY[token];
    }

    // Lowercase/trimmed lookup for English/Malayalam tokens
    const trimmed = token.trim();
    if (MALAYALAM_SPELL_DICTIONARY[trimmed]) {
      return MALAYALAM_SPELL_DICTIONARY[trimmed];
    }

    return token;
  });

  let result = correctedTokens.join('');

  // 3. Multi-word phrase replacements
  const phraseReplacements: [RegExp, string][] = [
    [/അയൺ കുളിക/g, 'അയൺ ഗുളിക'],
    [/ഇരുമ്പ് കുളിക/g, 'ഇരുമ്പ് ഗുളിക'],
    [/കാൽസ്യം കുളിക/g, 'കാൽസ്യം ഗുളിക'],
    [/അടുത്ത ആച്ച/g, 'അടുത്ത ആഴ്ച'],
    [/ചെക്കപ്പ് നു/g, 'ചെക്കപ്പിന്'],
    [/തൂക്കം (\d+)/g, 'ഭാരം $1'],
    [/ലേക്ക്ഷ്മി/g, 'ലക്ഷ്മി'],
    [/അമ്മേകേ/g, 'അമ്മയ്ക്ക്'],
    [/അമ്മക്കി/g, 'അമ്മയ്ക്ക്'],
    [/വൈസാഇൗ/g, 'വയസ്സായി'],
    [/വൈസായി/g, 'വയസ്സായി'],
    [/പാരവു/g, 'ഭാരവും'],
    [/ഹൈട്ടു/g, 'ഉയരം'],
    [/മുണ്ടു/g, 'ഉണ്ട്'],
    [/(\d+)\s*(?:മിറ്റർ|മീറ്റർ)\s*(?:ഹൈട്ടു|ഹൈറ്റ്|ഉയരം)/g, 'ഉയരം $1 cm'],
    [/(\d+)\s*കിലോ\s*(?:പാരവു|ഭാരം|തൂക്കം)/g, 'ഭാരം $1 കിലോ'],
    [/(\d+)\s*(?:വൈസാഇൗ|വയസ്സായി|വയസായി)/g, '$1 വയസ്സ്'],
  ];

  for (const [regex, repl] of phraseReplacements) {
    result = result.replace(regex, repl);
  }

  return result.trim();
}

/**
 * Common quick-correction chips for 1-tap correction on mobile UI
 */
export const QUICK_CORRECTION_SUGGESTIONS = [
  { label: 'ബിപി (BP)', value: 'ബിപി 120/80' },
  { label: 'ഗുളിക (Pill)', value: 'ഗുളിക കൊടുത്തു' },
  { label: 'ഷുഗർ (Sugar)', value: 'ഷുഗർ നോർമൽ' },
  { label: 'പനി (Fever)', value: 'പനി കുറഞ്ഞു' },
  { label: 'ഡോക്ടർ (Dr)', value: 'ഡോക്ടറെ കണ്ടു' },
  { label: 'ഭാരം (Weight)', value: 'ഭാരം 58 കിലോ' },
  { label: 'സുഖം (Fine)', value: 'സുഖമാണ്' },
  { label: 'ചെക്കപ്പ് (Visit)', value: 'അടുത്ത ചെക്കപ്പ് അടുത്ത ആഴ്ച' },
];
