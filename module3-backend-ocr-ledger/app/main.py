"""
Module 3: Household Data, OCR & Care Ledger Server
Canonical persistence, offline sync queue, OCR digitization, and care ledger API.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import households, visits, sync, care_ledger, ocr, encounters, environmental, vitals, auth
from db.database import db

app = FastAPI(
    title="Swaram Backend & Care Ledger (Module 3)",
    version="2.0.0",
    description="Canonical Data Persistence, Longitudinal Vitals Baselines, Offline Sync, OCR Ingestion, and Care Ledger"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register sub-routers
app.include_router(auth.router)
app.include_router(households.router)
app.include_router(visits.router)
app.include_router(vitals.router)
app.include_router(encounters.router)
app.include_router(environmental.router)
app.include_router(sync.router)
app.include_router(care_ledger.router)
app.include_router(ocr.router)

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "module3-backend-ocr-ledger",
        "version": "1.0.0",
        "database": "mongodb_atlas" if db is not None else "in_memory_fallback"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
