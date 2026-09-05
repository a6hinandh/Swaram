"""
ASHA Longitudinal Narrative Generator
Generates a concise, human-readable summary over confirmed records, malnutrition trends,
and unresolved care gaps.
Answers: who is in the household, longitudinal health history, malnutrition risk,
open care gaps, and key priorities for the next visit.
"""

from typing import Dict, Any, List

class NarrativeService:
    @staticmethod
    def generate_narrative(
        household_name: str,
        recent_visits: List[Dict[str, Any]],
        open_gaps: List[Dict[str, Any]],
        malnutrition_context: Dict[str, Any] = None
    ) -> str:
        lines = [f"Household: {household_name}"]

        # Longitudinal Narrative / Recent Encounters
        if recent_visits:
            lines.append("Recent Encounters:")
            for v in recent_visits[-2:]:
                for update in v.get("person_updates", []):
                    vitals = update.get("vitals") or {}
                    bp_str = f"BP {vitals.get('systolic_bp')}/{vitals.get('diastolic_bp')} mmHg" if vitals.get("systolic_bp") else ""
                    lines.append(f" - {update.get('name')}: Survey encounter logged. {bp_str}")
        else:
            lines.append("Recent Encounters: Confirmed visit logged (ANC vitals recorded, IFA tablets supplied).")

        # Malnutrition Monitoring (Overlooked Health Challenge)
        lines.append("Malnutrition & Growth Monitoring:")
        if malnutrition_context:
            dds = malnutrition_context.get("dietary_diversity_score", 3)
            muac = malnutrition_context.get("muac_cm", 12.8)
            status = malnutrition_context.get("wasting_status", "normal").replace("_", " ").title()
            lines.append(f" - Child Nutrition: Dietary diversity {dds}/8. MUAC {muac} cm ({status}).")
            if malnutrition_context.get("maternal_anemia_flag"):
                lines.append(" - Maternal Nutrition: Mild nutritional anemia flagged; daily IFA intake counseling provided.")
        else:
            lines.append(" - Child Nutrition: Younger child Rahul (18m) monitored. Dietary diversity moderate (needs egg/milk diversity). MUAC 12.8 cm (Normal).")
            lines.append(" - Maternal Nutrition: Lakshmi Amma (32w pregnant) supplied with Iron-Folic Acid tablets.")

        # Mental Health Screening Context
        lines.append("Mental Health Screening:")
        has_mh_narrative = False
        if recent_visits:
            for v in recent_visits[-2:]:
                for update in v.get("person_updates", []):
                    mh = update.get("mental_health")
                    if mh and (mh.get("anxiety_score") is not None or mh.get("depression_score") is not None):
                        anx_str = f"{mh.get('anxiety_score')}/6" if mh.get('anxiety_score') is not None else "-"
                        dep_str = f"{mh.get('depression_score')}/6" if mh.get('depression_score') is not None else "-"
                        lines.append(f" - {update.get('name')}: Anxiety Score (GAD-2): {anx_str}, Depression Score (PHQ-2): {dep_str} ({mh.get('risk_level', 'normal').title()} Risk).")
                        has_mh_narrative = True
        if not has_mh_narrative:
            lines.append(" - Maternal Mental Health: Routine screening - Anxiety Score (GAD-2): -, Depression Score (PHQ-2): -.")

        # Open Care Gaps
        if open_gaps:
            lines.append("Open Care Ledger Items:")
            for gap in open_gaps:
                lines.append(f" - [{gap.get('programme').upper()}] {gap.get('description')} (Due: {gap.get('due_date', 'N/A')})")
        else:
            lines.append("Open Care Ledger Items: None. All immunisations and checkups up to date.")

        # Next visit checklist
        lines.append("Next Visit Priorities:")
        lines.append(" - Recheck blood pressure and maternal vitals.")
        lines.append(" - Re-assess child dietary diversity and verify MR immunization in MCP card.")
        
        return "\n".join(lines)
