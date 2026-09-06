from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class VitalsSchema(BaseModel):
    systolic_bp: Optional[float] = None
    diastolic_bp: Optional[float] = None
    weight_kg: Optional[float] = None
    temperature_c: Optional[float] = None
    hemoglobin_g_dl: Optional[float] = None

class MalnutritionAssessmentSchema(BaseModel):
    child_age_months: Optional[int] = None
    muac_cm: Optional[float] = None
    wasting_status: Optional[str] = "normal"
    stunting_status: Optional[str] = "normal"
    dietary_diversity_score: Optional[int] = None
    consumed_milk: Optional[bool] = None
    consumed_eggs: Optional[bool] = None
    consumed_pulses: Optional[bool] = None
    edema_present: Optional[bool] = False
    maternal_anemia_flag: Optional[bool] = False
    risk_level: str = "normal"
    clinical_notes: Optional[str] = None

class MentalHealthAssessmentSchema(BaseModel):
    anxiety_score: Optional[float] = None
    depression_score: Optional[float] = None
    total_score: Optional[float] = None
    risk_level: Optional[str] = "normal"
    screening_status: Optional[str] = "pending"

class SwaramSurveyFieldSchema(BaseModel):
    field_key: str
    section: str
    question_ml: str
    question_en: str
    value: str
    status: str = "extracted"

class PersonUpdateSchema(BaseModel):
    person_id: str
    name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    pregnancy_weeks: Optional[int] = None
    vitals: Optional[VitalsSchema] = None
    malnutrition: Optional[MalnutritionAssessmentSchema] = None
    mental_health: Optional[MentalHealthAssessmentSchema] = None
    symptoms: Optional[List[str]] = Field(default_factory=list)
    medications_given: Optional[List[str]] = Field(default_factory=list)
    services_provided: Optional[List[str]] = Field(default_factory=list)
    follow_up_date: Optional[str] = None

class ConfirmedVisitSchema(BaseModel):
    visit_id: str
    household_id: str
    worker_id: str
    timestamp: str
    person_updates: List[PersonUpdateSchema]
    survey_fields: Optional[List[SwaramSurveyFieldSchema]] = Field(default_factory=list)
    malnutrition_assessment: Optional[MalnutritionAssessmentSchema] = None
    audio_record_ref: Optional[str] = None
    confirmed_by_worker_at: str
    corrections_made: Optional[List[str]] = Field(default_factory=list)
    sync_status: str = "synced"

class HouseholdSummarySchema(BaseModel):
    id: str
    external_id: str
    head_of_household: str
    address: str
    members_count: int
    open_care_gaps: int
    priority_score: float
    priority_reasons: List[str]
    malnutrition_risk: Optional[str] = "Normal"

class CareGapSchema(BaseModel):
    id: str
    household_id: str
    person_id: Optional[str] = None
    programme: str
    gap_type: str
    description: str
    evidence: List[Dict[str, Any]] = Field(default_factory=list)
    severity: str
    status: str
    due_date: Optional[str] = None
    owner: Optional[str] = None
    recommended_action: Optional[str] = None
    last_reviewed_at: str

class HouseholdCareLedgerSchema(BaseModel):
    household_id: str
    household_name: str
    updated_at: str
    open_gaps_count: int
    care_gaps: List[CareGapSchema]
    priority_score: float
    priority_reasons: List[str]
    longitudinal_narrative: str
    malnutrition_trend: Optional[str] = "Normal growth trajectory"

class SyncItemSchema(BaseModel):
    client_event_id: str
    entity: str
    operation: str
    payload: Dict[str, Any]

class SyncPushRequestSchema(BaseModel):
    device_id: str
    items: List[SyncItemSchema]

class SyncPushResponseSchema(BaseModel):
    accepted: List[str]
    failed: List[Dict[str, str]]

class HistoricalVitalsPointSchema(BaseModel):
    date: str
    systolic: Optional[float] = None
    diastolic: Optional[float] = None
    glucose: Optional[float] = None
    pulse: Optional[float] = None
    weight: Optional[float] = None
    muac: Optional[float] = None

class VitalsDeltaAnalysisSchema(BaseModel):
    systolic_delta: float = 0.0
    diastolic_delta: float = 0.0
    glucose_delta: Optional[float] = None
    pulse_delta: Optional[float] = None
    weight_delta_kg: Optional[float] = None
    is_hypertensive_spurt: bool = False
    is_acute_crisis: bool = False
    pediatric_velocity_status: Optional[str] = "not_applicable"
    severity: str = "normal"
    alert_headline: str = "Stable Longitudinal Trend"
    clinical_action: str = "Vitals conform to household longitudinal baseline."

class VitalsBaselineSchema(BaseModel):
    person_id: str
    household_id: str
    person_name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    baseline_metrics: Dict[str, Any] = Field(default_factory=dict)
    rolling_statistics: Dict[str, Any] = Field(default_factory=dict)
    latest_measurement: Optional[Dict[str, Any]] = None
    latest_delta_analysis: Optional[VitalsDeltaAnalysisSchema] = None
    recent_history_points: List[HistoricalVitalsPointSchema] = Field(default_factory=list)
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class VitalsDeltaRequestSchema(BaseModel):
    person_id: str
    household_id: str
    systolic_bp: Optional[float] = None
    diastolic_bp: Optional[float] = None
    glucose_mg_dl: Optional[float] = None
    pulse_bpm: Optional[float] = None
    weight_kg: Optional[float] = None
    muac_cm: Optional[float] = None

class LoginRequestSchema(BaseModel):
    username: str
    password: str

class AshaWorkerProfileSchema(BaseModel):
    worker_id: str
    username: str
    name: str
    role: str = "asha_worker"
    ward: str
    phone: Optional[str] = None
    sub_centre: Optional[str] = None

class LoginResponseSchema(BaseModel):
    status: str
    access_token: str
    token_type: str = "bearer"
    user: AshaWorkerProfileSchema

class PersonSchema(BaseModel):
    person_id: str
    household_id: str
    name: str
    age: Optional[float] = None
    gender: Optional[str] = None
    relationship: Optional[str] = "member"
    life_stage: Optional[str] = "adult"
    pregnancy_status: Optional[str] = "not_pregnant"
    pregnancy_weeks: Optional[int] = None
    chronic_conditions: List[str] = Field(default_factory=list)
    created_at: Optional[str] = None

class CreateHouseholdSchema(BaseModel):
    id: Optional[str] = None
    external_id: str  # e.g. ASHA-WARD4-HH045
    head_of_household: str
    address: str
    ward: str = "Ward 4, Aluva"
    members_count: int = 1
    malnutrition_risk: Optional[str] = "Normal"

