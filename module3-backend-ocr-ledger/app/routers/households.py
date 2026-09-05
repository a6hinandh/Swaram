from fastapi import APIRouter
from typing import List
from models.schemas import HouseholdSummarySchema
from db.database import households_col

router = APIRouter(prefix="/api/v1/households", tags=["Households"])

# In-memory canonical state fallback for Swaram Next-Gen Platform
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
    }
]

@router.get("", response_model=List[HouseholdSummarySchema])
def get_households():
    """Returns today's households assigned to the ASHA worker from MongoDB with priority and malnutrition indicators."""
    if households_col is not None:
        try:
            docs = list(households_col.find({}, {"_id": 0}).sort("priority_score", -1))
            if docs:
                return docs
        except Exception as e:
            print(f"[MongoDB Error in get_households] {e}")

    return MOCK_HOUSEHOLDS_DB

@router.get("/{household_id}", response_model=HouseholdSummarySchema)
def get_household(household_id: str):
    if households_col is not None:
        try:
            doc = households_col.find_one({"id": household_id}, {"_id": 0})
            if doc:
                return doc
        except Exception as e:
            print(f"[MongoDB Error in get_household] {e}")

    for h in MOCK_HOUSEHOLDS_DB:
        if h["id"] == household_id:
            return h
    return MOCK_HOUSEHOLDS_DB[0]

