"""
Conversational Care-Gap Closure Decision Engine
Determines the minimal necessary follow-up question to close an ambiguous care gap.
Follows a structured decision tree rather than open-ended hallucination.
"""

from typing import Dict, Any, Optional

class CareGapConversationalCloser:
    @staticmethod
    def get_next_question(care_gap: Dict[str, Any], known_context: Dict[str, Any]) -> Optional[Dict[str, str]]:
        """
        Returns the next question in Malayalam and English for a specific care gap.
        """
        gap_type = care_gap.get("gap_type")

        # Maternal ANC Gap Decision Path
        if gap_type == "overdue_anc_checkup":
            if "systolic_bp" not in known_context.get("vitals", {}):
                return {
                    "question_id": "q_anc_bp",
                    "question_text_ml": "രക്തസമ്മർദ്ദം അളന്നോ? എത്രയാണ് റീഡിംഗ്?",
                    "question_text_en": "Did you measure blood pressure? What was the reading?",
                    "target_field": "vitals.systolic_bp"
                }
            if "iron_folic_acid" not in known_context.get("medications", []):
                return {
                    "question_id": "q_anc_ifa",
                    "question_text_ml": "അയൺ-ഫോളിക് ആസിഡ് ഗുളികകൾ നൽകിയോ?",
                    "question_text_en": "Were Iron-Folic Acid tablets distributed?",
                    "target_field": "medications"
                }

        # Child Immunisation Gap Decision Path
        elif gap_type == "mr_vaccine_unconfirmed":
            if not known_context.get("mcp_card_inspected", False):
                return {
                    "question_id": "q_imm_mcp",
                    "question_text_ml": "കുട്ടിയുടെ MCP കാർഡ് പരിശോധിക്കാൻ സാധിച്ചോ?",
                    "question_text_en": "Were you able to inspect the child MCP card?",
                    "target_field": "mcp_card_inspected"
                }

        # Nutrition Gap Path
        elif gap_type == "nutrition_dietary_gap":
            return {
                "question_id": "q_nut_egg_milk",
                "question_text_ml": "കുട്ടി ദിവസവും പാലും മുട്ടയും കഴിക്കാറുണ്ടോ?",
                "question_text_en": "Does the child consume eggs and milk daily?",
                "target_field": "dietary_diversity"
            }

        return None
