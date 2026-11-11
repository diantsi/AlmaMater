import uuid
from collections import Counter
from typing import Annotated

from pydantic import (
    AfterValidator,
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    model_validator,
)

from app.events.models import EventFormat, EventStatus, ParticipationMethod

NonBlank = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


def _lower_email(value: str) -> str:
    value = value.strip().lower()
    local, _, domain = value.partition("@")
    if not local or not domain or "@" in domain:
        raise ValueError("must be an email address")
    return value


class SeedModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


# database-schema.md §3.3
class OrganizationSeed(SeedModel):
    name: Annotated[NonBlank, Field(max_length=160)]
    slug: Annotated[NonBlank, Field(max_length=100)]
    registered_email: Annotated[str, Field(max_length=320), AfterValidator(_lower_email)]


# database-schema.md §3.4
class DictionarySeed(SeedModel):
    code: Annotated[NonBlank, Field(max_length=64)]
    name: Annotated[NonBlank, Field(max_length=160)]


def _https_url(value: str) -> str:
    value = value.strip()
    if not value.lower().startswith("https://") or len(value) <= len("https://"):
        raise ValueError("must be an https:// URL")
    return value


HttpsUrl = Annotated[str, AfterValidator(_https_url)]
OptionalText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)] | None


# database-schema.md §3.5 and its conditional integrity constraints; refs use natural keys
class EventSeed(SeedModel):
    model_config = ConfigDict(extra="forbid", use_enum_values=True)

    id: uuid.UUID
    organization: NonBlank = Field(description="organizations.slug")
    topic: NonBlank = Field(description="topics.code")
    faculty: NonBlank = Field(description="faculties.code")
    status: EventStatus = EventStatus.PUBLISHED
    title: Annotated[NonBlank, Field(max_length=160)]
    description: NonBlank
    starts_at: AwareDatetime
    speaker_name: Annotated[OptionalText, Field(max_length=160)] = None
    intended_audience: OptionalText = None
    newcomers_welcome: bool | None = None
    format: EventFormat
    venue: Annotated[OptionalText, Field(max_length=500)] = None
    meeting_url: HttpsUrl | None = None
    duration_minutes: Annotated[int, Field(gt=0)] | None = None
    registration_deadline: AwareDatetime | None = None
    participation_method: ParticipationMethod
    google_form_url: HttpsUrl | None = None
    contact_details: OptionalText = None
    attendance_instructions: OptionalText = None
    cancelled_at: AwareDatetime | None = None

    @model_validator(mode="after")
    def _conditional_fields(self) -> "EventSeed":
        location = {EventFormat.ONLINE: "meeting_url", EventFormat.IN_PERSON: "venue"}
        _exactly_one(self, location, self.format, "format")
        method = {
            ParticipationMethod.GOOGLE_FORM: "google_form_url",
            ParticipationMethod.DIRECT_CONTACT: "contact_details",
            ParticipationMethod.OPEN_ATTENDANCE: "attendance_instructions",
        }
        _exactly_one(self, method, self.participation_method, "participation_method")
        if self.registration_deadline and self.registration_deadline > self.starts_at:
            raise ValueError("registration_deadline must not be after starts_at")
        if (self.status == EventStatus.CANCELLED) != (self.cancelled_at is not None):
            raise ValueError("cancelled_at is required for CANCELLED and forbidden for PUBLISHED")
        return self


def _exactly_one(event: EventSeed, fields: dict, selected: str, selector: str) -> None:
    for value, field in fields.items():
        filled = getattr(event, field) is not None
        if filled != (value == selected):
            raise ValueError(f"{selector}={selected} requires {fields[selected]} and no other of {sorted(fields.values())}")


def _duplicates(values: list[str]) -> set[str]:
    return {value for value, count in Counter(values).items() if count > 1}


class SeedFile(SeedModel):
    """Team-supplied reference data; rows are upserted by their natural key."""

    organizations: list[OrganizationSeed] = []
    topics: list[DictionarySeed] = []
    faculties: list[DictionarySeed] = []
    events: list[EventSeed] = []

    @model_validator(mode="after")
    def _unique_keys(self) -> "SeedFile":
        checks = {
            "organizations.slug": [org.slug for org in self.organizations],
            "organizations.registered_email": [org.registered_email for org in self.organizations],
            "topics.code": [topic.code for topic in self.topics],
            "faculties.code": [faculty.code for faculty in self.faculties],
            "events.id": [str(event.id) for event in self.events],
        }
        for field, values in checks.items():
            if duplicates := _duplicates(values):
                raise ValueError(f"duplicate {field}: {', '.join(sorted(duplicates))}")
        return self
