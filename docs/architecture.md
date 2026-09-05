# Swaram Technical Architecture & Specifications
### Next-Generation Conversational ASHA Worker Platform

## 1. System Overview
**Swaram** is a complete next-generation frontline healthcare platform designed to replace legacy, form-based ASHA worker mobile apps. Configured natively for the Malayalam language context, it replaces rigid MCQ survey dropdowns with natural language conversation and automated clinical extraction.

### Core Engineering Principles
- **Conversational-First:** Primary interaction is speaking naturally in Malayalam; zero typing, zero navigation through dense MCQ dropdowns.
- **Proactive Missing Information Resolution:** Proactively asks the worker targeted conversational follow-up questions for unmentioned mandatory survey fields.
- **Survey Review Card:** Transparently displays all extracted and clarified fields for worker inspection before submission.
- **Human Confirmation Gate:** No clinical record or government report is committed without the worker's explicit review and confirmation.
- **Overlooked Health Challenges Focus:** First-class screening and tracking for early childhood malnutrition (MUAC, dietary diversity score, wasting/stunting) and maternal nutritional anemia.
- **Longitudinal Household Memory:** Persistent Unresolved Care Ledger tracking open care needs across Maternal, Child, Malnutrition, and NCD programmes.
- **Offline-First:** Mobile field operations function completely offline with SQLite and local event queues.

---

## 2. End-to-End Pipeline

```
ASHA conducts household visit
  ↓
Voice capture on Swaram Mobile (Module 1)
  ↓
Malayalam ASR (Module 2 - IndicConformer)
  ↓
Structured survey & clinical extraction (Module 2)
  ↓
Deterministic physiological validation & Malnutrition check (Module 2)
  ↓
Proactive missing field detector:
  → If mandatory fields missing: Swaram asks conversational follow-up question
  → ASHA replies naturally by voice; field updated in real-time
  ↓
Spoken read-back (Module 2 - IndicF5 TTS)
  ↓
Swaram Survey Review Card displayed (Module 1)
  ↓
ASHA confirms / edits (Module 1)
  ↓
Canonical longitudinal household record (Module 3 - FastAPI/MongoDB/SQLite)
  ↓
┌─────────────────┬──────────────────┬──────────────────┐
↓                 ↓                  ↓
Offline DB        OCR/Register       Prioritisation ranking
↓                 ↓                  ↓
Sync queue        Reconciliation     Priority list (Module 4)
└─────────────────┴──────────────────┴──────────────────┘
                  ↓
          Central Reporting Gateway (Module 4 - Playwright)
                  ↓
          ASHA confirms final submission
```

---

## 3. Technology Stack Reference

| Layer | Selection | Rationale |
|---|---|---|
| **Mobile Client** | React Native + Expo (TypeScript) | Fast cross-platform development with native audio/camera access |
| **Local Database** | `expo-sqlite` | Relational local storage supporting offline visits & sync queue |
| **ASR (Speech-to-Text)** | AI4Bharat IndicConformer | High-accuracy Indian language speech recognition supporting Malayalam |
| **TTS (Text-to-Speech)** | IndicF5 Malayalam Adapter | High-quality Indian speech synthesis |
| **Backend & Sync** | FastAPI (Python 3.10+) | Asynchronous, typed API generation with Pydantic & SQLAlchemy/MongoDB |
| **OCR Ingestion** | PaddleOCR (with Tesseract fallback) | Layout-aware document & tabular parsing for paper registers |
| **Gateway Automation** | Playwright (Python) | Accessible locators (`getByRole`, `getByLabel`) for resilient automation |

---

## 4. Unresolved Care Ledger & Malnutrition Memory
The Unresolved Care Ledger is the persistent household-level memory entity that prevents duplicate alerts and connects multiple health programmes:
- Maternal / Antenatal Care (ANC)
- Child Immunisation (MCP card follow-ups)
- Malnutrition & Growth Monitoring (MUAC, Dietary Diversity)
- Non-Communicable Diseases (NCDs / Hypertension / Diabetes)
- Mental Health Screening

Every care gap maintains:
- `evidence`: Source observations or register scans
- `severity`: low, medium, high, critical
- `status`: open, needs_information, action_ready, action_in_progress, reported, resolved
- `due_date`: Normalised ISO date
- `recommended_action`: Clear operational next step
