"""US-44b — Cancel a published event (api-contracts.md §6.5, database-schema.md §4)."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.auth.models import User
from tests.conftest import (
    make_event,
    make_faculty,
    make_organization,
    make_topic,
    make_user,
    sign_in,
)


@pytest.fixture
def refs(db, manager_org):
    # manager_client is signed in with manager_org's registered address
    return manager_org, make_topic(db), make_faculty(db)


def _manager(db, org) -> User:
    return db.scalars(select(User).where(User.email == org.registered_email)).one()


def _catalog_ids(client, org) -> list[str]:
    response = client.get("/api/events", params={"organizationId": str(org.id)})
    assert response.status_code == 200
    return [item["id"] for item in response.json()["items"]]


def _assert_unchanged(db, event, status="PUBLISHED", revision=1):
    db.refresh(event)
    assert (event.status, event.revision) == (status, revision)
    if status == "PUBLISHED":
        assert event.cancelled_at is None and event.cancelled_by_user_id is None


# --- AC1: an authorised organiser cancels an active published event ---------


@pytest.mark.parametrize("starts_in", [timedelta(days=7), timedelta(minutes=5)])
def test_cancel_takes_event_out_of_catalog(manager_client, db, refs, starts_in):
    org = refs[0]
    event = make_event(db, *refs, starts_at=datetime.now(UTC) + starts_in)
    assert _catalog_ids(manager_client, org) == [str(event.id)]

    response = manager_client.post(f"/api/events/{event.id}/cancel")

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"id", "status", "revision", "cancelledAt", "eventUrl"}
    assert body["id"] == str(event.id)
    assert body["status"] == "CANCELLED"
    assert body["revision"] == 2
    assert body["eventUrl"] == f"/events/{event.id}"
    assert body["cancelledAt"].endswith("Z")
    db.refresh(event)
    assert event.status == "CANCELLED"
    assert event.cancelled_at is not None
    assert event.cancelled_by_user_id == _manager(db, org).id
    # Students no longer see it as an active upcoming event
    assert _catalog_ids(manager_client, org) == []


def test_cancelled_event_url_keeps_resolving(manager_client, db, refs):
    event = make_event(db, *refs)
    cancelled = manager_client.post(f"/api/events/{event.id}/cancel").json()

    response = manager_client.get(f"/api/events/{event.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "CANCELLED"
    assert body["cancelledAt"] == cancelled["cancelledAt"]
    assert body["revision"] == 2


# --- AC2: unauthorised or already cancelled → no invalid state change -------


def test_cancel_already_cancelled_is_409_without_change(manager_client, db, refs):
    event = make_event(db, *refs)
    first = manager_client.post(f"/api/events/{event.id}/cancel")
    db.refresh(event)
    cancelled_at = event.cancelled_at

    second = manager_client.post(f"/api/events/{event.id}/cancel")

    assert first.status_code == 200
    assert second.status_code == 409
    assert second.json()["code"] == "EVENT_ALREADY_CANCELLED"
    _assert_unchanged(db, event, status="CANCELLED", revision=2)
    assert event.cancelled_at == cancelled_at


def test_cancel_past_event_is_409(manager_client, db, refs):
    event = make_event(db, *refs, starts_at=datetime.now(UTC) - timedelta(minutes=1))

    response = manager_client.post(f"/api/events/{event.id}/cancel")

    assert response.status_code == 409
    assert response.json()["code"] == "EVENT_NOT_EDITABLE"
    _assert_unchanged(db, event)


def test_cancel_by_member_without_organisation_is_403(client, db, refs):
    event = make_event(db, *refs)
    sign_in(client, db, make_user(db))

    response = client.post(f"/api/events/{event.id}/cancel")

    assert response.status_code == 403
    assert response.json()["code"] == "ORGANIZATION_ACCESS_DENIED"
    _assert_unchanged(db, event)


def test_cancel_by_other_organisation_is_403(client, db, refs):
    event = make_event(db, *refs)
    other_org = make_organization(db)
    sign_in(client, db, make_user(db, email=other_org.registered_email))

    response = client.post(f"/api/events/{event.id}/cancel")

    assert response.status_code == 403
    assert response.json()["code"] == "ORGANIZATION_ACCESS_DENIED"
    _assert_unchanged(db, event)


def test_other_organisation_gets_403_before_already_cancelled(client, db, refs):
    # §6.5 order: 403 ORGANIZATION_ACCESS_DENIED precedes 409, so the event's state is not revealed
    event = make_event(db, *refs, status="CANCELLED", cancelled_at=datetime(2026, 1, 1, tzinfo=UTC), revision=2)
    other_org = make_organization(db)
    sign_in(client, db, make_user(db, email=other_org.registered_email))

    response = client.post(f"/api/events/{event.id}/cancel")

    assert response.status_code == 403
    assert response.json()["code"] == "ORGANIZATION_ACCESS_DENIED"


def test_cancel_without_session_is_401(client, db, refs):
    event = make_event(db, *refs)

    response = client.post(f"/api/events/{event.id}/cancel")

    assert response.status_code == 401
    assert response.json()["code"] == "NOT_AUTHENTICATED"
    _assert_unchanged(db, event)


@pytest.mark.parametrize("csrf", [None, "wrong-token"])
def test_cancel_without_valid_csrf_is_403(manager_client, db, refs, csrf):
    event = make_event(db, *refs)
    manager_client.headers.pop("X-CSRF-Token")
    headers = {"X-CSRF-Token": csrf} if csrf else {}

    response = manager_client.post(f"/api/events/{event.id}/cancel", headers=headers)

    assert response.status_code == 403
    assert response.json()["code"] == "INVALID_CSRF_TOKEN"
    _assert_unchanged(db, event)


def test_cancel_unknown_event_is_404(manager_client):
    response = manager_client.post(f"/api/events/{uuid.uuid4()}/cancel")

    assert response.status_code == 404
    assert response.json()["code"] == "EVENT_NOT_FOUND"


def test_cancel_malformed_id_is_400(manager_client):
    response = manager_client.post("/api/events/not-a-uuid/cancel")

    assert response.status_code == 400
    assert response.json()["code"] == "MALFORMED_REQUEST"
