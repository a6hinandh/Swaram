"""
Action Generator
Converts confirmed care gaps into concrete tasks with deadlines and assigned owners.
"""

import uuid
from typing import Dict, Any, List

class ActionGenerator:
    @staticmethod
    def generate_actions_for_gaps(household_id: str, care_gaps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        actions = []
        for gap in care_gaps:
            action = {
                "action_id": str(uuid.uuid4()),
                "household_id": household_id,
                "care_gap_id": gap.get("id"),
                "title": f"Follow-up on {gap.get('programme', 'health').title()}: {gap.get('gap_type')}",
                "description": gap.get("recommended_action", "Conduct field visit"),
                "assigned_to": gap.get("owner", "ASHA Worker (Ward 4)"),
                "due_date": gap.get("due_date", "2026-09-15"),
                "status": "pending"
            }
            actions.append(action)
        return actions
