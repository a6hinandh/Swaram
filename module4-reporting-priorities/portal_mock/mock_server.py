"""
Controlled Mock Government Health Portal Server
Runs on port 8080 to simulate RCH / ANMOL / State health reporting portals for Playwright automation.
"""

from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
import os

app = FastAPI(title="Mock Government Health Portal")
template_dir = os.path.join(os.path.dirname(__file__), "templates")
templates = Jinja2Templates(directory=template_dir)

# Recorded submissions
SUBMISSIONS = []

@app.get("/", response_class=HTMLResponse)
def get_form(request: Request):
    return templates.TemplateResponse("form.html", {"request": request})

@app.post("/submit-form")
def submit_form(
    beneficiary_name: str = Form(...),
    gestational_weeks: int = Form(None),
    systolic_bp: int = Form(None),
    diastolic_bp: int = Form(None),
    ifa_tablets: str = Form("none"),
    follow_up_date: str = Form(None)
):
    submission = {
        "beneficiary_name": beneficiary_name,
        "gestational_weeks": gestational_weeks,
        "systolic_bp": systolic_bp,
        "diastolic_bp": diastolic_bp,
        "ifa_tablets": ifa_tablets,
        "follow_up_date": follow_up_date,
        "ack_id": f"GOV-ACK-2026-{len(SUBMISSIONS) + 1001}"
    }
    SUBMISSIONS.append(submission)
    return {
        "status": "success",
        "message": "Record successfully filed in Government Portal",
        "acknowledgement": submission["ack_id"],
        "data": submission
    }

@app.get("/api/submissions")
def list_submissions():
    return SUBMISSIONS

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("mock_server:app", host="0.0.0.0", port=8080, reload=True)
