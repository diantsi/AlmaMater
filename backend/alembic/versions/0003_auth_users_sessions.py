"""auth: users, sessions and the event user columns

docs/database-schema.md §3.1, §3.2 and the §3.5 created_by_user_id / cancelled_by_user_id
columns with the full ck_events_cancellation rule. Existing events are development data
without a creator and are deleted so created_by_user_id can be NOT NULL.

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-24 13:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = '0003'
down_revision: Union[str, None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('users',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('identity_provider', sa.String(length=64), nullable=False),
    sa.Column('provider_subject', sa.String(length=255), nullable=False),
    sa.Column('email', sa.String(length=320), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email'),
    sa.UniqueConstraint('identity_provider', 'provider_subject')
    )
    op.create_table('sessions',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('token_hash', sa.CHAR(length=64), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('token_hash')
    )
    op.create_index(op.f('ix_sessions_user_id'), 'sessions', ['user_id'], unique=False)

    # Development rows only (no creator to attribute); seed data no longer contains events
    op.execute('DELETE FROM events')
    op.add_column('events', sa.Column('created_by_user_id', sa.Uuid(), nullable=False))
    op.add_column('events', sa.Column('cancelled_by_user_id', sa.Uuid(), nullable=True))
    op.create_foreign_key(
        'events_created_by_user_id_fkey', 'events', 'users', ['created_by_user_id'], ['id'], ondelete='RESTRICT'
    )
    op.create_foreign_key(
        'events_cancelled_by_user_id_fkey', 'events', 'users', ['cancelled_by_user_id'], ['id'], ondelete='RESTRICT'
    )
    op.drop_constraint('ck_events_cancellation', 'events', type_='check')
    op.create_check_constraint(
        'ck_events_cancellation',
        'events',
        "(status = 'PUBLISHED' AND cancelled_at IS NULL AND cancelled_by_user_id IS NULL)"
        " OR (status = 'CANCELLED' AND cancelled_at IS NOT NULL AND cancelled_by_user_id IS NOT NULL)",
    )


def downgrade() -> None:
    # Deleted development events are not restored
    op.drop_constraint('ck_events_cancellation', 'events', type_='check')
    op.create_check_constraint(
        'ck_events_cancellation',
        'events',
        "(status = 'PUBLISHED' AND cancelled_at IS NULL) OR (status = 'CANCELLED' AND cancelled_at IS NOT NULL)",
    )
    op.drop_constraint('events_cancelled_by_user_id_fkey', 'events', type_='foreignkey')
    op.drop_constraint('events_created_by_user_id_fkey', 'events', type_='foreignkey')
    op.drop_column('events', 'cancelled_by_user_id')
    op.drop_column('events', 'created_by_user_id')
    op.drop_index(op.f('ix_sessions_user_id'), table_name='sessions')
    op.drop_table('sessions')
    op.drop_table('users')
