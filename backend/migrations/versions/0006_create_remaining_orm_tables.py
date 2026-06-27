"""0006 创建余下 53 张 ORM 表（幂等）。

背景：0001_init_schema 创建了旧版命名的表，0005 修复了 7 张核心表，
但还有 53 张 ORM 模型对应的表缺失。本迁移一次性补齐。

覆盖域：
  情绪评分(1) + 向量索引(1) + 安全(3) + 分析(5) +
  智能办公(5) + 高维求职(9) + 品牌打造(5) +
  打磨产品(7) + 交付订单(8) + 拿下客户(9)

全部使用 CREATE TABLE IF NOT EXISTS，幂等安全。

Revision ID: 0006_all_orm_tables
Revises: 0005_fix_schema
Create Date: 2026-06-28
"""
from __future__ import annotations

from alembic import op

revision = "0006_all_orm_tables"
down_revision = "0005_fix_schema"
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
        "V16": "VARCHAR(16)",
        "V32": "VARCHAR(32)",
        "V64": "VARCHAR(64)",
        "V128": "VARCHAR(128)",
        "V256": "VARCHAR(256)",
        "V512": "VARCHAR(512)",
        "V1024": "VARCHAR(1024)",
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

    if dialect == "sqlite":
        op.execute("PRAGMA foreign_keys = OFF")

    # ═══════════════════════════════════════════════════
    # 1. 情绪评分 (1 表)
    # ═══════════════════════════════════════════════════
    op.execute(f"""
        CREATE TABLE IF NOT EXISTS emotion_score (
            {c},
            user_id {t['UUID']},
            score_date {t['V16']},
            score {t['INT']},
            source {t['V32']},
            user_reported_score {t['INT']},
            model_extracted_score {t['INT']},
            is_corrected {t['BOOL']} DEFAULT FALSE,
            corrected_score {t['INT']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_emotion_score_user ON emotion_score (user_id)")

    # ═══════════════════════════════════════════════════
    # 2. 向量索引 (1 表)
    # ═══════════════════════════════════════════════════
    op.execute(f"""
        CREATE TABLE IF NOT EXISTS vector_index (
            {c},
            doc_id {t['UUID']},
            chunk_id {t['INT']} DEFAULT 0,
            meta {t['JSON']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_vector_index_doc ON vector_index (doc_id)")

    # ═══════════════════════════════════════════════════
    # 3. 安全域 (3 表)
    # ═══════════════════════════════════════════════════
    op.execute(f"""
        CREATE TABLE IF NOT EXISTS crisis_log (
            {c},
            user_id_hashed {t['V64']},
            triggered_at {t['TS']},
            crisis_type {t['V32']},
            intervention_result {t['V64']}
        )
    """)

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS local_encrypted_storage (
            {c},
            user_id {t['UUID']},
            note {t['V256']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_local_enc_storage_user ON local_encrypted_storage (user_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS courage_value (
            {c},
            user_id {t['UUID']},
            value {t['INT']} DEFAULT 0,
            milestones {t['JSON']},
            last_publish_at {t['TS']},
            last_negotiation_fail_at {t['TS']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_courage_value_user ON courage_value (user_id)")

    # ═══════════════════════════════════════════════════
    # 4. 分析域 (5 表)
    # ═══════════════════════════════════════════════════
    op.execute(f"""
        CREATE TABLE IF NOT EXISTS event_log (
            {c},
            user_id {t['UUID']},
            module {t['V8']},
            event_type {t['V64']},
            properties {t['JSON']},
            ts {t['TS']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_event_log_user ON event_log (user_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS metric_daily (
            {c},
            user_id {t['UUID']},
            mdate {t['V16']},
            metric_type {t['V64']},
            value {t['FLOAT']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_metric_daily_user ON metric_daily (user_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS care_push_log (
            {c},
            user_id {t['UUID']},
            type {t['V16']},
            trigger_condition {t['V64']},
            pushed_at {t['TS']},
            intercepted_reason {t['V64']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_care_push_log_user ON care_push_log (user_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS sms_send_log (
            {c},
            user_id {t['UUID']},
            trigger_condition {t['V64']},
            module {t['V8']},
            sent_at {t['TS']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_sms_send_log_user ON sms_send_log (user_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS push_rule_template (
            {c},
            trigger_condition {t['V64']},
            module {t['V8']},
            push_type {t['V16']},
            priority {t['INT']},
            max_per_week {t['INT']},
            push_window_start {t['INT']},
            push_window_end {t['INT']},
            new_user_quiet_days {t['INT']} DEFAULT 7,
            template_text {t['TEXT']},
            is_active {t['BOOL']} DEFAULT TRUE
        )
    """)

    # ═══════════════════════════════════════════════════
    # 5. 智能办公域 (5 表)
    # ═══════════════════════════════════════════════════
    op.execute(f"""
        CREATE TABLE IF NOT EXISTS office_document (
            {c},
            user_id {t['UUID']},
            title {t['V512']},
            module_key {t['V64']},
            doc_type {t['V16']} DEFAULT 'tool',
            content_json {t['JSON']},
            status {t['V16']} DEFAULT 'draft',
            version {t['INT']} DEFAULT 1,
            regenerate_count {t['INT']} DEFAULT 0,
            brand_logo_visible {t['BOOL']} DEFAULT TRUE,
            kb_doc_id {t['UUID']},
            archived_at {t['V32']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_office_doc_user ON office_document (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_office_doc_module ON office_document (module_key)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_office_doc_status ON office_document (status)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS system_build_state (
            {c},
            user_id {t['UUID']},
            title {t['V512']},
            current_step {t['INT']} DEFAULT 1,
            step_data_json {t['JSON']},
            status {t['V16']} DEFAULT 'in_progress',
            completed_at {t['V32']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_system_build_user ON system_build_state (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_system_build_status ON system_build_state (status)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS office_draft (
            {c},
            user_id {t['UUID']},
            doc_id {t['UUID']},
            title {t['V512']},
            doc_type {t['V16']},
            module_key {t['V64']},
            step_num {t['INT']},
            content_snapshot_json {t['JSON']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_office_draft_user ON office_draft (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_office_draft_doc ON office_draft (doc_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS office_document_version (
            {c},
            doc_id {t['UUID']},
            version_num {t['INT']} DEFAULT 1,
            content_json {t['JSON']},
            created_by {t['UUID']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_office_doc_ver_doc ON office_document_version (doc_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS policy_upload (
            {c},
            user_id {t['UUID']},
            doc_id {t['UUID']},
            original_filename {t['V512']},
            content_text {t['TEXT']},
            file_size_bytes {t['INT']} DEFAULT 0,
            for_training {t['BOOL']} DEFAULT FALSE
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_policy_upload_user ON policy_upload (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_policy_upload_doc ON policy_upload (doc_id)")

    # ═══════════════════════════════════════════════════
    # 6. 高维求职域 (9 表)
    # ═══════════════════════════════════════════════════
    op.execute(f"""
        CREATE TABLE IF NOT EXISTS career_progress (
            {c},
            user_id {t['UUID']} UNIQUE,
            current_step {t['INT']} DEFAULT 1,
            step_data_json {t['JSON']},
            status {t['V16']} DEFAULT 'active',
            teacher_id {t['UUID']},
            teacher_nda_signed {t['BOOL']} DEFAULT FALSE
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_career_progress_user ON career_progress (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_career_progress_status ON career_progress (status)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS star_extraction (
            {c},
            user_id {t['UUID']},
            career_progress_id {t['UUID']},
            situation {t['TEXT']},
            task {t['TEXT']},
            action {t['TEXT']},
            result {t['TEXT']},
            quantified_value {t['V256']},
            completeness {t['FLOAT']} DEFAULT 0.0,
            source_type {t['V32']},
            source_id {t['UUID']},
            model_used {t['V64']},
            extraction_cost_tokens {t['INT']} DEFAULT 0
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_star_extraction_user ON star_extraction (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_star_extraction_cp ON star_extraction (career_progress_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS skill_crystal (
            {c},
            user_id {t['UUID']},
            star_extraction_id {t['UUID']},
            what {t['TEXT']},
            how {t['TEXT']},
            notes {t['TEXT']},
            outcome {t['TEXT']},
            reusable_sop {t['TEXT']},
            source_step {t['INT']},
            tags_json {t['JSON']},
            archived_to_kb {t['BOOL']} DEFAULT FALSE,
            kb_doc_id {t['UUID']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_skill_crystal_user ON skill_crystal (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_skill_crystal_star ON skill_crystal (star_extraction_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS job_application (
            {c},
            user_id {t['UUID']},
            career_progress_id {t['UUID']},
            channel {t['V128']},
            position {t['V256']},
            company {t['V256']},
            date {t['V32']},
            status {t['V32']} DEFAULT 'applied',
            invite_received {t['BOOL']} DEFAULT FALSE,
            notes {t['TEXT']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_job_app_user ON job_application (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_job_app_cp ON job_application (career_progress_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_job_app_status ON job_application (status)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS interview_prep (
            {c},
            user_id {t['UUID']},
            career_progress_id {t['UUID']},
            application_id {t['UUID']},
            company_intel_json {t['JSON']},
            match_analysis {t['TEXT']},
            strategy_doc {t['TEXT']},
            question_list {t['JSON']},
            company {t['V256']},
            position {t['V256']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_interview_prep_user ON interview_prep (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_interview_prep_cp ON interview_prep (career_progress_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_interview_prep_app ON interview_prep (application_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS interview_review (
            {c},
            user_id {t['UUID']},
            prep_id {t['UUID']},
            audio_recording_id {t['UUID']},
            highlights {t['TEXT']},
            improvements {t['TEXT']},
            review_sop {t['TEXT']},
            overall_rating {t['INT']},
            model_used {t['V64']},
            analysis_cost_tokens {t['INT']} DEFAULT 0
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_interview_review_user ON interview_review (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_interview_review_prep ON interview_review (prep_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS offer_comparison (
            {c},
            user_id {t['UUID']},
            career_progress_id {t['UUID']},
            offers_json {t['JSON']},
            selected_offer_id {t['V64']},
            comparison_notes {t['TEXT']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_offer_comp_user ON offer_comparison (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_offer_comp_cp ON offer_comparison (career_progress_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS probation_plan (
            {c},
            user_id {t['UUID']},
            offer_id {t['UUID']},
            milestones_json {t['JSON']},
            company {t['V256']},
            position {t['V256']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_probation_plan_user ON probation_plan (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_probation_plan_offer ON probation_plan (offer_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS company_intel (
            {c},
            user_id {t['UUID']},
            company_name {t['V256']},
            intel_report_json {t['JSON']},
            source_urls {t['JSON']},
            teacher_id {t['UUID']},
            teacher_verified {t['BOOL']} DEFAULT FALSE,
            model_used {t['V64']},
            generation_time_ms {t['INT']} DEFAULT 0
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_company_intel_user ON company_intel (user_id)")

    # ═══════════════════════════════════════════════════
    # 7. 品牌打造中心域 (5 表)
    # ═══════════════════════════════════════════════════
    op.execute(f"""
        CREATE TABLE IF NOT EXISTS brand_profile (
            {c},
            user_id {t['UUID']} UNIQUE,
            authorized_sources_json {t['JSON']},
            strategy_prefs_json {t['JSON']},
            status {t['V16']} DEFAULT 'active',
            disclaimer_confirmed {t['BOOL']} DEFAULT FALSE,
            disclaimer_confirmed_at {t['V32']},
            unconfirmed_days {t['INT']} DEFAULT 0,
            last_confirmed_at {t['V32']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_brand_profile_user ON brand_profile (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_brand_profile_status ON brand_profile (status)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS brand_content (
            {c},
            user_id {t['UUID']},
            content_type {t['V16']},
            time_slot {t['V16']},
            topic {t['V256']},
            content_json {t['JSON']},
            image_style {t['V64']},
            image_urls_json {t['JSON']},
            status {t['V16']} DEFAULT 'draft',
            source_doc_ids_json {t['JSON']},
            published_at {t['V32']},
            scheduled_at {t['V32']},
            preview_confirmed_at {t['V32']},
            revision_history_json {t['JSON']},
            model_used {t['V64']},
            generation_cost_tokens {t['INT']} DEFAULT 0
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_brand_content_user ON brand_content (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_brand_content_type ON brand_content (content_type)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_brand_content_status ON brand_content (status)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS brand_analytics (
            {c},
            user_id {t['UUID']},
            content_id {t['UUID']},
            content_type {t['V16']},
            views {t['INT']} DEFAULT 0,
            likes {t['INT']} DEFAULT 0,
            shares {t['INT']} DEFAULT 0,
            comments {t['INT']} DEFAULT 0,
            consultation_triggered {t['BOOL']} DEFAULT FALSE,
            lead_generated {t['BOOL']} DEFAULT FALSE,
            stat_date {t['V16']},
            audience_json {t['JSON']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_brand_analytics_user ON brand_analytics (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_brand_analytics_content ON brand_analytics (content_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_brand_analytics_date ON brand_analytics (stat_date)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS brand_courage_value (
            {c},
            user_id {t['UUID']} UNIQUE,
            total_score {t['INT']} DEFAULT 0,
            dimension_scores_json {t['JSON']},
            milestones_json {t['JSON']},
            interventions_json {t['JSON']},
            consecutive_no_publish_days {t['INT']} DEFAULT 0,
            publish_count_7d {t['INT']} DEFAULT 0,
            consecutive_interview_fails {t['INT']} DEFAULT 0,
            last_publish_date {t['V16']},
            last_care_triggered_at {t['V32']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_brand_cv_user ON brand_courage_value (user_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS brand_lead (
            {c},
            user_id {t['UUID']},
            source_content_id {t['UUID']},
            lead_type {t['V32']},
            source_description {t['TEXT']},
            contact_name {t['V64']},
            contact_info {t['V128']},
            status {t['V16']} DEFAULT 'marked',
            notes {t['TEXT']},
            transferred_to_client_id {t['UUID']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_brand_lead_user ON brand_lead (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_brand_lead_content ON brand_lead (source_content_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_brand_lead_status ON brand_lead (status)")

    # ═══════════════════════════════════════════════════
    # 8. 打磨产品域 (7 表)
    # ═══════════════════════════════════════════════════
    op.execute(f"""
        CREATE TABLE IF NOT EXISTS product_project (
            {c},
            user_id {t['UUID']},
            title {t['V512']},
            entry_type {t['V32']} DEFAULT 'full_abs',
            contract_ref {t['V256']},
            service_list_json {t['JSON']},
            current_phase {t['V32']} DEFAULT 'draft',
            status {t['V32']} DEFAULT 'draft',
            hr_module_mapping_json {t['JSON']},
            client_name {t['V256']},
            client_industry {t['V128']},
            is_desensitized {t['BOOL']} DEFAULT FALSE,
            not_for_training {t['BOOL']} DEFAULT TRUE,
            initial_quotation_json {t['JSON']},
            final_quotation_json {t['JSON']},
            notes {t['TEXT']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_product_project_user ON product_project (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_product_project_status ON product_project (status)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS diagnosis_report (
            {c},
            project_id {t['UUID']},
            user_id {t['UUID']},
            version {t['V8']} DEFAULT '1.0',
            questionnaire_data_json {t['JSON']},
            report_json {t['JSON']},
            teacher_id {t['UUID']},
            teacher_notes {t['TEXT']},
            teacher_enhanced_at {t['V64']},
            status {t['V32']} DEFAULT 'pending',
            parent_report_id {t['UUID']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_diagnosis_report_project ON diagnosis_report (project_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_diagnosis_report_user ON diagnosis_report (user_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS quantified_target (
            {c},
            project_id {t['UUID']},
            user_id {t['UUID']},
            metric_name {t['V256']},
            metric_category {t['V64']},
            current_value {t['V128']},
            target_value {t['V128']},
            unit {t['V32']},
            baseline_source {t['TEXT']},
            target_rationale {t['TEXT']},
            sort_order {t['INT']} DEFAULT 0
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_quantified_target_project ON quantified_target (project_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_quantified_target_user ON quantified_target (user_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS solution_version (
            {c},
            project_id {t['UUID']},
            user_id {t['UUID']},
            version_label {t['V8']},
            content_json {t['JSON']},
            source_calls_json {t['JSON']},
            gap_analysis_json {t['JSON']},
            version_diff_summary {t['TEXT']},
            status {t['V32']} DEFAULT 'draft',
            is_selected {t['BOOL']} DEFAULT FALSE,
            export_format {t['V16']},
            export_file_id {t['UUID']},
            selected_by_teacher_id {t['UUID']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_solution_version_project ON solution_version (project_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_solution_version_user ON solution_version (user_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS pre_research_product (
            {c},
            user_id {t['UUID']},
            template_type {t['V32']},
            product_name {t['V512']},
            description {t['TEXT']},
            content_json {t['JSON']},
            status {t['V32']} DEFAULT 'draft',
            linked_project_id {t['UUID']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_pre_research_user ON pre_research_product (user_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS solution_reuse_record (
            {c},
            source_solution_id {t['UUID']},
            target_project_id {t['UUID']},
            user_id {t['UUID']},
            adapted_framework_json {t['JSON']},
            adaptation_notes {t['TEXT']},
            is_desensitized {t['BOOL']} DEFAULT TRUE
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_solution_reuse_source ON solution_reuse_record (source_solution_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_solution_reuse_target ON solution_reuse_record (target_project_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_solution_reuse_user ON solution_reuse_record (user_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS coaching_record (
            {c},
            project_id {t['UUID']},
            user_id {t['UUID']},
            teacher_id {t['UUID']},
            session_num {t['INT']},
            total_sessions {t['INT']} DEFAULT 3,
            scheduled_at {t['V64']},
            duration_minutes {t['INT']} DEFAULT 60,
            meeting_link {t['V512']},
            recording_url {t['V512']},
            status {t['V32']} DEFAULT 'scheduled',
            session_notes {t['TEXT']},
            action_items_json {t['JSON']},
            focus_topics {t['TEXT']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_coaching_record_project ON coaching_record (project_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_coaching_record_user ON coaching_record (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_coaching_record_teacher ON coaching_record (teacher_id)")

    # ═══════════════════════════════════════════════════
    # 9. 交付订单域 (8 表)
    # ═══════════════════════════════════════════════════
    op.execute(f"""
        CREATE TABLE IF NOT EXISTS delivery_project (
            {c},
            user_id {t['UUID']},
            client_name {t['V256']},
            signed_at {t['V32']},
            service_list_json {t['JSON']},
            solution_ref {t['V512']},
            status {t['V32']} DEFAULT '签约',
            notes {t['TEXT']},
            project_lead_id {t['UUID']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_delivery_project_user ON delivery_project (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_delivery_project_status ON delivery_project (status)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS project_team (
            {c},
            project_id {t['UUID']} UNIQUE,
            project_lead_id {t['UUID']},
            user_id {t['UUID']},
            teacher_id {t['UUID']},
            lead_notes {t['TEXT']},
            user_notes {t['TEXT']},
            teacher_notes {t['TEXT']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_project_team_project ON project_team (project_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS gantt_node (
            {c},
            project_id {t['UUID']},
            task_name {t['V512']},
            description {t['TEXT']},
            planned_start {t['V32']},
            planned_end {t['V32']},
            actual_start {t['V32']},
            actual_end {t['V32']},
            status {t['V32']} DEFAULT '未开始',
            order_index {t['INT']} DEFAULT 0,
            responsible_id {t['UUID']},
            responsible_role {t['V32']},
            confirmed_by_user {t['BOOL']} DEFAULT FALSE,
            confirmed_by_teacher {t['BOOL']} DEFAULT FALSE,
            user_confirmed_at {t['V32']},
            teacher_confirmed_at {t['V32']},
            notes {t['TEXT']},
            voice_note_url {t['V512']},
            alert_sent_at {t['V32']},
            alert_count {t['INT']} DEFAULT 0,
            parent_node_id {t['UUID']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_gantt_node_project ON gantt_node (project_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_gantt_node_status ON gantt_node (status)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS project_document (
            {c},
            project_id {t['UUID']},
            uploaded_by {t['UUID']},
            stage {t['V32']},
            filename {t['V512']},
            version_num {t['V32']} DEFAULT 'v1.0',
            file_url {t['V1024']},
            file_size_bytes {t['INT']} DEFAULT 0,
            mime_type {t['V128']},
            previous_version_id {t['UUID']},
            is_deleted {t['BOOL']} DEFAULT FALSE,
            deleted_at_custom {t['V32']},
            tags_json {t['JSON']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_project_doc_project ON project_document (project_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS issue (
            {c},
            project_id {t['UUID']},
            created_by {t['UUID']},
            title {t['V512']},
            description {t['TEXT']},
            priority {t['V32']} DEFAULT 'medium',
            assignee_id {t['UUID']},
            source {t['V32']},
            status {t['V32']} DEFAULT '待解决',
            resolution_json {t['JSON']},
            resolved_by {t['UUID']},
            resolved_at {t['V32']},
            related_node_id {t['UUID']},
            tags_json {t['JSON']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_issue_project ON issue (project_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_issue_status ON issue (status)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS client_meeting_record (
            {c},
            project_id {t['UUID']},
            created_by {t['UUID']},
            recording_id {t['UUID']},
            decisions_json {t['JSON']},
            todos_json {t['JSON']},
            title {t['V512']},
            meeting_date {t['V32']},
            shared_with_client {t['BOOL']} DEFAULT FALSE
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_client_meeting_project ON client_meeting_record (project_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_client_meeting_rec ON client_meeting_record (recording_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS delivery_assistant_chat (
            {c},
            project_id {t['UUID']},
            user_id {t['UUID']},
            user_message {t['TEXT']},
            assistant_response {t['TEXT']},
            context_type {t['V32']},
            related_node_id {t['UUID']},
            meta_json {t['JSON']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_delivery_chat_project ON delivery_assistant_chat (project_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_delivery_chat_user ON delivery_assistant_chat (user_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS project_archive (
            {c},
            project_id {t['UUID']} UNIQUE,
            archived_by {t['UUID']},
            archive_data_json {t['JSON']},
            case_for_brand {t['BOOL']} DEFAULT FALSE,
            case_title {t['V512']},
            case_description {t['TEXT']},
            case_tags_json {t['JSON']},
            kb_doc_ids_json {t['JSON']},
            brand_content_id {t['UUID']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_project_archive_project ON project_archive (project_id)")

    # ═══════════════════════════════════════════════════
    # 10. 拿下客户域 (9 表)
    # ═══════════════════════════════════════════════════
    op.execute(f"""
        CREATE TABLE IF NOT EXISTS acquire_transition_signal (
            {c},
            user_id {t['UUID']},
            context_text {t['TEXT']},
            signal_type {t['V64']},
            confidence {t['FLOAT']} DEFAULT 0.0,
            action_taken {t['V128']},
            guided_flow {t['V32']},
            conversation_id {t['UUID']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_acquire_ts_user ON acquire_transition_signal (user_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS acquire_self_diagnosis (
            {c},
            user_id {t['UUID']},
            resume_upload_url {t['V1024']},
            resume_parsed_json {t['JSON']},
            interview_answers_json {t['JSON']},
            diagnosis_report_json {t['JSON']},
            self_rating_json {t['JSON']},
            teacher_reviewed {t['BOOL']} DEFAULT FALSE,
            teacher_id {t['UUID']},
            teacher_notes {t['TEXT']},
            status {t['V32']} DEFAULT 'draft'
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_acquire_sd_user ON acquire_self_diagnosis (user_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS acquire_company_intel (
            {c},
            user_id {t['UUID']},
            company_name {t['V256']},
            company_aliases_json {t['JSON']},
            industry {t['V128']},
            scale {t['V64']},
            location {t['V256']},
            intel_report_json {t['JSON']},
            source_urls_json {t['JSON']},
            source_types_json {t['JSON']},
            teacher_id {t['UUID']},
            teacher_review_notes {t['TEXT']},
            delivered_at {t['V32']},
            status {t['V32']} DEFAULT 'collected'
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_acquire_ci_user ON acquire_company_intel (user_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS acquire_meeting_strategy (
            {c},
            user_id {t['UUID']},
            intel_id {t['UUID']},
            diagnosis_id {t['UUID']},
            strategy_doc_json {t['JSON']},
            outline_json {t['JSON']},
            teacher_notes {t['TEXT']},
            teacher_approved {t['BOOL']} DEFAULT FALSE,
            status {t['V32']} DEFAULT 'draft'
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_acquire_ms_user ON acquire_meeting_strategy (user_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS acquire_client_meeting (
            {c},
            user_id {t['UUID']},
            strategy_id {t['UUID']},
            recording_id {t['UUID']},
            round_num {t['INT']} DEFAULT 1,
            client_name {t['V128']},
            client_position {t['V128']},
            meeting_date {t['V32']},
            achievement_rate {t['FLOAT']} DEFAULT 0.0,
            analysis_json {t['JSON']},
            meeting_notes {t['TEXT']},
            status {t['V32']} DEFAULT 'preparing'
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_acquire_cm_user ON acquire_client_meeting (user_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS acquire_negotiation_round (
            {c},
            meeting_id {t['UUID']},
            user_id {t['UUID']},
            round_number {t['INT']} DEFAULT 1,
            strategy_json {t['JSON']},
            meeting_notes_json {t['JSON']},
            review_json {t['JSON']},
            achievement_rate {t['FLOAT']} DEFAULT 0.0,
            status {t['V32']} DEFAULT 'preparing'
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_acquire_nr_meeting ON acquire_negotiation_round (meeting_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_acquire_nr_user ON acquire_negotiation_round (user_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS acquire_roleplay_session (
            {c},
            user_id {t['UUID']},
            scenario_type {t['V32']} DEFAULT 'custom',
            current_role {t['V16']} DEFAULT 'client',
            client_profile_json {t['JSON']},
            dialogue_json {t['JSON']},
            score_a {t['FLOAT']} DEFAULT 0.0,
            score_a_detail_json {t['JSON']},
            score_b {t['FLOAT']} DEFAULT 0.0,
            score_b_detail_json {t['JSON']},
            total_score {t['FLOAT']} DEFAULT 0.0,
            passed {t['BOOL']} DEFAULT FALSE,
            pass_threshold {t['FLOAT']} DEFAULT 80.0,
            expert_feedback {t['TEXT']},
            teacher_guidance {t['TEXT']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_acquire_rs_user ON acquire_roleplay_session (user_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS acquire_client_contract (
            {c},
            user_id {t['UUID']},
            meeting_id {t['UUID']},
            contract_url {t['V1024']},
            contract_title {t['V512']},
            contract_amount {t['V64']},
            client_company {t['V256']},
            service_list_json {t['JSON']},
            synced_to_product {t['BOOL']} DEFAULT FALSE,
            product_doc_id {t['UUID']},
            status {t['V32']} DEFAULT 'uploaded'
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_acquire_cc_user ON acquire_client_contract (user_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS acquire_compliance_reminder (
            {c},
            user_id {t['UUID']} UNIQUE,
            first_shown {t['BOOL']} DEFAULT FALSE,
            first_shown_at {t['V32']},
            accepted {t['BOOL']} DEFAULT FALSE,
            accepted_at {t['V32']},
            reminder_text {t['TEXT']}
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_acquire_cr_user ON acquire_compliance_reminder (user_id)")

    if dialect == "sqlite":
        op.execute("PRAGMA foreign_keys = ON")


def downgrade() -> None:
    """降级：删除本迁移创建的所有表。"""
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "sqlite":
        op.execute("PRAGMA foreign_keys = OFF")

    tables = [
        # 拿下客户
        "acquire_compliance_reminder", "acquire_client_contract",
        "acquire_roleplay_session", "acquire_negotiation_round",
        "acquire_client_meeting", "acquire_meeting_strategy",
        "acquire_company_intel", "acquire_self_diagnosis",
        "acquire_transition_signal",
        # 交付订单
        "project_archive", "delivery_assistant_chat", "client_meeting_record",
        "issue", "project_document", "gantt_node", "project_team",
        "delivery_project",
        # 打磨产品
        "coaching_record", "solution_reuse_record", "pre_research_product",
        "solution_version", "quantified_target", "diagnosis_report",
        "product_project",
        # 品牌
        "brand_lead", "brand_courage_value", "brand_analytics",
        "brand_content", "brand_profile",
        # 高维求职
        "company_intel", "probation_plan", "offer_comparison",
        "interview_review", "interview_prep", "job_application",
        "skill_crystal", "star_extraction", "career_progress",
        # 智能办公
        "policy_upload", "office_document_version", "office_draft",
        "system_build_state", "office_document",
        # 分析
        "push_rule_template", "sms_send_log", "care_push_log",
        "metric_daily", "event_log",
        # 安全
        "courage_value", "local_encrypted_storage", "crisis_log",
        # 其它
        "vector_index", "emotion_score",
    ]

    for table in tables:
        op.execute(f"DROP TABLE IF EXISTS {table}")

    if dialect == "sqlite":
        op.execute("PRAGMA foreign_keys = ON")
