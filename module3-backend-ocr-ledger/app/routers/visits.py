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

            # Calculate visiting_no (count of previous visits for this household + 1)
            visiting_no = visit.visiting_no
            if not visiting_no:
                prev_count = visits_col.count_documents({"household_id": visit.household_id})
                visiting_no = prev_count + 1

            visit_data["visiting_no"] = visiting_no
            visit_data["visit_number"] = visiting_no

            visits_col.insert_one(visit_data)

            # Also log each person update into clinical_encounters for longitudinal tracking
            if encounters_col is not None:
                for person_up in visit.person_updates:
                    vitals_dict = person_up.vitals.dict() if person_up.vitals else {}
                    sys_bp = vitals_dict.get("systolic_bp")
                    dia_bp = vitals_dict.get("diastolic_bp")

                    measurements_doc = {}
                    if sys_bp is not None or dia_bp is not None:
                        measurements_doc["blood_pressure"] = {
                            "systolic_mmhg": sys_bp,
                            "diastolic_mmhg": dia_bp
                        }
                    if vitals_dict.get("weight_kg") is not None:
                        measurements_doc["weight_kg"] = vitals_dict.get("weight_kg")
                    if vitals_dict.get("pulse_bpm") is not None:
                        measurements_doc["pulse_bpm"] = vitals_dict.get("pulse_bpm")
                    if vitals_dict.get("temperature_c") is not None:
                        measurements_doc["temperature_c"] = vitals_dict.get("temperature_c")

                    symptoms_list = [{"symptom": s} for s in (person_up.symptoms or [])]
                    medications_list = [{"name": m} for m in (person_up.medications_given or [])]

                    observations_doc = {}
                    if symptoms_list:
                        observations_doc["symptoms"] = symptoms_list
                    if medications_list:
                        observations_doc["medications"] = medications_list
                    if measurements_doc:
                        observations_doc["measurements"] = measurements_doc

                    # Person-specific visit number
                    person_prev_enc_count = encounters_col.count_documents({"person.person_id": person_up.person_id})
                    person_visiting_no = person_prev_enc_count + 1

                    encounter_doc = {
                        "visit": {
                            "visit_id": f"{visit.visit_id}-{person_up.person_id}",
                            "household_id": visit.household_id,
                            "visiting_no": person_visiting_no,
                            "visit_number": person_visiting_no,
                            "date": visit.timestamp[:10],
                            "visit_type": "routine",
                            "source": "manual"
                        },
                        "person": {
                            "person_id": person_up.person_id,
                            "name": person_up.name,
                            "age": person_up.age,
                            "sex": person_up.gender.lower() if person_up.gender else None,
                            "pregnancy_status": "pregnant" if person_up.pregnancy_weeks else None
                        }
                    }
                    if observations_doc:
                        encounter_doc["observations"] = observations_doc

                    encounters_col.update_one(
                        {"visit.visit_id": encounter_doc["visit"]["visit_id"]},
                        {"$set": encounter_doc},
                        upsert=True
                    )

            return {
                "status": "saved",
                "id": visit.visit_id,
                "visiting_no": visiting_no,
                "timestamp": visit.timestamp,
                "storage": "mongodb"
            }
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

