import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.organisations.models import Organization


class EventStatus(StrEnum):
    PUBLISHED = "PUBLISHED"
    CANCELLED = "CANCELLED"


class EventFormat(StrEnum):
    ONLINE = "ONLINE"
    IN_PERSON = "IN_PERSON"


class ParticipationMethod(StrEnum):
    GOOGLE_FORM = "GOOGLE_FORM"
    DIRECT_CONTACT = "DIRECT_CONTACT"
    OPEN_ATTENDANCE = "OPEN_ATTENDANCE"


def _in(column: str, enum: type[StrEnum]) -> str:
    return f"{column} IN ({', '.join(repr(member.value) for member in enum)})"


def _filled(column: str) -> str:
    return f"({column} IS NOT NULL AND btrim({column}) <> '')"


# database-schema.md §3.5 minus created_by_user_id / cancelled_by_user_id (no users yet, see backend/AGENTS.md)
class Event(Base):
    __tablename__ = "events"
    __table_args__ = (
        CheckConstraint(_in("status", EventStatus), name="ck_events_status"),
        CheckConstraint("revision >= 1", name="ck_events_revision"),
        CheckConstraint(_in("format", EventFormat), name="ck_events_format"),
        CheckConstraint("duration_minutes > 0", name="ck_events_duration_minutes"),
        CheckConstraint(_in("participation_method", ParticipationMethod), name="ck_events_participation_method"),
        CheckConstraint(
            f"(format = 'ONLINE' AND {_filled('meeting_url')} AND venue IS NULL)"
            f" OR (format = 'IN_PERSON' AND {_filled('venue')} AND meeting_url IS NULL)",
            name="ck_events_format_location",
        ),
        CheckConstraint(
            f"(participation_method = 'GOOGLE_FORM' AND {_filled('google_form_url')}"
            " AND contact_details IS NULL AND attendance_instructions IS NULL)"
            f" OR (participation_method = 'DIRECT_CONTACT' AND {_filled('contact_details')}"
            " AND google_form_url IS NULL AND attendance_instructions IS NULL)"
            f" OR (participation_method = 'OPEN_ATTENDANCE' AND {_filled('attendance_instructions')}"
            " AND google_form_url IS NULL AND contact_details IS NULL)",
            name="ck_events_participation_fields",
        ),
        CheckConstraint("registration_deadline <= starts_at", name="ck_events_registration_deadline"),
        CheckConstraint(
            "(status = 'PUBLISHED' AND cancelled_at IS NULL) OR (status = 'CANCELLED' AND cancelled_at IS NOT NULL)",
            name="ck_events_cancellation",
        ),
        Index("ix_events_status_starts_at", "status", "starts_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="RESTRICT"), index=True
    )
    status: Mapped[str] = mapped_column(String(16))
    revision: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    speaker_name: Mapped[str | None] = mapped_column(String(160))
    topic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("topics.id", ondelete="RESTRICT"), index=True)
    faculty_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("faculties.id", ondelete="RESTRICT"), index=True)
    intended_audience: Mapped[str | None] = mapped_column(Text)
    newcomers_welcome: Mapped[bool | None] = mapped_column(Boolean)
    format: Mapped[str] = mapped_column(String(16))
    venue: Mapped[str | None] = mapped_column(String(500))
    meeting_url: Mapped[str | None] = mapped_column(Text)
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    registration_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    participation_method: Mapped[str] = mapped_column(String(24))
    google_form_url: Mapped[str | None] = mapped_column(Text)
    contact_details: Mapped[str | None] = mapped_column(Text)
    attendance_instructions: Mapped[str | None] = mapped_column(Text)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    organization: Mapped[Organization] = relationship(lazy="joined")

    @property
    def organization_name(self) -> str:
        return self.organization.name

    @property
    def event_url(self) -> str:
        return f"/events/{self.id}"
