"""
Swaram MongoDB Database Seeder & Migration Script
Hydrates live MongoDB Atlas with:
- Canonical households
- Household members (Persons)
- 6-month longitudinal clinical encounters (historical vitals)
- Longitudinal Vitals Baselines (EWMA moving averages & delta analyses)
- Household Care Ledgers with active care gaps & rich clinical narratives
- Time-bound operational actions
"""

import sys
import os
from pathlib import Path
from datetime import datetime, date

# Add app to path
sys.path.insert(0, str(Path(__file__).resolve().parent / "app"))

from db.database import (
    db,
    households_col,
    persons_col,
    encounters_col,
    vitals_baselines_col,
    care_ledgers_col,
    actions_col
)

def seed_database():
    if db is None:
        print("[Error] Cannot seed: MongoDB connection is None.")
        return False

    print("[Seed] Starting MongoDB database hydration for Swaram...")

    # 1. Clear existing demo data in these collections
    households_col.delete_many({})
    persons_col.delete_many({})
    encounters_col.delete_many({})
    vitals_baselines_col.delete_many({})
    care_ledgers_col.delete_many({})
    actions_col.delete_many({})

    print("[Seed] Existing records cleared.")

    # 2. Seed Households
    households = [
        {
            "id": "h-lakshmi-001",
            "external_id": "ASHA-WARD4-HH042",
            "head_of_household": "Lakshmi Amma",
            "address": "House 42, Kudumbashree Lane, Aluva",
            "ward": "Ward 4, Aluva",
            "members_count": 4,
            "open_care_gaps": 3,
            "priority_score": 92.5,
            "priority_reasons": [
                "Acute hypertensive spurt detected in Radhamani P. (+28 mmHg from baseline)",
                "Pediatric weight faltering flagged in child Rahul (-500g over 45 days)",
                "ANC 3rd trimester check overdue by 8 days"
            ],
            "malnutrition_risk": "Moderate",
            "vulnerability_factors": {
                "has_pregnant_woman": True,
                "has_infant_under_1": False,
                "has_toddler_under_5": True,
                "has_elderly_chronic": True,
                "child_malnutrition_flag": True
            },
            "updated_at": datetime.utcnow().isoformat() + "Z"
        },
        {
            "id": "h-suresh-002",
            "external_id": "ASHA-WARD4-HH043",
            "head_of_household": "Suresh Kumar",
            "address": "House 45, Temple Road, Aluva",
            "ward": "Ward 4, Aluva",
            "members_count": 3,
            "open_care_gaps": 1,
            "priority_score": 52.0,
            "priority_reasons": ["NCD Hypertension quarterly recheck due"],
            "malnutrition_risk": "Normal",
            "vulnerability_factors": {
                "has_pregnant_woman": False,
                "has_infant_under_1": False,
                "has_toddler_under_5": False,
                "has_elderly_chronic": False,
                "child_malnutrition_flag": False
            },
            "updated_at": datetime.utcnow().isoformat() + "Z"
        },
        {
            "id": "h-anitha-003",
            "external_id": "ASHA-WARD4-HH044",
            "head_of_household": "Anitha Kumari",
            "address": "House 51, River View, Aluva",
            "ward": "Ward 4, Aluva",
            "members_count": 4,
            "open_care_gaps": 0,
            "priority_score": 25.0,
            "priority_reasons": ["Routine community health follow-up"],
            "malnutrition_risk": "Normal",
            "vulnerability_factors": {
                "has_pregnant_woman": False,
                "has_infant_under_1": False,
                "has_toddler_under_5": True,
                "has_elderly_chronic": False,
                "child_malnutrition_flag": False
            },
            "updated_at": datetime.utcnow().isoformat() + "Z"
        }
    ]
    households_col.insert_many(households)
    print(f"[Seed] Inserted {len(households)} households.")

    # 3. Seed Persons
    persons = [
        {
            "person_id": "p-radhamani-01",
            "household_id": "h-lakshmi-001",
            "name": "Radhamani P.",
            "age": 62,
            "gender": "female",
            "relationship": "mother-in-law",
            "life_stage": "elderly",
            "pregnancy_status": "not_pregnant",
            "chronic_conditions": ["Hypertension", "Type 2 Diabetes"],
            "created_at": "2026-01-10T08:00:00Z"
        },
        {
            "person_id": "p-lakshmi-01",
            "household_id": "h-lakshmi-001",
            "name": "Lakshmi Amma",
            "age": 28,
            "gender": "female",
            "relationship": "self",
            "life_stage": "adult",
            "pregnancy_status": "pregnant",
            "pregnancy_weeks": 32,
            "chronic_conditions": ["Nutritional Anemia"],
            "created_at": "2026-01-10T08:00:00Z"
        },
        {
            "person_id": "p-rahul-02",
            "household_id": "h-lakshmi-001",
            "name": "Rahul",
            "age": 1.5,
            "gender": "male",
            "relationship": "child",
            "life_stage": "infant",
            "pregnancy_status": "not_pregnant",
            "chronic_conditions": [],
            "created_at": "2026-01-10T08:00:00Z"
        },
        {
            "person_id": "p-vijayan-01",
            "household_id": "h-lakshmi-001",
            "name": "Vijayan K.",
            "age": 35,
            "gender": "male",
            "relationship": "husband",
            "life_stage": "adult",
            "pregnancy_status": "not_pregnant",
            "chronic_conditions": [],
            "created_at": "2026-01-10T08:00:00Z"
        },
        {
            "person_id": "p-suresh-01",
            "household_id": "h-suresh-002",
            "name": "Suresh Kumar",
            "age": 52,
            "gender": "male",
            "relationship": "head",
            "life_stage": "adult",
            "pregnancy_status": "not_pregnant",
            "chronic_conditions": ["Hypertension"],
            "created_at": "2026-02-15T09:00:00Z"
        },
        {
            "person_id": "p-sunitha-02",
            "household_id": "h-suresh-002",
            "name": "Sunitha S.",
            "age": 48,
            "gender": "female",
            "relationship": "wife",
            "life_stage": "adult",
            "pregnancy_status": "not_pregnant",
            "chronic_conditions": [],
            "created_at": "2026-02-15T09:00:00Z"
        },
        {
            "person_id": "p-akhil-03",
            "household_id": "h-suresh-002",
            "name": "Akhil Suresh",
            "age": 22,
            "gender": "male",
            "relationship": "son",
            "life_stage": "adult",
            "pregnancy_status": "not_pregnant",
            "chronic_conditions": [],
            "created_at": "2026-02-15T09:00:00Z"
        },
        {
            "person_id": "p-anitha-01",
            "household_id": "h-anitha-003",
            "name": "Anitha Kumari",
            "age": 44,
            "gender": "female",
            "relationship": "head",
            "life_stage": "adult",
            "pregnancy_status": "not_pregnant",
            "chronic_conditions": [],
            "created_at": "2026-03-01T08:00:00Z"
        },
        {
            "person_id": "p-mohan-02",
            "household_id": "h-anitha-003",
            "name": "Mohanan P.",
            "age": 47,
            "gender": "male",
            "relationship": "husband",
            "life_stage": "adult",
            "pregnancy_status": "not_pregnant",
            "chronic_conditions": ["Hypertension"],
            "created_at": "2026-03-01T08:00:00Z"
        },
        {
            "person_id": "p-meera-03",
            "household_id": "h-anitha-003",
            "name": "Meera M.",
            "age": 16,
            "gender": "female",
            "relationship": "daughter",
            "life_stage": "adolescent",
            "pregnancy_status": "not_pregnant",
            "chronic_conditions": ["Anemia"],
            "created_at": "2026-03-01T08:00:00Z"
        },
        {
            "person_id": "p-karthik-04",
            "household_id": "h-anitha-003",
            "name": "Karthik M.",
            "age": 12,
            "gender": "male",
            "relationship": "son",
            "life_stage": "child",
            "pregnancy_status": "not_pregnant",
            "chronic_conditions": [],
            "created_at": "2026-03-01T08:00:00Z"
        }
    ]
    persons_col.insert_many(persons)
    print(f"[Seed] Inserted {len(persons)} persons.")

    # 4. Seed Clinical Encounters (6-Month Longitudinal History)
    encounters = [
        # Radhamani P. historical visits (stable 120/80 baseline)
        {
            "visit": { "visit_id": "v-rad-01", "household_id": "h-lakshmi-001", "date": "2026-03-12", "visit_type": "routine" },
            "person": { "person_id": "p-radhamani-01", "name": "Radhamani P.", "age": 62, "sex": "female", "relationship": "mother-in-law", "life_stage": "elderly", "pregnancy_status": "not_pregnant" },
            "health_status": { "complaints": [], "known_conditions": [{"condition": "Hypertension", "status": "active"}], "medications": [{"name": "Amlodipine 5mg", "taking": "yes", "adherence": "regular", "available": "yes"}] },
            "measurements": { "blood_pressure": "118/78", "blood_pressure_sys": 118, "blood_pressure_dia": 78, "blood_sugar_mg_dl": 110, "pulse_bpm": 72, "weight_kg": 56.2 },
            "extraction": { "overall_confidence": "high", "fields_needing_confirmation": [] }
        },
        {
            "visit": { "visit_id": "v-rad-02", "household_id": "h-lakshmi-001", "date": "2026-04-15", "visit_type": "routine" },
            "person": { "person_id": "p-radhamani-01", "name": "Radhamani P.", "age": 62, "sex": "female", "relationship": "mother-in-law", "life_stage": "elderly", "pregnancy_status": "not_pregnant" },
            "health_status": { "complaints": [], "known_conditions": [{"condition": "Hypertension", "status": "active"}], "medications": [{"name": "Amlodipine 5mg", "taking": "yes", "adherence": "regular", "available": "yes"}] },
            "measurements": { "blood_pressure": "120/80", "blood_pressure_sys": 120, "blood_pressure_dia": 80, "blood_sugar_mg_dl": 112, "pulse_bpm": 70, "weight_kg": 56.4 },
            "extraction": { "overall_confidence": "high", "fields_needing_confirmation": [] }
        },
        {
            "visit": { "visit_id": "v-rad-03", "household_id": "h-lakshmi-001", "date": "2026-05-20", "visit_type": "routine" },
            "person": { "person_id": "p-radhamani-01", "name": "Radhamani P.", "age": 62, "sex": "female", "relationship": "mother-in-law", "life_stage": "elderly", "pregnancy_status": "not_pregnant" },
            "health_status": { "complaints": [], "known_conditions": [{"condition": "Hypertension", "status": "active"}], "medications": [{"name": "Amlodipine 5mg", "taking": "yes", "adherence": "regular", "available": "yes"}] },
            "measurements": { "blood_pressure": "122/82", "blood_pressure_sys": 122, "blood_pressure_dia": 82, "blood_sugar_mg_dl": 118, "pulse_bpm": 74, "weight_kg": 56.5 },
            "extraction": { "overall_confidence": "high", "fields_needing_confirmation": [] }
        },
        {
            "visit": { "visit_id": "v-rad-04", "household_id": "h-lakshmi-001", "date": "2026-06-25", "visit_type": "routine" },
            "person": { "person_id": "p-radhamani-01", "name": "Radhamani P.", "age": 62, "sex": "female", "relationship": "mother-in-law", "life_stage": "elderly", "pregnancy_status": "not_pregnant" },
            "health_status": { "complaints": [], "known_conditions": [{"condition": "Hypertension", "status": "active"}], "medications": [{"name": "Amlodipine 5mg", "taking": "yes", "adherence": "regular", "available": "yes"}] },
            "measurements": { "blood_pressure": "119/79", "blood_pressure_sys": 119, "blood_pressure_dia": 79, "blood_sugar_mg_dl": 114, "pulse_bpm": 72, "weight_kg": 56.5 },
            "extraction": { "overall_confidence": "high", "fields_needing_confirmation": [] }
        },
        {
            "visit": { "visit_id": "v-rad-05", "household_id": "h-lakshmi-001", "date": "2026-07-30", "visit_type": "routine" },
            "person": { "person_id": "p-radhamani-01", "name": "Radhamani P.", "age": 62, "sex": "female", "relationship": "mother-in-law", "life_stage": "elderly", "pregnancy_status": "not_pregnant" },
            "health_status": { "complaints": [], "known_conditions": [{"condition": "Hypertension", "status": "active"}], "medications": [{"name": "Amlodipine 5mg", "taking": "yes", "adherence": "regular", "available": "yes"}] },
            "measurements": { "blood_pressure": "121/81", "blood_pressure_sys": 121, "blood_pressure_dia": 81, "blood_sugar_mg_dl": 116, "pulse_bpm": 73, "weight_kg": 56.6 },
            "extraction": { "overall_confidence": "high", "fields_needing_confirmation": [] }
        },
        # Radhamani P. acute deviation encounter today
        {
            "visit": { "visit_id": "v-rad-06-acute", "household_id": "h-lakshmi-001", "date": "2026-09-05", "visit_type": "follow_up" },
            "person": { "person_id": "p-radhamani-01", "name": "Radhamani P.", "age": 62, "sex": "female", "relationship": "mother-in-law", "life_stage": "elderly", "pregnancy_status": "not_pregnant" },
            "health_status": { "complaints": [{"symptom": "Dizziness / headache", "duration": "2 days", "severity": "moderate", "trend": "worsening"}], "known_conditions": [{"condition": "Hypertension", "status": "active"}], "medications": [{"name": "Amlodipine 5mg", "taking": "no", "adherence": "irregular", "available": "yes"}] },
            "measurements": { "blood_pressure": "148/92", "blood_pressure_sys": 148, "blood_pressure_dia": 92, "blood_sugar_mg_dl": 185, "pulse_bpm": 76, "weight_kg": 56.8 },
            "extraction": { "overall_confidence": "high", "fields_needing_confirmation": [] }
        },

        # Child Rahul growth history (stable -> sudden drop)
        {
            "visit": { "visit_id": "v-rahul-01", "household_id": "h-lakshmi-001", "date": "2026-06-01", "visit_type": "routine" },
            "person": { "person_id": "p-rahul-02", "name": "Rahul", "age": 1.25, "sex": "male", "relationship": "child", "life_stage": "infant", "pregnancy_status": "not_pregnant" },
            "health_status": { "complaints": [], "known_conditions": [], "medications": [] },
            "measurements": { "weight_kg": 10.0, "muac_cm": 13.0, "height_cm": 78 },
            "nutrition": { "appetite": "normal", "feeding_concern": "no", "food_access_problem": "no" },
            "extraction": { "overall_confidence": "high", "fields_needing_confirmation": [] }
        },
        {
            "visit": { "visit_id": "v-rahul-02", "household_id": "h-lakshmi-001", "date": "2026-07-20", "visit_type": "routine" },
            "person": { "person_id": "p-rahul-02", "name": "Rahul", "age": 1.4, "sex": "male", "relationship": "child", "life_stage": "infant", "pregnancy_status": "not_pregnant" },
            "health_status": { "complaints": [], "known_conditions": [], "medications": [] },
            "measurements": { "weight_kg": 10.2, "muac_cm": 13.1, "height_cm": 80 },
            "nutrition": { "appetite": "normal", "feeding_concern": "no", "food_access_problem": "no" },
            "extraction": { "overall_confidence": "high", "fields_needing_confirmation": [] }
        },
        {
            "visit": { "visit_id": "v-rahul-03-faltering", "household_id": "h-lakshmi-001", "date": "2026-09-05", "visit_type": "follow_up" },
            "person": { "person_id": "p-rahul-02", "name": "Rahul", "age": 1.5, "sex": "male", "relationship": "child", "life_stage": "infant", "pregnancy_status": "not_pregnant" },
            "health_status": { "complaints": [{"symptom": "Reduced appetite following fever", "duration": "1 week", "severity": "mild", "trend": "improving"}], "known_conditions": [], "medications": [] },
            "measurements": { "weight_kg": 9.7, "muac_cm": 12.6, "height_cm": 81 },
            "nutrition": { "appetite": "reduced", "feeding_concern": "yes", "food_access_problem": "no" },
            "extraction": { "overall_confidence": "high", "fields_needing_confirmation": [] }
        }
    ]
    encounters_col.insert_many(encounters)
    print(f"[Seed] Inserted {len(encounters)} longitudinal clinical encounters.")

    # 5. Seed Vitals Baselines (EWMA moving averages & delta analyses)
    baselines = [
        {
            "person_id": "p-radhamani-01",
            "household_id": "h-lakshmi-001",
            "person_name": "Radhamani P.",
            "age": 62,
            "gender": "female",
            "baseline_metrics": {
                "systolic_bp": 120.0,
                "diastolic_bp": 80.0,
                "random_blood_sugar_mg_dl": 115.0,
                "pulse_bpm": 72.0,
                "weight_kg": 56.5,
                "muac_cm": None
            },
            "rolling_statistics": {
                "sample_count": 6,
                "systolic_std_dev": 4.2,
                "systolic_min": 118.0,
                "systolic_max": 148.0,
                "weight_velocity_kg_per_month": 0.1
            },
            "latest_measurement": {
                "systolic_bp": 148.0,
                "diastolic_bp": 92.0,
                "random_blood_sugar_mg_dl": 185.0,
                "pulse_bpm": 76.0,
                "weight_kg": 56.8,
                "measured_at": "2026-09-05T10:30:00Z",
                "visit_id": "v-rad-06-acute"
            },
            "latest_delta_analysis": {
                "systolic_delta": 28.0,
                "diastolic_delta": 12.0,
                "glucose_delta": 70.0,
                "pulse_delta": 4.0,
                "weight_delta_kg": 0.3,
                "is_hypertensive_spurt": True,
                "is_acute_crisis": False,
                "pediatric_velocity_status": "not_applicable",
                "severity": "moderate_drift",
                "alert_headline": "Acute Hypertensive Deviation & Baseline Drift",
                "clinical_action": "Systolic spurt +28 mmHg exceeds 20 mmHg threshold. Verify medication adherence and re-check BP in 48h."
            },
            "recent_history_points": [
                { "date": "2026-03-12", "systolic": 118, "diastolic": 78, "glucose": 110, "weight": 56.2 },
                { "date": "2026-04-15", "systolic": 120, "diastolic": 80, "glucose": 112, "weight": 56.4 },
                { "date": "2026-05-20", "systolic": 122, "diastolic": 82, "glucose": 118, "weight": 56.5 },
                { "date": "2026-06-25", "systolic": 119, "diastolic": 79, "glucose": 114, "weight": 56.5 },
                { "date": "2026-07-30", "systolic": 121, "diastolic": 81, "glucose": 116, "weight": 56.6 },
                { "date": "2026-09-05", "systolic": 148, "diastolic": 92, "glucose": 185, "weight": 56.8 }
            ],
            "created_at": "2026-03-12T09:00:00Z",
            "updated_at": "2026-09-05T10:30:00Z"
        },
        {
            "person_id": "p-rahul-02",
            "household_id": "h-lakshmi-001",
            "person_name": "Rahul",
            "age": 1.5,
            "gender": "male",
            "baseline_metrics": {
                "systolic_bp": None,
                "diastolic_bp": None,
                "random_blood_sugar_mg_dl": None,
                "pulse_bpm": 105.0,
                "weight_kg": 10.1,
                "muac_cm": 13.0
            },
            "rolling_statistics": {
                "sample_count": 3,
                "systolic_std_dev": None,
                "systolic_min": None,
                "systolic_max": None,
                "weight_velocity_kg_per_month": -0.33
            },
            "latest_measurement": {
                "systolic_bp": None,
                "diastolic_bp": None,
                "random_blood_sugar_mg_dl": None,
                "pulse_bpm": 108.0,
                "weight_kg": 9.7,
                "muac_cm": 12.6,
                "measured_at": "2026-09-05T10:30:00Z",
                "visit_id": "v-rahul-03-faltering"
            },
            "latest_delta_analysis": {
                "systolic_delta": 0,
                "diastolic_delta": 0,
                "weight_delta_kg": -0.5,
                "is_hypertensive_spurt": False,
                "is_acute_crisis": False,
                "pediatric_velocity_status": "weight_loss",
                "severity": "moderate_drift",
                "alert_headline": "Pediatric Growth Velocity Faltering (Weight Loss)",
                "clinical_action": "Weight drop of -500g over 45 days. Verify dietary diversity, inspect for recurrent diarrhea, and schedule 7-day weight review."
            },
            "recent_history_points": [
                { "date": "2026-06-01", "systolic": None, "diastolic": None, "glucose": None, "weight": 10.0, "muac": 13.0 },
                { "date": "2026-07-20", "systolic": None, "diastolic": None, "glucose": None, "weight": 10.2, "muac": 13.1 },
                { "date": "2026-09-05", "systolic": None, "diastolic": None, "glucose": None, "weight": 9.7, "muac": 12.6 }
            ],
            "created_at": "2026-06-01T09:00:00Z",
            "updated_at": "2026-09-05T10:30:00Z"
        },
        {
            "person_id": "p-lakshmi-01",
            "household_id": "h-lakshmi-001",
            "person_name": "Lakshmi Amma",
            "age": 28,
            "gender": "female",
            "baseline_metrics": {
                "systolic_bp": 112.5,
                "diastolic_bp": 72.5,
                "random_blood_sugar_mg_dl": 92.0,
                "pulse_bpm": 78.0,
                "weight_kg": 53.5,
                "muac_cm": None
            },
            "rolling_statistics": {
                "sample_count": 3,
                "systolic_std_dev": 2.5,
                "systolic_min": 110.0,
                "systolic_max": 130.0,
                "weight_velocity_kg_per_month": 1.5
            },
            "latest_measurement": {
                "systolic_bp": 130.0,
                "diastolic_bp": 85.0,
                "random_blood_sugar_mg_dl": 96.0,
                "pulse_bpm": 82.0,
                "weight_kg": 58.0,
                "measured_at": "2026-09-05T10:30:00Z",
                "visit_id": "v-lak-03"
            },
            "latest_delta_analysis": {
                "systolic_delta": 17.5,
                "diastolic_delta": 12.5,
                "weight_delta_kg": 3.0,
                "is_hypertensive_spurt": False,
                "is_acute_crisis": False,
                "pediatric_velocity_status": "not_applicable",
                "severity": "moderate_drift",
                "alert_headline": "Antenatal Pre-Hypertensive Drift (32 Weeks)",
                "clinical_action": "Systolic rise +17.5 mmHg in 3rd trimester. Monitor for pedal edema, check protein in urine, and schedule PHC review."
            },
            "recent_history_points": [
                { "date": "2026-05-10", "systolic": 110, "diastolic": 70, "glucose": 90, "weight": 52.0 },
                { "date": "2026-07-10", "systolic": 115, "diastolic": 75, "glucose": 94, "weight": 55.0 },
                { "date": "2026-09-05", "systolic": 130, "diastolic": 85, "glucose": 96, "weight": 58.0 }
            ],
            "created_at": "2026-05-10T09:00:00Z",
            "updated_at": "2026-09-05T10:30:00Z"
        }
    ]
    vitals_baselines_col.insert_many(baselines)
    print(f"[Seed] Inserted {len(baselines)} longitudinal vitals baselines.")

    # 6. Seed Care Ledgers
    care_ledgers = [
        {
            "household_id": "h-lakshmi-001",
            "household_name": "Lakshmi Amma's Household",
            "ward": "Ward 4, Aluva",
            "updated_at": "2026-09-05T10:30:00Z",
            "open_gaps_count": 3,
            "care_gaps": [
                {
                    "id": "gap-vitals-spurt-01",
                    "household_id": "h-lakshmi-001",
                    "person_id": "p-radhamani-01",
                    "person_name": "Radhamani P.",
                    "programme": "ncd",
                    "gap_type": "vitals_delta_hypertensive_spurt",
                    "description": "Acute systolic BP spurt (+28 mmHg from personal baseline 120/80 mmHg).",
                    "evidence": [
                        {
                            "source_type": "visit_vitals_deviation",
                            "observed_at": "2026-09-05T10:30:00Z",
                            "baseline_sys": 120,
                            "measured_sys": 148,
                            "baseline_glucose": 115,
                            "measured_glucose": 185
                        }
                    ],
                    "severity": "high",
                    "status": "open",
                    "due_date": "2026-09-07",
                    "owner": "ASHA Worker (Ward 4)",
                    "recommended_action": "Home visit within 48h: verify anti-hypertensive drug adherence and re-measure BP.",
                    "last_reviewed_at": "2026-09-05T10:30:00Z"
                },
                {
                    "id": "gap-ped-velocity-02",
                    "household_id": "h-lakshmi-001",
                    "person_id": "p-rahul-02",
                    "person_name": "Rahul",
                    "programme": "malnutrition",
                    "gap_type": "child_growth_velocity_faltering",
                    "description": "Pediatric weight faltering (-500g over 45 days, 10.2kg -> 9.7kg). Dietary diversity low (3/8).",
                    "evidence": [
                        {
                            "source_type": "growth_velocity_check",
                            "observed_at": "2026-09-05T10:30:00Z",
                            "previous_weight": 10.2,
                            "current_weight": 9.7,
                            "days_elapsed": 45
                        }
                    ],
                    "severity": "high",
                    "status": "open",
                    "due_date": "2026-09-12",
                    "owner": "ASHA Worker (Ward 4)",
                    "recommended_action": "Counsel on egg/milk protein supplementation, inspect for diarrhea, schedule PHC review.",
                    "last_reviewed_at": "2026-09-05T10:30:00Z"
                },
                {
                    "id": "gap-anc-03",
                    "household_id": "h-lakshmi-001",
                    "person_id": "p-lakshmi-01",
                    "person_name": "Lakshmi Amma",
                    "programme": "maternal",
                    "gap_type": "overdue_anc_checkup",
                    "description": "3rd Trimester antenatal examination and BP check overdue by 8 days.",
                    "evidence": [{"source_type": "visit_observation", "observed_at": "2026-08-20T10:30:00Z"}],
                    "severity": "high",
                    "status": "open",
                    "due_date": "2026-08-28",
                    "owner": "ASHA Worker (Ward 4)",
                    "recommended_action": "Measure vitals, check for pedal edema, schedule PHC review",
                    "last_reviewed_at": "2026-09-05T10:30:00Z"
                }
            ],
            "priority_score": 92.5,
            "priority_reasons": [
                "Acute hypertensive spurt detected in Radhamani P. (+28 mmHg)",
                "Pediatric growth faltering / weight drop flagged in child Rahul",
                "Antenatal 3rd trimester checkup overdue"
            ],
            "longitudinal_narrative": "Household: Lakshmi Amma's Household (Ward 4, Aluva)\nLongitudinal Vitals Briefing:\n - Radhamani P. (62): Baseline BP 120/80 mmHg; Acute deviation today at 148/92 mmHg (+28/+12 mmHg spurt). Blood sugar surged +70 mg/dL (185 mg/dL). High probability of missed medication.\n - Rahul (18m): Weight drop observed (10.2 kg down to 9.7 kg, -500g). Dietary diversity 3/8.\nNext Visit Priorities:\n - Re-check Radhamani's blood pressure within 48 hours.\n - Track child growth recovery and verify supplementary nutrition intake.",
            "malnutrition_trend": "High vulnerability - Pediatric weight loss and dietary diversity deficit active"
        },
        {
            "household_id": "h-suresh-002",
            "household_name": "Suresh Kumar's Household",
            "ward": "Ward 4, Aluva",
            "updated_at": "2026-09-05T10:30:00Z",
            "open_gaps_count": 1,
            "care_gaps": [
                {
                    "id": "gap-ncd-suresh-01",
                    "household_id": "h-suresh-002",
                    "person_id": "p-suresh-01",
                    "person_name": "Suresh Kumar",
                    "programme": "ncd",
                    "gap_type": "ncd_hypertension_recheck",
                    "description": "Quarterly NCD hypertension follow-up due.",
                    "evidence": [{"source_type": "ncd_register", "observed_at": "2026-06-01T09:00:00Z"}],
                    "severity": "medium",
                    "status": "open",
                    "due_date": "2026-09-15",
                    "owner": "ASHA Worker (Ward 4)",
                    "recommended_action": "Measure resting BP and check medication stock",
                    "last_reviewed_at": "2026-09-05T10:30:00Z"
                }
            ],
            "priority_score": 52.0,
            "priority_reasons": ["NCD Hypertension quarterly recheck due"],
            "longitudinal_narrative": "Household: Suresh Kumar's Household (Ward 4, Aluva)\nLongitudinal Vitals Briefing:\n - Suresh Kumar (52): Baseline BP 132/84 mmHg. Stable on Telmisartan. Quarterly check due.",
            "malnutrition_trend": "Normal growth trajectory"
        }
    ]
    care_ledgers_col.insert_many(care_ledgers)
    print(f"[Seed] Inserted {len(care_ledgers)} household care ledgers.")

    # 7. Seed Actions
    actions = [
        {
            "action_id": "act-rad-01",
            "household_id": "h-lakshmi-001",
            "care_gap_id": "gap-vitals-spurt-01",
            "title": "Hypertension: Acute Spurt Home Review",
            "description": "Re-check BP in 48 hours and verify Amlodipine tablet adherence.",
            "assigned_to": "ASHA Worker (Ward 4)",
            "due_date": "2026-09-07",
            "status": "pending"
        },
        {
            "action_id": "act-rahul-02",
            "household_id": "h-lakshmi-001",
            "care_gap_id": "gap-ped-velocity-02",
            "title": "Pediatric: Growth Fallowing Follow-up",
            "description": "Conduct 7-day weight follow-up and Anganwadi milk/egg counseling.",
            "assigned_to": "ASHA Worker (Ward 4)",
            "due_date": "2026-09-12",
            "status": "pending"
        }
    ]
    actions_col.insert_many(actions)
    print(f"[Seed] Inserted {len(actions)} operational actions.")

    print("\n[Seed Complete] MongoDB Atlas successfully hydrated with full longitudinal dataset!")
    return True

if __name__ == "__main__":
    seed_database()
