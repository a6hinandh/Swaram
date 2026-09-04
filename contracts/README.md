# Swaram Frozen Data Contracts

This directory contains the canonical JSON Schemas and TypeScript definitions governing the data contracts between all four modules in Swaram.

> **CRITICAL RULE FOR TEAM MEMBERS**:  
> No teammate may modify these contracts without explicit agreement from the other three members. These interfaces are the single source of truth that allow Module 1, Module 2, Module 3, and Module 4 to be developed and tested completely independently with mock data.

---

## Contract Index

| Contract | Owner Module | Consumer Modules | File | Purpose |
|---|---|---|---|---|
| **VisitDraft** | Module 2 (Voice) | Module 1 (Mobile) | [`visit.schema.json`](./visit.schema.json) | Output of Malayalam ASR + extraction pipeline before confirmation |
| **ConfirmedVisit** | Module 1 / 2 | Module 3 (Backend) & Module 4 (Reporting) | [`visit.schema.json`](./visit.schema.json) | Final human-confirmed clinical record ready for persistence and filing |
| **CareGap** | Module 2 / 3 | Module 1 (Mobile) & Module 4 (Priority) | [`care_gap.schema.json`](./care_gap.schema.json) | Standard representation of an unresolved health need across programmes |
| **CareLedger** | Module 3 (Backend) | Module 1 (Mobile) & Module 4 (Action) | [`care_ledger.schema.json`](./care_ledger.schema.json) | Household-level ledger containing all open, active, and resolved care gaps |
| **ReportingAction** | Module 4 (Reporting) | Module 1 (Mobile) | [`reporting.schema.json`](./reporting.schema.json) | Form mapping & submission status for government portal automation |
| **OCRRegister** | Module 3 (OCR) | Module 1 (Mobile) | [`ocr.schema.json`](./ocr.schema.json) | Digitised paper register rows with confidence and identity match candidates |

---

## TypeScript Bindings
For React Native (Module 1) and any Node-based tooling, import all types directly from:
```typescript
import { ConfirmedVisit, CareGap, CareLedger, PriorityItem } from '../contracts/types';
```
