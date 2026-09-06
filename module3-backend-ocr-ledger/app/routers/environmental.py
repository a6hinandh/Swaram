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
    Calculates visiting_no as count of previous records + 1.
    Also updates associated Care Gaps if care_gaps are provided in the payload.
    """
    assessment_id = payload.get("assessment_id") or f"env_{int(datetime.datetime.now().timestamp() * 1000)}"
    payload["assessment_id"] = assessment_id
    household_id = payload.get("household_id")
    person_id = payload.get("person_id")

    # Determine visiting_no (count of previous environmental assessments for this household + 1)
    visiting_no = payload.get("visiting_no") or payload.get("visit_number")
    if not visiting_no:
        if environmental_assessments_col is not None:
            try:
                existing = environmental_assessments_col.find_one({"assessment_id": assessment_id})
                if existing and existing.get("visiting_no"):
                    visiting_no = existing["visiting_no"]
                else:
                    query = {"household_id": household_id} if household_id else {}
                    prev_count = environmental_assessments_col.count_documents(query)
                    visiting_no = prev_count + 1
            except Exception as e:
                print(f"[MongoDB visiting_no error] {e}")
                visiting_no = 1
        else:
            prev_count = len([a for a in IN_MEMORY_ASSESSMENTS.values() if a.get("household_id") == household_id])
            visiting_no = prev_count + 1

    payload["visiting_no"] = visiting_no
    payload["visit_number"] = visiting_no
    payload["assessment_number"] = visiting_no
    now_iso = datetime.datetime.utcnow().isoformat() + "Z"
    if not payload.get("timestamp"):
        payload["timestamp"] = now_iso

    # 1. Save to MongoDB environmental_assessments collection
    if environmental_assessments_col is not None:
        try:
            result = environmental_assessments_col.update_one(
                {"assessment_id": assessment_id},
                {"$set": payload},
                upsert=True
            )

            # Update care ledger if care gaps exist in the assessment
            care_gaps = payload.get("care_gaps") or []
            if care_gaps and care_ledgers_col is not None and household_id:
                for gap in care_gaps:
                    gap_doc = {
                        "id": gap.get("id") or f"gap-env-{int(datetime.datetime.now().timestamp() * 1000)}",
                        "household_id": household_id,
                        "person_id": person_id,
                        "programme": "environmental_climate",
                        "gap_type": gap.get("programme") or "environmental_vulnerability",
                        "description": gap.get("description") or "Environmental Climate Risk Flagged",
                        "evidence": [{
                            "source_type": "environmental_assessment",
                            "visiting_no": visiting_no,
                            "observed_at": now_iso
                        }],
                        "severity": gap.get("priority", "medium"),
                        "status": "open",
                        "due_date": now_iso[:10],
                        "owner": "ASHA Worker (Ward 4)",
                        "recommended_action": gap.get("action") or "Counsel household on climate risk mitigation.",
                        "last_reviewed_at": now_iso
                    }
                    care_ledgers_col.update_one(
                        {"household_id": household_id},
                        {
                            "$push": {"care_gaps": gap_doc},
                            "$set": {"updated_at": now_iso, "visiting_no": visiting_no},
                            "$inc": {"open_gaps_count": 1}
                        },
                        upsert=True
                    )

            print(f"[MongoDB] Successfully saved Environmental Assessment '{assessment_id}' (Visit #{visiting_no}) for Household '{household_id}'")
            return {
                "status": "saved",
                "storage": "mongodb",
                "database": "swaram_db",
                "collection": "environmental_assessments",
                "assessment_id": assessment_id,
                "visiting_no": visiting_no,
                "household_id": household_id,
                "person_id": person_id,
                "upserted": result.upserted_id is not None
            }
        except Exception as e:
            print(f"[MongoDB Error in save_environmental_assessment] {e}")

    # Fallback to in-memory
    IN_MEMORY_ASSESSMENTS[assessment_id] = payload
    return {
        "status": "saved",
        "storage": "in_memory_fallback",
        "assessment_id": assessment_id,
        "visiting_no": visiting_no,
        "household_id": household_id,
        "person_id": person_id
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
