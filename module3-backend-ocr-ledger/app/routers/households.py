from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime
import uuid

from models.schemas import (
    HouseholdSummarySchema,
    PersonSchema,
    CreateHouseholdSchema
)
from db.database import households_col, persons_col

router = APIRouter(prefix="/api/v1/households", tags=["Households & Persons"])

# In-memory canonical fallback state for Swaram Platform
MOCK_HOUSEHOLDS_DB = [
    {
        "id": "h-lakshmi-001",
        "external_id": "ASHA-WARD4-HH042",
        "head_of_household": "Lakshmi Amma",
        "address": "House 42, Kudumbashree Lane, Aluva",
        "members_count": 4,
        "open_care_gaps": 3,
        "priority_score": 92.5,
        "priority_reasons": [
            "Acute hypertensive spurt detected in Radhamani P. (+28 mmHg)",
            "Pediatric weight faltering flagged in child Rahul (-500g over 45 days)",
            "ANC 3rd trimester check overdue by 8 days"
        ],
        "malnutrition_risk": "Moderate"
    },
    {
        "id": "h-suresh-002",
        "external_id": "ASHA-WARD4-HH043",
        "head_of_household": "Suresh Kumar",
        "address": "House 45, Temple Road, Aluva",
        "members_count": 3,
        "open_care_gaps": 1,
        "priority_score": 52.0,
        "priority_reasons": ["NCD Hypertension quarterly recheck due"],
        "malnutrition_risk": "Normal"
    },
    {
        "id": "h-anitha-003",
        "external_id": "ASHA-WARD4-HH044",
        "head_of_household": "Anitha Kumari",
        "address": "House 51, River View, Aluva",
        "members_count": 4,
        "open_care_gaps": 0,
        "priority_score": 25.0,
        "priority_reasons": ["Routine community health follow-up"],
        "malnutrition_risk": "Normal"
    }
]

MOCK_PERSONS_DB = [
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
    }
]

@router.get("", response_model=List[HouseholdSummarySchema])
def get_households():
    """Returns numbered households assigned to the ASHA worker from MongoDB with priority indicators."""
    if households_col is not None:
        try:
            docs = list(households_col.find({}, {"_id": 0}).sort("priority_score", -1))
            if docs:
                return docs
        except Exception as e:
            print(f"[MongoDB Error in get_households] {e}")

    return MOCK_HOUSEHOLDS_DB

@router.post("", response_model=HouseholdSummarySchema)
def create_household(payload: CreateHouseholdSchema):
    """Creates a new numbered household in MongoDB."""
    hh_id = payload.id or f"h-{payload.head_of_household.lower().replace(' ', '-')[:12]}-{uuid.uuid4().hex[:4]}"
    new_doc = {
        "id": hh_id,
        "external_id": payload.external_id,
        "head_of_household": payload.head_of_household,
        "address": payload.address,
        "ward": payload.ward,
        "members_count": payload.members_count,
        "open_care_gaps": 0,
        "priority_score": 10.0,
        "priority_reasons": ["Newly registered household"],
        "malnutrition_risk": payload.malnutrition_risk or "Normal",
        "updated_at": datetime.utcnow().isoformat() + "Z"
    }

    if households_col is not None:
        try:
            households_col.update_one({"id": hh_id}, {"$set": new_doc}, upsert=True)
            saved = households_col.find_one({"id": hh_id}, {"_id": 0})
            if saved:
                return saved
        except Exception as e:
            print(f"[MongoDB Error in create_household] {e}")

    MOCK_HOUSEHOLDS_DB.append(new_doc)
    return new_doc

@router.get("/{household_id}", response_model=HouseholdSummarySchema)
def get_household(household_id: str):
    """Retrieves single household details by ID."""
    if households_col is not None:
        try:
            doc = households_col.find_one({"id": household_id}, {"_id": 0})
            if doc:
                return doc
        except Exception as e:
            print(f"[MongoDB Error in get_household] {e}")

    for h in MOCK_HOUSEHOLDS_DB:
        if h["id"] == household_id or h.get("external_id") == household_id:
            return h
    return MOCK_HOUSEHOLDS_DB[0]

@router.get("/{household_id}/members", response_model=List[PersonSchema])
def get_household_members(household_id: str):
    """
    Returns all people / citizens registered under the specified numbered household.
    Reads from MongoDB persons collection.
    """
    if persons_col is not None:
        try:
            docs = list(persons_col.find({"household_id": household_id}, {"_id": 0}))
            if docs:
                return docs
        except Exception as e:
            print(f"[MongoDB Error in get_household_members] {e}")

    # Fallback to in-memory list
    members = [p for p in MOCK_PERSONS_DB if p["household_id"] == household_id]
    return members

@router.post("/{household_id}/members", response_model=PersonSchema)
def add_household_member(household_id: str, person: PersonSchema):
    """
    Adds a new person to a numbered household in MongoDB persons collection.
    """
    person_doc = person.dict()
    person_doc["household_id"] = household_id
    if not person_doc.get("person_id"):
        person_doc["person_id"] = f"p-{person.name.lower().replace(' ', '-')[:12]}-{uuid.uuid4().hex[:4]}"
    if not person_doc.get("created_at"):
        person_doc["created_at"] = datetime.utcnow().isoformat() + "Z"

    if persons_col is not None:
        try:
            persons_col.update_one(
                {"person_id": person_doc["person_id"]},
                {"$set": person_doc},
                upsert=True
            )
            # Update members count in household
            if households_col is not None:
                households_col.update_one(
                    {"id": household_id},
                    {"$inc": {"members_count": 1}}
                )
            return person_doc
        except Exception as e:
            print(f"[MongoDB Error in add_household_member] {e}")

    MOCK_PERSONS_DB.append(person_doc)
    return person_doc
