# Module 1: ASHA Mobile Field App & Integration

**Assigned Teammate:** Member 1 (Lead Developer / Mobile & System Integrator)  
**Tech Stack:** React Native, Expo, TypeScript, Zustand, `expo-sqlite`

---

## 🎯 Purpose & Responsibilities
This module owns everything the ASHA worker touches in the field:
1. **Field Usability:** Voice-first, high contrast, minimal typing, minimal reading.
2. **Audio Workflow:** Microphone capture -> trigger Module 2 ASR/Extraction -> preview extracted entities -> Human Confirmation Gate.
3. **Offline Field Mode:** Local SQLite persistence for household encounters, automatic queuing, and idempotent server synchronisation.
4. **Care Ledger UI:** Visualising cross-programme care gaps (Maternal, Child, NCD, Nutrition, Mental Health) and longitudinal narratives.
5. **System Integration:** Connecting the interfaces from Module 2 (Voice), Module 3 (Backend/Sync), and Module 4 (Reporting).

---

## 🚀 Quick Start for Member 1

```bash
cd module1-mobile
npm install
npm run web      # Run in browser for rapid UI testing
# or
npm run android  # Run in Android emulator or Expo Go / dev build
```

---

## 🔌 API Client & "Basic Call" Testing
The file [`src/api/apiClient.ts`](./src/api/apiClient.ts) connects Module 1 to the backend:
- `apiClient.checkBackendHealth()`: Pings `GET http://localhost:8000/health`.
- `apiClient.getHouseholds()`: Fetches households for today's visits.
- `apiClient.getCareLedger(householdId)`: Loads the household's unresolved care ledger.
- `apiClient.processVoiceVisit(audioUri)`: Sends Malayalam audio to Module 2.
- `apiClient.submitConfirmedVisit(visit)`: Posts confirmed clinical records.

*Note:* If the backend (Module 3) is not yet running, `apiClient` seamlessly falls back to offline contracts in [`src/data/mockData.ts`](./src/data/mockData.ts) so you can develop UI components without waiting on your teammates.

---

## 📂 Directory Layout
```
module1-mobile/
├── App.tsx             # Main ASHA field dashboard
├── app.json            # Expo app configuration & permissions (AUDIO, CAMERA)
├── package.json
├── tsconfig.json
├── src/
│   ├── api/
│   │   └── apiClient.ts # Live backend calls + mock fallback
│   ├── data/
│   │   └── mockData.ts  # Seed test data (Lakshmi household scenario)
│   ├── types/
│   │   └── index.ts     # Re-exports shared contracts from /contracts/types.ts
│   └── components/      # (Add custom modular components here)
└── README.md
```

---

## 🤝 Frozen Contracts Used
- Inputs: `VisitDraft` (from Module 2), `HouseholdCareLedger` (from Module 3)
- Outputs: `ConfirmedVisit` (sent to Module 3 & Module 4)
- Specification: Refer to `../contracts/` for JSON schemas.
