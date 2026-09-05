from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
from models.encounter_schema import ClinicalEncounterSchema
from db.database import encounters_col

router = APIRouter(prefix="/api/v1/encounters", tags=["Clinical Encounters"])

# In-memory fallback in case Mongo is unreachable
IN_MEMORY_ENCOUNTERS: Dict[str, Dict[str, Any]] = {}

@router.post("", response_model=Dict[str, Any])
def save_clinical_encounter(encounter: ClinicalEncounterSchema):
    """
    Saves or updates a rich clinical encounter in MongoDB.
    Applies idempotency by visit_id.
    """
    doc = encounter.dict()
    visit_id = encounter.visit.visit_id

    if encounters_col is not None:
        try:
            result = encounters_col.update_one(
                {"visit.visit_id": visit_id},
                {"$set": doc},
                upsert=True
            )
            return {
                "status": "saved",
                "storage": "mongodb",
                "visit_id": visit_id,
                "household_id": encounter.visit.household_id,
                "person_id": encounter.person.person_id,
                "upserted": result.upserted_id is not None
            }
        except Exception as e:
            print(f"[MongoDB Error] {e}")

    # In-memory fallback
    IN_MEMORY_ENCOUNTERS[visit_id] = doc
    return {
        "status": "saved",
        "storage": "in_memory_fallback",
        "visit_id": visit_id,
        "household_id": encounter.visit.household_id,
        "person_id": encounter.person.person_id
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

    if encounters_col is not None:
        try:
            cursor = encounters_col.find(query, {"_id": 0}).sort("visit.date", -1).limit(limit)
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
    if encounters_col is not None:
        try:
            doc = encounters_col.find_one({"visit.visit_id": visit_id}, {"_id": 0})
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
    if encounters_col is not None:
        try:
            cursor = encounters_col.find({"visit.household_id": household_id}, {"_id": 0}).sort("visit.date", -1)
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
    if encounters_col is not None:
        try:
            cursor = encounters_col.find({"person.person_id": person_id}, {"_id": 0}).sort("visit.date", -1)
            return list(cursor)
        except Exception as e:
            print(f"[MongoDB Error] {e}")

    return [
        doc for doc in IN_MEMORY_ENCOUNTERS.values()
        if doc.get("person", {}).get("person_id") == person_id
    ]
