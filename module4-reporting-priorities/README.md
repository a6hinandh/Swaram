# Module 4: Action, Reporting & Prioritisation
### Swaram Next-Generation ASHA Platform Action & Gateway Engine

**Assigned Teammate:** Member 4 (Automation & Decision Support Engineer)  
**Tech Stack:** Python 3.10+, Playwright, FastAPI, Pydantic, Jinja2

---

## 🎯 Purpose & Responsibilities
This module turns confirmed survey encounters and longitudinal care needs into administrative execution and operational follow-up:
1. **Explainable Visit Prioritisation (`prioritisation/priority_engine.py`):** Calculates transparent weighted priority scores (`0-100`) factoring in child malnutrition indicators, overdue health checks, clinical vitals, and longitudinal household vulnerability.
2. **Action Item Generation (`prioritisation/action_generator.py`):** Converts unresolved care gaps (malnutrition, maternal ANC, NCD screening) into concrete tasks with deadlines and assigned owners.
3. **Health Department Gateway Automation (`automation/playwright_adapter.py`):** Playwright browser automation with accessible selectors (`getByLabel`, `getByRole`) and an explicit worker pre-submission confirmation gate.
4. **Central Reporting Gateway Mock (`portal_mock/`):** Self-contained web server (port 8080) simulating official health reporting portals with sections for Beneficiary Details, Lifestyle NCD Screening, Malnutrition & Child Growth Monitoring, and Maternal ANC.

---

## 🚀 Quick Start

```bash
cd module4-reporting-priorities
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
playwright install chromium
```

### Running the Controlled Reporting Gateway:
```bash
python portal_mock/mock_server.py
```
Open **`http://localhost:8080`** in your browser to inspect the portal interface.

### Running the Full End-to-End Demo:
```bash
python run_demo.py --headless
```

---

## 🧪 Testing the Modules Independently

Run test suite:
```bash
python -m pytest tests
```
8 tests covering priority calculation, malnutrition risk, action generation, form mapping, and Playwright automation.
