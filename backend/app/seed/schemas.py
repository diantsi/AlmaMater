from collections import Counter
from typing import Annotated

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    model_validator,
)

from app.auth.service import UNIVERSITY_DOMAIN

NonBlank =Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


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


# Development-only organiser toggle (make seed org / make switch-org), not part of the organisation register
class OrganiserAccount(SeedModel):
    email: UniversityEmail
    is_org: bool


class OrganiserFile(SeedModel):
    accounts: list[OrganiserAccount] = []

    @model_validator(mode="after")
    def _unique_emails(self) -> "OrganiserFile":
        if duplicates := _duplicates([account.email for account in self.accounts]):
            raise ValueError(f"duplicate accounts.email: {', '.join(sorted(duplicates))}")
        return self


class SeedFile(SeedModel):
    """Team-supplied reference data; rows are upserted by their natural key.

    Events are not seeded: every event needs the signed-in user who published it (created_by_user_id).
    """

    organizations: list[OrganizationSeed] = []
    topics: list[DictionarySeed] = []
    faculties: list[DictionarySeed] = []

    @model_validator(mode="after")
    def _unique_keys(self) -> "SeedFile":
        checks = {
            "organizations.slug": [org.slug for org in self.organizations],
            "organizations.registered_email": [org.registered_email for org in self.organizations],
            "topics.code": [topic.code for topic in self.topics],
            "faculties.code": [faculty.code for faculty in self.faculties],
        }
        for field, values in checks.items():
            if duplicates := _duplicates(values):
                raise ValueError(f"duplicate {field}: {', '.join(sorted(duplicates))}")
        return self
