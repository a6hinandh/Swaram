"""
Gemini Multilingual Clinical Extraction Engine (Module 2 -> MongoDB Atlas)
Converts noisy Malayalam / Manglish transcripts into typed, canonical MongoDB Clinical Encounter documents
matching the exact finalized Swaram clinical encounter schema.
"""

import os
import re
import json
import uuid
import logging
from datetime import datetime
from typing import Dict, Any, Optional
import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("gemini_extractor")

SYSTEM_CLINICAL_PROMPT = """You are an expert clinical data extraction AI for Indian public healthcare (ASHA workers in Kerala).
The user provides a spoken Malayalam, Manglish (Malayalam written in English), or English transcript from a home visit.

Extract the clinical information into this EXACT JSON structure matching the Swaram master clinical schema:

{
  "visit": {
    "visit_id": string,
    "household_id": string,
    "date": "YYYY-MM-DD",
    "visit_type": "routine" | "follow_up" | "referral",
    "source": "voice" | "manual" | "mixed"
  },
  "person": {
    "person_id": string,
    "name": string,
    "age": number or null,
    "sex": "male" | "female" | "other" | "unknown",
    "relationship_to_head": string or null,
    "life_stage": "infant" | "child" | "adolescent" | "adult" | "elderly" | null,
    "pregnancy_status": "pregnant" | "postpartum" | "not_pregnant" | "unknown"
  },
  "observations": {
    "symptoms": [
      {
        "symptom": string (e.g. "headache", "fatigue", "fever"),
        "duration": string or null (e.g. "2 days", "3 weeks"),
        "severity": "mild" | "moderate" | "severe" | "unknown",
        "trend": "improving" | "worsening" | "unchanged" | "unknown"
      }
    ],
    "known_conditions": [
      {
        "condition": string (e.g. "Hypertension", "Diabetes"),
        "status": "active" | "resolved" | "unknown"
      }
    ],
    "medications": [
      {
        "name": string (e.g. "Amlodipine 5mg", "Metformin 500mg"),
        "taking": "yes" | "no" | "unknown",
        "adherence": "regular" | "irregular" | "stopped" | "unknown",
        "available": "yes" | "no" | "unknown"
      }
    ],
    "measurements": {
      "weight_kg": number or null,
      "height_cm": number or null,
      "blood_pressure": {
        "systolic_mmhg": number or null,
        "diastolic_mmhg": number or null
      },
      "blood_glucose": {
        "value": number or null,
        "unit": "mg/dL" | "mmol/L" | "unknown",
        "measurement_type": "fasting" | "postprandial" | "random" | "unknown"
      },
      "temperature_c": number or null,
      "pulse_bpm": number or null,
      "spo2_percent": number or null,
      "muac_cm": number or null
    },
    "preventive_care": {
      "immunization": {
        "status": "up_to_date" | "overdue" | "partially_complete" | "unknown",
        "last_received": string or null,
        "next_due": string or null
      },
      "screenings": [
        {
          "type": string,
          "status": "completed" | "due" | "overdue" | "unknown",
          "last_done": string or null,
          "result": "normal" | "abnormal" | "unknown"
        }
      ],
      "maternal_care": {
        "antenatal_visits": number or null,
        "supplements": "taking" | "not_taking" | "unknown",
        "required_followup": "yes" | "no" | "unknown"
      }
    },
    "nutrition": {
      "appetite": "normal" | "reduced" | "poor" | "unknown",
      "feeding_concern": "yes" | "no" | "unknown",
      "food_access_problem": "yes" | "no" | "unknown",
      "nutrition_observation": string or null
    },
    "mental_social": {
      "mental_health_concern": "yes" | "no" | "unknown",
      "screening_status": "not_done" | "completed" | "needs_followup",
      "social_concern": string or null,
      "barriers_to_care": []
    },
    "care_history": {
      "recent_doctor_visit": "yes" | "no" | "unknown",
      "recent_hospital_visit": "yes" | "no" | "unknown",
      "referral_given": "yes" | "no" | "unknown",
      "referral_completed": "yes" | "no" | "unknown",
      "previous_followup_pending": "yes" | "no" | "unknown"
    },
    "additional_observations": string or null
  },
  "follow_up_information": {
    "required": "yes" | "no" | "unknown",
    "reason": string or null,
    "action": string or null,
    "due_date": string or null
  },
  "ai_assessment": {
    "risk_flags": [
      {
        "risk_type": string,
        "description": string,
        "severity": "low" | "medium" | "high",
        "evidence": [string]
      }
    ],
    "care_gaps": [
      {
        "gap_type": "immunization" | "nutrition" | "maternal" | "screening" | "medication" | "referral" | "mental_health" | "vitals" | "other",
        "description": string,
        "evidence": [string],
        "severity": "low" | "medium" | "high",
        "status": "suspected" | "confirmed" | "resolved",
        "required_questions": [string],
        "recommended_action": string,
        "due_date": string or null
      }
    ],
    "priority": {
      "level": "low" | "medium" | "high" | "urgent",
      "score": number or null,
      "reasons": [string]
    }
  },
  "extraction": {
    "overall_confidence": "high" | "medium" | "low",
    "fields_needing_confirmation": [string],
    "uncertain_statements": [string]
  }
}

CLINICAL EXTRACTION RULES:
1. Blood Pressure: Parse expressions like "148 92", "148/92", "ബിപി 140 90", "BP 130 over 85" into observations.measurements.blood_pressure.systolic_mmhg and diastolic_mmhg.
2. Blood Glucose: Parse "ഷുഗർ 185", "sugar 185", "random glucose 160", "RBS 185" -> observations.measurements.blood_glucose.value: 185.0.
3. Weight: Parse "56.8 കിലോ", "weight 58 kg", "തൂക്കം 10.2 kg" -> observations.measurements.weight_kg: 56.8.
4. Medications: Parse drug names and adherence ("അമ്ലോഡിപിൻ കൃത്യമായി കഴിക്കുന്നില്ല" -> adherence: "irregular", taking: "yes").
5. Return ONLY valid JSON matching this schema. No markdown ticks or explanation.
"""

