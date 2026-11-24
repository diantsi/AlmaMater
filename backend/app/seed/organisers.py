"""Grant, revoke or switch organiser rights for test accounts (development only).

Run via `make seed org [file=<path>]` (apply each account's `is_org`) or `make switch-org email=<all|email>`
(flip the current state of one listed account or of every listed account). Only accounts listed in the
organiser file are ever touched. A user manages an organisation iff their email equals its `registered_email`
(C-02), so:
- granting points an organisation at the email: an existing one disabled earlier is re-enabled,
  otherwise a test organisation named after the email is created;
- revoking renames the organisation's address to `<email>.disabled`, which no user can hold,
  so the organisation and its events are kept and a later grant restores them.
"""

import argparse
import re
import sys
from pathlib import Path

from pydantic import TypeAdapter, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.organisations.models import Organization
from app.seed.schemas import OrganiserAccount, OrganiserFile, UniversityEmail

DEFAULT_FILE = Path("seed/organisations.example.json")
DISABLED_SUFFIX = ".disabled"


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


def _load(path: Path) -> list[OrganiserAccount]:
    if not path.is_file():
        raise ValueError(f"file not found: {path}")
    return OrganiserFile.model_validate_json(path.read_text(encoding="utf-8")).accounts


def _switch_targets(accounts: list[OrganiserAccount], target: str, path: Path) -> list[str]:
    listed = [account.email for account in accounts]
    if target == "all":
        return listed
    email = TypeAdapter(UniversityEmail).validate_python(target)
    if email not in listed:
        raise ValueError(f"{email} is not listed in {path}; only listed test accounts can be switched")
    return [email]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--switch", metavar="ALL|EMAIL", help="flip one listed account, or every listed one")
    parser.add_argument("--file", type=Path, default=DEFAULT_FILE, help=f"accounts JSON (default: {DEFAULT_FILE})")
    args = parser.parse_args()

    try:
        accounts = _load(args.file)
        with SessionLocal.begin() as session:
            if args.switch is None:
                for account in accounts:
                    print(set_organiser(session, account.email, account.is_org))
            else:
                for email in _switch_targets(accounts, args.switch.strip().lower(), args.file):
                    print(switch_organiser(session, email))
    except (ValueError, ValidationError) as error:
        print(f"organiser change failed, nothing changed:\n{error}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
