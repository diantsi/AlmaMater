import uuid
from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, Path, Query, Response
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthContext, require_csrf, require_member
from app.auth.service import managed_organization
from app.db.session import get_db
from app.errors import ApiError
from app.events.models import Event
from app.events.schemas import EventDetailResponse, EventListResponse
from app.events.service import create_event as create_event_record
from app.events.service import list_events as list_event_records
from app.events.service import update_event as update_event_record
from app.organisations.models import Organization

# Members only (api-contracts.md §2): the session is checked before IDs or bodies, so 401 comes first
router = APIRouter(tags=["events"], dependencies=[Depends(require_member)])


def _detail(event: Event, organization: Organization | None) -> EventDetailResponse:
    # canManage drives the edit and cancel actions (D-02)
    can_manage = organization is not None and event.organization_id == organization.id
    return EventDetailResponse.model_validate(event).model_copy(update={"can_manage": can_manage})


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
def get_event(
    event_id: Annotated[uuid.UUID, Path(alias="eventId")],
    auth: AuthContext = Depends(require_member),
    db: Session = Depends(get_db),
) -> EventDetailResponse:
    event = db.get(Event, event_id)
    if event is None:
        raise ApiError(404, "EVENT_NOT_FOUND", "Event not found.")
    return _detail(event, managed_organization(db, auth.user))


# api-contracts.md §6.3: validate and publish as the session's organisation (US-03, US-07, US-39)
@router.post("/events", response_model=EventDetailResponse, status_code=201)
def create_event(
    response: Response,
    payload: Annotated[dict[str, Any], Body()],
    auth: AuthContext = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> EventDetailResponse:
    organization = managed_organization(db, auth.user)
    if organization is None:
        raise ApiError(403, "ORGANIZATION_ACCESS_DENIED", "Only a registered organisation address can publish events.")
    event = create_event_record(db, payload, organization, auth.user)
    response.headers["Location"] = f"/api/events/{event.id}"
    return _detail(event, organization)


# api-contracts.md §6.4: partial edit of a published, upcoming event with optimistic concurrency
@router.patch("/events/{eventId}", response_model=EventDetailResponse)
def update_event(
    event_id: Annotated[uuid.UUID, Path(alias="eventId")],
    payload: Annotated[dict[str, Any], Body()],
    auth: AuthContext = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> EventDetailResponse:
    organization = managed_organization(db, auth.user)
    event = update_event_record(db, event_id, payload, organization.id if organization else None)
    return _detail(event, organization)
