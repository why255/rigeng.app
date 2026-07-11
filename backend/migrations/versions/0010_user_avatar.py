"""0010 用户头像字段。

新增 user_account.avatar 字段，存储头像文件的路径/URL。

Revision ID: 0010_user_avatar
Revises: 0009_preferred_model
Create Date: 2026-07-10
"""
from __future__ import annotations

from alembic import op

revision = "0010_user_avatar"
down_revision = "0009_preferred_model"
branch_labels = None
depends_on = None


def _types(dialect: str) -> dict:
    pg = dialect == "postgresql"
    return {"V255": "VARCHAR(255)"}


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    t = _types(dialect)
    op.execute(f"ALTER TABLE user_account ADD COLUMN avatar {t['V255']}")


def downgrade() -> None:
    op.execute("ALTER TABLE user_account DROP COLUMN avatar")
