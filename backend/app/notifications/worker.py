"""Outbox worker (ADR-007, database-schema.md §3.7): `python -m app.notifications.worker`.

Claims due deliveries in a short transaction, sends each email outside it, then records the result.
"""

import logging
import time
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.events.models import Event
from app.notifications import mailer
from app.notifications.emails import render
from app.notifications.models import DeliveryStatus, NotificationDelivery

logger = logging.getLogger("app.notifications.worker")

POLL_SECONDS = 5
BATCH_SIZE = 20
CLAIM_DURATION = timedelta(minutes=5)
# The mailbox accepts about 30 messages per minute
SEND_INTERVAL_SECONDS = 2
# Wait after failed attempts 1-4; the 5th failure marks the delivery FAILED
RETRY_DELAYS = (timedelta(minutes=1), timedelta(minutes=5), timedelta(minutes=15), timedelta(hours=1))
MAX_ATTEMPTS = len(RETRY_DELAYS) + 1


def claim(db: Session, now: datetime) -> list[uuid.UUID]:
    due = or_(
        and_(NotificationDelivery.status == DeliveryStatus.PENDING, NotificationDelivery.next_attempt_at <= now),
        # A worker that crashed mid-send leaves SENDING rows whose claim expires
        and_(NotificationDelivery.status == DeliveryStatus.SENDING, NotificationDelivery.claimed_until < now),
    )
    rows = db.scalars(
        select(NotificationDelivery)
        .where(due)
        .order_by(NotificationDelivery.next_attempt_at, NotificationDelivery.created_at)
        .limit(BATCH_SIZE)
        .with_for_update(skip_locked=True)
    ).all()
    claimed = []
    for row in rows:
        if row.attempts >= MAX_ATTEMPTS:
            row.status = DeliveryStatus.FAILED.value
            row.claimed_until = None
            row.last_error = "Claim expired after the last attempt."
            continue
        row.status = DeliveryStatus.SENDING.value
        row.claimed_until = now + CLAIM_DURATION
        row.attempts += 1
        claimed.append(row.id)
    db.commit()
    return claimed


def deliver(delivery_id: uuid.UUID) -> float | None:
    """Send one claimed delivery; returns seconds Graph asked to pause, if any."""
    # Any error with this one email becomes a normal retry, so it never crashes the worker or delays the batch
    error: Exception | None = None
    try:
        with SessionLocal() as db:
            delivery = db.get(NotificationDelivery, delivery_id)
            subject, body = render(delivery.kind, db.get(Event, delivery.event_id))
            recipient = delivery.recipient_email
        # Network call outside any transaction
        mailer.send(recipient, subject, body)
    except mailer.MailError as exc:
        error = exc
    except Exception as exc:
        logger.exception("Unexpected error with email %s", delivery_id)
        error = exc
    retry_after = getattr(error, "retry_after", None)

    with SessionLocal() as db:
        delivery = db.get(NotificationDelivery, delivery_id)
        now = datetime.now(UTC)
        delivery.claimed_until = None
        if error is None:
            delivery.status = DeliveryStatus.SENT.value
            delivery.sent_at = now
            logger.info("Sent %s email %s (event %s)", delivery.kind, delivery.id, delivery.event_id)
        elif delivery.attempts >= MAX_ATTEMPTS:
            delivery.status = DeliveryStatus.FAILED.value
            delivery.last_error = str(error)
            logger.error("Email %s failed for good: %s", delivery.id, error)
        else:
            delay = RETRY_DELAYS[delivery.attempts - 1]
            if retry_after:
                delay = max(delay, timedelta(seconds=retry_after))
            delivery.status = DeliveryStatus.PENDING.value
            delivery.next_attempt_at = now + delay
            delivery.last_error = str(error)
            logger.warning("Email %s attempt %d failed, retry in %s: %s", delivery.id, delivery.attempts, delay, error)
        db.commit()
    return retry_after


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    logger.info("Notification worker started")
    while True:
        with SessionLocal() as db:
            claimed = claim(db, datetime.now(UTC))
        if not claimed:
            time.sleep(POLL_SECONDS)
            continue
        for delivery_id in claimed:
            pause = deliver(delivery_id)
            time.sleep(max(SEND_INTERVAL_SECONDS, pause or 0))


if __name__ == "__main__":
    main()
