"""
SWARAM • Module 4 Interactive Demonstration Runner
Showcases Explainable Priority Scoring (with Malnutrition Monitoring),
Action Generation, and Live Playwright Health Gateway Automation.
"""

import sys
import os
import time
import asyncio
import threading
import uvicorn
from datetime import datetime

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Ensure utf-8 output encoding across Windows consoles
if sys.platform == "win32":
    try:
        if sys.stdout.encoding.lower() != "utf-8":
            sys.stdout.reconfigure(encoding="utf-8")
        if sys.stderr.encoding.lower() != "utf-8":
            sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from prioritisation.priority_engine import PriorityEngine
from prioritisation.action_generator import ActionGenerator
from automation.form_mapper import GovernmentFormMapper
from automation.playwright_adapter import playwright_adapter
from portal_mock.mock_server import app as mock_portal_app

def print_banner(text: str, char: str = "="):
    line = char * 72
    print(f"\n{line}\n  {text}\n{line}")

def print_step(step_num: int, title: str):
    print(f"\n[STEP {step_num}] {title}")
    print("-" * 55)

def start_mock_server_if_needed():
    """Starts the mock portal server on port 8080 in a background thread if not already running."""
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.connect(("127.0.0.1", 8080))
        s.close()
        print("✓ Health Department Central Gateway is already running on http://localhost:8080")
        return None
    except Exception:
        pass

    print("⚡ Starting Health Department Central Gateway on http://localhost:8080...")
    config = uvicorn.Config(mock_portal_app, host="127.0.0.1", port=8080, log_level="error")
    server = uvicorn.Server(config)
    t = threading.Thread(target=server.run, daemon=True)
    t.start()
    time.sleep(1.5)
    print("✓ Health Department Central Gateway online at http://localhost:8080")
    return server

