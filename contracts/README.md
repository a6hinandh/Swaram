# Swaram Frozen Data Contracts
### Next-Generation ASHA Worker Platform Core Schemas

This directory contains the canonical JSON Schemas and TypeScript definitions governing the data contracts between all four modules in **Swaram**.

> **CRITICAL RULE FOR TEAM MEMBERS**:  
> No teammate may modify these contracts without explicit agreement from the other three members. These interfaces are the single source of truth that allow Module 1, Module 2, Module 3, and Module 4 to be developed and tested completely independently with mock data.

---

## Contract Index

| Contract | Owner Module | Consumer Modules | File | Purpose |
|---|---|---|---|---|
| **VisitDraft** | Module 2 (Voice) | Module 1 (Mobile) | [`visit.schema.json`](./visit.schema.json) | Output of Malayalam ASR + survey & malnutrition extraction pipeline before confirmation |
| **ConfirmedVisit** | Module 1 / 2 | Module 3 (Backend) & Module 4 (Reporting) | [`visit.schema.json`](./visit.schema.json) | Human-confirmed clinical and survey record ready for canonical persistence and filing |
| **CareGap** | Module 2 / 3 | Module 1 (Mobile) & Module 4 (Priority) | [`care_gap.schema.json`](./care_gap.schema.json) | Standard representation of an unresolved health need across programmes (Maternal, Child, Nutrition/Malnutrition, NCDs) |
| **CareLedger** | Module 3 (Backend) | Module 1 (Mobile) & Module 4 (Action) | [`care_ledger.schema.json`](./care_ledger.schema.json) | Household-level longitudinal ledger tracking active, open, and resolved care gaps |
| **ReportingAction** | Module 4 (Reporting) | Module 1 (Mobile) | [`reporting.schema.json`](./reporting.schema.json) | Form mapping & submission status for health department reporting gateway |
| **OCRRegister** | Module 3 (OCR) | Module 1 (Mobile) | [`ocr.schema.json`](./ocr.schema.json) | Digitised paper register rows with confidence and identity match candidates |

---

## Key Model Additions for Next-Gen ASHA Platform
- **MalnutritionAssessment:** First-class monitoring of child wasting, stunting, MUAC (cm), infant feeding, dietary diversity score, and maternal nutritional anemia to address overlooked health challenges.
- **SwaramSurveyField:** Structured representation of community health survey answers extracted conversationally from natural speech.
- **MissingFieldPrompt:** Proactive conversational questions in Malayalam and English allowing Swaram to ask the worker explicitly for unmentioned mandatory survey fields.

---

## TypeScript Bindings
For React Native (Module 1) and any Node-based tooling, import all types directly from:
```typescript
import { ConfirmedVisit, CareGap, HouseholdCareLedger, VisitDraft, MalnutritionAssessment } from '../contracts/types';
```
