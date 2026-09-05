"""
Explainable Household Visit Prioritisation Engine
Calculates transparent weighted priority scores with human-readable contributing reasons and sub-score breakdowns.
Specifically evaluates malnutrition risks, overdue health needs, clinical vitals, and longitudinal household vulnerability.

Formula:
  priority_score = min(100.0,
      (w_urgency * urgency_score) +
      (w_overdue * overdue_score) +
      (w_risk * risk_score) +
      (w_followup * followup_score) +
      (w_vuln * vulnerability_score)
  )
"""

from typing import Dict, Any, List, Tuple
from datetime import datetime, date

class PriorityEngine:
    # Heuristic weights summing to 100.0 max capacity
    W_URGENCY = 25.0
    W_OVERDUE = 30.0
    W_RISK = 20.0
    W_FOLLOWUP = 15.0
    W_VULNERABILITY = 10.0

    @classmethod
    def calculate_household_priority(
        cls,
        household: Dict[str, Any],
        care_gaps: List[Dict[str, Any]],
        reference_date: str = None
    ) -> Tuple[float, List[str], Dict[str, float]]:
        """
        Calculates the explainable priority score for a household.
        Returns:
            Tuple of (final_score, human_readable_reasons, sub_score_breakdown)
        """
        reasons: List[str] = []
        breakdown: Dict[str, float] = {
            "urgency": 0.0,
            "overdue": 0.0,
            "risk": 0.0,
            "followup": 0.0,
            "vulnerability": 0.0
        }

        # Reference date for overdue calculation (defaults to 2026-09-05 or current date)
        if reference_date:
            try:
                ref_dt = datetime.fromisoformat(reference_date).date()
            except Exception:
                ref_dt = date.today()
        else:
            ref_dt = date.today()

        # 1. URGENCY COMPONENT (Max: 25.0)
        critical_count = sum(1 for g in care_gaps if g.get("severity") == "critical")
        high_count = sum(1 for g in care_gaps if g.get("severity") == "high")

        for g in care_gaps:
            if g.get("severity") == "critical":
                reasons.append(f"Critical health gap: {g.get('description', g.get('gap_type', ''))}")
            elif g.get("severity") == "high":
                reasons.append(f"High-priority care gap: {g.get('description', g.get('gap_type', ''))}")

        if critical_count > 0:
            breakdown["urgency"] = cls.W_URGENCY
        elif high_count > 0:
            breakdown["urgency"] = cls.W_URGENCY
        else:
            breakdown["urgency"] = 0.0

        # 2. OVERDUE COMPONENT (Max: 30.0)
        max_overdue_days = 0
        overdue_gaps_count = 0

        for g in care_gaps:
            due_date_str = g.get("due_date")
            if due_date_str:
                try:
                    due_dt = datetime.strptime(due_date_str[:10], "%Y-%m-%d").date()
                    if ref_dt > due_dt:
                        days = (ref_dt - due_dt).days
                        overdue_gaps_count += 1
                        if days > max_overdue_days:
                            max_overdue_days = days
                except Exception:
                    pass

        if max_overdue_days > 0:
            norm_factor = min(1.0, max_overdue_days / 13.0)
            breakdown["overdue"] = round(norm_factor * cls.W_OVERDUE, 1)
            reasons.append(f"Care gap is {max_overdue_days} days overdue (exceeds threshold)")
        elif any(g.get("status") in ["open", "needs_information"] for g in care_gaps):
            breakdown["overdue"] = round(cls.W_OVERDUE * 0.3, 1)

        # 3. CLINICAL RISK / VITALS & MALNUTRITION COMPONENT (Max: 20.0)
        latest_vitals = household.get("latest_vitals", {})
        systolic = latest_vitals.get("systolic_bp")
        diastolic = latest_vitals.get("diastolic_bp")

        if systolic and systolic >= 140:
            breakdown["risk"] = cls.W_RISK
            reasons.append(f"Elevated blood pressure observed: {systolic}/{diastolic or '?'} mmHg")
        elif systolic and systolic >= 130:
            breakdown["risk"] = round(cls.W_RISK * 0.6, 1)
            reasons.append(f"Pre-hypertensive blood pressure: {systolic} mmHg")

        hb = latest_vitals.get("hemoglobin_g_dl")
        if hb and hb < 11.0:
            reasons.append(f"Low hemoglobin detected ({hb} g/dL, indicates maternal nutritional anemia)")

        # Malnutrition Risk Checks
        malnutrition_risk = household.get("malnutrition_risk")
        if malnutrition_risk in ["Severe", "severe"]:
            breakdown["risk"] = cls.W_RISK
            reasons.append("Severe Acute Malnutrition (SAM) risk identified in household")
        elif malnutrition_risk in ["Moderate", "moderate"]:
            if breakdown["risk"] < round(cls.W_RISK * 0.6, 1):
                breakdown["risk"] = round(cls.W_RISK * 0.6, 1)
            reasons.append("Child malnutrition vulnerability flagged (Low dietary diversity / MUAC monitoring)")

        symptoms = household.get("active_symptoms", [])
        if symptoms:
            reasons.append(f"Reported symptoms requiring attention: {', '.join(symptoms)}")

        # 4. UNRESOLVED FOLLOWUPS COUNT (Max: 15.0)
        open_count = sum(1 for g in care_gaps if g.get("status") in ["open", "needs_information", "action_ready"])
        if open_count >= 2:
            breakdown["followup"] = cls.W_FOLLOWUP
            reasons.append(f"{open_count} open care ledger items require follow-up")
        elif open_count == 1:
            breakdown["followup"] = round(cls.W_FOLLOWUP * 0.5, 1)
            reasons.append(f"{open_count} open care ledger item requires follow-up")

        # 5. VULNERABILITY / DEMOGRAPHIC RISK (Max: 10.0)
        vulnerability = household.get("vulnerability_factors", {})
        if (vulnerability.get("has_pregnant_woman") or 
            vulnerability.get("has_infant_under_1") or 
            vulnerability.get("elderly_alone") or
            vulnerability.get("child_malnutrition_flag")):
            breakdown["vulnerability"] = cls.W_VULNERABILITY
            reasons.append("Household flagged with high-vulnerability demographics")

        # Calculate final combined score
        total_score = sum(breakdown.values())
        final_score = round(min(100.0, total_score), 1)

        if not reasons:
            reasons.append("Routine scheduled follow-up")

        return final_score, reasons, breakdown
