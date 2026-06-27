"""拿下一个客户服务 — 核心业务逻辑（步骤22 / Wave 4）。

六步签约流程：
  智能转型触发 → 用户自我诊断 → 客户情报采集（老师后台） → 面谈准备 → 客户面谈 → 面谈复盘 → 签约

Plus: 角色转换模拟训练（三重角色 + A/B双维度评分）

设计原则：
  - 企业情报不可跳过直接面谈（即使朋友推荐客户，也必须 intel→strategy→meeting）
  - 仅基于公开信息（招聘网站/官网/公众号/天眼查/看准网/脉脉）
  - A+B评分：A维度关键词命中率 + B维度四维评分（完整性/逻辑性/深度/针对性）
  - 80分合格线（后台可配置）
  - 首次使用合规提示弹窗率100%
  - 平台不参与资金流转/合同签署
"""
from __future__ import annotations

import json
import logging
import random
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, desc
from sqlalchemy.orm import Session

from ...shared.config import settings
from ...shared.database import new_uuid, utcnow
from ...shared.errors import APIError, E_FILE_NOT_FOUND, E_PARAM_FORMAT, E_PARAM_MISSING
from ...shared.models.acquire_client import (
    DIAGNOSIS_STATUSES, INTEL_STATUSES, MEETING_STATUSES,
    MEETING_STRATEGY_STATUSES, NEGOTIATION_STATUSES, ROLEPLAY_ROLES, ROLEPLAY_SCENARIOS,
    ClientContract, ClientMeeting, CompanyIntel, ComplianceReminder, MeetingStrategy,
    NegotiationRound, RoleplaySession, SelfDiagnosis, TransitionSignal,
)

logger = logging.getLogger("acquire_client")

# ── 可配置参数 ──
DEFAULT_PASS_THRESHOLD = 80.0  # 角色扮演合格线
SCORE_A_WEIGHT = 0.3  # A维度权重
SCORE_B_WEIGHT = 0.7  # B维度权重

# ── 转型信号关键词库 ──
TRANSITION_KEYWORDS = {
    "意向咨询": ["想了解", "咨询一下", "有没有", "能帮我", "怎么收费", "服务内容"],
    "岗位需求": ["招人", "招聘", "HR", "人事", "人力资源", "岗位", "入职"],
    "薪资讨论": ["薪资", "薪酬", "工资", "待遇", "福利", "offer"],
    "培训需求": ["培训", "培养", "提升", "学习", "成长", "发展"],
    "制度需求": ["制度", "流程", "规范", "体系", "标准化"],
    "转型意向": ["转型", "换工作", "跳槽", "新机会", "猎头"],
    "场景意图": ["客户", "合作", "签约", "客户拜访", "商务", "谈判"],
}

# ── 引导面试问题库 ──
DIAGNOSIS_INTERVIEW_QUESTIONS = [
    {
        "question_id": "q1",
        "question": "你目前主要负责哪些人力资源模块的工作？请描述你的典型工作日。",
        "category": "经验背景",
        "hint": "请尽量具体描述，包括你的团队规模、汇报关系、使用的工具等。",
    },
    {
        "question_id": "q2",
        "question": "你觉得自己在HR领域最擅长的三个方面是什么？请各举一个具体案例。",
        "category": "能力评估",
        "hint": "用STAR法则（情境→任务→行动→结果）来描述会更有说服力。",
    },
    {
        "question_id": "q3",
        "question": "你未来1-3年的职业目标是什么？你希望「拿下一个客户」帮你在哪个环节突破？",
        "category": "职业规划",
        "hint": "可以具体到你想主攻的客户类型、行业、预算范围等。",
    },
    {
        "question_id": "q4",
        "question": "在与客户沟通过程中，你遇到过哪些典型的困难或卡点？",
        "category": "能力评估",
        "hint": "比如：不敢报价、难以建立信任、无法突破关键决策人等。",
    },
    {
        "question_id": "q5",
        "question": "你希望服务的理想客户画像是什么样的？为什么？",
        "category": "目标期望",
        "hint": "考虑行业、规模、预算、决策链、痛点等因素。",
    },
]

# ── 合规提示文案 ──
COMPLIANCE_REMINDER_TEXT = (
    "【合规提示】\n\n"
    "「拿下一个客户」模块旨在提供AI辅助的客户获取策略和模拟训练，"
    "不代替您的专业判断。请注意：\n\n"
    "1. 客户情报仅基于公开信息（招聘网站、官网、公众号、天眼查、看准网、脉脉等），"
    "不涉及任何非公开商业机密或个人隐私。\n"
    "2. 本平台不参与任何资金流转和合同签署，所有签约行为由用户自行完成。\n"
    "3. AI生成的策略和建议仅供参考，最终业务决策由您自行负责。\n"
    "4. 遵守所在国家/地区的商业合规要求和数据保护法规。\n\n"
    "点击「确认」表示您已阅读并同意以上提示。"
)


# ═══════════════════════════════════════════════
# 1. 智能转型触发
# ═══════════════════════════════════════════════

def _scan_transition_signals(context_text: str) -> list[dict[str, Any]]:
    """扫描对话文本中的转型信号。"""
    signals = []
    context_lower = context_text.lower()

    for signal_type, keywords in TRANSITION_KEYWORDS.items():
        matched = [kw for kw in keywords if kw.lower() in context_lower]
        if matched:
            confidence = min(0.5 + len(matched) * 0.1, 1.0)
            signals.append({
                "signal_type": signal_type,
                "confidence": confidence,
                "matched_keywords": matched,
            })

    # 按置信度排序
    signals.sort(key=lambda s: s["confidence"], reverse=True)
    return signals


def _generate_guidance(signal_type: str) -> tuple[str, str]:
    """根据信号类型生成温和引导文案和推荐流程。"""
    guidance_map = {
        "场景意图": (
            "我注意到您最近对客户拓展比较关注。要不要试试「拿下一个客户」的签约辅助功能？"
            "我可以帮您从自我诊断开始，梳理您的优势和目标客户画像。",
            "diagnosis",
        ),
        "转型意向": (
            "看起来您正在考虑职业方向的变化。我们的「拿下一个客户」模块可以先帮您做一次自我诊断，"
            "看看您目前的客户获取能力画像，然后再制定针对性的提升策略。",
            "diagnosis",
        ),
        "岗位需求": (
            "您提到的岗位需求，我们的「拿下一个客户」模块可以帮您做客户公司的情报分析，"
            "了解目标客户的真实需求后再制定面谈策略。",
            "intel",
        ),
        "培训需求": (
            "技能提升方面，我们的角色扮演模拟训练可以帮您在不同场景下练习客户沟通，"
            "小耕可以扮演客户、专家或老师三种角色辅助您。",
            "roleplay",
        ),
        "制度需求": (
            "制度优化也是客户签约的重要支撑。要不要先做一次自我诊断，"
            "看看您目前的客户服务流程有哪些可以优化的地方？",
            "diagnosis",
        ),
    }
    return guidance_map.get(signal_type, (
        "我注意到您的对话中有些线索，可能和客户获取有关。需要我帮忙梳理一下吗？",
        "diagnosis",
    ))


def detect_transition_signal(db: Session, user_id: str, context_text: str,
                             conversation_id: str | None = None) -> dict[str, Any]:
    """扫描日常对话中的转型信号，温和引导用户进入签约流程。"""
    signals = _scan_transition_signals(context_text)

    if not signals:
        # 记录无信号
        signal = TransitionSignal(
            user_id=user_id,
            context_text=context_text,
            signal_type=None,
            confidence=0.0,
            action_taken="none",
            conversation_id=conversation_id,
        )
        db.add(signal)
        db.commit()

        return {
            "detected": False,
            "signal_type": None,
            "confidence": 0.0,
            "suggestion": None,
            "guided_flow": None,
        }

    # 取置信度最高的信号
    top_signal = signals[0]
    signal_type = top_signal["signal_type"]
    suggestion, guided_flow = _generate_guidance(signal_type)

    # 记录触发信号
    signal = TransitionSignal(
        user_id=user_id,
        context_text=context_text,
        signal_type=signal_type,
        confidence=top_signal["confidence"],
        action_taken="suggested",
        guided_flow=guided_flow,
        conversation_id=conversation_id,
    )
    db.add(signal)
    db.commit()

    logger.info("转型信号已检测: user_id=%s type=%s confidence=%.2f",
                user_id, signal_type, top_signal["confidence"])

    return {
        "detected": True,
        "signal_type": signal_type,
        "confidence": top_signal["confidence"],
        "suggestion": suggestion,
        "guided_flow": guided_flow,
    }


# ═══════════════════════════════════════════════
# 2. 用户自我诊断
# ═══════════════════════════════════════════════

def _parse_resume_mock(resume_url: str | None) -> dict[str, Any]:
    """模拟简历解析（生产环境调用AI引擎）。"""
    return {
        "name": "用户",
        "current_role": "HR负责人",
        "years_of_experience": "5-8年",
        "education": "本科及以上",
        "key_skills": ["招聘管理", "员工关系", "薪酬绩效"],
        "industries": ["互联网", "科技"],
        "certifications": [],
    }


