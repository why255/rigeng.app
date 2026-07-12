"""种子脚本：为所有 16 个 AI 模块创建默认模型绑定。

用法：
    cd backend
    python -m scripts.seed_module_bindings

幂等：仅当模块尚无活跃绑定时才会创建，可安全重复执行。
"""
from __future__ import annotations

import sys
import os

# 确保 backend 在 PYTHONPATH 中
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.engines.module_registry import MODULE_REGISTRY
from app.shared.database import SessionLocal, new_uuid
from app.shared.models.model_config import ModelConfig, ModuleModelBinding


def seed():
    db = SessionLocal()
    created_bindings = 0
    created_models = 0
    skipped = 0

    try:
        for module_key, info in MODULE_REGISTRY.items():
            model_name = info["default_model"]
            provider_key = info["provider"]

            # 检查是否已有活跃绑定
            existing_binding = (
                db.query(ModuleModelBinding)
                .filter(
                    ModuleModelBinding.module_key == module_key,
                    ModuleModelBinding.is_active == True,
                    ModuleModelBinding.deleted_at == None,
                )
                .first()
            )
            if existing_binding:
                skipped += 1
                continue

            # 查找或创建对应的 ModelConfig
            model_config = (
                db.query(ModelConfig)
                .filter(
                    ModelConfig.provider_key == provider_key,
                    ModelConfig.model_name == model_name,
                    ModelConfig.deleted_at == None,
                )
                .first()
            )

            if not model_config:
                model_config = ModelConfig(
                    provider_key=provider_key,
                    model_name=model_name,
                    model_version=info.get("temperature", 0.3),  # 用温度占位版本号
                    display_name=info["name"],
                    is_available=True,
                )
                db.add(model_config)
                db.flush()
                created_models += 1
                print(f"  ✓ 创建模型配置: {model_name} ({provider_key})")

            # 创建绑定
            binding = ModuleModelBinding(
                module_key=module_key,
                module_display_name=info["name"],
                model_config_id=model_config.id,
                is_active=True,
            )
            db.add(binding)
            created_bindings += 1
            print(f"  ✓ 绑定: {module_key} ({info['name']}) → {model_name}")

        db.commit()

        print(f"\n{'='*50}")
        print(f"种子完成: 新建 {created_models} 个模型, {created_bindings} 个绑定, 跳过 {skipped} 个已有绑定")
        print(f"{'='*50}")

    except Exception as e:
        db.rollback()
        print(f"❌ 种子失败: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
