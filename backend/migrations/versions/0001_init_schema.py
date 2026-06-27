"""0001 初始化全量表结构（步骤7·数据库初始化：13模块/9数据域一次性建表）。

设计：方言感知 DDL，PostgreSQL 与 SQLite 均可执行；可 upgrade/downgrade 回滚。
PostgreSQL 额外启用 pgvector 并为 vector_index 增加 embedding 向量列。

Revision ID: 0001
Revises:
Create Date: 2026-06-19
"""
from alembic import op

revision = "0001"
down_revision = None
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
        "BIG": "BIGINT",
        "NUM": "NUMERIC(5,2)",
    }


# 通用列：主键 + 时间戳 + 版本 + 软删除
def _common(t: dict) -> str:
    return (
        f"id {t['UUID']} PRIMARY KEY, "
        f"created_at {t['TS']}, updated_at {t['TS']}, "
        f"schema_version {t['INT']} DEFAULT 1, deleted_at {t['TS']}"
    )


def _tables(t: dict) -> dict[str, str]:
    """返回 {表名: 列定义SQL}。覆盖九大数据域全部表。"""
    c = _common(t)
    return {
        # ── 用户域 ──
        "user_account": f"{c}, phone VARCHAR(32) UNIQUE, password_hash VARCHAR(255), "
                        f"nickname VARCHAR(64), gender VARCHAR(16), addressing VARCHAR(32), "
                        f"role VARCHAR(16) DEFAULT 'student', voice_type VARCHAR(16), "
                        f"care_mode VARCHAR(16) DEFAULT 'active', trial_start_at {t['TS']}, "
                        f"push_timezone VARCHAR(32) DEFAULT 'Asia/Shanghai', status VARCHAR(16) DEFAULT 'active'",
        "user_disclaimer": f"{c}, user_id {t['UUID']}, disclaimer_type VARCHAR(32), "
                           f"accepted_at {t['TS']}, accepted_version VARCHAR(32)",
        "vip_membership": f"{c}, user_id {t['UUID']}, level VARCHAR(16) DEFAULT 'trial', "
                          f"storage_quota_mb {t['BIG']}, storage_used_mb {t['BIG']} DEFAULT 0, "
                          f"record_quota_min_monthly {t['INT']}, record_used_min_monthly {t['INT']} DEFAULT 0, "
                          f"video_quota_min_monthly {t['INT']}, video_used_min_monthly {t['INT']} DEFAULT 0, "
                          f"space_full_blocked {t['BOOL']} DEFAULT FALSE, start_at {t['TS']}, expire_at {t['TS']}",
        "teacher_profile": f"{c}, teacher_id {t['UUID']}, bio VARCHAR(1024), expertise_tags {t['JSON']}, "
                           f"service_status VARCHAR(16) DEFAULT '可接单', rating {t['NUM']}",
        "teacher_assignment": f"{c}, teacher_id {t['UUID']}, student_id {t['UUID']}, assigned_by {t['UUID']}, "
                              f"nda_signed {t['BOOL']} DEFAULT FALSE, private_kb_readonly {t['BOOL']} DEFAULT FALSE, "
                              f"status VARCHAR(16) DEFAULT 'active'",
        "contribution_balance": f"{c}, user_id {t['UUID']} UNIQUE, balance {t['INT']} DEFAULT 0, level VARCHAR(16) DEFAULT '青铜'",
        "contribution_log": f"{c}, user_id {t['UUID']}, change {t['INT']}, reason VARCHAR(128), ref_id VARCHAR(64)",
        "referral": f"{c}, referrer_user_id {t['UUID']}, referee_user_id {t['UUID']}, qr_code VARCHAR(255), "
                    f"registered_at {t['TS']}, contribution_awarded {t['BOOL']} DEFAULT FALSE",
        "contribution_rule_config": f"{c}, rule_type VARCHAR(16), action_name VARCHAR(64), points {t['INT']}, "
                                    f"is_active {t['BOOL']} DEFAULT TRUE, updated_by {t['UUID']}",
        # ── 权限域 ──
        "role": f"{c}, name VARCHAR(32) UNIQUE, description VARCHAR(255)",
        "permission": f"{c}, code VARCHAR(64) UNIQUE, description VARCHAR(255)",
        "role_permission": f"{c}, role_id {t['UUID']}, permission_id {t['UUID']}",
        "authorization_grant": f"{c}, grantor_user_id {t['UUID']}, grantee VARCHAR(64), scope VARCHAR(32), "
                               f"granted_at {t['TS']}, revoked_at {t['TS']}",
        # ── 知识库域 ──
        "document": f"{c}, owner_user_id {t['UUID']}, library_type VARCHAR(16) DEFAULT 'private', "
                    f"doc_type VARCHAR(32), source_module VARCHAR(8), hr_category VARCHAR(32), title VARCHAR(255), "
                    f"content {t['JSON']}, folder_id {t['UUID']}, status VARCHAR(16) DEFAULT 'draft', "
                    f"audit_status VARCHAR(16) DEFAULT 'pending', is_desensitized {t['BOOL']} DEFAULT FALSE, "
                    f"is_negative_blocked {t['BOOL']} DEFAULT FALSE, watermark_required {t['BOOL']} DEFAULT FALSE, "
                    f"copy_char_limit {t['INT']}, trace_marker {t['JSON']}, file_object_id {t['UUID']}, "
                    f"vector_status VARCHAR(16) DEFAULT 'pending', version {t['INT']} DEFAULT 1, "
                    f"is_starred {t['BOOL']} DEFAULT FALSE, growth_confirmed_by {t['UUID']}",
        "document_version": f"{c}, doc_id {t['UUID']}, version {t['INT']}, content_snapshot {t['JSON']}, edited_by {t['UUID']}",
        "folder": f"{c}, owner_user_id {t['UUID']}, name VARCHAR(128), parent_id {t['UUID']}, hr_category VARCHAR(32)",
        "doc_tag": f"{c}, doc_id {t['UUID']}, tag VARCHAR(64)",
        "file_object": f"{c}, storage_url VARCHAR(512), file_type VARCHAR(16), size_bytes {t['BIG']}, "
                       f"duration_sec {t['INT']}, compress_status VARCHAR(16) DEFAULT 'raw', "
                       f"storage_layer VARCHAR(16) DEFAULT 'cloud', checksum VARCHAR(128)",
        "audit_queue": f"{c}, doc_id {t['UUID']} UNIQUE, entered_at {t['TS']}, expire_remind_at {t['TS']}",
        "vector_index": f"{c}, doc_id {t['UUID']}, chunk_id {t['INT']}, meta {t['JSON']}",  # PG 追加 embedding 列
        "public_kb_meta": f"{c}, doc_id {t['UUID']}, author VARCHAR(64), is_historical {t['BOOL']} DEFAULT FALSE, monthly_batch VARCHAR(32)",
        "contribution_submission": f"{c}, doc_id {t['UUID']}, submit_user_id {t['UUID']}, audit_result VARCHAR(16), reward_value {t['INT']}",
        "content_policy_rule": f"{c}, rule_type VARCHAR(32), category VARCHAR(32), keyword_or_pattern VARCHAR(255), "
                               f"action VARCHAR(16), priority {t['INT']} DEFAULT 0, is_active {t['BOOL']} DEFAULT TRUE, updated_by {t['UUID']}",
        "growth_replay_material": f"{c}, user_id {t['UUID']}, source_doc_id {t['UUID']}, confirmed_by_user {t['BOOL']} DEFAULT FALSE, "
                                  f"confirmed_at {t['TS']}, brand_doc_id {t['UUID']}, is_published {t['BOOL']} DEFAULT FALSE",
        # ── 对话域 ──
        "conversation": f"{c}, user_id {t['UUID']}, module VARCHAR(8), session_type VARCHAR(32), status VARCHAR(16), "
                        f"is_offline {t['BOOL']} DEFAULT FALSE, context_cache {t['JSON']}, started_at {t['TS']}, ended_at {t['TS']}",
        "message": f"{c}, conv_id {t['UUID']}, role VARCHAR(16), content {t['JSON']}, audio_file_id {t['UUID']}, "
                   f"emotion_label VARCHAR(8), emotion_intensity VARCHAR(16), ts {t['TS']}",
        "plan_item": f"{c}, user_id {t['UUID']}, plan_date VARCHAR(16), name VARCHAR(255), description TEXT, "
                     f"source VARCHAR(32), source_action_id {t['UUID']}, quadrant VARCHAR(16), status VARCHAR(16), "
                     f"cared_next_day {t['BOOL']} DEFAULT FALSE",
        "review_record": f"{c}, user_id {t['UUID']}, review_date VARCHAR(16), plan_item_id {t['UUID']}, "
                         f"completion_status VARCHAR(16), evaluation TEXT, sop_trigger_type VARCHAR(32)",
        "emotion_score": f"{c}, user_id {t['UUID']}, score_date VARCHAR(16), score {t['INT']}, source VARCHAR(32), "
                         f"user_reported_score {t['INT']}, model_extracted_score {t['INT']}, "
                         f"is_corrected {t['BOOL']} DEFAULT FALSE, corrected_score {t['INT']}",
        "crisis_log": f"{c}, user_id_hashed VARCHAR(64), triggered_at {t['TS']}, crisis_type VARCHAR(32), intervention_result VARCHAR(64)",
        "transition_trigger": f"{c}, user_id {t['UUID']}, source_conv_id {t['UUID']}, source_module VARCHAR(8), "
                              f"trigger_keywords {t['JSON']}, triggered_at {t['TS']}, user_accepted {t['BOOL']} DEFAULT FALSE, lead_to_m9_at {t['TS']}",
        # ── 记录域 ──
        "recording": f"{c}, user_id {t['UUID']}, scene_type VARCHAR(16), audio_file_id {t['UUID']}, duration_sec {t['INT']}, "
                     f"transcript_text TEXT, is_offline_synced {t['BOOL']} DEFAULT FALSE, auto_paused_by_call {t['BOOL']} DEFAULT FALSE, "
                     f"crash_recovered {t['BOOL']} DEFAULT FALSE, status VARCHAR(16) DEFAULT 'recording'",
        "transcript_segment": f"{c}, rec_id {t['UUID']}, speaker_label VARCHAR(64), start_ts {t['INT']}, end_ts {t['INT']}, text TEXT",
        "action_item": f"{c}, rec_id {t['UUID']}, user_id {t['UUID']}, content TEXT, assignee VARCHAR(64), "
                       f"target_module VARCHAR(8) DEFAULT 'M1', sync_status VARCHAR(16) DEFAULT 'pending'",
        "interview_lifecycle": f"{c}, user_id {t['UUID']}, job_journey_id {t['UUID']}, phase VARCHAR(16), strategy_doc_id {t['UUID']}, "
                               f"recording_id {t['UUID']}, review_doc_id {t['UUID']}, enterprise_intel_id {t['UUID']}, status VARCHAR(16)",
        # ── 生产域 ──
        "office_workflow": f"{c}, user_id {t['UUID']}, type VARCHAR(16), hr_module VARCHAR(32), status VARCHAR(16), "
                           f"draft_data {t['JSON']}, draft_updated_at {t['TS']}, expire_at {t['TS']}, confirm_submit_at {t['TS']}",
        "collaboration_session": f"{c}, doc_id {t['UUID']}, participants {t['JSON']}, crdt_state {t['JSON']}",
        "module_relation": f"{c}, source_module VARCHAR(8), target_module VARCHAR(8), field_mapping {t['JSON']}",
        "job_journey": f"{c}, user_id {t['UUID']}, current_step VARCHAR(16), status VARCHAR(16), data {t['JSON']}",
        "enterprise_intel": f"{c}, target_company VARCHAR(128), collected_by_teacher {t['UUID']}, source {t['JSON']}, "
                            f"ai_draft_at {t['TS']}, audit_status VARCHAR(16), delivery_status VARCHAR(16), is_small_company_skip {t['BOOL']} DEFAULT FALSE",
        "brand_publish_record": f"{c}, content_doc_id {t['UUID']}, channel VARCHAR(16), status VARCHAR(16), confirm_deadline {t['TS']}, published_at {t['TS']}",
        "wechat_publish_draft": f"{c}, user_id {t['UUID']}, brand_doc_id {t['UUID']}, draft_title VARCHAR(255), draft_content TEXT, "
                                f"status VARCHAR(16), scheduled_at {t['TS']}, preview_confirmed {t['BOOL']} DEFAULT FALSE, "
                                f"publish_result {t['JSON']}, pause_reason VARCHAR(128)",
        "ai_image_record": f"{c}, user_id {t['UUID']}, brand_doc_id {t['UUID']}, style VARCHAR(16), prompt TEXT, "
                           f"image_url VARCHAR(512), is_used {t['BOOL']} DEFAULT FALSE, style_change_at {t['TS']}",
        "courage_value": f"{c}, user_id {t['UUID']}, value {t['INT']} DEFAULT 0, milestones {t['JSON']}, "
                         f"last_publish_at {t['TS']}, last_negotiation_fail_at {t['TS']}",
        # ── 项目域 ──
        "consulting_client": f"{c}, user_id {t['UUID']}, company_name VARCHAR(128), industry VARCHAR(64), scale VARCHAR(32), "
                             f"lead_source VARCHAR(32), brand_doc_id {t['UUID']}, status VARCHAR(16)",
        "negotiation_round": f"{c}, client_id {t['UUID']}, recording_id {t['UUID']}, strategy_doc_id {t['UUID']}, achievement_analysis {t['JSON']}",
        "roleplay_session": f"{c}, user_id {t['UUID']}, scenario VARCHAR(64), role VARCHAR(16), score_a {t['INT']}, "
                            f"score_b {t['JSON']}, total_score {t['INT']}, pass_flag {t['BOOL']} DEFAULT FALSE",
        "abs_diagnosis": f"{c}, client_id {t['UUID']}, questionnaire_version VARCHAR(32), dimensions {t['JSON']}, "
                         f"report_v1_doc_id {t['UUID']}, report_v2_doc_id {t['UUID']}, version_naming VARCHAR(8), status VARCHAR(16)",
        "product_prestudy": f"{c}, user_id {t['UUID']}, template_type VARCHAR(32), draft_doc_id {t['UUID']}, status VARCHAR(16)",
        "project": f"{c}, user_id {t['UUID']}, client_id {t['UUID']}, solution_doc_id {t['UUID']}, "
                   f"actual_start_date VARCHAR(16), actual_end_date VARCHAR(16), status VARCHAR(16)",
        "project_team": f"{c}, project_id {t['UUID']}, member_user_id {t['UUID']}, role VARCHAR(16)",
        "gantt_task": f"{c}, project_id {t['UUID']}, parent_task_id {t['UUID']}, name VARCHAR(255), plan_start VARCHAR(16), "
                      f"plan_end VARCHAR(16), actual_start VARCHAR(16), actual_end VARCHAR(16), status VARCHAR(16), overdue_days {t['INT']} DEFAULT 0",
        "issue": f"{c}, project_id {t['UUID']}, status VARCHAR(16), assignee VARCHAR(64), priority VARCHAR(16), solution TEXT, source VARCHAR(32)",
        "coaching_session": f"{c}, teacher_id {t['UUID']}, student_id {t['UUID']}, module VARCHAR(8), scheduled_at {t['TS']}, "
                            f"recording_file_id {t['UUID']}, rating_by_student {t['NUM']}, status VARCHAR(16), rescheduled_from {t['UUID']}",
        # ── 分析域 ──
        "event_log": f"{c}, user_id {t['UUID']}, module VARCHAR(8), event_type VARCHAR(64), properties {t['JSON']}, ts {t['TS']}",
        "metric_daily": f"{c}, user_id {t['UUID']}, mdate VARCHAR(16), metric_type VARCHAR(64), value {t['NUM']}",
        "care_push_log": f"{c}, user_id {t['UUID']}, type VARCHAR(16), trigger_condition VARCHAR(64), pushed_at {t['TS']}, intercepted_reason VARCHAR(64)",
        "sms_send_log": f"{c}, user_id {t['UUID']}, trigger_condition VARCHAR(64), module VARCHAR(8), sent_at {t['TS']}",
        "teacher_bridge_log": f"{c}, user_id {t['UUID']}, teacher_id {t['UUID']}, module VARCHAR(8), accepted {t['BOOL']} DEFAULT FALSE",
        "push_rule_template": f"{c}, trigger_condition VARCHAR(64), module VARCHAR(8), push_type VARCHAR(16), priority {t['INT']}, "
                              f"max_per_week {t['INT']}, push_window_start {t['INT']}, push_window_end {t['INT']}, "
                              f"new_user_quiet_days {t['INT']} DEFAULT 7, template_text TEXT, is_active {t['BOOL']} DEFAULT TRUE",
        # ── 离线与端侧域 ──
        "offline_sync_queue": f"{c}, user_id {t['UUID']}, module VARCHAR(8), entity_type VARCHAR(32), local_entity_id VARCHAR(64), "
                              f"action VARCHAR(16), payload {t['JSON']}, created_offline_at {t['TS']}, synced_at {t['TS']}, retry_count {t['INT']} DEFAULT 0",
        "dialect_model_meta": f"{c}, dialect VARCHAR(16), model_version VARCHAR(32), package_size_mb {t['INT']}, "
                              f"is_active {t['BOOL']} DEFAULT TRUE, min_app_version VARCHAR(16)",
        "local_encrypted_storage": f"{c}, user_id {t['UUID']}, note VARCHAR(255)",  # 端侧占位（云端不存实体内容）
    }


