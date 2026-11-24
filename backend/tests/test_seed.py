from pathlib import Path

import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dictionaries.models import Faculty, Topic
from app.organisations.models import Organization
from app.seed.schemas import SeedFile
from app.seed.seeder import seed


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

    assert counts == {"organizations": 1, "topics": 1, "faculties": 1}
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
    assert seed(db, SeedFile()) == {"organizations": 0, "topics": 0, "faculties": 0}


@pytest.mark.parametrize(
    "payload",
    [
        {"topics": [{"code": "a", "name": "A"}, {"code": "a", "name": "B"}]},
        {"organizations": [{"name": "X", "slug": "x", "registered_email": "not-an-email"}]},
        {"faculties": [{"code": " ", "name": "Blank code"}]},
        # Events are not seeded: each needs the signed-in user who published it
        {"events": []},
    ],
)
def test_seed_file_rejects_invalid_data(payload: dict):
    with pytest.raises(ValidationError):
        SeedFile.model_validate(payload)


def test_example_seed_file_is_valid():
    data = SeedFile.model_validate_json(Path("seed/data.example.json").read_text(encoding="utf-8"))

    assert [len(rows) for rows in (data.organizations, data.topics, data.faculties)] == [3, 3, 3]
