"""Load seed data into PostgreSQL, or flip dev organiser accounts.

`make seed [file=<path>]` applies the whole file in one transaction, in this order:
1. organisations, topics and faculties are upserted by slug / code; rows missing from the file are left untouched;
2. `accounts` (development only) get each `is_org` applied, see `set_organiser`;
3. an event is inserted once per (organisation, title) and only when its `organization_email` is both an
   organisation's registered address and a user who has signed in (the publisher, created_by_user_id);
   otherwise it is skipped with a reason, so sign in once and seed again.

`make switch-org email=<all|email>` flips the organiser state of one listed account or of every listed account.
Only accounts listed in the file are ever touched. A user manages an organisation iff their email equals its
`registered_email` (C-02), so:
- granting points an organisation at the email: an existing one disabled earlier is re-enabled,
  otherwise a test organisation named after the email is created;
- revoking renames the organisation's address to `<email>.disabled`, which no user can hold,
  so the organisation and its events are kept and a later grant restores them.
"""

import argparse
import re
import sys
from datetime import UTC, datetime
from pathlib import Path

from pydantic import TypeAdapter, ValidationError
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.auth.models import User
from app.db.session import SessionLocal
from app.dictionaries.models import Faculty, Topic
from app.events.models import Event, EventStatus
from app.events.service import validate_event
from app.organisations.models import Organization
from app.seed.schemas import EventSeed, OrganiserAccount, SeedFile, UniversityEmail

DEFAULT_FILE = Path("seed/data.json")
# Organiser accounts are dev-only, so switching defaults to the example file
DEFAULT_SWITCH_FILE = Path("seed/data.example.json")
DISABLED_SUFFIX = ".disabled"


def _upsert(session: Session, model: type, key: str, rows: list[dict]) -> None:
    if not rows:
        return
    statement = insert(model).values(rows)
    updates = {column: statement.excluded[column] for column in rows[0] if column != key}
    session.execute(statement.on_conflict_do_update(index_elements=[key], set_=updates))


def _by_email(session: Session, email: str) -> Organization | None:
    return session.scalars(select(Organization).where(Organization.registered_email == email)).first()


def _test_organization(email: str) -> Organization:
    local = email.partition("@")[0]
    return Organization(
        name=f"Test organisation ({local})",
        slug="test-" + re.sub(r"[^a-z0-9]+", "-", local).strip("-"),
        registered_email=email,
    )


def set_organiser(session: Session, email: str, is_org: bool) -> str:
    """Apply one toggle; the caller owns the transaction. Returns a one-line report."""
    active, disabled = _by_email(session, email), _by_email(session, email + DISABLED_SUFFIX)
    if is_org:
        if active is not None:
            return f"{email}: already manages '{active.name}'"
        if disabled is not None:
            disabled.registered_email = email
            session.flush()
            return f"{email}: re-enabled '{disabled.name}'"
        organization = _test_organization(email)
        if session.scalars(select(Organization).where(Organization.slug == organization.slug)).first():
            raise ValueError(f"{email}: slug '{organization.slug}' is taken by another organisation")
        session.add(organization)
        session.flush()
        return f"{email}: created '{organization.name}'"
    if active is None:
        return f"{email}: already a plain member"
    if disabled is not None:
        # registered_email is unique: a second disabled organisation for the same email cannot exist
        raise ValueError(f"{email}: '{disabled.name}' is already disabled for this email; fix one of them by hand")
    active.registered_email = email + DISABLED_SUFFIX
    session.flush()
    return f"{email}: disabled '{active.name}' (now a plain member)"


def switch_organiser(session: Session, email: str) -> str:
    """Flip one account: an organiser becomes a plain member, anyone else becomes an organiser."""
    return set_organiser(session, email, _by_email(session, email) is None)


