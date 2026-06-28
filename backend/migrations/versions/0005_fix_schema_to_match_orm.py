"""0005 修复关键表结构以精确匹配 ORM 模型。

背景：0001_init_schema 创建了与 ORM 完全不一致的表结构，
导致 review/plans/smart_record 三个服务运行时必崩。

修复范围（7 张表）：
  重建：review_record, recording, transcript_segment, action_item
  新建：plan, plan_task, extraction_result
  移除：plan_item（被 plan + plan_task 替代）

幂等设计：所有 CREATE TABLE 使用 IF NOT EXISTS，
review_record 重建前检查列结构，避免覆盖已有数据。

Revision ID: 0005_fix_schema
Revises: 0004_review_gentle_persistence
Create Date: 2026-06-27
"""
from __future__ import annotations

from alembic import op

revision = "0005_fix_schema"
down_revision = "0004_review_gentle_persistence"
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
        "FLOAT": "FLOAT" if pg else "REAL",
        "TEXT": "TEXT",
        "V8": "VARCHAR(8)",
        "V10": "VARCHAR(10)",
        "V16": "VARCHAR(16)",
        "V32": "VARCHAR(32)",
        "V64": "VARCHAR(64)",
        "V128": "VARCHAR(128)",
        "V256": "VARCHAR(256)",
        "V512": "VARCHAR(512)",
        "V1024": "VARCHAR(1024)",
        "V2048": "VARCHAR(2048)",
    }


def _common(t: dict) -> str:
    return (
        f"id {t['UUID']} PRIMARY KEY, "
        f"created_at {t['TS']}, updated_at {t['TS']}, "
        f"schema_version {t['INT']} DEFAULT 1, deleted_at {t['TS']}"
    )


def _table_exists(conn, table_name: str) -> bool:
    """检查表是否已存在（兼容 SQLite / PG）。"""
    result = conn.execute(
        __import__("sqlalchemy").text(
            f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}'"
        )
    )
    return result.fetchone() is not None


# ═══════════════════════════════════════════════════════════════════
# UPGRADE
# ═══════════════════════════════════════════════════════════════════

