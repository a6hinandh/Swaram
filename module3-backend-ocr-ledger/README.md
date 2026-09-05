# Module 3: Household Data, OCR & Longitudinal Care Ledger
### Swaram Next-Generation ASHA Platform Data Backbone

**Assigned Teammate:** Member 3 (Backend, Data & OCR Engineer)  
**Tech Stack:** Python 3.10+, FastAPI, SQLite/PostgreSQL/MongoDB, Pydantic, PaddleOCR/Tesseract

---

## 🎯 Purpose & Responsibilities
This module is the canonical health data backbone for the Swaram platform:
1. **Canonical Records:** Persists Household, Person, Visit, Survey, and Malnutrition screening entities.
2. **Longitudinal Care Ledger (`routers/care_ledger.py`):** Persistent household-level memory tracking active, open, and resolved care gaps across Maternal, Child, Nutrition/Malnutrition, and NCD programmes.
3. **Malnutrition & Growth Monitoring:** Tracks childhood growth trajectories, dietary diversity scores, MUAC indicators, and maternal nutritional anemia across household visits.
4. **Offline Synchronisation (`POST /api/v1/sync/push`):** Idempotent ingestion of offline client queues using client-generated UUIDs.
5. **Longitudinal Narrative Generator (`services/narrative_service.py`):** Generates human-readable progress summaries and next-visit priority checklists for the ASHA worker before every household visit.
6. **Paper Register OCR (`services/ocr_service.py`):** Parses photographed paper ASHA registers into structured rows with match confidence against registered households.

---

## 🚀 Quick Start

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

### 2. Fetch Household Care Ledger:
```bash
curl http://localhost:8000/api/v1/ledger/h-lakshmi-001
```
Returns open care gaps, longitudinal narrative, and malnutrition trends.

### 3. Record Confirmed Visit:
```bash
curl -X POST http://localhost:8000/api/v1/visits \
  -H "Content-Type: application/json" \
  -d '{"visit_id":"v-101","household_id":"h-lakshmi-001","worker_id":"w-01","timestamp":"2026-09-05T10:00:00Z","person_updates":[],"confirmed_by_worker_at":"2026-09-05T10:00:00Z"}'
```
