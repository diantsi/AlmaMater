"""Load seed data (organisations, topics, faculties, events) into PostgreSQL.

Run via `make seed [file=<path>]`. Idempotent: rows are upserted by slug / code / event id;
rows missing from the file are left untouched. Events reference organisations by slug and
topics / faculties by code, resolved against the database after the dictionaries are upserted.
"""

import argparse
import sys
from datetime import UTC, datetime
from pathlib import Path

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.dictionaries.models import Faculty, Topic
from app.events.models import Event
from app.organisations.models import Organization
from app.seed.schemas import EventSeed, SeedFile

DEFAULT_FILE = Path("seed/data.json")


class SeedError(Exception):
    pass


def _upsert(session: Session, model: type, key: str, rows: list[dict], keep: frozenset[str] = frozenset()) -> None:
    if not rows:
        return
    statement = insert(model).values(rows)
    updates = {column: statement.excluded[column] for column in rows[0] if column != key and column not in keep}
    session.execute(statement.on_conflict_do_update(index_elements=[key], set_=updates))


def _ids(session: Session, model: type, key: str, wanted: set[str], label: str) -> dict[str, object]:
    column = getattr(model, key)
    found = {key_value: id_ for key_value, id_ in session.execute(select(column, model.id).where(column.in_(wanted)))}
    if missing := wanted - found.keys():
        raise SeedError(f"events reference unknown {label}: {', '.join(sorted(missing))}")
    return found


def _event_rows(session: Session, events: list[EventSeed]) -> list[dict]:
    if not events:
        return []
    orgs = _ids(session, Organization, "slug", {e.organization for e in events}, "organizations.slug")
    topics = _ids(session, Topic, "code", {e.topic for e in events}, "topics.code")
    faculties = _ids(session, Faculty, "code", {e.faculty for e in events}, "faculties.code")
    now = datetime.now(UTC)
    rows = []
    for event in events:
        row = event.model_dump(exclude={"organization", "topic", "faculty"})
        row.update(
            organization_id=orgs[event.organization],
            topic_id=topics[event.topic],
            faculty_id=faculties[event.faculty],
            published_at=now,
            updated_at=now,
        )
        rows.append(row)
    return rows


def seed(session: Session, data: SeedFile) -> dict[str, int]:
    """Upsert all rows from `data`; the caller owns the transaction."""
    _upsert(session, Organization, "slug", [row.model_dump() for row in data.organizations])
    _upsert(session, Topic, "code", [row.model_dump() for row in data.topics])
    _upsert(session, Faculty, "code", [row.model_dump() for row in data.faculties])
    # published_at keeps its first value; revision is not bumped by re-seeding
    _upsert(session, Event, "id", _event_rows(session, data.events), keep=frozenset({"published_at"}))
    return {
        "organizations": len(data.organizations),
        "topics": len(data.topics),
        "faculties": len(data.faculties),
        "events": len(data.events),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--file", type=Path, default=DEFAULT_FILE, help=f"seed JSON (default: {DEFAULT_FILE})")
    path = parser.parse_args().file

    if not path.is_file():
        print(f"seed file not found: {path}; copy seed/data.example.json and fill in team-supplied values")
        return 1
    try:
        data = SeedFile.model_validate_json(path.read_text(encoding="utf-8"))
    except ValidationError as error:
        print(f"invalid seed file {path}:\n{error}")
        return 1

    try:
        with SessionLocal.begin() as session:
            counts = seed(session, data)
    except SeedError as error:
        print(f"seed failed, nothing written: {error}")
        return 1
    print(f"seeded from {path}: " + ", ".join(f"{count} {name}" for name, count in counts.items()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
