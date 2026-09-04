# Module 3: Household Data, OCR & Care Ledger

**Assigned Teammate:** Member 3 (Backend, Data & OCR Engineer)  
**Tech Stack:** Python 3.10+, FastAPI, SQLite/PostgreSQL, SQLAlchemy, Pydantic, PaddleOCR/Tesseract

---

## 🎯 Purpose & Responsibilities
This module is the canonical data backbone for the entire Swaram platform:
1. **Canonical Records:** Persists Household, Person, Visit, Observation, and CareGap entities.
2. **Offline Synchronisation (`POST /api/v1/sync/push`):** Idempotent ingestion of offline client queues using client-generated UUIDs.
3. **Paper Register OCR (`services/ocr_service.py`):** Parses photographed paper ASHA registers into structured rows with match confidence against registered households.
4. **Unresolved Care Ledger (`routers/care_ledger.py`):** Persistent household-level ledger of open care gaps across Maternal, Child, NCD, and Nutrition programmes.
5. **Longitudinal Narrative Generator (`services/narrative_service.py`):** Generates human-readable progress summaries for the ASHA worker before every household visit.

---

## 🚀 Quick Start for Member 3

```bash
cd module3-backend-ocr-ledger
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
cd app
python main.py
```
The server will start on **`http://localhost:8000`**.  
Interactive Swagger docs: **`http://localhost:8000/docs`**.

---

## 🧪 Testing Endpoints Independently

### 1. Health Check:
```bash
curl http://localhost:8000/health
```

### 2. Fetch Care Ledger:
```bash
curl http://localhost:8000/api/v1/ledger/h-lakshmi-001
```

### 3. Test Offline Sync Push:
```bash
curl -X POST http://localhost:8000/api/v1/sync/push \
  -H "Content-Type: application/json" \
  -d '{"device_id":"dev-01","items":[{"client_event_id":"evt-101","entity":"visit","operation":"create","payload":{}}]}'
```

---

## 📂 Directory Layout
```
module3-backend-ocr-ledger/
├── requirements.txt
├── README.md
└── app/
    ├── main.py                  # Server entry point (port 8000)
    ├── models/
    │   └── schemas.py           # Pydantic models matching contracts
    ├── routers/
    │   ├── households.py        # /api/v1/households
    │   ├── visits.py            # /api/v1/visits
    │   ├── sync.py              # /api/v1/sync/push
    │   ├── care_ledger.py       # /api/v1/ledger
    │   └── ocr.py               # /api/v1/ocr
    └── services/
        ├── narrative_service.py # Longitudinal narrative generator
        └── ocr_service.py       # Paper register table parser
```

---

## 🤝 Frozen Contracts Used
- Implements: [`contracts/care_ledger.schema.json`](../contracts/care_ledger.schema.json)
- Consumes: [`contracts/visit.schema.json`](../contracts/visit.schema.json)
- OCR Output: [`contracts/ocr.schema.json`](../contracts/ocr.schema.json)
