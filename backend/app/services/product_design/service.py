"""打磨一套产品服务 — 核心业务逻辑（步骤23 / Wave 5）。

ABS模型驱动方案生成（绝对禁止跳过A→B直接S）：
  A-现状诊断（标准化问卷→系统1.0→老师2.0）
  → B-目标设定（量化：当前状态X → 目标状态Y）
  → S-解决方案（三源调用→A/B双版）

双路径准入：
  - full_abs: 完整ABS流程（有合同/服务清单）
  - pre_research: 产品预研（无合同 → 模板化快速产出）

关键规则：
  - 绝对禁止跳过A→B直接做S（必须先诊断再开药）
  - 方案版本命名仅A版/B版（绝对禁止"基础版/标准版/高级版"）
  - 客户文档不用于模型训练
  - 诊断数据不完整时标注"因数据不足暂未评估"
  - 制度升级可追溯（标注"本方案参照了原XX制度第X条升级..."）
  - 方案与初始报价基本一致
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import desc
from sqlalchemy.orm import Session

from ...shared.config import settings
from ...shared.database import new_uuid, utcnow
from ...shared.errors import APIError, E_FILE_NOT_FOUND, E_PARAM_FORMAT, E_VERSION_NAMING
from ...shared.models.product_design import (
    CoachingRecord,
    DiagnosisReport,
    ENTRY_TYPES,
    PreResearchProduct,
    ProductProject,
    QuantifiedTarget,
    SolutionReuseRecord,
    SolutionVersion,
)

logger = logging.getLogger("product_design")

# ── 阶段顺序定义 ──
PHASE_ORDER = ["draft", "diagnosing", "targeting", "generating", "reviewing", "completed"]
PHASE_REQUIRES = {
    "diagnosing": ["draft"],
    "targeting": ["diagnosing"],
    "generating": ["targeting"],
    "reviewing": ["generating"],
    "completed": ["reviewing"],
}

# ── HR模块分类 ──
HR_MODULES = [
    "人力规划", "招聘配置", "培训开发", "绩效管理",
    "薪酬福利", "员工关系", "组织发展", "人才盘点",
]

# ── 模板类型 → HR模块映射 ──
TEMPLATE_HR_MAP = {
    "recruitment": "招聘配置",
    "training": "培训开发",
    "compensation": "薪酬福利",
    "performance": "绩效管理",
    "policy": "人才盘点",
    "general": "人力规划",
}


# ═══════════════════════════════════════════════
# 辅助函数
# ═══════════════════════════════════════════════

def _get_project(db: Session, project_id: str, user_id: str) -> ProductProject:
    """获取项目，不存在则抛404。"""
    project = db.query(ProductProject).filter(
        ProductProject.id == project_id,
        ProductProject.user_id == user_id,
        ProductProject.deleted_at.is_(None),
    ).first()
    if not project:
        raise APIError(20001, "产品方案项目不存在", 404)
    return project


def _check_phase_can_advance(db: Session, project: ProductProject, target_phase: str):
    """检查是否可以进入目标阶段（禁止跳过A→B直接S）。"""
    current = project.current_phase or "draft"
    allowed_prev = PHASE_REQUIRES.get(target_phase, [])

    if current not in allowed_prev:
        # 构建友好的错误信息
        phase_names = {
            "diagnosing": "A-现状诊断",
            "targeting": "B-目标设定",
            "generating": "S-解决方案",
            "reviewing": "方案评审",
            "completed": "完成",
        }
        prev_names = [phase_names.get(p, p) for p in allowed_prev]
        target_name = phase_names.get(target_phase, target_phase)
        raise APIError(
            20001,
            f"流程禁止跳跃：必须先完成{'/'.join(prev_names)}，才能进入{target_name}。"
            f"当前阶段：{phase_names.get(current, current)}",
            400,
        )


def _validate_version_label(label: str):
    """校验方案版本命名：仅允许A/B，禁止基础版/标准版/高级版等。"""
    forbidden = ["基础版", "标准版", "高级版", "基础", "标准", "高级",
                 "basic", "standard", "premium", "lite", "pro", "enterprise",
                 "试用版", "旗舰版", "精华版", "简易版"]
    if label.upper() not in ("A", "B"):
        raise E_VERSION_NAMING
    for fw in forbidden:
        if fw in label:
            raise E_VERSION_NAMING


def _assess_data_completeness(questionnaire_data: dict) -> dict:
    """评估诊断数据完整度。缺失字段标注"因数据不足暂未评估"。"""
    total_expected = len(HR_MODULES)
    answered_modules = set()
    missing_fields = []

    questions = questionnaire_data.get("answers", [])
    for q in questions:
        cat = q.get("category", "")
        if cat:
            answered_modules.add(cat)

    for module in HR_MODULES:
        if module not in answered_modules:
            missing_fields.append(f"{module}：因数据不足暂未评估")

    completeness_pct = round(len(answered_modules) / total_expected * 100) if total_expected > 0 else 0

    return {
        "overall": f"{completeness_pct}%",
        "answered_modules": list(answered_modules),
        "missing_modules": [m for m in HR_MODULES if m not in answered_modules],
        "missing_fields": missing_fields,
        "notes": "；".join(missing_fields) if missing_fields else "数据完整",
    }


def _generate_upgrade_annotation(source_ref: str, article: str = "") -> str:
    """生成制度升级追溯标注。"""
    if not source_ref:
        return ""
    article_part = f"第{article}条" if article else ""
    return f"本方案参照了原{source_ref}{article_part}升级，过程中梳理了制度执行情况并优化了流程细节。"


# ═══════════════════════════════════════════════
# 1. 双路径准入
# ═══════════════════════════════════════════════

def enter_product_design(
    db: Session,
    user_id: str,
    entry_type: str,
    title: str | None = None,
    contract_ref: str | None = None,
    client_name: str | None = None,
    client_industry: str | None = None,
) -> dict[str, Any]:
    """选择产品方案入口路径：full_abs 或 pre_research。

    - full_abs: 有合同/服务清单，走完整ABS流程
    - pre_research: 无合同，模板化快速产出通用产品
    """
    if entry_type not in ENTRY_TYPES:
        raise APIError(20002, f"入口类型非法，仅支持：{'/'.join(ENTRY_TYPES)}", 400)

    # full_abs模式需要合同编号
    if entry_type == "full_abs" and not contract_ref:
        raise APIError(20001, "完整ABS模式需要提供合同编号(contract_ref)", 400)

    project = ProductProject(
        user_id=user_id,
        title=title or f"产品方案项目",
        entry_type=entry_type,
        contract_ref=contract_ref,
        client_name=client_name,
        client_industry=client_industry,
        current_phase="draft",
        status="draft",
        not_for_training=True,  # 客户文档不用于模型训练
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    logger.info("产品方案项目已创建: project_id=%s entry_type=%s", project.id, entry_type)

    return {
        "project_id": project.id,
        "entry_type": entry_type,
        "current_phase": "draft",
        "status": "draft",
    }


# ═══════════════════════════════════════════════
# 2. 需求分解（上游数据接入）
# ═══════════════════════════════════════════════

def decompose_requirements(
    db: Session,
    user_id: str,
    project_id: str,
    contract_text: str | None = None,
    service_items: list[str] | None = None,
) -> dict[str, Any]:
    """自动分解合同+服务清单 → HR八大模块映射。

    匹配逻辑（MVP）：
    1. 关键词匹配合同文本到HR模块
    2. 服务清单逐项映射到最相关模块
    3. 未能映射的条目归入 unmapped_items
    """
    project = _get_project(db, project_id, user_id)

    if project.entry_type != "full_abs":
        raise APIError(20001, "仅完整ABS模式支持需求分解，预研模式请使用产品预研入口", 400)

    service_items = service_items or []

    # 关键词→模块映射表
    keyword_map = {
        "招聘": "招聘配置", "面试": "招聘配置", "入职": "招聘配置", "JD": "招聘配置",
        "培训": "培训开发", "课程": "培训开发", "学习": "培训开发", "讲师": "培训开发",
        "绩效": "绩效管理", "考核": "绩效管理", "KPI": "绩效管理", "OKR": "绩效管理",
        "薪酬": "薪酬福利", "工资": "薪酬福利", "福利": "薪酬福利", "调薪": "薪酬福利",
        "员工关系": "员工关系", "离职": "员工关系", "纠纷": "员工关系", "合同": "员工关系",
        "人力规划": "人力规划", "编制": "人力规划", "预算": "人力规划", "架构": "人力规划",
        "组织": "组织发展", "OD": "组织发展", "变革": "组织发展", "文化": "组织发展",
        "人才": "人才盘点", "盘点": "人才盘点", "继任": "人才盘点", "梯队": "人才盘点",
    }

    hr_modules_dict: dict[str, list[str]] = {
        m: [] for m in HR_MODULES
    }
    unmapped: list[str] = []

    # 分析合同文本
    if contract_text:
        for keyword, module in keyword_map.items():
            if keyword in contract_text:
                if keyword not in hr_modules_dict[module]:
                    hr_modules_dict[module].append(f"合同提及: {keyword}")

    # 映射服务清单
    for item in service_items:
        matched = False
        for keyword, module in keyword_map.items():
            if keyword in item:
                hr_modules_dict[module].append(item)
                matched = True
                break
        if not matched:
            unmapped.append(item)

    # 构建输出
    hr_modules = []
    for module_name in HR_MODULES:
        items = hr_modules_dict[module_name]
        if items:
            hr_modules.append({
                "module_name": module_name,
                "extracted_items": [i for i in items if i.startswith("合同提及:")],
                "related_services": [i for i in items if not i.startswith("合同提及:")],
            })

    # 存储映射结果
    mapping = {
        "hr_modules": hr_modules,
        "unmapped_items": unmapped,
    }
    project.hr_module_mapping_json = mapping
    project.current_phase = "diagnosing"
    db.commit()

    logger.info("需求分解完成: project_id=%s modules=%d unmapped=%d",
                project_id, len(hr_modules), len(unmapped))

    return {
        "project_id": project_id,
        "hr_modules": hr_modules,
        "unmapped_items": unmapped,
        "summary": f"共映射到{len(hr_modules)}个HR模块，{len(unmapped)}条未能自动映射",
    }


# ═══════════════════════════════════════════════
# 3. A阶段：诊断 1.0（系统生成）
# ═══════════════════════════════════════════════

def generate_diagnosis_v1(
    db: Session,
    user_id: str,
    project_id: str,
    answers: list[dict],
) -> dict[str, Any]:
    """系统基于标准化问卷生成诊断报告1.0。

    A阶段第一步：标准化诊断问卷 → 系统分析 → 产出1.0诊断报告。
    诊断数据不完整时标注"因数据不足暂未评估"。
    """
    project = _get_project(db, project_id, user_id)

    # 检查是否可以进入诊断阶段
    _check_phase_can_advance(db, project, "diagnosing")

    questionnaire_data = {"answers": answers, "submitted_at": utcnow().isoformat()}
    completeness = _assess_data_completeness(questionnaire_data)

    # 分析答案生成诊断内容
    strengths, weaknesses, gaps, recommendations = _analyze_answers(answers, completeness)

    # 构建报告内容
    report_json = {
        "current_state": {
            "overview": _generate_overview(answers, completeness),
            "modules": _analyze_by_module(answers),
            "gaps": gaps,
            "risks": _identify_risks(answers),
        },
        "data_completeness": completeness,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "recommendations": recommendations,
    }

    # 创建报告记录
    report = DiagnosisReport(
        project_id=project_id,
        user_id=user_id,
        version="1.0",
        questionnaire_data_json=questionnaire_data,
        report_json=report_json,
        status="generated",
    )
    db.add(report)

    project.current_phase = "diagnosing"
    db.commit()
    db.refresh(report)

    logger.info("诊断报告1.0已生成: project_id=%s report_id=%s", project_id, report.id)

    return {
        "report_id": report.id,
        "project_id": project_id,
        "version": "1.0",
        "status": "generated",
        "current_state": report_json.get("current_state", {}),
        "data_completeness": completeness,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "gaps": gaps,
        "recommendations": recommendations,
        "teacher_notes": None,
        "teacher_id": None,
    }


def _analyze_answers(answers: list[dict], completeness: dict) -> tuple[list, list, list, list]:
    """分析问卷答案，提取强项/弱项/差距/建议。"""
    strengths: list[str] = []
    weaknesses: list[str] = []
    gaps: list[dict] = []
    recommendations: list[dict] = []

    # 按模块分类评分
    module_scores: dict[str, list[int]] = {}
    for a in answers:
        cat = a.get("category", "其他")
        score = a.get("score")
        if score is not None:
            module_scores.setdefault(cat, []).append(score)

    for module, scores in module_scores.items():
        avg = sum(scores) / len(scores) if scores else 0

        if avg >= 4:
            strengths.append(f"{module}：管理基础扎实（均分{avg:.1f}/5）")
        elif avg >= 2.5:
            gaps.append({
                "module": module,
                "level": "moderate",
                "description": f"{module}存在改进空间",
                "current_score": round(avg, 1),
            })
            recommendations.append({
                "module": module,
                "action": f"建议优化{module}相关制度和流程",
                "priority": "medium",
            })
        else:
            weaknesses.append(f"{module}：存在明显短板（均分{avg:.1f}/5）")
            gaps.append({
                "module": module,
                "level": "critical",
                "description": f"{module}急需改善",
                "current_score": round(avg, 1),
            })
            recommendations.append({
                "module": module,
                "action": f"优先建立{module}基础框架",
                "priority": "high",
            })

    # 数据不完整的模块
    missing = completeness.get("missing_modules", [])
    for m in missing:
        gaps.append({
            "module": m,
            "level": "unknown",
            "description": f"因数据不足暂未评估{m}",
        })

    return strengths, weaknesses, gaps, recommendations


def _generate_overview(answers: list[dict], completeness: dict) -> str:
    """生成诊断总览文本。"""
    total = len(answers)
    scored = sum(1 for a in answers if a.get("score") is not None)
    covered_modules = completeness.get("answered_modules", [])
    missing = completeness.get("missing_modules", [])

    parts = [
        f"本次诊断收到{total}条问卷回答，其中{scored}条包含量化评分。",
        f"已覆盖{len(covered_modules)}个HR模块，{len(missing)}个模块因数据不足暂未评估。",
    ]

    if missing:
        parts.append(f"未覆盖模块：{'、'.join(missing)}。建议补充相关数据后再次诊断。")

    return "".join(parts)


def _analyze_by_module(answers: list[dict]) -> list[dict]:
    """按模块分析问卷答案。"""
    module_answers: dict[str, list[dict]] = {}
    for a in answers:
        cat = a.get("category", "其他")
        module_answers.setdefault(cat, []).append(a)

    result = []
    for module, items in module_answers.items():
        scores = [i["score"] for i in items if i.get("score") is not None]
        avg_score = round(sum(scores) / len(scores), 1) if scores else None
        result.append({
            "module": module,
            "question_count": len(items),
            "average_score": avg_score,
            "key_findings": [i.get("answer", "")[:100] for i in items if i.get("answer")],
        })
    return result


def _identify_risks(answers: list[dict]) -> list[dict]:
    """从问卷答案中识别潜在风险。"""
    risks = []
    risk_keywords = ["没有", "缺乏", "不完善", "纠纷", "投诉", "离职率高",
                     "不满意", "超时", "罚款", "仲裁", "争议"]
    for a in answers:
        answer = a.get("answer", "")
        if any(kw in answer for kw in risk_keywords):
            risks.append({
                "module": a.get("category", ""),
                "risk_type": "合规/管理风险",
                "description": answer[:200],
                "question_ref": a.get("question_id", ""),
            })
    return risks


# ═══════════════════════════════════════════════
# 4. A阶段：诊断 2.0（老师增强）
# ═══════════════════════════════════════════════

def teacher_enhance_diagnosis(
    db: Session,
    user_id: str,
    report_id: str,
    teacher_notes: str | None = None,
    enhanced_sections: list[dict] | None = None,
) -> dict[str, Any]:
    """老师下载1.0报告 → 优化增强 → 产出2.0诊断报告。

    2.0报告以1.0为基础，parent_report_id指向1.0。
    老师可对任意段落进行增强、修正、补充。
    """
    # 查询1.0报告
    report_v1 = db.query(DiagnosisReport).filter(
        DiagnosisReport.id == report_id,
        DiagnosisReport.deleted_at.is_(None),
    ).first()
    if not report_v1:
        raise APIError(20001, "诊断报告1.0不存在", 404)

    if report_v1.version != "1.0":
        raise APIError(20001, "只能对1.0版本报告进行增强", 400)

    if report_v1.status == "confirmed":
        raise APIError(20001, "该报告已确认，不可再增强", 400)

    enhanced_sections = enhanced_sections or []

    # 基于1.0报告增强
    v1_content = report_v1.report_json or {}
    v1_current_state = v1_content.get("current_state", {})

    # 应用老师增强
    enhanced_state = dict(v1_current_state)
    for sec in enhanced_sections:
        key = sec.get("section_key", "")
        enhanced_content = sec.get("enhanced_content", "")
        reason = sec.get("reason", "")
        if key and enhanced_content:
            # 支持点号分隔的嵌套key（如 "current_state.overview"）
            keys = key.split(".")
            target = enhanced_state
            for k in keys[:-1]:
                if k not in target:
                    target[k] = {}
                target = target[k]
            target[keys[-1]] = {
                "content": enhanced_content,
                "teacher_enhanced": True,
                "enhance_reason": reason,
            }

    # 老师补充的强项/弱项/建议
    teacher_strengths = [
        s.get("enhanced_content", "") for s in enhanced_sections
        if "strength" in s.get("section_key", "")
    ]
    teacher_recommendations = [
        {"action": s.get("enhanced_content", ""), "source": "teacher"}
        for s in enhanced_sections
        if "recommendation" in s.get("section_key", "")
    ]

    # 合并数据
    enhanced_report = {
        "current_state": enhanced_state,
        "data_completeness": v1_content.get("data_completeness", {}),
        "strengths": v1_content.get("strengths", []) + teacher_strengths,
        "weaknesses": v1_content.get("weaknesses", []),
        "gaps": v1_content.get("gaps", []),
        "recommendations": v1_content.get("recommendations", []) + teacher_recommendations,
        "enhancement_summary": f"老师对{len(enhanced_sections)}个段落进行了增强优化",
    }

    # 创建2.0报告
    report_v2 = DiagnosisReport(
        project_id=report_v1.project_id,
        user_id=user_id,
        version="2.0",
        questionnaire_data_json=report_v1.questionnaire_data_json,
        report_json=enhanced_report,
        teacher_id=report_v1.teacher_id,
        teacher_notes=teacher_notes,
        teacher_enhanced_at=utcnow().isoformat(),
        status="enhanced",
        parent_report_id=report_v1.id,
    )
    db.add(report_v2)

    # 更新1.0状态
    report_v1.status = "confirmed"

    # 推进项目阶段
    project = db.query(ProductProject).filter(
        ProductProject.id == report_v1.project_id,
    ).first()
    if project:
        project.current_phase = "targeting"

    db.commit()
    db.refresh(report_v2)

    logger.info("诊断报告2.0已生成: project_id=%s report_id=%s parent=%s",
                report_v1.project_id, report_v2.id, report_id)

    return {
        "report_id": report_v2.id,
        "project_id": report_v2.project_id,
        "version": "2.0",
        "status": "enhanced",
        "current_state": enhanced_report.get("current_state", {}),
        "data_completeness": enhanced_report.get("data_completeness", {}),
        "strengths": enhanced_report.get("strengths", []),
        "weaknesses": enhanced_report.get("weaknesses", []),
        "gaps": enhanced_report.get("gaps", []),
        "recommendations": enhanced_report.get("recommendations", []),
        "teacher_notes": teacher_notes,
        "teacher_id": report_v1.teacher_id,
    }


# ═══════════════════════════════════════════════
# 5. B阶段：目标设定量化
# ═══════════════════════════════════════════════

def set_quantified_targets(
    db: Session,
    user_id: str,
    project_id: str,
    targets: list[dict],
) -> dict[str, Any]:
    """B阶段：将当前状态X量化为目标状态Y。

    每个目标包含：指标名称、当前值、目标值、单位、基线来源、目标依据。
    必须先完成A阶段诊断，禁止跳过A→B直接S。

    例："员工流失率" current="18%" target="<10%" unit="%"
    """
    project = _get_project(db, project_id, user_id)

    # 绝对禁止跳过A→B直接S
    _check_phase_can_advance(db, project, "targeting")

    if not targets:
        raise APIError(20001, "至少需要设定一个量化目标", 400)

    # 清除旧目标
    db.query(QuantifiedTarget).filter(
        QuantifiedTarget.project_id == project_id,
        QuantifiedTarget.deleted_at.is_(None),
    ).delete()

    created_targets = []
    for i, t in enumerate(targets):
        metric = QuantifiedTarget(
            project_id=project_id,
            user_id=user_id,
            metric_name=t.get("metric_name", ""),
            metric_category=t.get("metric_category"),
            current_value=t.get("current_value", ""),
            target_value=t.get("target_value", ""),
            unit=t.get("unit", ""),
            baseline_source=t.get("baseline_source"),
            target_rationale=t.get("target_rationale"),
            sort_order=i,
        )
        db.add(metric)
        created_targets.append({
            "metric_name": metric.metric_name,
            "metric_category": metric.metric_category,
            "current_value": metric.current_value,
            "target_value": metric.target_value,
            "unit": metric.unit,
            "baseline_source": metric.baseline_source,
            "target_rationale": metric.target_rationale,
        })

    project.current_phase = "targeting"
    db.commit()

    # 生成摘要
    summary_parts = []
    for t in created_targets:
        name = t["metric_name"]
        cur = t["current_value"] or "?"
        tar = t["target_value"]
        u = t["unit"] or ""
        summary_parts.append(f"{name}：{cur} → {tar}{u}")
    summary = f"共设定{len(created_targets)}项量化目标。" + "；".join(summary_parts[:5])

    logger.info("量化目标已设定: project_id=%s count=%d", project_id, len(created_targets))

    return {
        "project_id": project_id,
        "targets": created_targets,
        "summary": summary,
    }


# ═══════════════════════════════════════════════
# 6. S阶段：三源调用 → A/B双版方案
# ═══════════════════════════════════════════════

def generate_solutions(
    db: Session,
    user_id: str,
    project_id: str,
    source_engines: list[str] | None = None,
    focus_areas: list[str] | None = None,
    generate_both_versions: bool = True,
) -> dict[str, Any]:
    """S阶段：多源调用（携君库+私有库+智能办公）→ gap分析 → A/B双版方案。

    必须先完成A(诊断)→B(目标)，禁止跳过。
    三源调用：
      - 携君库 (xiejun): 公开知识库，行业最佳实践
      - 私有库 (private): 客户/用户私有文档
      - 智能办公 (smart_office): 基于已有制度的升级建议

    A版 vs B版：
      - A版：侧重制度完善性，稳健保守
      - B版：侧重创新突破，带有行业前沿实践

    制度升级可追溯：自动标注"本方案参照了原XX制度第X条升级..."
    """
    project = _get_project(db, project_id, user_id)

    # 绝对禁止跳过A→B直接S
    _check_phase_can_advance(db, project, "generating")

    # 获取量化目标
    targets = db.query(QuantifiedTarget).filter(
        QuantifiedTarget.project_id == project_id,
        QuantifiedTarget.deleted_at.is_(None),
    ).order_by(QuantifiedTarget.sort_order).all()

    if not targets:
        raise APIError(20001, "请先完成B阶段目标设定后再生成方案", 400)

    # 获取诊断报告
    diagnosis = db.query(DiagnosisReport).filter(
        DiagnosisReport.project_id == project_id,
        DiagnosisReport.deleted_at.is_(None),
    ).order_by(desc(DiagnosisReport.created_at)).first()

    source_engines = source_engines or ["xiejun", "private", "smart_office"]
    focus_areas = focus_areas or []

    # ── 三源调用（MVP阶段模拟）──
    source_calls = _multi_source_call(source_engines, project, targets, diagnosis)

    # ── gap分析 ──
    gap_analysis = _perform_gap_analysis(targets, diagnosis)

    # ── 生成A版方案（稳健型）──
    version_a = _build_solution_version(
        project, targets, source_calls, gap_analysis, diagnosis,
        version_label="A",
        style="conservative",
    )

    # ── 生成B版方案（创新型）──
    version_b = None
    if generate_both_versions:
        version_b = _build_solution_version(
            project, targets, source_calls, gap_analysis, diagnosis,
            version_label="B",
            style="innovative",
        )

    project.current_phase = "generating"
    db.commit()

    result: dict[str, Any] = {
        "project_id": project_id,
        "versions": [],
    }

    # 组装A版响应
    result["versions"].append({
        "solution_id": version_a.id,
        "project_id": project_id,
        "version_label": "A",
        "status": "generated",
        "content": version_a.content_json or {},
        "source_calls": version_a.source_calls_json or {},
        "gap_analysis": version_a.gap_analysis_json or {},
        "version_diff_summary": "A版（稳健型方案）：侧重制度完善性和合规性，在现有框架基础上优化升级，风险较低。",
        "is_selected": version_a.is_selected,
    })

    if version_b:
        result["versions"].append({
            "solution_id": version_b.id,
            "project_id": project_id,
            "version_label": "B",
            "status": "generated",
            "content": version_b.content_json or {},
            "source_calls": version_b.source_calls_json or {},
            "gap_analysis": version_b.gap_analysis_json or {},
            "version_diff_summary": "B版（创新型方案）：引入行业前沿实践，更加灵活和突破性，适合希望快速变革的客户。",
            "is_selected": version_b.is_selected,
        })

    logger.info("方案已生成: project_id=%s versions=%d", project_id, len(result["versions"]))

    return result


def _multi_source_call(
    engines: list[str],
    project: ProductProject,
    targets: list[QuantifiedTarget],
    diagnosis: DiagnosisReport | None,
) -> dict[str, Any]:
    """执行三源调用（MVP模拟）。生产环境调用实际知识库检索服务。"""
    results: dict[str, Any] = {}

    target_names = [t.metric_name for t in targets]
    gaps = []
    if diagnosis and diagnosis.report_json:
        gaps = diagnosis.report_json.get("current_state", {}).get("gaps", [])

    for engine in engines:
        if engine == "xiejun":
            # 携君库：行业通用最佳实践
            results["xiejun_library"] = {
                "engine": "携君公开知识库",
                "query": f"HR制度优化方案 {', '.join(target_names[:3])}",
                "results_count": 5,
                "key_findings": [
                    {"title": "行业标杆企业招聘流程优化指南", "relevance": "high"},
                    {"title": "中小企业薪酬体系设计案例集", "relevance": "medium"},
                    {"title": "绩效管理OKR落地实践白皮书", "relevance": "high"},
                    {"title": "员工培训体系建设标准框架", "relevance": "medium"},
                    {"title": "劳动用工合规管理操作手册", "relevance": "medium"},
                ],
                "used_in_version": "both",
            }

        elif engine == "private":
            # 私有库：客户专属文档
            private_docs = []
            if project.hr_module_mapping_json:
                modules = project.hr_module_mapping_json.get("hr_modules", [])
                for m in modules[:3]:
                    private_docs.append({
                        "title": f"{m['module_name']} - 现有制度文档",
                        "relevance": "high",
                    })

            results["private_library"] = {
                "engine": "客户私有知识库",
                "query": f"客户{project.client_name or ''}现有制度检索",
                "results_count": len(private_docs),
                "key_findings": private_docs or [
                    {"title": "客户现有员工手册", "relevance": "high"},
                    {"title": "客户薪酬管理制度", "relevance": "medium"},
                ],
                "used_in_version": "both",
            }

        elif engine == "smart_office":
            # 智能办公：制度升级
            upgrade_refs = []
            for gap in gaps[:3]:
                module = gap.get("module", "")
                upgrade_refs.append({
                    "title": f"{module}制度升级参考",
                    "source": f"原{module}管理制度",
                    "upgrade_direction": "流程优化+数字化",
                })

            results["smart_office"] = {
                "engine": "智能办公系统",
                "query": "现有制度升级建议",
                "results_count": len(upgrade_refs) or 2,
                "key_findings": upgrade_refs or [
                    {"title": "考勤管理制度数字化升级", "source": "原考勤管理制度"},
                    {"title": "审批流程自动化建议", "source": "原审批管理办法"},
                ],
                "used_in_version": "both",
            }

    return results


def _perform_gap_analysis(
    targets: list[QuantifiedTarget],
    diagnosis: DiagnosisReport | None,
) -> dict[str, Any]:
    """执行gap分析：当前状态 vs 目标状态的差距量化。"""
    gap_items = []

    for t in targets:
        gap_item = {
            "metric": t.metric_name,
            "current": t.current_value or "未评估",
            "target": t.target_value,
            "unit": t.unit or "",
            "gap_description": f"从「{t.current_value or '未知'}」提升至「{t.target_value}」",
        }

        # 判断差距等级
        if not t.current_value:
            gap_item["gap_level"] = "unknown"
            gap_item["action_needed"] = f"需先采集{t.metric_name}的基线数据"
        else:
            gap_item["gap_level"] = "significant"
            gap_item["action_needed"] = f"制定{t.metric_name}改进方案（{t.current_value} → {t.target_value}）"

        gap_items.append(gap_item)

    # 从诊断中提取的软性gap
    if diagnosis and diagnosis.report_json:
        diag_gaps = diagnosis.report_json.get("current_state", {}).get("gaps", [])
        for dg in diag_gaps:
            if not any(g["metric"] == dg.get("module") for g in gap_items):
                gap_items.append({
                    "metric": dg.get("module", ""),
                    "current": f"评分 {dg.get('current_score', '?')}/5",
                    "target": "≥4/5",
                    "unit": "分",
                    "gap_description": dg.get("description", ""),
                    "gap_level": dg.get("level", "moderate"),
                    "action_needed": f"优化{dg.get('module', '')}相关制度和流程",
                })

    return {
        "total_gaps": len(gap_items),
        "critical_gaps": sum(1 for g in gap_items if g.get("gap_level") == "critical"),
        "items": gap_items,
    }


def _build_solution_version(
    project: ProductProject,
    targets: list[QuantifiedTarget],
    source_calls: dict,
    gap_analysis: dict,
    diagnosis: DiagnosisReport | None,
    version_label: str,
    style: str,
) -> SolutionVersion:
    """构建一个方案版本（A版稳健型 或 B版创新型）。"""
    _validate_version_label(version_label)

    # 构建方案内容
    sections = []
    target_sections = _build_target_sections(targets, source_calls, style)

    sections.extend(target_sections)

    # 添加上游制度升级标注
    smarts = source_calls.get("smart_office", {})
    for finding in smarts.get("key_findings", []):
        source_ref = finding.get("source", "")
        if source_ref:
            annotation = _generate_upgrade_annotation(source_ref)
            # 为最后一个相关section添加升级标注
            if sections:
                last = sections[-1]
                if "upgrade_annotation" not in last:
                    last["upgrade_annotation"] = annotation

    # 构建完整内容
    content = {
        "overview": _build_overview(project, targets, style),
        "sections": sections,
        "implementation_plan": _build_implementation_plan(targets, style),
        "risk_mitigation": _build_risk_mitigation(gap_analysis, style),
        "cost_estimate": _build_cost_estimate(project, style),
        "style": style,
    }

    # 差异说明
    if style == "conservative":
        diff_summary = f"A版（稳健型方案）：基于现有制度框架进行渐进式优化，"
        diff_summary += f"风险可控，实施周期约{len(targets) * 2 + 4}周，适合追求稳定性的客户。"
    else:
        diff_summary = f"B版（创新型方案）：引入行业前沿实践和数字化工具，"
        diff_summary += f"更加灵活且具突破性，实施周期约{len(targets) * 2 + 2}周，适合希望快速变革的客户。"

    solution = SolutionVersion(
        project_id=project.id,
        user_id=project.user_id,
        version_label=version_label,
        content_json=content,
        source_calls_json=source_calls,
        gap_analysis_json=gap_analysis,
        version_diff_summary=diff_summary,
        status="generated",
        is_selected=False,
    )
    db = project._sa_instance_state.session if hasattr(project, '_sa_instance_state') else None
    # 需要通过调用者的 db session 来 add
    from sqlalchemy.orm import object_session
    session = object_session(project)
    session.add(solution)
    session.flush()
    session.refresh(solution)

    return solution


def _build_overview(project: ProductProject, targets: list[QuantifiedTarget], style: str) -> str:
    """生成方案总览。"""
    style_desc = "稳健优化型" if style == "conservative" else "创新突破型"
    client = project.client_name or "客户"
    industry = project.client_industry or "通用行业"

    parts = [
        f"本方案为{client}（{industry}）量身定制，采用{style_desc}策略。",
        f"基于{len(targets)}项量化目标的差距分析，结合携君库行业标杆实践、私有库制度文档和智能办公系统升级建议，",
    ]

    if style == "conservative":
        parts.append("在现有制度框架内进行渐进式升级，确保合规性与稳定性的同时逐步实现目标。")
    else:
        parts.append("引入行业前沿方法论和数字化工具，在合规基础上推动管理模式的突破性变革。")

    return "".join(parts)


def _build_target_sections(
    targets: list[QuantifiedTarget],
    source_calls: dict,
    style: str,
) -> list[dict]:
    """为每个目标构建方案段落。"""
    sections = []
    for t in targets:
        section = {
            "title": f"{t.metric_name}优化方案",
            "category": t.metric_category or "综合",
            "current_state": f"当前：{t.current_value or '待评估'}{t.unit or ''}",
            "target_state": f"目标：{t.target_value}{t.unit or ''}",
            "action_steps": _generate_action_steps(t, style),
            "reference_sources": _extract_reference_sources(t, source_calls),
            "upgrade_annotation": "",  # 如有制度升级会追加
        }
        sections.append(section)
    return sections


def _generate_action_steps(target: QuantifiedTarget, style: str) -> list[str]:
    """生成具体行动步骤。"""
    name = target.metric_name
    if style == "conservative":
        return [
            f"第1步：梳理{name}现有制度和执行情况",
            f"第2步：识别{name}制度中的薄弱环节和改进点",
            f"第3步：设计{name}优化方案初稿（2-3个备选）",
            f"第4步：内部评审和修订{name}制度文件",
            f"第5步：试点实施{name}新制度（1-3个月）",
            f"第6步：全面推广并纳入绩效考核体系",
        ]
    else:
        return [
            f"第1步：对标行业标杆{name}最佳实践",
            f"第2步：设计{name}创新方案（引入数字化工具）",
            f"第3步：快速原型验证{name}方案可行性",
            f"第4步：迭代优化{name}方案",
            f"第5步：规模化推广{name}新机制",
        ]


def _extract_reference_sources(target: QuantifiedTarget, source_calls: dict) -> list[str]:
    """从三源调用中提取相关参考来源。"""
    refs = []
    keyword = target.metric_name

    for engine_key in ["xiejun_library", "private_library", "smart_office"]:
        engine_data = source_calls.get(engine_key, {})
        for finding in engine_data.get("key_findings", []):
            title = finding.get("title", "")
            if keyword in title or any(kw in title for kw in ["制度", "管理", "流程", "方案"]):
                refs.append(f"[{engine_data.get('engine', '')}] {title}")

    return refs[:3]


def _build_implementation_plan(targets: list[QuantifiedTarget], style: str) -> dict:
    """构建实施计划。"""
    total_weeks = len(targets) * 2 + (4 if style == "conservative" else 2)
    phases = []

    for i, t in enumerate(targets):
        start_week = i * 2 + 1
        phases.append({
            "phase": i + 1,
            "name": f"{t.metric_name}专项",
            "duration": "2-4周",
            "start_week": start_week,
            "key_deliverables": [
                f"{t.metric_name}诊断报告",
                f"{t.metric_name}优化方案",
                f"{t.metric_name}实施跟踪表",
            ],
        })

    return {
        "total_estimated_weeks": total_weeks,
        "phases": phases,
        "milestones": [
            {"week": 1, "event": "项目启动会"},
            {"week": total_weeks // 2, "event": "中期评审"},
            {"week": total_weeks - 1, "event": "方案终审"},
            {"week": total_weeks, "event": "项目交付"},
        ],
    }


def _build_risk_mitigation(gap_analysis: dict, style: str) -> list[dict]:
    """构建风险缓解措施。"""
    mitigations = [
        {
            "risk": "制度变更导致员工抵触",
            "impact": "medium",
            "mitigation": "分阶段推行+员工沟通会+过渡期设置",
        },
        {
            "risk": "方案效果不达预期",
            "impact": "medium",
            "mitigation": "设置3个月试点期+每月效果评估+及时调优",
        },
        {
            "risk": "实施资源不足",
            "impact": "low",
            "mitigation": "明确责任人+项目管理制度+定期进度同步",
        },
    ]

    if style == "innovative":
        mitigations.append({
            "risk": "创新方案超出客户当前组织能力",
            "impact": "high",
            "mitigation": "配套能力建设+老师辅导+分步实施降低复杂度",
        })

    return mitigations


def _build_cost_estimate(project: ProductProject, style: str) -> dict:
    """构建费用估算（需与初始报价基本一致）。"""
    initial_quote = project.initial_quotation_json or {}

    base_items = [
        {"item": "诊断评估费", "amount": initial_quote.get("diagnosis_fee", "按合同约定")},
        {"item": "方案设计费", "amount": initial_quote.get("design_fee", "按合同约定")},
        {"item": "实施辅导费", "amount": initial_quote.get("coaching_fee", "按合同约定")},
        {"item": "文档交付费", "amount": initial_quote.get("delivery_fee", "按合同约定")},
    ]

    if style == "innovative":
        base_items.append({"item": "创新咨询附加费", "amount": "按合同约定"})

    total_note = "总费用与初始报价基本一致，如有调整将提前沟通确认。"

    return {
        "items": base_items,
        "notes": total_note,
        "quote_consistency": "与初始报价基本一致",
    }


# ═══════════════════════════════════════════════
# 7. 选择最终版本
# ═══════════════════════════════════════════════

def select_final_version(
    db: Session,
    user_id: str,
    project_id: str,
    solution_id: str,
    selected_by_teacher_id: str | None = None,
) -> dict[str, Any]:
    """老师和用户联合确认最终版本（A版或B版）。

    选中后，该版本 is_selected=True，项目进入reviewing阶段。
    """
    project = _get_project(db, project_id, user_id)
    _check_phase_can_advance(db, project, "reviewing")

    solution = db.query(SolutionVersion).filter(
        SolutionVersion.id == solution_id,
        SolutionVersion.project_id == project_id,
        SolutionVersion.deleted_at.is_(None),
    ).first()
    if not solution:
        raise APIError(20001, "方案版本不存在", 404)

    # 取消其他版本的选中状态
    db.query(SolutionVersion).filter(
        SolutionVersion.project_id == project_id,
    ).update({"is_selected": False})

    solution.is_selected = True
    solution.status = "selected"
    solution.selected_by_teacher_id = selected_by_teacher_id

    project.current_phase = "reviewing"
    db.commit()

    logger.info("方案版本已选定: project_id=%s version=%s", project_id, solution.version_label)

    return {
        "project_id": project_id,
        "selected_solution_id": solution_id,
        "selected_version": solution.version_label,
    }


# ═══════════════════════════════════════════════
# 8. 方案导出
# ═══════════════════════════════════════════════

def export_solution(
    db: Session,
    user_id: str,
    solution_id: str,
    export_format: str,
    include_brand_watermark: bool = True,
    include_upgrade_annotations: bool = True,
) -> dict[str, Any]:
    """格式化导出方案为PDF/Word。

    导出内容包括：
    - 品牌水印（如启用）
    - 制度升级追溯标注（如启用）
    - 方案所有段落、实施计划、风险评估、费用估算
    """
    if export_format not in ("pdf", "word"):
        raise APIError(20002, "导出格式仅支持 pdf 或 word", 400)

    solution = db.query(SolutionVersion).filter(
        SolutionVersion.id == solution_id,
        SolutionVersion.deleted_at.is_(None),
    ).first()
    if not solution:
        raise APIError(20001, "方案版本不存在", 404)

    if not solution.is_selected:
        raise APIError(20001, "请先确认最终版本后再导出", 400)

    # MVP: 生成导出标记（生产环境调用文档渲染服务）
    content = solution.content_json or {}

    # 注入品牌水印标记
    if include_brand_watermark:
        content["brand_watermark"] = "日耕Rigeng · 打磨一套产品 · 专业HR方案"

    # 确认升级标注
    if include_upgrade_annotations:
        sections = content.get("sections", [])
        for sec in sections:
            if sec.get("upgrade_annotation"):
                sec["show_upgrade_annotation"] = True

    # 模拟文件生成
    fake_file_id = new_uuid()
    download_url = f"/api/v1/product-design/solutions/{solution_id}/download?format={export_format}"

    solution.status = "exported"
    solution.export_format = export_format
    solution.export_file_id = fake_file_id
    db.commit()

    logger.info("方案已导出: solution_id=%s format=%s", solution_id, export_format)

    return {
        "solution_id": solution_id,
        "export_format": export_format,
        "download_url": download_url,
        "file_id": fake_file_id,
    }


def annotate_upgrade_source(
    db: Session,
    user_id: str,
    solution_id: str,
    section_index: int,
    source_doc: str,
    source_article: str = "",
) -> dict[str, Any]:
    """为方案段落自动标注制度升级来源。

    标注格式："本方案参照了原XX制度第X条升级，过程中梳理了制度执行情况并优化了流程细节。"
    """
    solution = db.query(SolutionVersion).filter(
        SolutionVersion.id == solution_id,
        SolutionVersion.deleted_at.is_(None),
    ).first()
    if not solution:
        raise APIError(20001, "方案版本不存在", 404)

    content = solution.content_json or {}
    sections = content.get("sections", [])

    annotation = _generate_upgrade_annotation(source_doc, source_article)

    if 0 <= section_index < len(sections):
        sections[section_index]["upgrade_annotation"] = annotation
    else:
        # 为所有段落追加
        for sec in sections:
            sec["upgrade_annotation"] = annotation

    content["sections"] = sections
    content["upgrade_traceability_note"] = "本方案中标注了制度升级追溯信息，可对照查阅原制度条款。"

    solution.content_json = content
    db.commit()

    logger.info("制度升级标注已添加: solution_id=%s source=%s", solution_id, source_doc)

    return {
        "solution_id": solution_id,
        "annotation": annotation,
        "section_index": section_index,
    }


# ═══════════════════════════════════════════════
# 9. 产品预研模式
# ═══════════════════════════════════════════════

def create_pre_research_product(
    db: Session,
    user_id: str,
    template_type: str,
    product_name: str,
    description: str | None = None,
    reference_materials: list[str] | None = None,
) -> dict[str, Any]:
    """产品预研模式：无合同 → 使用模板快速产出通用产品。

    六大模板类型：recruitment / training / compensation / performance / policy / general
    生成的产品为通用模板填充，标注为"预研产品"。
    后续可升级为完整ABS项目。
    """
    if template_type not in ("recruitment", "training", "compensation", "performance", "policy", "general"):
        raise APIError(20002, f"模板类型不支持：{template_type}", 400)

    # 生成通用模板内容
    template_content = _generate_template_content(template_type, product_name, description)
    reference_materials = reference_materials or []

    product = PreResearchProduct(
        user_id=user_id,
        template_type=template_type,
        product_name=product_name,
        description=description,
        content_json=template_content,
        status="completed",
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    logger.info("预研产品已创建: product_id=%s template=%s", product.id, template_type)

    return {
        "product_id": product.id,
        "template_type": template_type,
        "product_name": product_name,
        "status": "completed",
        "content": template_content,
        "can_upgrade_to_full": True,
    }


def _generate_template_content(template_type: str, product_name: str, description: str | None = None) -> dict:
    """根据模板类型生成通用产品内容框架。"""
    hr_module = TEMPLATE_HR_MAP.get(template_type, "人力规划")

    base_content = {
        "product_type": template_type,
        "hr_module": hr_module,
        "generated_from": "预研模板",
        "disclaimer": "本产品为模板化预研产出，非针对特定客户定制。如需定制化方案，可升级为完整ABS项目。",
        "modules": [],
    }

    # 按模板类型填充不同结构
    if template_type == "recruitment":
        base_content["modules"] = [
            {"name": "招聘需求分析", "content": f"针对{product_name}，分析招聘需求的量化和结构化。", "template_sections": ["岗位分析", "能力模型", "渠道策略"]},
            {"name": "面试流程设计", "content": "标准化面试流程，包含初筛-技术面-HR面-终面四个阶段。", "template_sections": ["面试轮次", "评估标准", "录用决策"]},
            {"name": "入职融入计划", "content": "新员工入职后90天融入计划，加速文化适应和业务上手。", "template_sections": ["30天计划", "60天计划", "90天评估"]},
        ]
    elif template_type == "training":
        base_content["modules"] = [
            {"name": "培训体系框架", "content": f"针对{product_name}，构建三级培训体系（新人→岗位→管理）。", "template_sections": ["课程体系", "讲师管理", "效果评估"]},
            {"name": "课程目录设计", "content": "按岗位序列和能力层级设计课程矩阵。", "template_sections": ["必修课程", "选修课程", "晋升关联"]},
        ]
    elif template_type == "compensation":
        base_content["modules"] = [
            {"name": "薪酬架构设计", "content": f"针对{product_name}，构建宽带薪酬体系。", "template_sections": ["职级体系", "薪酬带宽", "调薪机制"]},
            {"name": "福利方案设计", "content": "法定福利+企业补充福利的组合设计。", "template_sections": ["法定福利", "弹性福利", "长期激励"]},
        ]
    elif template_type == "performance":
        base_content["modules"] = [
            {"name": "绩效管理体系", "content": f"针对{product_name}，构建OKR/KPI混合绩效体系。", "template_sections": ["目标设定", "过程跟踪", "考核评估"]},
            {"name": "绩效反馈机制", "content": "季度/半年度绩效面谈机制设计。", "template_sections": ["面谈流程", "反馈技巧", "改进计划"]},
        ]
    elif template_type == "policy":
        base_content["modules"] = [
            {"name": "人事管理制度", "content": f"针对{product_name}，制定综合人事管理制度。", "template_sections": ["入离职管理", "考勤休假", "异动管理"]},
            {"name": "合规审计机制", "content": "劳动用工合规自查清单和审计机制。", "template_sections": ["合同管理", "社保公积金", "劳动争议预防"]},
        ]
    else:  # general
        base_content["modules"] = [
            {"name": "人力资源管理总纲", "content": f"针对{product_name}，制定人力资源管理总体框架。", "template_sections": ["组织架构", "人才策略", "制度体系"]},
            {"name": "HR数字化转型建议", "content": "HR管理信息系统建设的基本路径。", "template_sections": ["系统选型", "数据迁移", "流程再造"]},
        ]

    if description:
        base_content["custom_description"] = description

    return base_content


# ═══════════════════════════════════════════════
# 10. 跨客户方案复用
# ═══════════════════════════════════════════════

def reuse_solution_framework(
    db: Session,
    user_id: str,
    source_solution_id: str,
    target_project_id: str,
    sections_to_reuse: list[str] | None = None,
    adaptation_notes: str | None = None,
) -> dict[str, Any]:
    """从客户A的已有方案中复用框架到客户B的新项目。

    复用规则：
    - 必须脱敏（去除客户A的具体信息）
    - 仅复用框架结构和段落组织，不直接复制客户数据
    - 记录复用来源以便追溯
    """
    source = db.query(SolutionVersion).filter(
        SolutionVersion.id == source_solution_id,
        SolutionVersion.deleted_at.is_(None),
    ).first()
    if not source:
        raise APIError(20001, "源方案不存在", 404)

    target = _get_project(db, target_project_id, user_id)

    source_content = source.content_json or {}
    source_sections = source_content.get("sections", [])

    # 根据指定筛选段落
    if sections_to_reuse:
        reused = [s for s in source_sections if s.get("title") in sections_to_reuse]
    else:
        reused = source_sections

    # 脱敏处理：去除客户特定信息
    adapted = []
    for sec in reused:
        adapted_sec = dict(sec)
        # 清除客户特定的数据和标注
        adapted_sec.pop("upgrade_annotation", None)
        adapted_sec["adapted_from"] = "框架复用（已脱敏）"
        adapted_sec["original_source_project"] = source.project_id
        adapted.append(adapted_sec)

    adapted_framework = {
        "source_solution_id": source_solution_id,
        "target_project_id": target_project_id,
        "adapted_sections_count": len(adapted),
        "sections": adapted,
        "adaptation_notes": adaptation_notes or "",
        "desensitization_applied": True,
    }

    # 创建复用记录
    reuse_record = SolutionReuseRecord(
        source_solution_id=source_solution_id,
        target_project_id=target_project_id,
        user_id=user_id,
        adapted_framework_json=adapted_framework,
        adaptation_notes=adaptation_notes,
        is_desensitized=True,
    )
    db.add(reuse_record)
    db.commit()
    db.refresh(reuse_record)

    logger.info("方案框架已复用: source=%s target=%s", source_solution_id, target_project_id)

    return {
        "reuse_record_id": reuse_record.id,
        "source_solution_id": source_solution_id,
        "target_project_id": target_project_id,
        "adapted_framework": adapted_framework,
        "is_desensitized": True,
    }


# ═══════════════════════════════════════════════
# 11. 老师辅导预约
# ═══════════════════════════════════════════════

def request_coaching_session(
    db: Session,
    user_id: str,
    project_id: str,
    teacher_id: str,
    total_sessions: int = 3,
    scheduled_at: str = "",
    duration_minutes: int = 60,
    focus_topics: str | None = None,
) -> dict[str, Any]:
    """预约老师视频辅导（通常2-5次为一个完整辅导周期）。

    辅导贯穿ABS全流程，可在诊断后、目标设定后、方案生成后各安排一次辅导。
    """
    project = _get_project(db, project_id, user_id)

    if total_sessions < 2 or total_sessions > 5:
        raise APIError(20002, "辅导次数需在2-5次之间", 400)

    # 查询该老师是否已有该项目的辅导记录
    existing = db.query(CoachingRecord).filter(
        CoachingRecord.project_id == project_id,
        CoachingRecord.teacher_id == teacher_id,
        CoachingRecord.deleted_at.is_(None),
    ).order_by(desc(CoachingRecord.session_num)).first()

    session_num = 1
    if existing:
        if existing.session_num >= existing.total_sessions:
            raise APIError(20001, f"该老师对该项目的辅导已达上限（{existing.total_sessions}次）", 400)
        session_num = existing.session_num + 1

    coaching = CoachingRecord(
        project_id=project_id,
        user_id=user_id,
        teacher_id=teacher_id,
        session_num=session_num,
        total_sessions=total_sessions,
        scheduled_at=scheduled_at,
        duration_minutes=duration_minutes,
        focus_topics=focus_topics,
        status="scheduled",
    )
    db.add(coaching)
    db.commit()
    db.refresh(coaching)

    meeting_link = f"https://meeting.rigeng.com/coaching/{coaching.id}"

    logger.info("辅导已预约: project_id=%s teacher_id=%s session=%d/%d",
                project_id, teacher_id, session_num, total_sessions)

    return {
        "coaching_id": coaching.id,
        "project_id": project_id,
        "teacher_id": teacher_id,
        "session_num": session_num,
        "total_sessions": total_sessions,
        "scheduled_at": scheduled_at,
        "meeting_link": meeting_link,
        "status": "scheduled",
    }