def start_self_diagnosis(db: Session, user_id: str, resume_url: str | None = None,
                         interview_mode: str = "guided") -> dict[str, Any]:
    """开始自我诊断：上传简历 + 生成引导访谈问题 + 创建诊断记录。"""
    # 检查是否已有进行中的诊断
    existing = db.query(SelfDiagnosis).filter(
        SelfDiagnosis.user_id == user_id,
        SelfDiagnosis.status == "draft",
        SelfDiagnosis.deleted_at.is_(None),
    ).first()
    if existing:
        return _diagnosis_to_dict(existing)

    # 解析简历
    resume_parsed = {}
    if resume_url:
        resume_parsed = _parse_resume_mock(resume_url)

    # 创建诊断
    diagnosis = SelfDiagnosis(
        user_id=user_id,
        resume_upload_url=resume_url,
        resume_parsed_json=resume_parsed,
        interview_answers_json={},
        diagnosis_report_json=None,
        self_rating_json={},
        teacher_reviewed=False,
        status="draft",
    )
    db.add(diagnosis)
    db.commit()
    db.refresh(diagnosis)

    logger.info("自我诊断已开始: diagnosis_id=%s user_id=%s", diagnosis.id, user_id)

    questions = [
        {
            "question_id": q["question_id"],
            "question": q["question"],
            "category": q["category"],
            "hint": q.get("hint"),
        }
        for q in DIAGNOSIS_INTERVIEW_QUESTIONS
    ]

    return {
        "diagnosis_id": diagnosis.id,
        "status": "draft",
        "resume_upload_url": resume_url,
        "resume_parsed": resume_parsed,
        "interview_questions": questions,
        "report": None,
    }


def submit_interview_answer(db: Session, user_id: str, diagnosis_id: str,
                            question_id: str, answer: str) -> dict[str, Any]:
    """提交访谈答案。"""
    diagnosis = db.query(SelfDiagnosis).filter(
        SelfDiagnosis.id == diagnosis_id,
        SelfDiagnosis.user_id == user_id,
        SelfDiagnosis.deleted_at.is_(None),
    ).first()
    if not diagnosis:
        raise APIError(60002, "诊断记录不存在", 404)

    answers = diagnosis.interview_answers_json or {}
    answers[question_id] = {
        "answer": answer,
        "submitted_at": utcnow().isoformat(),
    }
    diagnosis.interview_answers_json = answers
    db.commit()

    # 检查是否所有问题都已回答
    all_answered = all(
        q["question_id"] in answers
        for q in DIAGNOSIS_INTERVIEW_QUESTIONS
    )

    if all_answered:
        # 自动生成诊断报告
        report = _generate_diagnosis_report(diagnosis)
        diagnosis.diagnosis_report_json = report
        diagnosis.status = "teacher_reviewing"
        db.commit()

        logger.info("诊断报告已生成: diagnosis_id=%s", diagnosis_id)

    return {"diagnosis_id": diagnosis_id, "answered_count": len(answers),
            "total_questions": len(DIAGNOSIS_INTERVIEW_QUESTIONS),
            "all_answered": all_answered}


def _generate_diagnosis_report(diagnosis: SelfDiagnosis) -> dict[str, Any]:
    """基于简历和访谈答案生成诊断报告（MVP：规则+模拟）。"""
    answers = diagnosis.interview_answers_json or {}
    resume = diagnosis.resume_parsed_json or {}

    # 分析优势
    strengths = []
    gaps = []
    recommendations = []
    target_companies = []

    # 基于简历的技能分析
    skills = resume.get("key_skills", [])
    if skills:
        strengths.append(f"具备{', '.join(skills[:3])}等核心HR模块经验")

    # 基于访谈答案分析
    q1 = answers.get("q1", {}).get("answer", "")
    q2 = answers.get("q2", {}).get("answer", "")
    q3 = answers.get("q3", {}).get("answer", "")
    q4 = answers.get("q4", {}).get("answer", "")
    q5 = answers.get("q5", {}).get("answer", "")

    if "团队" in q1 or "管理" in q1:
        strengths.append("具备团队管理经验，有承接大客户的能力基础")

    if len(q2) > 50:
        strengths.append("能清晰表达自身核心能力，具有较好的自我认知")
    else:
        gaps.append("核心能力描述较为笼统，建议更具体地梳理自身优势，形成差异化定位")

    if len(q3) > 30:
        strengths.append("有明确的职业规划，签约目标清晰")
    else:
        gaps.append("职业目标不够具体，建议明确1-3年的客户发展目标和收入预期")

    if "不敢" in q4 or "困难" in q4 or "不会" in q4:
        gaps.append("存在客户沟通中的具体卡点，需要在面谈策略中重点关注")
        if "报价" in q4 or "价格" in q4 or "谈钱" in q4:
            gaps.append("在报价/商务谈判环节信心不足，建议加强商务谈判技巧训练")
        if "信任" in q4 or "关系" in q4:
            gaps.append("在建立客户信任方面需要提升，建议学习信任建立五步法")

    if len(q5) > 30:
        strengths.append("有清晰的客户画像意识，能识别目标客户的特征")
        # 尝试提取目标公司
        for industry in ["互联网", "科技", "制造", "金融", "教育", "医疗"]:
            if industry in q5:
                target_companies.append(f"{industry}行业中大型企业")

    if not strengths:
        strengths.append("有HR从业经验，具备行业基础知识")
    if not gaps:
        gaps.append("建议通过实际客户面谈进一步发现潜在短板")
    if not target_companies:
        target_companies.append("建议结合诊断报告中的优势方向，锁定2-3个目标行业")

    recommendations = [
        "建议先完成客户情报采集，深入了解目标客户后再制定面谈策略",
        "使用角色扮演模拟训练练习关键场景（特别是您提到的卡点场景）",
        "制定2-3轮面谈策略，每轮设定明确的达成率目标",
        "关注签约后的合同管理和服务交付，形成完整的客户服务闭环",
    ]

    # 计算自我评估分数
    self_rating = _calculate_self_rating(answers)

    return {
        "user_summary": {
            "name": resume.get("name", "用户"),
            "current_role": resume.get("current_role", "HR从业者"),
            "years": resume.get("years_of_experience", "3-5年"),
            "education": resume.get("education", "本科"),
            "key_skills": skills,
            "industries": resume.get("industries", []),
        },
        "strengths": strengths,
        "gaps": gaps,
        "recommendations": recommendations,
        "target_companies": target_companies,
        "self_rating": self_rating,
        "generated_at": utcnow().isoformat(),
    }


def _calculate_self_rating(answers: dict) -> dict[str, Any]:
    """基于访谈答案计算自我评估。"""
    rating = {
        "client_acquisition": 60,  # 客户获取能力
        "communication": 65,  # 沟通能力
        "negotiation": 55,  # 谈判能力
        "strategy": 60,  # 策略能力
        "industry_knowledge": 70,  # 行业知识
    }
    # 根据答案调整评分（简化版）
    q2 = answers.get("q2", {}).get("answer", "")
    if len(q2) > 100:
        rating["client_acquisition"] += 15
    if len(q2) > 50:
        rating["communication"] += 10

    q4 = answers.get("q4", {}).get("answer", "")
    if "成功" in q4 or "克服" in q4 or "解决" in q4:
        rating["negotiation"] += 15

    # 限制最高分
    for k in rating:
        rating[k] = min(rating[k], 95)

    return rating


def teacher_review_diagnosis(db: Session, teacher_id: str, diagnosis_id: str,
                             action: str, teacher_notes: str | None = None) -> dict[str, Any]:
    """老师审核诊断（确认或驳回）。"""
    diagnosis = db.query(SelfDiagnosis).filter(
        SelfDiagnosis.id == diagnosis_id,
        SelfDiagnosis.deleted_at.is_(None),
    ).first()
    if not diagnosis:
        raise APIError(60002, "诊断记录不存在", 404)

    if action == "confirm":
        diagnosis.status = "confirmed"
        diagnosis.teacher_reviewed = True
        diagnosis.teacher_id = teacher_id
    else:
        diagnosis.status = "rejected"
        diagnosis.teacher_reviewed = False

    if teacher_notes:
        diagnosis.teacher_notes = teacher_notes

    db.commit()

    logger.info("诊断审核%s: diagnosis_id=%s teacher_id=%s", action, diagnosis_id, teacher_id)

    return {"diagnosis_id": diagnosis_id, "status": diagnosis.status,
            "teacher_reviewed": diagnosis.teacher_reviewed}


def _diagnosis_to_dict(d: SelfDiagnosis) -> dict[str, Any]:
    """诊断ORM → 字典。"""
    report = d.diagnosis_report_json or {}
    return {
        "diagnosis_id": d.id,
        "status": d.status,
        "resume_upload_url": d.resume_upload_url,
        "interview_questions": [
            {"question_id": q["question_id"], "question": q["question"],
             "category": q["category"], "hint": q.get("hint")}
            for q in DIAGNOSIS_INTERVIEW_QUESTIONS
        ],
        "report": DiagnosisReportDict(d.id, report) if report else None,
    }


def DiagnosisReportDict(diagnosis_id: str, report: dict) -> dict:
    return {
        "diagnosis_id": diagnosis_id,
        "user_summary": report.get("user_summary", {}),
        "strengths": report.get("strengths", []),
        "gaps": report.get("gaps", []),
        "recommendations": report.get("recommendations", []),
        "target_companies": report.get("target_companies", []),
        "self_rating": report.get("self_rating", {}),
        "teacher_reviewed": False,
    }


# ═══════════════════════════════════════════════
# 3. 客户情报采集（老师后台）
# ═══════════════════════════════════════════════

def _mock_intel_report(company_name: str) -> dict[str, Any]:
    """模拟AI企业情报采集（生产环境调用搜索/AI引擎基于公开信息）。"""
    return {
        "company_overview": {
            "name": company_name,
            "industry": "互联网/科技",
            "scale": "500-2000人",
            "location": "北京/上海/深圳（以公开信息为准）",
            "established": "约5-15年前（以工商信息为准）",
        },
        "business_analysis": {
            "core_business": "基于公开信息，推测主要业务方向为B2B企业服务或平台型业务",
            "revenue_model": "SaaS订阅 / 项目制 / 平台佣金（以实际情况为准）",
            "growth_stage": "成长期/扩张期（基于招聘信息判断）",
            "competitors": ["行业内Top3-5的竞对公司（以公开信息为准）"],
        },
        "hr_insights": {
            "recruiting_scale": "近期有较多技术/销售岗位招聘，说明公司在扩张",
            "organization_structure": "扁平化管理/事业部制（基于JD分析）",
            "hr_pain_points": [
                "快速扩张期的人才招聘压力",
                "新老员工的文化融合",
                "绩效体系可能需优化",
            ],
            "budget_signal": "基于薪资水平和招聘量级，推测HR服务预算适中",
        },
        "decision_chain": {
            "key_roles": ["HRD/HRVP", "业务VP", "CEO/创始人"],
            "decision_style": "数据驱动 + ROI导向",
            "entry_strategy": "建议从HRD直接切入，展示行业标杆案例和数据",
        },
        "public_sources_note": (
            "以上信息均基于公开来源：招聘网站、公司官网、微信公众号、天眼查/企查查工商信息、"
            "看准网/脉脉员工评价等。建议结合实地拜访和行业人脉进行交叉验证。"
        ),
    }


