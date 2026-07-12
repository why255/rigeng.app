"""复盘服务 业务逻辑层（步骤11：暮有复盘全部功能）。

实现：获取今日复盘统计、昨日复盘摘要、保存对话（含温柔坚持检测）、
      保存SOP（含知识库自动归档）、提交诊断、归档、获取周进度、
      获取历史列表、连续未复盘提醒检查。

V2.0 算法集成：AI驱动SOP萃取（extract_sop_with_ai）、温柔坚持分级机制（GentlePersistenceHandler）、
      数据底座事件发射（emit_event）。
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from ...shared import errors
from ...shared.database import utcnow
from ...shared.models.knowledge import AuditQueue, Document
from ...shared.models.plan import Plan, PlanTask
from ...shared.models.review import ReviewRecord, REVIEW_STAGES
from ..voice_engine.service import llm_generate, MODULE_SYSTEM_PROMPTS
from ...engines.persona import build_persona_prompt
from ...engines.llm_orchestrator import llm_generate_with_orchestration, MODULE_TEMPERATURE
from ...engines.data_foundation import emit_event

logger = logging.getLogger("reviews")

# ── 温柔坚持：拒绝关键词列表 ──
_REFUSAL_KEYWORDS = [
    "太累了", "不想复盘", "不做了", "明天再说", "没心情",
    "不想做了", "算了", "跳过", "不写了", "改天",
    "不想说", "没时间", "不想回顾", "今天算了",
]

# ── 连续未复盘提醒阈值 ──
_REMINDER_THRESHOLDS = {
    3: {"channel": "push", "level": "gentle", "message": "已经有3天没复盘了，经验不沉淀就溜走了哦~"},
    5: {"channel": "sms", "level": "concerned", "message": "5天未复盘提醒：您的复盘习惯正在中断，小耕想念您了"},
    7: {"channel": "operator", "level": "urgent", "message": "运营官介入：用户已连续7天未复盘"},
}


# ═══════════════════════════════════════════════════════════════════
# 温柔坚持机制算法（V2.0）：按连续跳过天数分级响应
# ═══════════════════════════════════════════════════════════════════

class GentlePersistenceHandler:
    """温柔坚持机制算法 — 按连续跳过天数分级响应。

    根据算法文档V2.0，按连续未复盘天数分级：
    - 0天：温柔提醒 + 快速笔记入口
    - 1-2天：简单鼓励，不打扰
    - 3天：设置晨间提醒
    - 5天：push关怀消息
    - >=7天：导师桥接告警
    """

    @staticmethod
    def handle_skip(user_id: str, consecutive_skip_days: int) -> dict:
        """根据连续跳过天数返回分级响应。

        Args:
            user_id: 用户ID（>=7天时用于生成匿名哈希）
            consecutive_skip_days: 已连续跳过的天数

        Returns:
            dict: 包含 action / message 等字段的分级响应
        """
        if consecutive_skip_days == 0:
            return {
                "message": "没关系姐，今天累了就休息。不过您今天面试的那几个候选人要不要简单记一笔？",
                "allow_quick_note": True,
            }
        elif consecutive_skip_days < 3:
            return {
                "message": "好的姐，今天辛苦了，早点休息~",
                "allow_quick_note": False,
            }
        elif consecutive_skip_days == 3:
            return {
                "action": "set_morning_reminder",
                "morning_message": "姐，有几天没复盘了，今天要不要抽5分钟简单回顾一下？",
            }
        elif consecutive_skip_days == 5:
            return {
                "action": "push_care",
                "push_message": "姐，最近是不是特别忙？小耕注意到您有些日子没复盘了。其实不用多，哪怕每天就记3件最重要的事，积累起来也很厉害~",
            }
        elif consecutive_skip_days >= 7:
            return {
                "action": "teacher_bridge",
                "alert": {
                    "reason": "连续7天未复盘",
                    "anonymized_user": hashlib.sha256(user_id.encode()).hexdigest(),
                },
            }
        return {"message": "好的姐，今天先休息吧~"}


def _today_range():
    """返回今日 UTC 起止（naive datetime，与 plans 服务保持一致）。"""
    today = datetime.now(timezone.utc).date()
    start = datetime(today.year, today.month, today.day, 0, 0, 0)
    end = datetime(today.year, today.month, today.day, 23, 59, 59)
    return start, end


def _get_or_create_review(db: Session, *, user_id: str) -> ReviewRecord:
    """获取今日复盘记录（不存在则创建）。"""
    start, end = _today_range()
    review = db.scalar(
        select(ReviewRecord).where(
            and_(
                ReviewRecord.user_id == user_id,
                ReviewRecord.created_at >= start,
                ReviewRecord.created_at <= end,
            )
        ).order_by(ReviewRecord.created_at.desc())
    )
    if not review:
        review = ReviewRecord(user_id=user_id)
        db.add(review)
        db.flush()
    return review


def _get_today_plan_summary(db: Session, *, user_id: str) -> dict:
    """获取今日计划统计汇总。"""
    start, end = _today_range()
    plan = db.scalar(
        select(Plan).where(
            and_(
                Plan.user_id == user_id,
                Plan.created_at >= start,
                Plan.created_at <= end,
                Plan.status.in_(["draft", "active", "completed"]),
            )
        ).order_by(Plan.created_at.desc())
    )
    if not plan:
        return {"total_tasks": 0, "completed_tasks": 0, "completion_rate": 0}

    tasks = list(
        db.scalars(
            select(PlanTask).where(PlanTask.plan_id == plan.id)
        )
    )
    total = len(tasks)
    completed = sum(1 for t in tasks if t.status == "completed")
    rate = round(completed / total * 100) if total > 0 else 0
    return {"total_tasks": total, "completed_tasks": completed, "completion_rate": rate}


# ── 温柔坚持：拒绝检测 ──

def _detect_refusal(messages: list[dict]) -> bool:
    """检测用户消息中是否含有拒绝复盘意图。"""
    for msg in messages:
        if msg.get("role") == "user":
            text = msg.get("text", "")
            for keyword in _REFUSAL_KEYWORDS:
                if keyword in text:
                    return True
    return False


def _generate_gentle_persistence_reply(user_message: str,
                                        user_id: str | None = None,
                                        db: Session | None = None) -> str:
    """根据用户拒绝消息生成温柔坚持的回复。

    三级降级策略：
    1. GentlePersistenceHandler 结构化分级响应（基于连续跳过天数）
    2. AI引擎生成共情回复
    3. 关键词匹配模板（兜底）
    """
    # ── 第一级：结构化分级响应 ──
    if user_id and db:
        try:
            skip_days = get_consecutive_skip_days(db, user_id=user_id)
            handler_result = GentlePersistenceHandler.handle_skip(user_id, skip_days)
            if handler_result.get("message"):
                return handler_result["message"]
        except Exception:
            pass  # 降级到AI生成

    # ── 第二级：AI引擎生成 ──
    try:
        ai_reply = _generate_ai_gentle_reply(user_message, user_id=user_id, db=db)
        if ai_reply:
            return ai_reply
    except Exception:
        pass  # 降级到模板

    # ── 第三级：关键词匹配模板（兜底）──
    if "累" in user_message:
        return (
            "我知道你今天很累 💙 但正是累的时候，才更需要花3分钟做个简单回顾。"
            "不用写太多，就告诉我今天最重要的一个收获就好~"
        )
    elif "时间" in user_message or "没空" in user_message:
        return (
            "明白你很忙 ⏰ 不过复盘只需要3分钟，把今天的经验沉淀下来，明天就能直接用。"
            "简单说一句今天学了什么也行~"
        )
    elif "心情" in user_message:
        return (
            "心情不好的时候，复盘其实是一种释放 🌿 "
            "把今天的事理一理，明天就是全新的一天。要不要简单聊两句？"
        )
    else:
        return (
            "没关系，我们可以简单一点 🌙 "
            "复盘不一定要很正式，就告诉我今天最有价值的一个发现就好~"
        )


def _generate_ai_gentle_reply(user_message: str,
                               user_id: str | None = None,
                               db: Session | None = None) -> str | None:
    """调用AI引擎生成共情式温柔坚持回复。"""
    prompt = (
        f'用户在复盘流程中说："{user_message}"\n\n'
        f'用户可能因为疲惫、忙碌、情绪等原因想要跳过复盘。'
        f'请用温暖、共情的方式生成一段"温柔坚持"回复，鼓励用户不要跳过复盘。\n\n'
        f'要求：\n'
        f'- 语气温柔但不压迫，2-3句话即可\n'
        f'- 先共情（理解用户的感受），再温柔引导\n'
        f'- 强调复盘只需要很短时间（3分钟）\n'
        f'- 结尾用温和的问句邀请用户继续\n\n'
        f'请直接输出回复文本，不需要JSON格式。'
    )

    try:
        result = llm_generate(
            prompt=prompt,
            system_prompt=MODULE_SYSTEM_PROMPTS.get("evening_review", ""),
            user_id=user_id,
            db=db,
            temperature=0.8,
            module="evening_review",
        )
        reply = result.get("content", "").strip()
        if reply and len(reply) > 10:
            return reply
    except Exception as e:
        logger.warning("AI温柔坚持回复生成失败: %s", e)

    return None


# ═══════════════════════════════════════════════════════════════════
# AI驱动SOP萃取（V2.0）：成功经验SOP自动萃取算法
# ═══════════════════════════════════════════════════════════════════

def _extract_json(text: str) -> dict:
    """从LLM响应文本中提取JSON对象。

    先尝试直接解析，失败后尝试正则匹配{}块。
    """
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # 尝试匹配 JSON 块（支持嵌套）
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return {}


def _calculate_sop_quality(sop_data: dict, actions: list) -> int:
    """计算SOP质量分（0-100），阈值60分以上方可入库。

    三维度评分：
    - 完整性 Completeness（0-40）：步骤是否覆盖所有关键动作
    - 可操作性 Actionability（0-30）：每个步骤是否具体可执行
    - 通用性 Universality（0-30）：SOP是否可复用到同类场景
    """
    steps = sop_data.get("steps", [])
    key_phrases = sop_data.get("key_phrases", [])
    precautions = sop_data.get("precautions", [])

    # ── 完整性：步骤数 vs 关键动作数 ──
    if actions and steps:
        completeness = min(40, int(len(steps) / max(len(actions), 1) * 40))
    else:
        completeness = min(40, len(steps) * 8)

    # ── 可操作性：每步是否包含具体做法和注意事项 ──
    actionability = 0
    for step in steps:
        desc = step.get("description", "")
        if len(desc) > 20:
            actionability += 5
        if any(kw in desc for kw in ["做", "如何", "步骤", "方法"]):
            actionability += 3
        if any(kw in desc for kw in ["注意", "避免", "不要", "小心"]):
            actionability += 2
    actionability = min(30, actionability)

    # ── 通用性：话术和避坑指南的覆盖度 ──
    universality = 0
    if key_phrases:
        universality += min(15, len(key_phrases) * 5)
    if precautions:
        universality += min(15, len(precautions) * 5)

    return completeness + actionability + universality


def extract_sop_with_ai(
    task_description: str,
    user_reflection: str,
    user_id: str | None = None,
    db: Session | None = None,
) -> dict:
    """AI驱动的两阶段SOP自动萃取算法。

    Stage 1 - 关键动作识别：从用户描述中提取关键成功动作。
    Stage 2 - SOP结构化（仅当Stage 1找到动作时）：
              生成步骤、话术、避坑指南，并自动质量评分。

    Args:
        task_description: 任务描述（如"绩效面谈"）
        user_reflection: 用户的复盘反思文本
        user_id: 用户ID（用于事件追踪）
        db: 数据库会话

    Returns:
        dict: {
            "title": str, "steps": list[dict], "key_phrases": str,
            "precautions": str, "quality_score": int, "ai_extracted": bool,
            "scenario": str (可选),
        }
        如果AI萃取失败或未找到关键动作，返回 {"ai_extracted": False, "reason": "..."}
    """
    module_key = "evening_review"
    try:
        # 构建人设注入的 system prompt
        system_prompt = build_persona_prompt(module=module_key)

        # ── Stage 1: 关键动作识别 ──
        stage1_prompt = (
            f"用户在完成'{task_description}'时，做了哪些关键动作使这件事成功？"
            f"请从用户的描述中提取，不要编造。如果用户没有描述具体动作，返回空列表。\n\n"
            f"用户描述：\n{user_reflection}\n\n"
            f'请严格以JSON格式返回：{{"actions": ["动作1", "动作2"]}} 或 {{"actions": []}}'
        )

        stage1_result = llm_generate_with_orchestration(
            prompt=stage1_prompt,
            system_prompt=system_prompt,
            module=module_key,
            task_complexity="medium",
            temperature=0.3,
            user_id=user_id,
            db=db,
        )

        stage1_data = _extract_json(stage1_result.get("content", "{}"))
        actions = stage1_data.get("actions", [])

        if not actions:
            logger.info("AI SOP萃取 Stage1: 未发现关键动作 (task=%s)", task_description[:30])
            return {"ai_extracted": False, "reason": "no_actions_found"}

        logger.info("AI SOP萃取 Stage1: 识别到%d个关键动作", len(actions))

        # ── Stage 2: SOP结构化 ──
        actions_text = "\n".join(f"- {a}" for a in actions)
        stage2_prompt = (
            f"基于以下关键动作，生成一份SOP操作指南:\n\n"
            f"关键动作：\n{actions_text}\n\n"
            f"请生成以下内容：\n"
            f"  标题: [场景]操作指南 (如: 绩效面谈操作指南)\n"
            f"  适用场景: [何时使用]\n"
            f"  步骤: ≤7步，每步含(做什么+怎么做+注意事项)\n"
            f"  关键话术: 1-3个可直接使用的沟通话术\n"
            f"  避坑指南: 1-3个常见错误\n\n"
            f"质量要求:\n"
            f"- 每个步骤必须是可操作的具体动作，不是空泛描述\n"
            f"- 话术必须自然，像真人会说的话，不能用AI腔\n"
            f"- 避坑指南必须来源于用户描述中的真实踩坑经历\n\n"
            f'请严格以JSON格式返回：\n'
            f'{{"title": "SOP标题", "scenario": "适用场景", '
            f'"steps": [{{"step_number": 1, "title": "步骤标题", '
            f'"description": "做什么+怎么做+注意事项"}}], '
            f'"key_phrases": ["话术1", "话术2"], '
            f'"precautions": ["避坑1", "避坑2"]}}'
        )

        stage2_result = llm_generate_with_orchestration(
            prompt=stage2_prompt,
            system_prompt=system_prompt,
            module=module_key,
            task_complexity="medium",
            temperature=0.3,
            user_id=user_id,
            db=db,
        )

        sop_data = _extract_json(stage2_result.get("content", "{}"))
        if not sop_data:
            logger.warning("AI SOP萃取 Stage2: 无法解析LLM返回的JSON")
            return {"ai_extracted": False, "reason": "stage2_parse_failed"}

        # ── 质量评分 ──
        quality_score = _calculate_sop_quality(sop_data, actions)

        logger.info(
            "AI SOP萃取完成: title=%s steps=%d quality=%d",
            sop_data.get("title", "?")[:30],
            len(sop_data.get("steps", [])),
            quality_score,
        )

        return {
            "title": sop_data.get("title", f"{task_description}操作指南"),
            "steps": sop_data.get("steps", []),
            "key_phrases": "\n".join(sop_data.get("key_phrases", [])),
            "precautions": "\n".join(sop_data.get("precautions", [])),
            "quality_score": quality_score,
            "ai_extracted": True,
            "scenario": sop_data.get("scenario", ""),
        }

    except Exception as e:
        logger.warning("AI SOP萃取异常 (task=%s): %s", task_description[:30], e)
        return {"ai_extracted": False, "reason": str(e)}


# ═══════════════════════════════════════════════════════════════════
# AI 复盘对话 — 所有小耕输出由模型生成，按算法引导五阶段复盘
# ═══════════════════════════════════════════════════════════════════

_REVIEW_CHAT_SYSTEM_PROMPT = """你是"小耕"，日耕平台的智能职场成长伙伴。

