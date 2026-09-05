from fastapi import APIRouter
from typing import List
from models.schemas import HouseholdSummarySchema

router = APIRouter(prefix="/api/v1/households", tags=["Households"])

# In-memory canonical state for Swaram Next-Gen Platform
MOCK_HOUSEHOLDS_DB = [
    {
        "id": "h-lakshmi-001",
        "external_id": "ASHA-WARD4-HH042",
        "head_of_household": "Lakshmi Amma",
        "address": "House 42, Kudumbashree Lane, Aluva",
        "members_count": 4,
        "open_care_gaps": 3,
        "priority_score": 88.5,
        "priority_reasons": [
            "ANC 3rd trimester check overdue by 8 days",
            "Child immunisation (MR vaccine) pending confirmation",
            "Child malnutrition monitoring active (low dietary diversity)"
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
    """Returns today's households assigned to the ASHA worker with priority and malnutrition indicators."""
    return MOCK_HOUSEHOLDS_DB

@router.get("/{household_id}", response_model=HouseholdSummarySchema)
def get_household(household_id: str):
    for h in MOCK_HOUSEHOLDS_DB:
        if h["id"] == household_id:
            return h
    return MOCK_HOUSEHOLDS_DB[0]
