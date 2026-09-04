"""
Deterministic Clinical Validator
Ensures extracted values fall within physiologically valid limits and detects uncertainties.
Never invents clinical diagnosis; merely flags values for ASHA review.
"""

from typing import Dict, Any, List

class ClinicalValidator:
    @staticmethod
    def validate_vitals(vitals: Dict[str, Any]) -> List[str]:
        flags = []
        
        # Systolic BP
        sys_bp = vitals.get("systolic_bp")
        if sys_bp is not None:
            if sys_bp < 60 or sys_bp > 250:
                flags.append(f"Invalid Systolic BP: {sys_bp} mmHg (outside 60-250 range)")
            elif sys_bp >= 140:
                flags.append(f"Elevated Systolic BP: {sys_bp} mmHg requires review")

        # Diastolic BP
        dia_bp = vitals.get("diastolic_bp")
        if dia_bp is not None:
            if dia_bp < 40 or dia_bp > 150:
                flags.append(f"Invalid Diastolic BP: {dia_bp} mmHg (outside 40-150 range)")
            elif dia_bp >= 90:
                flags.append(f"Elevated Diastolic BP: {dia_bp} mmHg requires review")

        # Weight
        weight = vitals.get("weight_kg")
        if weight is not None and (weight < 2 or weight > 220):
            flags.append(f"Implausible weight: {weight} kg")

        # Temperature
        temp = vitals.get("temperature_c")
        if temp is not None and (temp < 34 or temp > 43):
            flags.append(f"Implausible body temperature: {temp} °C")

        return flags
