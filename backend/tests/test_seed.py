from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dictionaries.models import Faculty, Topic
from app.events.models import Event
from app.organisations.models import Organization
from app.seed.schemas import OrganiserAccount, SeedFile
from app.seed.seeder import seed
from tests.conftest import make_user


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

    assert counts == {"organizations": 1, "topics": 1, "faculties": 1, "accounts": 0, "events": 0}
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
    assert seed(db, SeedFile()) == {"organizations": 0, "topics": 0, "faculties": 0, "accounts": 0, "events": 0}


def _event(**overrides) -> dict:
    return {
        "organization_email": "seed-org@example.test",
        "topic_code": "seed-test-topic",
        "faculty_code": "seed-test-faculty",
        "title": " Seed event ",
        "description": "Seed description",
        "starts_at": (datetime.now(UTC) + timedelta(days=7)).isoformat(),
        "format": "ONLINE",
        "meeting_url": "https://meet.example.test/seed",
        "participation_method": "OPEN_ATTENDANCE",
        "attendance_instructions": "Just join",
    } | overrides


def _with_events(*events: dict) -> SeedFile:
    return SeedFile.model_validate(_data().model_dump() | {"events": list(events)})


def test_seed_events_once_per_organisation_and_title(db: Session):
    user = make_user(db, email="seed-org@example.test")

    assert seed(db, _with_events(_event()), report=lambda _: None)["events"] == 1
    skipped: list[str] = []
    assert seed(db, _with_events(_event()), report=skipped.append)["events"] == 0

    event = db.scalars(select(Event).where(Event.title == "Seed event")).one()
    assert (event.created_by_user_id, event.status, event.revision) == (user.id, "PUBLISHED", 1)
    assert event.organization.slug == "seed-test-org"
    assert skipped == ["skipped event 'Seed event' (seed-org@example.test): already exists"]


@pytest.mark.parametrize(
    ("overrides", "with_user", "reason"),
    [
        ({}, False, "has not signed in yet"),
        ({"organization_email": "nobody@example.test"}, True, "no organisation has this registered address"),
        ({"topic_code": "missing"}, True, "unknown topic_code"),
        ({"starts_at": "2020-01-01T10:00:00+02:00"}, True, "startsAt: Start must be in the future."),
        ({"format": "IN_PERSON"}, True, "venue: Required when format is IN_PERSON."),
    ],
)
def test_seed_skips_events_that_cannot_be_published(db: Session, overrides: dict, with_user: bool, reason: str):
    if with_user:
        make_user(db, email="seed-org@example.test")
    skipped: list[str] = []

    assert seed(db, _with_events(_event(**overrides)), report=skipped.append)["events"] == 0
    assert len(skipped) == 1 and reason in skipped[0]
    assert db.scalars(select(Event).where(Event.title == "Seed event")).first() is None


@pytest.mark.parametrize(
    "payload",
    [
        {"topics": [{"code": "a", "name": "A"}, {"code": "a", "name": "B"}]},
        {"organizations": [{"name": "X", "slug": "x", "registered_email": "not-an-email"}]},
        {"faculties": [{"code": " ", "name": "Blank code"}]},
        {"events": [_event(), _event(title="Seed event")]},
        {"events": [_event(organizer="unknown field")]},
        {"events": [_event(newcomers_welcome="yes")]},
        {"events": [_event(starts_at="2027-01-01T10:00:00")]},
    ],
)
def test_seed_file_rejects_invalid_data(payload: dict):
    with pytest.raises(ValidationError):
        SeedFile.model_validate(payload)


def test_example_seed_file_is_valid():
    data = SeedFile.model_validate_json(Path("seed/data.example.json").read_text(encoding="utf-8"))

    assert [len(rows) for rows in (data.organizations, data.topics, data.faculties)] == [3, 3, 3]
    # One event per dev organiser account
    assert sorted(event.organization_email for event in data.events) == sorted(row.email for row in data.accounts)


def test_example_seed_events_are_publishable(db: Session):
    data = SeedFile.model_validate_json(Path("seed/data.example.json").read_text(encoding="utf-8"))
    data.accounts = []
    # Test-only addresses, so real accounts already in the dev DB do not interfere
    for index, event in enumerate(data.events):
        event.organization_email = f"seed-example-{index}@example.test"
        make_user(db, email=event.organization_email)
        db.add(Organization(name=f"Seed org {index}", slug=f"seed-org-{index}", registered_email=event.organization_email))
    db.flush()

    skipped: list[str] = []
    assert seed(db, data, report=skipped.append)["events"] == len(data.events)
    assert skipped == []


def test_seed_applies_accounts_before_events(db: Session):
    make_user(db, email="seed.organiser@ukma.edu.ua")
    data = _with_events(_event(organization_email="seed.organiser@ukma.edu.ua"))
    data.accounts = [OrganiserAccount(email="seed.organiser", is_org=True)]
    lines: list[str] = []

    assert seed(db, data, report=lines.append)["events"] == 1
    assert lines == ["seed.organiser@ukma.edu.ua: created 'Test organisation (seed.organiser)'"]


def test_seed_events_see_a_re_enabled_organisation(db: Session):
    make_user(db, email="seed.organiser@ukma.edu.ua")
    db.add(Organization(name="Seed org", slug="seed-org-disabled", registered_email="seed.organiser@ukma.edu.ua.disabled"))
    db.flush()
    data = _with_events(_event(organization_email="seed.organiser@ukma.edu.ua"))
    data.accounts = [OrganiserAccount(email="seed.organiser", is_org=True)]

    assert seed(db, data, report=lambda _: None)["events"] == 1
