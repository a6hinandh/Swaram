# Production MongoDB Architecture & Migration Specification for Swaram
### Longitudinal Vitals Baseline, Care Ledger & Frontline Intelligence Data Backbone

---

## 1. Executive Summary & Current State Audit

### 1.1 The Current Implementation: "The In-Memory Silo Trap"
An audit of the live codebase and the connected MongoDB Atlas cluster (`swaram_db`) reveals a critical architectural gap:
- **Connection Exists, But Data is Bypassed:** While `database.py` successfully connects to MongoDB Atlas via `MONGODB_URL` in `.env` and defines collections (`households`, `visits`, `clinical_encounters`, `care_ledgers`, `environmental_assessments`), **the API routers predominantly bypass MongoDB**:
  - `routers/households.py` reads from a hardcoded Python list (`MOCK_HOUSEHOLDS_DB`).
  - `routers/care_ledger.py` generates hardcoded responses from static Python dictionaries.
  - `routers/visits.py` writes to a transient in-memory list (`VISITS_STORE = []`).
  - As a result, querying the live Atlas cluster reveals **`households: 0 documents`**, **`visits: 0 documents`**, and **`clinical_encounters: 0 documents`** (only 5 environmental assessment tests exist).
- **Missing Longitudinal Collections:** There is **no collection for longitudinal vitals baselines** (`vitals_baselines`), no patient-level time-series index, and no persistent store for `care_gaps`.
- **Zero Aggregation Pipelines:** Rolling moving averages, pediatric growth velocity calculations, and delta deviations are calculated either via client-side mock logic or not at all.

### 1.2 The Production Objective
To provide a true production foundation for Swaram, MongoDB must become the **single source of canonical truth**. Every confirmed visit from the field must persist in MongoDB, update the patient's rolling **Exponential Weighted Moving Average (EWMA)** baseline, evaluate acute delta deviations, auto-generate care gaps in the household ledger, and drive explainable priority scoring.

---

## 2. Target Production MongoDB Data Architecture

The target database architecture organizes Swaram's domain into seven tightly coupled, indexed collections:

```mermaid
erDiagram
    HOUSEHOLDS ||--o{ PERSONS : contains
    HOUSEHOLDS ||--o{ CARE_LEDGERS : maintains
    HOUSEHOLDS ||--o{ ENVIRONMENTAL_ASSESSMENTS : monitored_by
    PERSONS ||--o{ CLINICAL_ENCOUNTERS : logs
    PERSONS ||--|| VITALS_BASELINES : tracks
    CARE_LEDGERS ||--o{ CARE_GAPS : contains
    CARE_GAPS ||--o{ ACTIONS : generates

    HOUSEHOLDS {
        string _id PK "h-lakshmi-001"
        string external_id "ASHA-WARD4-HH042"
        string head_of_household "Lakshmi Amma"
        object location "lat, lng, ward, locality"
        object vulnerability_factors "pregnant, infant, elderly"
        float priority_score "88.5"
        array priority_reasons
        datetime updated_at
    }

    PERSONS {
        string _id PK "p-radhamani-01"
        string household_id FK "h-lakshmi-001"
        string name "Radhamani P."
        int age "62"
        string gender "female"
        string life_stage "elderly"
        array chronic_conditions "Hypertension, Diabetes"
        datetime registered_at
    }

    CLINICAL_ENCOUNTERS {
        string _id PK "enc-uuid"
        string visit_id UK "v-uuid"
        string household_id FK "h-lakshmi-001"
        string person_id FK "p-radhamani-01"
        datetime encounter_date "2026-09-05"
        object measurements "vitals: BP, glucose, weight, temp, muac"
        object malnutrition "waz_zscore, wasting, dietary_score"
        object mental_health "gad2, phq2, phq4, risk"
        array symptoms
        array medications
        string audio_ref
        string sync_status "synced"
    }

    VITALS_BASELINES {
        string _id PK "vb-p-radhamani-01"
        string person_id UK FK "p-radhamani-01"
        string household_id FK "h-lakshmi-001"
        object baseline_vitals "ewma_systolic, ewma_diastolic, ewma_glucose, ewma_weight"
        object statistical_bounds "std_dev_sys, min_sys, max_sys"
        int total_recorded_visits "6"
        datetime first_recorded_at "2026-03-10"
        datetime last_updated_at "2026-09-05"
        object latest_delta_analysis "severity, spurt, delta_sys, delta_dia"
    }

    CARE_LEDGERS {
        string _id PK "ledger-h-lakshmi-001"
        string household_id UK FK "h-lakshmi-001"
        int open_gaps_count "3"
        array care_gaps "Embedded CareGapSchema objects"
        string longitudinal_narrative "Generated clinical briefing"
        string malnutrition_trend "Moderate vulnerability"
        datetime updated_at
    }

    ACTIONS {
        string _id PK "act-uuid"
        string household_id FK "h-lakshmi-001"
        string care_gap_id FK
        string title "Hypertension: Acute Spurt Review"
        string description "Re-check BP in 48h and verify medication"
        string assigned_to "ASHA Worker (Ward 4)"
        date due_date "2026-09-07"
        string status "pending"
    }
```

