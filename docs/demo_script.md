# Swaram Live Demonstration Script: "The Lakshmi Household Journey"

Use this exact walkthrough during project evaluation or hackathon judging to demonstrate the closed-loop capability of Swaram.

---

## ⏱️ Target Demo Time: 3 to 4 Minutes

### Step 1: Open the Field App & Establish Context (30 seconds)
1. Launch `module1-mobile`.
2. Point out **Lakshmi Amma's Household (House 42, Kudumbashree Lane, Aluva)**.
3. Show the **Priority Score (88.5)** and explain:
   > *"Swaram highlights this household today because her 3rd Trimester antenatal checkup is 8 days overdue and her 18-month-old child has an unverified MR immunisation status in the Care Ledger."*

### Step 2: The Voice Visit (Zero Typing) (60 seconds)
1. Tap the large button **"സംസാരിക്കുക (Simulate Voice Visit)"**.
2. Swaram listens to the natural Malayalam utterance:
   > *"ലക്ഷ്മിയെ കണ്ടു. ബിപി 130/85 ഉണ്ട്. ഭാരം 58 കിലോ. അയൺ ഗുളിക കൊടുത്തു. അടുത്ത ചെക്കപ്പ് അടുത്ത വ്യാഴാഴ്ച."*
3. Swaram's pipeline (Module 2) runs ASR and constrained entity extraction.
4. Point out the extracted results on screen:
   - **BP:** 130/85 mmHg
   - **Weight:** 58 kg
   - **Medication:** Iron-Folic Acid Tablets (30 days)
   - **Follow-up Date:** 2026-09-12
5. Explain:
   > *"Notice that the ASHA worker did not open any keyboard, did not fill out dropdowns, and did not navigate multiple sub-menus. The raw speech was converted into validated clinical data."*

### Step 3: Spoken Confirmation Gate (30 seconds)
1. Show that Swaram does **not** silently commit the data.
2. Tap **"✓ ശരിയാണ് (Confirm & Save)"**.
3. Highlight:
   > *"This satisfies our core ethical principle: No clinical record is ever filed without explicit human confirmation by the healthcare worker."*

### Step 4: Offline Proof (30 seconds)
1. Point to the top header showing **"⏳ 2 Pending Sync"**.
2. Explain:
   > *"If network connectivity is lost in the field, visits are stored in on-device SQLite with client-generated UUIDs and an idempotent sync queue. The worker is never blocked by a slow 2G connection."*

### Step 5: Government Portal Automation & Ledger Closure (60 seconds)
1. Open the Mock Government Health Portal (`http://localhost:8080`).
2. Run the Playwright automation script in `module4-reporting-priorities`:
   ```bash
   python main.py
   ```
3. Show the browser automatically filling the maternal health reporting fields using accessible labels (`getByLabel`).
4. Conclude:
   > *"The ASHA spoke once in her native language; Swaram recorded the encounter, updated the longitudinal household ledger, closed the care gap, and completed the government administrative burden for her."*
