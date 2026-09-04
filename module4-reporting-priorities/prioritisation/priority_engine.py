"""
Explainable Household Visit Prioritisation Engine
Calculates transparent weighted priority scores with human-readable contributing reasons.
Formula:
  priority_score = (w_urgency * urgency) + (w_overdue * overdue_norm) +
                   (w_risk * risk_flags) + (w_followup * unresolved_gaps) +
                   (w_vuln * vulnerability)
"""

from typing import Dict, Any, List, Tuple

class PriorityEngine:
    # Tunable heuristic weights
    W_URGENCY = 25.0
    W_OVERDUE = 30.0
    W_RISK = 20.0
    W_FOLLOWUP = 15.0
    W_VULNERABILITY = 10.0

    @classmethod
    def calculate_household_priority(cls, household: Dict[str, Any], care_gaps: List[Dict[str, Any]]) -> Tuple[float, List[str]]:
        reasons = []
        score = 0.0

        # 1. Overdue care gaps
        overdue_count = 0
        for gap in care_gaps:
            if gap.get("severity") in ["high", "critical"]:
                score += cls.W_URGENCY
                reasons.append(f"High-priority care gap: {gap.get('description')}")
            
            if gap.get("status") in ["open", "needs_information"]:
                overdue_count += 1

        if overdue_count > 0:
            score += min(cls.W_OVERDUE * (overdue_count / 3.0), cls.W_OVERDUE)
            reasons.append(f"{overdue_count} unresolved care gaps require field review")

        # 2. Vitals / Risk indicators
        recent_bp = household.get("latest_vitals", {}).get("systolic_bp")
        if recent_bp and recent_bp >= 140:
            score += cls.W_RISK
            reasons.append(f"Elevated blood pressure observed ({recent_bp} mmHg)")

        # Cap score between 0 and 100
        final_score = round(min(score, 100.0), 1)
        if not reasons:
            reasons.append("Routine scheduled follow-up")

        return final_score, reasons
