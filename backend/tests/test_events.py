import uuid
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from tests.conftest import make_event, make_faculty, make_organization, make_topic

KYIV = ZoneInfo("Europe/Kyiv")


@pytest.fixture
def refs(db):
    return make_organization(db), make_topic(db), make_faculty(db)


def _ids(response, org_id):
    # Restrict to this test's organisation so stray rows never affect assertions
    return [item["id"] for item in response.json()["items"] if item["organizationId"] == str(org_id)]


def test_list_excludes_cancelled_and_past_and_sorts(client, db, refs):
    org, topic, faculty = refs
    now = datetime.now(UTC)
    later = make_event(db, org, topic, faculty, starts_at=now + timedelta(days=3))
    sooner = make_event(db, org, topic, faculty, starts_at=now + timedelta(days=1))
    make_event(db, org, topic, faculty, starts_at=now - timedelta(days=1))
    make_event(db, org, topic, faculty, status="CANCELLED", cancelled_at=now)

    response = client.get("/api/events", params={"organizationId": str(org.id)})

    assert response.status_code == 200
    assert _ids(response, org.id) == [str(sooner.id), str(later.id)]


def test_list_item_shape(client, db, refs):
    org, topic, faculty = refs
    starts_at = datetime(2099, 1, 2, 12, 0, tzinfo=UTC)
    event = make_event(db, org, topic, faculty, starts_at=starts_at)

    response = client.get("/api/events", params={"organizationId": str(org.id)})

    assert response.json()["items"] == [
        {
            "id": str(event.id),
            "title": event.title,
            "startsAt": "2099-01-02T12:00:00Z",
            "organizationId": str(org.id),
            "organizationName": org.name,
            "topicId": str(topic.id),
            "facultyId": str(faculty.id),
            "format": "IN_PERSON",
            "eventUrl": f"/events/{event.id}",
        }
    ]


def test_filters_or_within_and_between(client, db, refs):
    org, topic_a, faculty_a = refs
    topic_b, faculty_b = make_topic(db), make_faculty(db)
    a_a = make_event(db, org, topic_a, faculty_a)
    b_a = make_event(db, org, topic_b, faculty_a)
    make_event(db, org, topic_b, faculty_b)

    response = client.get(
        "/api/events",
        params=[("topicId", str(topic_a.id)), ("topicId", str(topic_b.id)), ("facultyId", str(faculty_a.id))],
    )

    assert response.status_code == 200
    assert set(_ids(response, org.id)) == {str(a_a.id), str(b_a.id)}


def test_date_range_is_inclusive_in_kyiv(client, db, refs):
    org, topic, faculty = refs
    day = (datetime.now(KYIV) + timedelta(days=10)).date()
    start_of_day = datetime.combine(day, datetime.min.time(), tzinfo=KYIV)
    first = make_event(db, org, topic, faculty, starts_at=start_of_day)
    last = make_event(db, org, topic, faculty, starts_at=start_of_day + timedelta(hours=23, minutes=59))
    make_event(db, org, topic, faculty, starts_at=start_of_day - timedelta(minutes=1))
    make_event(db, org, topic, faculty, starts_at=start_of_day + timedelta(days=1))

    both = client.get("/api/events", params={"organizationId": str(org.id), "dateFrom": day, "dateTo": day})
    only_to = client.get("/api/events", params={"organizationId": str(org.id), "dateTo": day})

    assert set(_ids(both, org.id)) == {str(first.id), str(last.id)}
    assert len(_ids(only_to, org.id)) == 3


def test_empty_result(client, db, refs):
    org, _, _ = refs

    response = client.get("/api/events", params={"organizationId": str(org.id)})

    assert response.status_code == 200
    assert response.json() == {"items": []}


def test_date_from_after_date_to_is_422(client):
    response = client.get("/api/events", params={"dateFrom": "2099-01-02", "dateTo": "2099-01-01"})

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "VALIDATION_ERROR"
    assert body["details"][0]["field"] == "dateTo"


def test_malformed_uuid_is_400_envelope(client):
    response = client.get("/api/events", params={"topicId": "not-a-uuid"})

    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "MALFORMED_REQUEST"
    assert set(body) == {"code", "message", "details", "requestId", "timestamp"}
    assert body["details"][0]["field"].startswith("topicId")


def test_details_of_cancelled_event(client, db, refs):
    org, topic, faculty = refs
    cancelled_at = datetime(2026, 1, 1, tzinfo=UTC)
    event = make_event(db, org, topic, faculty, status="CANCELLED", cancelled_at=cancelled_at, revision=2)

    response = client.get(f"/api/events/{event.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "CANCELLED"
    assert body["revision"] == 2
    assert body["cancelledAt"] == "2026-01-01T00:00:00Z"
    assert body["organizationName"] == org.name
    assert body["eventUrl"] == f"/events/{event.id}"
    assert body["canManage"] is False
    assert body["subscribed"] is False
    assert body["googleFormUrl"] is None
    assert "createdByUserId" not in body


def test_details_unknown_event_is_404(client):
    response = client.get(f"/api/events/{uuid.uuid4()}")

    assert response.status_code == 404
    assert response.json()["code"] == "EVENT_NOT_FOUND"


def test_details_malformed_id_is_400(client):
    response = client.get("/api/events/nope")

    assert response.status_code == 400
    assert response.json()["code"] == "MALFORMED_REQUEST"
