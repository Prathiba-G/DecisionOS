from fastapi import APIRouter
from app.schemas import SimulateRequest
from app.engine.simulator import run_simulation
from app.config import settings

router = APIRouter(prefix="/simulate", tags=["simulator"])

@router.post("")
def simulate_scenario(payload: SimulateRequest = None):
    """
    Executes deterministic scenario simulations across the portfolio.
    Calculates recoverable value, intervention costs, net benefit, and ROI.
    """
    target_count = payload.target_count if payload and payload.target_count else 10
    cost_per_account = payload.cost_per_account if payload and payload.cost_per_account else settings.DEFAULT_INTERVENTION_COST_PER_ACCOUNT
    recovery_rate = payload.recovery_rate if payload and payload.recovery_rate else settings.DEFAULT_ESTIMATED_RECOVERY_RATE
    custom_ids = payload.custom_customer_ids if payload else None
    
    return run_simulation(
        target_count=target_count,
        cost_per_account=cost_per_account,
        recovery_rate=recovery_rate,
        custom_customer_ids=custom_ids
    )
