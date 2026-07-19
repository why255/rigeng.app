"""开场白服务 — 统一的小耕对话开场白生成。

按模块 + 时间段 + 星期生成AI开场白，每天首个访问缓存一天的问候语。
5:00AM 日界由前端 useDailyGreeting hook 控制；后端只负责内容生成。
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from ...engines.llm_orchestrator import llm_generate_with_orchestration
from ...engines.persona import build_persona_prompt

# ── 各模块开场白生成 prompt ──

_GREETING_PROMPTS: dict[str, str] = {
    "morning_plan": (
        "用户刚打开「朝有规划」页面，今天是新的一天。\n\n"
        "请以温暖活力的方式开启今天的规划对话。\n"
        "自然融入品牌语「晨起做规划，整日不慌忙」。\n"
        "邀请用户聊聊今天想完成什么，或者有什么想问的。\n"
        "2-3句话即可，清爽不啰嗦。称呼「姐」，自称「小耕」。"
    ),
    "evening_review": (
        "用户刚打开「暮有复盘」页面，准备回顾今天。\n\n"
        "请以温暖沉静的方式开启今天的复盘对话。\n"
        "自然融入品牌语「睡前做复盘，经验变方法」。\n"
        "邀请用户聊聊今天发生了什么、有什么收获想复盘。\n"
        "2-3句话即可，带一点晚间收尾的仪式感。称呼「姐」，自称「小耕」。"
    ),
    "career": (
        "用户刚进入「高维求职」一盘·简历盘点页面。\n\n"
        "请以温暖鼓励的方式开启对话。\n"
        "自然融入品牌语「求职有策略，步步有方向」。\n"
        "邀请用户上传简历或用文字/语音聊聊职业经历。\n"
        "提及五大盘点：履历梳理→STAR追问→技能晶体→人脉资源→岗位建议。\n"
        "2-3句话即可。称呼「姐」，自称「小耕」。"
    ),
    "mood_haven": (
        "用户刚打开「情绪树洞」，需要一个安全、温暖的开始。\n\n"
        "请以极温柔、极耐心的语气开启对话。\n"
        "自然融入品牌语「心事有处说，烦恼变智慧」。\n"
        "强调安全感和隐私——这里说的话不会被评判。\n"
        "邀请用户畅所欲言，把想说的都说出来。\n"
        "2-3句话即可，语气要轻柔、治愈。称呼「姐」，自称「小耕」。"
    ),
}

# ── 硬编码 fallback（LLM 不可用时使用）──

_FALLBACK_GREETINGS: dict[str, str] = {
    "morning_plan": (
        "早安！新的一天开始了～\n"
        "姐，告诉小耕你今天想完成什么，或者有什么想问的～小耕帮你把计划理得明明白白！"
    ),
    "evening_review": (
        "姐，晚上好～\n"
        "今天过得怎么样？有什么收获想复盘的吗？小耕陪你一起回顾今天的点点滴滴～"
    ),
    "career": (
        "姐，欢迎来到一盘·简历盘点～\n"
        "上传简历或直接跟小耕聊聊，咱们一起做五大盘点：履历梳理→STAR追问→技能晶体→人脉资源→岗位建议，把过去的经历变成闪闪发光的求职资产！"
    ),
    "mood_haven": (
        "姐，您来了。这里只有您和小耕，您说的每一句话都会保守秘密。\n"
        "想说什么就说吧，开心的事、烦心的事，小耕都在听～"
    ),
}

# ── 时间段文案前缀 ──

_TIME_PERIOD_HINTS: dict[int, str] = {
    # 5-8: 清晨
    5: "现在是清晨时段。",
    6: "现在是清晨时段。",
    7: "现在是清晨时段。",
    8: "现在是清晨时段。",
    # 9-11: 上午
    9: "现在是上午时段。",
    10: "现在是上午时段。",
    11: "现在是上午时段。",
    # 12-13: 中午
    12: "现在是中午时段。",
    13: "现在是中午时段。",
    # 14-17: 下午
    14: "现在是下午时段。",
    15: "现在是下午时段。",
    16: "现在是下午时段。",
    17: "现在是下午时段。",
    # 18-22: 晚上
    18: "现在是晚间时段。",
    19: "现在是晚间时段。",
    20: "现在是晚间时段。",
    21: "现在是晚间时段。",
    22: "现在是晚间时段。",
    # 23-4: 深夜
    23: "现在是深夜时段，用户可能还在工作。",
    0: "现在是深夜时段，用户可能还在工作。",
    1: "现在是深夜时段，用户可能还在工作。",
    2: "现在是深夜时段，用户可能还在工作。",
    3: "现在是深夜时段，用户可能还在工作。",
    4: "现在是深夜时段，用户可能还在工作。",
}

# 星期中文名
_WEEKDAY_NAMES = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]


def generate_greeting(module: str, user_id: str, db: Session | None = None) -> dict:
    """为指定模块生成今日开场白。

    Args:
        module: 模块标识 — "morning_plan" / "evening_review" / "career"
        user_id: 当前用户ID
        db: 数据库会话（可选）

    Returns:
        {"greeting": str, "model_used": str}
    """
    # ── 构建时间上下文 ──
    now = datetime.now()
    hour = now.hour
    weekday = _WEEKDAY_NAMES[now.weekday()]
    time_hint = _TIME_PERIOD_HINTS.get(hour, "")

    # ── 构建 greeting prompt ──
    base_prompt = _GREETING_PROMPTS.get(module, _GREETING_PROMPTS["morning_plan"])
    prompt = f"{base_prompt}\n\n{time_hint} 今天是{weekday}。"

    # ── 获取系统 persona ──
    system_prompt = build_persona_prompt(module=module)

    # ── 调用 LLM ──
    try:
        result = llm_generate_with_orchestration(
            prompt=prompt,
            system_prompt=system_prompt,
            module=module,
            temperature=0.7,
            max_tokens=256,
            user_id=user_id,
            db=db,
        )
        greeting = (result.get("content") or "").strip()
        if not greeting:
            greeting = _FALLBACK_GREETINGS.get(module, _FALLBACK_GREETINGS["morning_plan"])

        return {
            "greeting": greeting,
            "model_used": result.get("model_used", "fallback"),
        }
    except Exception:
        return {
            "greeting": _FALLBACK_GREETINGS.get(module, _FALLBACK_GREETINGS["morning_plan"]),
            "model_used": "fallback",
        }
