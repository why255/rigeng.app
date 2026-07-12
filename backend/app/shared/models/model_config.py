"""模型降级 — ORM 映射。

model_config: 模型版本目录（每个提供商的可选模型版本）。
module_model_binding: 模块→模型版本的绑定关系。
"""
from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base, GUID, TimestampMixin


class ModelConfig(TimestampMixin, Base):
    """AI模型版本目录 — 每个提供商的可选模型版本。

    一行 = 一个特定模型版本，例如"豆包 Seed 2.0 Pro"。
    管理员可以：
      - 添加新的模型版本（供模块绑定）
      - 禁用/启用某个版本（is_available）
      - 修改显示名称
    """

    __tablename__ = "model_config"
    __table_args__ = (
        UniqueConstraint("provider_key", "model_name"),
    )

    provider_key: Mapped[str] = mapped_column(
        String(64), nullable=False, index=True,
        comment="提供商: volcano|dashscope|hunyuan|kimi|deepseek|zhipu|anthropic",
    )
    model_name: Mapped[str] = mapped_column(
        String(128), nullable=False,
        comment="API 模型标识符，如 doubao-seed-2-0-pro",
    )
    model_version: Mapped[str] = mapped_column(
        String(64), nullable=False,
        comment="版本号，如 2.0-pro",
    )
    display_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True,
        comment="人类可读名称，如 豆包 Seed 2.0 Pro",
    )
    is_available: Mapped[bool] = mapped_column(
        Boolean, default=True,
        comment="是否允许被模块绑定使用",
    )

    # relationship: 哪些模块绑定了此模型
    bindings: Mapped[list["ModuleModelBinding"]] = relationship(
        "ModuleModelBinding", back_populates="model_config", lazy="selectin",
    )


class ModuleModelBinding(TimestampMixin, Base):
    """模块→模型绑定 — 决定每个功能模块调用哪个模型版本。

    一个模块可以有多个绑定（历史记录），但只有 is_active=True 的生效。
    降级操作 = 将当前活跃绑定设为 inactive，创建新绑定。
    """

    __tablename__ = "module_model_binding"
    __table_args__ = (
        UniqueConstraint("module_key", "model_config_id"),
    )

    module_key: Mapped[str] = mapped_column(
        String(64), nullable=False, index=True,
        comment="模块标识: morning_plan|smart_qa|...",
    )
    module_display_name: Mapped[str | None] = mapped_column(
        String(128), nullable=True,
        comment="人类可读的模块名称，如 朝有规划",
    )
    model_config_id: Mapped[str] = mapped_column(
        GUID, ForeignKey("model_config.id"), nullable=False,
        comment="绑定的模型版本",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True,
        comment="当前是否生效（一个模块同一时间只有一个活跃绑定）",
    )

    # relationship: 返回绑定的模型配置
    model_config: Mapped["ModelConfig"] = relationship(
        "ModelConfig", back_populates="bindings", lazy="selectin",
    )