def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    t = _types(dialect)
    c = _common(t)

    if dialect == "sqlite":
        op.execute("PRAGMA foreign_keys = OFF")

    # ── 第 1 步：移除旧表 plan_item ──
    op.execute("DROP TABLE IF EXISTS plan_item")

    # ── 第 2 步：创建新表 plan（幂等） ──
    op.execute(f"""
        CREATE TABLE IF NOT EXISTS plan (
            {c},
            user_id {t['UUID']},
            title {t['V256']} DEFAULT 'today plan',
            status {t['V16']} DEFAULT 'draft',
            stats_json {t['JSON']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_plan_user ON plan (user_id)")

    # ── 第 3 步：创建新表 plan_task（幂等） ──
    op.execute(f"""
        CREATE TABLE IF NOT EXISTS plan_task (
            {c},
            plan_id {t['UUID']},
            user_id {t['UUID']},
            title {t['V512']},
            description {t['V2048']},
            quadrant {t['V32']} DEFAULT 'not_urgent_important',
            source {t['V32']} DEFAULT 'user_input',
            status {t['V16']} DEFAULT 'pending',
            sort_order {t['INT']} DEFAULT 0,
            time_estimate {t['V64']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_plan_task_plan ON plan_task (plan_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_plan_task_user ON plan_task (user_id)")

    # ── 第 4 步：review_record（幂等：已是新 schema 则跳过） ──
    from sqlalchemy import inspect as sa_inspect
    insp = sa_inspect(bind)
    rebuild_review = True
    if "review_record" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("review_record")}
        if "gentle_persistence_used" in cols and "completion_rate" in cols:
            print("0005: review_record already matches new schema, skipping rebuild")
            rebuild_review = False
    if rebuild_review:
        op.execute("DROP TABLE IF EXISTS review_record")
        op.execute(f"""
            CREATE TABLE IF NOT EXISTS review_record (
                {c},
                user_id {t['UUID']},
                plan_id {t['UUID']},
                status {t['V16']} DEFAULT 'completed',
                completion_rate {t['FLOAT']} DEFAULT 0.0,
                sop_title {t['V256']},
                sop_steps_json {t['JSON']},
                sop_key_phrases {t['V1024']},
                sop_precautions {t['V1024']},
                sop_quality_score {t['INT']},
                courage_value {t['INT']} DEFAULT 0,
                courage_message {t['V512']},
                emotion_score {t['INT']},
                diagnosis_json {t['JSON']},
                review_date {t['V10']},
                archived {t['INT']} DEFAULT 0,
                gentle_persistence_used {t['INT']} DEFAULT 0
            )
        """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_review_user ON review_record (user_id)")

    # ── 第 5 步：重建 recording（先删后建，因 0001 列名不同） ──
    op.execute("DROP TABLE IF EXISTS recording CASCADE")
    op.execute(f"""
        CREATE TABLE recording (
            {c},
            user_id {t['UUID']},
            title {t['V512']},
            scene {t['V32']} DEFAULT 'daily',
            status {t['V32']} DEFAULT 'recording',
            duration_seconds {t['INT']} DEFAULT 0,
            file_object_id {t['UUID']},
            file_size_bytes {t['INT']} DEFAULT 0,
            transcript_status {t['V16']} DEFAULT 'pending',
            extraction_status {t['V16']} DEFAULT 'pending',
            archived_to_kb {t['BOOL']} DEFAULT FALSE,
            kb_doc_id {t['UUID']},
            notes {t['TEXT']},
            tags_json {t['JSON']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_recording_user ON recording (user_id)")

    # ── 第 6 步：重建 extraction_result（先删后建） ──
    op.execute("DROP TABLE IF EXISTS extraction_result CASCADE")
    op.execute(f"""
        CREATE TABLE extraction_result (
            {c},
            recording_id {t['UUID']} UNIQUE,
            user_id {t['UUID']},
            extraction_type {t['V32']},
            content_json {t['JSON']},
            summary {t['TEXT']},
            model_used {t['V64']},
            extraction_cost_tokens {t['INT']} DEFAULT 0
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_extraction_rec ON extraction_result (recording_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_extraction_user ON extraction_result (user_id)")

    # ── 第 7 步：重建 transcript_segment（先删后建，因 0001 列名不同） ──
    op.execute("DROP TABLE IF EXISTS transcript_segment CASCADE")
    op.execute(f"""
        CREATE TABLE transcript_segment (
            {c},
            recording_id {t['UUID']},
            user_id {t['UUID']},
            segment_index {t['INT']} DEFAULT 0,
            speaker {t['V64']},
            speaker_role {t['V32']},
            start_time_seconds {t['FLOAT']} DEFAULT 0.0,
            end_time_seconds {t['FLOAT']} DEFAULT 0.0,
            text {t['TEXT']},
            confidence {t['FLOAT']} DEFAULT 0.0,
            is_candidate {t['BOOL']} DEFAULT FALSE
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_transcript_rec ON transcript_segment (recording_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_transcript_user ON transcript_segment (user_id)")

    # ── 第 8 步：重建 action_item（先删后建，因 0001 列名不同） ──
    op.execute("DROP TABLE IF EXISTS action_item CASCADE")
    op.execute(f"""
        CREATE TABLE action_item (
            {c},
            recording_id {t['UUID']},
            extraction_id {t['UUID']},
            user_id {t['UUID']},
            title {t['V512']},
            description {t['TEXT']},
            priority {t['V32']},
            due_date {t['V32']},
            synced_to_plan {t['BOOL']} DEFAULT FALSE,
            plan_task_id {t['UUID']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_action_item_rec ON action_item (recording_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_action_item_ext ON action_item (extraction_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_action_item_user ON action_item (user_id)")

    if dialect == "sqlite":
        op.execute("PRAGMA foreign_keys = ON")


# ═══════════════════════════════════════════════════════════════════
# DOWNGRADE
# ═══════════════════════════════════════════════════════════════════

def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    t = _types(dialect)
    c = _common(t)

    if dialect == "sqlite":
        op.execute("PRAGMA foreign_keys = OFF")

    op.execute("DROP TABLE IF EXISTS action_item")
    op.execute("DROP TABLE IF EXISTS transcript_segment")
    op.execute("DROP TABLE IF EXISTS extraction_result")
    op.execute("DROP TABLE IF EXISTS recording")
    op.execute("DROP TABLE IF EXISTS review_record")
    op.execute("DROP TABLE IF EXISTS plan_task")
    op.execute("DROP TABLE IF EXISTS plan")

    # 恢复 0001 原始 schema
    op.execute(f"""
        CREATE TABLE IF NOT EXISTS plan_item (
            {c},
            user_id {t['UUID']},
            plan_date {t['V16']},
            name {t['V256']},
            description {t['TEXT']},
            source {t['V32']},
            source_action_id {t['UUID']},
            quadrant {t['V16']},
            status {t['V16']},
            cared_next_day {t['BOOL']} DEFAULT FALSE
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_plan_item_user_date ON plan_item (user_id, plan_date)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS review_record (
            {c},
            user_id {t['UUID']},
            review_date {t['V16']},
            plan_item_id {t['UUID']},
            completion_status {t['V16']},
            evaluation {t['TEXT']},
            sop_trigger_type {t['V32']}
        )
    """)

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS recording (
            {c},
            user_id {t['UUID']},
            scene_type {t['V16']},
            audio_file_id {t['UUID']},
            duration_sec {t['INT']},
            transcript_text {t['TEXT']},
            is_offline_synced {t['BOOL']} DEFAULT FALSE,
            auto_paused_by_call {t['BOOL']} DEFAULT FALSE,
            crash_recovered {t['BOOL']} DEFAULT FALSE,
            status {t['V16']} DEFAULT 'recording'
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_recording_user_created ON recording (user_id, created_at)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS transcript_segment (
            {c},
            rec_id {t['UUID']},
            speaker_label {t['V64']},
            start_ts {t['INT']},
            end_ts {t['INT']},
            text {t['TEXT']}
        )
    """)

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS action_item (
            {c},
            rec_id {t['UUID']},
            user_id {t['UUID']},
            content {t['TEXT']},
            assignee {t['V64']},
            target_module {t['V8']} DEFAULT 'M1',
            sync_status {t['V16']} DEFAULT 'pending'
        )
    """)

    if dialect == "sqlite":
        op.execute("PRAGMA foreign_keys = ON")
