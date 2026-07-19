"""0015 携君智库接入 — 合同字段映射 + 入库流水线表。

document 表新增17个YAML映射字段（hr_module, content_type, is_wisdom 等）。
新增 ingestion_task / ingestion_report / demand_insight 三张流水线表。
qa_answer 新增 source_percentages_json 列（A7来源占比）。

Revision ID: 0015_xiejun_contract_fields
Revises: 0014_completed_plans_counter
Create Date: 2026-07-15
"""
from __future__ import annotations

from alembic import op
from sqlalchemy import text

revision: str = "0015"
down_revision: str | None = "0014"
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
        "BOOL": "BOOLEAN" if pg else "INTEGER",
        "BOOL_TRUE": "true" if pg else "1",
        "V8": "VARCHAR(8)",
        "V32": "VARCHAR(32)",
        "V64": "VARCHAR(64)",
        "V255": "VARCHAR(255)",
        "TEXT": "TEXT",
    }


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    t = _types(dialect)

    # ── document 表：新增携君智库YAML映射字段 ──
    doc_new_cols = [
        ("citation_title", t["V255"]),
        ("source_id", t["V64"]),
        ("hr_module", t["V32"]),
        ("content_type", t["V32"]),
        ("is_wisdom", f"{t['BOOL']} DEFAULT {t['BOOL_TRUE']}"),
        ("wisdom_tags", t["JSON"]),
        ("crystal_type", t["V32"]),
        ("sensitivity", f"{t['V8']} DEFAULT 'L1'"),
        ("origin_type", f"{t['V32']} DEFAULT 'manual'"),
        ("keywords", t["JSON"]),
        ("summary", t["TEXT"]),
        ("related_upstream", t["JSON"]),
        ("related_downstream", t["JSON"]),
        ("related_scenario", t["JSON"]),
        ("related_industry", t["JSON"]),
        ("related_source", t["JSON"]),
        ("related_version", t["JSON"]),
        ("wisdom_applied", t["JSON"]),
        ("professional_applied", t["JSON"]),
        ("version_number", t["V32"]),
        ("is_indexed", f"{t['BOOL']} DEFAULT {t['BOOL_TRUE']}"),
    ]
    for col_name, col_type in doc_new_cols:
        # SQLite 不支持 ADD COLUMN IF NOT EXISTS，需先检查列是否存在
        if dialect == "sqlite":
            existing_cols = [row[1] for row in bind.execute(
                text("PRAGMA table_info(document)")
            ).fetchall()]
            if col_name not in existing_cols:
                op.execute(f"ALTER TABLE document ADD COLUMN {col_name} {col_type}")
        else:
            op.execute(f"ALTER TABLE document ADD COLUMN IF NOT EXISTS {col_name} {col_type}")

    # 索引
    for idx_col in ("hr_module", "is_wisdom", "sensitivity"):
        op.execute(
            f"CREATE INDEX IF NOT EXISTS ix_document_{idx_col} "
            f"ON document ({idx_col})"
        )

    # ── ingestion_task 表 ──
    op.execute(f"""
        CREATE TABLE IF NOT EXISTS ingestion_task (
            id {t['UUID']} PRIMARY KEY,
            upload_id {t['V64']} NOT NULL UNIQUE,
            package_id {t['V64']},
            filename {t['V255']},
            file_size_bytes {t['INT']},
            status {t['V32']} DEFAULT 'uploaded',
            total_files {t['INT']} DEFAULT 0,
            processed_files {t['INT']} DEFAULT 0,
            success_count {t['INT']} DEFAULT 0,
            failed_count {t['INT']} DEFAULT 0,
            pending_review_count {t['INT']} DEFAULT 0,
            report_id {t['UUID']},
            error_message {t['TEXT']},
            operator_id {t['UUID']},
            created_at {t['TS']} NOT NULL DEFAULT {t['NOW']},
            updated_at {t['TS']} NOT NULL DEFAULT {t['NOW']},
            schema_version {t['INT']} DEFAULT 1,
            deleted_at {t['TS']}
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_ingestion_task_upload "
        "ON ingestion_task (upload_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_ingestion_task_status "
        "ON ingestion_task (status)"
    )

    # ── ingestion_report 表 ──
    op.execute(f"""
        CREATE TABLE IF NOT EXISTS ingestion_report (
            id {t['UUID']} PRIMARY KEY,
            task_id {t['UUID']} NOT NULL REFERENCES ingestion_task(id),
            package_id {t['V64']},
            process_time {t['TS']},
            status {t['V32']},
            counts {t['JSON']},
            failures {t['JSON']},
            pending_review {t['JSON']},
            created_at {t['TS']} NOT NULL DEFAULT {t['NOW']},
            updated_at {t['TS']} NOT NULL DEFAULT {t['NOW']},
            schema_version {t['INT']} DEFAULT 1,
            deleted_at {t['TS']}
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_ingestion_report_task "
        "ON ingestion_report (task_id)"
    )

    # ── demand_insight 表（B3需求洞察，迭代1预留）──
    op.execute(f"""
        CREATE TABLE IF NOT EXISTS demand_insight (
            id {t['UUID']} PRIMARY KEY,
            user_id {t['UUID']} NOT NULL,
            question {t['TEXT']},
            hr_module_tag {t['V32']},
            miss_level {t['V32']},
            l3_summary {t['TEXT']},
            cluster_id {t['V64']},
            frequency {t['INT']} DEFAULT 1,
            closed {t['BOOL']} DEFAULT {t['BOOL_TRUE']},
            created_at {t['TS']} NOT NULL DEFAULT {t['NOW']},
            updated_at {t['TS']} NOT NULL DEFAULT {t['NOW']},
            schema_version {t['INT']} DEFAULT 1,
            deleted_at {t['TS']}
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_demand_insight_user "
        "ON demand_insight (user_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_demand_insight_cluster "
        "ON demand_insight (cluster_id)"
    )

    # ── qa_answer 表：新增A7来源占比字段 ──
    if dialect == "sqlite":
        qa_cols = [row[1] for row in bind.execute(text("PRAGMA table_info(qa_answer)")).fetchall()]
        if "source_percentages_json" not in qa_cols:
            op.execute(f"ALTER TABLE qa_answer ADD COLUMN source_percentages_json {t['JSON']}")
    else:
        op.execute(f"ALTER TABLE qa_answer ADD COLUMN IF NOT EXISTS source_percentages_json {t['JSON']}")


def downgrade() -> None:
    # 移除 document 新增列
    doc_cols = [
        "citation_title", "source_id", "hr_module", "content_type",
        "is_wisdom", "wisdom_tags", "crystal_type", "sensitivity",
        "origin_type", "keywords", "summary",
        "related_upstream", "related_downstream", "related_scenario",
        "related_industry", "related_source", "related_version",
        "wisdom_applied", "professional_applied", "version_number", "is_indexed",
    ]
    for col in doc_cols:
        op.execute(f"ALTER TABLE document DROP COLUMN IF EXISTS {col}")

    # 移除 qa_answer 新增列
    op.execute("ALTER TABLE qa_answer DROP COLUMN IF EXISTS source_percentages_json")

    # 移除新表
    op.execute("DROP TABLE IF EXISTS demand_insight")
    op.execute("DROP TABLE IF EXISTS ingestion_report")
    op.execute("DROP TABLE IF EXISTS ingestion_task")
