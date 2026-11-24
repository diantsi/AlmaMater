import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DeliveryKind(StrEnum):
    CHANGED = "CHANGED"
    CANCELLED = "CANCELLED"


class DeliveryStatus(StrEnum):
    PENDING = "PENDING"
    SENDING = "SENDING"
    SENT = "SENT"
    FAILED = "FAILED"


def _in(column: str, enum: type[StrEnum]) -> str:
    return f"{column} IN ({', '.join(repr(member.value) for member in enum)})"


# database-schema.md §3.6
class EventSubscription(Base):
    __tablename__ = "event_subscriptions"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), primary_key=True)
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id"), primary_key=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


# database-schema.md §3.7: the outbox (ADR-007), one row per email
class NotificationDelivery(Base):
    __tablename__ = "notification_deliveries"
    __table_args__ = (
        CheckConstraint(_in("kind", DeliveryKind), name="ck_notification_deliveries_kind"),
        CheckConstraint(_in("status", DeliveryStatus), name="ck_notification_deliveries_status"),
        # A retried save or repeated cancel never queues a second email for the same change (NFR-21)
        UniqueConstraint("event_id", "event_revision", "kind", "user_id"),
        Index("ix_notification_deliveries_status_next_attempt_at", "status", "next_attempt_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id"))
    event_revision: Mapped[int] = mapped_column(Integer)
    kind: Mapped[str] = mapped_column(String(16))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    recipient_email: Mapped[str] = mapped_column(String(320))
    status: Mapped[str] = mapped_column(String(16))
    attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    next_attempt_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    claimed_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
