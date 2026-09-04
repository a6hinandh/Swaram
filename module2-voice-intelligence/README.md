# Module 2: Voice, Screening & Health Intelligence

**Assigned Teammate:** Member 2 (AI, Speech & Clinical Intelligence Engineer)  
**Tech Stack:** Python 3.10+, FastAPI, Pydantic, AI4Bharat IndicConformer, IndicF5 TTS, LLM/Regex extraction

---

## 🎯 Purpose & Responsibilities
This module converts an ASHA worker's spoken Malayalam visit into a structured, validated candidate record:
1. **Malayalam ASR (`asr/`):** Audio capture -> Malayalam transcript + confidence scores (using IndicConformer adapter with mock simulation).
2. **Clinical Extraction (`extraction/`):** Fixed JSON schema extraction for vitals, symptoms, medications, and follow-up dates.
3. **Deterministic Validation (`extraction/validator.py`):** Physiological range checks (BP, weight, temp, Hb) and uncertainty detection. Never invents diagnoses.
4. **Malayalam TTS Read-Back (`tts/`):** Synthesizes read-back audio for worker verbal confirmation.
5. **Conversational Care-Gap Closure (`conversational_closure/`):** Decision-tree questions to close care gaps with minimum disruption.

---

## 🚀 Quick Start for Member 2

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

### Test Voice Processing Endpoint:
```bash
curl -X POST http://localhost:8001/api/v1/voice/process \
  -H "Content-Type: application/json" \
  -d '{"transcript": "ലക്ഷ്മിയെ കണ്ടു. ബിപി 130/85. ഭാരം 58 കിലോ. അയൺ ഗുളിക കൊടുത്തു."}'
```
Expected output: Returns a valid `VisitDraft` matching [`contracts/visit.schema.json`](../contracts/visit.schema.json).

---

## 📂 Directory Layout
```
module2-voice-intelligence/
├── main.py                  # FastAPI service running on port 8001
├── requirements.txt
├── asr/
│   └── adapter.py           # IndicConformer Malayalam speech-to-text adapter
├── tts/
│   └── adapter.py           # IndicF5 Malayalam text-to-speech adapter
├── extraction/
│   ├── extractor.py         # Clinical entity parser
│   └── validator.py         # Range validation (BP, weight, hemoglobin)
├── conversational_closure/
│   └── gap_closer.py        # Question graph for unresolved care gaps
└── README.md
```

---

## 🤝 Frozen Contracts Used
- Outputs: `VisitDraft` (consumed by Module 1)
- Contract: [`contracts/visit.schema.json`](../contracts/visit.schema.json)
