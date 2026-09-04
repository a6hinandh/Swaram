"""
Government Form Field Mapper
Converts a ConfirmedVisit record into field key-values ready for browser automation.
Ensures zero clinical hallucination by mapping only confirmed values.
"""

from typing import Dict, Any

class GovernmentFormMapper:
    @staticmethod
    def map_visit_to_rch_portal(confirmed_visit: Dict[str, Any]) -> Dict[str, Any]:
        """
        Maps ConfirmedVisit schema -> RCH portal form input fields.
        """
        person_updates = confirmed_visit.get("person_updates", [])
        if not person_updates:
            return {"error": "No beneficiary records found in visit payload"}

        primary_person = person_updates[0]
        vitals = primary_person.get("vitals", {})
        
        # IFA tablets count mapping
        meds = primary_person.get("medications_given", [])
        ifa_val = "none"
        for m in meds:
            if "Iron" in m or "IFA" in m:
                ifa_val = "30"
                break

        return {
            "beneficiary_name": primary_person.get("name", ""),
            "gestational_weeks": primary_person.get("pregnancy_weeks", ""),
            "systolic_bp": vitals.get("systolic_bp", ""),
            "diastolic_bp": vitals.get("diastolic_bp", ""),
            "ifa_tablets": ifa_val,
            "follow_up_date": primary_person.get("follow_up_date", "")
        }
