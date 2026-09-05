# Module 2: Environmental & Climate Risk Monitoring

## Owner: Teammate 2

### Overview
This module tracks climate vulnerabilities, extreme heat stress, water safety, vector breeding habitats, and indoor biomass smoke exposure during frontline household visits.

### File Structure
- `EnvironmentalRiskScreen.tsx`: Primary UI component for the environmental assessment.
- `types.ts`: TypeScript contracts for climate factors, heat index, and sanitation.
- `services/environmentalRiskService.ts`: Risk evaluation algorithms and heat index calculators.

### Recommended Next Steps for Teammate 2
1. **Weather API Integration**: Fetch live temperature, relative humidity, and IMD heatwave warnings for the ASHA worker's active ward.
2. **Vector Risk Checklist**: Add visual checks for open water tanks, coconut shells, and unshaded containers prone to Aedes aegypti breeding.
3. **Cross-Module Linkage**: Correlate extreme heat alerts with the Longitudinal Vitals module (Module 4) to flag dehydration and acute hypertensive spikes in elderly residents.
4. **Actionable Field Advice**: Generate localized Malayalam safety recommendations for household boiling advisories and heat mitigation.
