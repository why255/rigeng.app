"""0003 新增智能问答表（步骤16·智能问答）。

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-27

三张表：
- qa_conversation: 问答对话会话
- qa_answer: 四要素结构化答案（操作要点+注意事项+沟通话术+达成标准）
- qa_feedback: 纠错反馈记录（防幻觉四级防线第3级）
"""
from alembic import op

revision = "0003"
down_revision = "0002"
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
        "V16": "VARCHAR(16)",
        "V32": "VARCHAR(32)",
        "V64": "VARCHAR(64)",
        "V512": "VARCHAR(512)",
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

    # 1. qa_conversation — 问答对话会话
    op.execute(f"""
        CREATE TABLE qa_conversation (
            {c},
            user_id {t['UUID']},
            question {t['TEXT']},
            rounds {t['INT']} DEFAULT 0,
            source_engines_json {t['JSON']},
            status {t['V16']} DEFAULT 'active',
            answer_id {t['UUID']}
        )
    """)
    op.execute("CREATE INDEX ix_qa_conv_user ON qa_conversation (user_id)")

    # 2. qa_answer — 四要素结构化答案
    op.execute(f"""
        CREATE TABLE qa_answer (
            {c},
            user_id {t['UUID']},
            conversation_id {t['UUID']},
            question {t['TEXT']},
            intro {t['TEXT']},
            elements_json {t['JSON']},
            source_json {t['JSON']},
            has_source_label {t['BOOL']} DEFAULT TRUE,
            has_timeliness_label {t['BOOL']} DEFAULT TRUE,
            audit_status {t['V16']} DEFAULT 'pending',
            model_used {t['V64']},
            generation_cost_tokens {t['INT']} DEFAULT 0,
            archived_to_kb {t['BOOL']} DEFAULT FALSE,
            kb_doc_id {t['UUID']},
            helpful_count {t['INT']} DEFAULT 0,
            unhelpful_count {t['INT']} DEFAULT 0
        )
    """)
    op.execute("CREATE INDEX ix_qa_answer_user ON qa_answer (user_id)")
    op.execute("CREATE INDEX ix_qa_answer_conv ON qa_answer (conversation_id)")

    # 3. qa_feedback — 纠错反馈
    op.execute(f"""
        CREATE TABLE qa_feedback (
            {c},
            user_id {t['UUID']},
            answer_id {t['UUID']},
            feedback_type {t['V32']},
            detail {t['TEXT']},
            status {t['V16']} DEFAULT 'pending',
            resolution_note {t['TEXT']}
        )
    """)
    op.execute("CREATE INDEX ix_qa_feedback_user ON qa_feedback (user_id)")
    op.execute("CREATE INDEX ix_qa_feedback_answer ON qa_feedback (answer_id)")


def downgrade() -> None:
    for idx in [
        "ix_qa_feedback_answer", "ix_qa_feedback_user",
        "ix_qa_answer_conv", "ix_qa_answer_user",
        "ix_qa_conv_user",
    ]:
        op.execute(f"DROP INDEX IF EXISTS {idx}")

    op.execute("DROP TABLE IF EXISTS qa_feedback")
    op.execute("DROP TABLE IF EXISTS qa_answer")
    op.execute("DROP TABLE IF EXISTS qa_conversation")
