# Swaram API Specification

This document details the REST API specifications exposed by Module 2, Module 3, and Module 4.

---

## 1. Module 3: Central Backend & Care Ledger (`:8000`)

### Health Check
- **Endpoint:** `GET /health`
- **Response:**
```json
{
  "status": "healthy",
  "service": "module3-backend-ocr-ledger",
  "version": "1.0.0",
  "database": "sqlite_canonical"
}
```

### Get Assigned Households
- **Endpoint:** `GET /api/v1/households`
- **Response:** Array of `HouseholdSummary` objects.

### Submit Confirmed Visit
- **Endpoint:** `POST /api/v1/visits`
- **Request Body:** `ConfirmedVisitSchema` (matches `visit.schema.json`)
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
- **Request Body:**
```json
{
  "device_id": "asha-dev-01",
  "items": [
    {
      "client_event_id": "evt-001",
      "entity": "visit",
      "operation": "create",
      "payload": { ... }
    }
  ]
}
```
- **Response:**
```json
{
  "accepted": ["evt-001"],
  "failed": []
}
```

### Get Unresolved Care Ledger
- **Endpoint:** `GET /api/v1/ledger/{household_id}`
- **Response:** `HouseholdCareLedgerSchema` (matches `care_ledger.schema.json`)

---

## 2. Module 2: Voice & Intelligence Service (`:8001`)

### Process Voice Visit (ASR + Extraction)
- **Endpoint:** `POST /api/v1/voice/process`
- **Request Body:**
```json
{
  "audio_uri": "recordings/visit_01.wav",
  "language": "ml",
  "household_id": "h-lakshmi-001"
}
```
- **Response:** `VisitDraft` matching `visit.schema.json`.

### Close Care Gap Question Generator
- **Endpoint:** `POST /api/v1/voice/close-gap`
- **Request Body:** `{ "care_gap": { ... }, "known_context": { ... } }`

---

## 3. Module 4: Automation & Prioritisation (`:8002`)

### Calculate Priority & Generate Actions
- **Endpoint:** `POST /api/v1/priorities/calculate`
- **Request Body:**
```json
{
  "household": { "id": "h-01", "latest_vitals": { "systolic_bp": 142 } },
  "care_gaps": [{ "id": "gap-1", "severity": "high", "description": "ANC overdue" }]
}
```
- **Response:**
```json
{
  "household_id": "h-01",
  "priority_score": 88.5,
  "priority_reasons": ["High-priority care gap: ANC overdue"],
  "generated_actions": [...]
}
```
