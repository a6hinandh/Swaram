from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
from datetime import datetime
from models.encounter_schema import ClinicalEncounterSchema
import db.database as db_mod

router = APIRouter(prefix="/api/v1/encounters", tags=["Clinical Encounters"])

# In-memory fallback in case Mongo is unreachable
IN_MEMORY_ENCOUNTERS: Dict[str, Dict[str, Any]] = {}

@router.post("", response_model=Dict[str, Any])
def save_clinical_encounter(encounter: ClinicalEncounterSchema):
    """
    Saves or updates a rich clinical encounter in MongoDB.
    Calculates visiting_no as count of previous records + 1.
    Synchronizes longitudinal vitals baselines and care ledgers.
    """
    doc = encounter.dict(by_alias=True)
    if doc.get("_id") is None:
        doc.pop("_id", None)

    visit_id = encounter.visit.visit_id
    person_id = encounter.person.person_id
    household_id = encounter.visit.household_id

    # 1. Determine visiting_no (count of previous records for this person + 1)
    visiting_no = doc.get("visit", {}).get("visiting_no")
    if not visiting_no:
        if db_mod.encounters_col is not None:
            try:
                existing = db_mod.encounters_col.find_one({"visit.visit_id": visit_id})
                if existing and existing.get("visit", {}).get("visiting_no"):
                    visiting_no = existing["visit"]["visiting_no"]
                else:
                    prev_count = db_mod.encounters_col.count_documents({"person.person_id": person_id})
                    visiting_no = prev_count + 1
            except Exception as e:
                print(f"[MongoDB visiting_no count error] {e}")
                visiting_no = 1
        else:
            prev_count = len([e for e in IN_MEMORY_ENCOUNTERS.values() if e.get("person", {}).get("person_id") == person_id])
            visiting_no = prev_count + 1

    if "visit" not in doc:
        doc["visit"] = {}
    doc["visit"]["visiting_no"] = visiting_no
    doc["visit"]["visit_number"] = visiting_no
    doc["visiting_no"] = visiting_no

    if db_mod.encounters_col is not None:
        try:
            result = db_mod.encounters_col.update_one(
                {"visit.visit_id": visit_id},
                {"$set": doc},
                upsert=True
            )

            # Synchronize with vitals_baselines if measurements present
            obs_m = doc.get("observations", {}).get("measurements", {}) if isinstance(doc.get("observations"), dict) else {}
            m = obs_m or doc.get("measurements", {})
            if db_mod.vitals_baselines_col is not None and m:
                sys_bp = m.get("blood_pressure", {}).get("systolic_mmhg") if isinstance(m.get("blood_pressure"), dict) else m.get("blood_pressure_sys")
                dia_bp = m.get("blood_pressure", {}).get("diastolic_mmhg") if isinstance(m.get("blood_pressure"), dict) else m.get("blood_pressure_dia")
                glu = m.get("blood_sugar_mg_dl") or (m.get("blood_glucose", {}).get("value") if isinstance(m.get("blood_glucose"), dict) else None)
                wt = m.get("weight_kg")
                pulse = m.get("pulse_bpm")
                muac = m.get("muac_cm")

                history_pt = {
                    "date": doc.get("visit", {}).get("date", datetime.utcnow().isoformat()[:10]),
                    "visiting_no": visiting_no,
                    "visit_number": visiting_no,
                    "systolic": sys_bp,
                    "diastolic": dia_bp,
                    "glucose": glu,
                    "pulse": pulse,
                    "weight": wt,
                    "muac": muac
                }

                db_mod.vitals_baselines_col.update_one(
                    {"person_id": person_id},
                    {
                        "$push": {"recent_history_points": history_pt},
                        "$set": {
                            "latest_measurement": history_pt,
                            "visiting_no": visiting_no,
                            "updated_at": datetime.utcnow().isoformat() + "Z"
                        },
                        "$setOnInsert": {
                            "household_id": household_id,
                            "person_name": encounter.person.name or "Beneficiary",
                            "age": encounter.person.age,
                            "gender": encounter.person.sex or "female",
                            "created_at": datetime.utcnow().isoformat() + "Z"
                        }
                    },
                    upsert=True
                )

            return {
                "status": "saved",
                "storage": "mongodb",
                "visit_id": visit_id,
                "visiting_no": visiting_no,
                "household_id": household_id,
                "person_id": person_id,
                "upserted": result.upserted_id is not None
            }
        except Exception as e:
            print(f"[MongoDB Error in save_clinical_encounter] {e}")

    # In-memory fallback
    IN_MEMORY_ENCOUNTERS[visit_id] = doc
    return {
        "status": "saved",
        "storage": "in_memory_fallback",
        "visit_id": visit_id,
        "visiting_no": visiting_no,
        "household_id": household_id,
        "person_id": person_id
    }