# 关键索引（步骤2 §6）
_INDEXES = [
    ("ix_document_owner_lib_status", "document", "owner_user_id, library_type, status"),
    ("ix_document_module_category", "document", "source_module, hr_category"),
    ("ix_document_negative_lib", "document", "is_negative_blocked, library_type"),
    ("ix_plan_item_user_date", "plan_item", "user_id, plan_date"),
    ("ix_emotion_user_date", "emotion_score", "user_id, score_date"),
    ("ix_recording_user_created", "recording", "user_id, created_at"),
    ("ix_gantt_project_status", "gantt_task", "project_id, status"),
    ("ix_gantt_status_overdue", "gantt_task", "status, overdue_days"),
    ("ix_event_user_module_ts", "event_log", "user_id, module, ts"),
    ("ix_care_user_pushed", "care_push_log", "user_id, pushed_at"),
    ("ix_audit_entered_remind", "audit_queue", "entered_at, expire_remind_at"),
    ("ix_contrib_user_created", "contribution_log", "user_id, created_at"),
    ("ix_referral_referrer", "referral", "referrer_user_id, registered_at"),
    ("ix_offline_user_synced", "offline_sync_queue", "user_id, synced_at"),
    ("ix_lifecycle_user_journey", "interview_lifecycle", "user_id, job_journey_id"),
]


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    t = _types(dialect)

    if dialect == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    tables = _tables(t)
    for name, cols in tables.items():
        op.execute(f"CREATE TABLE {name} ({cols})")

    # pgvector：为向量索引表追加 embedding 列（1024 维，按 embedding 模型调整）
    if dialect == "postgresql":
        op.execute("ALTER TABLE vector_index ADD COLUMN embedding vector(1024)")

    for ix_name, table, cols in _INDEXES:
        op.execute(f"CREATE INDEX {ix_name} ON {table} ({cols})")


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    t = _types(dialect)
    for ix_name, table, _cols in _INDEXES:
        op.execute(f"DROP INDEX IF EXISTS {ix_name}")
    for name in reversed(list(_tables(t).keys())):
        op.execute(f"DROP TABLE IF EXISTS {name}")
