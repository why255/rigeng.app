"""品牌打造中心服务 — 路由层（步骤21 / Wave 4）。

API 端点：
  POST   /brand/onboarding           — 品牌入驻引导 + 免责声明
  POST   /brand/sources/authorize     — 授权内容数据源
  POST   /brand/moments/generate      — 生成朋友圈内容
  POST   /brand/moments/confirm       — 确认/修改朋友圈
  POST   /brand/articles/generate     — 生成公众号文章
  POST   /brand/articles/confirm      — 确认文章
  GET    /brand/analytics             — 品牌数据分析看板
  POST   /brand/leads/mark            — 标记咨询线索
  GET    /brand/courage               — 查询勇气值
  POST   /brand/pause                 — 暂停自动生成
  POST   /brand/resume                — 恢复自动生成
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ...shared.database import get_db
from ...shared.response import ok
from ...shared.security import CurrentUser, get_current_user
from . import service
from .schemas import (
    ArticleConfirmRequest,
    ArticleGenerateRequest,
    BrandOnboardingRequest,
    ContentSourceAuth,
    ContentStrategyRequest,
    LeadMarkRequest,
    MomentConfirmRequest,
    MomentGenerateRequest,
)

router = APIRouter(tags=["品牌打造"], prefix="/brand")


# ═══════════════════════════════════════════════
# 品牌入驻引导
# ═══════════════════════════════════════════════

@router.post("/onboarding")
def onboarding(
    body: BrandOnboardingRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """品牌首次对话引导 + 免责声明确认。

    首次访问时弹窗展示免责声明，用户确认后初始化品牌配置。
    包含：行业选择、目标受众、个人风格偏好。
    """
    return ok(service.start_brand_onboarding(
        db,
        user.user_id,
        accept_disclaimer=body.accept_disclaimer,
        industry=body.industry,
        target_audience=body.target_audience,
        personal_style=body.personal_style,
    ))


# ═══════════════════════════════════════════════
# 内容源授权
# ═══════════════════════════════════════════════

@router.post("/sources/authorize")
def authorize_sources(
    body: ContentSourceAuth,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """授权品牌打造中心访问私有知识库等数据源。

    默认仅调取成长型复盘素材，负面内容绝对禁止。
    情绪树洞数据仅在用户主动确认脱敏后可调取。
    """
    return ok(service.authorize_content_sources(
        db,
        user.user_id,
        sources=body.sources,
        growth_only=body.growth_only,
        exclude_negative=body.exclude_negative,
        confirm_desensitize=body.confirm_desensitize,
    ))


# ═══════════════════════════════════════════════
# 朋友圈内容
# ═══════════════════════════════════════════════

@router.post("/moments/generate")
def generate_moment(
    body: MomentGenerateRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """生成朋友圈内容（文案+智能配图）。

    四时段矩阵：早(morning)/中(noon)/晚(evening)/睡前(bedtime)/周末(weekend)。
    每个时段有对应的默认主题和文风，支持自定义覆盖。
    成长型复盘素材 only after 用户主动确认。
    """
    return ok(service.generate_moment(
        db,
        user.user_id,
        time_slot=body.time_slot,
        topic_hint=body.topic_hint,
        include_image=body.include_image,
        custom_style=body.custom_style,
        source_doc_ids=body.source_doc_ids or None,
    ))


@router.post("/moments/confirm")
def confirm_moment(
    body: MomentConfirmRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """确认/修改/拒绝朋友圈内容。

    - confirm: 确认内容发布
    - modify: 修改后重新预览
    - reject: 退回草稿状态
    确认后会更新勇气值（发布频率+1）。
    """
    return ok(service.confirm_moment(
        db,
        user.user_id,
        content_id=body.content_id,
        action=body.action,
        modifications=body.modifications,
        regenerate_hint=body.regenerate_hint,
    ))


# ═══════════════════════════════════════════════
# 公众号文章
# ═══════════════════════════════════════════════

@router.post("/articles/generate")
def generate_article(
    body: ArticleGenerateRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """全流程生成公众号文章（选题→撰写→排版→预览）。

    如果未指定选题，AI将根据用户策略偏好智能推荐。
    生成内容包括：标题、大纲、正文、摘要、封面图、SEO关键词、相关资源。
    发布前会进行内容安全检查和自动脱敏。
    """
    return ok(service.generate_article(
        db,
        user.user_id,
        topic=body.topic,
        outline=body.outline,
        article_type=body.article_type,
        length=body.length,
        include_images=body.include_images,
        source_doc_ids=body.source_doc_ids or None,
        style_override=body.style_override,
    ))


@router.post("/articles/confirm")
def confirm_article(
    body: ArticleConfirmRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """确认/修改/退回公众号文章。

    - confirm: 确认发布，自动初始化分析数据
    - modify: 修改后重新生成预览
    - reject: 退回草稿状态
    """
    return ok(service.preview_confirm_article(
        db,
        user.user_id,
        content_id=body.content_id,
        action=body.action,
        modifications=body.modifications,
        regenerate_hint=body.regenerate_hint,
    ))


# ═══════════════════════════════════════════════
# 品牌数据分析
# ═══════════════════════════════════════════════

@router.get("/analytics")
def get_analytics(
    days: int = Query(default=30, le=365, description="统计天数范围"),
    content_type: str | None = Query(None, pattern="^(moment|article)$", description="内容类型筛选"),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取品牌数据分析看板。

    包含：传播指标（阅读/点赞/转发/评论）、转化指标（咨询触发/线索生成）、
    时段效果分析、内容排行。支持按时间范围和内容类型筛选。
    """
    return ok(service.get_brand_analytics(
        db,
        user.user_id,
        days=days,
        content_type=content_type,
    ))


# ═══════════════════════════════════════════════
# 咨询线索
# ═══════════════════════════════════════════════

@router.post("/leads/mark")
def mark_lead(
    body: LeadMarkRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """标记咨询线索。

    用户手动标记来自品牌内容的咨询线索，系统记录后：
    1. 关联来源内容 → 更新分析数据
    2. 加分勇气值（转化维度+10）
    3. 后续流转至"拿下一个客户"模块
    """
    return ok(service.mark_as_lead(
        db,
        user.user_id,
        source_content_id=body.source_content_id,
        lead_type=body.lead_type,
        source_description=body.source_description,
        contact_name=body.contact_name,
        contact_info=body.contact_info,
        notes=body.notes,
    ))


# ═══════════════════════════════════════════════
# 勇气值
# ═══════════════════════════════════════════════

@router.get("/courage")
def get_courage(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """查询转型勇气值。

    返回：总分、等级、各维度得分、里程碑达成情况、
    近7天趋势、以及可能的关怀干预消息。
    触发条件：连续7天未发布或2次面谈失败。
    """
    return ok(service.get_courage_value(db, user.user_id))


# ═══════════════════════════════════════════════
# 暂停/恢复
# ═══════════════════════════════════════════════

@router.post("/pause")
def pause(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """暂停自动生成。

    手动暂停品牌内容的自动生成。连续3天未确认内容也会自动触发暂停。
    """
    return ok(service.pause_auto_generation(db, user.user_id))


@router.post("/resume")
def resume(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """恢复自动生成。

    从暂停状态恢复品牌内容自动生成，重置未确认天数计数器。
    """
    return ok(service.resume_generation(db, user.user_id))
