"""
Malayalam TTS Adapter (IndicF5 / Compatible Speech Synthesis)
Synthesizes clinical summaries back into natural Malayalam audio for worker confirmation.
"""

import os
from typing import Dict, Any

class MalayalamTTSAdapter:
    def __init__(self, endpoint: str = None):
        self.endpoint = endpoint or os.getenv("INDIC_F5_TTS_ENDPOINT", "mock")

    def synthesize_readback(self, extracted_summary: Dict[str, Any]) -> str:
        """
        Converts extracted structured record into a natural Malayalam readback audio ref.
        E.g.: 'ലക്ഷ്മി, രക്തസമ്മർദ്ദം 130 85, ഭാരം 58 കിലോഗ്രാം, അയൺ ഗുളിക നൽകി. ശരിയാണോ?'
        Returns:
            audio_url_or_filepath: str
        """
        # Formulate readable text
        person = extracted_summary.get("name", "ഗുണഭോക്താവ്")
        vitals = extracted_summary.get("vitals", {})
        bp_text = f"രക്തസമ്മർദ്ദം {vitals.get('systolic_bp', '')} {vitals.get('diastolic_bp', '')}" if vitals.get("systolic_bp") else ""
        
        spoken_text = f"{person}. {bp_text}. സ്ഥിരീകരിക്കുക."
        # In prototype/mock mode, return a reference URI
        return f"/audio/tts_readback_{hash(spoken_text) % 10000}.wav"

tts_service = MalayalamTTSAdapter()
