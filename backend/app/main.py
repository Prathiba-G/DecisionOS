from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import settings
from app.database import init_db
from app.seed_data import generate_seed_datasets
from app.routers import (
    dashboard,
    decisions,
    evidence,
    simulation,
    verification,
    evaluation,
    data_quality,
    demo
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure seed data and database exist
    generate_seed_datasets()
    init_db(force_reload=False)
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="DecisionOS: Evidence-backed AI Decision Intelligence API",
    lifespan=lifespan
)

# Enable CORS for local Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health endpoint
@app.get("/api/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "llm_provider": settings.LLM_PROVIDER,
        "llm_model": settings.LLM_MODEL,
        "deterministic_engine": "online",
        "verification_engine": "online"
    }

# Include routers
app.include_router(dashboard.router, prefix="/api")
app.include_router(decisions.router, prefix="/api")
app.include_router(decisions.sarvam_webhook_router, prefix="/api")
app.include_router(evidence.router, prefix="/api")
app.include_router(simulation.router, prefix="/api")
app.include_router(verification.router, prefix="/api")
app.include_router(evaluation.router, prefix="/api")
app.include_router(data_quality.router, prefix="/api")
app.include_router(demo.router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
