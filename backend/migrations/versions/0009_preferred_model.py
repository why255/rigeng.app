"""0009 用户模型偏好。

新增 user_account.preferred_model 字段，
支持用户在可用模型列表中切换选择。
默认 NULL = 使用全局配置 ZHIPUAI_MODEL。

Revision ID: 0009_preferred_model
Revises: 0008_algorithm_file
Create Date: 2026-07-10
"""
from __future__ import annotations

from alembic import op

revision = "0009_preferred_model"
down_revision = "0008_algorithm_file"
branch_labels = None
depends_on = None


def _types(dialect: str) -> dict:
    pg = dialect == "postgresql"
    return {"V64": "VARCHAR(64)"}


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    t = _types(dialect)
    op.execute(f"ALTER TABLE user_account ADD COLUMN preferred_model {t['V64']}")


def downgrade() -> None:
    op.execute("ALTER TABLE user_account DROP COLUMN preferred_model")