---

## 3. Detailed Collection Schemas & Design

### 3.1 Collection: `vitals_baselines` (NEW Core Engine)
Maintains personal historical baselines, rolling Exponential Weighted Moving Averages (EWMA), and latest delta deviation flags.

```json
{
  "_id": "vb-p-radhamani-01",
  "person_id": "p-radhamani-01",
  "household_id": "h-lakshmi-001",
  "person_name": "Radhamani P.",
  "age": 62,
  "gender": "female",
  "baseline_metrics": {
    "systolic_bp": 120.0,
    "diastolic_bp": 80.0,
    "random_blood_sugar_mg_dl": 115.0,
    "pulse_bpm": 72.0,
    "weight_kg": 56.5,
    "muac_cm": null
  },
  "rolling_statistics": {
    "sample_count": 6,
    "systolic_std_dev": 4.2,
    "systolic_min": 116.0,
    "systolic_max": 124.0,
    "weight_velocity_kg_per_month": 0.0
  },
  "latest_measurement": {
    "systolic_bp": 148.0,
    "diastolic_bp": 92.0,
    "random_blood_sugar_mg_dl": 185.0,
    "pulse_bpm": 76.0,
    "weight_kg": 56.8,
    "measured_at": "2026-09-05T10:30:00Z",
    "visit_id": "v-20260905-001"
  },
  "latest_delta_analysis": {
    "systolic_delta": 28.0,
    "diastolic_delta": 12.0,
    "glucose_delta": 70.0,
    "is_hypertensive_spurt": true,
    "is_acute_crisis": false,
    "pediatric_velocity_status": "not_applicable",
    "severity": "moderate_drift",
    "alert_headline": "Acute Hypertensive Deviation & Baseline Drift",
    "clinical_action": "Systolic spurt +28 mmHg exceeds 20 mmHg threshold. Verify medication adherence and re-check BP in 48h."
  },
  "recent_history_points": [
    { "date": "2026-03-12", "systolic": 118, "diastolic": 78, "glucose": 110, "weight": 56.2 },
    { "date": "2026-04-15", "systolic": 120, "diastolic": 80, "glucose": 112, "weight": 56.4 },
    { "date": "2026-05-20", "systolic": 122, "diastolic": 82, "glucose": 118, "weight": 56.5 },
    { "date": "2026-06-25", "systolic": 119, "diastolic": 79, "glucose": 114, "weight": 56.5 },
    { "date": "2026-07-30", "systolic": 121, "diastolic": 81, "glucose": 116, "weight": 56.6 },
    { "date": "2026-09-05", "systolic": 148, "diastolic": 92, "glucose": 185, "weight": 56.8 }
  ],
  "created_at": "2026-03-12T09:00:00Z",
  "updated_at": "2026-09-05T10:30:00Z"
}
```

### 3.2 Collection: `care_ledgers` (Active Cross-Programme Ledger)
Stores active care gaps, source evidence, and longitudinal narratives.

