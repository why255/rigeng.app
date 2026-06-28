"""添加 review_record.gentle_persistence_used 列

步骤11「温柔坚持」功能所需字段。
"""
from __future__ import annotations

revision = '0004_review_gentle_persistence'
down_revision = '0003'


def _get_dialect():
    from app.shared.database import engine
    return engine.dialect.name


def upgrade():
    """添加 gentle_persistence_used 列 (INTEGER, default 0)。

    幂等：若列已存在则跳过，兼容 SQLite 和 PostgreSQL。
    """
    from sqlalchemy import inspect as sa_inspect, text
    from app.shared.database import engine
    with engine.connect() as conn:
        # 跨数据库检查列是否存在
        insp = sa_inspect(engine)
        cols = [c["name"] for c in insp.get_columns("review_record")]
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
