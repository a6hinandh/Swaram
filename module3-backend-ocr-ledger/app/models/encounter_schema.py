from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Any

# 1. Visit Metadata
class VisitMeta(BaseModel):
    visit_id: str
    household_id: str
    date: str  # YYYY-MM-DD
    visit_type: Optional[Literal["routine", "follow_up", "referral"]] = None
    source: Optional[Literal["voice", "manual", "mixed"]] = None

# 2. Person Information
class PersonInfo(BaseModel):
    person_id: str
    name: Optional[str] = None
    age: Optional[float] = None
    sex: Optional[Literal["male", "female", "other", "unknown"]] = None
    relationship_to_head: Optional[str] = None
    life_stage: Optional[Literal["infant", "child", "adolescent", "adult", "elderly"]] = None
    pregnancy_status: Optional[Literal["pregnant", "postpartum", "not_pregnant", "unknown"]] = None

# 3. Observations Sub-documents
class SymptomObservation(BaseModel):
    symptom: str
    duration: Optional[str] = None
    severity: Optional[Literal["mild", "moderate", "severe", "unknown"]] = None
    trend: Optional[Literal["improving", "worsening", "unchanged", "unknown"]] = None

class KnownCondition(BaseModel):
    condition: str
    status: Optional[Literal["active", "resolved", "unknown"]] = None

class MedicationObservation(BaseModel):
    name: str
    taking: Optional[Literal["yes", "no", "unknown"]] = None
    adherence: Optional[Literal["regular", "irregular", "stopped", "unknown"]] = None
    available: Optional[Literal["yes", "no", "unknown"]] = None

class BloodPressure(BaseModel):
    systolic_mmhg: Optional[float] = None
    diastolic_mmhg: Optional[float] = None

class BloodGlucose(BaseModel):
    value: Optional[float] = None
    unit: Optional[Literal["mg/dL", "mmol/L", "unknown"]] = None
    measurement_type: Optional[Literal["fasting", "postprandial", "random", "unknown"]] = None

class MeasurementsObservation(BaseModel):
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    blood_pressure: Optional[BloodPressure] = None
    blood_glucose: Optional[BloodGlucose] = None
    temperature_c: Optional[float] = None
    pulse_bpm: Optional[float] = None
    spo2_percent: Optional[float] = None
    muac_cm: Optional[float] = None

class ImmunizationObservation(BaseModel):
    status: Optional[Literal["up_to_date", "overdue", "partially_complete", "unknown"]] = None
    last_received: Optional[str] = None
    next_due: Optional[str] = None

class ScreeningItem(BaseModel):
    type: str
    status: Optional[Literal["completed", "due", "overdue", "unknown"]] = None
    last_done: Optional[str] = None
    result: Optional[Literal["normal", "abnormal", "unknown"]] = None

class MaternalCareObservation(BaseModel):
    antenatal_visits: Optional[int] = None
    supplements: Optional[Literal["taking", "not_taking", "unknown"]] = None
    required_followup: Optional[Literal["yes", "no", "unknown"]] = None

class PreventiveCareObservation(BaseModel):
    immunization: Optional[ImmunizationObservation] = None
    screenings: Optional[List[ScreeningItem]] = None
    maternal_care: Optional[MaternalCareObservation] = None

class NutritionObservation(BaseModel):
    appetite: Optional[Literal["normal", "reduced", "poor", "unknown"]] = None
    feeding_concern: Optional[Literal["yes", "no", "unknown"]] = None
    food_access_problem: Optional[Literal["yes", "no", "unknown"]] = None
    nutrition_observation: Optional[str] = None

class MentalSocialObservation(BaseModel):
    mental_health_concern: Optional[Literal["yes", "no", "unknown"]] = None
    screening_status: Optional[Literal["not_done", "completed", "needs_followup"]] = None
    social_concern: Optional[str] = None
    barriers_to_care: Optional[List[Literal["cost", "transport", "availability", "awareness", "family_support", "fear", "time", "accessibility", "other"]]] = None

class CareHistoryObservation(BaseModel):
    recent_doctor_visit: Optional[Literal["yes", "no", "unknown"]] = None
    recent_hospital_visit: Optional[Literal["yes", "no", "unknown"]] = None
    referral_given: Optional[Literal["yes", "no", "unknown"]] = None
    referral_completed: Optional[Literal["yes", "no", "unknown"]] = None
    previous_followup_pending: Optional[Literal["yes", "no", "unknown"]] = None

class Observations(BaseModel):
    symptoms: Optional[List[SymptomObservation]] = None
    known_conditions: Optional[List[KnownCondition]] = None
    medications: Optional[List[MedicationObservation]] = None
    measurements: Optional[MeasurementsObservation] = None
    preventive_care: Optional[PreventiveCareObservation] = None
    nutrition: Optional[NutritionObservation] = None
    mental_social: Optional[MentalSocialObservation] = None
    care_history: Optional[CareHistoryObservation] = None
    additional_observations: Optional[str] = None

# 4. Follow Up Information
class FollowUpInformation(BaseModel):
    required: Optional[Literal["yes", "no", "unknown"]] = None
    reason: Optional[str] = None
    action: Optional[str] = None
    due_date: Optional[str] = None

# 5. AI Assessment Sub-documents
class RiskFlag(BaseModel):
    risk_type: str
    description: str
    severity: Literal["low", "medium", "high"]
    evidence: List[str] = Field(default_factory=list)

class CareGapItem(BaseModel):
    gap_type: Literal["immunization", "nutrition", "maternal", "screening", "medication", "referral", "mental_health", "vitals", "other"]
    description: str
    evidence: List[str] = Field(default_factory=list)
    severity: Literal["low", "medium", "high"]
    status: Literal["suspected", "confirmed", "resolved"]
    required_questions: List[str] = Field(default_factory=list)
    recommended_action: str
    due_date: Optional[str] = None

class PriorityAssessment(BaseModel):
    level: Optional[Literal["low", "medium", "high", "urgent"]] = None
    score: Optional[float] = None
    reasons: Optional[List[str]] = None

class AiAssessment(BaseModel):
    risk_flags: Optional[List[RiskFlag]] = None
    care_gaps: Optional[List[CareGapItem]] = None
    priority: Optional[PriorityAssessment] = None

# 6. Extraction Metadata
class ExtractionMeta(BaseModel):
    overall_confidence: Optional[Literal["high", "medium", "low"]] = None
    fields_needing_confirmation: Optional[List[str]] = None
    uncertain_statements: Optional[List[str]] = None

# 7. Final Clinical Encounter Master Schema
class ClinicalEncounterSchema(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    visit: VisitMeta
    person: PersonInfo
    observations: Optional[Observations] = None
    follow_up_information: Optional[FollowUpInformation] = None
    ai_assessment: Optional[AiAssessment] = None
    extraction: Optional[ExtractionMeta] = None

    class Config:
        populate_by_name = True
        extra = "allow"

