"""sms_send_log 增加验证码相关字段（phone/purpose/expires_at/verified_at）

Revision ID: 0012
Revises: 0011_career_model_tracking
Create Date: 2026-07-11
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0012'
down_revision: Union[str, None] = '0011_career_model_tracking'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("sms_send_log", "user_id", existing_type=sa.String(), nullable=True)
    op.add_column("sms_send_log", sa.Column("phone", sa.String(32), nullable=True))
    op.add_column("sms_send_log", sa.Column("purpose", sa.String(32), nullable=True))
    op.add_column("sms_send_log", sa.Column("expires_at", sa.DateTime(), nullable=True))
    op.add_column("sms_send_log", sa.Column("verified_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("sms_send_log", "verified_at")
    op.drop_column("sms_send_log", "expires_at")
    op.drop_column("sms_send_log", "purpose")
    op.drop_column("sms_send_log", "phone")
    op.alter_column("sms_send_log", "user_id", existing_type=sa.String(), nullable=False)
