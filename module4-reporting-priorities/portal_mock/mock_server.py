"""
Controlled Mock Health Department Portal Server (Swaram Gateway)
Runs on port 8080 to simulate official health reporting portals for Playwright automation.
"""

from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
import os
from datetime import datetime

app = FastAPI(title="Swaram Central Health Reporting Gateway")
template_dir = os.path.join(os.path.dirname(__file__), "templates")
templates = Jinja2Templates(directory=template_dir)

# Recorded submissions
SUBMISSIONS = []

@app.get("/", response_class=HTMLResponse)
def get_form(request: Request):
    return templates.TemplateResponse(request=request, name="form.html", context={"submissions_count": len(SUBMISSIONS)})

@app.post("/submit-form")
def submit_form(
    request: Request,
    beneficiary_name: str = Form(...),
    gestational_weeks: int = Form(None),
    systolic_bp: int = Form(None),
    diastolic_bp: int = Form(None),
    ifa_tablets: str = Form("none"),
    dietary_diversity: str = Form(None),
    muac_reading: str = Form(None),
    malnutrition_risk: str = Form(None),
    follow_up_date: str = Form(None)
):
    timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    submission = {
        "beneficiary_name": beneficiary_name,
        "gestational_weeks": gestational_weeks,
        "systolic_bp": systolic_bp,
        "diastolic_bp": diastolic_bp,
        "ifa_tablets": ifa_tablets,
        "dietary_diversity": dietary_diversity or "Not Screened",
        "muac_reading": muac_reading or "Not Measured",
        "malnutrition_risk": malnutrition_risk or "Normal",
        "follow_up_date": follow_up_date,
        "timestamp": timestamp_str,
        "ack_id": f"SWARAM-ACK-2026-{len(SUBMISSIONS) + 1001}"
    }
    SUBMISSIONS.append(submission)

    accept = request.headers.get("accept", "")
    if "text/html" in accept or "application/x-www-form-urlencoded" in request.headers.get("content-type", ""):
        return templates.TemplateResponse(request=request, name="receipt.html", context={"submission": submission})

    return {
        "status": "success",
        "message": "Record successfully filed in Central Health Department Gateway",
        "acknowledgement": submission["ack_id"],
        "data": submission
    }

@app.get("/api/submissions")
def list_submissions():
    return SUBMISSIONS

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("mock_server:app", host="0.0.0.0", port=8080, reload=True)
