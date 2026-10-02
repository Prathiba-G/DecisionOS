import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = BASE_DIR / "decisionos.db"

load_dotenv(BASE_DIR / ".env")

class Settings:
    PROJECT_NAME: str = "DecisionOS"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api"
    
    # Deterministic Scoring Weights (Total must equal 1.0)
    WEIGHT_ACV: float = float(os.getenv("WEIGHT_ACV", "0.25"))
    WEIGHT_PURCHASE_DECLINE: float = float(os.getenv("WEIGHT_PURCHASE_DECLINE", "0.25"))
    WEIGHT_INACTIVITY: float = float(os.getenv("WEIGHT_INACTIVITY", "0.20"))
    WEIGHT_SUPPORT_ISSUES: float = float(os.getenv("WEIGHT_SUPPORT_ISSUES", "0.20"))
    WEIGHT_ENGAGEMENT_DECLINE: float = float(os.getenv("WEIGHT_ENGAGEMENT_DECLINE", "0.10"))
    
    # Priority Thresholds
    HIGH_PRIORITY_THRESHOLD: float = float(os.getenv("HIGH_PRIORITY_THRESHOLD", "65.0"))
    MEDIUM_PRIORITY_THRESHOLD: float = float(os.getenv("MEDIUM_PRIORITY_THRESHOLD", "40.0"))
    
    # What-If Simulation Defaults
    DEFAULT_INTERVENTION_COST_PER_ACCOUNT: float = 1200.0  # $1,200 standard CS retention intervention
    DEFAULT_ESTIMATED_RECOVERY_RATE: float = 0.45          # 45% recoverable contract value
    
    # LLM Settings
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "fallback")  # "gemini", "openai", or "fallback"
    LLM_API_KEY: str = os.getenv("GEMINI_API_KEY", os.getenv("LLM_API_KEY", ""))
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gemini-2.5-flash")

    @property
    def SARVAM_APP_ID(self) -> Optional[str]:
        return os.getenv("SARVAM_APP_ID") or None

    @property
    def SARVAM_API_KEY(self) -> Optional[str]:
        return os.getenv("SARVAM_API_KEY") or None

    @property
    def SARVAM_ORG_ID(self) -> Optional[str]:
        return os.getenv("SARVAM_ORG_ID") or None

    @property
    def SARVAM_WORKSPACE_ID(self) -> Optional[str]:
        return os.getenv("SARVAM_WORKSPACE_ID") or None

    @property
    def SARVAM_APP_VERSION(self) -> Optional[str]:
        return os.getenv("SARVAM_APP_VERSION") or None

    @property
    def SARVAM_CONNECTION_ID(self) -> Optional[str]:
        return os.getenv("SARVAM_CONNECTION_ID") or None

    @property
    def SARVAM_AGENT_PHONE_NUMBER(self) -> Optional[str]:
        return os.getenv("SARVAM_AGENT_PHONE_NUMBER") or None

    @property
    def SARVAM_WEBHOOK_URL(self) -> Optional[str]:
        return os.getenv("SARVAM_WEBHOOK_URL") or None

    @property
    def SARVAM_REQUIRED_AGENT_VARIABLES(self) -> str:
        return os.getenv("SARVAM_REQUIRED_AGENT_VARIABLES", "")

settings = Settings()
