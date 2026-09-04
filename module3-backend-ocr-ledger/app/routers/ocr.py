from fastapi import APIRouter, UploadFile, File
from services.ocr_service import RegisterOCRService

router = APIRouter(prefix="/api/v1/ocr", tags=["OCR Digitization"])

@router.post("/process-register")
def process_register_image(file: UploadFile = File(None)):
    """
    Accepts an uploaded image of a paper ASHA register, parses table rows,
    and returns match confidence against known households.
    """
    return RegisterOCRService.process_register_image(file)