def collect_company_intel(db: Session, teacher_id: str, company_name: str,
                          company_aliases: list[str] | None = None,
                          target_user_id: str | None = None) -> dict[str, Any]:
    """老师后台AI采集企业情报（2-3分钟生成初稿）。"""
    # 检查是否已有同一公司的情报
    existing = db.query(CompanyIntel).filter(
        CompanyIntel.company_name == company_name,
        CompanyIntel.status.in_(["collected", "reviewed"]),
        CompanyIntel.deleted_at.is_(None),
    ).first()
    if existing:
        logger.info("企业情报已存在: intel_id=%s company=%s", existing.id, company_name)
        return _intel_to_dict(existing)

    # AI采集情报
    intel_report = _mock_intel_report(company_name)

    # 模拟来源URL
    source_urls = [
        f"https://www.zhipin.com/gongsi/{company_name}.html",
        f"https://www.tianyancha.com/search?key={company_name}",
        f"https://www.kanzhun.com/company/{company_name}/",
        f"https://www.lagou.com/gongsi/{company_name}.html",
    ]
    source_types = ["招聘网站(BOSS直聘)", "天眼查/企查查", "看准网/脉脉", "招聘网站(拉勾)"]

    intel = CompanyIntel(
        user_id=target_user_id or teacher_id,
        company_name=company_name,
        company_aliases_json=company_aliases or [],
        industry=intel_report["company_overview"].get("industry", ""),
        scale=intel_report["company_overview"].get("scale", ""),
        location=intel_report["company_overview"].get("location", ""),
        intel_report_json=intel_report,
        source_urls_json=source_urls,
        source_types_json=source_types,
        teacher_id=teacher_id,
        status="collected",
    )
    db.add(intel)
    db.commit()
    db.refresh(intel)

    logger.info("企业情报已采集: intel_id=%s company=%s", intel.id, company_name)

    return _intel_to_dict(intel)


def review_company_intel(db: Session, teacher_id: str, intel_id: str,
                         action: str, teacher_notes: str | None = None,
                         modified_report: dict | None = None) -> dict[str, Any]:
    """老师审核企业情报。"""
    intel = db.query(CompanyIntel).filter(
        CompanyIntel.id == intel_id,
        CompanyIntel.deleted_at.is_(None),
    ).first()
    if not intel:
        raise APIError(60002, "情报记录不存在", 404)

    if action == "approve":
        intel.status = "reviewed"
    elif action == "reject":
        intel.status = "collected"  # 回到采集状态
    elif action == "modify" and modified_report:
        intel.intel_report_json = modified_report
        intel.status = "reviewed"

    if teacher_notes:
        intel.teacher_review_notes = teacher_notes
    intel.teacher_id = teacher_id
    db.commit()

    logger.info("情报审核%s: intel_id=%s", action, intel_id)

    return _intel_to_dict(intel)


def deliver_company_intel(db: Session, teacher_id: str, intel_id: str) -> dict[str, Any]:
    """交付情报给用户。"""
    intel = db.query(CompanyIntel).filter(
        CompanyIntel.id == intel_id,
        CompanyIntel.deleted_at.is_(None),
    ).first()
    if not intel:
        raise APIError(60002, "情报记录不存在", 404)

    if intel.status != "reviewed":
        raise APIError(20001, "情报尚未通过审核，请先完成审核", 400)

    intel.status = "delivered"
    intel.delivered_at = utcnow().isoformat()
    db.commit()

    logger.info("情报已交付: intel_id=%s to user_id=%s", intel_id, intel.user_id)

    return _intel_to_dict(intel)


def _intel_to_dict(i: CompanyIntel) -> dict[str, Any]:
    """企业情报ORM → 字典。"""
    return {
        "intel_id": i.id,
        "company_name": i.company_name,
        "status": i.status,
        "intel_report": i.intel_report_json,
        "source_urls": i.source_urls_json or [],
        "source_types": i.source_types_json or [],
        "reviewed": i.status in ("reviewed", "delivered"),
        "delivered": i.status == "delivered",
    }


# ═══════════════════════════════════════════════
# 4. 面谈策略生成
# ═══════════════════════════════════════════════

def generate_meeting_strategy(db: Session, user_id: str, intel_id: str,
                              diagnosis_id: str | None = None,
                              meeting_type: str = "first_visit") -> dict[str, Any]:
    """基于情报+诊断→生成面谈策略文档+提纲。"""
    # 验证情报存在且已交付
    intel = db.query(CompanyIntel).filter(
        CompanyIntel.id == intel_id,
        CompanyIntel.deleted_at.is_(None),
    ).first()
    if not intel:
        raise APIError(60002, "情报记录不存在", 404)
    if intel.status not in ("reviewed", "delivered"):
        raise APIError(20001, "请先完成情报审核后再生成面谈策略", 400)

    # 获取诊断（如有）
    diagnosis = None
    if diagnosis_id:
        diagnosis = db.query(SelfDiagnosis).filter(
            SelfDiagnosis.id == diagnosis_id,
            SelfDiagnosis.user_id == user_id,
            SelfDiagnosis.deleted_at.is_(None),
        ).first()
        if not diagnosis:
            raise APIError(60002, "诊断记录不存在", 404)

    company_name = intel.company_name
    intel_report = intel.intel_report_json or {}
    diag_report = diagnosis.diagnosis_report_json if diagnosis else None

    # 基于情报+诊断生成策略
    strategy_doc = _build_strategy_doc(company_name, intel_report, diag_report, meeting_type)
    outline = _build_meeting_outline(company_name, meeting_type)

    strategy = MeetingStrategy(
        user_id=user_id,
        intel_id=intel_id,
        diagnosis_id=diagnosis_id,
        strategy_doc_json=strategy_doc,
        outline_json={"sections": [
            {"section_title": o["section_title"], "talking_points": o["talking_points"],
             "time_allocation": o["time_allocation"]}
            for o in outline
        ]},
        teacher_approved=False,
        status="draft",
    )
    db.add(strategy)
    db.commit()
    db.refresh(strategy)

    logger.info("面谈策略已生成: strategy_id=%s intel_id=%s", strategy.id, intel_id)

    return _strategy_to_dict(strategy)


def _build_strategy_doc(company_name: str, intel_report: dict,
                        diag_report: dict | None, meeting_type: str) -> dict[str, Any]:
    """基于情报构建策略文档。"""
    decision_chain = intel_report.get("decision_chain", {})
    hr_insights = intel_report.get("hr_insights", {})
    pain_points = hr_insights.get("hr_pain_points", [])

    goals = [
        f"建立与{company_name}HR负责人的初步信任关系",
        f"深入了解{company_name}的人力资源现状和核心痛点",
        "展示我方的专业能力和行业案例",
        "获取下一步推进的明确承诺（二次面谈/方案提案）",
    ]

    approach = (
        f"采用顾问式销售方法，以行业洞察和专业知识切入，"
        f"而非直接推销。重点围绕{', '.join(pain_points[:2]) if pain_points else '企业人才管理痛点'}"
        f"展开讨论，展示我方在这些领域的成功案例和方法论。"
    )

    key_points = [
        f"开场：以对{company_name}所在行业的洞察开场，展示专业度",
        "价值展示：分享2-3个同行业/同规模企业的服务案例",
        f"痛点挖掘：围绕{hr_insights.get('recruiting_scale', '人才需求')}展开深度提问",
        "方案框架：给出初步的服务框架和预期效果",
        "明确下一步：约定方案提案的提交时间和二次面谈时间",
    ]

    risks = [
        "决策链较长，可能涉及多轮沟通",
        "客户可能已有现有HR供应商/内部团队",
        "预算可能在沟通中成为障碍",
        "竞争对手可能同时跟进",
    ]

    alternatives = [
        "如对方预算有限，可先提供小规模试点服务",
        "如决策链太长，可先从HRD层级建立关系逐步推进",
        "如竞争激烈，可通过差异化定位（行业专注/方法论独特）突出优势",
    ]

    return {
        "goals": goals,
        "approach": approach,
        "key_points": key_points,
        "risks": risks,
        "alternatives": alternatives,
        "intel_based": True,
        "diagnosis_based": diag_report is not None,
    }


def _build_meeting_outline(company_name: str, meeting_type: str) -> list[dict[str, Any]]:
    """构建面谈提纲。"""
    return [
        {
            "section_title": "破冰与开场（5分钟）",
            "talking_points": [
                "表达对拜访机会的感谢",
                f"分享1-2个对{company_name}所在行业的观察",
                "简要说明本次面谈的目的和议程",
            ],
            "time_allocation": 5,
        },
        {
            "section_title": "需求探索（15分钟）",
            "talking_points": [
                "询问企业目前的人力资源管理现状",
                "了解近期/未来的招聘计划和人才需求",
                "倾听对方在HR管理中的核心挑战和痛点",
                "了解现有的HR服务供应商和合作模式",
            ],
            "time_allocation": 15,
        },
        {
            "section_title": "价值展示（10分钟）",
            "talking_points": [
                "分享2-3个同行业客户的成功案例",
                "展示我方的服务方法论和差异化优势",
                "说明与竞品的区别和价值定位",
            ],
            "time_allocation": 10,
        },
        {
            "section_title": "方案框架与回应（10分钟）",
            "talking_points": [
                "针对对方的需求给出初步的服务框架",
                "解答对方的疑问和顾虑",
                "讨论可能的合作模式和预算范围",
            ],
            "time_allocation": 10,
        },
        {
            "section_title": "明确下一步（5分钟）",
            "talking_points": [
                "总结本次面谈的核心收获",
                "明确下一步行动（方案提案/二次面谈/报价）",
                "约定下次沟通的时间窗口",
                "表达持续服务的承诺",
            ],
            "time_allocation": 5,
        },
    ]


