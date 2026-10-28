from sqlalchemy import text

from app.db.session import engine


def test_database_connection():
    with engine.connect() as connection:
        assert connection.execute(text("SELECT 1")).scalar() == 1


def test_initial_migration_applied():
    with engine.connect() as connection:
        version = connection.execute(text("SELECT version_num FROM alembic_version")).scalar()

    assert version == "0001"
