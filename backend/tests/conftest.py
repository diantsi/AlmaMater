import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import SESSION_COOKIE
from app.auth.models import Session as UserSession
from app.auth.models import User
from app.auth.service import create_session, csrf_token, hash_token
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
    """Anonymous client; the get_db override also serves any extra client made with new_client()."""
    app.dependency_overrides[get_db] = lambda: db
    try:
        yield new_client()
    finally:
        app.dependency_overrides.pop(get_db, None)


def new_client() -> TestClient:
    return TestClient(app, raise_server_exceptions=False)


def sign_in(client: TestClient, db: Session, user: User, **session_overrides) -> str:
    """Give `client` a session cookie for `user` and send its CSRF header; returns the CSRF token."""
    token = create_session(db, user, datetime.now(UTC))
    if session_overrides:
        session = db.scalars(select(UserSession).where(UserSession.token_hash == hash_token(token))).one()
        for field, value in session_overrides.items():
            setattr(session, field, value)
        db.flush()
    client.cookies.set(SESSION_COOKIE, token)
    csrf = csrf_token(token)
    client.headers["X-CSRF-Token"] = csrf
    return csrf


@pytest.fixture
def member_client(client: TestClient, db: Session) -> TestClient:
    """Signed-in member who manages no organisation."""
    sign_in(client, db, make_user(db))
    return client


@pytest.fixture
def manager_org(db: Session) -> Organization:
    return make_organization(db)


@pytest.fixture
def manager_client(client: TestClient, db: Session, manager_org: Organization) -> TestClient:
    """Signed in with `manager_org`'s registered address (C-02), CSRF header included."""
    sign_in(client, db, make_user(db, email=manager_org.registered_email))
    return client


# Test-only rows; not seed data
def make_user(db: Session, email: str | None = None) -> User:
    suffix = uuid.uuid4().hex[:8]
    now = datetime.now(UTC)
    user = User(
        identity_provider="test",
        provider_subject=f"test-{suffix}",
        email=email or f"member-{suffix}@example.test",
        created_at=now,
        last_login_at=now,
    )
    db.add(user)
    db.flush()
    return user


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
    created_by: User | None = None,
    **overrides,
) -> Event:
    now = datetime.now(UTC)
    values = dict(
        organization_id=organization.id,
        created_by_user_id=(created_by or make_user(db)).id,
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
    if values["status"] == "CANCELLED":
        values.setdefault("cancelled_by_user_id", values["created_by_user_id"])
    event = Event(**values)
    db.add(event)
    db.flush()
    return event
