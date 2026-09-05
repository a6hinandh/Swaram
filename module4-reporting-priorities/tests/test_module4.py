"""
Unit & Integration Tests for Module 4: Action, Reporting & Prioritisation
Validates explainable priority calculations (including malnutrition & overdue gaps),
action generation, form mapping, and Playwright automation.
"""

import pytest
import asyncio
import os
import sys
import threading
import time
import uvicorn
import uuid

# Add parent directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from prioritisation.priority_engine import PriorityEngine
from prioritisation.action_generator import ActionGenerator
from automation.form_mapper import GovernmentFormMapper
from automation.playwright_adapter import playwright_adapter
from portal_mock.mock_server import app as mock_app

# Start server fixture
@pytest.fixture(scope="session", autouse=True)
def run_mock_server():
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    is_running = False
    try:
        s.connect(("127.0.0.1", 8080))
        s.close()
        is_running = True
    except Exception:
        pass

    if not is_running:
        config = uvicorn.Config(mock_app, host="127.0.0.1", port=8080, log_level="error")
        server = uvicorn.Server(config)
        t = threading.Thread(target=server.run, daemon=True)
        t.start()
        time.sleep(1.5)
    yield

def test_priority_engine_lakshmi_household():
    hh = {
        "id": "hh-01",
        "latest_vitals": {"systolic_bp": 142, "diastolic_bp": 90, "hemoglobin_g_dl": 10.2},
        "vulnerability_factors": {"has_pregnant_woman": True}
    }
    gaps = [
        {
            "id": "gap-1",
            "severity": "high",
            "status": "open",
            "due_date": "2026-08-28",
            "description": "ANC 3rd trimester overdue 8 days"
        },
        {
            "id": "gap-2",
            "severity": "medium",
            "status": "needs_information",
            "due_date": "2026-09-10",
            "description": "Child MR vaccine status unverified"
        }
    ]
    score, reasons, breakdown = PriorityEngine.calculate_household_priority(hh, gaps, reference_date="2026-09-05")
    assert score == 88.5
    assert len(reasons) >= 3
    assert breakdown["urgency"] == 25.0
    assert breakdown["overdue"] == 18.5
    assert breakdown["risk"] == 20.0
    assert breakdown["followup"] == 15.0
    assert breakdown["vulnerability"] == 10.0
    assert breakdown["risk"] > 0
    assert any("Elevated blood pressure" in r for r in reasons)

def test_priority_engine_malnutrition_risk():
    hh = {
        "id": "hh-mal-01",
        "latest_vitals": {"systolic_bp": 120},
        "malnutrition_risk": "Moderate",
        "vulnerability_factors": {"child_malnutrition_flag": True}
    }
    gaps = [
        {
            "id": "gap-nut-01",
            "programme": "malnutrition",
            "gap_type": "child_malnutrition_risk",
            "severity": "medium",
            "status": "open",
            "description": "Low dietary diversity score (3/8)"
        }
    ]
    score, reasons, breakdown = PriorityEngine.calculate_household_priority(hh, gaps)
    assert score > 0
    assert any("malnutrition" in r.lower() for r in reasons)

def test_priority_engine_empty_routine():
    hh = {"id": "hh-02", "latest_vitals": {"systolic_bp": 118}}
    gaps = []
    score, reasons, breakdown = PriorityEngine.calculate_household_priority(hh, gaps)
    assert score == 0.0
    assert "Routine scheduled follow-up" in reasons

def test_action_generator_schema():
    gaps = [
        {
            "id": str(uuid.uuid4()),
            "programme": "maternal",
            "gap_type": "overdue_anc",
            "recommended_action": "Conduct home visit for BP and IFA",
            "due_date": "2026-09-12",
            "severity": "high"
        },
        {
            "id": str(uuid.uuid4()),
            "programme": "malnutrition",
            "gap_type": "child_malnutrition_risk",
            "recommended_action": "Counsel mother on egg/milk intake and verify MUAC",
            "due_date": "2026-09-15",
            "severity": "medium"
        }
    ]
    actions = ActionGenerator.generate_actions_for_gaps("hh-test", gaps)
    assert len(actions) == 2
    action = actions[0]
    assert "action_id" in action
    assert action["household_id"] == "hh-test"
    assert action["status"] == "pending"
    assert "Maternal" in action["title"]
    assert "Malnutrition" in actions[1]["title"]

def test_form_mapper_swaram_portal():
    visit = {
        "visit_id": str(uuid.uuid4()),
        "person_updates": [
            {
                "name": "Lakshmi Amma",
                "pregnancy_weeks": 32,
                "vitals": {"systolic_bp": 130, "diastolic_bp": 85},
                "medications_given": ["Iron Folic Acid (IFA) Tablets (30 Days)"],
                "follow_up_date": "2026-09-15"
            }
        ],
        "malnutrition_assessment": {
            "child_age_months": 18,
            "muac_cm": 12.8,
            "dietary_diversity_score": 4,
            "risk_level": "moderate"
        }
    }
    prepared = GovernmentFormMapper.prepare_form(visit, target_portal="swaram_health_portal")
    assert prepared["validation_passed"] is True
    assert prepared["missing_fields"] == []
    assert prepared["mapped_fields"]["beneficiary_name"] == "Lakshmi Amma"
    assert prepared["mapped_fields"]["ifa_tablets"] == "30"
    assert prepared["mapped_fields"]["dietary_diversity"] == "4/8 food groups"

def test_form_mapper_missing_name():
    visit = {
        "visit_id": str(uuid.uuid4()),
        "person_updates": [{"vitals": {"systolic_bp": 120}}]
    }
    prepared = GovernmentFormMapper.prepare_form(visit, target_portal="mock_rch_portal")
    assert prepared["validation_passed"] is False
    assert "beneficiary_name" in prepared["missing_fields"]

@pytest.mark.asyncio
async def test_playwright_confirmation_gate():
    mapped_fields = {
        "beneficiary_name": "Lakshmi Test PreSubmit",
        "gestational_weeks": "30",
        "systolic_bp": "125",
        "diastolic_bp": "82",
        "ifa_tablets": "30"
    }
    # Test confirmation gate (auto_submit=False)
    result = await playwright_adapter.fill_form(mapped_fields, auto_submit=False, headless=True)
    assert result["status"] == "pending_worker_confirmation"

@pytest.mark.asyncio
async def test_playwright_full_submit_and_ack():
    mapped_fields = {
        "beneficiary_name": "Lakshmi Automated Submission",
        "gestational_weeks": "32",
        "systolic_bp": "130",
        "diastolic_bp": "85",
        "ifa_tablets": "30",
        "follow_up_date": "2026-09-20"
    }
    # Test full submission with acknowledgment receipt
    result = await playwright_adapter.fill_form(mapped_fields, auto_submit=True, headless=True)
    assert result["status"] == "success"
    assert "acknowledgement_number" in result
    assert "ACK-2026-" in result["acknowledgement_number"]
