import uuid

from app.schemas import ApiModel, UtcDateTime


class EventListItem(ApiModel):
    id: uuid.UUID
    title: str
    starts_at: UtcDateTime
    organization_id: uuid.UUID
    organization_name: str
    topic_id: uuid.UUID
    faculty_id: uuid.UUID
    format: str
    event_url: str


class EventListResponse(ApiModel):
    items: list[EventListItem]


class EventDetailResponse(ApiModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    organization_name: str
    status: str
    revision: int
    title: str
    description: str
    starts_at: UtcDateTime
    speaker_name: str | None
    topic_id: uuid.UUID
    faculty_id: uuid.UUID
    intended_audience: str | None
    newcomers_welcome: bool | None
    format: str
    venue: str | None
    meeting_url: str | None
    duration_minutes: int | None
    registration_deadline: UtcDateTime | None
    participation_method: str
    google_form_url: str | None
    contact_details: str | None
    attendance_instructions: str | None
    published_at: UtcDateTime
    updated_at: UtcDateTime
    cancelled_at: UtcDateTime | None
    event_url: str
    # No sessions yet: always false until auth lands (backend/AGENTS.md)
    can_manage: bool = False
    subscribed: bool = False
