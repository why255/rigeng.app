"""添加 review_record.gentle_persistence_used 列

步骤11「温柔坚持」功能所需字段。
"""
from __future__ import annotations

from alembic import op
from sqlalchemy import text

revision = '0004_review_gentle_persistence'
down_revision = '0003'


def upgrade():
    """添加 gentle_persistence_used 列 (INTEGER, default 0)。

    幂等：尝试添加列，若列已存在则捕获异常跳过。
    使用 op.get_bind() 确保与 alembic 共享连接，兼容 SQLite 和 PostgreSQL。
    """
    conn = op.get_bind()
    dialect = conn.dialect.name

    # 检查列是否已存在
    try:
        if dialect == "postgresql":
            result = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'review_record' AND column_name = 'gentle_persistence_used'"
            ))
            if result.fetchone():
                print("0004: gentle_persistence_used 列已存在，跳过 ALTER TABLE")
                return
        else:
            # SQLite
            result = conn.execute(text("PRAGMA table_info(review_record)"))
            cols = [row[1] for row in result]
            if "gentle_persistence_used" in cols:
                print("0004: gentle_persistence_used 列已存在，跳过 ALTER TABLE")
                return
    except Exception as e:
        # 表可能尚不存在（首次安装），继续尝试 ALTER
        print(f"0004: 检查列时出错（将尝试添加）: {e}")

    try:
        conn.execute(text(
            "ALTER TABLE review_record ADD COLUMN gentle_persistence_used INTEGER DEFAULT 0"
        ))
        conn.commit()
    except Exception as e:
        err = str(e)
        if "already exists" in err.lower() or "duplicate column" in err.lower():
            print("0004: 列已存在（并发创建），跳过")
        else:
            raise


def downgrade():
    """SQLite 不支持 DROP COLUMN，PostgreSQL 支持但降级仅记录日志。"""
    print("downgrade 0004: 跳过删除 gentle_persistence_used。")
