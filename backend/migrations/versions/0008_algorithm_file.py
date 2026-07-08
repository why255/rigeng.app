"""0008 算法文件表。

新增 algorithm_file 表，管理员上传各模块算法文件，
AI 调用时按 module_key 检索并注入 system prompt。

Revision ID: 0008_algorithm_file
Revises: 0007_admin_audit_log
Create Date: 2026-07-08
"""
from __future__ import annotations

from alembic import op

revision = "0008_algorithm_file"
down_revision = "0007_admin_audit_log"
branch_labels = None
depends_on = None


def _types(dialect: str) -> dict:
    pg = dialect == "postgresql"
    return {
        "UUID": "UUID" if pg else "CHAR(36)",
        "JSON": "JSONB" if pg else "TEXT",
        "TS": "TIMESTAMP",
        "NOW": "NOW()" if pg else "CURRENT_TIMESTAMP",
        "INT": "INTEGER",
        "V64": "VARCHAR(64)",
        "V255": "VARCHAR(255)",
        "TEXT": "TEXT",
    }


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    t = _types(dialect)

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS algorithm_file (
            id {t['UUID']} PRIMARY KEY,
            module_key {t['V64']} NOT NULL,
            filename {t['V255']} NOT NULL,
            original_filename {t['V255']} NOT NULL,
            content {t['TEXT']} NOT NULL,
            file_size {t['INT']} DEFAULT 0,
            uploaded_by {t['UUID']},
            created_at {t['TS']} NOT NULL DEFAULT {t['NOW']},
            updated_at {t['TS']} NOT NULL DEFAULT {t['NOW']},
            schema_version {t['INT']} DEFAULT 1,
            deleted_at {t['TS']}
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_algorithm_file_module "
        "ON algorithm_file (module_key)",
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_algorithm_file_uploader "
        "ON algorithm_file (uploaded_by)",
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS algorithm_file")
