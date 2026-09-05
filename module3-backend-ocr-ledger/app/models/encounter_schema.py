from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Any

class VisitMeta(BaseModel):
    visit_id: str
    household_id: str
    date: str  # YYYY-MM-DD
    visit_type: Literal["routine", "follow_up", "referral"]

class PersonInfo(BaseModel):
    person_id: str
    name: str
    age: float
    sex: Literal["male", "female", "other", "unknown"]
    relationship: str
    life_stage: Literal["infant", "child", "adolescent", "adult", "elderly"]
    pregnancy_status: Literal["pregnant", "postpartum", "not_pregnant", "unknown"]

class Complaint(BaseModel):
    symptom: str
    duration: str
    severity: Literal["mild", "moderate", "severe", "unknown"]
    trend: Literal["improving", "worsening", "unchanged", "unknown"]

class Condition(BaseModel):
    condition: str
    status: Literal["active", "resolved", "unknown"]

class Medication(BaseModel):
    name: str
    taking: Literal["yes", "no", "unknown"]
    adherence: Literal["regular", "irregular", "stopped", "unknown"]
    available: Literal["yes", "no", "unknown"]

class HealthStatus(BaseModel):
    complaints: List[Complaint] = Field(default_factory=list)
    known_conditions: List[Condition] = Field(default_factory=list)
    medications: List[Medication] = Field(default_factory=list)

class Measurements(BaseModel):
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    blood_pressure: Optional[str] = None
    temperature_c: Optional[float] = None
    pulse_bpm: Optional[float] = None
    spo2_percent: Optional[float] = None
    muac_cm: Optional[float] = None

class Immunization(BaseModel):
    status: Literal["up_to_date", "overdue", "partially_complete", "unknown"]
    last_received: Optional[str] = None
    next_due: Optional[str] = None

class Screening(BaseModel):
    type: str
    status: Literal["completed", "due", "overdue", "unknown"]
    last_done: Optional[str] = None
    result: Literal["normal", "abnormal", "unknown"]

class MaternalCare(BaseModel):
    antenatal_visits: Optional[int] = None
    supplements: Literal["taking", "not_taking", "unknown"]
    required_followup: Literal["yes", "no", "unknown"]

class PreventiveCare(BaseModel):
    immunization: Optional[Immunization] = None
    screenings: List[Screening] = Field(default_factory=list)
    maternal_care: Optional[MaternalCare] = None

class Nutrition(BaseModel):
    appetite: Literal["normal", "reduced", "poor", "unknown"]
    feeding_concern: Literal["yes", "no", "unknown"]
    food_access_problem: Literal["yes", "no", "unknown"]
    nutrition_observation: Optional[str] = None

class MentalSocial(BaseModel):
    mental_health_concern: Literal["yes", "no", "unknown"]
    screening_status: Literal["not_done", "completed", "needs_followup"]
    social_concern: Optional[str] = None
    barriers_to_care: List[str] = Field(default_factory=list)

class CareHistory(BaseModel):
    recent_doctor_visit: Literal["yes", "no", "unknown"]
    recent_hospital_visit: Literal["yes", "no", "unknown"]
    referral_given: Literal["yes", "no", "unknown"]
    referral_completed: Literal["yes", "no", "unknown"]
    previous_followup_pending: Literal["yes", "no", "unknown"]

class CareGap(BaseModel):
    gap_type: Literal["immunization", "nutrition", "maternal", "screening", "medication", "referral", "mental_health", "other"]
    description: str
    evidence: List[str] = Field(default_factory=list)
    severity: Literal["low", "medium", "high"]
    status: Literal["suspected", "confirmed", "resolved"]
    required_questions: List[str] = Field(default_factory=list)
    recommended_action: str
    due_date: Optional[str] = None

class FollowUp(BaseModel):
    required: Literal["yes", "no"]
    reason: Optional[str] = None
    action: Optional[str] = None
    due_date: Optional[str] = None
    status: Literal["pending", "completed", "cancelled"]

class ExtractionMeta(BaseModel):
    overall_confidence: Literal["high", "medium", "low"]
    fields_needing_confirmation: List[str] = Field(default_factory=list)

class ClinicalEncounterSchema(BaseModel):
    visit: VisitMeta
    person: PersonInfo
    health_status: HealthStatus
    measurements: Measurements
    preventive_care: PreventiveCare
    nutrition: Nutrition
    mental_social: MentalSocial
    care_history: CareHistory
    care_gaps: List[CareGap] = Field(default_factory=list)
    follow_up: FollowUp
    extraction: ExtractionMeta