def review_meeting_strategy(db: Session, teacher_id: str, strategy_id: str,
                            action: str, teacher_notes: str | None = None,
                            modified_strategy: dict | None = None) -> dict[str, Any]:
    """老师审核面谈策略。"""
    strategy = db.query(MeetingStrategy).filter(
        MeetingStrategy.id == strategy_id,
        MeetingStrategy.deleted_at.is_(None),
    ).first()
    if not strategy:
        raise APIError(60002, "策略记录不存在", 404)

    if action == "approve":
        strategy.status = "approved"
        strategy.teacher_approved = True
    elif action == "reject":
        strategy.status = "rejected"
        strategy.teacher_approved = False
    elif action == "modify" and modified_strategy:
        strategy.strategy_doc_json = {
            **strategy.strategy_doc_json,
            **modified_strategy,
        }
        strategy.status = "approved"
        strategy.teacher_approved = True

    if teacher_notes:
        strategy.teacher_notes = teacher_notes
    db.commit()

    logger.info("策略审核%s: strategy_id=%s", action, strategy_id)

    return _strategy_to_dict(strategy)


def _strategy_to_dict(s: MeetingStrategy) -> dict[str, Any]:
    """策略ORM → 字典。"""
    doc = s.strategy_doc_json or {}
    outline = (s.outline_json or {}).get("sections", [])
    return {
        "strategy_id": s.id,
        "status": s.status,
        "goals": doc.get("goals", []),
        "approach": doc.get("approach", ""),
        "key_points": doc.get("key_points", []),
        "risks": doc.get("risks", []),
        "alternatives": doc.get("alternatives", []),
        "outline": outline,
        "teacher_approved": s.teacher_approved,
        "teacher_notes": s.teacher_notes,
    }


# ═══════════════════════════════════════════════
# 5. 客户面谈
# ═══════════════════════════════════════════════