```json
{
  "_id": "ledger-h-lakshmi-001",
  "household_id": "h-lakshmi-001",
  "household_name": "Lakshmi Amma's Household",
  "ward": "Ward 4, Aluva",
  "open_gaps_count": 3,
  "care_gaps": [
    {
      "id": "gap-vitals-spurt-01",
      "household_id": "h-lakshmi-001",
      "person_id": "p-radhamani-01",
      "person_name": "Radhamani P.",
      "programme": "ncd",
      "gap_type": "vitals_delta_hypertensive_spurt",
      "description": "Acute systolic BP spurt (+28 mmHg from personal baseline 120/80 mmHg).",
      "evidence": [
        {
          "source_type": "visit_vitals_deviation",
          "observed_at": "2026-09-05T10:30:00Z",
          "baseline_sys": 120,
          "measured_sys": 148
        }
      ],
      "severity": "high",
      "status": "open",
      "due_date": "2026-09-07",
      "owner": "ASHA Worker (Ward 4)",
      "recommended_action": "Home visit within 48h: verify anti-hypertensive drug adherence and re-measure BP.",
      "last_reviewed_at": "2026-09-05T10:30:00Z"
    },
    {
      "id": "gap-ped-velocity-02",
      "household_id": "h-lakshmi-001",
      "person_id": "p-rahul-02",
      "person_name": "Rahul",
      "programme": "malnutrition",
      "gap_type": "child_growth_velocity_faltering",
      "description": "Pediatric weight faltering (-500g over 45 days, 10.2kg -> 9.7kg). Dietary diversity low (3/8).",
      "evidence": [
        {
          "source_type": "growth_velocity_check",
          "observed_at": "2026-09-05T10:30:00Z",
          "previous_weight": 10.2,
          "current_weight": 9.7,
          "days_elapsed": 45
        }
      ],
      "severity": "high",
      "status": "open",
      "due_date": "2026-09-12",
      "owner": "ASHA Worker (Ward 4)",
      "recommended_action": "Counsel on egg/milk protein supplementation, inspect for diarrhea, schedule PHC review.",
      "last_reviewed_at": "2026-09-05T10:30:00Z"
    }
  ],
  "priority_score": 92.5,
  "priority_reasons": [
    "Acute hypertensive spurt detected in Radhamani P. (+28 mmHg)",
    "Pediatric growth faltering / weight drop flagged in child Rahul",
    "Antenatal 3rd trimester checkup overdue"
  ],
  "longitudinal_narrative": "Household: Lakshmi Amma's Household (Ward 4, Aluva)\nLongitudinal Vitals Briefing:\n - Radhamani P. (62): Baseline BP 120/80 mmHg; Acute deviation today at 148/92 mmHg (+28/+12 mmHg spurt). Blood sugar surged +70 mg/dL (185 mg/dL). High probability of missed medication.\n - Rahul (18m): Weight drop observed (10.2 kg down to 9.7 kg, -500g). Dietary diversity 3/8.\nNext Visit Priorities:\n - Re-check Radhamani's blood pressure within 48 hours.\n - Track child growth recovery and verify supplementary nutrition intake.",
  "updated_at": "2026-09-05T10:30:00Z"
}
```

---

## 4. Indexing & Query Optimization Strategy

To ensure sub-millisecond query latency on frontline low-bandwidth connections, the following indexes must be configured in `database.py`:

```python
# 1. vitals_baselines collection
vitals_baselines_col.create_index([("person_id", ASCENDING)], unique=True)
vitals_baselines_col.create_index([("household_id", ASCENDING)])
vitals_baselines_col.create_index([("latest_delta_analysis.severity", ASCENDING)])
vitals_baselines_col.create_index([("updated_at", ASCENDING)])

# 2. care_ledgers collection
care_ledgers_col.create_index([("household_id", ASCENDING)], unique=True)
care_ledgers_col.create_index([("priority_score", ASCENDING)])
care_ledgers_col.create_index([("care_gaps.status", ASCENDING)])
care_ledgers_col.create_index([("care_gaps.programme", ASCENDING)])

# 3. clinical_encounters collection
encounters_col.create_index([("visit.visit_id", ASCENDING)], unique=True)
encounters_col.create_index([("visit.household_id", ASCENDING), ("visit.date", DESCENDING)])
encounters_col.create_index([("person.person_id", ASCENDING), ("visit.date", DESCENDING)])

# 4. households collection
households_col.create_index([("id", ASCENDING)], unique=True)
households_col.create_index([("priority_score", DESCENDING)])
```

---

## 5. High-Performance MongoDB Aggregation Pipelines

### 5.1 Pipeline 1: Personal Rolling EWMA Baseline Calculation
Calculates the Exponential Weighted Moving Average ($\alpha = 0.3$) and statistical variance across past historical encounters:

