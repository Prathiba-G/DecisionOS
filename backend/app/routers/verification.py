from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict, Any, Optional
from app.engine.verification import verify_customer_decision

router = APIRouter(prefix="/verify", tags=["Verification"])

class VerifyRequest(BaseModel):
    customer_id: str
    proposed_claims: Optional[Dict[str, Any]] = None

@router.post("", response_model=Dict[str, Any])
def run_verification(req: VerifyRequest):
    """
    Independent verification endpoint testing traceability, conflicts, reproducibility, and completeness.
    """
    return verify_customer_decision(req.customer_id, req.proposed_claims)
