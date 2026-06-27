"""添加 review_record.gentle_persistence_used 列

步骤11「温柔坚持」功能所需字段。
"""
from __future__ import annotations

revision = '0004_review_gentle_persistence'
down_revision = '0003'


def upgrade():
    """添加 gentle_persistence_used 列 (INTEGER, default 0)。

    幂等：若列已存在（如 0004_partial 或手动修复）则跳过。
    """
    from sqlalchemy import text
    from app.shared.database import engine
    with engine.connect() as conn:
        # 先检查列是否已存在
        result = conn.execute(text("PRAGMA table_info(review_record)"))
        cols = [row[1] for row in result]
        if "gentle_persistence_used" in cols:
            print("0004: gentle_persistence_used 列已存在，跳过 ALTER TABLE")
            return
        conn.execute(text(
            "ALTER TABLE review_record ADD COLUMN gentle_persistence_used INTEGER DEFAULT 0"
        ))
        conn.commit()


def downgrade():
    """SQLite 不支持 DROP COLUMN，降级时仅记录日志。"""
    print("downgrade 0004: SQLite 不支持 DROP COLUMN，跳过删除 gentle_persistence_used。")
