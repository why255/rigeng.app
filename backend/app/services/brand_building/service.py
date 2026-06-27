"""品牌打造中心服务 — 核心业务逻辑（步骤21 / Wave 4）。

跨模块调用链：
  品牌内容 ← ②知识库（私有库素材/成长型复盘素材）
  品牌内容 ← ③AI引擎（LLM生成文案+配图建议）
  品牌内容 → ⑥推送服务（定时发布提醒）
  咨询线索 → 拿下一个客户模块（线索流转）
  勇气值 ← 数据分析（发布频率+面谈转化）

设计原则：
  - 只写业务逻辑层，基础能力全部调用已有服务
  - 负面内容绝对禁止调取（情绪树洞/危机内容自动拦截）
  - 成长型复盘素材 only after user 主动确认
  - 自动生成连续3天未确认→自动暂停
"""
from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import desc, func, and_
from sqlalchemy.orm import Session

from ...shared.config import settings
from ...shared.database import new_uuid, utcnow
from ...shared.errors import APIError, E_FILE_NOT_FOUND, E_PARAM_FORMAT, E_NEGATIVE_BLOCKED, E_NO_PERMISSION
from ...shared.models.brand import (
    BRAND_STATUSES, CONTENT_TYPES, MOMENT_TIME_SLOTS, ARTICLE_STATUSES, LEAD_TYPES, LEAD_STATUSES,
    BrandProfile, BrandContent, BrandAnalytics, BrandCourageValue, BrandLead,
)

logger = logging.getLogger("brand_building")

# ── 时段 → 默认主题映射 ──
SLOT_TOPICS: dict[str, str] = {
    "morning": "行业洞察与趋势分析",
    "noon": "个人成长与转型故事",
    "evening": "专业知识与技能分享",
    "bedtime": "今日复盘与明日行动",
    "weekend": "生活感悟与学习推荐",
}

SLOT_TONES: dict[str, str] = {
    "morning": "inspirational",
    "noon": "casual",
    "evening": "professional",
    "bedtime": "inspirational",
    "weekend": "casual",
}

# ── 勇气值里程碑定义 ──
COURAGE_MILESTONES: list[dict] = [
    {"name": "第一步", "description": "发布第一篇品牌内容", "score_threshold": 50},
    {"name": "持续输出", "description": "累计发布10篇内容", "score_threshold": 150},
    {"name": "稳定节奏", "description": "连续7天保持发布", "score_threshold": 300},
    {"name": "影响力初现", "description": "累计获得100次互动", "score_threshold": 500},
    {"name": "品牌建设者", "description": "累计发布50篇内容", "score_threshold": 700},
    {"name": "思想引领者", "description": "累计获得50条咨询线索", "score_threshold": 900},
]

COURAGE_LEVELS: list[dict] = [
    {"level": "初级转型者", "min": 0, "max": 99},
    {"level": "勇敢探索者", "min": 100, "max": 299},
    {"level": "稳定输出者", "min": 300, "max": 499},
    {"level": "品牌建设者", "min": 500, "max": 699},
    {"level": "思想引领者", "min": 700, "max": 1000},
]

# ── 负面/隐私关键词拦截列表 ──
NEGATIVE_KEYWORDS: list[str] = [
    "自杀", "想死", "活不下去", "绝望", "崩溃",
    "抑郁症", "焦虑症", "心理疾病",
    "被开除", "被辞退", "被裁员", "失业",
    "离婚", "分手", "出轨",
    "欠债", "还不起", "破产",
    "身份证号", "银行卡号", "密码",
]


