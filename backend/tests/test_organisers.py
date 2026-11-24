from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.service import SignInRejected, eligible_identity
from app.organisations.models import Organization
from app.seed.schemas import OrganiserAccount, SeedFile
from app.seed.seeder import (
    DISABLED_SUFFIX,
    _switch_targets,
    set_organiser,
    switch_organiser,
)
from tests.conftest import (
    make_event,
    make_faculty,
    make_organization,
    make_topic,
    make_user,
    sign_in,
)

# Test-only address; not seed data
EMAIL = "test.organiser@ukma.edu.ua"


def _can_publish(client: TestClient, db: Session) -> bool:
    sign_in(client, db, make_user(db, email=EMAIL))
    return client.get("/api/auth/me").json()["canPublish"]


def test_grant_creates_test_organisation(client: TestClient, db: Session):
    assert "created" in set_organiser(db, EMAIL, True)

    org = db.scalars(select(Organization).where(Organization.registered_email == EMAIL)).one()
    assert (org.name, org.slug) == ("Test organisation (test.organiser)", "test-test-organiser")
    assert _can_publish(client, db)


def test_grant_is_idempotent(db: Session):
    set_organiser(db, EMAIL, True)
    assert "already manages" in set_organiser(db, EMAIL, True)
    assert len(db.scalars(select(Organization).where(Organization.slug == "test-test-organiser")).all()) == 1


def test_revoke_keeps_organisation_and_events_and_grant_restores_them(client: TestClient, db: Session):
    org = make_organization(db)
    org.registered_email = EMAIL
    event = make_event(db, org, make_topic(db), make_faculty(db), created_by=make_user(db))

    assert "disabled" in set_organiser(db, EMAIL, False)
    assert org.registered_email == f"{EMAIL}.disabled"
    assert not _can_publish(client, db)

    assert "re-enabled" in set_organiser(db, EMAIL, True)
    assert org.registered_email == EMAIL
    assert db.get(type(event), event.id).organization_id == org.id


def test_revoke_with_existing_disabled_organisation_fails_cleanly(db: Session):
    set_organiser(db, EMAIL, True)
    set_organiser(db, EMAIL, False)
    other = make_organization(db)
    other.registered_email = EMAIL

    with pytest.raises(ValueError, match="already disabled"):
        set_organiser(db, EMAIL, False)
    assert other.registered_email == EMAIL


def test_disabled_address_can_never_sign_in():
    with pytest.raises(SignInRejected):
        eligible_identity({"tid": "t", "oid": "o", "email": f"{EMAIL}{DISABLED_SUFFIX}"})


def test_switch_flips_current_state(client: TestClient, db: Session):
    assert "created" in switch_organiser(db, EMAIL)
    assert "disabled" in switch_organiser(db, EMAIL)
    assert not _can_publish(client, db)
    assert "re-enabled" in switch_organiser(db, EMAIL)


OTHER = "other.organiser@ukma.edu.ua"
LISTED = [OrganiserAccount(email=EMAIL, is_org=True), OrganiserAccount(email=OTHER, is_org=False)]


def test_switch_targets_only_listed_accounts():
    assert _switch_targets(LISTED, "all", Path("f.json")) == [EMAIL, OTHER]
    assert _switch_targets(LISTED, "test.organiser", Path("f.json")) == [EMAIL]
    with pytest.raises(ValueError, match="not listed"):
        _switch_targets(LISTED, "stranger@ukma.edu.ua", Path("f.json"))


def test_revoke_plain_member_is_noop(db: Session):
    assert "already a plain member" in set_organiser(db, EMAIL, False)


@pytest.mark.parametrize(
    "payload",
    [
        {"accounts": [{"email": "someone@example.test", "is_org": True}]},
        {"accounts": [{"email": EMAIL, "is_org": True}, {"email": EMAIL.upper(), "is_org": False}]},
        {"accounts": [{"email": EMAIL}]},
    ],
)
def test_organiser_file_rejects_invalid_data(payload: dict):
    with pytest.raises(ValidationError):
        SeedFile.model_validate(payload)


def test_bare_login_means_university_address():
    data = SeedFile.model_validate({"accounts": [{"email": " Test.Organiser ", "is_org": True}]})

    assert data.accounts[0].email == EMAIL


def test_example_seed_file_accounts_are_valid():
    data = SeedFile.model_validate_json(Path("seed/data.example.json").read_text(encoding="utf-8"))

    assert data.accounts and all(account.email.endswith("@ukma.edu.ua") for account in data.accounts)
