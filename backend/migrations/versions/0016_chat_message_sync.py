"""0016 全模块数据互通 — chat_message 表 + user_account.settings_json 列。

新增 chat_message 表存储6个模块的聊天消息（跨设备互通）。
user_account 新增 settings_json 列存储跨设备设置偏好。

Revision ID: 0016_chat_message_sync
Revises: 0015_xiejun_contract_fields
Create Date: 2026-07-16
"""
from __future__ import annotations

from alembic import op
from sqlalchemy import text

revision: str = "0016"
down_revision: str | None = "0015"
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
        "V8": "VARCHAR(8)",
        "V16": "VARCHAR(16)",
        "TEXT": "TEXT",
    }


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    t = _types(dialect)

    # ── chat_message 表 ──
    op.execute(f"""
        CREATE TABLE IF NOT EXISTS chat_message (
            id {t['UUID']} PRIMARY KEY,
            user_id {t['UUID']} NOT NULL REFERENCES user_account(id),
            module {t['V8']} NOT NULL,
            chat_date {t['V16']} NOT NULL,
            role {t['V16']} NOT NULL,
            text {t['TEXT']} NOT NULL,
            type {t['V8']} DEFAULT 'text',
            seq {t['INT']} DEFAULT 0,
            created_at {t['TS']} NOT NULL DEFAULT {t['NOW']},
            updated_at {t['TS']} NOT NULL DEFAULT {t['NOW']},
            schema_version {t['INT']} DEFAULT 1,
            deleted_at {t['TS']}
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_chat_message_user_module_date_seq "
        "ON chat_message (user_id, module, chat_date, seq)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_chat_message_user_id "
        "ON chat_message (user_id)"
    )

    # ── user_account 表：新增 settings_json 列 ──
    if dialect == "sqlite":
        cols = [row[1] for row in bind.execute(text("PRAGMA table_info(user_account)")).fetchall()]
        if "settings_json" not in cols:
            op.execute(f"ALTER TABLE user_account ADD COLUMN settings_json {t['JSON']}")
    else:
        op.execute(f"ALTER TABLE user_account ADD COLUMN IF NOT EXISTS settings_json {t['JSON']}")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS chat_message")
    op.execute("ALTER TABLE user_account DROP COLUMN IF EXISTS settings_json")
