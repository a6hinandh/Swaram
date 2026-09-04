# Swaram Technical Architecture & Specifications

## 1. System Overview
Swaram is a voice-agentic field assistant designed for ASHA workers in India, specifically configured for the Malayalam language context.

### Core Engineering Principles
- **Voice-First:** Primary interaction is speaking and listening; zero typing, zero reading.
- **Human Confirmation Gate:** No clinical record or government report is committed without the worker's explicit review and confirmation.
- **Offline-First:** Mobile field operations function completely offline with SQLite and local sync queues.
- **Modularity:** 4 distinct modules communicating exclusively through typed contracts.
- **Explainable Decision Support:** Heuristics and rules are transparent and explainable; no black-box diagnosis.

---

## 2. End-to-End Pipeline

```
ASHA conducts visit
  ↓
Voice capture on Android (Module 1)
  ↓
Malayalam ASR (Module 2 - IndicConformer)
  ↓
Structured extraction (Module 2 - Constrained Schema)
  ↓
Deterministic validation + Uncertainty detection (Module 2)
  ↓
Spoken read-back (Module 2 - IndicF5 TTS)
  ↓
ASHA confirms / corrects (Module 1)
  ↓
Canonical household record (Module 3 - FastAPI/PostgreSQL)
  ↓
┌─────────────────┬──────────────────┬──────────────────┐
↓                 ↓                  ↓
Offline DB        OCR/Register       Follow-up ranking
↓                 ↓                  ↓
Sync queue        Reconciliation     Priority list (Module 4)
└─────────────────┴──────────────────┴──────────────────┘
                  ↓
          Reporting/Form Adapter (Module 4 - Playwright)
                  ↓
          ASHA confirms submit
```

---

## 3. Technology Stack Reference

| Layer | Selection | Rationale |
|---|---|---|
| **Mobile Client** | React Native + Expo (TypeScript) | Fast cross-platform development with native audio/camera access |
| **Local Database** | `expo-sqlite` | Relational local storage supporting offline visits & sync queue |
| **ASR (Speech-to-Text)** | AI4Bharat IndicConformer | High-accuracy Indian language speech recognition supporting Malayalam |
| **TTS (Text-to-Speech)** | IndicF5 Malayalam Adapter | High quality Indian speech synthesis |
| **Backend & Sync** | FastAPI (Python 3.10+) | Asynchronous, typed API generation with Pydantic & SQLAlchemy |
| **OCR Ingestion** | PaddleOCR (with Tesseract fallback) | Layout-aware document & tabular parsing for paper registers |
| **Portal Automation** | Playwright (Python) | Accessible locators (`getByRole`, `getByLabel`) for resilient automation |

---

## 4. Unresolved Care Ledger
The Unresolved Care Ledger is the persistent household-level memory entity that prevents duplicate alerts and connects multiple health programmes:
- Maternal / Antenatal Care (ANC)
- Child Immunisation (MCP card follow-ups)
- Nutrition & Dietary Diversity
- Non-Communicable Diseases (NCDs / Hypertension / Diabetes)
- Mental Health Screening

Every care gap maintains:
- `evidence`: Source observations or register scans
- `severity`: low, medium, high, critical
- `status`: open, needs_information, action_ready, action_in_progress, reported, resolved
- `due_date`: Normalised ISO date
- `recommended_action`: Clear operational next step
