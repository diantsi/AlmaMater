"""Load seed data (organisations, topics, faculties) into PostgreSQL.

Run via `make seed [file=<path>]`. Idempotent: rows are upserted by slug / code; rows missing
from the file are left untouched. Events are not seeded; they are published by signed-in organisations.
"""

import argparse
import sys
from pathlib import Path

from pydantic import ValidationError
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.dictionaries.models import Faculty, Topic
from app.organisations.models import Organization
from app.seed.schemas import SeedFile

DEFAULT_FILE = Path("seed/data.json")


def _upsert(session: Session, model: type, key: str, rows: list[dict]) -> None:
    if not rows:
        return
    statement = insert(model).values(rows)
    updates = {column: statement.excluded[column] for column in rows[0] if column != key}
    session.execute(statement.on_conflict_do_update(index_elements=[key], set_=updates))


def seed(session: Session, data: SeedFile) -> dict[str, int]:
    """Upsert all rows from `data`; the caller owns the transaction."""
    _upsert(session, Organization, "slug", [row.model_dump() for row in data.organizations])
    _upsert(session, Topic, "code", [row.model_dump() for row in data.topics])
    _upsert(session, Faculty, "code", [row.model_dump() for row in data.faculties])
    return {
        "organizations": len(data.organizations),
        "topics": len(data.topics),
        "faculties": len(data.faculties),
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

    with SessionLocal.begin() as session:
        counts = seed(session, data)
    print(f"seeded from {path}: " + ", ".join(f"{count} {name}" for name, count in counts.items()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
