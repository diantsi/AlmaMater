import uuid
from datetime import date, datetime, time, timedelta
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.errors import ApiError, ErrorDetail
from app.events.models import Event, EventStatus
from app.events.schemas import EventDetailResponse, EventListResponse

router = APIRouter(tags=["events"])

# Calendar dates are whole days in Europe/Kyiv (database-schema.md C-06)
KYIV = ZoneInfo("Europe/Kyiv")


def _start_of_day(day: date) -> datetime:
    return datetime.combine(day, time.min, tzinfo=KYIV)


# api-contracts.md §6.1: active upcoming events; OR within a filter, AND between filters
@router.get("/events", response_model=EventListResponse)
def list_events(
    db: Session = Depends(get_db),
    topic_id: Annotated[list[uuid.UUID] | None, Query(alias="topicId")] = None,
    faculty_id: Annotated[list[uuid.UUID] | None, Query(alias="facultyId")] = None,
    organization_id: Annotated[list[uuid.UUID] | None, Query(alias="organizationId")] = None,
    date_from: Annotated[date | None, Query(alias="dateFrom")] = None,
    date_to: Annotated[date | None, Query(alias="dateTo")] = None,
) -> EventListResponse:
    if date_from and date_to and date_from > date_to:
        raise ApiError(
            422,
            "VALIDATION_ERROR",
            "Filter is invalid.",
            [ErrorDetail(field="dateTo", message="End date must not be before start date.")],
        )

    query = select(Event).where(Event.status == EventStatus.PUBLISHED, Event.starts_at > func.now())
    if topic_id:
        query = query.where(Event.topic_id.in_(topic_id))
    if faculty_id:
        query = query.where(Event.faculty_id.in_(faculty_id))
    if organization_id:
        query = query.where(Event.organization_id.in_(organization_id))
    if date_from:
        query = query.where(Event.starts_at >= _start_of_day(date_from))
    if date_to:
        query = query.where(Event.starts_at < _start_of_day(date_to + timedelta(days=1)))

    events = db.scalars(query.order_by(Event.starts_at, Event.id)).all()
    return EventListResponse.model_validate({"items": events})


# api-contracts.md §6.2: any known event, including cancelled and past
@router.get("/events/{eventId}", response_model=EventDetailResponse)
def get_event(event_id: Annotated[uuid.UUID, Path(alias="eventId")], db: Session = Depends(get_db)) -> Event:
    event = db.get(Event, event_id)
    if event is None:
        raise ApiError(404, "EVENT_NOT_FOUND", "Event not found.")
    return event
