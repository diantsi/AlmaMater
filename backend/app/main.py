from fastapi import FastAPI

from app.health.router import router as health_router

app = FastAPI(title="AlmaMater API")

app.include_router(health_router, prefix="/api")
