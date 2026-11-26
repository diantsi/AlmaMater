"""US-45b / US-45c — which edits and cancellations queue emails (database-schema.md §3.6–3.7, D-10, A-17).

The outbox row is the email: the worker sends exactly the rows written here (see test_notifications_worker.py).
"""

from datetime import UTC, datetime

import pytest
from sqlalchemy import select

from app.auth.models import User
from app.notifications.models import EventSubscription, NotificationDelivery
from tests.conftest import (
    make_event,
    make_faculty,
    make_organization,
    make_topic,
    make_user,
    new_client,
    sign_in,
)


@pytest.fixture
def refs(db, manager_org):
    # manager_client is signed in with manager_org's registered address
    return manager_org, make_topic(db), make_faculty(db)


def _subscriber(db, event) -> User:
    """A member who subscribed through the API (US-45a)."""
    user = make_user(db)
    member = new_client()
    sign_in(member, db, user)
    assert member.put(f"/api/events/{event.id}/subscription").status_code == 200
    return user


def _deliveries(db, event) -> list[NotificationDelivery]:
    return list(
        db.scalars(
            select(NotificationDelivery)
            .where(NotificationDelivery.event_id == event.id)
            .order_by(NotificationDelivery.event_revision, NotificationDelivery.recipient_email)
        )
    )


def _subscriber_ids(db, event) -> set:
    return set(db.scalars(select(EventSubscription.user_id).where(EventSubscription.event_id == event.id)))


# --- US-45b AC1: a valid change of a D-10 field emails each subscriber ------

TRIGGER_EDITS = {
    "start": {"startsAt": "2099-03-01T18:00:00+02:00"},
    "venue": {"venue": "New room"},
    "format": {"format": "ONLINE", "venue": None, "meetingUrl": "https://meet.example/x"},
    "method": {
        "participationMethod": "GOOGLE_FORM",
        "attendanceInstructions": None,
        "googleFormUrl": "https://forms.example/x",
    },
    "method_field": {"attendanceInstructions": "Bring your student ID"},
}


@pytest.mark.parametrize("edit", TRIGGER_EDITS.values(), ids=TRIGGER_EDITS.keys())
def test_trigger_field_change_queues_one_email_per_subscriber(manager_client, db, refs, edit):
    event = make_event(db, *refs)
    first, second = _subscriber(db, event), _subscriber(db, event)
    make_user(db)  # a member who never subscribed

    response = manager_client.patch(f"/api/events/{event.id}", json={"revision": 1, **edit})

    assert response.status_code == 200
    deliveries = _deliveries(db, event)
    assert {(d.user_id, d.recipient_email) for d in deliveries} == {
        (first.id, first.email),
        (second.id, second.email),
    }
    for delivery in deliveries:
        assert (delivery.kind, delivery.status, delivery.event_revision) == ("CHANGED", "PENDING", 2)
        assert (delivery.attempts, delivery.sent_at) == (0, None)
    # An edit keeps the subscriptions
    assert _subscriber_ids(db, event) == {first.id, second.id}


def test_each_committed_change_queues_its_own_email(manager_client, db, refs):
    event = make_event(db, *refs)
    subscriber = _subscriber(db, event)

    manager_client.patch(f"/api/events/{event.id}", json={"revision": 1, "venue": "Room A"})
    manager_client.patch(f"/api/events/{event.id}", json={"revision": 2, "venue": "Room B"})

    assert [(d.event_revision, d.user_id) for d in _deliveries(db, event)] == [(2, subscriber.id), (3, subscriber.id)]


# --- US-45b AC2: rejected edits and non-subscribers get nothing -------------


def test_change_without_subscribers_queues_nothing(manager_client, db, refs):
    event = make_event(db, *refs)

    response = manager_client.patch(f"/api/events/{event.id}", json={"revision": 1, "venue": "New room"})

    assert response.status_code == 200
    assert _deliveries(db, event) == []


@pytest.mark.parametrize(
    ("body", "status", "code"),
    [
        ({"revision": 1, "venue": "   "}, 422, "VALIDATION_ERROR"),
        ({"revision": 1, "startsAt": "2000-01-01T10:00:00+02:00"}, 422, "VALIDATION_ERROR"),
        ({"revision": 7, "venue": "New room"}, 409, "EVENT_REVISION_CONFLICT"),
        ({"revision": 1, "venue": "New room", "organizationId": "x"}, 400, "MALFORMED_REQUEST"),
    ],
    ids=["blank-venue", "past-start", "stale-revision", "unknown-field"],
)
def test_rejected_edit_queues_nothing(manager_client, db, refs, body, status, code):
    event = make_event(db, *refs)
    _subscriber(db, event)

    response = manager_client.patch(f"/api/events/{event.id}", json=body)

    assert (response.status_code, response.json()["code"]) == (status, code)
    assert _deliveries(db, event) == []
    db.refresh(event)
    assert (event.venue, event.revision) == ("Test room", 1)


