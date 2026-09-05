# സ്വരം • SWARAM
### Next-Generation Conversational ASHA Worker Platform & Care-Gap Intelligence

> **"Conversational field surveys. Zero tedious dropdowns. Every survey verified by the worker before filing."**  
> *A ground-up reimagining of frontline healthcare applications for India's Accredited Social Health Activists (ASHAs).*

---

## 📌 What is Swaram?

**Swaram** is a complete, **next-generation ASHA worker application concept** engineered to replace the legacy paradigm of frontline healthcare mobile apps (such as Kerala's official Shaili app, ANMOL, and RCH).

### The Real-World Problem in Existing ASHA Apps
Field studies and app store reviews of existing government ASHA worker applications (such as the Kerala Government's Shaili app) reveal persistent operational bottlenecks:
1. **Tedious Multi-Screen Survey Forms:** Frontline workers are forced to navigate dense, multi-choice question (MCQ) dropdowns, checkboxes, and nested sub-menus on low-cost smartphones while standing at doorsteps in bright sunlight or rain.
2. **Digital Literacy & Interface Fatigue:** Many community health activists face cognitive friction and screen fatigue when confronted with complex English/vernacular nested forms, leading to skipped fields, incomplete surveys, and administrative burnout.
3. **Forgotten Encounters & Fragmented Silos:** Legacy apps treat surveys as isolated one-off forms that are filed and forgotten. There is no longitudinal household memory connecting maternal health, early childhood development, malnutrition, and chronic lifestyle diseases.
4. **Overlooked Health Challenges:** Early childhood malnutrition (stunting, wasting, low dietary diversity) and chronic NCDs slip through the cracks because traditional survey apps lack active decision support.

---

### The Swaram Conversational Solution
Swaram replaces the outdated form-filling paradigm with an intuitive **conversational experience**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SWARAM CORE APP WORKFLOW                        │
└────────────────────────────────────────────────────────────────────────┘
                                 │
     1. Natural Conversation     ▼
   ASHA worker speaks naturally in Malayalam/English about the household visit
   (Zero typing, zero navigation through dense MCQ dropdowns)
                                 │
     2. Automated Extraction     ▼
   Swaram transcribes speech (Malayalam ASR) and auto-extracts survey parameters,
   clinical vitals, lifestyle risks, and nutrition observations
                                 │
     3. Proactive Missing Information Inquiry  ◄───────────────────┐
   If mandatory survey fields or clinical details are missing,     │ Continue
   Swaram explicitly asks the worker in natural language           │ conversation
   (e.g., "കുട്ടിക്ക് പാലും മുട്ടയും കൊടുക്കാറുണ്ടോ?", "ബിപി എത്രയാണ്?")   │
                                 │                                 │
   ASHA worker responds naturally by voice ────────────────────────┘
                                 │
     4. Survey Review Screen     ▼
   Swaram lays out the populated survey in a transparent, human-readable
   Review Card for the ASHA worker to inspect, verify, or edit
                                 │
     5. Confirmed Submission     ▼
   Worker provides explicit human confirmation. Swaram commits the record
   locally, queues it in SQLite if offline, updates the Longitudinal Care Ledger,
   and dispatches health department reporting.
```

---

## 🎯 Addressing Overlooked Health Challenges That Hinder Human Growth

Traditional survey applications treat visits as transactional forms. Swaram directly targets the root causes of overlooked health challenges:

1. **First-Class Malnutrition Monitoring (പോഷകാഹാര കുറവ് നിരീക്ഷണം):**
   - Active screening for early childhood wasting and stunting using **Mid-Upper Arm Circumference (MUAC)** and WHO growth criteria.
   - Tracking **Dietary Diversity Scores (0–8)**, monitoring daily consumption of eggs, milk, and pulses to prevent micro-nutrient deficiencies.
   - Monitoring maternal nutritional anemia (hemoglobin tracking and IFA tablet adherence).

2. **Longitudinal Household Health History & Care Ledger (കുടുംബ ആരോഗ്യ ചരിത്രവും കെയർ ലെഡ്ജറും):**
   - Maintains continuous, longitudinal memory for every household across years and visits.
   - Cross-programme Unresolved Care Ledger uniting Maternal ANC, Child Immunisation, Malnutrition, and Non-Communicable Diseases (Hypertension/Diabetes).
   - Generates concise longitudinal narratives so the worker immediately recalls previous observations before stepping into a home.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    ASHA([ASHA Worker in Field]) -->|1. Natural Malayalam Speech| M1[Module 1: Swaram Mobile Field App\nReact Native + Expo]
    
    subgraph Offline_Field_Boundary [Client Device - Offline First]
        M1 -->|Local Storage| DB[(Local SQLite Store\n& Offline Sync Queue)]
    end

    M1 -->|2. Audio Payload| M2[Module 2: Voice & Survey Intelligence\nIndicConformer ASR + Extraction]
    
    subgraph Voice_Pipeline [Voice, Survey & Malnutrition Intelligence]
        M2 --> ASR[Malayalam ASR]
        ASR --> Extractor[Survey & Clinical Extractor]
        Extractor --> Validator[Deterministic Range & Malnutrition Validator]
        Extractor --> MissingQuery[Proactive Missing Field Detector]
        MissingQuery -->|Follow-up Questions| M1
        Validator --> TTS[IndicF5 Malayalam TTS Readback]
        TTS -->|3. Spoken Confirmation| M1
    end

    M1 -->|4. Confirmed Survey Record| M3[Module 3: Backend & Longitudinal Ledger\nFastAPI + SQLite/PostgreSQL/MongoDB]
    
    subgraph Backend_Core [Data Backbone & Longitudinal Memory]
        M3 --> Canonical[(Canonical Household Store)]
        M3 --> SyncQueue[Idempotent Sync Engine]
        M3 --> Ledger[Cross-Programme Care Ledger]
        M3 --> MalnutritionTracker[Malnutrition Longitudinal Tracker]
        M3 --> Narrative[Longitudinal Narrative Engine]
        M3 --> OCR[PaddleOCR Paper Register Ingestion]
    end

    M3 -->|5. CareLedger Context| M4[Module 4: Action, Reporting & Gateway\nPrioritisation & Playwright]
    
    subgraph Execution_Engine [Administrative Execution & Prioritisation]
        M4 --> Priority[Explainable Weighted Ranking\n(Malnutrition + Overdue Surveys)]
        M4 --> ActionGen[Action Task Generator]
        M4 --> Playwright[Playwright Browser Automation]
        Playwright -->|Pre-Submit Confirmation Gate| Portal[Health Department Central Reporting Gateway\nMock at :8080]
    end
```

---

## 👥 Modular Team Work Division

The codebase is organized into four decoupled folders bounded by typed contracts:

| Folder | Domain | Tech Stack | Primary Deliverables |
|---|---|---|---|
| **[`module1-mobile/`](./module1-mobile/)** | Swaram Client App Experience | React Native, Expo, TypeScript, Zustand, `expo-sqlite` | Conversational survey interface, missing-field dialogue cards, survey review cards, malnutrition indicators, offline SQLite queue. |
| **[`module2-voice-intelligence/`](./module2-voice-intelligence/)** | Voice, Survey & Health Intelligence | Python 3.10+, FastAPI, Pydantic, IndicConformer, IndicF5 | Malayalam speech recognition, survey entity extraction, malnutrition validation, proactive missing-field decision engine. |
| **[`module3-backend-ocr-ledger/`](./module3-backend-ocr-ledger/)** | Longitudinal Data & Care Ledger | Python 3.10+, FastAPI, SQLAlchemy, PaddleOCR | Canonical health records, longitudinal household history, malnutrition tracking, offline sync (`/sync/push`), narrative generator. |
| **[`module4-reporting-priorities/`](./module4-reporting-priorities/)** | Action, Reporting & Prioritisation | Python 3.10+, Playwright, Jinja2, FastAPI | Explainable priority engine (0-100) weighting malnutrition and overdue care, action item generator, central reporting gateway automation. |

---

## 📋 Core Frozen Contracts (`contracts/`)

All modules communicate exclusively through typed, frozen schemas located in [`contracts/`](./contracts/):
- **`VisitDraft`** ([`visit.schema.json`](./contracts/visit.schema.json)): Output of Malayalam ASR + extraction pipeline with survey fields and missing prompts.
- **`ConfirmedVisit`** ([`visit.schema.json`](./contracts/visit.schema.json)): Human-confirmed clinical and survey encounter payload with malnutrition assessment.
- **`CareGap`** ([`care_gap.schema.json`](./contracts/care_gap.schema.json)): Standard representation of open health needs across Maternal, Child, Malnutrition, and NCD programmes.
- **`HouseholdCareLedger`** ([`care_ledger.schema.json`](./contracts/care_ledger.schema.json)): Household-level persistent memory tracking open gaps, malnutrition trends, and longitudinal narrative.
- **`PreparedForm`** ([`reporting.schema.json`](./contracts/reporting.schema.json)): Mapped fields ready for central health department gateway filing.

---

## ⚡ Quick Start: Running the Platform

### Prerequisites
- **Node.js**: v18+ (v22 installed)
- **Python**: 3.10+ (3.12 installed)

---

### 1. Launch Module 1 (Swaram Mobile Application)
```bash
cd module1-mobile
npm install
npm run web
```
> **Offline-Safe by Design:** The mobile app boots immediately. Its API client (`src/api/apiClient.ts`) tests the live backend connection via **"Ping"**. If offline, it seamlessly falls back to local contracts in `src/data/mockData.ts`.

---

### 2. Launch Module 2 (Voice & Survey Intelligence)
```bash
cd module2-voice-intelligence
python -m venv .venv
# On Windows: .venv\Scripts\activate
# On Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
python main.py
```
> Service runs on **`http://localhost:8001`**. Exposes `/api/v1/voice/process-survey` and `/api/v1/voice/resolve-missing-field`.

---

### 3. Launch Module 3 (Backend & Longitudinal Care Ledger)
```bash
cd module3-backend-ocr-ledger
python -m venv .venv
# On Windows: .venv\Scripts\activate
# On Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
cd app
python main.py
```
> Server runs on **`http://localhost:8000`**. Interactive Swagger API docs: **`http://localhost:8000/docs`**.

---

### 4. Launch Module 4 (Central Gateway & Playwright Automation)
```bash
cd module4-reporting-priorities
python -m venv .venv
# On Windows: .venv\Scripts\activate
# On Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium

# Terminal A: Start Central Reporting Gateway
python portal_mock/mock_server.py # Runs on http://localhost:8080

# Terminal B: Start Priority & Automation Service
python main.py                   # Runs on http://localhost:8002
```

---

## 🎬 Recommended Demo Scenario: "Lakshmi Household"

To experience the complete conversational survey loop:
1. **Open Swaram Mobile App:** Inspect **Lakshmi Amma's Household (Ward 4, Aluva)**. Note the Priority Score (88.5) and malnutrition monitoring flag.
2. **Start Conversational Survey:** Tap **"സംസാരിക്കുക (Simulate Voice Survey)"**.
3. **Malayalam Natural Speech:** Observe the pipeline transcribe:
   > *"ലക്ഷ്മിയെ കണ്ടു. ബിപി 130/85 ഉണ്ട്. ഭാരം 58 കിലോ. അയൺ ഗുളിക കൊടുത്തു. അടുത്ത ചെക്കപ്പ് അടുത്ത വ്യാഴാഴ്ച."*
4. **Proactive Missing Field Query:** Swaram notes that child nutrition was unmentioned and prompts:
   > *"❓ കുട്ടിക്ക് ദിവസവും പാലും മുട്ടയും അല്ലെങ്കിൽ പയറുവർഗ്ഗങ്ങളും നൽകാറുണ്ടോ?"*
5. **Conversational Answer:** Tap **"🎙️ മറുപടി പറയുക"**. Swaram records: *"കുട്ടിക്ക് ദിവസവും പാലും മുട്ടയും കൊടുക്കാറുണ്ട്"*, populating the dietary diversity score in real-time.
6. **Survey Review Card:** Review the populated fields across Demographics, Vitals, Malnutrition Screening, and Maternal Care.
7. **Human Confirmation:** Tap **"✓ വിവരങ്ങൾ സ്ഥിരീകരിച്ച് സമർപ്പിക്കുക (Confirm & Submit)"**. The survey is committed and queued.
8. **Gateway Automation:** Module 4 maps the confirmed survey to the Central Reporting Gateway (`http://localhost:8080`) using Playwright with accessible locators.

---

## 🛡️ Ethical Safety & Privacy Guidelines
- **No Unassisted Clinical Diagnoses:** Swaram flags malnutrition risks and overdue observations. It **never** presents an AI inference as a clinical diagnosis.
- **Human Confirmation Gate:** Zero automated submissions without the ASHA worker's explicit review and approval.
- **Synthetic Data for Demos:** All demo personas (Lakshmi Amma, Suresh Kumar) are synthetic test records.
