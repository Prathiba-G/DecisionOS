from fastapi import APIRouter
from typing import Dict, Any
from app.engine.evaluation import get_latest_evaluation, run_evaluation_suite

router = APIRouter(prefix="/evaluation", tags=["Evaluation Lab"])

@router.get("", response_model=Dict[str, Any])
def get_evaluation():
    """
    Returns latest empirical evaluation run.
    """
    return get_latest_evaluation()

@router.post("/run", response_model=Dict[str, Any])
def execute_evaluation():
    """
    Executes live evaluation test suite and records metrics.
    """
    return run_evaluation_suite()
