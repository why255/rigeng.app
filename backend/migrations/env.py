"""Alembic 环境：从 app.shared.config 读取 DATABASE_URL，离线/在线均支持。"""
from __future__ import annotations

import logging

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.shared.config import settings

# 简易日志配置（避免 fileConfig 在 Windows GBK 环境下读 alembic.ini 编码异常）
logging.basicConfig(level=logging.INFO)

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

target_metadata = None  # 本项目用显式 SQL DDL 迁移，不依赖 autogenerate


def run_migrations_offline() -> None:
    context.configure(
        url=settings.DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
