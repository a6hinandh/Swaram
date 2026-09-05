"""
Deterministic Clinical & Malnutrition Validator
Ensures extracted values fall within physiologically valid limits, detects uncertainties,
and screens for malnutrition risks using established WHO / IAP guidelines.
Never invents clinical diagnosis; merely flags values for ASHA review and verification.
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
            elif sys_bp >= 130:
                flags.append(f"Pre-hypertensive Systolic BP: {sys_bp} mmHg")

        # Diastolic BP
        dia_bp = vitals.get("diastolic_bp")
        if dia_bp is not None:
            if dia_bp < 40 or dia_bp > 150:
                flags.append(f"Invalid Diastolic BP: {dia_bp} mmHg (outside 40-150 range)")
            elif dia_bp >= 90:
                flags.append(f"Elevated Diastolic BP: {dia_bp} mmHg requires review")

        # Weight
        weight = vitals.get("weight_kg")
        if weight is not None and (weight < 1.5 or weight > 220):
            flags.append(f"Implausible weight: {weight} kg")

        # Temperature
        temp = vitals.get("temperature_c")
        if temp is not None and (temp < 34 or temp > 43):
            flags.append(f"Implausible body temperature: {temp} °C")

        # Hemoglobin (Maternal/Adolescent Anemia Check)
        hb = vitals.get("hemoglobin_g_dl")
        if hb is not None:
            if hb < 7.0:
                flags.append(f"Severe anemia detected: Hemoglobin {hb} g/dL (Immediate MO referral required)")
            elif hb < 11.0:
                flags.append(f"Moderate anemia detected: Hemoglobin {hb} g/dL (Requires IFA supplementation)")

        return flags

    @staticmethod
    def validate_malnutrition(malnutrition: Dict[str, Any]) -> List[str]:
        """
        Validates malnutrition parameters according to WHO child growth & nutrition standards.
        """
        flags = []
        if not malnutrition:
            return flags

        muac = malnutrition.get("muac_cm")
        if muac is not None:
            if muac < 5.0 or muac > 25.0:
                flags.append(f"Implausible MUAC reading: {muac} cm (standard range 5-25 cm)")
            elif muac < 11.5:
                flags.append(f"Red Alert: MUAC {muac} cm indicates Severe Acute Malnutrition (SAM)")
            elif muac < 12.5:
                flags.append(f"Yellow Alert: MUAC {muac} cm indicates Moderate Acute Malnutrition (MAM)")

        dds = malnutrition.get("dietary_diversity_score")
        if dds is not None:
            if dds < 4:
                flags.append(f"Low dietary diversity score: {dds}/8 food groups (Risk of micronutrient deficiency)")

        if malnutrition.get("edema_present"):
            flags.append("Critical Warning: Bilateral pitting edema reported (SAM emergency indicator)")

        return flags
