import uuid
from datetime import datetime

from sqlalchemy import CHAR, DateTime, ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


# database-schema.md §3.1; no FK to organizations: the link is users.email = registered_email (C-02)
class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("identity_provider", "provider_subject"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    identity_provider: Mapped[str] = mapped_column(String(64))
    provider_subject: Mapped[str] = mapped_column(String(255))
    # Verified @ukma.edu.ua address, stored lowercase
    email: Mapped[str] = mapped_column(String(320), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


# database-schema.md §3.2; the cookie carries the opaque token, only its SHA-256 hex is stored
class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    token_hash: Mapped[str] = mapped_column(CHAR(64), unique=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(lazy="joined")
