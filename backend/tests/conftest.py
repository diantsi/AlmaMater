import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.session import engine, get_db
from app.dictionaries.models import Faculty, Topic
from app.events.models import Event
from app.main import app
from app.organisations.models import Organization


@pytest.fixture
def db() -> Iterator[Session]:
    """Session bound to an outer transaction that is rolled back after each test."""
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(db: Session) -> Iterator[TestClient]:
    app.dependency_overrides[get_db] = lambda: db
    try:
        yield TestClient(app, raise_server_exceptions=False)
    finally:
        app.dependency_overrides.pop(get_db, None)


# Test-only rows; not seed data
def make_organization(db: Session, name: str = "Test org") -> Organization:
    suffix = uuid.uuid4().hex[:8]
    org = Organization(name=name, slug=f"test-{suffix}", registered_email=f"test-{suffix}@example.test")
    db.add(org)
    db.flush()
    return org


def make_topic(db: Session, name: str = "Test topic") -> Topic:
    topic = Topic(code=f"test-{uuid.uuid4().hex[:8]}", name=name)
    db.add(topic)
    db.flush()
    return topic


def make_faculty(db: Session, name: str = "Test faculty") -> Faculty:
    faculty = Faculty(code=f"test-{uuid.uuid4().hex[:8]}", name=name)
    db.add(faculty)
    db.flush()
    return faculty


def make_event(
    db: Session,
    organization: Organization,
    topic: Topic,
    faculty: Faculty,
    starts_at: datetime | None = None,
    **overrides,
) -> Event:
    now = datetime.now(UTC)
    values = dict(
        organization_id=organization.id,
        status="PUBLISHED",
        title="Test event",
        description="Test description",
        starts_at=starts_at or now + timedelta(days=7),
        topic_id=topic.id,
        faculty_id=faculty.id,
        format="IN_PERSON",
        venue="Test room",
        participation_method="OPEN_ATTENDANCE",
        attendance_instructions="Just come",
        published_at=now,
        updated_at=now,
    )
    values.update(overrides)
    event = Event(**values)
    db.add(event)
    db.flush()
    return event
