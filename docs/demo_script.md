# Swaram Live Demonstration Script: "The Lakshmi Household Journey"
### Next-Generation Conversational ASHA Platform Walkthrough

Use this exact walkthrough during project evaluations or presentations to demonstrate how Swaram replaces cumbersome legacy survey apps with conversational intelligence.

---

## ⏱️ Target Demo Time: 3 to 4 Minutes

### Step 1: Open the Swaram Platform & Establish Longitudinal Context (30 seconds)
1. Launch `module1-mobile` in browser or emulator.
2. Point out **Lakshmi Amma's Household (House 42, Kudumbashree Lane, Aluva)**.
3. Highlight the **Priority Score (88.5)** and **Nutrition Risk (Moderate)**:
   > *"Swaram prioritizes this household today because her 3rd Trimester antenatal checkup is 8 days overdue, her 18-month-old child has a pending MR vaccine, and early childhood malnutrition monitoring is active due to low dietary diversity."*

### Step 2: The Conversational Voice Survey (Zero Typing) (45 seconds)
1. Tap the large green button **"സംസാരിക്കുക (Simulate Voice Survey)"**.
2. Swaram listens to the natural Malayalam utterance:
   > *"ലക്ഷ്മിയെ കണ്ടു. ബിപി 130/85 ഉണ്ട്. ഭാരം 58 കിലോ. അയൺ ഗുളിക കൊടുത്തു. അടുത്ത ചെക്കപ്പ് അടുത്ത വ്യാഴാഴ്ച."*
3. Module 2 converts speech to structured data. Notice that the ASHA worker **never opened a keyboard or navigated nested MCQ dropdowns**.

### Step 3: Proactive Missing Information Inquiry (45 seconds)
1. Notice the amber alert card appearing on screen:
   > *"❓ അപൂർണ്ണ വിവരങ്ങൾ: കുട്ടിക്ക് ദിവസവും പാലും മുട്ടയും അല്ലെങ്കിൽ പയറുവർഗ്ഗങ്ങളും നൽകാറുണ്ടോ?"*
2. Explain:
   > *"In legacy survey apps, if a field is omitted, the form either fails or the worker guesses. In Swaram, the platform proactively and conversationally asks the worker for the missing piece."*
3. Tap **"🎙️ മറുപടി പറയുക"**. The worker answers naturally: *"കുട്ടിക്ക് ദിവസവും പാലും മുട്ടയും കൊടുക്കാറുണ്ട്"*.
4. Watch Swaram immediately update the child's dietary diversity score and clear the prompt!

### Step 4: Swaram Survey Review Screen & Confirmation Gate (30 seconds)
1. Point to the **Survey Review Card**:
   - Beneficiary: Lakshmi Amma
   - Blood Pressure: 130/85 mmHg
   - Child Dietary Diversity: Adequate (Confirmed via voice)
   - Malnutrition Screening: MUAC 12.8 cm (Normal)
   - IFA Tablets: 30 Days supplied
2. Tap **"✓ വിവരങ്ങൾ സ്ഥിരീകരിച്ച് സമർപ്പിക്കുക (Confirm & Submit)"**.
3. Emphasize:
   > *"Core ethical rule: No clinical or survey record is ever committed without explicit human confirmation by the ASHA worker."*

### Step 5: Offline Reliability (20 seconds)
1. Point to the sync indicator showing **"⏳ 2 Queued"**.
2. Explain:
   > *"When offline in rural terrain, encounters are stored in on-device SQLite with client UUIDs. The worker is never blocked by poor network connectivity."*

### Step 6: Central Reporting Gateway Automation (45 seconds)
1. Open the Central Reporting Gateway (`http://localhost:8080`).
2. Run the Playwright automation script in `module4-reporting-priorities`:
   ```bash
   python run_demo.py --headless
   ```
3. Show the browser automatically populating the beneficiary, vitals, and malnutrition monitoring fields using accessible locators (`getByLabel`).
4. Conclude:
   > *"The ASHA worker spoke naturally as if to a colleague. Swaram auto-extracted the survey, asked for missing details, verified with the worker, updated the household's longitudinal health memory, and completed the official reporting burden."*
