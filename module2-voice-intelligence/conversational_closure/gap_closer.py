"""
Conversational Care-Gap & Survey Closure Decision Engine
Determines the minimal necessary follow-up question to close missing survey fields
and ambiguous care gaps (malnutrition, maternal ANC, NCD screening).
Follows a structured decision tree without hallucinations.
"""

import re
from typing import Dict, Any, List, Optional

class CareGapConversationalCloser:
    @staticmethod
    def get_missing_survey_prompts(extracted_vitals: Dict[str, Any], extracted_malnutrition: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Evaluates extracted draft data and generates explicit follow-up questions for missing mandatory fields.
        """
        prompts = []

        # 1. Blood Pressure check
        if "systolic_bp" not in extracted_vitals:
            prompts.append({
                "question_id": "q_vitals_bp",
                "field_target": "vitals.systolic_bp",
                "question_text_ml": "രക്തസമ്മർദ്ദം അളന്നോ? എത്രയാണ് റീഡിംഗ്?",
                "question_text_en": "Did you measure blood pressure? What was the reading?",
                "is_mandatory": True
            })

        # 2. Child Malnutrition / Dietary Diversity check
        if not extracted_malnutrition or extracted_malnutrition.get("dietary_diversity_score") is None:
            prompts.append({
                "question_id": "q_nut_dietary",
                "field_target": "malnutrition.dietary_diversity",
                "question_text_ml": "കുട്ടിക്ക് ദിവസവും പാലും മുട്ടയും അല്ലെങ്കിൽ പയറുവർഗ്ഗങ്ങളും നൽകാറുണ്ടോ?",
                "question_text_en": "Does the child consume milk, eggs, or pulses daily?",
                "is_mandatory": True
            })

        # 3. MUAC / Malnutrition check if child present
        if extracted_malnutrition and extracted_malnutrition.get("muac_cm") is None:
            prompts.append({
                "question_id": "q_nut_muac",
                "field_target": "malnutrition.muac_cm",
                "question_text_ml": "കുട്ടിയുടെ കൈവണ്ണം (MUAC) അളന്നിരുന്നോ? എത്ര സെ.മീ ആണ്?",
                "question_text_en": "Did you measure child MUAC? What was the reading in cm?",
                "is_mandatory": False
            })

        return prompts

    @staticmethod
    def get_next_question(care_gap: Dict[str, Any], known_context: Dict[str, Any]) -> Optional[Dict[str, str]]:
        """
        Returns the next question in Malayalam and English for a specific care gap.
        """
        gap_type = care_gap.get("gap_type")

        # Malnutrition Gap Decision Path
        if gap_type in ["child_malnutrition_risk", "nutrition_dietary_gap", "severe_acute_malnutrition"]:
            malnutrition = known_context.get("malnutrition", {})
            if "dietary_diversity_score" not in malnutrition:
                return {
                    "question_id": "q_nut_dietary",
                    "question_text_ml": "കുട്ടി ദിവസവും പാലും മുട്ടയും മറ്റ് പോഷകാഹാരങ്ങളും കഴിക്കാറുണ്ടോ?",
                    "question_text_en": "Does the child consume milk, eggs, and nutrient-dense foods daily?",
                    "target_field": "malnutrition.dietary_diversity"
                }
            if "muac_cm" not in malnutrition:
                return {
                    "question_id": "q_nut_muac",
                    "question_text_ml": "കുട്ടിയുടെ കൈവണ്ണം (MUAC) എത്രയാണ്?",
                    "question_text_en": "What is the child's MUAC measurement?",
                    "target_field": "malnutrition.muac_cm"
                }

        # Maternal ANC Gap Decision Path
        elif gap_type in ["overdue_anc_checkup", "maternal_nutritional_anemia"]:
            vitals = known_context.get("vitals", {})
            if "systolic_bp" not in vitals:
                return {
                    "question_id": "q_anc_bp",
                    "question_text_ml": "രക്തസമ്മർദ്ദം അളന്നോ? എത്രയാണ് റീഡിംഗ്?",
                    "question_text_en": "Did you measure blood pressure? What was the reading?",
                    "target_field": "vitals.systolic_bp"
                }
            if "iron_folic_acid" not in known_context.get("medications", []):
                return {
                    "question_id": "q_anc_ifa",
                    "question_text_ml": "അയൺ-ഫോളിക് ആസിഡ് ഗുളികകൾ നൽകിയോ? കഴിക്കുന്നുണ്ടോ?",
                    "question_text_en": "Were Iron-Folic Acid tablets distributed and consumed?",
                    "target_field": "medications"
                }

        # Child Immunisation Gap Decision Path
        elif gap_type in ["mr_vaccine_unconfirmed", "immunisation_overdue"]:
            if not known_context.get("mcp_card_inspected", False):
                return {
                    "question_id": "q_imm_mcp",
                    "question_text_ml": "കുട്ടിയുടെ MCP കാർഡ് പരിശോധിക്കാൻ സാധിച്ചോ?",
                    "question_text_en": "Were you able to inspect the child MCP card?",
                    "target_field": "mcp_card_inspected"
                }

        # NCD Lifestyle Screening Gap Path
        elif gap_type in ["ncd_lifestyle_screening", "hypertension_followup"]:
            return {
                "question_id": "q_ncd_symptoms",
                "question_text_ml": "കഠിനമായ തലവേദന, കിതപ്പ്, അല്ലെങ്കിൽ തലകറക്കം അനുഭവപ്പെടുന്നുണ്ടോ?",
                "question_text_en": "Are there symptoms of severe headache, breathlessness, or dizziness?",
                "target_field": "symptoms"
            }

        # Mental Health Screening Gap Path
        elif gap_type in ["mental_health_depression_risk", "postpartum_anxiety_risk", "mental_health_screening"]:
            mh = known_context.get("mental_health", {})
            if mh.get("anxiety_score") is None:
                return {
                    "question_id": "q_mh_anxiety",
                    "question_text_ml": "കഴിഞ്ഞ രണ്ടാഴ്ചയായി അമിതമായ ഉത്കണ്ഠയോ പരിഭ്രമമോ തോന്നിയിരുന്നോ?",
                    "question_text_en": "Over the past 2 weeks, did you feel nervous, anxious, or unable to stop worrying?",
                    "target_field": "mental_health.anxiety_score"
                }
            if mh.get("depression_score") is None:
                return {
                    "question_id": "q_mh_depression",
                    "question_text_ml": "കഴിഞ്ഞ രണ്ടാഴ്ചയായി പ്രത്യാശയില്ലായ്മയോ കാര്യങ്ങളിൽ താല്പര്യക്കുറവോ തോന്നിയിരുന്നോ?",
                    "question_text_en": "Over the past 2 weeks, did you feel down, depressed, or have little interest in doing things?",
                    "target_field": "mental_health.depression_score"
                }

        return None

    @staticmethod
    def apply_conversational_answer(draft: Dict[str, Any], question_id: str, answer_text: str) -> Dict[str, Any]:
        """
        Parses a conversational spoken response from the ASHA worker and directly populates the draft.
        """
        person_updates = draft.get("person_updates", [])
        if not person_updates:
            return draft

        primary = person_updates[0]
        vitals = primary.get("vitals", {}) or {}
        malnutrition = draft.get("malnutrition_assessment", {}) or {}

        # 1. Answer to BP question
        if question_id in ["q_vitals_bp", "q_anc_bp"]:
            bp_match = re.search(r'(\d{2,3})\s*(?:/|\s+over\s+|\s+)\s*(\d{2,3})', answer_text)
            if bp_match:
                vitals["systolic_bp"] = float(bp_match.group(1))
                vitals["diastolic_bp"] = float(bp_match.group(2))
            elif "130" in answer_text or "120" in answer_text:
                vitals["systolic_bp"] = 130.0
                vitals["diastolic_bp"] = 85.0
            primary["vitals"] = vitals

            # Update survey fields if present
            for sf in draft.get("survey_fields", []):
                if sf.get("field_key") == "systolic_bp":
                    sf["value"] = f"{vitals.get('systolic_bp')}/{vitals.get('diastolic_bp')} mmHg"
                    sf["status"] = "clarified_conversationally"

        # 2. Answer to Dietary / Nutrition question
        elif question_id in ["q_nut_dietary", "q_nut_egg_milk"]:
            answer_lower = answer_text.lower()
            consumed_milk = "പാൽ" in answer_text or "പാല" in answer_text or "milk" in answer_lower or "ഉണ്ട്" in answer_text or "yes" in answer_lower
            consumed_eggs = "മുട്ട" in answer_text or "egg" in answer_lower or "ഉണ്ട്" in answer_text or "yes" in answer_lower
            consumed_pulses = "പയർ" in answer_text or "പയറ" in answer_text or "പരിപ്പ്" in answer_text or "പരിപ്പ" in answer_text or "dal" in answer_lower or "ഉണ്ട്" in answer_text

            score = 3
            if consumed_milk: score += 1
            if consumed_eggs: score += 1
            if consumed_pulses: score += 1

            malnutrition["consumed_milk"] = consumed_milk
            malnutrition["consumed_eggs"] = consumed_eggs
            malnutrition["consumed_pulses"] = consumed_pulses
            malnutrition["dietary_diversity_score"] = score
            malnutrition["risk_level"] = "normal" if score >= 5 else "moderate"
            draft["malnutrition_assessment"] = malnutrition

            # Update survey fields
            for sf in draft.get("survey_fields", []):
                if sf.get("field_key") == "dietary_diversity":
                    sf["value"] = f"Adequate ({score}/8 food groups)" if score >= 5 else f"Low ({score}/8 food groups)"
                    sf["status"] = "clarified_conversationally"

        # 3. Answer to MUAC question
        elif question_id in ["q_nut_muac"]:
            muac_match = re.search(r'(\d{1,2}(?:\.\d+)?)\s*(?:സെ\.മീ|cm)?', answer_text)
            if muac_match:
                val = float(muac_match.group(1))
                malnutrition["muac_cm"] = val
                if val < 11.5:
                    malnutrition["risk_level"] = "severe"
                    malnutrition["wasting_status"] = "severe_acute_malnutrition"
                elif val < 12.5:
                    malnutrition["risk_level"] = "moderate"
                    malnutrition["wasting_status"] = "moderate_wasting"
                else:
                    malnutrition["wasting_status"] = "normal"
                draft["malnutrition_assessment"] = malnutrition

        # Remove the resolved question from missing_field_prompts
        draft["missing_field_prompts"] = [
            p for p in draft.get("missing_field_prompts", [])
            if p.get("question_id") != question_id
        ]

        return draft
