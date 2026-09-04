"""
Module 4: Action, Government Reporting & Prioritisation Service
Demonstration CLI and API service for Playwright automation and explainable prioritization.
"""

from fastapi import FastAPI
from pydantic import BaseModel
from typing import Dict, Any, List

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

class AutomationRequest(BaseModel):
    confirmed_visit: Dict[str, Any]
    auto_submit: bool = False

@app.get("/health")
def health():
    return {"status": "ok", "service": "module4-reporting-priorities"}

@app.post("/api/v1/priorities/calculate")
def calculate_priority(req: PriorityRequest):
    score, reasons = PriorityEngine.calculate_household_priority(req.household, req.care_gaps)
    actions = ActionGenerator.generate_actions_for_gaps(req.household.get("id", "hh-01"), req.care_gaps)
    return {
        "household_id": req.household.get("id"),
        "priority_score": score,
        "priority_reasons": reasons,
        "generated_actions": actions
    }

@app.post("/api/v1/forms/prepare-and-fill")
async def prepare_and_fill(req: AutomationRequest):
    mapped_fields = GovernmentFormMapper.map_visit_to_rch_portal(req.confirmed_visit)
    result = await playwright_adapter.fill_form(mapped_fields, auto_submit=req.auto_submit)
    return {
        "mapped_fields": mapped_fields,
        "automation_result": result
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8002, reload=True)
