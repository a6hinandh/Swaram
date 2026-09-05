# Module 2: Voice, Survey & Health Intelligence
### Swaram Next-Generation ASHA Platform Voice Backbone

**Assigned Teammate:** Member 2 (AI, Speech & Clinical Intelligence Engineer)  
**Tech Stack:** Python 3.10+, FastAPI, Pydantic, AI4Bharat IndicConformer, IndicF5 TTS, Constrained Extraction

---

## 🎯 Purpose & Responsibilities
This module converts an ASHA worker's spoken Malayalam visit into a structured, validated survey and clinical encounter record:
1. **Malayalam ASR (`asr/`):** Natural speech capture -> Malayalam transcript + confidence scores (using IndicConformer adapter with mock fallback).
2. **Conversational Survey Extraction (`extraction/`):** Auto-extracts survey parameters, clinical vitals, NCD screening, and child malnutrition indicators from natural speech.
3. **Malnutrition & Clinical Validation (`extraction/validator.py`):**
   - Checks physiological ranges for blood pressure, weight, and hemoglobin.
   - Evaluates child malnutrition indicators according to WHO/IAP criteria: MUAC (<11.5 cm SAM, <12.5 cm MAM), dietary diversity score, and edema signs.
4. **Proactive Missing Field Resolution (`conversational_closure/`):**
   - Automatically detects missing mandatory survey fields.
   - Generates targeted conversational follow-up questions in Malayalam and English.
   - Applies conversational responses to fill remaining survey fields seamlessly.
5. **Malayalam TTS Read-Back (`tts/`):** Synthesizes spoken read-back of extracted records for worker verbal review.

---

## 🚀 Quick Start

```bash
cd module2-voice-intelligence
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
python main.py
```
The service will start on **`http://localhost:8001`**.

---

## 🧪 Testing the Pipeline Independently

### 1. Process Voice Survey:
```bash
curl -X POST http://localhost:8001/api/v1/voice/process-survey \
  -H "Content-Type: application/json" \
  -d '{"transcript": "ലക്ഷ്മിയെ കണ്ടു. ബിപി 130/85. ഭാരം 58 കിലോ. അയൺ ഗുളിക കൊടുത്തു."}'
```
Returns a `VisitDraft` with extracted survey fields, malnutrition assessment, and missing field prompts.

### 2. Answer Missing Field Conversationally:
```bash
curl -X POST http://localhost:8001/api/v1/voice/resolve-missing-field \
  -H "Content-Type: application/json" \
  -d '{"draft": {...}, "question_id": "q_nut_dietary", "answer_text": "കുട്ടി ദിവസവും പാലും മുട്ടയും കഴിക്കാറുണ്ട്"}'
```
Directly populates the child's dietary diversity score and clears the missing prompt.
