from fastapi import APIRouter, HTTPException
from datetime import datetime
from models.schemas import HouseholdCareLedgerSchema, CareGapSchema
from services.narrative_service import NarrativeService
from db.database import care_ledgers_col, vitals_baselines_col

router = APIRouter(prefix="/api/v1/ledger", tags=["Care Ledger"])

@router.get("/{household_id}", response_model=HouseholdCareLedgerSchema)
def get_care_ledger(household_id: str):
    """
    Returns the persistent household Unresolved Care Ledger from MongoDB across all programmes
    including longitudinal vitals baselines, malnutrition monitoring, and clinical history.
    """
    if care_ledgers_col is not None:
        try:
            doc = care_ledgers_col.find_one({"household_id": household_id}, {"_id": 0})
            if doc:
                return doc
        except Exception as e:
            print(f"[MongoDB Error in get_care_ledger] {e}")

    # Fallback default ledger
    sample_gaps = [
        {
            "id": "gap-vitals-spurt-01",
            "household_id": household_id,
            "person_id": "p-radhamani-01",
            "programme": "ncd",
            "gap_type": "vitals_delta_hypertensive_spurt",
            "description": "Acute systolic BP spurt (+28 mmHg from personal baseline 120/80 mmHg).",
            "evidence": [{"source_type": "visit_vitals_deviation", "observed_at": datetime.utcnow().isoformat() + "Z"}],
            "severity": "high",
            "status": "open",
            "due_date": "2026-09-07",
            "owner": "ASHA Worker (Ward 4)",
            "recommended_action": "Home visit within 48h: verify anti-hypertensive drug adherence and re-measure BP.",
            "last_reviewed_at": datetime.utcnow().isoformat() + "Z"
        },
        {
            "id": "gap-anc-01",
            "household_id": household_id,
            "person_id": "p-lakshmi-01",
            "programme": "maternal",
            "gap_type": "overdue_anc_checkup",
            "description": "3rd Trimester antenatal examination and BP check overdue by 8 days.",
            "evidence": [{"source_type": "visit_observation", "observed_at": "2026-08-20T10:30:00Z"}],
            "severity": "high",
            "status": "open",
            "due_date": "2026-08-28",
            "owner": "ASHA Worker (Ward 4)",
            "recommended_action": "Measure vitals, check for pedal edema, schedule PHC review",
            "last_reviewed_at": datetime.utcnow().isoformat() + "Z"
        }
    ]

    narrative = NarrativeService.generate_narrative(
        household_name="Lakshmi Household",
        recent_visits=[],
        open_gaps=sample_gaps,
        malnutrition_context={
            "dietary_diversity_score": 3,
            "muac_cm": 12.6,
            "wasting_status": "moderate_wasting",
            "maternal_anemia_flag": True
        }
    )

    ledger = HouseholdCareLedgerSchema(
        household_id=household_id,
        household_name="Lakshmi Household",
        updated_at=datetime.utcnow().isoformat() + "Z",
        open_gaps_count=len(sample_gaps),
        care_gaps=sample_gaps,
        priority_score=92.5,
        priority_reasons=[
            "Acute hypertensive spurt detected in Radhamani P. (+28 mmHg)",
            "Pediatric weight faltering flagged in child Rahul",
            "ANC 3rd trimester check overdue by 8 days"
        ],
        longitudinal_narrative=narrative,
        malnutrition_trend="High vulnerability - Pediatric weight loss and dietary diversity deficit active"
    )

    if care_ledgers_col is not None:
        try:
            care_ledgers_col.update_one(
                {"household_id": household_id},
                {"$set": ledger.dict()},
                upsert=True
            )
        except Exception as e:
            print(f"[MongoDB Error caching ledger] {e}")

    return ledger

@router.post("/{household_id}/gaps", response_model=HouseholdCareLedgerSchema)
def add_care_gap_to_ledger(household_id: str, gap: CareGapSchema):
    """Adds or updates an active CareGap in the household's MongoDB Care Ledger."""
    gap_data = gap.dict()

    if care_ledgers_col is not None:
        try:
            care_ledgers_col.update_one(
                {"household_id": household_id},
                {
                    "$pull": {"care_gaps": {"id": gap.id}}
                }
            )
            care_ledgers_col.update_one(
                {"household_id": household_id},
                {
                    "$push": {"care_gaps": gap_data},
                    "$set": {"updated_at": datetime.utcnow().isoformat() + "Z"},
                    "$inc": {"open_gaps_count": 1}
                },
                upsert=True
            )
            updated_doc = care_ledgers_col.find_one({"household_id": household_id}, {"_id": 0})
            if updated_doc:
                return updated_doc
        except Exception as e:
            print(f"[MongoDB Error in add_care_gap_to_ledger] {e}")

    return get_care_ledger(household_id)
