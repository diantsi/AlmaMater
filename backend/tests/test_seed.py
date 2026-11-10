import uuid
from pathlib import Path

import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dictionaries.models import Faculty, Topic
from app.events.models import Event
from app.organisations.models import Organization
from app.seed.schemas import SeedFile
from app.seed.seeder import SeedError, seed


# Test-only values; not seed data
def _data(org_name: str = "Seed org", topic_name: str = "Seed topic") -> SeedFile:
    return SeedFile.model_validate(
        {
            "organizations": [
                {"name": org_name, "slug": "seed-test-org", "registered_email": " Seed-Org@Example.TEST "}
            ],
            "topics": [{"code": "seed-test-topic", "name": topic_name}],
            "faculties": [{"code": "seed-test-faculty", "name": "Seed faculty"}],
        }
    )


def test_seed_inserts_rows(db: Session):
    counts = seed(db, _data())

    assert counts == {"organizations": 1, "topics": 1, "faculties": 1, "events": 0}
    org = db.scalars(select(Organization).where(Organization.slug == "seed-test-org")).one()
    assert org.registered_email == "seed-org@example.test"
    assert db.scalars(select(Faculty).where(Faculty.code == "seed-test-faculty")).one().name == "Seed faculty"


def test_seed_is_idempotent_and_updates_by_key(db: Session):
    seed(db, _data())
    org_id = db.scalars(select(Organization.id).where(Organization.slug == "seed-test-org")).one()

    seed(db, _data(org_name="Renamed org", topic_name="Renamed topic"))
    db.expire_all()

    orgs = db.scalars(select(Organization).where(Organization.slug == "seed-test-org")).all()
    assert [(org.id, org.name) for org in orgs] == [(org_id, "Renamed org")]
    assert db.scalars(select(Topic).where(Topic.code == "seed-test-topic")).one().name == "Renamed topic"


def test_seed_empty_file_is_noop(db: Session):
    assert seed(db, SeedFile()) == {"organizations": 0, "topics": 0, "faculties": 0, "events": 0}


@pytest.mark.parametrize(
    "payload",
    [
        {"topics": [{"code": "a", "name": "A"}, {"code": "a", "name": "B"}]},
        {"organizations": [{"name": "X", "slug": "x", "registered_email": "not-an-email"}]},
        {"faculties": [{"code": " ", "name": "Blank code"}]},
        {"events": [{"title": "missing required fields"}]},
    ],
)
def test_seed_file_rejects_invalid_data(payload: dict):
    with pytest.raises(ValidationError):
        SeedFile.model_validate(payload)


def _event(**overrides) -> dict:
    event = {
        "id": "00000000-0000-4000-8000-00000000e001",
        "organization": "seed-test-org",
        "topic": "seed-test-topic",
        "faculty": "seed-test-faculty",
        "title": "Seed event",
        "description": "Seed description",
        "starts_at": "2099-01-01T10:00:00Z",
        "format": "ONLINE",
        "meeting_url": "https://meet.example.test/x",
        "participation_method": "OPEN_ATTENDANCE",
        "attendance_instructions": "Just come",
    }
    event.update(overrides)
    return event


def _with_events(*events: dict) -> SeedFile:
    return SeedFile.model_validate({**_data().model_dump(), "events": list(events)})


def test_seed_events_resolve_refs_and_upsert_by_id(db: Session):
    seed(db, _with_events(_event()))
    first = db.get(Event, uuid.UUID(_event()["id"]))
    published_at = first.published_at
    assert first.organization.slug == "seed-test-org"
    assert first.status == "PUBLISHED" and first.revision == 1

    seed(db, _with_events(_event(title="Renamed event")))
    db.expire_all()

    event = db.get(Event, uuid.UUID(_event()["id"]))
    assert event.title == "Renamed event"
    assert event.published_at == published_at


def test_seed_events_unknown_ref_fails(db: Session):
    with pytest.raises(SeedError, match="unknown topics.code: missing-topic"):
        seed(db, _with_events(_event(topic="missing-topic")))


@pytest.mark.parametrize(
    "overrides",
    [
        {"venue": "Room 1"},
        {"meeting_url": "http://insecure.example.test"},
        {"attendance_instructions": None},
        {"contact_details": "Also this"},
        {"registration_deadline": "2099-01-02T10:00:00Z"},
        {"status": "CANCELLED"},
        {"cancelled_at": "2098-12-01T10:00:00Z"},
        {"starts_at": "2099-01-01T10:00:00"},
    ],
)
def test_seed_events_reject_invalid_data(overrides: dict):
    with pytest.raises(ValidationError):
        _with_events(_event(**overrides))


def test_example_seed_file_is_valid():
    data = SeedFile.model_validate_json(Path("seed/data.example.json").read_text(encoding="utf-8"))

    assert [len(rows) for rows in (data.organizations, data.topics, data.faculties, data.events)] == [3, 3, 3, 3]
