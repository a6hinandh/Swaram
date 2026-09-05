import sys
import asyncio

if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    except Exception:
        pass

from fastapi import FastAPI
from pydantic import BaseModel
from typing import Dict, Any, List, Optional

from prioritisation.priority_engine import PriorityEngine
from prioritisation.action_generator import ActionGenerator
from automation.form_mapper import GovernmentFormMapper
from automation.playwright_adapter import playwright_adapter

app = FastAPI(
    title="Swaram Automation & Prioritisation (Module 4)",
    version="1.0.0",
    description="Playwright Government Portal Adapter, Explainable Priority Scoring, and Action Generation"
)

class PriorityRequest(BaseModel):
    household: Dict[str, Any]
    care_gaps: List[Dict[str, Any]]
    reference_date: Optional[str] = None

class AutomationRequest(BaseModel):
    confirmed_visit: Dict[str, Any]
    target_portal: str = "mock_rch_portal"
    auto_submit: bool = False
    headless: Optional[bool] = None

class DirectSubmitRequest(BaseModel):
    mapped_fields: Dict[str, Any]
    portal_url: Optional[str] = None
    headless: Optional[bool] = None

@app.get("/health")
def health():
    return {"status": "ok", "service": "module4-reporting-priorities"}

@app.post("/api/v1/priorities/calculate")
def calculate_priority(req: PriorityRequest):
    """
    Computes explainable weighted priority score, human-readable reasons,
    sub-score breakdown, and generated action tasks.
    """
    score, reasons, breakdown = PriorityEngine.calculate_household_priority(
        req.household,
        req.care_gaps,
        reference_date=req.reference_date
    )
    household_id = req.household.get("id") or req.household.get("household_id", "hh-01")
    actions = ActionGenerator.generate_actions_for_gaps(household_id, req.care_gaps)
    return {
        "household_id": household_id,
        "priority_score": score,
        "priority_reasons": reasons,
        "sub_scores": breakdown,
        "generated_actions": actions
    }

@app.post("/api/v1/forms/prepare")
def prepare_form(req: AutomationRequest):
    """
    Translates ConfirmedVisit into a contract-compliant PreparedForm without triggering browser.
    """
    prepared = GovernmentFormMapper.prepare_form(
        req.confirmed_visit,
        target_portal=req.target_portal
    )
    return prepared

@app.post("/api/v1/forms/prepare-and-fill")
async def prepare_and_fill(req: AutomationRequest):
    """
    Prepares form fields and triggers Playwright automation with confirmation gate.
    """
    prepared = GovernmentFormMapper.prepare_form(
        req.confirmed_visit,
        target_portal=req.target_portal
    )
    result = await playwright_adapter.fill_form(
        prepared["mapped_fields"],
        auto_submit=req.auto_submit,
        headless=req.headless
    )
    return {
        "prepared_form": prepared,
        "submission_result": result
    }

@app.post("/api/v1/forms/confirm-submit")
async def confirm_submit(req: DirectSubmitRequest):
    """
    Explicit Human Confirmation Gate: Fires final form submission after worker approval.
    """
    result = await playwright_adapter.fill_form(
        req.mapped_fields,
        auto_submit=True,
        headless=req.headless
    )
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8002, reload=False)