def test_edit_by_other_organisation_queues_nothing(client, db, refs):
    event = make_event(db, *refs)
    _subscriber(db, event)
    other_org = make_organization(db)
    sign_in(client, db, make_user(db, email=other_org.registered_email))

    response = client.patch(f"/api/events/{event.id}", json={"revision": 1, "venue": "Hijacked"})

    assert response.status_code == 403
    assert _deliveries(db, event) == []


# --- US-45b AC3: other fields, or no effective change, notify nobody --------

NON_TRIGGER_EDITS = {
    "title": {"title": "New title"},
    "description": {"description": "New description"},
    "speaker": {"speakerName": "New speaker"},
    "duration": {"durationMinutes": 90},
    "audience": {"intendedAudience": "First-year students"},
    "newcomers": {"newcomersWelcome": False},
    "deadline": {"registrationDeadline": "2099-01-01T10:00:00+02:00"},
}


@pytest.mark.parametrize("edit", NON_TRIGGER_EDITS.values(), ids=NON_TRIGGER_EDITS.keys())
def test_other_field_change_queues_nothing(manager_client, db, refs, edit):
    event = make_event(db, *refs, starts_at=datetime(2099, 6, 1, 12, 0, tzinfo=UTC))
    _subscriber(db, event)

    response = manager_client.patch(f"/api/events/{event.id}", json={"revision": 1, **edit})

    # The edit itself was applied (revision bumped), yet no email is queued
    assert response.status_code == 200
    assert response.json()["revision"] == 2
    assert _deliveries(db, event) == []


def test_trigger_field_set_to_same_value_queues_nothing(manager_client, db, refs):
    event = make_event(db, *refs)
    _subscriber(db, event)

    response = manager_client.patch(f"/api/events/{event.id}", json={"revision": 1, "venue": " Test room "})

    assert response.status_code == 200
    assert response.json()["revision"] == 1
    assert _deliveries(db, event) == []


# --- US-45c AC1: cancelling emails every subscriber, then ends subscriptions -


def test_cancel_queues_cancellation_email_and_ends_subscriptions(manager_client, db, refs):
    event = make_event(db, *refs)
    first, second = _subscriber(db, event), _subscriber(db, event)

    response = manager_client.post(f"/api/events/{event.id}/cancel")

    assert response.status_code == 200
    deliveries = _deliveries(db, event)
    assert {d.user_id for d in deliveries} == {first.id, second.id}
    for delivery in deliveries:
        assert (delivery.kind, delivery.status, delivery.event_revision) == ("CANCELLED", "PENDING", 2)
    assert _subscriber_ids(db, event) == set()


def test_unsubscribed_member_gets_no_cancellation_email(manager_client, db, refs):
    # US-45a AC2: no further notifications after unsubscribing
    event = make_event(db, *refs)
    stays = _subscriber(db, event)
    leaves_user = make_user(db)
    leaves = new_client()
    sign_in(leaves, db, leaves_user)
    leaves.put(f"/api/events/{event.id}/subscription")
    leaves.delete(f"/api/events/{event.id}/subscription")

    manager_client.post(f"/api/events/{event.id}/cancel")

    assert [d.user_id for d in _deliveries(db, event)] == [stays.id]


# --- US-45c AC2: repeated or unauthorised cancellation emails nobody --------


def test_repeated_cancel_queues_no_second_email(manager_client, db, refs):
    event = make_event(db, *refs)
    subscriber = _subscriber(db, event)
    manager_client.post(f"/api/events/{event.id}/cancel")

    response = manager_client.post(f"/api/events/{event.id}/cancel")

    assert response.status_code == 409
    assert [(d.kind, d.user_id) for d in _deliveries(db, event)] == [("CANCELLED", subscriber.id)]


def test_unauthorised_cancel_queues_nothing_and_keeps_subscriptions(client, db, refs):
    event = make_event(db, *refs)
    subscriber = _subscriber(db, event)
    other_org = make_organization(db)
    sign_in(client, db, make_user(db, email=other_org.registered_email))

    response = client.post(f"/api/events/{event.id}/cancel")

    assert response.status_code == 403
    assert _deliveries(db, event) == []
    assert _subscriber_ids(db, event) == {subscriber.id}
