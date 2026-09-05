"""
WHO LMS Child Growth Standards Engine (Ages 0 - 60 Months)
Provides deterministic Weight-for-Age (WAZ) & Height-for-Age (HAZ) Z-score calculation
and growth velocity faltering detection for infant/child profiles ONLY.
"""

import re
from typing import Dict, Any, Optional, Tuple

INFANT_CHILD_KEYWORDS = [
    "കുട്ടി", "കുഞ്ഞ്", "വാവ", "വാവയ്ക്ക്", "മകൻ", "മകൾ",
    "infant", "child", "baby", "kid", "toddler", "pediatric"
]

ADULT_EXCLUSION_KEYWORDS = [
    "അമ്മ", "മുത്തശ്ശി", "വല്യമ്മ", "ഭാര്യ", "ഗർഭിണി", "ഗർഭം", "പ്രസവിച്ചു",
    "adult", "pregnant", "pregnancy", "elderly"
]

# WHO Weight-for-Age (WAZ) LMS Reference Parameters for Boys & Girls (0 - 60 Months)
WHO_WAZ_BOYS_LMS = {
    0: (0.3487, 3.346, 0.14602),
    6: (0.0543, 7.854, 0.11718),
    12: (-0.0573, 9.646, 0.11304),
    18: (-0.1235, 10.902, 0.11211),
    24: (-0.1706, 12.151, 0.11244),
    36: (-0.2335, 14.338, 0.11470),
    48: (-0.2745, 16.327, 0.11860),
    60: (-0.3060, 18.344, 0.12330),
}

WHO_WAZ_GIRLS_LMS = {
    0: (0.3954, 3.232, 0.14171),
    6: (0.0768, 7.297, 0.12130),
    12: (-0.0469, 8.952, 0.11651),
    18: (-0.1239, 10.158, 0.11579),
    24: (-0.1772, 11.484, 0.11648),
    36: (-0.2476, 13.882, 0.11976),
    48: (-0.2938, 16.052, 0.12457),
    60: (-0.3292, 18.232, 0.13028),
}

def is_infant_profile(
    transcript: str,
    age_months: Optional[int] = None,
    age_years: Optional[int] = None,
    weight_kg: Optional[float] = None,
    height_cm: Optional[float] = None
) -> bool:
    """
    Guard check: Returns True ONLY if the profile is identified as an infant/child (0-5 years).
    Strictly excludes adult profiles.
    """
    text_lower = transcript.lower()

    # 1. Adult exclusion check
    if any(k in transcript for k in ADULT_EXCLUSION_KEYWORDS):
        if not any(k in transcript for k in ["കുട്ടി", "വാവ", "child", "infant"]):
            return False

    if age_years is not None and age_years > 5:
        return False

    # 2. Check explicitly for child/infant keywords
    if any(k in transcript or k in text_lower for k in INFANT_CHILD_KEYWORDS):
        return True

    # 3. Check physical parameter ranges for infant/child (0-5 years)
    if age_months is not None and 0 <= age_months <= 60:
        return True

    if age_years is not None and 0 <= age_years <= 5:
        return True

    if weight_kg is not None and 1.0 <= weight_kg <= 22.0:
        if height_cm is not None and height_cm <= 120.0:
            return True

    return False

def get_closest_lms(age_months: int, gender: str = "male") -> Tuple[float, float, float]:
    """Finds the closest WHO LMS tuple for a given age in months."""
    lms_table = WHO_WAZ_BOYS_LMS if gender.lower() in ["boy", "male", "m"] else WHO_WAZ_GIRLS_LMS
    available_months = sorted(lms_table.keys())
    
    closest_month = min(available_months, key=lambda m: abs(m - age_months))
    return lms_table[closest_month]

def calculate_who_zscore(
    weight_kg: float,
    age_months: int = 18,
    gender: str = "male"
) -> Tuple[float, str]:
    """
    Calculates WHO Weight-for-Age Z-score (WAZ) using standard LMS formula:
      Z = ((X / M)^L - 1) / (L * S)
    Returns (z_score, classification) where classification is 'normal', 'mild', 'mam', or 'sam'.
    """
    L, M, S = get_closest_lms(age_months, gender)
    
    if L != 0:
        z = (((weight_kg / M) ** L) - 1.0) / (L * S)
    else:
        import math
        z = math.log(weight_kg / M) / S

    z_score = round(z, 2)

    # WHO Classification logic
    if z_score >= -1.0:
        category = "normal"
    elif z_score >= -2.0:
        category = "mild"
    elif z_score >= -3.0:
        category = "mam"
    else:
        category = "sam"

    return z_score, category

def evaluate_growth_velocity(
    current_weight: float,
    previous_weight: Optional[float] = None,
    days_between: int = 30
) -> Tuple[str, float]:
    """
    Detects growth faltering if weight plateaus or drops over a 30+ day window.
    """
    if previous_weight is None:
        return "normal", 0.0

    delta = round(current_weight - previous_weight, 2)
    if delta < 0:
        return "weight_loss", delta
    elif delta == 0 and days_between >= 30:
        return "faltering", delta
    else:
        return "normal", delta