class GeminiClinicalExtractor:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("EXPO_PUBLIC_GEMINI_API_KEY")
        self.models = ["gemini-2.5-flash", "gemini-2.5-pro"]

    def extract_clinical_encounter(
        self,
        transcript: str,
        household_id: Optional[str] = None,
        person_id: Optional[str] = None,
        visit_type: str = "routine",
        source: str = "voice"
    ) -> Dict[str, Any]:
        """
        Executes Gemini extraction and maps output to canonical MongoDB Clinical Encounter schema.
        Falls back gracefully to local deterministic heuristics if Gemini is offline or unkeyed.
        """
        print(f"\n==================== [Module 2] Clinical Extraction Started ====================")
        print(f"📥 [Module 2] Received Input Transcript: {transcript}")

        visit_id = f"v-{uuid.uuid4()}"
        household_id = household_id or f"h-{str(uuid.uuid4())[:8]}"
        person_id = person_id or f"p-{str(uuid.uuid4())[:8]}"
        date_str = datetime.utcnow().strftime("%Y-%m-%d")

        extracted_data = None
        confidence_level = "high"

        # Try Gemini API if key is available
        if self.api_key and not self.api_key.startswith("mock") and len(self.api_key) > 10:
            extracted_data, confidence_level = self._call_gemini(transcript)

        # Fallback to local rule extractor if Gemini was not used or failed
        if not extracted_data:
            print("⚠️ [Module 2] Gemini unavailable or failed. Using Local Fallback Extractor.")
            extracted_data = self._build_local_fallback(transcript, person_id)
            confidence_level = "medium"

        # Assemble full master document
        person_info = extracted_data.get("person", {})
        observations = extracted_data.get("observations", {})
        follow_up = extracted_data.get("follow_up_information")
        ai_assessment = extracted_data.get("ai_assessment")
        extraction_meta = extracted_data.get("extraction", {
            "overall_confidence": confidence_level,
            "fields_needing_confirmation": [],
            "uncertain_statements": []
        })

        # Calculate high BP risk flag / care gap if applicable
        sys_bp = None
        if isinstance(observations, dict):
            measurements = observations.get("measurements")
            if isinstance(measurements, dict):
                bp = measurements.get("blood_pressure")
                if isinstance(bp, dict):
                    sys_bp = bp.get("systolic_mmhg")

        if sys_bp and sys_bp >= 140:
            if not ai_assessment:
                ai_assessment = {
                    "risk_flags": [],
                    "care_gaps": [],
                    "priority": {"level": "low", "score": None, "reasons": []}
                }
            ai_assessment.setdefault("risk_flags", []).append({
                "risk_type": "hypertension_spurt",
                "description": f"Elevated systolic blood pressure: {sys_bp} mmHg",
                "severity": "high" if sys_bp >= 160 else "medium",
                "evidence": [f"Measured BP systolic: {sys_bp} mmHg from transcript"]
            })
            ai_assessment.setdefault("priority", {})["level"] = "high" if sys_bp >= 160 else "medium"
            ai_assessment.setdefault("priority", {}).setdefault("reasons", []).append(f"Elevated blood pressure: {sys_bp} mmHg")

        canonical_encounter: Dict[str, Any] = {
            "visit": {
                "visit_id": visit_id,
                "household_id": household_id,
                "date": date_str,
                "visit_type": visit_type,
                "source": source
            },
            "person": {
                "person_id": person_id,
                "name": person_info.get("name") if person_info.get("name") else None,
                "age": person_info.get("age"),
                "sex": person_info.get("sex"),
                "relationship_to_head": person_info.get("relationship_to_head"),
                "life_stage": person_info.get("life_stage"),
                "pregnancy_status": person_info.get("pregnancy_status")
            }
        }

        if observations:
            canonical_encounter["observations"] = observations
        if follow_up:
            canonical_encounter["follow_up_information"] = follow_up
        if ai_assessment:
            canonical_encounter["ai_assessment"] = ai_assessment
        if extraction_meta:
            canonical_encounter["extraction"] = extraction_meta

        print(f"📤 [Module 2] Final Assembled Canonical Encounter:\n{json.dumps(canonical_encounter, indent=2, ensure_ascii=False)}")
        print(f"=================================================================================\n")

        return canonical_encounter

    def _call_gemini(self, transcript: str) -> tuple[Optional[Dict[str, Any]], str]:
        """Calls Gemini API with structured JSON output mode."""
        prompt_text = f"{SYSTEM_CLINICAL_PROMPT}\n\nTRANSCRIPT TO EXTRACT:\n{transcript}"
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": prompt_text}
                    ]
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.1
            }
        }

        print(f"🤖 [Gemini API] Sending request to Gemini models: {self.models}")

        for model in self.models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.api_key}"
            try:
                print(f"🔄 [Gemini API] Calling model: {model}...")
                resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=12)
                print(f"📡 [Gemini API] Model {model} Response Status: HTTP {resp.status_code}")
                if resp.status_code == 200:
                    data = resp.json()
                    raw_text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                    print(f"📥 [Gemini API] Raw Response Text from {model}:\n{raw_text}")
                    if raw_text:
                        clean_json = raw_text.strip()
                        if clean_json.startswith("```"):
                            clean_json = re.sub(r"^```(?:json)?\s*", "", clean_json, flags=re.I)
                            clean_json = re.sub(r"\s*```$", "", clean_json)
                        parsed = json.loads(clean_json)
                        print(f"✅ [Gemini API] Successfully parsed JSON structure from {model}: Person Name = '{parsed.get('person', {}).get('name')}'")
                        return parsed, "high"
                else:
                    print(f"❌ [Gemini API] {model} returned HTTP {resp.status_code}: {resp.text[:200]}")
            except Exception as e:
                print(f"❌ [Gemini API] {model} call failed with exception: {e}")

        return None, "low"

    def _build_local_fallback(self, transcript: str, person_id: str) -> Dict[str, Any]:
        """Local regex rule-based fallback when Gemini API is offline."""
        from extraction.extractor import MalayalamClinicalExtractor
        local_ext = MalayalamClinicalExtractor()
        local_raw = local_ext.extract_from_transcript(transcript)
        p_up = local_raw.get("person_updates", [{}])[0]
        vitals = p_up.get("vitals", {})

        measurements: Dict[str, Any] = {}
        if vitals.get("weight_kg") is not None:
            measurements["weight_kg"] = vitals.get("weight_kg")
        if vitals.get("height_cm") is not None:
            measurements["height_cm"] = vitals.get("height_cm")
        if vitals.get("systolic_bp") is not None or vitals.get("diastolic_bp") is not None:
            measurements["blood_pressure"] = {
                "systolic_mmhg": vitals.get("systolic_bp"),
                "diastolic_mmhg": vitals.get("diastolic_bp")
            }
        if vitals.get("blood_sugar_mg_dl") is not None:
            measurements["blood_glucose"] = {
                "value": vitals.get("blood_sugar_mg_dl"),
                "unit": "mg/dL",
                "measurement_type": "random"
            }
        if vitals.get("pulse_bpm") is not None:
            measurements["pulse_bpm"] = vitals.get("pulse_bpm")
        if vitals.get("spo2_percent") is not None:
            measurements["spo2_percent"] = vitals.get("spo2_percent")
        if p_up.get("malnutrition", {}).get("muac_cm") is not None:
            measurements["muac_cm"] = p_up.get("malnutrition", {}).get("muac_cm")

        observations: Dict[str, Any] = {}
        if p_up.get("symptoms"):
            observations["symptoms"] = [{"symptom": s} for s in p_up.get("symptoms", [])]
        if p_up.get("medications_given"):
            observations["medications"] = [{"name": m, "taking": "yes"} for m in p_up.get("medications_given", [])]
        if measurements:
            observations["measurements"] = measurements

        return {
            "person": {
                "name": p_up.get("name") or None,
                "age": p_up.get("age"),
                "sex": p_up.get("gender").lower() if p_up.get("gender") else None,
                "relationship_to_head": None,
                "life_stage": None,
                "pregnancy_status": "pregnant" if p_up.get("pregnancy_weeks") else None
            },
            "observations": observations,
            "extraction": {
                "overall_confidence": "medium",
                "fields_needing_confirmation": [],
                "uncertain_statements": []
            }
        }

gemini_extractor_service = GeminiClinicalExtractor()