def _switch_targets(accounts: list[OrganiserAccount], target: str, path: Path) -> list[str]:
    listed = [account.email for account in accounts]
    if target == "all":
        return listed
    email = TypeAdapter(UniversityEmail).validate_python(target)
    if email not in listed:
        raise ValueError(f"{email} is not listed in {path}; only listed test accounts can be switched")
    return [email]


def _insert_event(session: Session, row: EventSeed, now: datetime) -> str | None:
    """Insert one event; returns the reason it was skipped, or None when it was inserted."""
    organization = _by_email(session, row.organization_email)
    if organization is None:
        return "no organisation has this registered address (add it to `accounts` with is_org: true)"
    user = session.scalars(select(User).where(User.email == row.organization_email)).first()
    if user is None:
        return "this account has not signed in yet"
    duplicate = select(Event.id).where(Event.organization_id == organization.id, Event.title == row.title)
    if session.scalars(duplicate).first() is not None:
        return "already exists"

    topic_id = session.scalars(select(Topic.id).where(Topic.code == row.topic_code)).first()
    faculty_id = session.scalars(select(Faculty.id).where(Faculty.code == row.faculty_code)).first()
    if topic_id is None or faculty_id is None:
        return f"unknown topic_code '{row.topic_code}' or faculty_code '{row.faculty_code}'"

    state = row.model_dump(exclude={"organization_email", "topic_code", "faculty_code"})
    state.update(topic_id=topic_id, faculty_id=faculty_id)
    if errors := validate_event(session, state, now):
        return "invalid: " + "; ".join(f"{error.field}: {error.message}" for error in errors)

    session.add(
        Event(
            **state,
            organization_id=organization.id,
            created_by_user_id=user.id,
            status=EventStatus.PUBLISHED.value,
            revision=1,
            published_at=now,
            updated_at=now,
        )
    )
    session.flush()
    return None


def seed(session: Session, data: SeedFile, report=print) -> dict[str, int]:
    """Apply the whole file; the caller owns the transaction. Account changes and skipped events go to `report`.

    Raises ValueError when an account cannot be toggled, so the caller's transaction rolls back.
    """
    _upsert(session, Organization, "slug", [row.model_dump() for row in data.organizations])
    _upsert(session, Topic, "code", [row.model_dump() for row in data.topics])
    _upsert(session, Faculty, "code", [row.model_dump() for row in data.faculties])
    for account in data.accounts:
        report(set_organiser(session, account.email, account.is_org))

    now, inserted = datetime.now(UTC), 0
    for row in data.events:
        if (reason := _insert_event(session, row, now)) is None:
            inserted += 1
        else:
            report(f"skipped event '{row.title}' ({row.organization_email}): {reason}")
    return {
        "organizations": len(data.organizations),
        "topics": len(data.topics),
        "faculties": len(data.faculties),
        "accounts": len(data.accounts),
        "events": inserted,
    }


def _load(path: Path) -> SeedFile:
    if not path.is_file():
        raise ValueError(f"seed file not found: {path}; copy seed/data.example.json and fill in team-supplied values")
    return SeedFile.model_validate_json(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--switch", metavar="ALL|EMAIL", help="flip one listed account, or every listed one")
    parser.add_argument(
        "--file", type=Path, help=f"seed JSON (default: {DEFAULT_FILE}; with --switch: {DEFAULT_SWITCH_FILE})"
    )
    args = parser.parse_args()
    path = args.file or (DEFAULT_FILE if args.switch is None else DEFAULT_SWITCH_FILE)

    try:
        data = _load(path)
        with SessionLocal.begin() as session:
            if args.switch is None:
                counts = seed(session, data)
                print(f"seeded from {path}: " + ", ".join(f"{count} {name}" for name, count in counts.items()))
            else:
                for email in _switch_targets(data.accounts, args.switch.strip().lower(), path):
                    print(switch_organiser(session, email))
    except (ValueError, ValidationError) as error:
        print(f"seeding from {path} failed, nothing changed:\n{error}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
