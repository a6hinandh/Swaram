"""
ASHA Longitudinal Narrative Generator
Generates a concise, human-readable summary over confirmed records and open care gaps.
Answers: who is in the household, what changed recently, what care gaps remain, and next steps.
"""

from typing import Dict, Any, List

class NarrativeService:
    @staticmethod
    def generate_narrative(household_name: str, recent_visits: List[Dict[str, Any]], open_gaps: List[Dict[str, Any]]) -> str:
        lines = [f"Household: {household_name}"]

        # Recent activities
        if recent_visits:
            lines.append("Recent:")
            for v in recent_visits[-2:]:
                for update in v.get("person_updates", []):
                    vitals = update.get("vitals") or {}
                    bp_str = f"BP {vitals.get('systolic_bp')}/{vitals.get('diastolic_bp')} mmHg" if vitals.get("systolic_bp") else ""
                    lines.append(f" - {update.get('name')}: Encounter recorded. {bp_str}")
        else:
            lines.append("Recent: Initial registration complete.")

        # Open care gaps
        if open_gaps:
            lines.append("Open Care Gaps:")
            for gap in open_gaps:
                lines.append(f" - [{gap.get('programme').upper()}] {gap.get('description')} (Due: {gap.get('due_date', 'N/A')})")
        else:
            lines.append("Open Care Gaps: None. All immunisations and checkups up to date.")

        # Next visit checklist
        lines.append("Next Visit Checklist:")
        lines.append(" - Recheck BP and maternal vitals.")
        lines.append(" - Verify MCP card for pending child vaccine.")
        
        return "\n".join(lines)
