from fastapi import APIRouter
from typing import List, Dict, Any
from models.schemas import ConfirmedVisitSchema
from db.database import visits_col, encounters_col

router = APIRouter(prefix="/api/v1/visits", tags=["Visits"])

# In-memory store fallback for confirmed visits
VISITS_STORE: List[Dict[str, Any]] = []

@router.post("")
def record_confirmed_visit(visit: ConfirmedVisitSchema):
    """
    Persists a confirmed clinical visit into MongoDB.
    Applies idempotency by visit_id to prevent duplicates.
    """
    visit_data = visit.dict()

    if visits_col is not None:
        try:
            # Idempotency check
            existing = visits_col.find_one({"visit_id": visit.visit_id})
            if existing:
                return {"status": "already_exists", "id": visit.visit_id, "storage": "mongodb"}

            visits_col.insert_one(visit_data)

            # Also log each person update into clinical_encounters for longitudinal tracking
            if encounters_col is not None:
                for person_up in visit.person_updates:
                    vitals_dict = person_up.vitals.dict() if person_up.vitals else {}
                    sys_bp = vitals_dict.get("systolic_bp")
                    dia_bp = vitals_dict.get("diastolic_bp")
                    bp_str = f"{sys_bp}/{dia_bp}" if sys_bp and dia_bp else None

                    encounter_doc = {
                        "visit": {
                            "visit_id": f"{visit.visit_id}-{person_up.person_id}",
                            "household_id": visit.household_id,
                            "date": visit.timestamp[:10],
                            "visit_type": "routine"
                        },
                        "person": {
                            "person_id": person_up.person_id,
                            "name": person_up.name,
                            "age": person_up.age,
                            "sex": person_up.gender.lower() if person_up.gender else "unknown",
                            "relationship": "member",
                            "life_stage": "child" if (person_up.age and person_up.age <= 5) else ("elderly" if (person_up.age and person_up.age >= 60) else "adult"),
                            "pregnancy_status": "pregnant" if person_up.pregnancy_weeks else "not_pregnant"
                        },
                        "health_status": {
                            "complaints": [{"symptom": s, "duration": "recent", "severity": "mild", "trend": "unchanged"} for s in (person_up.symptoms or [])],
                            "known_conditions": [],
                            "medications": [{"name": m, "taking": "yes", "adherence": "regular", "available": "yes"} for m in (person_up.medications_given or [])]
                        },
                        "measurements": {
                            "blood_pressure": bp_str,
                            "blood_pressure_sys": sys_bp,
                            "blood_pressure_dia": dia_bp,
                            "weight_kg": vitals_dict.get("weight_kg"),
                            "pulse_bpm": vitals_dict.get("pulse_bpm")
                        },
                        "extraction": {
                            "overall_confidence": "high",
                            "fields_needing_confirmation": []
                        }
                    }
                    encounters_col.update_one(
                        {"visit.visit_id": encounter_doc["visit"]["visit_id"]},
                        {"$set": encounter_doc},
                        upsert=True
                    )

            return {"status": "saved", "id": visit.visit_id, "timestamp": visit.timestamp, "storage": "mongodb"}
        except Exception as e:
            print(f"[MongoDB Error in record_confirmed_visit] {e}")

    # In-memory fallback
    for existing in VISITS_STORE:
        if existing["visit_id"] == visit.visit_id:
            return {"status": "already_exists", "id": visit.visit_id, "storage": "in_memory"}

    VISITS_STORE.append(visit_data)
    return {"status": "saved", "id": visit.visit_id, "timestamp": visit.timestamp, "storage": "in_memory"}

@router.get("", response_model=List[ConfirmedVisitSchema])
def get_visits():
    if visits_col is not None:
        try:
            docs = list(visits_col.find({}, {"_id": 0}))
            if docs:
                return docs
        except Exception as e:
            print(f"[MongoDB Error in get_visits] {e}")

    return VISITS_STORE

