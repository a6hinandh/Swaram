"""
ASHA Worker Authentication Router
Module 3 Backend Service
Provides:
- POST /api/v1/auth/login: Mock login endpoint with demo ASHA credentials
- GET /api/v1/auth/me: Active worker profile inquiry
"""

from fastapi import APIRouter, HTTPException, status
from models.schemas import (
    LoginRequestSchema,
    LoginResponseSchema,
    AshaWorkerProfileSchema
)

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication & Roles"])

DEMO_ASHA_WORKER = AshaWorkerProfileSchema(
    worker_id="w-asha-001",
    username="asha_ward4",
    name="അനിത നായർ (Anitha Nair)",
    role="asha_worker",
    ward="വാർഡ് 4, ആലുവ (Ward 4, Aluva)",
    phone="+91 94471 23456",
    sub_centre="കീഴ്മാട് സബ് സെന്റർ (Keezhmad Sub-Centre)"
)

# Accepted demo credentials
ACCEPTED_CREDENTIALS = {
    "asha_ward4": "swaram2026",
    "demo_asha": "password123",
    "asha_aluva": "swaram123"
}

@router.post("/login", response_model=LoginResponseSchema)
def login(credentials: LoginRequestSchema):
    """
    Authenticates an ASHA Worker using demo credentials.
    Supports primary demo account 'asha_ward4' / 'swaram2026'.
    """
    uname = credentials.username.strip().lower()
    pwd = credentials.password.strip()

    valid = False
    if uname in ACCEPTED_CREDENTIALS and ACCEPTED_CREDENTIALS[uname] == pwd:
        valid = True
    elif uname == "asha_ward4" and pwd in ["swaram2026", "password123", "swaram123"]:
        valid = True
    elif uname.startswith("asha") and pwd in ["swaram2026", "password123", "swaram123"]:
        valid = True

    if not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password. Please use demo credentials displayed on the page."
        )

    return LoginResponseSchema(
        status="authenticated",
        access_token=f"swaram-mock-token-{uname}-2026",
        token_type="bearer",
        user=DEMO_ASHA_WORKER
    )

@router.get("/me", response_model=AshaWorkerProfileSchema)
def get_current_user():
    """Returns the active ASHA worker profile."""
    return DEMO_ASHA_WORKER
