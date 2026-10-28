from fastapi import APIRouter

from app.health.schemas import HealthResponse

router = APIRouter(tags=["health"])


# Liveness only: proves the UI-API connection, does not check the database (api-contracts.md §8)
@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="almamater-api")