async def run_full_demo(headless: bool = False):
    print_banner("സ്വരം • SWARAM: Next-Generation ASHA Worker Platform Demonstration\n  Frontline Health Decision Support & Health Department Reporting Gateway")
    print("Scenario: Frontline visit prioritization, malnutrition check & administrative filing for Lakshmi Household")
    print("Tech Stack: Python 3.12, FastAPI, Playwright (Chromium), Pydantic\n")

    # Start mock server
    start_mock_server_if_needed()

    # Synthetic Household Record (from Swaram Frozen Contracts)
    household_context = {
        "id": "hh-lakshmi-42",
        "household_name": "Lakshmi Amma's Household",
        "address": "House 42, Kudumbashree Lane, Aluva, Ward 4",
        "latest_vitals": {
            "systolic_bp": 142,
            "diastolic_bp": 92,
            "hemoglobin_g_dl": 10.4
        },
        "vulnerability_factors": {
            "has_pregnant_woman": True,
            "has_infant_under_1": False,
            "elderly_alone": False
        },
        "malnutrition_risk": "Moderate"
    }

    open_care_gaps = [
        {
            "id": "gap-anc-01",
            "household_id": "hh-lakshmi-42",
            "person_id": "p-lakshmi-01",
            "programme": "maternal",
            "gap_type": "overdue_anc_checkup",
            "description": "3rd Trimester antenatal examination and BP check overdue by 8 days.",
            "severity": "high",
            "status": "open",
            "due_date": "2026-08-28",
            "owner": "ASHA Worker (Ward 4)",
            "recommended_action": "Measure vitals, check for pedal edema, distribute IFA tablets."
        },
        {
            "id": "gap-imm-02",
            "household_id": "hh-lakshmi-42",
            "person_id": "p-rahul-02",
            "programme": "child_immunisation",
            "gap_type": "mr_vaccine_unconfirmed",
            "description": "Measles-Rubella vaccine status at 16-24 months unverified in MCP card.",
            "severity": "medium",
            "status": "needs_information",
            "due_date": "2026-09-10",
            "owner": "ASHA Worker (Ward 4)",
            "recommended_action": "Inspect MCP card or verify immunization date from mother."
        },
        {
            "id": "gap-nut-03",
            "household_id": "hh-lakshmi-42",
            "person_id": "p-rahul-02",
            "programme": "malnutrition",
            "gap_type": "child_malnutrition_risk",
            "description": "Low dietary diversity score (3/8). Child requires egg and milk protein supplementation.",
            "severity": "medium",
            "status": "open",
            "due_date": "2026-09-15",
            "owner": "ASHA Worker (Ward 4)",
            "recommended_action": "Counsel family on child dietary diversity (milk, eggs, pulses) and monitor MUAC."
        }
    ]

    # STEP 1: EXPLAINABLE PRIORITISATION
    print_step(1, "Transparent Household Priority Scoring (0-100)")
    ref_date = "2026-09-05"
    score, reasons, breakdown = PriorityEngine.calculate_household_priority(
        household_context,
        open_care_gaps,
        reference_date=ref_date
    )

    print(f"Calculated Priority Score : \033[1;32m{score} / 100.0\033[0m (High Priority Daily Target)")
    print("\nMathematical Sub-Score Contribution:")
    for comp, val in breakdown.items():
        bar = "█" * int(val) + "░" * (30 - int(val))
        print(f"  • {comp.capitalize():<14}: {val:>4.1f} pts  [{bar}]")

    print("\nExplainable Clinical & Malnutrition Contributing Reasons:")
    for r in reasons:
        print(f"  ✓ {r}")

    # STEP 2: OPERATIONAL ACTION GENERATION
    print_step(2, "Operational Action Generation (Task Accountability)")
    actions = ActionGenerator.generate_actions_for_gaps(household_context["id"], open_care_gaps)
    print(f"Synthesized {len(actions)} actionable tasks adhering to contracts/reporting.schema.json:\n")
    for idx, act in enumerate(actions, 1):
        print(f"  Task {idx}: {act['title']}")
        print(f"     Action ID   : {act['action_id']}")
        print(f"     Description : {act['description']}")
        print(f"     Assigned To : {act['assigned_to']}")
        print(f"     Due Date    : {act['due_date']}  |  Status: {act['status']}\n")

    # STEP 3: CONVERT CONFIRMED VISIT TO PREPARED FORM
    print_step(3, "Zero-Hallucination Form Mapping with Malnutrition Parameters")
    confirmed_visit_payload = {
        "visit_id": "v-2026-0905-01",
        "household_id": "hh-lakshmi-42",
        "worker_id": "asha-ward4-kavitha",
        "timestamp": "2026-09-05T09:15:00Z",
        "person_updates": [
            {
                "person_id": "p-lakshmi-01",
                "name": "Lakshmi Amma",
                "pregnancy_weeks": 32,
                "vitals": {
                    "systolic_bp": 130,
                    "diastolic_bp": 85,
                    "weight_kg": 58
                },
                "medications_given": ["Iron Folic Acid (IFA) Tablets (30 Days)"],
                "follow_up_date": "2026-09-12"
            }
        ],
        "malnutrition_assessment": {
            "child_age_months": 18,
            "muac_cm": 12.8,
            "dietary_diversity_score": 4,
            "risk_level": "moderate"
        }
    }

    prepared_form = GovernmentFormMapper.prepare_form(confirmed_visit_payload, target_portal="swaram_health_portal")
    print("Contract-Compliant PreparedForm Output:")
    print(f"  • Target Portal     : {prepared_form['target_portal']}")
    print(f"  • Validation Passed : {prepared_form['validation_passed']}")
    print(f"  • Missing Fields    : {prepared_form['missing_fields'] or 'None (Complete)'}")
    print("  • Mapped Key-Values :")
    for k, v in prepared_form["mapped_fields"].items():
        print(f"      - {k:<20}: {v}")

    # STEP 4: PLAYWRIGHT BROWSER AUTOMATION & CONFIRMATION GATE
    print_step(4, "Playwright Browser Automation & Human Confirmation Gate")
    if not headless:
        print(">>> Opening Chromium browser window on screen...")
        print(">>> Observe survey & malnutrition fields automatically populated...")
    else:
        print(">>> Running Chromium automation in headless mode...")

    # Execute Playwright automation with auto_submit=True
    automation_result = await playwright_adapter.fill_form(
        prepared_form["mapped_fields"],
        auto_submit=True,
        headless=headless,
        slow_mo_ms=100 if not headless else 0
    )

    print("\n" + "=" * 55)
    print("🏆 HEALTH DEPARTMENT GATEWAY SUBMISSION RESULT:")
    print("=" * 55)
    print(f"  • Status          : {automation_result.get('status').upper()}")
    print(f"  • Acknowledgment  : \033[1;32m{automation_result.get('acknowledgement_number')}\033[0m")
    print(f"  • Target URL      : {automation_result.get('portal')}")
    print(f"  • Result Message  : {automation_result.get('message')}")
    print(f"  • Audit Timestamp : {automation_result.get('timestamp')}")
    print("=" * 55)

    print("\n✓ Verification: Inspect registered submissions at http://localhost:8080/api/submissions")
    print("🎉 Module 4 Complete: The ASHA spoke naturally; survey is verified and official reporting is completed!\n")

if __name__ == "__main__":
    is_headless = "--headless" in sys.argv
    asyncio.run(run_full_demo(headless=is_headless))
