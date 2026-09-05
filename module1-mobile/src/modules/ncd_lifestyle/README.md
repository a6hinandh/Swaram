# Module 3: NCD Lifestyle & Behavioral Risk Factor Tracking

## Owner: Teammate 3

### Overview
This module tracks non-communicable disease (NCD) behavioral risks (tobacco, alcohol, salt/oil excess, physical inactivity) and monitors daily medication compliance for patients with hypertension and diabetes.

### File Structure
- `NcdLifestyleScreen.tsx`: Primary UI component for the behavioral assessment.
- `types.ts`: TypeScript contracts for CBAC parameters and medication compliance.
- `services/ncdLifestyleService.ts`: Risk score algorithms and adherence calculations.

### Recommended Next Steps for Teammate 3
1. **Full CBAC Assessment**: Expand questionnaire to match the Ministry of Health and Family Welfare (MoHFW) 5-point CBAC checklist.
2. **Pharmacy Refill Tracker**: Add date-based reminders for medicine replenishment from PHC sub-centres.
3. **Behavioral Change Communication (BCC)**: Implement short, culturally tailored audio counseling prompts in Malayalam for salt reduction and tobacco cessation.
4. **Integration with Core Survey**: Auto-populate person updates with lifestyle scores in the household ledger.
