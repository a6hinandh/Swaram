"""
Paper Register OCR & Table Parsing Service
Processes photographed paper registers, extracts tabular entries, and computes candidate match confidence.
"""

import uuid
from datetime import datetime
from typing import Dict, Any, List

class RegisterOCRService:
    @staticmethod
    def process_register_image(image_path_or_bytes: Any) -> Dict[str, Any]:
        """
        Parses an ASHA paper register page.
        Returns extracted rows with confidence scores and matching household candidates.
        """
        # Simulated extraction for testing & demo
        return {
            "batch_id": str(uuid.uuid4()),
            "image_ref": "samples/asha_register_ward4_p12.jpg",
            "processed_at": datetime.utcnow().isoformat() + "Z",
            "engine_used": "paddleocr_adapter",
            "rows": [
                {
                    "row_index": 1,
                    "confidence": 0.92,
                    "fields": {
                        "serial_no": "12",
                        "house_number": "42",
                        "head_of_household": "Lakshmi Amma",
                        "beneficiary_name": "Lakshmi",
                        "age": "26",
                        "lmp_date": "2026-01-15",
                        "immunisation_status": "TT1, TT2 completed"
                    },
                    "matched_household_id": "h-lakshmi-001",
                    "match_confidence": 0.96,
                    "review_status": "unreviewed"
                },
                {
                    "row_index": 2,
                    "confidence": 0.78,
                    "fields": {
                        "serial_no": "13",
                        "house_number": "45",
                        "head_of_household": "Suresh Kumar",
                        "beneficiary_name": "Geetha",
                        "age": "48",
                        "lmp_date": "-",
                        "immunisation_status": "N/A"
                    },
                    "matched_household_id": "h-suresh-002",
                    "match_confidence": 0.85,
                    "review_status": "unreviewed"
                }
            ]
        }
