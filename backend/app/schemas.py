from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class QueryRequest(BaseModel):
    question: str
    target_customer_id: Optional[str] = None
    force_fallback: Optional[bool] = False

class SimulateRequest(BaseModel):
    target_count: Optional[int] = 10
    cost_per_account: Optional[float] = 1200.0
    recovery_rate: Optional[float] = 0.45
    custom_customer_ids: Optional[List[str]] = None

class VerifyRequest(BaseModel):
    customer_id: str

class ApprovalActionRequest(BaseModel):
    reviewer_note: Optional[str] = ""

class HealthResponse(BaseModel):
    status: str
    version: str
    project: str
    llm_provider: str
    database_connected: bool
    total_customers: int
