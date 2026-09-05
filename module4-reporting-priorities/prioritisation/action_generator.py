"""
Action Generator
Converts confirmed care gaps into concrete tasks with deadlines and assigned owners.
Strictly adheres to contracts/reporting.schema.json (ActionItem definition).
Generates targeted operational actions for malnutrition intervention, survey follow-up, and clinical checkups.
"""

import uuid
from datetime import datetime, timedelta, date
from typing import Dict, Any, List

class ActionGenerator:
    @staticmethod
    def generate_actions_for_gaps(
        household_id: str,
        care_gaps: List[Dict[str, Any]],
        default_due_days: int = 7
    ) -> List[Dict[str, Any]]:
        """
        Synthesizes actionable tasks for each unresolved care gap.
        """
        actions = []
        now_date = date.today()
        default_due = (now_date + timedelta(days=default_due_days)).isoformat()

        for gap in care_gaps:
            # Only create actions for active / unresolved gaps
            if gap.get("status") in ["resolved", "declined", "unable_to_complete"]:
                continue

            gap_id = gap.get("id")
            try:
                care_gap_uuid = str(uuid.UUID(gap_id))
            except Exception:
                care_gap_uuid = str(uuid.uuid4())

            # Title formulation based on programme & gap_type
            programme_raw = gap.get("programme", "maternal")
            programme = programme_raw.replace("_", " ").title()
            gap_type = gap.get("gap_type", "Health Follow-up").replace("_", " ").title()
            title = f"{programme}: {gap_type}"

            # Assigned owner logic
            severity = gap.get("severity", "medium")
            if severity == "critical":
                assigned = gap.get("owner") or "Medical Officer / PHC Referral"
            else:
                assigned = gap.get("owner") or "ASHA Worker (Ward 4)"

            default_desc = "Conduct field visit and verify observations."
            gap_type_raw = gap.get("gap_type", "")
            if gap_type_raw == "vitals_delta_hypertensive_spurt":
                default_desc = "Conduct urgent home visit within 48h: verify anti-hypertensive drug adherence, re-measure BP, and alert Medical Officer."
            elif gap_type_raw == "child_growth_velocity_faltering":
                default_desc = "Initiate pediatric nutrition follow-up: counsel on eggs/milk/pulses diversity, inspect for recurrent illness, and schedule 7-day weight re-check."
            elif gap_type_raw == "acute_glycemic_drift":
                default_desc = "Verify diabetic medication compliance, diet controls, and schedule PHC fasting blood sugar test."
            elif programme_raw == "malnutrition":
                default_desc = "Counsel family on child dietary diversity (milk/eggs/pulses) and monitor MUAC."
            elif programme_raw == "maternal":
                default_desc = "Conduct home visit for BP measurement, IFA tablet distribution, and fetal health review."

            action = {
                "action_id": str(uuid.uuid4()),
                "household_id": household_id,
                "care_gap_id": care_gap_uuid,
                "title": title,
                "description": gap.get("recommended_action") or default_desc or gap.get("description"),
                "assigned_to": assigned,
                "due_date": gap.get("due_date") or default_due,
                "status": "pending"
            }
            actions.append(action)

        return actions
