from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict, Any, Optional
from app.engine.simulation import run_what_if_simulation

router = APIRouter(prefix="/simulate", tags=["Simulation"])

class SimulationRequest(BaseModel):
    top_n: Optional[int] = 10
    intervention_cost_per_account: Optional[float] = None
    recovery_rate: Optional[float] = None

@router.post("", response_model=Dict[str, Any])
def simulate_scenarios(req: Optional[SimulationRequest] = None):
    """
    Executes what-if scenario simulations with deterministic financial calculations.
    """
    top_n = req.top_n if req and req.top_n is not None else 10
    cost = req.intervention_cost_per_account if req else None
    rec_rate = req.recovery_rate if req else None
    return run_what_if_simulation(top_n=top_n, intervention_cost_per_account=cost, recovery_rate=rec_rate)
