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
from extraction.extractor import extractor_service
from conversational_closure.gap_closer import CareGapConversationalCloser

app = FastAPI(
    title="Swaram Voice, Survey & Health Intelligence (Module 2)",
    version="2.0.0",
    description="Malayalam ASR, Conversational Survey Extraction, Malnutrition Screening, and Care-Gap Closure"
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
        "model_adapters": ["SarvamAI-Saaras-v4", "IndicConformer", "IndicF5"],
        "capabilities": [
            "Malayalam Voice Survey Extraction",
            "Malnutrition Screening",
            "Proactive Missing Field Follow-up"
        ]
    }

@app.post("/api/v1/voice/process")
@app.post("/api/v1/voice/process-survey")
def process_voice_visit(request: ProcessVoiceRequest):
    """
    Core pipeline: Malayalam Audio -> ASR -> Clinical & Survey Extraction -> Malnutrition Checks -> VisitDraft
    """
    # 1. ASR Step
    if request.transcript:
        transcript = request.transcript
        confidence = 0.95
    else:
        transcript, confidence = asr_service.transcribe(request.audio_uri)

    # 2. Extraction & Deterministic Validation Step
    draft = extractor_service.extract_from_transcript(transcript, household_id=request.household_id)
    draft["confidence"] = confidence

    return draft

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
