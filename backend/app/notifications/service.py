import uuid
from datetime import datetime
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.auth.models import User
from app.errors import ApiError
from app.events.models import Event, EventStatus
from app.notifications.models import (
    DeliveryKind,
    DeliveryStatus,
    EventSubscription,
    NotificationDelivery,
)

# D-10 / database-schema.md §3.7: only these edits email subscribers. A field of an unselected
# participation method is always null, so it can only change together with participation_method.
CHANGE_EMAIL_FIELDS = frozenset(
    {
        "starts_at",
        "format",
        "venue",
        "meeting_url",
        "participation_method",
        "google_form_url",
        "contact_details",
        "attendance_instructions",
    }
)


def queue_deliveries(db: Session, event: Event, kind: DeliveryKind, now: datetime) -> None:
    """One PENDING row per current subscriber, in the caller's transaction (C-08); the caller commits."""
    subscribers = db.execute(
        select(User.id, User.email)
        .join(EventSubscription, EventSubscription.user_id == User.id)
        .where(EventSubscription.event_id == event.id)
    ).all()
    if not subscribers:
        return
    rows = [
        {
            "id": uuid.uuid4(),
            "event_id": event.id,
            "event_revision": event.revision,
            "kind": kind.value,
            "user_id": user_id,
            "recipient_email": email,
            "status": DeliveryStatus.PENDING.value,
            "attempts": 0,
            "next_attempt_at": now,
            "created_at": now,
        }
        for user_id, email in subscribers
    ]
    db.execute(
        insert(NotificationDelivery)
        .values(rows)
        .on_conflict_do_nothing(index_elements=["event_id", "event_revision", "kind", "user_id"])
    )


def delete_subscriptions(db: Session, event_id: uuid.UUID) -> None:
    db.execute(delete(EventSubscription).where(EventSubscription.event_id == event_id))


def is_subscribed(db: Session, event_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    return db.get(EventSubscription, (user_id, event_id)) is not None


# api-contracts.md §6.6: idempotent; only PUBLISHED upcoming events (US-45a AC3)
def subscribe(db: Session, event_id: uuid.UUID, user: User, now: datetime) -> None:
    # FOR SHARE: a concurrent cancel (FOR UPDATE) cannot slip in between the check and the insert
    event = db.scalars(select(Event).where(Event.id == event_id).with_for_update(read=True, of=Event)).first()
    if event is None:
        raise ApiError(404, "EVENT_NOT_FOUND", "Event not found.")
    if event.status == EventStatus.CANCELLED or event.starts_at <= now:
        raise ApiError(409, "EVENT_NOT_SUBSCRIBABLE", "Cancelled or past events cannot be subscribed to.")
    db.execute(
        insert(EventSubscription)
        .values(user_id=user.id, event_id=event.id, created_at=now)
        .on_conflict_do_nothing(index_elements=["user_id", "event_id"])
    )
    db.commit()


# api-contracts.md §6.7: idempotent; 204 also when no subscription exists
def unsubscribe(db: Session, event_id: uuid.UUID, user: User) -> None:
    if db.get(Event, event_id) is None:
        raise ApiError(404, "EVENT_NOT_FOUND", "Event not found.")
    db.execute(
        delete(EventSubscription).where(EventSubscription.event_id == event_id, EventSubscription.user_id == user.id)
    )
    db.commit()
