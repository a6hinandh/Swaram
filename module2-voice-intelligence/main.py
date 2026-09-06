"""
Module 2: Swaram Voice, Survey & Health Intelligence Service
Exposes REST endpoints for Malayalam ASR, structured survey/clinical extraction,
proactive missing field resolution, and TTS read-back.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

from asr.adapter import asr_service
from tts.adapter import tts_service
from extraction.gemini_extractor import gemini_extractor_service
from extraction.extractor import extractor_service
from conversational_closure.gap_closer import CareGapConversationalCloser

app = FastAPI(
    title="Swaram Voice, Survey & Health Intelligence (Module 2)",
    version="2.0.0",
    description="Malayalam ASR, Gemini MongoDB Clinical Extraction, Malnutrition Screening, and Care-Gap Closure"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ProcessVoiceRequest(BaseModel):
    audio_uri: Optional[str] = None
    transcript: Optional[str] = None
    language: str = "ml"
    household_id: Optional[str] = None
    person_id: Optional[str] = None

class GapQuestionRequest(BaseModel):
    care_gap: Dict[str, Any]
    known_context: Dict[str, Any]

class ResolveFieldRequest(BaseModel):
    draft: Dict[str, Any]
    question_id: str
    answer_text: str

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "module2-voice-intelligence",
        "platform": "Swaram Next-Gen ASHA Platform",
        "model_adapters": ["SarvamAI-Saaras-v4", "Gemini", "IndicConformer", "IndicF5"],
        "schema_standard": "mongodb_clinical_encounters_v1",
        "capabilities": [
            "Malayalam Voice Survey Extraction",
            "Gemini Canonical MongoDB Clinical Encounter Parsing",
            "Longitudinal Vitals Baseline & Spurt Analysis",
            "WHO Z-Score Malnutrition Screening",
            "Proactive Missing Field Follow-up"
        ]
    }

@app.post("/api/v1/voice/process")
@app.post("/api/v1/voice/process-survey")
def process_voice_visit(request: ProcessVoiceRequest):
    """
    Core pipeline: Malayalam Audio -> ASR -> Gemini Structured Clinical Extraction -> MongoDB Encounter Document
    """
    print(f"\n=======================================================")
    print(f"[VOICE] [Module 2 API] Incoming Voice Process Request:")
    print(f"   • Transcript provided: {bool(request.transcript)} ('{request.transcript}')")
    print(f"   • Audio URI provided: {bool(request.audio_uri)}")
    print(f"   • Household ID: {request.household_id}, Person ID: {request.person_id}")

    # 1. ASR Step
    if request.transcript:
        transcript = request.transcript
        confidence = 0.98
    else:
        transcript, confidence = asr_service.transcribe(request.audio_uri)

    print(f"[TRANSCRIPT] [Module 2 API] Active Transcript for Extraction: '{transcript}'")

    # 2. Gemini Clinical Encounter Extraction (Matching MongoDB Production Schema)
    encounter = gemini_extractor_service.extract_clinical_encounter(
        transcript=transcript,
        household_id=request.household_id,
        person_id=request.person_id
    )
    encounter["confidence"] = confidence

    # 3. Attach Missing Field Follow-up Prompts
    measurements = encounter.get("measurements", {})
    malnutrition = encounter.get("malnutrition", {})
    missing_prompts = CareGapConversationalCloser.get_missing_survey_prompts(
        extracted_vitals={
            "systolic_bp": measurements.get("blood_pressure_sys"),
            "diastolic_bp": measurements.get("blood_pressure_dia"),
            "weight_kg": measurements.get("weight_kg")
        },
        extracted_malnutrition=malnutrition
    )
    encounter["missing_field_prompts"] = missing_prompts

    print(f"[OK] [Module 2 API] Returning Extracted Encounter Document with Person: {encounter.get('person')}")
    print(f"=======================================================\n")
    return encounter

@app.post("/api/v1/voice/resolve-missing-field")
def resolve_missing_field(req: ResolveFieldRequest):
    """
    Proactive Conversational Inquiry:
    Applies the worker's natural language spoken answer to a missing survey field,
    updates the draft data in real-time, and clears the prompt.
    """
    updated = CareGapConversationalCloser.apply_conversational_answer(
        req.draft, req.question_id, req.answer_text
    )
    return updated

@app.post("/api/v1/voice/tts")
def synthesize_tts(payload: Dict[str, Any]):
    """
    Converts extracted record into Malayalam TTS audio preview.
    """
    audio_ref = tts_service.synthesize_readback(payload)
    return {"audio_ref": audio_ref, "status": "synthesized"}

@app.post("/api/v1/voice/close-gap")
def get_gap_closing_question(req: GapQuestionRequest):
    """
    Retrieves the next minimal question required to close an unresolved care gap.
    """
    question = CareGapConversationalCloser.get_next_question(req.care_gap, req.known_context)
    return {"question": question, "gap_id": req.care_gap.get("id")}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
