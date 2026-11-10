import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.events.models import Event
from tests.conftest import make_event, make_faculty, make_organization, make_topic


@pytest.fixture
def refs(db):
    return make_organization(db), make_topic(db), make_faculty(db)


def _future(days: int = 7) -> str:
    return (datetime.now(UTC) + timedelta(days=days)).replace(microsecond=0).isoformat()


def _payload(refs, **overrides) -> dict:
    org, topic, faculty = refs
    body = {
        "organizationId": str(org.id),
        "title": "Test workshop",
        "description": "Test description",
        "startsAt": _future(),
        "topicId": str(topic.id),
        "facultyId": str(faculty.id),
        "newcomersWelcome": True,
        "format": "IN_PERSON",
        "venue": "Test room",
        "participationMethod": "GOOGLE_FORM",
        "googleFormUrl": "https://forms.example/test",
    }
    body.update(overrides)
    return {key: value for key, value in body.items() if value is not ...}


def _count(db, org) -> int:
    return db.scalar(select(func.count()).select_from(Event).where(Event.organization_id == org.id))


def _fields(response) -> set[str]:
    return {detail["field"] for detail in response.json()["details"]}


# --- POST /api/events -------------------------------------------------------


def test_create_publishes_event(client, db, refs):
    org, topic, faculty = refs
    starts_at = datetime(2099, 3, 1, 16, 0, tzinfo=UTC)

    response = client.post(
        "/api/events",
        json=_payload(refs, startsAt="2099-03-01T18:00:00+02:00", title="  Padded title  "),
    )

    assert response.status_code == 201
    body = response.json()
    assert response.headers["Location"] == f"/api/events/{body['id']}"
    assert body["status"] == "PUBLISHED"
    assert body["revision"] == 1
    assert body["title"] == "Padded title"
    assert body["startsAt"] == starts_at.isoformat().replace("+00:00", "Z")
    assert body["organizationId"] == str(org.id)
    assert body["organizationName"] == org.name
    assert body["speakerName"] is None
    assert body["cancelledAt"] is None
    assert body["eventUrl"] == f"/events/{body['id']}"
    assert body["publishedAt"] == body["updatedAt"]

    listed = client.get("/api/events", params={"organizationId": str(org.id)})
    assert [item["id"] for item in listed.json()["items"]] == [body["id"]]


def test_create_reports_all_errors_at_once(client, db, refs):
    org, _, _ = refs
    payload = _payload(
        refs,
        title=...,
        googleFormUrl="http://forms.example/test",
        registrationDeadline=_future(10),
        durationMinutes=0,
        description="   ",
    )

    response = client.post("/api/events", json=payload)

    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"
    assert _fields(response) == {"title", "description", "googleFormUrl", "registrationDeadline", "durationMinutes"}
    assert _count(db, org) == 0


@pytest.mark.parametrize(
    ("overrides", "fields"),
    [
        ({"format": "ONLINE"}, {"meetingUrl", "venue"}),
        ({"meetingUrl": "https://meet.example/x"}, {"meetingUrl"}),
        ({"format": "HYBRID"}, {"format"}),
        ({"participationMethod": "DIRECT_CONTACT"}, {"contactDetails", "googleFormUrl"}),
        ({"attendanceInstructions": "Come"}, {"attendanceInstructions"}),
        ({"googleFormUrl": None}, {"googleFormUrl"}),
        ({"startsAt": (datetime.now(UTC) - timedelta(hours=1)).isoformat()}, {"startsAt"}),
        ({"topicId": str(uuid.uuid4()), "facultyId": str(uuid.uuid4())}, {"topicId", "facultyId"}),
        ({"organizationId": str(uuid.uuid4())}, {"organizationId"}),
        ({"organizationId": ...}, {"organizationId"}),
        ({"speakerName": "x" * 161}, {"speakerName"}),
    ],
)
def test_create_validation_errors(client, db, refs, overrides, fields):
    org, _, _ = refs

    response = client.post("/api/events", json=_payload(refs, **overrides))

    assert response.status_code == 422
    assert _fields(response) == fields
    assert _count(db, org) == 0


@pytest.mark.parametrize(
    "overrides",
    [
        {"status": "CANCELLED"},
        {"id": str(uuid.uuid4())},
        {"revision": 5},
        {"starts_at": _future()},
        {"topicId": "not-a-uuid"},
        {"startsAt": "2099-03-01T18:00:00"},
        {"durationMinutes": "60"},
        {"newcomersWelcome": "yes"},
    ],
)
def test_create_malformed_is_400(client, db, refs, overrides):
    org, _, _ = refs

    response = client.post("/api/events", json=_payload(refs, **overrides))

    assert response.status_code == 400
    assert response.json()["code"] == "MALFORMED_REQUEST"
    assert response.json()["details"]
    assert _count(db, org) == 0


