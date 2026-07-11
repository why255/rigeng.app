"""0011 求职模块模型添加AI跟踪字段。

为 SkillCrystal、InterviewPrep、ProbationPlan 三个表添加：
- model_used: 生成使用的AI模型名
- generation_cost_tokens: 生成的token消耗

Revision ID: 0011_career_model_tracking
Revises: 0010_user_avatar
Create Date: 2026-07-10
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0011_career_model_tracking"
down_revision = "0010_user_avatar"
branch_labels = None


def upgrade() -> None:
    # SkillCrystal 表
    op.add_column("skill_crystal", sa.Column("model_used", sa.String(64), nullable=True))
    op.add_column("skill_crystal", sa.Column("generation_cost_tokens", sa.Integer(), nullable=True))

    # InterviewPrep 表
    op.add_column("interview_prep", sa.Column("model_used", sa.String(64), nullable=True))
    op.add_column("interview_prep", sa.Column("generation_cost_tokens", sa.Integer(), nullable=True))

    # ProbationPlan 表
    op.add_column("probation_plan", sa.Column("model_used", sa.String(64), nullable=True))
    op.add_column("probation_plan", sa.Column("generation_cost_tokens", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("probation_plan", "generation_cost_tokens")
    op.drop_column("probation_plan", "model_used")
    op.drop_column("interview_prep", "generation_cost_tokens")
    op.drop_column("interview_prep", "model_used")
    op.drop_column("skill_crystal", "generation_cost_tokens")
    op.drop_column("skill_crystal", "model_used")
