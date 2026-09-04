from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class VitalsSchema(BaseModel):
    systolic_bp: Optional[float] = None
    diastolic_bp: Optional[float] = None
    weight_kg: Optional[float] = None
    temperature_c: Optional[float] = None
    hemoglobin_g_dl: Optional[float] = None

class PersonUpdateSchema(BaseModel):
    person_id: str
    name: str
    pregnancy_weeks: Optional[int] = None
    vitals: Optional[VitalsSchema] = None
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
