import logging

from fastapi import FastAPI

from app.dictionaries.router import router as dictionaries_router
from app.errors import register_error_handlers
from app.events.router import router as events_router
from app.health.router import router as health_router
from app.organisations.router import router as organisations_router

# Without a root handler Python drops INFO records, including error requestIds (api-contracts.md §7)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

app = FastAPI(title="AlmaMater API")

register_error_handlers(app)

app.include_router(health_router, prefix="/api")
app.include_router(organisations_router, prefix="/api")
app.include_router(dictionaries_router, prefix="/api")
app.include_router(events_router, prefix="/api")