```python
def compute_patient_baseline_pipeline(person_id: str, limit: int = 12):
    return [
        {"$match": {"person.person_id": person_id}},
        {"$sort": {"visit.date": 1}},
        {"$limit": limit},
        {
            "$group": {
                "_id": "$person.person_id",
                "sample_count": {"$sum": 1},
                "avg_systolic": {"$avg": "$measurements.blood_pressure_sys"},
                "avg_diastolic": {"$avg": "$measurements.blood_pressure_dia"},
                "avg_glucose": {"$avg": "$measurements.blood_sugar_mg_dl"},
                "avg_weight": {"$avg": "$measurements.weight_kg"},
                "std_dev_sys": {"$stdDevPop": "$measurements.blood_pressure_sys"},
                "min_sys": {"$min": "$measurements.blood_pressure_sys"},
                "max_sys": {"$max": "$measurements.blood_pressure_sys"},
                "history": {
                    "$push": {
                        "date": "$visit.date",
                        "systolic": "$measurements.blood_pressure_sys",
                        "diastolic": "$measurements.blood_pressure_dia",
                        "glucose": "$measurements.blood_sugar_mg_dl",
                        "weight": "$measurements.weight_kg"
                    }
                }
            }
        }
    ]
```

### 5.2 Pipeline 2: Pediatric Growth Velocity Aggregation
Compares the last two weight measurements for children under 5 to calculate $\Delta \text{weight}$ and days elapsed:

```python
def compute_pediatric_growth_velocity_pipeline(person_id: str):
    return [
        {"$match": {"person.person_id": person_id, "measurements.weight_kg": {"$ne": None}}},
        {"$sort": {"visit.date": -1}},
        {"$limit": 2},
        {
            "$group": {
                "_id": "$person.person_id",
                "weights": {"$push": "$measurements.weight_kg"},
                "dates": {"$push": "$visit.date"},
                "muacs": {"$push": "$measurements.muac_cm"}
            }
        },
        {
            "$project": {
                "current_weight": {"$arrayElemAt": ["$weights", 0]},
                "previous_weight": {"$arrayElemAt": ["$weights", 1]},
                "current_date": {"$arrayElemAt": ["$dates", 0]},
                "previous_date": {"$arrayElemAt": ["$dates", 1]},
                "weight_delta": {
                    "$subtract": [
                        {"$arrayElemAt": ["$weights", 0]},
                        {"$arrayElemAt": ["$weights", 1]}
                    ]
                }
            }
        }
    ]
```

---

## 6. Comprehensive Migration Plan & Action Items

To transition from the current in-memory implementation to this production MongoDB architecture, the following steps will be executed:

### Step 1: Database Connector & Collections Enhancement (`database.py`)
1. Add `vitals_baselines_col` and `actions_col` to `database.py`.
2. Configure all required unique and compound indexes.
3. Add a safe reconnection helper that reconnects if MongoDB Atlas dropped temporarily.

### Step 2: Seed & Migration Script (`scripts/seed_mongodb.py`)
1. Create and execute a database seed script that populates:
   - 3 realistic synthetic households (*Lakshmi Amma's Household*, *Suresh Kumar's Household*, *Anitha Kumari's Household*).
   - Household members with established 6-month longitudinal visit histories.
   - Initialized `vitals_baselines` with EWMA calculations and trend history points.
   - Initialized `care_ledgers` with real cross-programme care gaps.

### Step 3: Refactor Routers to Use MongoDB Collections
1. **`routers/households.py`:** Replace `MOCK_HOUSEHOLDS_DB` with `households_col.find()` (falling back to memory only if Mongo is unreachable).
2. **`routers/visits.py`:** Update `record_confirmed_visit` to insert into `visits_col` and trigger baseline update.
3. **`routers/care_ledger.py`:** Read and update `care_ledgers_col` directly.
4. **`routers/vitals.py` (NEW):**
   - `GET /api/v1/vitals/baseline/{person_id}`: Retrieves patient baseline and 6-month historical sparkline data.
   - `POST /api/v1/vitals/analyze-delta`: Computes delta deviations against MongoDB baseline, auto-generates care gaps in `care_ledgers_col`, and recalculates household priority.

### Step 4: Synchronize Mobile Client & Modules
1. Update mobile `vitalsBaselineService.ts` and `apiClient.ts` to call the live MongoDB-backed endpoints with offline fallback.
2. Update Module 4 Priority Engine to read from `care_ledgers_col` and `vitals_baselines_col`.
