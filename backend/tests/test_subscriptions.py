"""US-45a — Subscribe to event updates (api-contracts.md §6.6, §6.7, database-schema.md §3.6)."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.auth.models import User
from app.notifications.models import EventSubscription
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
def event(db):
    return make_event(db, make_organization(db), make_topic(db), make_faculty(db))


@pytest.fixture
def member(db) -> User:
    return make_user(db)


@pytest.fixture
def member_client(client, db, member):
    """Signed in as `member`, CSRF header set (conftest's member_client does not expose its user)."""
    sign_in(client, db, member)
    return client


def _subscriptions(db, event, user=None) -> int:
    query = select(func.count()).select_from(EventSubscription).where(EventSubscription.event_id == event.id)
    if user is not None:
        query = query.where(EventSubscription.user_id == user.id)
    return db.scalar(query)


def _subscribed_flag(client, event) -> bool:
    response = client.get(f"/api/events/{event.id}")
    assert response.status_code == 200
    return response.json()["subscribed"]


# --- AC1: member subscribes to an active published event ------------------


def test_subscribe_to_active_event(member_client, db, event):
    assert _subscribed_flag(member_client, event) is False

    response = member_client.put(f"/api/events/{event.id}/subscription")

    assert response.status_code == 200
    assert response.json() == {"eventId": str(event.id), "subscribed": True}
    assert _subscriptions(db, event) == 1
    assert _subscribed_flag(member_client, event) is True


def test_subscribe_twice_keeps_one_subscription(member_client, db, event):
    first = member_client.put(f"/api/events/{event.id}/subscription")
    second = member_client.put(f"/api/events/{event.id}/subscription")

    assert [first.status_code, second.status_code] == [200, 200]
    assert second.json()["subscribed"] is True
    assert _subscriptions(db, event) == 1


def test_subscribed_flag_is_per_member(member_client, db, event):
    other = new_client()
    sign_in(other, db, make_user(db))

    member_client.put(f"/api/events/{event.id}/subscription")

    assert _subscribed_flag(member_client, event) is True
    assert _subscribed_flag(other, event) is False


# --- AC2: selecting the button again ends the subscription ----------------


def test_unsubscribe_ends_subscription(member_client, db, event):
    member_client.put(f"/api/events/{event.id}/subscription")

    response = member_client.delete(f"/api/events/{event.id}/subscription")

    assert response.status_code == 204
    assert response.content == b""
    assert _subscriptions(db, event) == 0
    assert _subscribed_flag(member_client, event) is False


def test_unsubscribe_without_subscription_is_204(member_client, db, event):
    response = member_client.delete(f"/api/events/{event.id}/subscription")

    assert response.status_code == 204
    assert _subscriptions(db, event) == 0


def test_unsubscribe_keeps_other_members_subscriptions(member_client, member, db, event):
    other = new_client()
    other_user = make_user(db)
    sign_in(other, db, other_user)
    member_client.put(f"/api/events/{event.id}/subscription")
    other.put(f"/api/events/{event.id}/subscription")

    member_client.delete(f"/api/events/{event.id}/subscription")

    assert _subscriptions(db, event, member) == 0
    assert _subscriptions(db, event, other_user) == 1


# --- AC3: cancelled or past events offer no subscription ------------------


@pytest.mark.parametrize(
    "overrides",
    [
        {"status": "CANCELLED", "cancelled_at": datetime(2026, 1, 1, tzinfo=UTC), "revision": 2},
        {"starts_at": datetime.now(UTC) - timedelta(minutes=1)},
    ],
    ids=["cancelled", "past"],
)
def test_subscribe_to_cancelled_or_past_event_is_409(member_client, db, overrides):
    event = make_event(db, make_organization(db), make_topic(db), make_faculty(db), **overrides)

    response = member_client.put(f"/api/events/{event.id}/subscription")

    assert response.status_code == 409
    assert response.json()["code"] == "EVENT_NOT_SUBSCRIBABLE"
    assert _subscriptions(db, event) == 0


# --- Access and malformed requests -----------------------------------------


@pytest.mark.parametrize("method", ["put", "delete"])
def test_subscription_without_session_is_401(client, db, event, method):
    response = getattr(client, method)(f"/api/events/{event.id}/subscription")

    assert response.status_code == 401
    assert response.json()["code"] == "NOT_AUTHENTICATED"
    assert _subscriptions(db, event) == 0


@pytest.mark.parametrize("method", ["put", "delete"])
@pytest.mark.parametrize("csrf", [None, "wrong-token"])
def test_subscription_without_valid_csrf_is_403(member_client, member, db, event, method, csrf):
    db.add(EventSubscription(user_id=member.id, event_id=event.id, created_at=datetime.now(UTC)))
    db.flush()
    member_client.headers.pop("X-CSRF-Token")
    headers = {"X-CSRF-Token": csrf} if csrf else {}

    response = getattr(member_client, method)(f"/api/events/{event.id}/subscription", headers=headers)

    assert response.status_code == 403
    assert response.json()["code"] == "INVALID_CSRF_TOKEN"
    # Neither a new subscription nor an unsubscribe happened
    assert _subscriptions(db, event, member) == 1


@pytest.mark.parametrize("method", ["put", "delete"])
def test_subscription_unknown_event_is_404(member_client, method):
    response = getattr(member_client, method)(f"/api/events/{uuid.uuid4()}/subscription")

    assert response.status_code == 404
    assert response.json()["code"] == "EVENT_NOT_FOUND"


@pytest.mark.parametrize("method", ["put", "delete"])
def test_subscription_malformed_id_is_400(member_client, method):
    response = getattr(member_client, method)("/api/events/not-a-uuid/subscription")

    assert response.status_code == 400
    assert response.json()["code"] == "MALFORMED_REQUEST"
