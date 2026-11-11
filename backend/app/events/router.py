import uuid
from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, Path, Query, Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.errors import ApiError
from app.events.models import Event
from app.events.schemas import EventDetailResponse, EventListResponse
from app.events.service import create_event as create_event_record
from app.events.service import list_events as list_event_records
from app.events.service import update_event as update_event_record

router = APIRouter(tags=["events"])


# api-contracts.md §6.1
@router.get("/events", response_model=EventListResponse)
def list_events(
    db: Session = Depends(get_db),
    topic_id: Annotated[list[uuid.UUID] | None, Query(alias="topicId")] = None,
    faculty_id: Annotated[list[uuid.UUID] | None, Query(alias="facultyId")] = None,
    organization_id: Annotated[list[uuid.UUID] | None, Query(alias="organizationId")] = None,
    date_from: Annotated[date | None, Query(alias="dateFrom")] = None,
    date_to: Annotated[date | None, Query(alias="dateTo")] = None,
) -> EventListResponse:
    events = list_event_records(db, topic_id, faculty_id, organization_id, date_from, date_to)
    return EventListResponse.model_validate({"items": events})


# api-contracts.md §6.2: any known event, including cancelled and past
@router.get("/events/{eventId}", response_model=EventDetailResponse)
def get_event(event_id: Annotated[uuid.UUID, Path(alias="eventId")], db: Session = Depends(get_db)) -> Event:
    event = db.get(Event, event_id)
    if event is None:
        raise ApiError(404, "EVENT_NOT_FOUND", "Event not found.")
    return event


# api-contracts.md §6.3: validate and publish
@router.post("/events", response_model=EventDetailResponse, status_code=201)
def create_event(
    response: Response,
    payload: Annotated[dict[str, Any], Body()],
    db: Session = Depends(get_db),
) -> Event:
    event = create_event_record(db, payload)
    response.headers["Location"] = f"/api/events/{event.id}"
    return event


# api-contracts.md §6.4: partial edit of a published, upcoming event with optimistic concurrency
@router.patch("/events/{eventId}", response_model=EventDetailResponse)
def update_event(
    event_id: Annotated[uuid.UUID, Path(alias="eventId")],
    payload: Annotated[dict[str, Any], Body()],
    db: Session = Depends(get_db),
) -> Event:
    return update_event_record(db, event_id, payload)
