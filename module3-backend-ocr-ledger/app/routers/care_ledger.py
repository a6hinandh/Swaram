from fastapi import APIRouter
from datetime import datetime
from models.schemas import HouseholdCareLedgerSchema
from services.narrative_service import NarrativeService

router = APIRouter(prefix="/api/v1/ledger", tags=["Care Ledger"])

@router.get("/{household_id}", response_model=HouseholdCareLedgerSchema)
def get_care_ledger(household_id: str):
    """
    Returns the persistent household Unresolved Care Ledger across all programmes
    including malnutrition monitoring and longitudinal health history.
    """
    sample_gaps = [
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
        },
        {
            "id": "gap-imm-02",
            "household_id": household_id,
            "person_id": "p-rahul-02",
            "programme": "child_immunisation",
            "gap_type": "mr_vaccine_unconfirmed",
            "description": "Measles-Rubella vaccine status at 16-24 months unverified in MCP card.",
            "evidence": [{"source_type": "paper_register_scan", "observed_at": "2026-08-15T09:00:00Z"}],
            "severity": "medium",
            "status": "needs_information",
            "due_date": "2026-09-10",
            "owner": "ASHA Worker (Ward 4)",
            "recommended_action": "Inspect MCP card or confirm date from mother",
            "last_reviewed_at": datetime.utcnow().isoformat() + "Z"
        },
        {
            "id": "gap-nut-03",
            "household_id": household_id,
            "person_id": "p-rahul-02",
            "programme": "malnutrition",
            "gap_type": "child_malnutrition_risk",
            "description": "Dietary diversity score low (3/8). Child requires egg and milk protein supplementation.",
            "evidence": [{"source_type": "visit_observation", "observed_at": "2026-09-01T11:00:00Z"}],
            "severity": "medium",
            "status": "open",
            "due_date": "2026-09-15",
            "owner": "ASHA Worker (Ward 4)",
            "recommended_action": "Counsel mother on dietary diversity, egg/milk intake, and verify MUAC",
            "last_reviewed_at": datetime.utcnow().isoformat() + "Z"
        }
    ]

    narrative = NarrativeService.generate_narrative(
        household_name="Lakshmi Household",
        recent_visits=[],
        open_gaps=sample_gaps,
        malnutrition_context={
            "dietary_diversity_score": 4,
            "muac_cm": 12.8,
            "wasting_status": "normal",
            "maternal_anemia_flag": True
        }
    )

    return HouseholdCareLedgerSchema(
        household_id=household_id,
        household_name="Lakshmi Household",
        updated_at=datetime.utcnow().isoformat() + "Z",
        open_gaps_count=len(sample_gaps),
        care_gaps=sample_gaps,
        priority_score=88.5,
        priority_reasons=[
            "ANC 3rd trimester check overdue by 8 days",
            "Child immunisation (MR vaccine) pending confirmation",
            "Child dietary diversity low (Malnutrition monitoring active)"
        ],
        longitudinal_narrative=narrative,
        malnutrition_trend="Moderate vulnerability - Dietary diversity monitoring ongoing"
    )
