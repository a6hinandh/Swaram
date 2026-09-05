# Module 1: Swaram Mobile Application
### Next-Generation ASHA Worker Platform (Client Experience)

**Assigned Teammate:** Member 1 (Lead Developer / Mobile & System Integrator)  
**Tech Stack:** React Native, Expo, TypeScript, Zustand, `expo-sqlite`

---

## 🎯 Purpose & Responsibilities
This module is the primary field interface for the ASHA worker:
1. **Conversational Survey Workflow:** Replaces rigid, tiny-screen MCQ surveys with natural language Malayalam conversation. Zero typing, zero dropdown navigation.
2. **Proactive Missing Field Inquiries:** When mandatory survey fields or clinical details are omitted, Swaram explicitly prompts the worker in natural language (*"Does the child consume milk and eggs daily?"*). The worker responds conversationally to complete the survey.
3. **Swaram Survey Review Screen:** Transparent review card displaying all auto-filled fields across Demographics, Lifestyle NCD Screening, Malnutrition & Child Health, and Maternal Vitals.
4. **Malnutrition & Growth Monitoring:** Real-time visibility into child dietary diversity, MUAC readings, and maternal nutritional anemia.
5. **Longitudinal Care Ledger:** Persistent household memory tracking open care gaps and health history across visits.
6. **Offline-First Resilience:** Instant local persistence with SQLite and an idempotent event queue for background synchronization.

---

## 🚀 Quick Start

```bash
cd module1-mobile
npm install
npm run web      # Run in browser for rapid UI testing
# or
npm run android  # Run in Android emulator or Expo dev build
```

---

## 🔌 API Client Capabilities
The client (`src/api/apiClient.ts`) handles:
- `apiClient.checkBackendHealth()`: Pings `GET http://localhost:8000/health`.
- `apiClient.getHouseholds()`: Fetches households with priority scores and malnutrition risk flags.
- `apiClient.getCareLedger(householdId)`: Loads the household's longitudinal care ledger.
- `apiClient.processVoiceVisit(audioUri)`: Sends audio to Module 2 for survey and clinical extraction.
- `apiClient.resolveMissingField(draft, qId, answer)`: Resolves missing survey fields conversationally.
- `apiClient.submitConfirmedVisit(visit)`: Posts human-confirmed surveys and updates the sync queue.

If backends are offline, `apiClient` gracefully falls back to local contracts in `src/data/mockData.ts`.