def start_client_meeting(db: Session, user_id: str, strategy_id: str,
                         recording_id: str, client_name: str | None = None,
                         client_position: str | None = None,
                         meeting_date: str | None = None,
                         round_num: int = 1) -> dict[str, Any]:
    """开始客户面谈：关联智能记录录音 + 场景标记。"""
    strategy = db.query(MeetingStrategy).filter(
        MeetingStrategy.id == strategy_id,
        MeetingStrategy.user_id == user_id,
        MeetingStrategy.deleted_at.is_(None),
    ).first()
    if not strategy:
        raise APIError(60002, "策略记录不存在", 404)

    if not strategy.teacher_approved:
        raise APIError(20001, "面谈策略尚未通过审核", 400)

    meeting = ClientMeeting(
        user_id=user_id,
        strategy_id=strategy_id,
        recording_id=recording_id,
        round_num=round_num,
        client_name=client_name,
        client_position=client_position,
        meeting_date=meeting_date or date.today().isoformat(),
        achievement_rate=0.0,
        analysis_json=None,
        status="in_progress",
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    # 如果有智能问答的提词器功能，可以联动
    logger.info("客户面谈已开始: meeting_id=%s recording_id=%s round=%d",
                meeting.id, recording_id, round_num)

    return {
        "meeting_id": meeting.id,
        "strategy_id": strategy_id,
        "recording_id": recording_id,
        "round_num": round_num,
        "status": "in_progress",
    }


def analyze_meeting_achievement(db: Session, user_id: str,
                                meeting_id: str) -> dict[str, Any]:
    """面谈达成率逐条分析：对比策略文档逐条评估 + 亮点/改进/复盘SOP。"""
    meeting = db.query(ClientMeeting).filter(
        ClientMeeting.id == meeting_id,
        ClientMeeting.user_id == user_id,
        ClientMeeting.deleted_at.is_(None),
    ).first()
    if not meeting:
        raise APIError(60002, "面谈记录不存在", 404)

    if meeting.status == "reviewed":
        return _meeting_analysis_to_dict(meeting)

    # 获取策略文档的目标清单
    strategy = db.query(MeetingStrategy).filter(
        MeetingStrategy.id == meeting.strategy_id,
        MeetingStrategy.deleted_at.is_(None),
    ).first()

    strategy_doc = strategy.strategy_doc_json if strategy else {}
    goals = strategy_doc.get("goals", [])

    # 模拟逐条分析（生产环境：调用AI引擎对比录音转写和策略目标）
    item_analysis, highlights, improvements, review_sop = _mock_meeting_analysis(goals)

    achievement_rate = round(
        sum(1 for item in item_analysis if item["achieved"]) / len(item_analysis)
        if item_analysis else 0, 2
    )

    meeting.achievement_rate = achievement_rate
    meeting.analysis_json = {
        "highlights": highlights,
        "improvements": improvements,
        "review_sop": review_sop,
        "item_by_item": item_analysis,
    }
    meeting.status = "reviewed"
    db.commit()

    logger.info("面谈分析完成: meeting_id=%s rate=%.0f%%", meeting_id, achievement_rate * 100)

    return _meeting_analysis_to_dict(meeting)


def _mock_meeting_analysis(goals: list[str]) -> tuple[list, list, list, list]:
    """模拟面谈逐条分析。"""
    if not goals:
        goals = ["建立初步信任", "了解需求", "展示价值", "获取下一步承诺"]

    item_analysis = []
    for i, goal in enumerate(goals):
        # 模拟达成率（生产环境基于AI分析）
        achieved = random.choice([True, True, True, False])
        item_analysis.append({
            "item": goal,
            "achieved": achieved,
            "rate": round(random.uniform(0.6, 1.0) if achieved else random.uniform(0.1, 0.5), 2),
            "comment": ("目标达成较好，客户反馈积极" if achieved
                        else "该目标尚未完全达成，建议在下轮面谈中重点关注"),
        })

    highlights = [
        "开场行业洞察切入有效，客户表示认可",
        "需求挖掘环节提问深入，获取了关键信息",
        "展示了2个相关案例，客户表示有参考价值",
    ]

    improvements = [
        "方案框架展示偏笼统，建议下次带上具体的数据支撑",
        "未能在面谈中明确获取下一步的承诺时间",
        "对客户的预算顾虑回应不够充分",
    ]

    review_sop = [
        "第一步：回顾本次面谈的核心交流内容（5分钟）",
        "第二步：逐条对照策略目标，评估达成情况（10分钟）",
        "第三步：记录客户的疑问、顾虑和未解决的问题（5分钟）",
        "第四步：制定下一轮面谈的调整策略（10分钟）",
        "第五步：如有必要，更新客户情报和策略文档（5分钟）",
    ]

    return item_analysis, highlights, improvements, review_sop


def _meeting_analysis_to_dict(m: ClientMeeting) -> dict[str, Any]:
    """面谈分析 → 字典。"""
    analysis = m.analysis_json or {}
    item_by_item = analysis.get("item_by_item", [])
    return {
        "meeting_id": m.id,
        "achievement_rate": m.achievement_rate or 0.0,
        "item_analysis": item_by_item,
        "highlights": analysis.get("highlights", []),
        "improvements": analysis.get("improvements", []),
        "review_sop": analysis.get("review_sop", []),
    }


def get_client_meeting(db: Session, user_id: str, meeting_id: str) -> dict[str, Any]:
    """获取面谈详情。"""
    meeting = db.query(ClientMeeting).filter(
        ClientMeeting.id == meeting_id,
        ClientMeeting.user_id == user_id,
        ClientMeeting.deleted_at.is_(None),
    ).first()
    if not meeting:
        raise APIError(60002, "面谈记录不存在", 404)

    return {
        "meeting_id": meeting.id,
        "strategy_id": meeting.strategy_id,
        "recording_id": meeting.recording_id,
        "round_num": meeting.round_num,
        "client_name": meeting.client_name,
        "client_position": meeting.client_position,
        "meeting_date": meeting.meeting_date,
        "achievement_rate": meeting.achievement_rate,
        "status": meeting.status,
        "analysis": meeting.analysis_json,
    }


# ═══════════════════════════════════════════════
# 6. 多轮谈判管理
# ═══════════════════════════════════════════════

def manage_negotiation_rounds(db: Session, user_id: str,
                              meeting_id: str) -> dict[str, Any]:
    """获取多轮谈判详情（每轮独立的策略→执行→复盘）。"""
    meeting = db.query(ClientMeeting).filter(
        ClientMeeting.id == meeting_id,
        ClientMeeting.user_id == user_id,
        ClientMeeting.deleted_at.is_(None),
    ).first()
    if not meeting:
        raise APIError(60002, "面谈记录不存在", 404)

    rounds = db.query(NegotiationRound).filter(
        NegotiationRound.meeting_id == meeting_id,
        NegotiationRound.deleted_at.is_(None),
    ).order_by(NegotiationRound.round_number).all()

    rounds_data = [_round_to_dict(r) for r in rounds]

    # 计算综合达成率
    completed_rounds = [r for r in rounds if r.status in ("completed", "reviewed")]
    overall_rate = round(
        sum(r.achievement_rate or 0 for r in completed_rounds) / len(completed_rounds)
        if completed_rounds else 0, 2
    )

    current_round = max(r.round_number for r in rounds) if rounds else 1

    return {
        "meeting_id": meeting_id,
        "rounds": rounds_data,
        "current_round": current_round,
        "total_rounds": len(rounds),
        "overall_achievement_rate": overall_rate,
    }


def generate_next_round_strategy(db: Session, user_id: str, meeting_id: str,
                                 focus_areas: list[str] | None = None) -> dict[str, Any]:
    """从复盘生成下一轮策略。"""
    meeting = db.query(ClientMeeting).filter(
        ClientMeeting.id == meeting_id,
        ClientMeeting.user_id == user_id,
        ClientMeeting.deleted_at.is_(None),
    ).first()
    if not meeting:
        raise APIError(60002, "面谈记录不存在", 404)

    # 获取上一轮谈判
    last_round = db.query(NegotiationRound).filter(
        NegotiationRound.meeting_id == meeting_id,
        NegotiationRound.deleted_at.is_(None),
    ).order_by(desc(NegotiationRound.round_number)).first()

    next_round_num = (last_round.round_number + 1) if last_round else 1
    prev_review = last_round.review_json if last_round else {}

    # 生成下一轮策略
    focus = focus_areas or ["深化需求理解", "推进方案确认"]
    strategy = {
        "round": next_round_num,
        "goals": ["跟进上一轮未达成目标"] + [
            f"推进{fa}" for fa in focus
        ],
        "approach": "基于上一轮复盘调整切入角度",
        "key_points": [
            "回顾上一轮共识，强化信任",
            f"重点讨论{'、'.join(focus)}",
            "明确下一阶段的时间节点",
        ],
        "risks": ["客户可能因上一轮未解决问题而犹豫"],
        "preparation": ["复盘上一轮录音/纪要", "准备针对性案例"],
    }

    advice = (
        f"第{next_round_num}轮面谈建议："
        f"基于上一轮的复盘，本轮重点聚焦于{'、'.join(focus)}。"
        f"建议在开场时先回顾上一轮的共识和待跟进事项，建立连续性。"
    )

    # 创建新谈判轮次
    new_round = NegotiationRound(
        meeting_id=meeting_id,
        user_id=user_id,
        round_number=next_round_num,
        strategy_json=strategy,
        status="preparing",
    )
    db.add(new_round)
    db.commit()

    logger.info("下一轮策略已生成: meeting_id=%s round=%d", meeting_id, next_round_num)

    return {
        "meeting_id": meeting_id,
        "round_num": next_round_num,
        "strategy": strategy,
        "advice": advice,
    }


def _round_to_dict(r: NegotiationRound) -> dict[str, Any]:
    return {
        "round_id": r.id,
        "round_number": r.round_number,
        "strategy": r.strategy_json,
        "meeting_notes": r.meeting_notes_json,
        "review": r.review_json,
        "achievement_rate": r.achievement_rate,
        "status": r.status,
    }


# ═══════════════════════════════════════════════
# 7. 角色转换模拟训练
# ═══════════════════════════════════════════════

# ── 各场景关键词库（A维度：关键词命中率）──
SCENARIO_KEYWORDS = {
    "cold_call": {
        "target": [
            "自我介绍", "来意说明", "价值主张", "差异化",
            "行业洞察", "案例", "邀约", "微信/联系方式",
            "跟进", "时间", "简洁", "钩子", "共鸣",
            "痛点", "数据", "尊重对方时间", "开门见山",
        ],
    },
    "first_visit": {
        "target": [
            "信任", "需求", "痛点", "价值", "方案",
            "案例", "ROI", "决策链", "预算", "时间线",
            "承诺", "下一步", "差异化", "专业度", "同理心",
            "提问", "倾听", "总结", "确认", "跟进",
        ],
    },
    "objection_handling": {
        "target": [
            "共情", "理解", "澄清", "数据", "案例",
            "ROI", "风险", "试用", "分阶段", "保障",
            "协议", "参考客户", "口碑", "迂回", "确认",
            "重构问题", "利益", "安全感", "降低成本", "提升效率",
        ],
    },
    "closing": {
        "target": [
            "试探", "封闭提问", "假设成交", "紧迫感",
            "价值总结", "下一步", "合同", "条款", "保障",
            "交付", "时间节点", "确认", "异议处理",
            "信心传递", "互利共赢", "长期合作", "服务承诺",
        ],
    },
    "custom": {
        "target": [
            "信任", "需求", "痛点", "价值", "方案",
            "案例", "ROI", "差异化", "专业度", "同理心",
            "提问", "倾听", "总结", "确认", "跟进",
            "共情", "澄清", "承诺", "下一步", "预算",
        ],
    },
}


def _get_scenario_keywords(scenario_type: str) -> list[str]:
    """获取场景关键词列表。"""
    return SCENARIO_KEYWORDS.get(scenario_type, SCENARIO_KEYWORDS["custom"])["target"]


# ── 客户角色模拟回复库 ──
CLIENT_RESPONSES = {
    "cold_call": {
        "opening": "喂，你好？（语气略显忙碌）",
        "receptive": "嗯，你继续说，我听着。",
        "skeptical": "你们公司我好像没听说过，你们主要做什么的？",
        "interested": "哦？这个有点意思，你说的这个案例能详细讲讲吗？",
        "busy": "不好意思，我马上有个会，你长话短说吧。",
        "objection": "我们现在已经有合作的供应商了，为什么要换？",
        "closing_positive": "行，那你加我微信吧，把你说的资料发我看看。",
        "closing_vague": "这样吧，我考虑一下，有需要再联系你。",
    },
    "first_visit": {
        "opening": "请坐请坐，辛苦了。你们公司在业内有些名气，我听说过。",
        "receptive": "这部分确实是我们比较头疼的，你详细说说。",
        "skeptical": "你说的这些，市面上其他公司也能做啊，有什么区别？",
        "interested": "这个思路不错，你能给我一个大概的方案框架吗？",
        "concerned": "但预算这块我们今年比较紧，你能给我一个ROI预估吗？",
        "decision_chain": "这个我要回去跟我们VP商量一下，我一个人说了不算。",
        "closing_positive": "你下周把方案发过来，我们内部讨论一下，然后跟你约二次沟通。",
        "closing_vague": "好的我知道了，回头有需求再联系你。",
    },
    "objection_handling": {
        "opening": "上次你说的方案我看了，有几个地方不太明白。",
        "price_objection": "说实话，你们的价格比竞品高了30%，我很难说服老板。",
        "trust_objection": "我们对新供应商比较谨慎，你们有我们这个行业的案例吗？",
        "timing_objection": "最近项目太多了，等忙完这阵再说吧。",
        "competitor_objection": "XX公司的方案跟你差不多，但他们价格更低。",
        "need_objection": "坦白讲，我不确定我们目前是否需要这个服务。",
        "resolved": "你这么说我理解了，确实有道理。那我们怎么开始？",
    },
    "closing": {
        "opening": "经过前几轮沟通，我对你们的服务有了比较清楚的了解。",
        "terms_concern": "付款方式可以灵活一些吗？比如分期？",
        "scope_concern": "服务范围能不能再细化一下？我怕后面扯皮。",
        "timeline_concern": "你们最快什么时候能启动？我们这边时间比较紧。",
        "ready_to_sign": "方案和服务条款都没问题了，你发合同过来吧。",
        "last_minute_hesitation": "等等，让我再想想...毕竟这个投入不小。",
    },
    "custom": {
        "opening": "你好，我们聊一下你的服务方案吧。",
        "receptive": "嗯，你继续说，我想了解更多。",
        "skeptical": "这个真的有用吗？",
        "interested": "这个有意思，说说具体的。",
        "objection": "我也需要考虑一下成本和效果。",
        "closing_positive": "那我们可以试试看。",
    },
}


def _generate_client_response(scenario_type: str, user_message: str,
                              dialogue_length: int) -> str:
    """模拟客户回复（生产环境调用AI引擎生成真实客户回复）。"""
    responses = CLIENT_RESPONSES.get(scenario_type, CLIENT_RESPONSES["custom"])

    # 基于对话长度模拟不同阶段的回复
    if dialogue_length <= 1:
        return responses["opening"]
    elif dialogue_length <= 3:
        if random.random() > 0.5:
            return responses["receptive"]
        return responses["skeptical"]
    elif dialogue_length <= 6:
        return responses.get("interested", responses["receptive"])
    elif dialogue_length <= 10:
        if random.random() > 0.6:
            return random.choice([responses.get("objection", ""),
                                  responses.get("price_objection", ""),
                                  responses.get("concerned", "")])
        return responses.get("interested", "")
    else:
        if dialogue_length > 15 and random.random() > 0.4:
            return random.choice([responses.get("closing_positive", ""),
                                  responses.get("ready_to_sign", "")])
        return responses.get("closing_positive", responses.get("receptive", ""))


def start_roleplay(db: Session, user_id: str, scenario_type: str,
                   client_company: str | None = None,
                   client_position: str | None = None,
                   client_personality: str | None = None,
                   client_pain_points: list[str] | None = None,
                   custom_context: str | None = None) -> dict[str, Any]:
    """开始角色扮演训练：小耕扮演客户角色，用户扮演顾问。"""
    if scenario_type not in ROLEPLAY_SCENARIOS:
        scenario_type = "custom"

    # 生成客户角色设定
    client_profile = _generate_client_profile(
        scenario_type, client_company, client_position,
        client_personality, client_pain_points, custom_context,
    )

    # 获取开场白
    client_responses = CLIENT_RESPONSES.get(scenario_type, CLIENT_RESPONSES["custom"])
    opening_message = client_responses["opening"]

    # 初始对话
    dialogue = [{
        "role": "client",
        "text": opening_message,
        "timestamp": utcnow().isoformat(),
    }]

    session = RoleplaySession(
        user_id=user_id,
        scenario_type=scenario_type,
        current_role="client",
        client_profile_json=client_profile,
        dialogue_json=dialogue,
        pass_threshold=DEFAULT_PASS_THRESHOLD,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    logger.info("角色扮演已开始: session_id=%s scenario=%s", session.id, scenario_type)

    return {
        "session_id": session.id,
        "scenario_type": scenario_type,
        "current_role": "client",
        "client_profile": client_profile,
        "opening_message": opening_message,
        "dialogue": dialogue,
        "session_status": "active",
    }


def _generate_client_profile(scenario_type: str, company: str | None,
                             position: str | None, personality: str | None,
                             pain_points: list[str] | None,
                             custom_context: str | None) -> dict[str, Any]:
    """生成客户角色设定。"""
    profiles = {
        "cold_call": {
            "company": company or "某科技公司",
            "position": position or "人力资源总监",
            "personality": personality or "忙碌/务实/警惕性高",
            "pain_points": pain_points or ["招聘效率低", "人才流失严重"],
            "budget": "中等预算，重视ROI",
            "authority_chain": "可直接决策，但需要内部论证",
            "context": "你正在给这家公司的HR总监打Cold Call，对方比较忙",
        },
        "first_visit": {
            "company": company or "某互联网企业",
            "position": position or "HRVP",
            "personality": personality or "理性/专业/重视数据",
            "pain_points": pain_points or ["快速扩张期人才缺口大", "组织能力跟不上业务发展"],
            "budget": "预算充裕，但要求可量化的效果",
            "authority_chain": "需要与CEO共同决策",
            "context": "你已经通过朋友介绍约到了这家公司的HRVP，今天是第一次正式面谈",
        },
        "objection_handling": {
            "company": company or "某制造企业",
            "position": position or "总经理",
            "personality": personality or "谨慎/成本敏感/有过失败的供应商经历",
            "pain_points": pain_points or ["对价格敏感", "对效果有疑虑"],
            "budget": "预算紧张，希望低成本试水",
            "authority_chain": "一人决策",
            "context": "对方看过你的方案后提出了多个异议，你需要逐一回应",
        },
        "closing": {
            "company": company or "某金融企业",
            "position": position or "常务副总",
            "personality": personality or "果断/追求高效/关注风险",
            "pain_points": pain_points or ["需要快速启动", "担心交付质量"],
            "budget": "预算已批，但要求合同条款保障",
            "authority_chain": "可最终签批",
            "context": "经过多轮沟通，对方基本认可，现在到了签约前的最后确认环节",
        },
        "custom": {
            "company": company or "某企业",
            "position": position or "决策人",
            "personality": personality or "待定",
            "pain_points": pain_points or [],
            "budget": "待评估",
            "authority_chain": "待确认",
            "context": custom_context or "自定义训练场景",
        },
    }
    return profiles.get(scenario_type, profiles["custom"])


def roleplay_turn(db: Session, user_id: str, session_id: str,
                  user_message: str) -> dict[str, Any]:
    """角色扮演回合：用户发言→小耕（客户角色）回复。"""
    session = db.query(RoleplaySession).filter(
        RoleplaySession.id == session_id,
        RoleplaySession.user_id == user_id,
        RoleplaySession.deleted_at.is_(None),
    ).first()
    if not session:
        raise APIError(60002, "角色扮演会话不存在", 404)

    if session.current_role != "client":
        raise APIError(20001, f"当前角色为{session.current_role}，非client模式不支持此操作", 400)

    # 获取对话记录
    dialogue = session.dialogue_json or []

    # 添加用户发言
    dialogue.append({
        "role": "user",
        "text": user_message,
        "timestamp": utcnow().isoformat(),
    })

    # 小耕生成客户回复
    client_response = _generate_client_response(
        session.scenario_type, user_message, len(dialogue),
    )

    # 添加小耕回复
    dialogue.append({
        "role": "client",
        "text": client_response,
        "timestamp": utcnow().isoformat(),
    })

    session.dialogue_json = dialogue
    db.commit()

    return {
        "session_id": session.id,
        "role": "client",
        "response_text": client_response,
        "dialogue_length": len(dialogue),
    }


def score_roleplay(db: Session, user_id: str, session_id: str) -> dict[str, Any]:
    """角色扮演评分：A维度（关键词命中率）+ B维度（四维评分）+ 综合得分。

    A维度占30%，B维度占70%。总分>=80分合格。
    """
    session = db.query(RoleplaySession).filter(
        RoleplaySession.id == session_id,
        RoleplaySession.user_id == user_id,
        RoleplaySession.deleted_at.is_(None),
    ).first()
    if not session:
        raise APIError(60002, "角色扮演会话不存在", 404)

    # 收集用户发言
    dialogue = session.dialogue_json or []
    user_texts = [d["text"] for d in dialogue if d.get("role") == "user"]
    full_user_text = " ".join(user_texts)

    # A维度：关键词命中率
    keywords = _get_scenario_keywords(session.scenario_type)
    score_a_detail = _calculate_keyword_score(full_user_text, keywords)

    # B维度：四维评分
    score_b_detail = _calculate_four_dimension_score(full_user_text, session.scenario_type)

    # 综合评分
    score_a = score_a_detail["score"]
    score_b = score_b_detail["score"]
    total_score = round(score_a * SCORE_A_WEIGHT + score_b * SCORE_B_WEIGHT, 1)
    passed = total_score >= DEFAULT_PASS_THRESHOLD

    # 生成专家反馈
    expert_feedback = _generate_expert_feedback(score_a_detail, score_b_detail, passed)

    # 保存评分
    session.score_a = score_a
    session.score_a_detail_json = score_a_detail
    session.score_b = score_b
    session.score_b_detail_json = score_b_detail
    session.total_score = total_score
    session.passed = passed
    session.expert_feedback = expert_feedback
    db.commit()

    logger.info("角色扮演评分完成: session_id=%s total=%.1f passed=%s",
                session_id, total_score, passed)

    return {
        "session_id": session.id,
        "score_a": score_a,
        "score_a_detail": score_a_detail,
        "score_b": score_b,
        "score_b_detail": score_b_detail,
        "total_score": total_score,
        "passed": passed,
        "pass_threshold": DEFAULT_PASS_THRESHOLD,
        "expert_feedback": expert_feedback,
        "teacher_guidance": session.teacher_guidance,
        "improvement_suggestions": _generate_improvement_suggestions(score_b_detail),
    }


def _calculate_keyword_score(user_text: str, keywords: list[str]) -> dict[str, Any]:
    """A维度：关键词命中率评分。"""
    user_lower = user_text.lower()
    hit_keywords = []
    missed_keywords = []

    for kw in keywords:
        if kw.lower() in user_lower:
            hit_keywords.append(kw)
        else:
            missed_keywords.append(kw)

    hit_rate = len(hit_keywords) / len(keywords) if keywords else 0
    score = round(hit_rate * 100, 1)

    return {
        "total_keywords": len(keywords),
        "hit_keywords": len(hit_keywords),
        "hit_rate": round(hit_rate, 2),
        "score": score,
        "hit_list": hit_keywords,
        "missed_keywords": missed_keywords,
    }


def _calculate_four_dimension_score(user_text: str, scenario_type: str) -> dict[str, Any]:
    """B维度：四维评分（完整性/逻辑性/深度/针对性），各0-25分。

    基于文本长度、关键词密度、句式复杂度等启发式评估（MVP）。
    生产环境应使用AI引擎进行语义级别评估。
    """
    # 完整性：基于文本长度和信息密度
    text_len = len(user_text)
    if text_len > 500:
        completeness = random.randint(20, 25)
    elif text_len > 200:
        completeness = random.randint(15, 22)
    elif text_len > 50:
        completeness = random.randint(10, 18)
    else:
        completeness = random.randint(5, 12)

    # 逻辑性：基于结构词检测
    logic_markers = ["首先", "其次", "最后", "因此", "因为", "所以", "基于", "综上",
                     "一方面", "另一方面", "第一", "第二", "第三", "结论"]
    logic_count = sum(1 for m in logic_markers if m in user_text)
    if logic_count >= 4:
        logic = random.randint(20, 25)
    elif logic_count >= 2:
        logic = random.randint(15, 22)
    elif logic_count >= 1:
        logic = random.randint(10, 18)
    else:
        logic = random.randint(5, 15)

    # 深度：基于专业词汇和具体数据
    depth_markers = ["ROI", "ROAS", "KPI", "转化", "留存", "增长", "%",
                     "效率", "成本", "收益", "案例", "数据", "分析"]
    depth_count = sum(1 for m in depth_markers if m.lower() in user_text.lower())
    if depth_count >= 5:
        depth = random.randint(20, 25)
    elif depth_count >= 3:
        depth = random.randint(15, 22)
    elif depth_count >= 1:
        depth = random.randint(10, 18)
    else:
        depth = random.randint(5, 15)

    # 针对性：基于与场景的匹配度
    if "cold_call" in scenario_type:
        relevance = random.randint(12, 22)
    elif "objection" in scenario_type:
        relevance = random.randint(10, 20)
    else:
        relevance = random.randint(12, 22)

    total = completeness + logic + depth + relevance
    score = round(min(total, 100), 1)

    return {
        "completeness": completeness,  # 完整性 0-25
        "logic": logic,  # 逻辑性 0-25
        "depth": depth,  # 深度 0-25
        "relevance": relevance,  # 针对性 0-25
        "score": score,
    }


def _generate_expert_feedback(score_a: dict, score_b: dict, passed: bool) -> str:
    """生成专家角色反馈。"""
    hit_rate = score_a.get("hit_rate", 0)
    completeness = score_b.get("completeness", 0)
    logic = score_b.get("logic", 0)
    depth = score_b.get("depth", 0)
    relevance = score_b.get("relevance", 0)
    missed = score_a.get("missed_keywords", [])

    feedback_parts = []

    if passed:
        feedback_parts.append("综合评估：表现良好，已达到合格标准。")
    else:
        feedback_parts.append("综合评估：暂未达到合格线，建议针对以下方面进行针对性训练。")

    # 关键词维度反馈
    if hit_rate >= 0.7:
        feedback_parts.append(f"关键词覆盖率达{hit_rate:.0%}，核心要点覆盖较好。")
    elif hit_rate >= 0.4:
        feedback_parts.append(f"关键词覆盖率为{hit_rate:.0%}，建议补充以下要点：{', '.join(missed[:5])}。")
    else:
        feedback_parts.append(f"关键词覆盖率仅{hit_rate:.0%}，大量核心要点缺失，建议加强这部分训练。")

    # 四维反馈
    weakest = min(
        ("完整性", completeness),
        ("逻辑性", logic),
        ("深度", depth),
        ("针对性", relevance),
        key=lambda x: x[1],
    )
    if weakest[1] < 15:
        feedback_parts.append(f"特别注意：'{weakest[0]}'维度得分较低（{weakest[1]}/25），是当前最需要提升的能力维度。")

    strongest = max(
        ("完整性", completeness),
        ("逻辑性", logic),
        ("深度", depth),
        ("针对性", relevance),
        key=lambda x: x[1],
    )
    if strongest[1] >= 20:
        feedback_parts.append(f"优势维度：'{strongest[0]}'表现突出（{strongest[1]}/25），继续保持。")

    return " ".join(feedback_parts)


def _generate_improvement_suggestions(score_b: dict) -> list[str]:
    """生成改进建议列表。"""
    suggestions = []
    dims = {
        "completeness": "完整性",
        "logic": "逻辑性",
        "depth": "深度",
        "relevance": "针对性",
    }
    for key, name in dims.items():
        val = score_b.get(key, 15)
        if val < 15:
            suggestions.append(f"提升{name}（当前{val}/25）：需要进行专项训练，建议参考得分维度的优秀案例")
        elif val < 20:
            suggestions.append(f"巩固{name}（当前{val}/25）：已有一定基础，通过针对性练习可进一步提升")

    return suggestions


def roleplay_as_expert(db: Session, user_id: str, session_id: str) -> dict[str, Any]:
    """切换角色：小耕切换为专家评估者角色，给出评估反馈。"""
    session = db.query(RoleplaySession).filter(
        RoleplaySession.id == session_id,
        RoleplaySession.user_id == user_id,
        RoleplaySession.deleted_at.is_(None),
    ).first()
    if not session:
        raise APIError(60002, "角色扮演会话不存在", 404)

    dialogue = session.dialogue_json or []

    # 专家评估分析
    user_texts = [d["text"] for d in dialogue if d.get("role") == "user"]
    client_texts = [d["text"] for d in dialogue if d.get("role") == "client"]
    user_turns = len(user_texts)
    client_turns = len(client_texts)

    # 生成专家反馈
    expert_analysis = (
        f"【角色扮演评估报告】\n\n"
        f"对话轮次：用户{user_turns}轮 / 客户{client_turns}轮\n"
        f"用户总发言字符数：{sum(len(t) for t in user_texts)}\n\n"
        f"作为专家评估者，我观察到以下几点：\n\n"
        f"1. 沟通节奏：{'对话节奏控制得当，既能引导又能倾听' if user_turns >= 3 else '对话轮次偏少，建议增加互动深度'}\n"
        f"2. 专业深度：{'展现了一定的专业洞察' if any(len(t) > 80 for t in user_texts) else '回答偏简短，建议延展专业深度'}\n"
        f"3. 客户应对：{'基本能应对客户的提问和异议' if client_turns > 1 else '尚未充分应对客户的不同态度'}\n\n"
        f"建议：切换到老师角色获取更详细的针对性指导。"
    )

    dialogue.append({
        "role": "expert",
        "text": expert_analysis,
        "timestamp": utcnow().isoformat(),
    })

    session.dialogue_json = dialogue
    session.current_role = "expert"
    session.expert_feedback = expert_analysis
    db.commit()

    logger.info("切换到专家角色: session_id=%s", session_id)

    return {
        "session_id": session.id,
        "role": "expert",
        "response_text": expert_analysis,
        "dialogue_length": len(dialogue),
    }


def roleplay_as_teacher(db: Session, user_id: str, session_id: str) -> dict[str, Any]:
    """切换角色：小耕切换为老师引导者角色，给出教学指导。"""
    session = db.query(RoleplaySession).filter(
        RoleplaySession.id == session_id,
        RoleplaySession.user_id == user_id,
        RoleplaySession.deleted_at.is_(None),
    ).first()
    if not session:
        raise APIError(60002, "角色扮演会话不存在", 404)

    dialogue = session.dialogue_json or []

    # 获取已有评分（如有）
    score_a = session.score_a or 0
    score_b = session.score_b or 0
    total = session.total_score or 0
    score_b_detail = session.score_b_detail_json or {}

    teacher_guidance = (
        f"【老师指导】\n\n"
        f"你好，我是你的签约辅导老师。让我们来系统复盘这次训练：\n\n"
        f"一、总体表现\n"
        f"综合得分：{total:.1f}分（合格线{DEFAULT_PASS_THRESHOLD}分）"
        f"{'✅ 已达标' if total >= DEFAULT_PASS_THRESHOLD else '❌ 未达标'}\n\n"
        f"二、四维分析\n"
        f"- 完整性：{score_b_detail.get('completeness', 0)}/25 — "
        f"{'内容覆盖全面' if score_b_detail.get('completeness', 0) >= 20 else '建议覆盖更多关键要点'}\n"
        f"- 逻辑性：{score_b_detail.get('logic', 0)}/25 — "
        f"{'表达条理清晰' if score_b_detail.get('logic', 0) >= 20 else '建议优化表达的结构化程度'}\n"
        f"- 深度：{score_b_detail.get('depth', 0)}/25 — "
        f"{'分析有深度' if score_b_detail.get('depth', 0) >= 20 else '建议增加数据支撑和案例分析'}\n"
        f"- 针对性：{score_b_detail.get('relevance', 0)}/25 — "
        f"{'紧密贴合客户需求' if score_b_detail.get('relevance', 0) >= 20 else '建议更精准地回应客户具体关切'}\n\n"
        f"三、提升建议\n"
        f"1. 每次面谈前，确保完成客户情报研究和策略文档准备\n"
        f"2. 训练中使用STAR法则（情境-任务-行动-结果）来组织你的回答\n"
        f"3. 多练习在不同客户态度下的应对策略（接受/犹豫/拒绝/质疑）\n"
        f"4. 建立你的案例库，准备3-5个不同行业的成功案例\n\n"
        f"四、下一步行动\n"
        f"建议再进行2-3次模拟训练后，尝试真实的客户拜访。"
        f"如有具体问题，随时向我提问。"
    )

    dialogue.append({
        "role": "teacher",
        "text": teacher_guidance,
        "timestamp": utcnow().isoformat(),
    })

    session.dialogue_json = dialogue
    session.current_role = "teacher"
    session.teacher_guidance = teacher_guidance
    db.commit()

    logger.info("切换到老师角色: session_id=%s", session_id)

    return {
        "session_id": session.id,
        "role": "teacher",
        "response_text": teacher_guidance,
        "dialogue_length": len(dialogue),
    }


# ═══════════════════════════════════════════════
# 8. 提案生成
# ═══════════════════════════════════════════════

def generate_proposal_framework(db: Session, user_id: str, meeting_id: str,
                                proposal_type: str = "service_proposal",
                                custom_requirements: str | None = None) -> dict[str, Any]:
    """从面谈分析生成初步提案框架。"""
    meeting = db.query(ClientMeeting).filter(
        ClientMeeting.id == meeting_id,
        ClientMeeting.user_id == user_id,
        ClientMeeting.deleted_at.is_(None),
    ).first()
    if not meeting:
        raise APIError(60002, "面谈记录不存在", 404)

    if meeting.status not in ("completed", "reviewed"):
        raise APIError(20001, "请先完成面谈复盘分析后再生成提案", 400)

    # 获取面谈分析数据
    analysis = meeting.analysis_json or {}
    achievements = analysis.get("item_by_item", [])
    improvements = analysis.get("improvements", [])

    # 获取策略文档
    strategy = db.query(MeetingStrategy).filter(
        MeetingStrategy.id == meeting.strategy_id,
        MeetingStrategy.deleted_at.is_(None),
    ).first()
    strategy_doc = strategy.strategy_doc_json if strategy else {}

    # 获取情报
    intel = db.query(CompanyIntel).filter(
        CompanyIntel.id == strategy.intel_id if strategy else None,
        CompanyIntel.deleted_at.is_(None),
    ).first() if strategy else None

    company_name = intel.company_name if intel else meeting.client_name or "客户公司"

    # 生成提案框架
    sections = [
        {
            "title": "项目背景与需求理解",
            "content": f"基于与{company_name}的{'、'.join([str(r) for r in [meeting.round_num]])}轮深入沟通，"
                       f"我们深入理解了贵司在人力资源管理方面的核心需求和挑战。",
            "key_points": [item["item"] for item in achievements if item.get("achieved")],
        },
        {
            "title": "解决方案框架",
            "content": "针对贵司的核心需求，我们提出以下分阶段的解决方案框架。",
            "key_points": strategy_doc.get("key_points", [])[:3],
        },
        {
            "title": "服务内容与交付物",
            "content": "详细的服务内容和每个阶段的交付物清单。",
            "key_points": [
                "第一阶段：诊断与分析（2-3周）",
                "第二阶段：方案设计与实施（4-6周）",
                "第三阶段：效果评估与优化（持续）",
            ],
        },
        {
            "title": "团队配置",
            "content": "本项目的服务团队配置和专业背景说明。",
            "key_points": ["项目经理1名", "资深顾问2名", "行业专家1名（按需）"],
        },
        {
            "title": "时间规划",
            "content": "项目整体时间规划和关键里程碑。",
            "key_points": ["启动会议 → 诊断 → 方案 → 实施 → 验收"],
        },
        {
            "title": "预算概览",
            "content": "基于服务范围的预算框架（最终以合同为准）。",
            "key_points": ["服务费：根据最终方案确定", "可分阶段支付"],
        },
        {
            "title": "下一步行动",
            "content": "提案确认后的下一步行动建议。",
            "key_points": ["确认提案内容", "细化服务范围", "签署正式合同"],
        },
    ]

    key_services = [
        {"service_name": "人力资源管理诊断", "description": "全面评估企业人力资源管理现状", "estimated_duration": "2-3周"},
        {"service_name": "方案设计与优化", "description": "定制化HR解决方案设计", "estimated_duration": "4-6周"},
        {"service_name": "实施辅导", "description": "方案落地执行与过程辅导", "estimated_duration": "8-12周"},
    ]

    next_steps = [
        "提交正式提案文档（PDF格式）",
        "安排提案评审会议（可线上/线下）",
        "根据反馈修改调整方案细节",
        "签署正式服务合同",
    ]

    # 创建提案记录（可以作为Meeting的扩展或独立表，这里关联到会议）
    proposal_id = new_uuid()

    # 更新面谈备注
    meeting.meeting_notes = (meeting.meeting_notes or "") + f"\n[提案已生成: {proposal_id}]"
    db.commit()

    logger.info("提案框架已生成: proposal_id=%s meeting_id=%s", proposal_id, meeting_id)

    return {
        "proposal_id": proposal_id,
        "meeting_id": meeting_id,
        "title": f"{company_name}人力资源管理服务提案",
        "sections": sections,
        "key_services": key_services,
        "estimated_budget": "根据服务范围确定（详见正式合同）",
        "next_steps": next_steps,
    }


# ═══════════════════════════════════════════════
# 9. 签约合同管理
# ═══════════════════════════════════════════════

def upload_contract(db: Session, user_id: str, contract_url: str,
                    meeting_id: str | None = None,
                    contract_title: str | None = None,
                    contract_amount: str | None = None,
                    client_company: str | None = None,
                    service_list: list[dict] | None = None) -> dict[str, Any]:
    """上传签约合同 → 自动同步到打磨产品模块。"""
    contract = ClientContract(
        user_id=user_id,
        meeting_id=meeting_id,
        contract_url=contract_url,
        contract_title=contract_title,
        contract_amount=contract_amount,
        client_company=client_company,
        service_list_json=service_list or [],
        synced_to_product=False,
        status="uploaded",
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)

    # 自动同步到打磨产品模块
    _sync_to_product_module(db, contract)

    logger.info("合同已上传: contract_id=%s url=%s", contract.id, contract_url)

    return {
        "contract_id": contract.id,
        "meeting_id": contract.meeting_id,
        "contract_url": contract_url,
        "status": contract.status,
        "synced_to_product": contract.synced_to_product,
        "product_doc_id": contract.product_doc_id,
    }


def _sync_to_product_module(db: Session, contract: ClientContract) -> None:
    """自动同步合同服务清单到打磨产品模块。

    跨模块调用：读取合同中的服务列表，创建对应的产品/服务文档。
    """
    try:
        from ...shared.models.knowledge import Document

        service_list = contract.service_list_json or []
        if not service_list:
            logger.info("合同无服务清单，跳过多模块同步: contract_id=%s", contract.id)
            return

        # 为每个服务创建产品文档
        for svc in service_list:
            doc = Document(
                owner_user_id=contract.user_id,
                library_type="private",
                doc_type="service_product",
                source_module="M7",  # 拿下一个客户
                hr_category="人资规划",
                title=svc.get("service_name", f"签约服务-{contract.id[:8]}"),
                content={
                    "service_name": svc.get("service_name", ""),
                    "description": svc.get("description", ""),
                    "contract_id": contract.id,
                    "client_company": contract.client_company,
                    "contract_amount": contract.contract_amount,
                    "status": "contracted",
                    "synced_at": utcnow().isoformat(),
                },
                status="draft",
                audit_status="pending",
                is_desensitized=False,
                is_negative_blocked=False,
                vector_status="pending",
                version=1,
            )
            db.add(doc)

        contract.synced_to_product = True
        contract.status = "synced"
        db.commit()

        logger.info("合同已同步到打磨产品模块: contract_id=%s services=%d",
                    contract.id, len(service_list))

    except Exception as e:
        logger.warning("同步到打磨产品模块失败: contract_id=%s error=%s", contract.id, e)
        # 不阻塞合同上传，记录错误后可手动重试


# ═══════════════════════════════════════════════
# 10. 合规提示
# ═══════════════════════════════════════════════

def get_compliance_reminder(db: Session, user_id: str) -> dict[str, Any]:
    """获取合规提示状态（首次使用弹窗率100%）。"""
    reminder = db.query(ComplianceReminder).filter(
        ComplianceReminder.user_id == user_id,
        ComplianceReminder.deleted_at.is_(None),
    ).first()

    if not reminder:
        # 首次使用：创建记录，需要弹窗
        reminder = ComplianceReminder(
            user_id=user_id,
            first_shown=False,
            accepted=False,
            reminder_text=COMPLIANCE_REMINDER_TEXT,
        )
        db.add(reminder)
        db.commit()
        db.refresh(reminder)

        return {
            "user_id": user_id,
            "first_time": True,
            "need_reminder": True,
            "reminder_text": COMPLIANCE_REMINDER_TEXT,
            "accepted": False,
        }

    # 已存在记录
    if not reminder.accepted:
        return {
            "user_id": user_id,
            "first_time": False,
            "need_reminder": True,
            "reminder_text": reminder.reminder_text or COMPLIANCE_REMINDER_TEXT,
            "accepted": False,
        }

    return {
        "user_id": user_id,
        "first_time": False,
        "need_reminder": False,
        "reminder_text": "",
        "accepted": True,
    }


def accept_compliance_reminder(db: Session, user_id: str) -> dict[str, Any]:
    """用户确认合规提示。"""
    reminder = db.query(ComplianceReminder).filter(
        ComplianceReminder.user_id == user_id,
        ComplianceReminder.deleted_at.is_(None),
    ).first()

    if not reminder:
        reminder = ComplianceReminder(
            user_id=user_id,
            first_shown=True,
            first_shown_at=utcnow().isoformat(),
            accepted=True,
            accepted_at=utcnow().isoformat(),
            reminder_text=COMPLIANCE_REMINDER_TEXT,
        )
        db.add(reminder)
    else:
        reminder.accepted = True
        reminder.accepted_at = utcnow().isoformat()
        if not reminder.first_shown:
            reminder.first_shown = True
            reminder.first_shown_at = utcnow().isoformat()

    db.commit()

    logger.info("合规提示已确认: user_id=%s", user_id)

    return {
        "user_id": user_id,
        "first_time": True,
        "need_reminder": False,
        "reminder_text": "",
        "accepted": True,
    }


# ═══════════════════════════════════════════════
# 11. 列表/查询辅助
# ═══════════════════════════════════════════════

def list_diagnoses(db: Session, user_id: str, status: str | None = None) -> list[dict[str, Any]]:
    """获取用户的诊断列表。"""
    query = db.query(SelfDiagnosis).filter(
        SelfDiagnosis.user_id == user_id,
        SelfDiagnosis.deleted_at.is_(None),
    )
    if status:
        query = query.filter(SelfDiagnosis.status == status)
    diagnoses = query.order_by(desc(SelfDiagnosis.created_at)).limit(20).all()

    return [
        {
            "id": d.id,
            "status": d.status,
            "created_at": d.created_at.isoformat() if d.created_at else "",
            "company_focus": (d.diagnosis_report_json or {}).get("target_companies", [None])[0],
            "teacher_reviewed": d.teacher_reviewed,
        }
        for d in diagnoses
    ]


def list_intels(db: Session, user_id: str, status: str | None = None) -> list[dict[str, Any]]:
    """获取用户的情报列表。"""
    query = db.query(CompanyIntel).filter(
        CompanyIntel.user_id == user_id,
        CompanyIntel.deleted_at.is_(None),
    )
    if status:
        query = query.filter(CompanyIntel.status == status)
    intels = query.order_by(desc(CompanyIntel.created_at)).limit(20).all()

    return [
        {
            "id": i.id,
            "company_name": i.company_name,
            "industry": i.industry,
            "status": i.status,
            "created_at": i.created_at.isoformat() if i.created_at else "",
        }
        for i in intels
    ]


def list_meetings(db: Session, user_id: str) -> list[dict[str, Any]]:
    """获取用户的面谈列表。"""
    meetings = db.query(ClientMeeting).filter(
        ClientMeeting.user_id == user_id,
        ClientMeeting.deleted_at.is_(None),
    ).order_by(desc(ClientMeeting.created_at)).limit(20).all()

    return [
        {
            "id": m.id,
            "client_name": m.client_name,
            "round_num": m.round_num,
            "achievement_rate": m.achievement_rate,
            "status": m.status,
            "meeting_date": m.meeting_date,
        }
        for m in meetings
    ]


def list_roleplay_sessions(db: Session, user_id: str) -> list[dict[str, Any]]:
    """获取用户的角色扮演列表。"""
    sessions = db.query(RoleplaySession).filter(
        RoleplaySession.user_id == user_id,
        RoleplaySession.deleted_at.is_(None),
    ).order_by(desc(RoleplaySession.created_at)).limit(20).all()

    return [
        {
            "id": s.id,
            "scenario_type": s.scenario_type,
            "total_score": s.total_score,
            "passed": s.passed,
            "created_at": s.created_at.isoformat() if s.created_at else "",
        }
        for s in sessions
    ]
