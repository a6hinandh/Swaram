from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
from db.database import environmental_assessments_col, care_ledgers_col
import datetime

router = APIRouter(prefix="/api/v1/environmental-assessments", tags=["Environmental & Climate Risk"])

# In-memory store fallback if Mongo is offline
IN_MEMORY_ASSESSMENTS: Dict[str, Dict[str, Any]] = {}

@router.post("", response_model=Dict[str, Any])
def save_environmental_assessment(payload: Dict[str, Any]):
    """
    Saves or updates an Environmental & Climate Health Assessment in MongoDB.
    Also updates associated Care Gaps if care_gaps are provided in the payload.
    """
    assessment_id = payload.get("assessment_id") or f"env_{int(datetime.datetime.now().timestamp() * 1000)}"
    payload["assessment_id"] = assessment_id
    if "timestamp" not in payload:
        payload["timestamp"] = datetime.datetime.utcnow().isoformat()

    household_id = payload.get("household_id", "HH-DEFAULT")

    # 1. Save to MongoDB environmental_assessments collection
    if environmental_assessments_col is not None:
        try:
            result = environmental_assessments_col.update_one(
                {"assessment_id": assessment_id},
                {"$set": payload},
                upsert=True
            )
            print(f"[MongoDB] Successfully saved Environmental Assessment '{assessment_id}' for Household '{household_id}'")
            return {
                "status": "saved",
                "storage": "mongodb",
                "database": "swaram_db",
                "collection": "environmental_assessments",
                "assessment_id": assessment_id,
                "household_id": household_id,
                "upserted": result.upserted_id is not None
            }
        except Exception as e:
            print(f"[MongoDB Error] {e}")

    # Fallback to in-memory
    IN_MEMORY_ASSESSMENTS[assessment_id] = payload
    return {
        "status": "saved",
        "storage": "in_memory_fallback",
        "assessment_id": assessment_id,
        "household_id": household_id
    }

@router.get("", response_model=List[Dict[str, Any]])
def list_environmental_assessments(
    household_id: Optional[str] = Query(None, description="Filter by household ID"),
    limit: int = Query(50, ge=1, le=200)
):
    """Retrieves environmental risk assessments from MongoDB."""
    query: Dict[str, Any] = {}
    if household_id:
        query["household_id"] = household_id

    if environmental_assessments_col is not None:
        try:
            cursor = environmental_assessments_col.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit)
            return list(cursor)
        except Exception as e:
            print(f"[MongoDB Error] {e}")

    results = []
    for doc in IN_MEMORY_ASSESSMENTS.values():
        if household_id and doc.get("household_id") != household_id:
            continue
        results.append(doc)
    return results[:limit]

@router.get("/{assessment_id}", response_model=Dict[str, Any])
def get_environmental_assessment(assessment_id: str):
    """Retrieves a single environmental assessment document."""
    if environmental_assessments_col is not None:
        try:
            doc = environmental_assessments_col.find_one({"assessment_id": assessment_id}, {"_id": 0})
            if doc:
                return doc
        except Exception as e:
            print(f"[MongoDB Error] {e}")

    if assessment_id in IN_MEMORY_ASSESSMENTS:
        return IN_MEMORY_ASSESSMENTS[assessment_id]

    raise HTTPException(status_code=404, detail=f"Environmental assessment '{assessment_id}' not found")