@router.get("", response_model=List[Dict[str, Any]])
def list_encounters(
    household_id: Optional[str] = Query(None, description="Filter by household ID"),
    person_id: Optional[str] = Query(None, description="Filter by person ID"),
    limit: int = Query(50, ge=1, le=200)
):
    """Lists clinical encounters matching filter criteria."""
    query: Dict[str, Any] = {}
    if household_id:
        query["visit.household_id"] = household_id
    if person_id:
        query["person.person_id"] = person_id

    if db_mod.encounters_col is not None:
        try:
            cursor = db_mod.encounters_col.find(query, {"_id": 0}).sort("visit.date", -1).limit(limit)
            return list(cursor)
        except Exception as e:
            print(f"[MongoDB Error] {e}")

    results = []
    for doc in IN_MEMORY_ENCOUNTERS.values():
        if household_id and doc.get("visit", {}).get("household_id") != household_id:
            continue
        if person_id and doc.get("person", {}).get("person_id") != person_id:
            continue
        results.append(doc)
    return results[:limit]

@router.get("/{visit_id}", response_model=Dict[str, Any])
def get_encounter_by_id(visit_id: str):
    """Retrieves a single clinical encounter document by visit_id."""
    if db_mod.encounters_col is not None:
        try:
            doc = db_mod.encounters_col.find_one({"visit.visit_id": visit_id}, {"_id": 0})
            if doc:
                return doc
        except Exception as e:
            print(f"[MongoDB Error] {e}")

    if visit_id in IN_MEMORY_ENCOUNTERS:
        return IN_MEMORY_ENCOUNTERS[visit_id]

    raise HTTPException(status_code=404, detail=f"Clinical encounter '{visit_id}' not found")

@router.get("/household/{household_id}", response_model=List[Dict[str, Any]])
def get_household_encounters(household_id: str):
    """Retrieves all clinical visits for a given household."""
    if db_mod.encounters_col is not None:
        try:
            cursor = db_mod.encounters_col.find({"visit.household_id": household_id}, {"_id": 0}).sort("visit.date", -1)
            return list(cursor)
        except Exception as e:
            print(f"[MongoDB Error] {e}")

    return [
        doc for doc in IN_MEMORY_ENCOUNTERS.values()
        if doc.get("visit", {}).get("household_id") == household_id
    ]

@router.get("/person/{person_id}", response_model=List[Dict[str, Any]])
def get_person_longitudinal_record(person_id: str):
    """Retrieves a person's complete longitudinal clinical timeline."""
    if db_mod.encounters_col is not None:
        try:
            cursor = db_mod.encounters_col.find({"person.person_id": person_id}, {"_id": 0}).sort("visit.date", -1)
            return list(cursor)
        except Exception as e:
            print(f"[MongoDB Error] {e}")

    return [
        doc for doc in IN_MEMORY_ENCOUNTERS.values()
        if doc.get("person", {}).get("person_id") == person_id
    ]
