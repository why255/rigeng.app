"""0002 新增 growth_record 表（步骤14·情绪树洞·成长手册）。

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-27
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def _types(dialect: str) -> dict:
    pg = dialect == "postgresql"
    return {
        "UUID": "UUID" if pg else "CHAR(36)",
        "JSON": "JSONB" if pg else "TEXT",
        "TS": "TIMESTAMP",
        "BOOL": "BOOLEAN",
        "INT": "INTEGER",
        "TEXT": "TEXT",
    }


def _common(t: dict) -> str:
    return (
        f"id {t['UUID']} PRIMARY KEY, "
        f"created_at {t['TS']}, updated_at {t['TS']}, "
        f"schema_version {t['INT']} DEFAULT 1, deleted_at {t['TS']}"
    )


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    t = _types(dialect)
    c = _common(t)

    op.execute(f"""
        CREATE TABLE growth_record (
            {c},
            user_id {t['UUID']},
            session_date VARCHAR(16),
            category VARCHAR(32) DEFAULT '情绪调节',
            category_color VARCHAR(16),
            content {t['TEXT']},
            tags {t['JSON']},
            emotion_score {t['INT']},
            courage_value {t['INT']},
            duration_minutes {t['INT']},
            conv_id {t['UUID']},
            is_published {t['BOOL']} DEFAULT FALSE
        )
    """)

    op.execute("CREATE INDEX ix_growth_user_date ON growth_record (user_id, session_date)")
    op.execute("CREATE INDEX ix_growth_conv ON growth_record (conv_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_growth_user_date")
    op.execute("DROP INDEX IF EXISTS ix_growth_conv")
    op.execute("DROP TABLE IF EXISTS growth_record")
