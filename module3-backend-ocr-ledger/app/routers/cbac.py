"""
CBAC (Community Based Assessment Checklist for NCDs) Router
Module 3 Backend Service
Persists official CBAC survey records into MongoDB Atlas 'cbac_surveys' collection.
Synchronizes with clinical encounters, care ledgers, and household priority scoring.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid

import db.database as db_mod

router = APIRouter(prefix="/api/v1/cbac", tags=["CBAC NCD Surveys"])

# In-memory fallback
IN_MEMORY_CBAC_SURVEYS: Dict[str, Dict[str, Any]] = {}

@router.post("", response_model=Dict[str, Any])
def save_cbac_survey(survey: Dict[str, Any]):
    """
    Saves or updates a comprehensive official CBAC survey in MongoDB Atlas.
    Calculates visiting_no, records longitudinal scores, and auto-generates care gaps.
    """
    survey_id = survey.get("surveyId") or f"cbac-{uuid.uuid4().hex[:8]}"
    survey["surveyId"] = survey_id
    survey["survey_id"] = survey_id

    personal = survey.get("personalDetails", {})
    gen_info = survey.get("generalInfo", {})
    part_a = survey.get("partA", {})
    part_b = survey.get("partB", {})
    part_d = survey.get("partD", {})

    beneficiary_id = survey.get("beneficiaryId") or personal.get("person_id") or personal.get("identifier") or f"ben-{personal.get('name', 'beneficiary').lower().replace(' ', '-')}"
    survey["beneficiaryId"] = beneficiary_id
    survey["beneficiary_id"] = beneficiary_id

    household_id = survey.get("householdId") or survey.get("household_id") or personal.get("household_id") or "h-lakshmi-001"
    survey["household_id"] = household_id

    # 1. Determine visiting_no (count of previous records + 1)
    visiting_no = survey.get("visiting_no")
    if not visiting_no:
        if db_mod.cbac_surveys_col is not None:
            try:
                prev_count = db_mod.cbac_surveys_col.count_documents({
                    "$or": [
                        {"beneficiaryId": beneficiary_id},
                        {"beneficiary_id": beneficiary_id}
                    ]
                })
                visiting_no = prev_count + 1
            except Exception as e:
                print(f"[MongoDB visiting_no count error in CBAC] {e}")
                visiting_no = 1
        else:
            prev_count = len([s for s in IN_MEMORY_CBAC_SURVEYS.values() if s.get("beneficiaryId") == beneficiary_id])
            visiting_no = prev_count + 1

    survey["visiting_no"] = visiting_no
    survey["visit_number"] = visiting_no

    now_iso = datetime.utcnow().isoformat() + "Z"
    if not survey.get("timestamp"):
        survey["timestamp"] = now_iso
    survey["updated_at"] = now_iso

    # 2. Persist to MongoDB Atlas 'cbac_surveys'
    if db_mod.cbac_surveys_col is not None:
        try:
            db_mod.cbac_surveys_col.update_one(
                {"surveyId": survey_id},
                {"$set": survey},
                upsert=True
            )
        except Exception as e:
            print(f"[MongoDB Error saving CBAC survey] {e}")
            IN_MEMORY_CBAC_SURVEYS[survey_id] = survey
    else:
        IN_MEMORY_CBAC_SURVEYS[survey_id] = survey

    # 3. Synchronize to 'clinical_encounters'
    if db_mod.encounters_col is not None:
        try:
            symptoms_list = []
            gen_b = part_b.get("general", {}) if isinstance(part_b.get("general"), dict) else {}
            for sym_key, sym_val in gen_b.items():
                if sym_val is True:
                    symptoms_list.append({"symptom": sym_key, "severity": "moderate", "status": "active"})

            encounter_doc = {
                "visit": {
                    "visit_id": f"enc-{survey_id}",
                    "household_id": household_id,
                    "date": survey.get("generalInfo", {}).get("date") or now_iso[:10],
                    "visiting_no": visiting_no,
                    "visit_number": visiting_no,
                    "visit_type": "routine",
                    "source": "cbac_survey"
                },
                "person": {
                    "person_id": beneficiary_id,
                    "name": personal.get("name", "Beneficiary"),
                    "age": personal.get("age"),
                    "sex": personal.get("sex", "unknown"),
                    "relationship_to_head": "member"
                },
                "observations": {
                    "symptoms": symptoms_list,
                    "measurements": {
                        "weight_kg": None,
                        "waist_cm": part_a.get("waistCm")
                    },
                    "mental_social": {
                        "screening_status": "completed" if part_d else "not_done",
                        "phq2_score": part_d.get("totalScore", 0)
                    }
                },
                "ai_assessment": {
                    "cbac_total_score": part_a.get("totalScore", 0),
                    "cbac_classification": survey.get("overallClassification", "normal_routine")
                },
                "updated_at": now_iso
            }

            db_mod.encounters_col.update_one(
                {"visit.visit_id": f"enc-{survey_id}"},
                {"$set": encounter_doc},
                upsert=True
            )
        except Exception as e:
            print(f"[MongoDB Error syncing CBAC to encounters] {e}")

    # 4. Care Ledger & Priority Escalation
    total_score = part_a.get("totalScore", 0)
    is_high_risk = part_a.get("isHighRisk", total_score > 4)
    has_warning_signs = part_b.get("hasAnyWarningSign", False)
    is_phq2_referral = part_d.get("isReferredToChoMo", False)

    if (is_high_risk or has_warning_signs or is_phq2_referral) and db_mod.care_ledgers_col is not None:
        try:
            gap_id = f"gap-cbac-{uuid.uuid4().hex[:8]}"
            gap_type = "urgent_mo_referral" if has_warning_signs else ("phq2_referral" if is_phq2_referral else "ncd_annual_screening")
            severity = "critical" if has_warning_signs else "high"
            desc = survey.get("actionRecommendationsEn") or f"CBAC Risk Score {total_score}/10: Clinical referral indicated."

            new_gap = {
                "id": gap_id,
                "household_id": household_id,
                "person_id": beneficiary_id,
                "person_name": personal.get("name", "Beneficiary"),
                "programme": "ncd",
                "gap_type": gap_type,
                "description": desc,
                "evidence": [
                    {
                        "source_type": "cbac_survey",
                        "visiting_no": visiting_no,
                        "observed_at": now_iso,
                        "total_score": total_score,
                        "classification": survey.get("overallClassification")
                    }
                ],
                "severity": severity,
                "status": "open",
                "due_date": now_iso[:10],
                "owner": "ASHA Worker (Ward 4)",
                "recommended_action": survey.get("actionRecommendationsMl") or desc,
                "last_reviewed_at": now_iso
            }

            db_mod.care_ledgers_col.update_one(
                {"household_id": household_id},
                {
                    "$push": {"care_gaps": new_gap},
                    "$set": {"updated_at": now_iso, "visiting_no": visiting_no, "priority_score": 90.0 if has_warning_signs else 85.0},
                    "$inc": {"open_gaps_count": 1}
                },
                upsert=True
            )

            # Escalate Household Priority
            if db_mod.households_col is not None:
                db_mod.households_col.update_one(
                    {"id": household_id},
                    {
                        "$set": {"priority_score": 90.0 if has_warning_signs else 85.0, "updated_at": now_iso},
                        "$addToSet": {"priority_reasons": f"High NCD Risk: CBAC score {total_score}/10 ({personal.get('name', 'Member')})"}
                    }
                )
        except Exception as e:
            print(f"[MongoDB Error auto-generating CBAC care gap] {e}")

    return {
        "status": "saved",
        "storage": "mongodb" if db_mod.cbac_surveys_col is not None else "in_memory",
        "survey_id": survey_id,
        "beneficiary_id": beneficiary_id,
        "visiting_no": visiting_no,
        "total_score": total_score,
        "overall_classification": survey.get("overallClassification", "normal_routine")
    }

@router.get("/beneficiary/{beneficiary_id}", response_model=List[Dict[str, Any]])
def get_beneficiary_cbac_surveys(beneficiary_id: str):
    """
    Retrieves all longitudinal CBAC surveys for a beneficiary from MongoDB Atlas.
    """
    if db_mod.cbac_surveys_col is not None:
        try:
            surveys = list(db_mod.cbac_surveys_col.find(
                {"$or": [
                    {"beneficiaryId": beneficiary_id},
                    {"beneficiary_id": beneficiary_id}
                ]},
                {"_id": 0}
            ).sort("timestamp", -1))
            return surveys
        except Exception as e:
            print(f"[MongoDB Error fetching beneficiary CBAC surveys] {e}")

    # In-memory fallback
    return [s for s in IN_MEMORY_CBAC_SURVEYS.values() if s.get("beneficiaryId") == beneficiary_id]

@router.get("", response_model=List[Dict[str, Any]])
def list_all_cbac_surveys(limit: int = Query(50, ge=1, le=200)):
    """
    Lists all saved CBAC surveys from MongoDB Atlas.
    """
    if db_mod.cbac_surveys_col is not None:
        try:
            surveys = list(db_mod.cbac_surveys_col.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit))
            return surveys
        except Exception as e:
            print(f"[MongoDB Error listing CBAC surveys] {e}")

    return list(IN_MEMORY_CBAC_SURVEYS.values())[:limit]
