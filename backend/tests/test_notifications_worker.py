"""US-45b / US-45c — the email a subscriber actually receives (api-contracts.md §6.8, ADR-007).

Runs the real outbox worker (`claim` + `deliver`) and the real templates inside the test transaction; only the
Microsoft Graph transport is replaced.
"""

from contextlib import nullcontext
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.auth.models import User
from app.config import settings
from app.notifications import mailer, worker
from app.notifications.models import NotificationDelivery
from tests.conftest import (
    make_event,
    make_faculty,
    make_topic,
    make_user,
    new_client,
    sign_in,
)


@pytest.fixture
def refs(db, manager_org):
    # manager_client is signed in with manager_org's registered address
    return manager_org, make_topic(db), make_faculty(db)


@pytest.fixture
def run_worker(db, monkeypatch):
    """Runs one worker pass over one event's deliveries using the test session (rolled back afterwards)."""
    monkeypatch.setattr(worker, "SessionLocal", lambda: nullcontext(db))

    def run(event) -> list[NotificationDelivery]:
        ours = set(db.scalars(select(NotificationDelivery.id).where(NotificationDelivery.event_id == event.id)))
        claimed = worker.claim(db, datetime.now(UTC))
        for delivery_id in claimed:
            if delivery_id in ours:
                worker.deliver(delivery_id)
        rows = db.scalars(select(NotificationDelivery).where(NotificationDelivery.id.in_(ours))).all()
        for row in rows:
            db.refresh(row)
        return list(rows)

    return run


@pytest.fixture
def sent(monkeypatch) -> list[tuple[str, str, str]]:
    """Records outgoing emails instead of calling Microsoft Graph."""
    outbox: list[tuple[str, str, str]] = []
    monkeypatch.setattr(mailer, "send", lambda to, subject, body: outbox.append((to, subject, body)))
    return outbox


def _subscriber(db, event) -> User:
    user = make_user(db)
    member = new_client()
    sign_in(member, db, user)
    assert member.put(f"/api/events/{event.id}/subscription").status_code == 200
    return user


def _event_link(event) -> str:
    return f"{settings.app_public_url.rstrip('/')}/events/{event.id}"


# --- US-45b AC1: change email identifies the event and links to updated details


def test_change_email_reaches_subscriber_with_updated_details(manager_client, db, refs, run_worker, sent):
    event = make_event(db, *refs, title="Data science meetup")
    subscriber = _subscriber(db, event)
    response = manager_client.patch(
        f"/api/events/{event.id}", json={"revision": 1, "startsAt": "2099-03-01T18:00:00+02:00"}
    )
    assert response.status_code == 200

    (delivery,) = run_worker(event)

    assert len(sent) == 1
    to, subject, body = sent[0]
    assert to == subscriber.email
    assert subject == "Зміни в події «Data science meetup»"
    assert "01.03.2099, 18:00" in body  # the new start, in Kyiv time
    assert _event_link(event) in body
    assert (delivery.status, delivery.attempts, delivery.last_error) == ("SENT", 1, None)
    assert delivery.sent_at is not None and delivery.claimed_until is None


# --- US-45c AC1: cancellation email identifies the event and says it is cancelled


def test_cancellation_email_states_event_is_cancelled(manager_client, db, refs, run_worker, sent):
    event = make_event(db, *refs, title="Chess evening", starts_at=datetime(2099, 7, 10, 15, 30, tzinfo=UTC))
    subscriber = _subscriber(db, event)
    assert manager_client.post(f"/api/events/{event.id}/cancel").status_code == 200

    (delivery,) = run_worker(event)

    assert [(to, subject) for to, subject, _ in sent] == [(subscriber.email, "Подію «Chess evening» скасовано")]
    body = sent[0][2]
    assert "скасували подію «Chess evening»" in body
    assert "10.07.2099, 18:30" in body  # summer time: UTC+3
    assert _event_link(event) in body
    assert delivery.status == "SENT"


def test_each_subscriber_gets_a_separate_email(manager_client, db, refs, run_worker, sent):
    event = make_event(db, *refs)
    first, second = _subscriber(db, event), _subscriber(db, event)
    manager_client.post(f"/api/events/{event.id}/cancel")

    run_worker(event)

    assert sorted(to for to, _, _ in sent) == sorted([first.email, second.email])
    for to, _, body in sent:
        other = second.email if to == first.email else first.email
        assert other not in body


def test_graph_message_has_only_the_subscriber_as_recipient(manager_client, db, refs, run_worker, monkeypatch):
    # §6.8: never reveals other recipients; the real `mailer.send` runs with Graph itself stubbed
    calls = []

    class Accepted:
        status_code = 202

    monkeypatch.setattr(settings, "mail_dry_run", False)
    monkeypatch.setattr(mailer, "_access_token", lambda: "test-token")
    monkeypatch.setattr(mailer.requests, "post", lambda url, **kwargs: calls.append(kwargs["json"]) or Accepted())
    event = make_event(db, *refs)
    subscriber = _subscriber(db, event)
    manager_client.post(f"/api/events/{event.id}/cancel")

    (delivery,) = run_worker(event)

    assert len(calls) == 1
    assert calls[0]["message"]["toRecipients"] == [{"emailAddress": {"address": subscriber.email}}]
    assert "ccRecipients" not in calls[0]["message"] and "bccRecipients" not in calls[0]["message"]
    assert delivery.status == "SENT"


# --- Delivery failures never lose the email (NFR-20) ------------------------


def test_failed_send_is_retried_later(manager_client, db, refs, run_worker, monkeypatch):
    def fail(to, subject, body):
        raise mailer.MailError("Graph sendMail returned 503")

    monkeypatch.setattr(mailer, "send", fail)
    event = make_event(db, *refs)
    _subscriber(db, event)
    response = manager_client.post(f"/api/events/{event.id}/cancel")
    before = datetime.now(UTC)

    (delivery,) = run_worker(event)

    assert response.status_code == 200  # the committed cancellation is not affected
    assert (delivery.status, delivery.attempts) == ("PENDING", 1)
    assert delivery.last_error == "Graph sendMail returned 503"
    assert timedelta(minutes=1) <= delivery.next_attempt_at - before < timedelta(minutes=2)
    # Not due yet: an immediate second pass does not resend it
    assert delivery.id not in worker.claim(db, datetime.now(UTC))


def test_fifth_failure_marks_delivery_failed(manager_client, db, refs, run_worker, monkeypatch):
    def fail(to, subject, body):
        raise mailer.MailError("mailbox unavailable")

    monkeypatch.setattr(mailer, "send", fail)
    event = make_event(db, *refs)
    _subscriber(db, event)
    manager_client.post(f"/api/events/{event.id}/cancel")
    (delivery,) = db.scalars(select(NotificationDelivery).where(NotificationDelivery.event_id == event.id)).all()
    delivery.attempts = worker.MAX_ATTEMPTS - 1
    db.flush()

    (delivery,) = run_worker(event)

    assert (delivery.status, delivery.attempts) == ("FAILED", worker.MAX_ATTEMPTS)
    assert delivery.last_error == "mailbox unavailable"
