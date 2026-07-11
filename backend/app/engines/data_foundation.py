"""数据底座引擎 DataFoundationEngine (SK-4.1-01)

核心能力：跨模块事件采集 → 实时数据同步 → 用户成长档案 → 数据仓库聚合

事件类型按模块划分:
  - plan: created/completed/modified
  - review: started/sop_extracted/skipped
  - emotion: session_started/crisis_detected/manual_created
  - record: started/transcribed/extracted/archived
  - qa: asked/answered/clarified/sop_deposited/feedback
  - office: doc_created/system_built/collaborated
  - career: star_extracted/application_sent/interview_done/offer_received
  - knowledge: doc_archived/search_performed/doc_accessed
"""
from __future__ import annotations

import json
import logging
import threading
from datetime import date, datetime, timezone
from typing import Any

logger = logging.getLogger("data_foundation")

# ═══════════════════════════════════════════════
# 事件类型枚举
# ═══════════════════════════════════════════════
EVENT_TYPES = {
    # 朝有规划
    "plan.created":          "计划创建",
    "plan.completed":        "计划完成",
    "plan.modified":         "计划修改",
    # 暮有复盘
    "review.started":        "复盘开始",
    "review.sop_extracted":  "SOP萃取",
    "review.skipped":        "复盘跳过",
    # 情绪树洞
    "emotion.session_started":    "倾诉开始",
    "emotion.crisis_detected":    "危机检测",
    "emotion.manual_created":     "成长手册生成",
    # 智能记录
    "record.started":        "录音开始",
    "record.transcribed":    "转写完成",
    "record.extracted":      "萃取完成",
    "record.archived":       "归档完成",
    # 智能问答
    "qa.asked":              "提问",
    "qa.answered":           "回答",
    "qa.clarified":          "追问澄清",
    "qa.sop_deposited":      "SOP沉淀",
    "qa.feedback":           "反馈",
    # 智能办公
    "office.doc_created":    "文档生成",
    "office.system_built":   "体系搭建",
    "office.collaborated":   "协作",
    # 高维求职
    "career.star_extracted":     "STAR萃取",
    "career.application_sent":   "投递",
    "career.interview_done":     "面试完成",
    "career.offer_received":     "Offer获取",
    # 公私智库
    "knowledge.doc_archived":        "文档归档",
    "knowledge.search_performed":    "搜索",
    "knowledge.doc_accessed":        "文档访问",
}


def emit_event(
    user_id: str,
    module: str,
    event_type: str,
    properties: dict[str, Any] | None = None,
    db=None,
) -> None:
    """发射事件（异步写入 EventLog，不阻塞主流程）。

    生产环境应通过 Redis Pub/Sub 发布事件，由独立消费者写入DB。
    MVP阶段直接在后台线程中写入。

    Args:
        user_id: 用户ID
        module: 模块标识（如 M1, M2, smart_qa 等）
        event_type: 事件类型（见 EVENT_TYPES）
        properties: 事件属性（JSON可序列化）
        db: 数据库会话工厂（可选，不传则跳过持久化）
    """
    event_label = EVENT_TYPES.get(event_type, event_type)
    logger.info(
        "事件发射: user=%s module=%s type=%s(%s)",
        user_id[:8] if len(user_id) > 8 else user_id,
        module, event_type, event_label,
    )

    if db is None:
        return

    # 异步写入（不阻塞主流程）
    def _write():
        try:
            from ..shared.database import SessionLocal
            from ..shared.models.analytics import EventLog

            session = SessionLocal()
            try:
                entry = EventLog(
                    user_id=user_id,
                    module=module,
                    event_type=event_type,
                    properties=properties or {},
                    ts=datetime.now(timezone.utc).replace(tzinfo=None),
                )
                session.add(entry)
                session.commit()
            except Exception as e:
                session.rollback()
                logger.warning("EventLog写入失败: %s", e)
            finally:
                session.close()
        except Exception as e:
            logger.warning("EventLog异步写入异常: %s", e)

    t = threading.Thread(target=_write, daemon=True)
    t.start()


def write_audit_log(
    user_id: str,
    module: str,
    action: str,
    input_text: str | None = None,
    output_text: str | None = None,
    model_used: str | None = None,
    tokens: int = 0,
    duration_ms: int = 0,
    db=None,
) -> None:
    """写入审计日志（不可删除，保留90天）。

    Args:
        user_id: 用户ID
        module: 模块标识
        action: 操作类型
        input_text: 输入内容（脱敏后）
        output_text: 输出内容
        model_used: 使用的模型
        tokens: Token消耗
        duration_ms: 耗时（毫秒）
        db: 数据库会话
    """
    if db is None:
        return

    def _write():
        from ..shared.database import SessionLocal

        session = SessionLocal()
        try:
            # 截断过长内容
            safe_input = (input_text or "")[:500]
            safe_output = (output_text or "")[:1000]

            detail = {
                "action": action,
                "input_preview": safe_input,
                "output_preview": safe_output,
                "model_used": model_used,
                "tokens": tokens,
                "duration_ms": duration_ms,
            }

            # 使用原始SQL写入（避免循环导入ORM模型）
            from sqlalchemy import text
            session.execute(
                text(
                    "INSERT INTO audit_log (id, user_id, module, action, detail, created_at) "
                    "VALUES (gen_random_uuid(), :uid, :mod, :act, :detail::jsonb, NOW())"
                ),
                {
                    "uid": user_id,
                    "mod": module,
                    "act": action,
                    "detail": json.dumps(detail, ensure_ascii=False),
                },
            )
            session.commit()
        except Exception as e:
            session.rollback()
            logger.warning("审计日志写入失败: %s", e)
        finally:
            session.close()

    t = threading.Thread(target=_write, daemon=True)
    t.start()


def get_user_growth_profile(user_id: str, db) -> dict[str, Any]:
    """获取用户成长档案聚合数据。

    聚合维度:
    - 能力资产: SOP总数/质量分/引用次数
    - 效率指标: 计划完成率/方案生成耗时/问答解决率
    - 情绪健康: 情绪健康指数/危机事件频率/情绪改善斜率
    - 求职进展: 投递→面试→Offer转化率
    - 知识积累: 知识库文档数/标签覆盖度/检索命中率
    """
    from sqlalchemy import func
    from ..shared.models.plan import Plan, PlanTask
    from ..shared.models.review import ReviewRecord
    from ..shared.models.knowledge import Document
    from ..shared.models.emotion import GrowthRecord
    from ..shared.models.qa import QaAnswer

    profile = {
        "total_sops": 0,
        "avg_sop_quality": 0.0,
        "plan_completion_rate": 0.0,
        "total_kb_docs": 0,
        "qa_resolved_rate": 0.0,
        "emotion_health_trend": "stable",
    }

    try:
        # SOP统计
        sop_count = db.query(ReviewRecord).filter(
            ReviewRecord.user_id == user_id,
            ReviewRecord.sop_title.isnot(None),
        ).count()
        profile["total_sops"] = sop_count

        # 知识库文档数
        kb_count = db.query(Document).filter(
            Document.owner_user_id == user_id,
            Document.status == "published",
            Document.deleted_at.is_(None),
        ).count()
        profile["total_kb_docs"] = kb_count

    except Exception as e:
        logger.warning("用户成长档案计算失败: %s", e)

    return profile
