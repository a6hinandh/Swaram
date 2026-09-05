# Module 4: Longitudinal Vitals Baseline & Delta Deviation Detector

## Owner: Teammate 4

### Overview
This module maintains long-term vitals baselines for individual household members and computes real-time delta deviations (e.g. acute systolic blood pressure spurts $\Delta \ge 20$ mmHg or rapid glycemic shifts) compared against personal moving averages.

### File Structure
- `VitalsBaselineScreen.tsx`: Primary UI component comparing historical baselines vs current readings with acute alert indicators.
- `types.ts`: TypeScript contracts for baseline profiles and deviation analytics.
- `services/vitalsBaselineService.ts`: Delta math, acute hypertensive spurt classification, and clinical action guidelines.

### Recommended Next Steps for Teammate 4
1. **SQLite Longitudinal Memory**: Fetch past 6-12 months of visit vitals from local SQLite storage to calculate rolling weighted moving averages.
2. **Pediatric Growth Velocity**: Incorporate Mid-Upper Arm Circumference (MUAC) and WHO growth velocity charts for children under 5.
3. **Cross-Module Linkage**: Connect with Module 3 (NCD Lifestyle) to flag if vitals deviations correlate with missed medication doses.
4. **Care-Gap Escalation**: Dispatch deviation records to Module 4 Backend Reporting for high-risk household escalation.