def test_create_non_object_body_is_400(client):
    response = client.post("/api/events", json=["not", "an", "object"])

    assert response.status_code == 400
    assert response.json()["code"] == "MALFORMED_REQUEST"


# --- PATCH /api/events/{eventId} --------------------------------------------


def test_update_changes_event_and_bumps_revision(client, db, refs):
    event = make_event(db, *refs, speaker_name="Old speaker", updated_at=datetime(2026, 1, 1, tzinfo=UTC))

    response = client.patch(
        f"/api/events/{event.id}",
        json={"revision": 1, "title": "New title", "speakerName": None, "startsAt": "2099-03-01T18:00:00+02:00"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(event.id)
    assert body["eventUrl"] == f"/events/{event.id}"
    assert body["revision"] == 2
    assert body["title"] == "New title"
    assert body["speakerName"] is None
    assert body["startsAt"] == "2099-03-01T16:00:00Z"
    assert body["updatedAt"] != "2026-01-01T00:00:00Z"


def test_update_switches_format_and_method(client, db, refs):
    event = make_event(db, *refs)

    response = client.patch(
        f"/api/events/{event.id}",
        json={
            "revision": 1,
            "format": "ONLINE",
            "venue": None,
            "meetingUrl": "https://meet.example/x",
            "participationMethod": "DIRECT_CONTACT",
            "attendanceInstructions": None,
            "contactDetails": "Write to us",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert (body["format"], body["venue"], body["meetingUrl"]) == ("ONLINE", None, "https://meet.example/x")
    assert (body["participationMethod"], body["contactDetails"]) == ("DIRECT_CONTACT", "Write to us")
    assert body["attendanceInstructions"] is None


def test_update_validates_merged_event(client, db, refs):
    event = make_event(db, *refs)

    response = client.patch(
        f"/api/events/{event.id}", json={"revision": 1, "format": "ONLINE", "meetingUrl": "https://meet.example/x"}
    )

    assert response.status_code == 422
    assert _fields(response) == {"venue"}
    db.refresh(event)
    assert (event.format, event.revision) == ("IN_PERSON", 1)


def test_update_without_effective_change_keeps_revision(client, db, refs):
    event = make_event(db, *refs)

    response = client.patch(f"/api/events/{event.id}", json={"revision": 1, "title": f"  {event.title} "})

    assert response.status_code == 200
    assert response.json()["revision"] == 1


def test_update_stale_revision_is_409(client, db, refs):
    event = make_event(db, *refs, revision=3)

    response = client.patch(f"/api/events/{event.id}", json={"revision": 2, "title": "New title"})

    assert response.status_code == 409
    assert response.json()["code"] == "EVENT_REVISION_CONFLICT"
    db.refresh(event)
    assert (event.title, event.revision) == ("Test event", 3)


@pytest.mark.parametrize(
    "overrides",
    [
        {"status": "CANCELLED", "cancelled_at": datetime(2026, 1, 1, tzinfo=UTC)},
        {"starts_at": datetime.now(UTC) - timedelta(days=1)},
    ],
)
def test_update_cancelled_or_past_is_409(client, db, refs, overrides):
    event = make_event(db, *refs, **overrides)

    response = client.patch(f"/api/events/{event.id}", json={"revision": 1, "title": "New title"})

    assert response.status_code == 409
    assert response.json()["code"] == "EVENT_NOT_EDITABLE"


def test_update_unknown_event_is_404(client):
    response = client.patch(f"/api/events/{uuid.uuid4()}", json={"revision": 1, "title": "New title"})

    assert response.status_code == 404
    assert response.json()["code"] == "EVENT_NOT_FOUND"


@pytest.mark.parametrize(
    "body",
    [
        {"revision": 1},
        {"title": "New title"},
        {"revision": 1, "organizationId": str(uuid.uuid4())},
        {"revision": 1, "status": "CANCELLED"},
        {"revision": "1", "title": "New title"},
    ],
)
def test_update_malformed_is_400(client, db, refs, body):
    event = make_event(db, *refs)

    response = client.patch(f"/api/events/{event.id}", json=body)

    assert response.status_code == 400
    assert response.json()["code"] == "MALFORMED_REQUEST"
    db.refresh(event)
    assert (event.title, event.revision) == ("Test event", 1)
