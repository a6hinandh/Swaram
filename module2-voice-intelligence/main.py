"""
Module 2: Voice, Screening & Health Intelligence Service
Exposes REST endpoints for Malayalam ASR, structured clinical extraction, and TTS read-back.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any

from asr.adapter import asr_service
from tts.adapter import tts_service
from extraction.extractor import extractor_service
from conversational_closure.gap_closer import CareGapConversationalCloser

app = FastAPI(
    title="Swaram Voice & Intelligence Service (Module 2)",
    version="1.0.0",
    description="Malayalam ASR, Clinical Extraction, Deterministic Validation, and Care-Gap Closure"
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

@app.get("/health")
def health():
    return {"status": "ok", "service": "module2-voice-intelligence", "model_adapters": ["IndicConformer", "IndicF5"]}

@app.post("/api/v1/voice/process")
def process_voice_visit(request: ProcessVoiceRequest):
    """
    Core pipeline: Malayalam Audio -> ASR -> Clinical Extraction -> Range Validation -> VisitDraft
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
