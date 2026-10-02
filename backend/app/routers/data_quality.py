from fastapi import APIRouter
from typing import Dict, Any
from app.engine.data_quality import analyze_dataset_quality

router = APIRouter(prefix="/data-quality", tags=["Data Quality"])

@router.get("", response_model=Dict[str, Any])
def get_data_quality():
    """
    Returns real-time data quality telemetry across all 6 enterprise CSV datasets.
    """
    return analyze_dataset_quality()
