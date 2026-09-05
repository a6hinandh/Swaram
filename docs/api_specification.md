# Swaram API Specification
### Next-Generation Conversational ASHA Platform REST Interface

This document details the REST API specifications exposed by Module 2, Module 3, and Module 4.

---

## 1. Module 2: Voice, Survey & Health Intelligence (`:8001`)

### Process Voice Survey (ASR + Clinical & Malnutrition Extraction)
- **Endpoint:** `POST /api/v1/voice/process-survey` (alias: `POST /api/v1/voice/process`)
- **Request Body:**
```json
{
  "audio_uri": "recordings/survey_01.wav",
  "language": "ml",
  "household_id": "h-lakshmi-001"
}
```
- **Response:** `VisitDraft` matching `visit.schema.json` with `survey_fields`, `missing_field_prompts`, and `malnutrition_assessment`.

### Resolve Missing Field Conversationally
- **Endpoint:** `POST /api/v1/voice/resolve-missing-field`
- **Request Body:**
```json
{
  "draft": { ... },
  "question_id": "q_nut_dietary",
  "answer_text": "കുട്ടി ദിവസവും പാലും മുട്ടയും കഴിക്കാറുണ്ട്"
}
```
- **Response:** Updated `VisitDraft` with the target field populated, malnutrition score recalculated, and the prompt cleared.

### Close Care Gap Question Generator
- **Endpoint:** `POST /api/v1/voice/close-gap`
- **Request Body:** `{ "care_gap": { ... }, "known_context": { ... } }`

---

## 2. Module 3: Central Backend & Longitudinal Care Ledger (`:8000`)

### Health Check
- **Endpoint:** `GET /health`
- **Response:**
```json
{
  "status": "healthy",
  "service": "module3-backend-ocr-ledger",
  "version": "2.0.0",
  "database": "canonical_store"
}
```

### Get Assigned Households
- **Endpoint:** `GET /api/v1/households`
- **Response:** Array of `HouseholdSummary` objects including `malnutrition_risk` and priority reasons.

### Submit Confirmed Survey & Visit
- **Endpoint:** `POST /api/v1/visits`
- **Request Body:** `ConfirmedVisitSchema` (matches `visit.schema.json` with `survey_fields` and `malnutrition_assessment`)
- **Response:**
```json
{
  "status": "saved",
  "id": "v-uuid",
  "timestamp": "2026-09-05T01:00:00Z"
}
```

### Idempotent Sync Push
- **Endpoint:** `POST /api/v1/sync/push`

### Get Unresolved Care Ledger
- **Endpoint:** `GET /api/v1/ledger/{household_id}`
- **Response:** `HouseholdCareLedgerSchema` including `malnutrition_trend`, longitudinal narrative, and active care gaps.

---

## 3. Module 4: Prioritisation, Action & Gateway Automation (`:8002`)

### Calculate Priority (Factoring Malnutrition & Overdue Care)
- **Endpoint:** `POST /api/v1/priorities/calculate`
- **Request Body:**
```json
{
  "household": {
    "id": "h-01",
    "latest_vitals": { "systolic_bp": 142 },
    "malnutrition_risk": "Moderate",
    "vulnerability_factors": { "has_pregnant_woman": true, "child_malnutrition_flag": true }
  },
  "care_gaps": [
    { "id": "gap-1", "severity": "high", "description": "ANC overdue 8 days" },
    { "id": "gap-2", "programme": "malnutrition", "severity": "medium", "description": "Low dietary diversity" }
  ]
}
```
- **Response:**
```json
{
  "household_id": "h-01",
  "priority_score": 88.5,
  "priority_reasons": [
    "High-priority care gap: ANC overdue 8 days",
    "Child malnutrition vulnerability flagged (Low dietary diversity)",
    "Elevated blood pressure observed: 142 mmHg"
  ],
  "sub_scores": { "urgency": 25.0, "overdue": 18.5, "risk": 20.0, "followup": 15.0, "vulnerability": 10.0 },
  "generated_actions": [...]
}
```

### Prepare Form for Gateway
- **Endpoint:** `POST /api/v1/forms/prepare`
- **Request Body:**
```json
{
  "confirmed_visit": { ... },
  "target_portal": "swaram_health_portal"
}
```
