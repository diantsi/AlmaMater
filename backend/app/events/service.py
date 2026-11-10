import uuid
from datetime import UTC, datetime
from typing import Any, TypeVar
from urllib.parse import urlsplit

from pydantic import BaseModel, ValidationError
from pydantic.alias_generators import to_camel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dictionaries.models import Faculty, Topic
from app.errors import ApiError, ErrorDetail
from app.events.models import Event, EventFormat, EventStatus, ParticipationMethod
from app.events.schemas import EventCreateRequest, EventFieldsRequest, EventUpdateRequest
from app.organisations.models import Organization

RequestModel = TypeVar("RequestModel", bound=BaseModel)

EDITABLE_FIELDS = tuple(EventFieldsRequest.model_fields)

# database-schema.md §3.5 column lengths; None = unbounded TEXT
REQUIRED_TEXT = {"title": 160, "description": None}
OPTIONAL_TEXT = {
    "speaker_name": 160,
    "intended_audience": None,
    "venue": 500,
    "meeting_url": None,
    "google_form_url": None,
    "contact_details": None,
    "attendance_instructions": None,
}
HTTPS_FIELDS = {"meeting_url", "google_form_url"}
LOCATION_FIELDS = {EventFormat.ONLINE: "meeting_url", EventFormat.IN_PERSON: "venue"}
METHOD_FIELDS = {
    ParticipationMethod.GOOGLE_FORM: "google_form_url",
    ParticipationMethod.DIRECT_CONTACT: "contact_details",
    ParticipationMethod.OPEN_ATTENDANCE: "attendance_instructions",
}


def parse_body(model: type[RequestModel], payload: dict[str, Any]) -> RequestModel:
    """Syntax/type check of a JSON body; failures are 400 MALFORMED_REQUEST (api-contracts.md §7)."""
    try:
        return model.model_validate(payload)
    except ValidationError as exc:
        details = [
            ErrorDetail(field=".".join(str(part) for part in err["loc"]), message=err["msg"]) for err in exc.errors()
        ]
        raise ApiError(400, "MALFORMED_REQUEST", "Request is malformed.", details) from exc


def _normalise(values: dict[str, Any]) -> dict[str, Any]:
    # Text is trimmed before validation, comparison and storage (database-schema.md §3.5 rule 6, §3.7)
    return {key: value.strip() if isinstance(value, str) else value for key, value in values.items()}


def _is_https_url(value: str) -> bool:
    parts = urlsplit(value)
    return parts.scheme.lower() == "https" and bool(parts.netloc) and not any(ch.isspace() for ch in value)


def _validate_exclusive(state: dict, selector: str, fields: dict, add) -> None:
    selected = state.get(selector)
    if selected is None:
        add(selector, "Field is required.")
        return
    if selected not in {member.value for member in fields}:
        add(selector, f"Must be one of: {', '.join(member.value for member in fields)}.")
        return
    for value, field in fields.items():
        if value == selected and state.get(field) is None:
            add(field, f"Required when {to_camel(selector)} is {selected}.")
        elif value != selected and state.get(field) is not None:
            add(field, f"Must be null when {to_camel(selector)} is {selected}.")


def validate_event(db: Session, state: dict[str, Any], now: datetime) -> list[ErrorDetail]:
    """Content rules on the complete (merged) event: database-schema.md §3.5 rules 1-3, 5-7 and §5."""
    errors: list[ErrorDetail] = []

    def add(field: str, message: str) -> None:
        errors.append(ErrorDetail(field=to_camel(field), message=message))

    for field, max_length in REQUIRED_TEXT.items():
        value = state.get(field)
        if not value:
            add(field, "Field is required.")
        elif max_length and len(value) > max_length:
            add(field, f"Must be at most {max_length} characters.")

    for field, max_length in OPTIONAL_TEXT.items():
        value = state.get(field)
        if value is None:
            continue
        if not value:
            add(field, "Must not be blank.")
        elif max_length and len(value) > max_length:
            add(field, f"Must be at most {max_length} characters.")
        elif field in HTTPS_FIELDS and not _is_https_url(value):
            add(field, "Must be a well-formed https:// URL.")

    starts_at = state.get("starts_at")
    if starts_at is None:
        add("starts_at", "Field is required.")
    elif starts_at <= now:
        add("starts_at", "Start must be in the future.")

    deadline = state.get("registration_deadline")
    if starts_at is not None and deadline is not None and deadline > starts_at:
        add("registration_deadline", "Registration deadline must not be after the start.")

    duration = state.get("duration_minutes")
    if duration is not None and duration <= 0:
        add("duration_minutes", "Must be greater than zero.")

    for field, model in (("topic_id", Topic), ("faculty_id", Faculty)):
        ref = state.get(field)
        if ref is None:
            add(field, "Field is required.")
        elif db.get(model, ref) is None:
            add(field, "Unknown identifier.")

    _validate_exclusive(state, "format", LOCATION_FIELDS, add)
    _validate_exclusive(state, "participation_method", METHOD_FIELDS, add)
    return errors


def _invalid(errors: list[ErrorDetail]) -> ApiError:
    return ApiError(422, "VALIDATION_ERROR", "Event data is invalid.", errors)


# api-contracts.md §6.3: validate everything, insert only if the whole input is valid
def create_event(db: Session, payload: dict[str, Any]) -> Event:
    request = parse_body(EventCreateRequest, payload)
    now = datetime.now(UTC)
    state = _normalise(request.model_dump(include=set(EDITABLE_FIELDS)))

    errors: list[ErrorDetail] = []
    if request.organization_id is None:
        errors.append(ErrorDetail(field="organizationId", message="Field is required."))
    elif db.get(Organization, request.organization_id) is None:
        errors.append(ErrorDetail(field="organizationId", message="Unknown identifier."))
    errors += validate_event(db, state, now)
    if errors:
        raise _invalid(errors)

    event = Event(
        **state,
        organization_id=request.organization_id,
        status=EventStatus.PUBLISHED.value,
        revision=1,
        published_at=now,
        updated_at=now,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


# api-contracts.md §6.4 / database-schema.md §4: lifecycle, optimistic concurrency, merged validation
def update_event(db: Session, event_id: uuid.UUID, payload: dict[str, Any]) -> Event:
    request = parse_body(EventUpdateRequest, payload)
    changed_fields = request.model_fields_set - {"revision"}
    if not changed_fields:
        raise ApiError(400, "MALFORMED_REQUEST", "Request must contain at least one editable field.")

    event = db.scalars(select(Event).where(Event.id == event_id).with_for_update(of=Event)).first()
    if event is None:
        raise ApiError(404, "EVENT_NOT_FOUND", "Event not found.")

    now = datetime.now(UTC)
    if event.status == EventStatus.CANCELLED or event.starts_at <= now:
        raise ApiError(409, "EVENT_NOT_EDITABLE", "Cancelled or past events cannot be edited.")
    if request.revision != event.revision:
        raise ApiError(409, "EVENT_REVISION_CONFLICT", "Event was changed by someone else; reload it.")

    current = {field: getattr(event, field) for field in EDITABLE_FIELDS}
    patch = _normalise(request.model_dump(include=changed_fields))
    errors = validate_event(db, {**current, **patch}, now)
    if errors:
        raise _invalid(errors)

    effective = {field: value for field, value in patch.items() if value != current[field]}
    if not effective:
        # No effective change: revision is not incremented (database-schema.md §3.7); commit releases the lock
        db.commit()
        return event

    for field, value in effective.items():
        setattr(event, field, value)
    event.revision += 1
    event.updated_at = now
    db.commit()
    db.refresh(event)
    return event
