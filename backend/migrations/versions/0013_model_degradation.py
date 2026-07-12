"""0013 模型降级 — 模型配置表 & 模块绑定表。

新增 model_config 表（模型版本目录）和 module_model_binding 表（模块→模型绑定），
使管理员可在后台动态调整模块使用的模型版本，无需修改代码+重启。

Revision ID: 0013_model_degradation
Revises: 0012_sms_log_add_verification
Create Date: 2026-07-12
"""
from __future__ import annotations

from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
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
        "BOOL": "BOOLEAN" if pg else "INTEGER",  # SQLite: 0/1
        "V64": "VARCHAR(64)",
        "V128": "VARCHAR(128)",
        "V255": "VARCHAR(255)",
    }


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    t = _types(dialect)
    import uuid as _uuid
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()

    # ── model_config 表 ──
    op.execute(f"""
        CREATE TABLE IF NOT EXISTS model_config (
            id {t['UUID']} PRIMARY KEY,
            provider_key {t['V64']} NOT NULL,
            model_name {t['V128']} NOT NULL,
            model_version {t['V64']} NOT NULL,
            display_name {t['V255']},
            is_available {t['BOOL']} DEFAULT 1,
            created_at {t['TS']} NOT NULL DEFAULT {t['NOW']},
            updated_at {t['TS']} NOT NULL DEFAULT {t['NOW']},
            schema_version {t['INT']} DEFAULT 1,
            deleted_at {t['TS']},
            UNIQUE (provider_key, model_name)
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_model_config_provider "
        "ON model_config (provider_key)",
    )

    # ── module_model_binding 表 ──
    op.execute(f"""
        CREATE TABLE IF NOT EXISTS module_model_binding (
            id {t['UUID']} PRIMARY KEY,
            module_key {t['V64']} NOT NULL,
            module_display_name {t['V128']},
            model_config_id {t['UUID']} NOT NULL REFERENCES model_config(id),
            is_active {t['BOOL']} DEFAULT 1,
            created_at {t['TS']} NOT NULL DEFAULT {t['NOW']},
            updated_at {t['TS']} NOT NULL DEFAULT {t['NOW']},
            schema_version {t['INT']} DEFAULT 1,
            deleted_at {t['TS']},
            UNIQUE (module_key, model_config_id)
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_module_binding_module "
        "ON module_model_binding (module_key)",
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_module_binding_model "
        "ON module_model_binding (model_config_id)",
    )

    # ── 种子数据：模型版本 ──
    models = [
        ("volcano", "doubao-seed-2-0-pro", "2.0-pro", "豆包 Seed 2.0 Pro"),
        ("volcano", "doubao-seed-2-0-pro-260215", "2.0-pro-260215", "豆包 Seed 2.0 Pro 多模态"),
        ("dashscope", "qwen3.7-max-preview", "3.7-max", "通义千问 Qwen3.7-Max"),
        ("hunyuan", "hy3-preview", "3-preview", "腾讯混元 Hy3"),
        ("kimi", "kimi-k2.5", "k2.5", "Kimi K2.5"),
        ("deepseek", "deepseek-chat", "v4-pro", "DeepSeek V4-Pro"),
        ("zhipu", "glm-4.5", "4.5", "智谱 GLM-4.5"),
        ("zhipu", "GLM-4.7", "4.7", "智谱 GLM-4.7"),
        ("zhipu", "GLM-4.5-Air", "4.5-Air", "智谱 GLM-4.5-Air"),
        ("zhipu", "glm-4-flash", "4-flash", "智谱 GLM-4-Flash"),
        ("anthropic", "claude-sonnet-4-6", "sonnet-4.6", "Claude Sonnet 4.6"),
    ]
    for provider_key, model_name, version, display_name in models:
        mid = _uuid.uuid4().hex
        op.execute(
            f"INSERT OR IGNORE INTO model_config "
            f"(id, provider_key, model_name, model_version, display_name, is_available, created_at, updated_at, schema_version) "
            f"VALUES ('{mid}', '{provider_key}', '{model_name}', '{version}', '{display_name}', 1, '{now}', '{now}', 1)"
        )

    # ── 种子数据：模块→模型绑定 ──
    # model_config_id lookup map
    bindings = [
        ("morning_plan", "朝有规划", "doubao-seed-2-0-pro"),
        ("evening_review", "暮有复盘", "doubao-seed-2-0-pro"),
        ("emotion_treehole", "情绪树洞", "doubao-seed-2-0-pro"),
        ("mood_haven", "情绪港湾", "doubao-seed-2-0-pro"),
        ("smart_qa", "智能问答", "doubao-seed-2-0-pro"),
        ("smart_office", "智能办公", "doubao-seed-2-0-pro"),
        ("career", "高维求职", "doubao-seed-2-0-pro"),
        ("smart_job", "智能求职", "doubao-seed-2-0-pro"),
        ("general", "通用模块", "doubao-seed-2-0-pro"),
        ("hr_template", "HR模板", "qwen3.7-max-preview"),
        ("smart_record", "会议纪要", "hy3-preview"),
        ("knowledge_base", "知识库", "kimi-k2.5"),
        ("growth_analysis", "成长分析", "deepseek-chat"),
        ("brand_building", "品牌建设", "glm-4.5"),
        ("ip_creation", "IP创作", "glm-4.5"),
        ("multimodal", "多模态解析", "doubao-seed-2-0-pro-260215"),
    ]
    for module_key, display_name, model_name in bindings:
        bid = _uuid.uuid4().hex
        # Subquery to get the model_config_id
        op.execute(
            f"INSERT OR IGNORE INTO module_model_binding "
            f"(id, module_key, module_display_name, model_config_id, is_active, created_at, updated_at, schema_version) "
            f"SELECT '{bid}', '{module_key}', '{display_name}', id, 1, '{now}', '{now}', 1 "
            f"FROM model_config WHERE model_name = '{model_name}' AND deleted_at IS NULL"
        )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS module_model_binding")
    op.execute("DROP TABLE IF EXISTS model_config")