def _get_or_create_profile(db: Session, user_id: str) -> BrandProfile:
    """获取或创建用户品牌配置。"""
    profile = db.query(BrandProfile).filter(
        BrandProfile.user_id == user_id,
        BrandProfile.deleted_at.is_(None),
    ).first()
    if not profile:
        profile = BrandProfile(
            user_id=user_id,
            authorized_sources_json=[],
            strategy_prefs_json={
                "time_slots": {
                    "morning": {"enabled": True, "tone": "inspirational", "topic_focus": "行业洞察与趋势"},
                    "noon": {"enabled": True, "tone": "casual", "topic_focus": "个人成长与转型故事"},
                    "evening": {"enabled": True, "tone": "professional", "topic_focus": "专业知识分享"},
                    "bedtime": {"enabled": True, "tone": "inspirational", "topic_focus": "复盘与明日行动计划"},
                    "weekend": {"enabled": True, "tone": "casual", "topic_focus": "生活感悟与学习推荐"},
                },
                "image_style": "minimalist",
                "auto_generate": False,
            },
            status="active",
            disclaimer_confirmed=False,
            unconfirmed_days=0,
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def _get_or_create_courage(db: Session, user_id: str) -> BrandCourageValue:
    """获取或创建用户勇气值记录。"""
    courage = db.query(BrandCourageValue).filter(
        BrandCourageValue.user_id == user_id,
        BrandCourageValue.deleted_at.is_(None),
    ).first()
    if not courage:
        courage = BrandCourageValue(
            user_id=user_id,
            total_score=0,
            dimension_scores_json={
                "publish_frequency": 0,
                "conversion_rate": 0,
                "consistency": 0,
                "growth": 0,
            },
            milestones_json=[],
            interventions_json=[],
            consecutive_no_publish_days=0,
            publish_count_7d=0,
            consecutive_interview_fails=0,
        )
        db.add(courage)
        db.commit()
        db.refresh(courage)
    return courage


# ═══════════════════════════════════════════════
# 负面内容过滤（系统级拦截）
# ═══════════════════════════════════════════════

def filter_negative_content(text: str) -> tuple[bool, list[str]]:
    """检测文本是否包含负面/隐私内容。

    Returns:
        (has_negative, matched_keywords): 是否包含负面内容及匹配的关键词列表
    """
    matched = []
    text_lower = text.lower()
    for keyword in NEGATIVE_KEYWORDS:
        if keyword.lower() in text_lower:
            matched.append(keyword)
    return len(matched) > 0, matched


def desensitize_content(text: str) -> str:
    """自动检测并脱敏敏感信息。

    脱敏规则：
    - 手机号: 138****1234
    - 身份证号: 110101****1234 (只保留前6位和后4位)
    - 银行卡号: ****1234
    - 邮箱: a***@domain.com
    """
    import re

    # 手机号（中国大陆）
    text = re.sub(r'(1[3-9]\d)(\d{4})(\d{4})', r'\1****\3', text)
    # 身份证号（18位）
    text = re.sub(r'(\d{6})(\d{8})(\d{4})', r'\1********\3', text)
    # 银行卡号（16-19位数字）
    text = re.sub(r'(\d{4})\d{8,11}(\d{4})', r'\1********\2', text)
    # 邮箱
    text = re.sub(r'([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', r'\1***@\2', text)

    return text


def check_content_safety(text: str) -> None:
    """内容安全检查：拦截负面/隐私内容，脱敏敏感信息。

    关键规则：负面内容绝对禁止调取。
    """
    has_negative, matched_keywords = filter_negative_content(text)
    if has_negative:
        logger.warning("Negative content detected and blocked: keywords=%s", matched_keywords)
        raise APIError(
            E_NEGATIVE_BLOCKED.code,
            f"检测到负面/隐私内容，已被系统自动拦截。匹配关键词: {', '.join(matched_keywords)}",
            E_NEGATIVE_BLOCKED.http_status,
        )


# ═══════════════════════════════════════════════
# 品牌入驻引导
# ═══════════════════════════════════════════════

def start_brand_onboarding(
    db: Session,
    user_id: str,
    accept_disclaimer: bool = False,
    industry: str | None = None,
    target_audience: str | None = None,
    personal_style: str | None = None,
) -> dict[str, Any]:
    """首次品牌对话引导 + 免责声明确认。

    引导流程：
    1. 检测用户是否已完成入驻
    2. 弹窗展示免责声明（禁止使用他人经历/负面内容/虚假宣传）
    3. 用户确认后初始化品牌配置
    """
    profile = db.query(BrandProfile).filter(
        BrandProfile.user_id == user_id,
        BrandProfile.deleted_at.is_(None),
    ).first()

    if profile and profile.disclaimer_confirmed:
        return {
            "user_id": user_id,
            "onboarding_complete": True,
            "disclaimer_confirmed": True,
            "strategy_summary": "品牌入驻已完成，可开始使用品牌打造功能。",
        }

    if not accept_disclaimer:
        # 返回免责声明内容供前端展示
        disclaimer_text = (
            "品牌打造中心免责声明：\n"
            "1. 您承诺发布的品牌内容为原创或已获授权，不会侵犯他人知识产权。\n"
            "2. 您承诺不使用本平台传播虚假、误导性或违法的信息。\n"
            "3. 您确认品牌内容不会包含负面情绪或他人隐私信息。\n"
            "4. 日耕平台仅为内容创作辅助工具，对内容的真实性、合法性不作担保。\n"
            "5. 成长型复盘素材仅在您主动确认后方可调取。\n"
            "请确认以上条款后开始使用品牌打造功能。"
        )
        return {
            "user_id": user_id,
            "onboarding_complete": False,
            "disclaimer_confirmed": False,
            "strategy_summary": disclaimer_text,
        }

    # 用户确认免责声明，创建/更新品牌配置
    if not profile:
        profile = _get_or_create_profile(db, user_id)

    profile.disclaimer_confirmed = True
    profile.disclaimer_confirmed_at = datetime.now(timezone.utc).isoformat()
    profile.status = "active"

    # 更新策略偏好
    prefs = profile.strategy_prefs_json or {}
    if industry:
        prefs["industry"] = industry
    if target_audience:
        prefs["target_audience"] = target_audience
    if personal_style:
        prefs["personal_style"] = personal_style
    profile.strategy_prefs_json = prefs

    db.commit()

    # 初始化勇气值
    _get_or_create_courage(db, user_id)

    logger.info("品牌入驻完成: user_id=%s industry=%s", user_id, industry)

    return {
        "user_id": user_id,
        "onboarding_complete": True,
        "disclaimer_confirmed": True,
        "strategy_summary": f"品牌入驻成功！已根据您的行业（{industry or '未指定'}）和风格偏好（{personal_style or '未指定'}）初始化品牌配置。",
    }


# ═══════════════════════════════════════════════
# 内容源授权
# ═══════════════════════════════════════════════

def authorize_content_sources(
    db: Session,
    user_id: str,
    sources: list[str],
    growth_only: bool = True,
    exclude_negative: bool = True,
    confirm_desensitize: bool = False,
) -> dict[str, Any]:
    """授权内容数据源访问。

    规则：
    - 默认仅调取成长型复盘素材
    - 负面内容绝对禁止
    - 情绪树洞的负面内容不可作为素材源
    """
    # 安全检查：情绪树洞数据默认排除负面内容
    if "emotion_diary" in sources and not confirm_desensitize:
        logger.info("Emotion diary source requested without desensitize confirmation, auto-limiting to growth-only")
        growth_only = True
        exclude_negative = True

    profile = _get_or_create_profile(db, user_id)

    profile.authorized_sources_json = {
        "sources": sources,
        "growth_only": growth_only,
        "exclude_negative": exclude_negative,
        "confirm_desensitize": confirm_desensitize,
        "authorized_at": datetime.now(timezone.utc).isoformat(),
    }
    db.commit()

    logger.info("内容源授权完成: user_id=%s sources=%s", user_id, sources)

    return {
        "authorized_sources": sources,
        "growth_only": growth_only,
        "exclude_negative": exclude_negative,
    }


# ═══════════════════════════════════════════════
# 朋友圈内容生成
# ═══════════════════════════════════════════════

def _validate_source_access(db: Session, user_id: str) -> list[str]:
    """验证用户内容源访问权限，返回可用的授权源列表。"""
    profile = db.query(BrandProfile).filter(
        BrandProfile.user_id == user_id,
        BrandProfile.deleted_at.is_(None),
    ).first()
    if not profile or not profile.authorized_sources_json:
        return []
    auth = profile.authorized_sources_json
    return auth.get("sources", [])


def _fetch_source_materials(
    db: Session,
    user_id: str,
    topic: str,
    time_slot: str,
    source_doc_ids: list[str] | None = None,
) -> tuple[list[str], list[str]]:
    """从授权源获取素材。

    Returns:
        (material_texts, source_labels): 素材文本列表和来源标签列表
    """
    from ...shared.models.knowledge import Document

    materials = []
    labels = []

    # 如果指定了源文档ID，直接查询
    if source_doc_ids:
        docs = db.query(Document).filter(
            Document.id.in_(source_doc_ids),
            Document.deleted_at.is_(None),
            # 仅调取非负面、已脱敏的文档
            Document.is_negative_blocked.is_(False),
            Document.is_desensitized.is_(True),
        ).limit(5).all()

        for doc in docs:
            if doc.content:
                text = doc.content.get("summary", "") or doc.title or ""
                # 安全检查
                try:
                    check_content_safety(text)
                except APIError:
                    continue
                materials.append(text)
                labels.append(doc.title or "知识库文档")
        return materials, labels

    # 自动从知识库匹配相关素材
    available_sources = _validate_source_access(db, user_id)
    if "knowledge_base" not in available_sources:
        return [], []

    # 按主题关键词搜索知识库
    slot_topic = SLOT_TOPICS.get(time_slot, "个人成长")
    search_topic = topic or slot_topic

    keywords = search_topic[:50]
    docs = db.query(Document).filter(
        Document.owner_user_id == user_id,
        Document.library_type == "private",
        Document.is_negative_blocked.is_(False),
        Document.is_desensitized.is_(True),
        Document.status == "published",
        Document.deleted_at.is_(None),
        Document.title.ilike(f"%{keywords}%"),
    ).limit(3).all()

    for doc in docs:
        if doc.content:
            text = doc.content.get("summary", "") or doc.title or ""
            try:
                check_content_safety(text)
            except APIError:
                continue
            materials.append(text)
            labels.append(doc.title or "知识库素材")

    return materials, labels


def generate_moment(
    db: Session,
    user_id: str,
    time_slot: str = "morning",
    topic_hint: str | None = None,
    include_image: bool = True,
    custom_style: str | None = None,
    source_doc_ids: list[str] | None = None,
) -> dict[str, Any]:
    """生成朋友圈文案（文案+智能配图）。

    四时段矩阵：
    - morning:  行业洞察（7:00-9:00）
    - noon:     成长故事（12:00-14:00）
    - evening:  专业分享（18:00-20:00）
    - bedtime:  复盘行动（21:00-23:00）
    - weekend:  生活感悟（周六日全天）

    关键规则：
    - 负面内容绝对禁止调取
    - 成长型复盘素材 only after 用户主动确认
    - 配合智能生图: 提示词=文风描述词
    """
    if time_slot not in MOMENT_TIME_SLOTS:
        raise APIError(E_PARAM_FORMAT.code, f"无效的时段: {time_slot}", 400)

    # 检查品牌配置状态
    profile = _get_or_create_profile(db, user_id)
    if not profile.disclaimer_confirmed:
        raise APIError(30040, "请先完成品牌入驻引导并确认免责声明", 400)

    if profile.status == "paused":
        raise APIError(20001, "自动生成已暂停，请恢复后再生成", 400)

    # 获取素材
    tone = custom_style or SLOT_TONES.get(time_slot, "professional")
    materials, source_labels = _fetch_source_materials(
        db, user_id, topic_hint or "", time_slot, source_doc_ids,
    )

    # 生成文案（MVP: 基于模板 + 素材组合；生产环境: 调用AI引擎）
    text, hashtags = _generate_moment_text(time_slot, tone, topic_hint, materials)

    # 安全检查
    check_content_safety(text)

    # 生成配图URL（MVP: 占位图；生产环境: AI生图引擎）
    image_urls = []
    if include_image:
        image_style = profile.strategy_prefs_json.get("image_style", "minimalist") if profile.strategy_prefs_json else "minimalist"
        image_urls = _generate_moment_images(time_slot, tone, image_style)

    # 创建内容记录
    content = BrandContent(
        user_id=user_id,
        content_type="moment",
        time_slot=time_slot,
        topic=topic_hint or SLOT_TOPICS.get(time_slot, ""),
        content_json={
            "text": text,
            "hashtags": hashtags,
            "tone": tone,
        },
        image_style=custom_style or "minimalist",
        image_urls_json=image_urls,
        status="draft",
        source_doc_ids_json=source_doc_ids or [],
        model_used="mock_mvp",
        generation_cost_tokens=0,
    )
    db.add(content)
    db.commit()
    db.refresh(content)

    logger.info("朋友圈内容已生成: content_id=%s time_slot=%s", content.id, time_slot)

    return {
        "content_id": content.id,
        "time_slot": time_slot,
        "text": text,
        "hashtags": hashtags,
        "image_urls": image_urls,
        "image_style": custom_style or "minimalist",
        "source_materials": source_labels,
        "status": "draft",
    }


def _generate_moment_text(
    time_slot: str,
    tone: str,
    topic_hint: str | None,
    materials: list[str],
) -> tuple[str, list[str]]:
    """生成朋友圈文案（MVP模板引擎；生产环境调用AI引擎 llm_generate）。"""
    topic = topic_hint or SLOT_TOPICS.get(time_slot, "个人成长")
    material_text = " ".join(materials[:2]) if materials else ""

    templates = {
        "morning": {
            "inspirational": f"早安☀️ 新的一天，从思考开始。\n\n今天想和大家聊聊「{topic}」这个话题。{material_text}\n\n每一次输出都是对专业的沉淀，每一次分享都是对认知的升级。\n\n愿你今天也有新的收获！",
            "professional": f"【晨间思考】\n\n关于「{topic}」，有些观察想与你分享：\n\n{material_text}\n\n数据和事实是最大的底气。共勉。",
        },
        "noon": {
            "casual": f"午间小憩～ 趁这个时间聊聊我最近的转型感受。\n\n关于「{topic}」：{material_text}\n\n这条路不容易，但每一步都算数。\n\n你也在经历职业转型吗？欢迎留言交流👋",
            "inspirational": f"午安～\n\n转型的路上，最大的敌人往往是自己。{material_text}\n\n「{topic}」这个方向让我看到了更多可能。\n\n不做井底之蛙，不断拓宽边界。",
        },
        "evening": {
            "professional": f"晚间分享 | {topic}\n\n今天解决了一个值得记录的问题：\n\n{material_text}\n\n专业能力就是在一次次实践中打磨出来的。\n\n你的专业领域最近有什么新发现？",
            "analytical": f"【深度分析】{topic}\n\n{material_text}\n\n数据不说谎，行动见真章。\n\n把每一次尝试都变成可复用的经验。",
        },
        "bedtime": {
            "inspirational": f"睡前复盘 🌙\n\n今天做了哪些有意义的事？\n{topic}\n\n{material_text}\n\n不求完美，但求进步。明天继续加油！\n\n晚安💤",
            "professional": f"【今日复盘】\n\n关键收获：{material_text}\n\n明天重点：继续推进「{topic}」\n\n日拱一卒，功不唐捐。",
        },
        "weekend": {
            "casual": f"周末愉快！☕️\n\n这周最大的感悟是关于「{topic}」：\n\n{material_text}\n\n工作不是全部，生活也需要经营。\n\n你周末有什么计划？",
            "inspirational": f"周末充电时间 🔋\n\n本周读了一本关于「{topic}」的好书：\n\n{material_text}\n\n学习永无止境，好奇心是最好的老师。",
        },
    }

    slot_templates = templates.get(time_slot, templates["morning"])
    text = slot_templates.get(tone, list(slot_templates.values())[0])

    # 如果没有素材，移除空的素材占位
    if not material_text:
        text = text.replace(f"：{material_text}", "。")
        text = text.replace(material_text, "")

    # 生成话题标签
    tag_map = {
        "morning": ["#早安", "#行业观察", "#每日思考"],
        "noon": ["#午间分享", "#转型故事", "#职业成长"],
        "evening": ["#晚间分享", "#专业干货", "#持续学习"],
        "bedtime": ["#睡前复盘", "#今日总结", "#日拱一卒"],
        "weekend": ["#周末愉快", "#生活感悟", "#终身学习"],
    }
    hashtags = tag_map.get(time_slot, ["#品牌打造", "#持续输出"])

    # 添加话题相关标签
    if topic_hint:
        clean_topic = topic_hint.replace(" ", "").replace("，", "").replace("。", "")
        if len(clean_topic) <= 10:
            hashtags.append(f"#{clean_topic}")

    return text, hashtags


def _generate_moment_images(time_slot: str, tone: str, image_style: str) -> list[str]:
    """生成配图URL（MVP: 占位图；生产环境: AI生图引擎）。

    提示词规则: 文风描述词 + 时段场景 + 风格
    """
    style_map = {
        "minimalist": "minimalist-clean",
        "professional": "business-professional",
        "warm": "warm-cozy",
        "tech": "tech-modern",
    }
    style_slug = style_map.get(image_style, "minimalist-clean")

    # MVP: 使用占位图服务
    slot_icon = {
        "morning": "sunrise",
        "noon": "coffee",
        "evenning": "laptop",
        "bedtime": "moon",
        "weekend": "nature",
    }.get(time_slot, "star")

    images = [
        f"https://images.unsplash.com/photo-{150000 + hash(time_slot + tone) % 900000}?w=800&h=600&fit=crop",
    ]

    return images


# ═══════════════════════════════════════════════
# 朋友圈确认/修改
# ═══════════════════════════════════════════════

def confirm_moment(
    db: Session,
    user_id: str,
    content_id: str,
    action: str,
    modifications: dict | None = None,
    regenerate_hint: str | None = None,
) -> dict[str, Any]:
    """确认/修改/拒绝朋友圈内容。

    - confirm: 确认内容，状态→confirmed
    - modify: 根据修改调整内容，状态→preview
    - reject: 拒绝内容，状态→draft（可重新生成）
    """
    content = db.query(BrandContent).filter(
        BrandContent.id == content_id,
        BrandContent.user_id == user_id,
        BrandContent.deleted_at.is_(None),
    ).first()
    if not content:
        raise APIError(60002, "品牌内容不存在", 404)

    if content.content_type != "moment":
        raise APIError(E_PARAM_FORMAT.code, "该内容不是朋友圈类型", 400)

    if action == "confirm":
        content.status = "confirmed"
        content.preview_confirmed_at = datetime.now(timezone.utc).isoformat()
        # 更新勇气值（发布频率+1）
        _update_courage_on_publish(db, user_id)

    elif action == "modify":
        if modifications:
            content_json = content.content_json or {}
            if "text" in modifications:
                content_json["text"] = modifications["text"]
            if "hashtags" in modifications:
                content_json["hashtags"] = modifications["hashtags"]
            if "image_style" in modifications:
                content.image_style = modifications["image_style"]
            content.content_json = content_json

        # 添加修改历史
        history = content.revision_history_json or []
        history.append({
            "action": "modify",
            "at": datetime.now(timezone.utc).isoformat(),
            "modifications": modifications,
            "regenerate_hint": regenerate_hint,
        })
        content.revision_history_json = history
        content.status = "preview"

    elif action == "reject":
        content.status = "draft"
        history = content.revision_history_json or []
        history.append({
            "action": "reject",
            "at": datetime.now(timezone.utc).isoformat(),
            "reason": regenerate_hint,
        })
        content.revision_history_json = history
    else:
        raise APIError(E_PARAM_FORMAT.code, f"无效的操作: {action}", 400)

    # 更新品牌配置的最后确认时间
    profile = _get_or_create_profile(db, user_id)
    profile.last_confirmed_at = datetime.now(timezone.utc).isoformat()
    profile.unconfirmed_days = 0
    db.commit()

    logger.info("朋友圈操作完成: content_id=%s action=%s", content_id, action)

    return {
        "content_id": content_id,
        "status": content.status,
        "action": action,
    }


def _update_courage_on_publish(db: Session, user_id: str):
    """发布内容时更新勇气值。"""
    courage = _get_or_create_courage(db, user_id)
    today_str = date.today().isoformat()

    # 更新连续发布
    if courage.last_publish_date == today_str:
        pass  # 当天已发布过
    else:
        last_date = courage.last_publish_date
        if last_date:
            try:
                last_dt = datetime.strptime(last_date, "%Y-%m-%d").date()
                if (date.today() - last_dt).days == 1:
                    courage.consecutive_no_publish_days = 0
                else:
                    courage.consecutive_no_publish_days = 0  # 重新开始计数
            except ValueError:
                courage.consecutive_no_publish_days = 0
        else:
            courage.consecutive_no_publish_days = 0

    courage.last_publish_date = today_str
    courage.publish_count_7d = min(courage.publish_count_7d + 1, 99)

    # 计算分项得分
    dims = courage.dimension_scores_json or {}
    dims["publish_frequency"] = min(250, dims.get("publish_frequency", 0) + 5)
    dims["consistency"] = min(250, dims.get("consistency", 0) + 2)
    courage.dimension_scores_json = dims

    # 重新计算总分
    courage.total_score = sum(dims.values())
    courage.total_score = min(1000, courage.total_score)

    # 检查里程碑
    _check_milestones(db, courage)

    db.commit()


def _check_milestones(db: Session, courage: BrandCourageValue):
    """检查并更新勇气值里程碑。"""
    milestones = courage.milestones_json or []
    existing_names = {m.get("name") for m in milestones}

    for ms in COURAGE_MILESTONES:
        if ms["name"] in existing_names:
            continue
        if courage.total_score >= ms["score_threshold"]:
            milestones.append({
                "name": ms["name"],
                "description": ms["description"],
                "score_threshold": ms["score_threshold"],
                "reached_at": datetime.now(timezone.utc).isoformat(),
                "score_bonus": ms["score_threshold"] // 10,
            })

    courage.milestones_json = milestones


# ═══════════════════════════════════════════════
# 公众号文章生成
# ═══════════════════════════════════════════════

def generate_article(
    db: Session,
    user_id: str,
    topic: str | None = None,
    outline: str | None = None,
    article_type: str = "knowledge_sharing",
    length: str = "medium",
    include_images: bool = True,
    source_doc_ids: list[str] | None = None,
    style_override: str | None = None,
) -> dict[str, Any]:
    """全流程生成公众号文章（选题→撰写→排版→预览）。

    流程：
    1. 选题：AI智能推荐 or 用户指定
    2. 撰写：生成大纲+正文+摘要
    3. 排版：段落优化+配图建议
    4. 预览：暂存为draft等待确认
    """
    profile = _get_or_create_profile(db, user_id)
    if not profile.disclaimer_confirmed:
        raise APIError(30040, "请先完成品牌入驻引导并确认免责声明", 400)

    if profile.status == "paused":
        raise APIError(20001, "自动生成已暂停，请恢复后再生成", 400)

    # 获取素材
    materials, source_labels = _fetch_source_materials(
        db, user_id, topic or "专业分享", "evening", source_doc_ids,
    )

    # 如果没有指定主题，AI智能推荐（MVP: 从用户策略偏好中提取）
    if not topic:
        prefs = profile.strategy_prefs_json or {}
        personal_style = prefs.get("personal_style", "professional")
        recommended_topics = {
            "professional": "数字化转型中HR的核心能力重构",
            "casual": "从打工人到自由职业者：我的转型之路",
            "inspirational": "为什么说持续输出是最好的学习方式",
            "analytical": "2026年HR行业趋势：数据驱动的六大变化",
        }
        topic = recommended_topics.get(personal_style, recommended_topics["professional"])

    # 生成文章内容
    title, body, summary, article_outline, keywords, resources = _generate_article_content(
        topic, article_type, length, materials, style_override,
    )

    # 安全检查（全文扫描）
    check_content_safety(title)
    check_content_safety(body)
    check_content_safety(summary)

    # 脱敏处理
    body = desensitize_content(body)

    # 估算阅读时间（中文约400字/分钟）
    char_count = len(body)
    estimated_read_time = max(3, char_count // 400)

    # 生成封面图和内嵌图
    cover_image_url = _generate_cover_image(topic, article_type)
    images = [cover_image_url] if include_images else []

    # 创建内容记录
    content = BrandContent(
        user_id=user_id,
        content_type="article",
        topic=topic,
        content_json={
            "title": title,
            "body": body,
            "outline": article_outline,
            "summary": summary,
            "article_type": article_type,
            "keywords": keywords,
            "resources": resources,
        },
        image_urls_json=images,
        status="draft",
        source_doc_ids_json=source_doc_ids or [],
        model_used="mock_mvp",
        generation_cost_tokens=0,
    )
    db.add(content)
    db.commit()
    db.refresh(content)

    logger.info("公众号文章已生成: content_id=%s topic=%s", content.id, topic)

    return {
        "content_id": content.id,
        "topic": topic,
        "title": title,
        "outline": article_outline,
        "body": body,
        "summary": summary,
        "cover_image_url": cover_image_url,
        "images": images,
        "resources": [{"label": r["label"], "url": r["url"], "type": r["type"]} for r in resources],
        "seo_keywords": keywords,
        "estimated_read_time": estimated_read_time,
        "status": "draft",
        "source_materials": source_labels,
    }


def _generate_article_content(
    topic: str,
    article_type: str,
    length: str,
    materials: list[str],
    style_override: str | None = None,
) -> tuple[str, str, str, list[str], list[str], list[dict]]:
    """生成公众号文章内容（MVP模板引擎；生产环境调用AI引擎）。"""
    material_text = " ".join(materials[:3]) if materials else ""

    # 文章长度控制
    para_count = {"short": 3, "medium": 5, "long": 8}.get(length, 5)

    # 文章标题模板
    title_templates = {
        "knowledge_sharing": f"{topic}：从理论到实践的完整指南",
        "case_study": f"深度复盘 | {topic}的真实案例与启示",
        "opinion_piece": f"关于「{topic}」，我想说点不一样的",
        "story": f"我的转型故事：{topic}",
    }
    title = title_templates.get(article_type, title_templates["knowledge_sharing"])

    # 大纲生成
    outline = [
        f"一、引言：为什么「{topic}」值得关注",
        f"二、核心观点：{topic}的本质是什么",
        "三、实践路径：如何落地执行",
        "四、常见误区与避坑指南",
        "五、总结与展望",
    ]

    # 正文生成
    body_parts = [
        f"# {title}\n\n",
        f"## 引言\n\n在当今快速变化的商业环境中，「{topic}」已成为HR从业者不可回避的重要课题。{material_text}\n\n",
        f"## 核心观点\n\n深入分析「{topic}」的本质，我们发现它不仅仅是工具或方法的堆砌，而是一种系统性思维的重构。\n\n",
        f"## 实践路径\n\n### 第一步：认知升级\n\n改变始于认知。要真正掌握「{topic}」，首先需要打破固有思维框架，建立全新的认知地图。\n\n",
        f"### 第二步：小步快跑\n\n选择最小可行场景进行试点，在实践中迭代优化。记住：Done is better than perfect.\n\n",
        f"### 第三步：系统固化\n\n将验证有效的做法固化为标准流程，形成可复制的方法论。{material_text}\n\n",
        f"## 常见误区\n\n1. **急功近利**：渴望一夜之间看到显著变化，忽视了积累的力量\n2. **照搬照抄**：盲目套用他人经验，不考虑自身实际情况\n3. **重术轻道**：沉迷于工具和技巧，忽略了底层思维的升级\n\n",
        f"## 总结\n\n「{topic}」不是一蹴而就的工程，而是一场持续的修行。每一次输出都是对认知的固化，每一次分享都是对影响力的积累。\n\n",
        f"---\n*本文由日耕品牌打造中心AI辅助生成，经人工审核后发布。*\n",
    ]
    body = "".join(body_parts)

    # 摘要
    summary = f"本文围绕「{topic}」展开深度分析，从认知升级到实践落地，为HR从业者提供了一套系统性的思考框架和行动指南。"

    # SEO关键词
    keywords = [topic, "HR转型", "职业发展", "个人品牌", "持续学习", "知识管理"]

    # 资源链接
    resources = [
        {"label": "延伸阅读：职场人的终身学习路径", "url": "#", "type": "link"},
        {"label": "相关工具模板下载", "url": "#", "type": "file"},
    ]

    return title, body, summary, outline, keywords, resources


def _generate_cover_image(topic: str, article_type: str) -> str:
    """生成封面图URL（MVP: 占位图；生产环境: AI封面生成器）。"""
    return f"https://images.unsplash.com/photo-{150000 + hash(topic) % 900000}?w=1200&h=630&fit=crop"


# ═══════════════════════════════════════════════
# 文章预览确认
# ═══════════════════════════════════════════════

def preview_confirm_article(
    db: Session,
    user_id: str,
    content_id: str,
    action: str,
    modifications: dict | None = None,
    regenerate_hint: str | None = None,
) -> dict[str, Any]:
    """公众号文章预览确认/修改。

    - confirm: 确认发布，状态→confirmed
    - modify: 修改后重新预览，状态→preview
    - reject: 退回草稿
    """
    content = db.query(BrandContent).filter(
        BrandContent.id == content_id,
        BrandContent.user_id == user_id,
        BrandContent.deleted_at.is_(None),
    ).first()
    if not content:
        raise APIError(60002, "品牌内容不存在", 404)

    if content.content_type != "article":
        raise APIError(E_PARAM_FORMAT.code, "该内容不是公众号文章类型", 400)

    if action == "confirm":
        content.status = "confirmed"
        content.preview_confirmed_at = datetime.now(timezone.utc).isoformat()
        content.published_at = datetime.now(timezone.utc).isoformat()

        # 更新勇气值
        _update_courage_on_publish(db, user_id)

        # 初始化分析数据
        analytics = BrandAnalytics(
            user_id=user_id,
            content_id=content_id,
            content_type="article",
            stat_date=date.today().isoformat(),
        )
        db.add(analytics)

    elif action == "modify":
        if modifications:
            content_json = content.content_json or {}
            if "title" in modifications:
                content_json["title"] = modifications["title"]
            if "body" in modifications:
                # 安全检查修改后的内容
                check_content_safety(modifications["body"])
                content_json["body"] = modifications["body"]
            if "outline" in modifications:
                content_json["outline"] = modifications["outline"]
            if "summary" in modifications:
                content_json["summary"] = modifications["summary"]
            if "cover_image_url" in modifications:
                content.image_urls_json = [modifications["cover_image_url"]]
            content.content_json = content_json

        history = content.revision_history_json or []
        history.append({
            "action": "modify",
            "at": datetime.now(timezone.utc).isoformat(),
            "modifications": modifications,
            "regenerate_hint": regenerate_hint,
        })
        content.revision_history_json = history
        content.status = "preview"

    elif action == "reject":
        content.status = "draft"
        history = content.revision_history_json or []
        history.append({
            "action": "reject",
            "at": datetime.now(timezone.utc).isoformat(),
            "reason": regenerate_hint,
        })
        content.revision_history_json = history
    else:
        raise APIError(E_PARAM_FORMAT.code, f"无效的操作: {action}", 400)

    # 更新确认时间
    profile = _get_or_create_profile(db, user_id)
    profile.last_confirmed_at = datetime.now(timezone.utc).isoformat()
    profile.unconfirmed_days = 0
    db.commit()

    logger.info("文章操作完成: content_id=%s action=%s", content_id, action)

    return {
        "content_id": content_id,
        "status": content.status,
        "action": action,
    }


# ═══════════════════════════════════════════════
# 暂停/恢复自动生成
# ═══════════════════════════════════════════════

def pause_auto_generation(db: Session, user_id: str) -> dict[str, Any]:
    """暂停自动生成（连续3天未确认→自动暂停，也可手动暂停）。"""
    profile = _get_or_create_profile(db, user_id)
    if profile.status == "paused":
        return {"user_id": user_id, "status": "paused", "message": "自动生成已处于暂停状态"}

    profile.status = "paused"
    db.commit()

    logger.info("自动生成已暂停: user_id=%s", user_id)

    return {
        "user_id": user_id,
        "status": "paused",
        "message": "自动生成已暂停。恢复后可继续使用品牌打造功能。",
    }


def resume_generation(db: Session, user_id: str) -> dict[str, Any]:
    """恢复自动生成。"""
    profile = _get_or_create_profile(db, user_id)
    if profile.status == "active":
        return {"user_id": user_id, "status": "active", "message": "自动生成已处于运行状态"}

    profile.status = "active"
    profile.unconfirmed_days = 0
    db.commit()

    logger.info("自动生成已恢复: user_id=%s", user_id)

    return {
        "user_id": user_id,
        "status": "active",
        "message": "自动生成已恢复。系统将按照您的策略配置自动生成品牌内容。",
    }


# ═══════════════════════════════════════════════
# 品牌数据分析看板
# ═══════════════════════════════════════════════

def get_brand_analytics(
    db: Session,
    user_id: str,
    days: int = 30,
    content_type: str | None = None,
) -> dict[str, Any]:
    """获取品牌数据分析看板。

    指标:
    - 传播指标: 阅读/点赞/转发/评论
    - 转化指标: 咨询触发率/线索生成数
    - 时段效果: 哪个时段发布效果最好
    - 内容排行: Top N 表现最好的内容
    """
    # 时间范围
    end_date = date.today()
    start_date = end_date - timedelta(days=days)
    start_str = start_date.isoformat()

    # 查询分析数据
    query = db.query(BrandAnalytics).filter(
        BrandAnalytics.user_id == user_id,
        BrandAnalytics.deleted_at.is_(None),
        BrandAnalytics.stat_date >= start_str,
    )
    if content_type:
        query = query.filter(BrandAnalytics.content_type == content_type)

    analytics_records = query.all()

    # 聚合指标
    total_views = sum(a.views or 0 for a in analytics_records)
    total_likes = sum(a.likes or 0 for a in analytics_records)
    total_shares = sum(a.shares or 0 for a in analytics_records)
    total_comments = sum(a.comments or 0 for a in analytics_records)
    total_leads = sum(1 for a in analytics_records if a.lead_generated)

    # 统计已发布内容数
    total_published = db.query(BrandContent).filter(
        BrandContent.user_id == user_id,
        BrandContent.status == "confirmed",
        BrandContent.deleted_at.is_(None),
    ).count()

    # 互动率 = (点赞+评论+转发) / 阅读
    engagement_rate = round(
        (total_likes + total_comments + total_shares) / max(total_views, 1) * 100, 1
    )
    # 线索转化率
    lead_conversion_rate = round(
        total_leads / max(total_published, 1) * 100, 1
    )

    # 每日趋势
    daily_map: dict[str, dict] = {}
    for a in analytics_records:
        day = a.stat_date or ""
        if day not in daily_map:
            daily_map[day] = {"date": day, "views": 0, "likes": 0, "shares": 0, "comments": 0}
        daily_map[day]["views"] += a.views or 0
        daily_map[day]["likes"] += a.likes or 0
        daily_map[day]["shares"] += a.shares or 0
        daily_map[day]["comments"] += a.comments or 0

    daily_trends = sorted(daily_map.values(), key=lambda x: x["date"])[-30:]

    # 内容排行（查询已确认的内容及其分析数据）
    top_contents = (
        db.query(BrandContent, BrandAnalytics)
        .outerjoin(BrandAnalytics, BrandContent.id == BrandAnalytics.content_id)
        .filter(
            BrandContent.user_id == user_id,
            BrandContent.status == "confirmed",
            BrandContent.deleted_at.is_(None),
        )
        .order_by(desc(BrandAnalytics.views))
        .limit(10)
        .all()
    )

    top_content_list = []
    for content, analytics in top_contents:
        content_json = content.content_json or {}
        top_content_list.append({
            "content_id": content.id,
            "title": content_json.get("title", content.topic or "未命名"),
            "type": content.content_type,
            "views": analytics.views if analytics else 0,
            "likes": analytics.likes if analytics else 0,
            "shares": analytics.shares if analytics else 0,
            "status": content.status,
        })

    # 时段效果分析（按time_slot聚合）
    time_slot_query = db.query(BrandContent).filter(
        BrandContent.user_id == user_id,
        BrandContent.content_type == "moment",
        BrandContent.status == "confirmed",
        BrandContent.deleted_at.is_(None),
    )
    slot_contents = time_slot_query.all()

    time_slot_performance: dict[str, dict] = {}
    for sc in slot_contents:
        slot = sc.time_slot or "unknown"
        if slot not in time_slot_performance:
            time_slot_performance[slot] = {"count": 0, "total_views": 0, "total_likes": 0}
        time_slot_performance[slot]["count"] += 1

    return {
        "total_published": total_published,
        "total_views": total_views,
        "total_likes": total_likes,
        "total_shares": total_shares,
        "total_comments": total_comments,
        "total_leads": total_leads,
        "engagement_rate": engagement_rate,
        "lead_conversion_rate": lead_conversion_rate,
        "daily_trends": daily_trends,
        "top_content": top_content_list,
        "time_slot_performance": time_slot_performance,
    }


# ═══════════════════════════════════════════════
# 咨询线索标记
# ═══════════════════════════════════════════════

def mark_as_lead(
    db: Session,
    user_id: str,
    source_content_id: str | None = None,
    lead_type: str = "consultation_inquiry",
    source_description: str | None = None,
    contact_name: str | None = None,
    contact_info: str | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    """用户手动标记咨询线索。

    流程：
    1. 创建线索记录（状态=marked）
    2. 关联来源内容
    3. 更新分析数据中的lead_generated标志
    4. 后续流转至拿下一个客户模块
    """
    if lead_type not in LEAD_TYPES:
        raise APIError(E_PARAM_FORMAT.code, f"无效的线索类型: {lead_type}", 400)

    # 如果指定了来源内容，验证内容存在且属于该用户
    if source_content_id:
        content = db.query(BrandContent).filter(
            BrandContent.id == source_content_id,
            BrandContent.user_id == user_id,
            BrandContent.deleted_at.is_(None),
        ).first()
        if not content:
            raise APIError(60002, "来源内容不存在", 404)

    # 创建线索
    lead = BrandLead(
        user_id=user_id,
        source_content_id=source_content_id,
        lead_type=lead_type,
        source_description=source_description,
        contact_name=contact_name,
        contact_info=contact_info,
        notes=notes,
        status="marked",
    )
    db.add(lead)

    # 更新分析数据中的线索标志
    if source_content_id:
        analytics = db.query(BrandAnalytics).filter(
            BrandAnalytics.content_id == source_content_id,
            BrandAnalytics.user_id == user_id,
        ).first()
        if analytics:
            analytics.consultation_triggered = True
            analytics.lead_generated = True

    # 更新勇气值（线索转化维度）
    courage = _get_or_create_courage(db, user_id)
    dims = courage.dimension_scores_json or {}
    dims["conversion_rate"] = min(250, dims.get("conversion_rate", 0) + 10)
    courage.dimension_scores_json = dims
    courage.total_score = min(1000, sum(dims.values()))
    _check_milestones(db, courage)

    db.commit()
    db.refresh(lead)

    logger.info("咨询线索已标记: lead_id=%s type=%s", lead.id, lead_type)

    return {
        "lead_id": lead.id,
        "status": lead.status,
        "created_at": lead.created_at.isoformat() if lead.created_at else "",
    }


# ═══════════════════════════════════════════════
# 勇气值查询与干预
# ═══════════════════════════════════════════════

def get_courage_value(db: Session, user_id: str) -> dict[str, Any]:
    """获取当前勇气值+里程碑+趋势数据。"""
    courage = _get_or_create_courage(db, user_id)

    # 确定等级
    level = "初级转型者"
    for cl in COURAGE_LEVELS:
        if cl["min"] <= courage.total_score <= cl["max"]:
            level = cl["level"]
            break

    # 组装里程碑响应
    milestones_resp = []
    for ms in COURAGE_MILESTONES:
        reached = any(
            m.get("name") == ms["name"]
            for m in (courage.milestones_json or [])
        )
        reached_at = None
        if reached:
            for m in (courage.milestones_json or []):
                if m.get("name") == ms["name"]:
                    reached_at = m.get("reached_at")
                    break
        milestones_resp.append({
            "name": ms["name"],
            "description": ms["description"],
            "score_threshold": ms["score_threshold"],
            "reached": reached,
            "reached_at": reached_at,
        })

    # 最近7天分数趋势（MVP: 模拟递增趋势）
    recent_trend = [max(0, courage.total_score - (6 - i) * 3) for i in range(7)]
    recent_trend[-1] = courage.total_score

    # 检查是否需要关怀干预
    care_message = check_courage_intervention(db, user_id)

    return {
        "total_score": courage.total_score,
        "level": level,
        "dimension_scores": courage.dimension_scores_json or {},
        "milestones": milestones_resp,
        "recent_trend": recent_trend,
        "publish_count_7d": courage.publish_count_7d or 0,
        "consecutive_no_publish_days": courage.consecutive_no_publish_days or 0,
        "consecutive_interview_fails": courage.consecutive_interview_fails or 0,
        "care_message": care_message,
    }


def check_courage_intervention(db: Session, user_id: str) -> str | None:
    """检查是否需要触发勇气值关怀干预。

    触发条件：
    - 连续7天未发布任何品牌内容 → 触发鼓励关怀
    - 连续2次面谈失败 → 触发勇气重建关怀
    - 距上次触发不足3天 → 不重复触发

    Returns:
        关怀消息文本，如果不需要则返回None
    """
    courage = _get_or_create_courage(db, user_id)

    now = datetime.now(timezone.utc)

    # 距上次触发不足3天不重复
    if courage.last_care_triggered_at:
        try:
            last_triggered = datetime.fromisoformat(courage.last_care_triggered_at)
            if (now - last_triggered).days < 3:
                return None
        except ValueError:
            pass

    care_message = None

    # 条件1: 连续7天未发布
    if courage.consecutive_no_publish_days >= 7:
        care_message = (
            "🌟 你已经有一周没有发布品牌内容了。\n\n"
            "还记得当初决定转型时的那份勇气吗？每一次输出都是在为自己积累影响力。\n\n"
            "不用追求完美，哪怕是一个小小的思考碎片，也值得被记录和分享。\n"
            "今天就尝试发布一条朋友圈吧，我们一直在你身边。"
        )

    # 条件2: 连续2次面谈失败
    elif courage.consecutive_interview_fails >= 2:
        care_message = (
            "💪 最近的两次面谈结果可能不太理想，但这不代表你的价值。\n\n"
            "每一次面谈都是一次学习机会，你在积累宝贵的经验。\n"
            "建议回顾一下品牌内容中的反馈，找到可以优化的地方。\n"
            "勇气不是没有恐惧，而是带着恐惧继续前行。"
        )

    if care_message:
        # 记录干预
        interventions = courage.interventions_json or []
        interventions.append({
            "type": "courage_care",
            "triggered_at": now.isoformat(),
            "message": care_message,
            "acknowledged": False,
        })
        courage.interventions_json = interventions
        courage.last_care_triggered_at = now.isoformat()
        db.commit()

    return care_message


# ═══════════════════════════════════════════════
# 自动维护任务（供外部定时器/调度器调用）
# ═══════════════════════════════════════════════

def check_auto_pause_conditions(db: Session) -> int:
    """检查所有活跃品牌配置的自动暂停条件。

    连续3天未确认→自动暂停。供外部定时任务调用。

    Returns:
        被暂停的用户数量
    """
    profiles = db.query(BrandProfile).filter(
        BrandProfile.status == "active",
        BrandProfile.deleted_at.is_(None),
    ).all()

    paused_count = 0
    now = datetime.now(timezone.utc)

    for profile in profiles:
        if profile.last_confirmed_at:
            try:
                last_confirmed = datetime.fromisoformat(profile.last_confirmed_at)
                days_since = (now - last_confirmed).days
                if days_since >= 3:
                    profile.status = "paused"
                    profile.unconfirmed_days = days_since
                    paused_count += 1
                    logger.info("自动暂停品牌生成: user_id=%s days_since=%d", profile.user_id, days_since)
            except ValueError:
                pass

    if paused_count > 0:
        db.commit()

    return paused_count


def update_consecutive_no_publish(db: Session):
    """更新所有用户的连续未发布天数（供每日定时任务调用）。"""
    courages = db.query(BrandCourageValue).filter(
        BrandCourageValue.deleted_at.is_(None),
    ).all()

    today = date.today().isoformat()

    for courage in courages:
        if courage.last_publish_date and courage.last_publish_date != today:
            try:
                last_date = datetime.strptime(courage.last_publish_date, "%Y-%m-%d").date()
                days_gap = (date.today() - last_date).days
                if days_gap > 1:
                    courage.consecutive_no_publish_days = days_gap
            except ValueError:
                pass

    db.commit()
