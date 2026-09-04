# Module 4: Action, Government Reporting & Prioritisation

**Assigned Teammate:** Member 4 (Automation & Decision Support Engineer)  
**Tech Stack:** Python 3.10+, Playwright, FastAPI, Pydantic, Jinja2

---

## 🎯 Purpose & Responsibilities
This module turns confirmed clinical encounters into administrative execution and operational follow-up:
1. **Explainable Visit Prioritisation (`prioritisation/priority_engine.py`):** Calculates transparent weighted priority scores (`0-100`) with human-readable contributing reasons (e.g. overdue ANC checkup, unverified vaccine).
2. **Action Item Generation (`prioritisation/action_generator.py`):** Converts unresolved care gaps into concrete tasks with deadlines and assigned owners.
3. **Government Portal Automation (`automation/playwright_adapter.py`):** Playwright browser automation with accessible selectors (`getByLabel`, `getByRole`) and an explicit worker pre-submission confirmation gate.
4. **Mock Government Portal (`portal_mock/`):** Self-contained web server (port 8080) simulating a live NHM RCH/ANMOL maternal health reporting portal.

---

## 🚀 Quick Start for Member 4

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

### Running the Controlled Mock Government Portal:
```bash
python portal_mock/mock_server.py
```
Open **`http://localhost:8080`** in your browser to see the live mock portal.

### Running the Automation & Priority Service:
```bash
python main.py
```
Runs on **`http://localhost:8002`**.

---

## 🧪 Testing the Modules Independently

### Test Priority Calculation & Action Generation:
```bash
curl -X POST http://localhost:8002/api/v1/priorities/calculate \
  -H "Content-Type: application/json" \
  -d '{"household":{"id":"h-01","latest_vitals":{"systolic_bp":142}},"care_gaps":[{"id":"gap-1","severity":"high","status":"open","description":"ANC overdue 8 days"}]}'
```

---

## 📂 Directory Layout
```
module4-reporting-priorities/
├── requirements.txt
├── README.md
├── main.py                          # Automation & priority service (port 8002)
├── portal_mock/
│   ├── mock_server.py               # Simulated government portal (port 8080)
│   └── templates/
│       └── form.html                # Accessible government web form
├── automation/
│   ├── form_mapper.py               # Maps ConfirmedVisit -> portal fields
│   └── playwright_adapter.py        # Playwright accessibility-based form filler
└── prioritisation/
    ├── priority_engine.py           # Transparent weighted ranking algorithm
    └── action_generator.py          # Care gap -> actionable task generator
```

---

## 🤝 Frozen Contracts Used
- Consumes: [`contracts/visit.schema.json`](../contracts/visit.schema.json)
- Consumes: [`contracts/care_ledger.schema.json`](../contracts/care_ledger.schema.json)
- Outputs: [`contracts/reporting.schema.json`](../contracts/reporting.schema.json)
