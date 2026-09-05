# Module 1: Structured Mental Health Voice Screening Protocol

## Owner: Teammate 1

### Overview
This module equips frontline ASHA workers with a structured mental health voice screening protocol to detect distress, depression, and postpartum mood disorders during field household visits.

### File Structure
- `MentalHealthScreen.tsx`: Primary UI component for the screening flow.
- `types.ts`: TypeScript contracts for PHQ-2, PHQ-9, and voice acoustic biomarkers.
- `services/mentalHealthService.ts`: Business logic, scoring calculations, and feature extraction stubs.

### Recommended Next Steps for Teammate 1
1. **ASR Voice Stream Hook**: Wire up the live audio stream from `audioRecorder.ts` to extract speech prosody (pitch variability, pause-to-speech ratio, speech energy).
2. **Full PHQ-9 Flow**: If PHQ-2 score >= 3, navigate or expand to the remaining 7 PHQ-9 questions in Malayalam.
3. **Clinical Escalation**: Connect to Module 3/4 backend to trigger notifications for the Primary Health Centre (PHC) medical officer.
4. **Offline Persistence**: Save completed screening records in local SQLite with idempotent sync.