【身份】：
- 你是一个像懂HR的闺蜜姐姐一样的陪伴者
- 称呼用户「姐」，自称「小耕」
- 语气温暖沉静，带一点晚间收尾的仪式感
- 自然融入品牌语「睡前做复盘，经验变方法」

【当前场景：暮有复盘】
用户正在做每日复盘。你需要按照五阶段算法引导用户完成复盘：

阶段0-信息收集(collecting)：用户在自由描述今天发生的事。你需要：
- 追问具体细节（最有成就感的事、遇到什么困难、今天学到了什么）
- 不要着急推进，先让用户充分表达
- 当用户表达了足够信息（说了具体事件+感受+困难/收获），引导进入正式复盘
- 每次追问只需1-2句话，温柔简洁

阶段1-问候(greeting)：正式开启复盘。确认用户今天的状态，邀请回顾今天完成的事。

阶段2-盘点(inventory)：引导用户回顾今天最大收获或印象最深的事。

阶段3-萃取(extraction)：帮用户从经历中提炼可复用的经验/方法/SOP。

阶段4-改进(improvement)：引导用户思考改进方向，明天的行动计划。

阶段5-归档(archive)：总结复盘成果，给予鼓励，告知复盘已归档。

【重要规则】：
1. 如果用户表现出抗拒（说累/不想复盘/没心情等），温柔坚持一次："我知道你今天很累，但正是累的时候，才更需要花3分钟做个简单回顾~"
2. 如果用户再次拒绝，尊重选择："好的，今天先休息吧！小耕尊重你的选择。如果想复盘，随时可以回来~"
3. 回复始终温暖、简洁（2-4句话），不要啰嗦
4. 根据用户说的内容自然回应，不要机械套模板"""


def process_review_chat(
    message: str,
    phase: str = "reviewing",
    stage: str = "greeting",
    context: list[dict] | None = None,
    info_rounds: int = 0,
    gentle_persistence_used: bool = False,
    user_id: str | None = None,
    db: Session | None = None,
) -> dict:
    """暮有复盘 AI 对话 — 所有小耕回复由AI模型生成。

    根据用户当前的复盘阶段(collecting/五阶段)，调用LLM生成符合
    算法的引导回复。前端负责阶段流转控制，后端负责内容生成。

    Args:
        message: 用户当前消息
        phase: collecting | reviewing
        stage: greeting|inventory|extraction|improvement|archive
        context: 对话历史 [{role, text}]
        info_rounds: 信息收集已进行轮数
        gentle_persistence_used: 是否已使用温柔坚持
        user_id: 用户ID
        db: 数据库会话

    Returns:
        {"reply": str, "model_used": str}
    """
    module_key = "evening_review"

    try:
        # 构建对话历史文本
        context_text = ""
        if context:
            recent = context[-12:]  # 只取最近12条
            parts = []
            for m in recent:
                role_label = "姐" if m.get("role") == "user" else "小耕"
                text = (m.get("text") or m.get("content") or "").strip()
                if text:
                    parts.append(f"{role_label}：{text}")
            context_text = "\n".join(parts)

        # 根据阶段构建不同的 prompt
        stage_hint = ""
        if not message.strip():
            # 初始问候：根据阶段生成开场白
            if phase == "collecting":
                prompt = (
                    "用户刚打开暮有复盘页面，还没有说过话。\n"
                    "请以温暖的方式打招呼，开启今天的复盘对话。\n"
                    "可以融入品牌语「睡前做复盘，经验变方法」。\n"
                    "邀请用户聊聊今天发生了什么、有什么想复盘的事。\n"
                    "2-3句话即可，热情但不啰嗦。"
                )
            else:
                prompt = (
                    "用户之前已经开始了复盘，现在回来了。\n"
                    "请以温暖的方式欢迎用户回来继续复盘。\n"
                    "可以简单回顾一下之前聊了什么，邀请继续。\n"
                    "2-3句话即可。"
                )
        elif phase == "collecting":
            stage_hint = (
                f"当前处于【信息收集阶段】，已进行 {info_rounds} 轮对话。\n"
                f"用户正在自由描述今天发生的事。你需要追问引导，了解更多细节。\n"
            )
            if info_rounds >= 2:
                stage_hint += (
                    "用户已经说了不少信息了。如果这次回复中用户充分表达了"
                    "具体事件+感受+收获/困难，请在回复末尾自然地提出"
                    "「我们来做系统的复盘吧」，引导进入正式复盘。\n"
                )
        else:
            stage_labels = {
                "greeting": "问候阶段 — 确认状态，邀请回顾今天完成的事",
                "inventory": "盘点阶段 — 引导回顾今天最大收获或印象最深的事",
                "extraction": "萃取阶段 — 帮用户从经历中提炼可复用方法/SOP",
                "improvement": "改进阶段 — 引导思考改进方向，明天行动计划",
                "archive": "归档阶段 — 总结复盘成果，给予鼓励，准备归档",
            }
            stage_desc = stage_labels.get(stage, "正在复盘中")
            stage_hint = f"当前处于【{stage_desc}】。\n"

        # 温柔坚持状态提示
        persistence_hint = ""
        if gentle_persistence_used:
            persistence_hint = (
                "注意：你已经温柔坚持过一次了。如果用户这次还是明确拒绝"
                "或不想继续，请尊重用户的选择，温和地让ta休息。\n"
            )

        if message.strip():
            prompt = (
                f"{stage_hint}"
                f"{persistence_hint}"
                f"\n最近对话：\n{context_text}\n"
                f"────────────────\n"
                f"姐刚说：{message}\n\n"
                f"请以小耕的身份自然回复。回复要求：\n"
                f"- 称呼「姐」，自称「小耕」\n"
                f"- 语气温暖亲切，2-4句话即可\n"
                f"- 根据当前阶段自然引导，不要生硬切换话题\n"
                f"- 如果用户说了具体事件，先回应/赞美/共情，再引导下一步\n"
            )

        system_prompt = build_persona_prompt(module=module_key)

        result = llm_generate_with_orchestration(
            prompt=prompt,
            system_prompt=system_prompt,
            module=module_key,
            task_complexity="medium",
            temperature=0.7,
            user_id=user_id,
            db=db,
        )

        reply = result.get("content", "").strip()
        if not reply:
            reply = "姐，今天辛苦了~复盘是个好习惯，咱们继续聊聊今天的收获？"

        return {
            "reply": reply,
            "model_used": result.get("model_used", ""),
        }

    except Exception as e:
        logger.warning("暮有复盘AI对话失败: %s", e)
        return {
            "reply": "姐，小耕正在努力思考中，稍等一下哦～",
            "model_used": "",
        }


# ── P1 入口页 ──

def get_review_stats(db: Session, *, user_id: str) -> dict:
    """获取今日复盘统计数据。"""
    plan_summary = _get_today_plan_summary(db, user_id=user_id)
    review = _get_or_create_review(db, user_id=user_id)

    return {
        "total_tasks": plan_summary["total_tasks"],
        "completed_tasks": plan_summary["completed_tasks"],
        "completion_rate": plan_summary["completion_rate"],
        "sop_count": 1 if review.sop_title else 0,
        "courage_value": review.courage_value or 0,
        "courage_message": review.courage_message,
        "gentle_persistence_used": review.gentle_persistence_used or False,
    }


def get_yesterday_summary(db: Session, *, user_id: str) -> dict | None:
    """获取昨日复盘摘要。"""
    yesterday = datetime.now(timezone.utc).date() - timedelta(days=1)
    y_start = datetime(yesterday.year, yesterday.month, yesterday.day, 0, 0, 0)
    y_end = datetime(yesterday.year, yesterday.month, yesterday.day, 23, 59, 59)

    review = db.scalar(
        select(ReviewRecord).where(
            and_(
                ReviewRecord.user_id == user_id,
                ReviewRecord.created_at >= y_start,
                ReviewRecord.created_at <= y_end,
            )
        ).order_by(ReviewRecord.created_at.desc())
    )

    if not review:
        return None

    return {
        "sop_title": review.sop_title or "无标题",
        "completion_rate": f"{int(review.completion_rate or 0)}%",
        "courage_value": review.courage_value or 0,
        "archived": review.archived or False,
        "date": review.review_date or yesterday.isoformat(),
    }


# ── P2 对话页辅助 ──

def save_review_message(db: Session, *, user_id: str, stage: str,
                        messages: list[dict], emotion_score: int | None,
                        courage_value: int | None) -> dict:
    """保存复盘对话记录（每个阶段结束时触发）。

    阶段内如果检测到用户拒绝意图，触发温柔坚持机制：
    - 第一次拒绝：标记 gentle_persistence_used=True，返回温柔坚持回复
    - 第二次拒绝（温柔坚持已使用）：尊重用户选择，允许跳过
    """
    review = _get_or_create_review(db, user_id=user_id)
    if emotion_score is not None:
        review.emotion_score = emotion_score
    if courage_value is not None:
        review.courage_value = courage_value
    review.review_date = datetime.now(timezone.utc).date().isoformat()

    # ── 温柔坚持检测 ──
    is_refusal = _detect_refusal(messages)
    gentle_persistence_reply: str | None = None

    if is_refusal and stage in ("greeting",):
        if not review.gentle_persistence_used:
            # 第一次拒绝 → 温柔坚持一次
            review.gentle_persistence_used = True
            # 找到用户的拒绝消息
            user_msg = ""
            for m in messages:
                if m.get("role") == "user":
                    user_msg = m.get("text", "")
                    break
            gentle_persistence_reply = _generate_gentle_persistence_reply(
                user_msg, user_id=user_id, db=db,
            )
        else:
            # 温柔坚持已用过 → 尊重用户选择
            review.status = "skipped"
            gentle_persistence_reply = "好的，今天先休息吧 🌙 明天再见~"
            # ── 发射跳过事件到数据底座 ──
            try:
                skip_days = get_consecutive_skip_days(db, user_id=user_id)
                emit_event(user_id, "reviews", "review.skipped", {
                    "stage": stage,
                    "consecutive_skip_days": skip_days,
                }, db=db)
            except Exception:
                pass

    db.commit()

    result: dict = {"saved": True, "stage": stage}
    if gentle_persistence_reply:
        result["gentle_persistence"] = {
            "triggered": True,
            "already_used": review.gentle_persistence_used and not is_refusal,
            "reply": gentle_persistence_reply,
            "allow_skip": review.status == "skipped",
        }
    return result


def save_sop(db: Session, *, user_id: str, title: str, steps: list[dict],
             key_phrases: str | None, precautions: str | None,
             reflection_text: str | None = None) -> dict:
    """生成/保存 SOP，并自动归档到知识库（跨模块数据流：复盘→知识库归档）。

    V2.0 增强：可选 AI 自动萃取 SOP。
    当 reflection_text 提供时，先尝试 AI 两阶段萃取算法（extract_sop_with_ai）；
    若 AI 萃取成功且 quality_score >= 60，优先采用 AI 结果；
    若 AI 萃取失败或质量不达标，降级使用前端传入的原始数据（原行为）。
    """
    review = _get_or_create_review(db, user_id=user_id)

    final_title = title
    final_steps = steps
    final_key_phrases = key_phrases
    final_precautions = precautions
    final_quality_score = min(5, max(1, len(steps)))
    ai_extracted = False

    # ── V2.0: 尝试 AI 自动萃取 SOP ──
    if reflection_text and reflection_text.strip():
        try:
            ai_sop = extract_sop_with_ai(
                task_description=title,
                user_reflection=reflection_text,
                user_id=user_id,
                db=db,
            )
            if ai_sop.get("ai_extracted") and ai_sop.get("quality_score", 0) >= 60:
                final_title = ai_sop.get("title", title)
                final_steps = ai_sop.get("steps", steps)
                final_key_phrases = ai_sop.get("key_phrases") or key_phrases
                final_precautions = ai_sop.get("precautions") or precautions
                final_quality_score = ai_sop["quality_score"]
                ai_extracted = True
                logger.info(
                    "SOP AI萃取成功并采用: title=%s quality=%d",
                    final_title[:30], final_quality_score,
                )
            else:
                logger.info(
                    "SOP AI萃取未采用 (quality=%s), 降级使用前端数据",
                    ai_sop.get("quality_score", "N/A"),
                )
        except Exception as e:
            logger.warning("SOP AI萃取降级: %s", e)

    review.sop_title = final_title
    review.sop_steps_json = {"steps": final_steps}
    review.sop_key_phrases = final_key_phrases
    review.sop_precautions = final_precautions
    review.sop_quality_score = final_quality_score

    # ── SOP 自动归档到知识库（步骤11 跨模块集成）──
    kb_doc_id: str | None = None
    try:
        content = {
            "sop_title": final_title,
            "sop_steps": final_steps,
            "key_phrases": final_key_phrases,
            "precautions": final_precautions,
            "quality_score": final_quality_score,
            "source": "evening_review",
            "ai_extracted": ai_extracted,
            "review_date": review.review_date or datetime.now(timezone.utc).date().isoformat(),
        }
        doc = Document(
            owner_user_id=user_id,
            library_type="private",
            doc_type="sop",
            source_module="M2",  # 暮有复盘
            title=final_title or "复盘萃取SOP",
            content=content,
            status="draft",
            audit_status="pending",
            is_desensitized=True,  # 复盘内容默认已脱敏
            is_negative_blocked=False,
            vector_status="pending",
            version=1,
        )
        db.add(doc)
        db.flush()

        # 进入待审核区
        now = utcnow()
        db.add(AuditQueue(
            doc_id=doc.id,
            entered_at=now,
            expire_remind_at=now + timedelta(days=30),
        ))
        kb_doc_id = doc.id
    except Exception:
        # 知识库归档失败不阻断SOP保存（降级策略）
        db.rollback()
        # 重新获取review（因为rollback可能使之前的修改失效）
        review2 = _get_or_create_review(db, user_id=user_id)
        review2.sop_title = final_title
        review2.sop_steps_json = {"steps": final_steps}
        review2.sop_key_phrases = final_key_phrases
        review2.sop_precautions = final_precautions
        review2.sop_quality_score = final_quality_score

    db.commit()

    # ── 发射 SOP 萃取事件到数据底座 ──
    try:
        emit_event(user_id, "reviews", "review.sop_extracted", {
            "sop_title": final_title,
            "quality_score": final_quality_score,
            "step_count": len(final_steps),
            "ai_extracted": ai_extracted,
            "kb_doc_id": str(kb_doc_id) if kb_doc_id else None,
        }, db=db)
    except Exception:
        pass

    return {
        "id": review.id,
        "title": review.sop_title,
        "steps": final_steps,
        "key_phrases": review.sop_key_phrases,
        "precautions": review.sop_precautions,
        "quality_score": review.sop_quality_score,
        "kb_doc_id": kb_doc_id,  # 知识库文档ID，验证跨模块数据流
        "ai_extracted": ai_extracted,
        "created_at": review.created_at.isoformat() if review.created_at else None,
    }


def get_today_sop(db: Session, *, user_id: str) -> dict | None:
    """获取今日生成的 SOP。"""
    review = _get_or_create_review(db, user_id=user_id)
    if not review.sop_title:
        return None
    return {
        "id": review.id,
        "title": review.sop_title,
        "steps": review.sop_steps_json.get("steps", []) if review.sop_steps_json else [],
        "key_phrases": review.sop_key_phrases,
        "precautions": review.sop_precautions,
        "quality_score": review.sop_quality_score,
        "created_at": review.created_at.isoformat() if review.created_at else None,
    }


# ── P3 报告页 ──

def submit_diagnosis(db: Session, *, user_id: str, answers: dict) -> dict:
    """提交诊断问卷。"""
    review = _get_or_create_review(db, user_id=user_id)
    review.diagnosis_json = answers
    db.commit()
    return {"id": review.id, "answers": answers,
            "submitted_at": review.updated_at.isoformat() if review.updated_at else None}


def archive_review(db: Session, *, user_id: str) -> dict:
    """归档今日复盘。"""
    review = _get_or_create_review(db, user_id=user_id)
    review.archived = True

    # 同步计划完成率
    plan_summary = _get_today_plan_summary(db, user_id=user_id)
    review.completion_rate = plan_summary["completion_rate"]

    db.commit()

    return {
        "archived": True,
        "courage_value": review.courage_value or 0,
        "completion_rate": int(review.completion_rate or 0),
        "message": "复盘已归档，明天的你会感谢今天认真的自己 ✨",
    }


# ── P4 历史页 ──

WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]


def get_weekly_progress(db: Session, *, user_id: str) -> dict:
    """获取本周复盘进度。"""
    today = datetime.now(timezone.utc).date()
    monday = today - timedelta(days=today.weekday())
    m_start = datetime(monday.year, monday.month, monday.day, 0, 0, 0)
    s_end = datetime(today.year, today.month, today.day, 23, 59, 59)

    reviews = list(
        db.scalars(
            select(ReviewRecord).where(
                and_(
                    ReviewRecord.user_id == user_id,
                    ReviewRecord.created_at >= m_start,
                    ReviewRecord.created_at <= s_end,
                )
            ).order_by(ReviewRecord.created_at)
        )
    )

    # 构建天索引映射
    review_map = {}
    for r in reviews:
        if r.created_at:
            d = r.created_at.date()
            day_index = d.weekday()
            review_map[day_index] = r

    days = []
    today_idx = today.weekday()
    for i in range(7):
        d = monday + timedelta(days=i)
        r = review_map.get(i)
        if r:
            status = "completed" if r.archived or r.status == "completed" else "in_progress"
            completion_rate = int(r.completion_rate or 0)
        elif i < today_idx:
            status = "pending"
            completion_rate = 0
        elif i == today_idx:
            status = "in_progress"
            plan = _get_today_plan_summary(db, user_id=user_id)
            completion_rate = plan["completion_rate"] if plan["total_tasks"] > 0 else 0
        else:
            status = "pending"
            completion_rate = 0

        days.append({
            "day": WEEKDAY_LABELS[i],
            "day_index": i,
            "status": status,
            "completion_rate": completion_rate,
        })

    return {"week_label": f"{monday.month}/{monday.day} - {today.month}/{today.day}", "days": days}


def get_review_history(db: Session, *, user_id: str, limit: int = 30) -> list[dict]:
    """获取历史复盘列表。"""
    reviews = list(
        db.scalars(
            select(ReviewRecord).where(
                ReviewRecord.user_id == user_id
            ).order_by(ReviewRecord.created_at.desc()).limit(limit)
        )
    )

    results = []
    for r in reviews:
        day_str = r.created_at.strftime("%m月%d日") if r.created_at else ""
        weekday = WEEKDAY_LABELS[r.created_at.weekday()] if r.created_at else ""

        results.append({
            "id": r.id,
            "date": day_str,
            "day_of_week": weekday,
            "sop_title": r.sop_title,
            "quality_score": r.sop_quality_score,
            "status": r.status if r.archived or r.sop_title else "skipped",
        })

    return results


# ── 连续未复盘提醒（步骤11：跨服务集成 - 推送服务）──

def get_consecutive_skip_days(db: Session, *, user_id: str) -> int:
    """查询连续未复盘天数（从最近一次复盘至今）。"""
    today = datetime.now(timezone.utc).date()
    t_end = datetime(today.year, today.month, today.day, 23, 59, 59)

    # 从今天往前查，找到最后一次有效复盘
    reviews = list(
        db.scalars(
            select(ReviewRecord).where(
                and_(
                    ReviewRecord.user_id == user_id,
                    ReviewRecord.created_at <= t_end,
                )
            ).order_by(ReviewRecord.created_at.desc()).limit(30)
        )
    )

    if not reviews:
        return 0

    # 计算连续跳过天数
    consecutive = 0
    check_date = today
    # 按日期分组：每天只要有 archived=True 或 sop_title 就不算跳过
    review_dates: dict = {}
    for r in reviews:
        if r.created_at:
            d = r.created_at.date()
            if d not in review_dates:
                review_dates[d] = r

    while check_date >= today - timedelta(days=30):
        r = review_dates.get(check_date)
        if r and (r.archived or r.sop_title):
            # 找到了有效复盘 → 停止计数
            break
        consecutive += 1
        check_date -= timedelta(days=1)

    return consecutive


def check_non_review_reminders(db: Session, *, user_id: str) -> dict:
    """检查连续未复盘天数并返回应触发的提醒信息。

    返回结构：
    {
        "consecutive_skip_days": int,
        "reminders": [
            {"channel": "push/sms/operator", "level": "...", "message": "..."}
        ]
    }
    """
    skip_days = get_consecutive_skip_days(db, user_id=user_id)
    reminders = []

    # 按阈值降序检查，每个阈值返回一条提醒
    for days_threshold in sorted(_REMINDER_THRESHOLDS.keys(), reverse=True):
        if skip_days >= days_threshold:
            reminder = _REMINDER_THRESHOLDS[days_threshold]
            reminders.append({
                "days": skip_days,
                "threshold": days_threshold,
                "channel": reminder["channel"],
                "level": reminder["level"],
                "message": reminder["message"],
            })

    return {
        "consecutive_skip_days": skip_days,
        "reminders": reminders,
        "needs_attention": skip_days >= 3,
    }
