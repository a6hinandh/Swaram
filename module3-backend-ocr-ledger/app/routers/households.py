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
    """Returns numbered households assigned to the ASHA worker from MongoDB with members array and priority indicators."""
    if households_col is not None:
        try:
            docs = list(households_col.find({}, {"_id": 0}).sort("priority_score", -1))
            if docs:
                for h in docs:
                    if not h.get("members") and persons_col is not None:
                        h_members = list(persons_col.find({"household_id": h["id"]}, {"_id": 0}))
                        h["members"] = h_members
                        if not h.get("members_count") or h.get("members_count") != len(h_members):
                            h["members_count"] = len(h_members)
                return docs
        except Exception as e:
            print(f"[MongoDB Error in get_households] {e}")

    # Attach in-memory members to mock households
    for h in MOCK_HOUSEHOLDS_DB:
        h["members"] = [p for p in MOCK_PERSONS_DB if p.get("household_id") == h["id"]]
        h["members_count"] = len(h["members"])
    return MOCK_HOUSEHOLDS_DB

def _infer_life_stage(age: Optional[float]) -> str:
    if age is None:
        return "adult"
    if age < 1:
        return "infant"
    if age < 12:
        return "child"
    if age < 19:
        return "adolescent"
    if age >= 60:
        return "elderly"
    return "adult"

@router.post("", response_model=HouseholdSummarySchema)
def create_household(payload: CreateHouseholdSchema):
    """
    Creates a new numbered household in MongoDB swaram_db.households with embedded members array.
    Automatically creates separate documents in swaram_db.persons for:
    1. The head of household (main user details)
    2. Any additional family members supplied with the payload
    All linked via the correct household_id.
    """
    hh_id = payload.id or f"h-{payload.head_of_household.lower().replace(' ', '-')[:12]}-{uuid.uuid4().hex[:4]}"
    now_iso = datetime.utcnow().isoformat() + "Z"

    # 1. Prepare Head of Household Person Document
    head_details = payload.head_details
    head_age = head_details.age if head_details and head_details.age is not None else None
    head_gender = head_details.gender if head_details and head_details.gender else "unknown"
    head_person_id = (head_details.person_id if head_details and head_details.person_id else None) or f"p-{payload.head_of_household.lower().replace(' ', '-')[:12]}-{uuid.uuid4().hex[:4]}"
    head_life_stage = (head_details.life_stage if head_details and head_details.life_stage else None) or _infer_life_stage(head_age)
    head_preg = (head_details.pregnancy_status if head_details and head_details.pregnancy_status else "not_pregnant") or "not_pregnant"
    head_preg_w = head_details.pregnancy_weeks if head_details else None
    head_conds = (head_details.chronic_conditions if head_details and head_details.chronic_conditions else []) or []
    head_rel = (head_details.relationship if head_details and head_details.relationship else "head") or "head"

    head_person_doc = {
        "person_id": head_person_id,
        "household_id": hh_id,
        "name": payload.head_of_household,
        "age": head_age,
        "gender": head_gender,
        "relationship": head_rel,
        "life_stage": head_life_stage,
        "pregnancy_status": head_preg,
        "pregnancy_weeks": head_preg_w,
        "chronic_conditions": head_conds,
        "created_at": now_iso
    }

    # 2. Prepare Additional Family Members Documents
    all_persons_docs = [head_person_doc]
    if payload.members:
        for m in payload.members:
            m_dict = m.dict() if hasattr(m, "dict") else dict(m)
            m_name = m_dict.get("name") or "Family Member"
            m_age = m_dict.get("age")
            m_id = m_dict.get("person_id") or f"p-{m_name.lower().replace(' ', '-')[:12]}-{uuid.uuid4().hex[:4]}"
            m_life_stage = m_dict.get("life_stage") or _infer_life_stage(m_age)

            member_doc = {
                "person_id": m_id,
                "household_id": hh_id,
                "name": m_name,
                "age": m_age,
                "gender": m_dict.get("gender") or "unknown",
                "relationship": m_dict.get("relationship") or "member",
                "life_stage": m_life_stage,
                "pregnancy_status": m_dict.get("pregnancy_status") or "not_pregnant",
                "pregnancy_weeks": m_dict.get("pregnancy_weeks"),
                "chronic_conditions": m_dict.get("chronic_conditions") or [],
                "created_at": now_iso
            }
            all_persons_docs.append(member_doc)

    # 3. Calculate Accurate Members Count
    total_members = max(len(all_persons_docs), payload.members_count or 1)

    # 4. Prepare Household Document with embedded members array
    new_doc = {
        "id": hh_id,
        "external_id": payload.external_id or f"ASHA-WARD4-HH{uuid.uuid4().hex[:4].upper()}",
        "head_of_household": payload.head_of_household,
        "address": payload.address,
        "ward": payload.ward or "Ward 4, Aluva",
        "members_count": total_members,
        "members": all_persons_docs,
        "open_care_gaps": 0,
        "priority_score": 10.0,
        "priority_reasons": ["Newly registered household"],
        "malnutrition_risk": payload.malnutrition_risk or "Normal",
        "updated_at": now_iso
    }

    # 5. Persist to MongoDB
    if households_col is not None:
        try:
            households_col.update_one({"id": hh_id}, {"$set": new_doc}, upsert=True)
            if persons_col is not None:
                for p_doc in all_persons_docs:
                    persons_col.update_one(
                        {"person_id": p_doc["person_id"]},
                        {"$set": p_doc},
                        upsert=True
                    )
            saved = households_col.find_one({"id": hh_id}, {"_id": 0})
            if saved:
                return saved
        except Exception as e:
            print(f"[MongoDB Error in create_household] {e}")

    # Fallback in-memory
    MOCK_HOUSEHOLDS_DB.append(new_doc)
    for p_doc in all_persons_docs:
        MOCK_PERSONS_DB.append(p_doc)
    return new_doc

