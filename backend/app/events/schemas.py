import uuid

from pydantic import AwareDatetime, StrictBool, StrictInt, StrictStr

from app.schemas import ApiModel, ApiRequest, UtcDateTime


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


# api-contracts.md §5.1 editable fields. These DTOs check syntax and types only (400);
# content rules live in app/events/service.py so every violation is reported in one 422.
class EventFieldsRequest(ApiRequest):
    title: StrictStr | None = None
    description: StrictStr | None = None
    starts_at: AwareDatetime | None = None
    speaker_name: StrictStr | None = None
    topic_id: uuid.UUID | None = None
    faculty_id: uuid.UUID | None = None
    intended_audience: StrictStr | None = None
    newcomers_welcome: StrictBool | None = None
    format: StrictStr | None = None
    venue: StrictStr | None = None
    meeting_url: StrictStr | None = None
    duration_minutes: StrictInt | None = None
    registration_deadline: AwareDatetime | None = None
    participation_method: StrictStr | None = None
    google_form_url: StrictStr | None = None
    contact_details: StrictStr | None = None
    attendance_instructions: StrictStr | None = None


# api-contracts.md §6.3
class EventCreateRequest(EventFieldsRequest):
    # Temporary until auth lands: the organisation must come from the session (backend/AGENTS.md)
    organization_id: uuid.UUID | None = None


# api-contracts.md §6.4: partial update; absent field = unchanged, explicit null = clear
class EventUpdateRequest(EventFieldsRequest):
    revision: StrictInt
