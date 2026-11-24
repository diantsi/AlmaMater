from collections import Counter
from typing import Annotated

from pydantic import (
    AfterValidator,
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StrictInt,
    StringConstraints,
    model_validator,
)

from app.auth.service import UNIVERSITY_DOMAIN

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


def _duplicates(values: list[str]) -> set[str]:
    return {value for value, count in Counter(values).items() if count > 1}


def _university_email(value: str) -> str:
    # A bare login such as "o.skoromnov" means the university address
    if "@" not in value:
        value = f"{value.strip()}@{UNIVERSITY_DOMAIN}"
    value = _lower_email(value)
    if value.partition("@")[2] != UNIVERSITY_DOMAIN:
        raise ValueError(f"must be an @{UNIVERSITY_DOMAIN} address (only those can sign in)")
    return value


UniversityEmail = Annotated[str, Field(max_length=300), AfterValidator(_university_email)]


# Development-only organiser toggle (make seed / make switch-org), not part of the organisation register
class OrganiserAccount(SeedModel):
    email: UniversityEmail
    is_org: bool


# database-schema.md §3.5 editable fields (api-contracts.md §5.1); content rules are checked by
# app.events.service.validate_event at seed time. The publisher is the user whose email is
# `organization_email`, which must also be that organisation's registered address (C-02).
class EventSeed(SeedModel):
    organization_email: Annotated[str, Field(max_length=320), AfterValidator(_lower_email)]
    topic_code: NonBlank
    faculty_code: NonBlank
    title: NonBlank
    description: NonBlank
    starts_at: AwareDatetime
    speaker_name: NonBlank | None = None
    intended_audience: NonBlank | None = None
    newcomers_welcome: StrictBool | None = None
    format: NonBlank
    venue: NonBlank | None = None
    meeting_url: NonBlank | None = None
    duration_minutes: StrictInt | None = None
    registration_deadline: AwareDatetime | None = None
    participation_method: NonBlank
    google_form_url: NonBlank | None = None
    contact_details: NonBlank | None = None
    attendance_instructions: NonBlank | None = None


class SeedFile(SeedModel):
    """Seed data; organisations, topics and faculties are upserted by their natural key.

    `accounts` are dev-only organiser toggles (each `is_org` is applied). Events are inserted once per
    (organization_email, title) and only when that address has an organisation and a signed-in user
    (created_by_user_id); otherwise they are skipped.
    """

    organizations: list[OrganizationSeed] = []
    topics: list[DictionarySeed] = []
    faculties: list[DictionarySeed] = []
    accounts: list[OrganiserAccount] = []
    events: list[EventSeed] = []

    @model_validator(mode="after")
    def _unique_keys(self) -> "SeedFile":
        checks = {
            "organizations.slug": [org.slug for org in self.organizations],
            "organizations.registered_email": [org.registered_email for org in self.organizations],
            "topics.code": [topic.code for topic in self.topics],
            "faculties.code": [faculty.code for faculty in self.faculties],
            "accounts.email": [account.email for account in self.accounts],
            "events.(organization_email, title)": [
                f"{event.organization_email} / {event.title}" for event in self.events
            ],
        }
        for field, values in checks.items():
            if duplicates := _duplicates(values):
                raise ValueError(f"duplicate {field}: {', '.join(sorted(duplicates))}")
        return self
