from datetime import UTC, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, PlainSerializer
from pydantic.alias_generators import to_camel


def _to_utc_iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


# API date-times are RFC 3339 in UTC with a "Z" suffix (api-contracts.md §2)
UtcDateTime = Annotated[datetime, PlainSerializer(_to_utc_iso, return_type=str)]


class ApiModel(BaseModel):
    """Base for response DTOs: camelCase JSON, built from ORM objects."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class ApiRequest(BaseModel):
    """Base for request DTOs: camelCase JSON only; unknown or immutable keys are rejected (400)."""

    model_config = ConfigDict(alias_generator=to_camel, extra="forbid")
