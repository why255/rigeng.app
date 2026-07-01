"""0007 管理后台审计日志表。

新增 admin_audit_log 表，记录所有超管操作：
  grant_teacher / revoke_teacher / change_role / assign_student / unassign_student

Revision ID: 0007_admin_audit_log
Revises: 0006_all_orm_tables
Create Date: 2026-07-01
"""
from __future__ import annotations

from alembic import op

revision = "0007_admin_audit_log"
down_revision = "0006_all_orm_tables"
branch_labels = None
depends_on = None


def _types(dialect: str) -> dict:
    pg = dialect == "postgresql"
    return {
        "UUID": "UUID" if pg else "CHAR(36)",
        "JSON": "JSONB" if pg else "TEXT",
        "TS": "TIMESTAMP",
        "INT": "INTEGER",
        "V64": "VARCHAR(64)",
    }


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    t = _types(dialect)

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS admin_audit_log (
            id {t['UUID']} PRIMARY KEY,
            operator_id {t['UUID']} NOT NULL,
            action {t['V64']} NOT NULL,
            target_user_id {t['UUID']},
            detail {t['JSON']},
            created_at {t['TS']} NOT NULL DEFAULT NOW(),
            schema_version {t['INT']} DEFAULT 1
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_audit_log_operator "
        "ON admin_audit_log (operator_id)",
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_audit_log_target "
        "ON admin_audit_log (target_user_id)",
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_audit_log_action "
        "ON admin_audit_log (action)",
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS admin_audit_log")