@router.get("/{household_id}", response_model=HouseholdSummarySchema)
def get_household(household_id: str):
    """Retrieves single household details by ID with members list."""
    if households_col is not None:
        try:
            doc = households_col.find_one({"id": household_id}, {"_id": 0})
            if doc:
                if not doc.get("members") and persons_col is not None:
                    doc["members"] = list(persons_col.find({"household_id": household_id}, {"_id": 0}))
                return doc
        except Exception as e:
            print(f"[MongoDB Error in get_household] {e}")

    for h in MOCK_HOUSEHOLDS_DB:
        if h["id"] == household_id or h.get("external_id") == household_id:
            h["members"] = [p for p in MOCK_PERSONS_DB if p.get("household_id") == h["id"]]
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
    Adds a new person to a numbered household in MongoDB persons collection and updates household members array.
    """
    person_doc = person.dict()
    person_doc["household_id"] = household_id
    if not person_doc.get("person_id"):
        person_doc["person_id"] = f"p-{person.name.lower().replace(' ', '-')[:12]}-{uuid.uuid4().hex[:4]}"
    if not person_doc.get("created_at"):
        person_doc["created_at"] = datetime.utcnow().isoformat() + "Z"
    if not person_doc.get("life_stage"):
        person_doc["life_stage"] = _infer_life_stage(person_doc.get("age"))

    if persons_col is not None:
        try:
            persons_col.update_one(
                {"person_id": person_doc["person_id"]},
                {"$set": person_doc},
                upsert=True
            )
            # Update members array and members count in household
            if households_col is not None:
                all_members = list(persons_col.find({"household_id": household_id}, {"_id": 0}))
                households_col.update_one(
                    {"id": household_id},
                    {"$set": {"members": all_members, "members_count": len(all_members)}}
                )
            return person_doc
        except Exception as e:
            print(f"[MongoDB Error in add_household_member] {e}")

    MOCK_PERSONS_DB.append(person_doc)
    return person_doc

# ================= Standalone Persons Endpoints =================
@router.get("/persons/all", response_model=List[PersonSchema])
def list_all_persons(household_id: Optional[str] = None):
    """Returns persons across all households or filtered by household_id."""
    query = {"household_id": household_id} if household_id else {}
    if persons_col is not None:
        try:
            docs = list(persons_col.find(query, {"_id": 0}))
            if docs:
                return docs
        except Exception as e:
            print(f"[MongoDB Error in list_all_persons] {e}")

    if household_id:
        return [p for p in MOCK_PERSONS_DB if p.get("household_id") == household_id]
    return MOCK_PERSONS_DB

@router.post("/persons/direct", response_model=PersonSchema)
def create_or_update_person(person: PersonSchema):
    """Directly creates or updates a person in the persons collection and updates household members array."""
    if not person.household_id:
        raise HTTPException(status_code=400, detail="household_id is required to create a person")

    person_doc = person.dict()
    if not person_doc.get("person_id"):
        person_doc["person_id"] = f"p-{person.name.lower().replace(' ', '-')[:12]}-{uuid.uuid4().hex[:4]}"
    if not person_doc.get("created_at"):
        person_doc["created_at"] = datetime.utcnow().isoformat() + "Z"
    if not person_doc.get("life_stage"):
        person_doc["life_stage"] = _infer_life_stage(person_doc.get("age"))

    if persons_col is not None:
        try:
            persons_col.update_one(
                {"person_id": person_doc["person_id"]},
                {"$set": person_doc},
                upsert=True
            )
            if households_col is not None:
                all_members = list(persons_col.find({"household_id": person.household_id}, {"_id": 0}))
                households_col.update_one(
                    {"id": person.household_id},
                    {"$set": {"members": all_members, "members_count": len(all_members)}}
                )
            return person_doc
        except Exception as e:
            print(f"[MongoDB Error in create_or_update_person] {e}")

    MOCK_PERSONS_DB.append(person_doc)
    return person_doc
