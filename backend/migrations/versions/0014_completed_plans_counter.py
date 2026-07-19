"""0014 完成计划计数器 — user_account 新增 completed_plans_count 列。

用户每完成一个计划项，永久 +1。替代之前从 Plan 表统计的瞬时查询。

Revision ID: 0014_completed_plans_counter
Revises: 0013_model_degradation
Create Date: 2026-07-14
"""
from __future__ import annotations

from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels = None
depends_on = None


def _types(dialect: str) -> dict:
    pg = dialect == "postgresql"
    return {
        "INT": "INTEGER",
    }


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    t = _types(dialect)

    op.execute(
        f"ALTER TABLE user_account "
        f"ADD COLUMN IF NOT EXISTS completed_plans_count {t['INT']} DEFAULT 0"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE user_account DROP COLUMN IF EXISTS completed_plans_count")
