from fastapi import APIRouter
from typing import List, Dict, Any
from models.schemas import ConfirmedVisitSchema

router = APIRouter(prefix="/api/v1/visits", tags=["Visits"])

# In-memory store for confirmed visits
VISITS_STORE: List[Dict[str, Any]] = []

@router.post("")
def record_confirmed_visit(visit: ConfirmedVisitSchema):
    """
    Persists a confirmed clinical visit.
    Applies idempotency by visit_id to prevent duplicates.
    """
    for existing in VISITS_STORE:
        if existing["visit_id"] == visit.visit_id:
            return {"status": "already_exists", "id": visit.visit_id}
            
    VISITS_STORE.append(visit.dict())
    return {"status": "saved", "id": visit.visit_id, "timestamp": visit.timestamp}

@router.get("", response_model=List[ConfirmedVisitSchema])
def get_visits():
    return VISITS_STORE
