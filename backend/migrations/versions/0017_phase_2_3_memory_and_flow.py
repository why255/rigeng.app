"""Phase 2+3: Tier 2 user_profile + FlowState table

Revision ID: 0017
Revises: 0016
Create Date: 2026-07-17

新增:
- user_account: user_profile (JSON), last_active_module (VARCHAR), last_active_at (TIMESTAMP)
- flow_states: 流程阶段状态表 (Tier 3 记忆系统)
"""
from alembic import op
import sqlalchemy as sa
from app.shared.database import GUID, PortableJSON

# revision identifiers, used by Alembic.
revision = '0017'
down_revision = '0016'
branch_labels = None
depends_on = None


def upgrade():
    # 1. User 新增 Tier 2 画像列
    op.add_column('user_account', sa.Column('user_profile', PortableJSON(), nullable=True))
    op.add_column('user_account', sa.Column('last_active_module', sa.String(32), nullable=True))
    op.add_column('user_account', sa.Column('last_active_at', sa.DateTime(), nullable=True))

    # 2. FlowState 流程阶段状态表
    op.create_table(
        'flow_states',
        sa.Column('id', GUID(), primary_key=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('schema_version', sa.Integer(), default=1),
        sa.Column('user_id', GUID(), sa.ForeignKey('user_account.id'), nullable=False),
        sa.Column('module', sa.String(32), nullable=False, comment='mp/er/mh'),
        sa.Column('current_stage', sa.String(32), nullable=False, comment='当前阶段key'),
        sa.Column('stages_completed', PortableJSON(), nullable=True, comment='已完成的阶段列表'),
        sa.Column('stage_entered_at', sa.DateTime(), nullable=True, comment='进入当前阶段的时间'),
        sa.Column('metadata_json', PortableJSON(), nullable=True, comment='模块特定元数据'),
        sa.Column('status', sa.String(16), default='active', comment='active/completed/abandoned'),
    )
    op.create_index('ix_flow_states_user_module', 'flow_states', ['user_id', 'module'])


def downgrade():
    op.drop_index('ix_flow_states_user_module')
    op.drop_table('flow_states')
    op.drop_column('user_account', 'last_active_at')
    op.drop_column('user_account', 'last_active_module')
    op.drop_column('user_account', 'user_profile')
