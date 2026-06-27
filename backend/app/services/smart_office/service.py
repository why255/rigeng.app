"""智能办公服务 — 核心业务逻辑（步骤19）。

双库架构：
  工具库 (Tool Library): HR八大模块单点智能文档生成
  体系库 (System Library): 战略解码→模块搭建的6步闭环

调用链：
  工具库/体系库 → ②知识库（三源检索） + ③AI引擎（文档生成）
  文档确认 → ②知识库（归档入库）
  草稿 → 本地缓存（30天自动清理）
  制度比对 → 文本差异分析
  协作 → ⑥消息推送（邀请通知）

设计原则：
  - 双库全部可见，不按职级隐藏
  - 文档生成三源：私有库 + 携君库 + 互联网
  - 3次免费重生成后引导联系老师
  - 用户上传制度仅存储私有库，不用于模型训练
  - 品牌标识可关闭
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, desc, func
from sqlalchemy.orm import Session

from ...shared.database import new_uuid, utcnow
from ...shared.errors import (
    APIError, E_PARAM_FORMAT, E_DOC_NOT_FOUND, E_NO_PERMISSION,
    E_QUOTA_EXCEEDED, E_SEARCH_EMPTY,
)
from ...shared.models.office import (
    HR_MODULE_KEYS, DOC_TYPES, DOC_STATUSES, BUILD_STATUSES,
    OfficeDocument, SystemBuildState, OfficeDraft, DocumentVersion, PolicyUpload,
)

logger = logging.getLogger("smart_office")

# ── 常量 ──
MAX_FREE_REGENERATE = 3  # 免费重生成上限
DRAFT_RETENTION_DAYS = 30  # 草稿保留天数

# 6步体系闭环定义
SYSTEM_STEPS: list[dict[str, str]] = [
    {
        "step_num": 1,
        "step_title": "战略输入",
        "question": "请输入贵公司未来3-5年的战略目标（可从年度战略规划中摘录关键目标），例如：营收目标、市场份额、区域扩展、数字化转型方向等。",
        "hint": "建议包括定量目标（如营收X亿）和定性目标（如成为行业TOP3），越具体越好。",
        "example_answer": "未来3年实现营收突破5亿，市场份额提升至15%，完成数字化转型，建立覆盖全国的销售网络。",
    },
    {
        "step_num": 2,
        "step_title": "战略萃取",
        "question": "基于上一步的战略目标，请提炼贵公司的核心竞争力与关键成功要素。例如：技术壁垒、品牌优势、渠道能力、人才储备等。",
        "hint": "从资源、能力、市场三个维度提炼，核心竞争力应具有稀缺性和难以复制性。",
        "example_answer": "核心竞争力：1)自主研发的AI算法专利池；2)覆盖300+城市的渠道网络；3)行业头部客户资源。关键成功要素：技术迭代速度、客户服务质量、组织敏捷性。",
    },
    {
        "step_num": 3,
        "step_title": "战略解码",
        "question": "请将战略目标转化为具体的人力资源战略主题。例如：从'数字化转型'可以解码为'数字化人才梯队建设'和'技术人才培养体系'。请为每个战略目标对应1-2个HR战略主题。",
        "hint": "战略解码的关键是找到'战略→组织能力→HR举措'的因果链。每个HR战略主题应可落地、可衡量。",
        "example_answer": "1)营收突破5亿→销售团队扩建与激励机制升级；2)数字化转型→数字化人才引进与技术培训体系建设；3)市场份额提升→雇主品牌建设与行业领军人才引进。",
    },
    {
        "step_num": 4,
        "step_title": "人资规划",
        "question": "基于HR战略主题，请制定具体的人力资源行动计划，包括：人才需求预测、编制规划、关键岗位配置、预算估算等。请尽可能量化。",
        "hint": "按年度/季度拆解，包括招聘计划、培训计划、组织调整、预算分配等维度。",
        "example_answer": "2025年HR行动计划：Q1-完成核心技术团队扩建（+15人），启动销售培训体系升级；Q2-实施新的绩效激励方案，覆盖全员；Q3-雇主品牌专项推广；全年HR预算约800万。",
    },
    {
        "step_num": 5,
        "step_title": "模块搭建",
        "question": "现在进入具体HR模块的制度设计。请选择当前最需要搭建的模块（可选多个），并对每个模块描述制度框架的初步构想。八大模块：战略解码/人资规划/招聘配置/培训开发/薪酬福利/绩效管理/员工关系/企业文化。",
        "hint": "请说明各模块的核心制度要点、关键流程、责任分工。可引用前述步骤的决策作为输入。",
        "example_answer": "优先搭建：1)招聘配置-建立基于胜任力模型的面试评估体系；2)绩效管理-引入OKR+KPI混合考核模式；3)培训开发-三级培训体系（新人/岗位/领导力）。",
    },
    {
        "step_num": 6,
        "step_title": "制度比对升级",
        "question": "最后一步：如果您有现有的制度文件，可以上传进行比对；系统将标注差异并给出升级建议。如果没有现有文件，系统将基于前述步骤生成完整的制度框架。是否已准备好进行最后的确认和文档生成？",
        "hint": "可在此步上传现有制度文件（Word/PDF/文本），系统会自动对比并标注：缺失项、冲突项、可优化项。",
        "example_answer": "已准备好，请生成完整的HR制度框架文档。我会在生成后上传现有的薪酬制度进行比对。",
    },
]

# HR八大模块定义
HR_MODULES: list[dict[str, Any]] = [
    {
        "module_key": "strategy_decode",
        "module_name": "战略解码",
        "description": "将企业战略转化为人力资源战略目标和行动路径",
        "icon": "mdi:strategy",
        "color": "#6B8FBF",
        "tools": [
            {"tool_key": "strategy_map", "title": "战略地图", "description": "生成BSC四维度战略地图", "icon": "mdi:map", "doc_template": "strategy_map"},
            {"tool_key": "swot_analysis", "title": "SWOT分析", "description": "生成结构化SWOT分析报告", "icon": "mdi:grid", "doc_template": "swot_analysis"},
            {"tool_key": "kpi_tree", "title": "KPI分解树", "description": "从战略目标逐级分解到部门KPI", "icon": "mdi:graph-outline", "doc_template": "kpi_tree"},
        ],
    },
    {
        "module_key": "hr_planning",
        "module_name": "人资规划",
        "description": "人力资源需求预测、编制规划与成本预算",
        "icon": "mdi:account-group",
        "color": "#D4A574",
        "tools": [
            {"tool_key": "demand_forecast", "title": "人才需求预测", "description": "基于业务增长预测人员需求", "icon": "mdi:chart-line", "doc_template": "demand_forecast"},
            {"tool_key": "org_chart", "title": "组织架构图", "description": "生成部门组织架构与编制方案", "icon": "mdi:family-tree", "doc_template": "org_chart"},
            {"tool_key": "budget_plan", "title": "HR预算方案", "description": "生成年度人力资源预算计划", "icon": "mdi:cash-multiple", "doc_template": "budget_plan"},
            {"tool_key": "succession_plan", "title": "继任者计划", "description": "关键岗位继任规划方案", "icon": "mdi:swap-horizontal-bold", "doc_template": "succession_plan"},
        ],
    },
    {
        "module_key": "recruitment",
        "module_name": "招聘配置",
        "description": "招聘流程管理、人才画像与面试评估体系",
        "icon": "mdi:account-search",
        "color": "#6B8F6B",
        "tools": [
            {"tool_key": "jd_generator", "title": "JD生成器", "description": "AI生成标准岗位说明书", "icon": "mdi:file-document-edit", "doc_template": "jd_template"},
            {"tool_key": "interview_guide", "title": "面试指引", "description": "基于胜任力模型的面试评估表", "icon": "mdi:clipboard-text", "doc_template": "interview_guide"},
            {"tool_key": "onboarding_plan", "title": "入职方案", "description": "新员工90天入职融入计划", "icon": "mdi:account-plus", "doc_template": "onboarding_plan"},
        ],
    },
    {
        "module_key": "training_dev",
        "module_name": "培训开发",
        "description": "培训体系设计、课程规划与人才发展路径",
        "icon": "mdi:school",
        "color": "#E8A94D",
        "tools": [
            {"tool_key": "training_system", "title": "培训体系方案", "description": "三级培训体系设计（新人/岗位/领导力）", "icon": "mdi:stairs", "doc_template": "training_system"},
            {"tool_key": "course_catalog", "title": "课程目录", "description": "年度培训课程规划", "icon": "mdi:book-open-page-variant", "doc_template": "course_catalog"},
            {"tool_key": "career_path", "title": "职业发展路径", "description": "双通道职业发展体系设计", "icon": "mdi:sign-direction", "doc_template": "career_path"},
        ],
    },
    {
        "module_key": "compensation",
        "module_name": "薪酬福利",
        "description": "薪酬结构设计、福利方案与长期激励机制",
        "icon": "mdi:cash",
        "color": "#BC6B8F",
        "tools": [
            {"tool_key": "salary_structure", "title": "薪酬结构设计", "description": "岗位职级薪酬带宽方案", "icon": "mdi:chart-bar", "doc_template": "salary_structure"},
            {"tool_key": "bonus_scheme", "title": "奖金方案", "description": "年终奖与项目奖金分配方案", "icon": "mdi:gift", "doc_template": "bonus_scheme"},
            {"tool_key": "benefit_package", "title": "福利包设计", "description": "弹性福利方案设计", "icon": "mdi:package-variant", "doc_template": "benefit_package"},
        ],
    },
    {
        "module_key": "performance",
        "module_name": "绩效管理",
        "description": "绩效考核体系、OKR/KPI设计与评估反馈机制",
        "icon": "mdi:chart-bubble",
        "color": "#8F6BBF",
        "tools": [
            {"tool_key": "okr_framework", "title": "OKR框架", "description": "公司级→部门级→个人级OKR模板", "icon": "mdi:target", "doc_template": "okr_framework"},
            {"tool_key": "kpi_sheet", "title": "KPI考核表", "description": "岗位KPI指标库与考核方案", "icon": "mdi:table-check", "doc_template": "kpi_sheet"},
            {"tool_key": "review_template", "title": "绩效面谈指引", "description": "绩效反馈面谈SOP与记录模板", "icon": "mdi:chat-processing", "doc_template": "review_template"},
        ],
    },
    {
        "module_key": "employee_relations",
        "module_name": "员工关系",
        "description": "劳动合同管理、员工关怀与劳动关系合规",
        "icon": "mdi:handshake",
        "color": "#6BA4B8",
        "tools": [
            {"tool_key": "contract_template", "title": "合同模板", "description": "标准劳动合同与补充协议模板", "icon": "mdi:file-sign", "doc_template": "contract_template"},
            {"tool_key": "handbook", "title": "员工手册", "description": "公司员工手册范本", "icon": "mdi:book", "doc_template": "handbook"},
            {"tool_key": "exit_procedure", "title": "离职流程", "description": "标准化离职手续与交接清单", "icon": "mdi:logout", "doc_template": "exit_procedure"},
        ],
    },
    {
        "module_key": "corp_culture",
        "module_name": "企业文化",
        "description": "企业文化建设、价值观落地与员工活动策划",
        "icon": "mdi:home-heart",
        "color": "#D46B6B",
        "tools": [
            {"tool_key": "culture_manual", "title": "企业文化手册", "description": "使命愿景价值观落地手册", "icon": "mdi:heart", "doc_template": "culture_manual"},
            {"tool_key": "team_building", "title": "团建方案", "description": "年度团建活动策划方案", "icon": "mdi:account-group-outline", "doc_template": "team_building"},
            {"tool_key": "recognition_program", "title": "员工认可计划", "description": "即时激励与年度评优方案", "icon": "mdi:trophy", "doc_template": "recognition_program"},
        ],
    },
]


# ═══════════════════════════════════════════════
# 工具库
# ═══════════════════════════════════════════════

def list_hr_modules() -> dict[str, Any]:
    """列出HR八大模块及其工具卡片。双库全部可见，不按职级隐藏。"""
    return {
        "modules": [
            {
                "module_key": m["module_key"],
                "module_name": m["module_name"],
                "description": m["description"],
                "icon": m["icon"],
                "color": m["color"],
                "tools": m["tools"],
            }
            for m in HR_MODULES
        ],
    }


def get_module_tools(module_key: str) -> dict[str, Any]:
    """获取指定HR模块的工具列表。"""
    for m in HR_MODULES:
        if m["module_key"] == module_key:
            return {
                "module_key": m["module_key"],
                "module_name": m["module_name"],
                "description": m["description"],
                "icon": m["icon"],
                "color": m["color"],
                "tools": m["tools"],
            }
    raise APIError(E_PARAM_FORMAT.code, f"未知的HR模块: {module_key}", 400)


# ═══════════════════════════════════════════════
# 体系库：6步搭建
# ═══════════════════════════════════════════════

def start_system_build(db: Session, user_id: str, project_title: str) -> dict[str, Any]:
    """开始6步体系搭建。创建 SystemBuildState，返回第1步引导问题。"""
    # 构建步骤数据
    step_data = {}
    steps = []
    for s in SYSTEM_STEPS:
        step_data[str(s["step_num"])] = {
            "question": s["question"],
            "answer": None,
            "hint": s.get("hint", ""),
            "example_answer": s.get("example_answer", ""),
            "completed": False,
        }
        steps.append({
            "step_num": s["step_num"],
            "step_title": s["step_title"],
            "question": s["question"],
            "hint": s.get("hint", ""),
            "example_answer": s.get("example_answer", ""),
            "completed": False,
        })

    build = SystemBuildState(
        user_id=user_id,
        title=project_title,
        current_step=1,
        step_data_json=step_data,
        status="in_progress",
    )
    db.add(build)
    db.commit()
    db.refresh(build)

    logger.info("体系搭建已开始: build_id=%s project=%s", build.id, project_title)

    return {
        "build_id": build.id,
        "project_title": project_title,
        "current_step": 1,
        "status": "in_progress",
        "steps": steps,
    }


def continue_build_step(db: Session, user_id: str, build_id: str, step_num: int,
                         answer: str) -> dict[str, Any]:
    """提交当前步骤的答案，推进到下一步（或完成）。"""
    build = db.query(SystemBuildState).filter(
        SystemBuildState.id == build_id,
        SystemBuildState.user_id == user_id,
        SystemBuildState.deleted_at.is_(None),
    ).first()
    if not build:
        raise APIError(E_DOC_NOT_FOUND.code, "体系搭建记录不存在", 404)

    if build.current_step != step_num:
        raise APIError(E_PARAM_FORMAT.code,
                       f"当前步骤为{build.current_step}，不能提交步骤{step_num}", 400)

    if build.status == "completed":
        raise APIError(E_PARAM_FORMAT.code, "该体系搭建已完成，不可继续编辑", 400)

    # 保存答案
    step_data = build.step_data_json or {}
    step_key = str(step_num)
    if step_key in step_data:
        step_data[step_key]["answer"] = answer
        step_data[step_key]["completed"] = True

    # 判断是否最后一步
    is_final = step_num >= 6

    if is_final:
        build.status = "completed"
        build.completed_at = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
        next_step = None
    else:
        build.current_step = step_num + 1
        next_step = step_num + 1

    build.step_data_json = step_data
    db.commit()
    db.refresh(build)

    # 构造响应
    step_info = SYSTEM_STEPS[step_num - 1] if step_num <= len(SYSTEM_STEPS) else {}
    next_step_info = SYSTEM_STEPS[next_step - 1] if next_step and next_step <= len(SYSTEM_STEPS) else {}

    return {
        "build_id": build.id,
        "step_num": step_num,
        "completed": True,
        "next_step": next_step,
        "is_final": is_final,
        "step_title": step_info.get("step_title", ""),
    }


def get_build_state(db: Session, user_id: str, build_id: str) -> dict[str, Any]:
    """获取体系搭建当前状态。"""
    build = db.query(SystemBuildState).filter(
        SystemBuildState.id == build_id,
        SystemBuildState.user_id == user_id,
        SystemBuildState.deleted_at.is_(None),
    ).first()
    if not build:
        raise APIError(E_DOC_NOT_FOUND.code, "体系搭建记录不存在", 404)

    step_data = build.step_data_json or {}
    steps = []
    for s in SYSTEM_STEPS:
        key = str(s["step_num"])
        data = step_data.get(key, {})
        steps.append({
            "step_num": s["step_num"],
            "step_title": s["step_title"],
            "question": s["question"],
            "hint": s.get("hint", ""),
            "example_answer": s.get("example_answer", ""),
            "answer": data.get("answer"),
            "completed": data.get("completed", False),
        })

    return {
        "build_id": build.id,
        "project_title": build.title or "",
        "current_step": build.current_step,
        "status": build.status,
        "steps": steps,
        "completed_at": build.completed_at,
    }


def list_builds(db: Session, user_id: str) -> list[dict[str, Any]]:
    """列出用户的所有体系搭建记录。"""
    builds = (
        db.query(SystemBuildState)
        .filter(
            SystemBuildState.user_id == user_id,
            SystemBuildState.deleted_at.is_(None),
        )
        .order_by(desc(SystemBuildState.created_at))
        .limit(50)
        .all()
    )
    return [
        {
            "build_id": b.id,
            "project_title": b.title or "",
            "current_step": b.current_step,
            "status": b.status,
            "created_at": b.created_at.isoformat() if b.created_at else "",
            "completed_at": b.completed_at,
        }
        for b in builds
    ]


# ═══════════════════════════════════════════════
# 文档生成（三源调用）
# ═══════════════════════════════════════════════

def generate_document(db: Session, user_id: str, module_key: str, doc_type: str,
                      tool_key: str | None = None, build_id: str | None = None,
                      custom_prompt: str | None = None,
                      brand_logo_visible: bool = True) -> dict[str, Any]:
    """AI生成文档（三源：私有库+携君库+互联网）。

    生产环境流程：
      1. 检索私有库（②知识库服务）
      2. 检索携君库（②知识库服务）
      3. 补充互联网常识（③AI引擎）
      4. 结构化组装文档

    MVP阶段：基于模块和工具类型生成结构化模板文档。
    """
    # 校验模块
    module = None
    for m in HR_MODULES:
        if m["module_key"] == module_key:
            module = m
            break
    if not module:
        raise APIError(E_PARAM_FORMAT.code, f"未知的HR模块: {module_key}", 400)

    # 确定资源标签
    module_name = module["module_name"]

    # 确定工具名称
    tool_title = ""
    if tool_key and doc_type == "tool":
        for t in module.get("tools", []):
            if t["tool_key"] == tool_key:
                tool_title = t["title"]
                break

    # 如果来自体系库，获取体系搭建数据
    build_context = ""
    if build_id and doc_type == "system":
        build = db.query(SystemBuildState).filter(
            SystemBuildState.id == build_id,
            SystemBuildState.user_id == user_id,
            SystemBuildState.deleted_at.is_(None),
        ).first()
        if build and build.step_data_json:
            for step_num in range(1, 7):
                data = build.step_data_json.get(str(step_num), {})
                answer = data.get("answer", "")
                if answer:
                    step_title = SYSTEM_STEPS[step_num - 1]["step_title"] if step_num <= 6 else f"步骤{step_num}"
                    build_context += f"\n【{step_title}】{answer}\n"

    # MVP：基于模块生成结构化文档
    doc_title = f"{module_name} - {tool_title}" if tool_title else f"{module_name}体系搭建文档"

    content = _generate_mock_document(module_key, module_name, tool_key, tool_title,
                                       doc_type, build_context, custom_prompt)

    # 检查用户该文档的生成次数（重生成计数）
    existing_doc = None
    if build_id:
        existing_doc = db.query(OfficeDocument).filter(
            OfficeDocument.user_id == user_id,
            OfficeDocument.module_key == module_key,
            OfficeDocument.doc_type == doc_type,
            OfficeDocument.status.in_(["draft", "generated"]),
            OfficeDocument.deleted_at.is_(None),
        ).order_by(desc(OfficeDocument.created_at)).first()

    regenerate_count = (existing_doc.regenerate_count + 1) if existing_doc else 0

    # 3次免费重生成后引导联系老师
    if regenerate_count > MAX_FREE_REGENERATE:
        # 仍然生成，但标记需要引导
        logger.warning("用户%s已用尽免费重生成次数（%d次），引导联系老师",
                       user_id, regenerate_count)

    # 创建文档记录
    doc = OfficeDocument(
        user_id=user_id,
        title=doc_title,
        module_key=module_key,
        doc_type=doc_type,
        content_json={
            "title": doc_title,
            "sections": content,
            "source_tags": ["私有库", "携君库", "互联网"],
            "brand_logo_visible": brand_logo_visible,
            "build_context": build_context,
            "custom_prompt": custom_prompt,
        },
        status="generated",
        version=1,
        regenerate_count=regenerate_count,
        brand_logo_visible=brand_logo_visible,
    )
    db.add(doc)
    db.flush()

    # 创建初始版本记录
    version = DocumentVersion(
        doc_id=doc.id,
        version_num=1,
        content_json=doc.content_json,
        created_by=user_id,
    )
    db.add(version)
    db.commit()
    db.refresh(doc)

    logger.info("文档已生成: doc_id=%s module=%s type=%s regenerate=%d",
                doc.id, module_key, doc_type, regenerate_count)

    result_sections = [
        {"heading": s["heading"], "body": s["body"], "level": s.get("level", 1)}
        for s in content
    ]

    return {
        "doc_id": doc.id,
        "title": doc_title,
        "module_key": module_key,
        "doc_type": doc_type,
        "content": result_sections,
        "source_tags": ["私有库", "携君库", "互联网"],
        "regenerate_count": regenerate_count,
        "brand_logo_visible": brand_logo_visible,
    }


def _generate_mock_document(module_key: str, module_name: str, tool_key: str | None,
                             tool_title: str, doc_type: str, build_context: str,
                             custom_prompt: str | None) -> list[dict]:
    """MVP阶段：基于HR模块生成结构化文档模板。

    生产环境：
      1. 调用 knowledge_base.search() 检索私有库
      2. 调用 knowledge_base.search() 检索携君库
      3. 调用 voice_engine.llm_generate() 生成文档
      4. 三源结果融合组装
    """
    # 模拟三源检索
    private_kb_hint = f"（信息来源：私有知识库 - {module_name}相关最佳实践）"
    public_kb_hint = "（信息来源：携君知识库 - HR行业通用模板）"
    internet_hint = "（信息来源：互联网公开知识 - 最新行业趋势）"

    # 体系库文档（6步综合输出）
    if doc_type == "system":
        sections = [
            {"heading": "一、战略输入摘要", "level": 1,
             "body": f"基于用户输入的战略目标和上下文，梳理企业3-5年战略方向。{private_kb_hint}\n\n{build_context[:200] if build_context else '（请完成体系搭建6步流程以生成完整文档）'}"},
            {"heading": "二、核心竞争力与战略萃取", "level": 1,
             "body": f"从资源、能力、市场三维度提炼核心竞争力，形成差异化人力资源策略基础。{public_kb_hint}"},
            {"heading": "三、战略解码——HR战略主题", "level": 1,
             "body": f"将企业战略逐级解码为具体的HR战略主题，建立'战略→组织能力→HR举措'因果链。{internet_hint}"},
            {"heading": "四、人力资源行动计划", "level": 1,
             "body": f"按季度拆解HR行动计划，包括人才招聘、培训发展、绩效激励、组织调整等维度的具体措施。"},
            {"heading": "五、模块制度框架", "level": 1,
             "body": f"基于前述分析，输出八大HR模块的制度框架设计和关键流程。"},
            {"heading": "六、制度比对与升级建议", "level": 1,
             "body": "与现有制度进行差异分析，标注缺失项、冲突项、可优化项，给出升级路径建议。"},
        ]
        return sections

    # 工具库文档（单点工具模板）
    sections = _get_tool_template(module_key, tool_key, private_kb_hint, public_kb_hint, internet_hint)
    return sections


def _get_tool_template(module_key: str, tool_key: str | None,
                        private_hint: str, public_hint: str, internet_hint: str) -> list[dict]:
    """返回工具库中特定工具的文档模板。"""
    # 按工具类型返回不同模板
    templates: dict[str, list[dict]] = {
        "strategy_map": [
            {"heading": "战略地图（BSC四维度）", "level": 1,
             "body": f"基于平衡计分卡（BSC）框架，从财务、客户、内部流程、学习与成长四个维度绘制企业战略地图。{public_hint}"},
            {"heading": "一、财务维度", "level": 2,
             "body": "· 营收增长策略\n· 生产力提升策略\n· 资产利用率优化"},
            {"heading": "二、客户维度", "level": 2,
             "body": "· 产品/服务特性（价格、质量、时间、功能）\n· 客户关系\n· 品牌形象"},
            {"heading": "三、内部流程维度", "level": 2,
             "body": "· 运营管理流程\n· 客户管理流程\n· 创新流程\n· 法规与社会流程"},
            {"heading": "四、学习与成长维度", "level": 2,
             "body": f"· 人力资本（技能、培训、知识）\n· 信息资本（系统、数据库、网络）\n· 组织资本（文化、领导力、团队协作）{private_hint}"},
        ],
        "jd_generator": [
            {"heading": "岗位说明书", "level": 1,
             "body": f"AI生成的标准岗位说明书，包含岗位基本信息、职责描述、任职资格、胜任力模型等。{public_hint}"},
            {"heading": "一、岗位基本信息", "level": 2,
             "body": "· 岗位名称\n· 所属部门\n· 汇报关系\n· 薪酬等级"},
            {"heading": "二、岗位职责", "level": 2,
             "body": "· 核心职责（3-5项）\n· 日常工作\n· 项目性工作"},
            {"heading": "三、任职资格", "level": 2,
             "body": f"· 学历要求\n· 工作经验\n· 专业技能\n· 软性素质{private_hint}"},
            {"heading": "四、胜任力模型", "level": 2,
             "body": "· 通用胜任力\n· 专业胜任力\n· 领导力（如适用）"},
        ],
        "salary_structure": [
            {"heading": "薪酬结构设计方案", "level": 1,
             "body": f"岗位职级薪酬带宽方案，含固定薪酬、浮动薪酬、福利津贴、长期激励四大模块。{public_hint}"},
            {"heading": "一、薪酬策略定位", "level": 2,
             "body": f"· 薪酬水平策略（领先型/跟随型/滞后型）\n· 薪酬结构策略（高固定/高浮动）\n· 参考市场分位值{internet_hint}"},
            {"heading": "二、职级与薪酬带宽", "level": 2,
             "body": "· 职级体系（P1-P10 / M1-M5）\n· 各职级薪酬带宽（最小值-中位值-最大值）\n· 级差设计"},
            {"heading": "三、薪酬构成", "level": 2,
             "body": f"· 基本工资\n· 绩效工资\n· 年终奖金\n· 各类津贴与补贴{private_hint}"},
            {"heading": "四、调薪机制", "level": 2,
             "body": "· 年度普调\n· 晋升调薪\n· 特殊调薪\n· 调薪矩阵"},
        ],
        "okr_framework": [
            {"heading": "OKR管理框架", "level": 1,
             "body": f"公司级→部门级→个人级OKR模板，含制定原则、对齐方式、评分标准。{public_hint}"},
            {"heading": "一、OKR制定原则", "level": 2,
             "body": "· 目标（Objective）：鼓舞人心、有方向感\n· 关键结果（Key Results）：可量化、可验证\n· 3-5个O，每个O对应3-5个KR"},
            {"heading": "二、公司级OKR模板", "level": 2,
             "body": f"· O1: [公司级目标]\n  - KR1: [量化指标]\n  - KR2: [量化指标]\n  - KR3: [量化指标]"},
            {"heading": "三、OKR对齐机制", "level": 2,
             "body": f"· 自上而下对齐\n· 横向协同对齐\n· OKR与KPI的关系{private_hint}"},
            {"heading": "四、OKR评分与复盘", "level": 2,
             "body": "· 0-1.0评分标准\n· 季度复盘流程\n· OKR与绩效的衔接"},
        ],
    }

    if tool_key and tool_key in templates:
        return templates[tool_key]

    # 通用模板（未匹配到特定工具时）
    return [
        {"heading": f"{module_key} - 文档生成", "level": 1,
         "body": f"AI生成的{module_key}相关文档。{public_hint}"},
        {"heading": "一、概述", "level": 2,
         "body": f"基于知识库和行业最佳实践生成的文档框架。"},
        {"heading": "二、核心内容", "level": 2,
         "body": f"请选择具体的工具类型以生成更精准的文档内容。{private_hint}"},
        {"heading": "三、参考来源", "level": 2,
         "body": f"本文档由三源知识融合生成：私有库 + 携君库 + 互联网。{internet_hint}"},
    ]


# ═══════════════════════════════════════════════
# 草稿箱
# ═══════════════════════════════════════════════

def save_draft(db: Session, user_id: str, doc_id: str | None, title: str | None,
               doc_type: str, module_key: str | None, step_num: int | None,
               content: dict | None) -> dict[str, Any]:
    """保存/更新草稿。每步自动保存，保留30天。"""
    # 清理用户过期草稿
    _clean_expired_drafts(db, user_id)

    draft = None
    if doc_id:
        draft = db.query(OfficeDraft).filter(
            OfficeDraft.doc_id == doc_id,
            OfficeDraft.user_id == user_id,
            OfficeDraft.deleted_at.is_(None),
        ).first()

    if draft:
        # 更新现有草稿
        if title is not None:
            draft.title = title
        if content is not None:
            draft.content_snapshot_json = content
        if step_num is not None:
            draft.step_num = step_num
        draft.updated_at = utcnow()
    else:
        # 创建新草稿
        draft = OfficeDraft(
            user_id=user_id,
            doc_id=doc_id,
            title=title,
            doc_type=doc_type,
            module_key=module_key,
            step_num=step_num,
            content_snapshot_json=content,
        )
        db.add(draft)

    db.commit()
    db.refresh(draft)

    # 计算剩余天数
    days_left = DRAFT_RETENTION_DAYS
    if draft.created_at:
        elapsed = datetime.now(timezone.utc).replace(tzinfo=None) - draft.created_at.replace(tzinfo=None) if draft.created_at.tzinfo else datetime.now(timezone.utc).replace(tzinfo=None) - draft.created_at
        days_left = max(0, DRAFT_RETENTION_DAYS - elapsed.days)

    return {
        "id": draft.id,
        "title": draft.title or "",
        "doc_type": draft.doc_type or "",
        "module_key": draft.module_key,
        "step_num": draft.step_num,
        "updated_at": draft.updated_at.isoformat() if draft.updated_at else "",
        "days_until_expire": days_left,
    }


def list_drafts(db: Session, user_id: str) -> list[dict[str, Any]]:
    """列出用户的草稿箱。"""
    _clean_expired_drafts(db, user_id)

    drafts = (
        db.query(OfficeDraft)
        .filter(
            OfficeDraft.user_id == user_id,
            OfficeDraft.deleted_at.is_(None),
        )
        .order_by(desc(OfficeDraft.updated_at))
        .limit(100)
        .all()
    )

    result = []
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    for d in drafts:
        days_left = DRAFT_RETENTION_DAYS
        if d.created_at:
            created = d.created_at.replace(tzinfo=None) if d.created_at.tzinfo else d.created_at
            days_left = max(0, DRAFT_RETENTION_DAYS - (now - created).days)

        result.append({
            "id": d.id,
            "title": d.title or "未命名草稿",
            "doc_type": d.doc_type or "",
            "module_key": d.module_key,
            "step_num": d.step_num,
            "updated_at": d.updated_at.isoformat() if d.updated_at else "",
            "days_until_expire": days_left,
        })

    return result


def _clean_expired_drafts(db: Session, user_id: str) -> int:
    """清理超过30天的过期草稿。"""
    expire_date = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=DRAFT_RETENTION_DAYS)
    count = (
        db.query(OfficeDraft)
        .filter(
            OfficeDraft.user_id == user_id,
            OfficeDraft.created_at < expire_date,
            OfficeDraft.deleted_at.is_(None),
        )
        .update({"deleted_at": utcnow()})
    )
    if count:
        db.commit()
        logger.info("已清理%d条过期草稿 (user_id=%s)", count, user_id)
    return count


# ═══════════════════════════════════════════════
# 现有制度上载与比对
# ═══════════════════════════════════════════════

def upload_policy(db: Session, user_id: str, doc_id: str, filename: str,
                  content_text: str) -> dict[str, Any]:
    """上传现有制度文件。仅存储私有库，不用于模型训练。"""
    # 校验文档存在
    doc = db.query(OfficeDocument).filter(
        OfficeDocument.id == doc_id,
        OfficeDocument.user_id == user_id,
        OfficeDocument.deleted_at.is_(None),
    ).first()
    if not doc:
        raise APIError(E_DOC_NOT_FOUND.code, "文档不存在", 404)

    upload = PolicyUpload(
        user_id=user_id,
        doc_id=doc_id,
        original_filename=filename,
        content_text=content_text,
        file_size_bytes=len(content_text.encode("utf-8")) if content_text else 0,
        for_training=False,  # 明确不用于模型训练
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)

    logger.info("制度文件已上传: upload_id=%s doc_id=%s filename=%s (不用于模型训练)",
                upload.id, doc_id, filename)

    return {
        "upload_id": upload.id,
        "original_filename": filename,
        "content_length": len(content_text) if content_text else 0,
        "uploaded_at": upload.created_at.isoformat() if upload.created_at else "",
    }


def compare_with_existing(db: Session, user_id: str, doc_id: str,
                           upload_id: str) -> dict[str, Any]:
    """将生成的文档与上传的现有制度进行比对，标注差异并给出升级建议。

    生产环境：调用AI引擎进行语义级文本比对。
    MVP阶段：基于段落结构进行关键词级差异分析。
    """
    doc = db.query(OfficeDocument).filter(
        OfficeDocument.id == doc_id,
        OfficeDocument.user_id == user_id,
        OfficeDocument.deleted_at.is_(None),
    ).first()
    if not doc:
        raise APIError(E_DOC_NOT_FOUND.code, "文档不存在", 404)

    upload = db.query(PolicyUpload).filter(
        PolicyUpload.id == upload_id,
        PolicyUpload.user_id == user_id,
        PolicyUpload.doc_id == doc_id,
        PolicyUpload.deleted_at.is_(None),
    ).first()
    if not upload:
        raise APIError(E_DOC_NOT_FOUND.code, "上传的制度文件不存在", 404)

    # MVP：基于段落匹配生成差异分析
    content_json = doc.content_json or {}
    sections = content_json.get("sections", [])

    differences = []
    for i, section in enumerate(sections):
        heading = section.get("heading", "")
        body = section.get("body", "")

        # 简单检测：现有制度中是否有对应内容的段落
        existing_text = upload.content_text or ""
        has_match = _fuzzy_match(heading, existing_text)

        if has_match:
            diff = {
                "section": heading,
                "generated_text": body[:200] + ("..." if len(body) > 200 else ""),
                "existing_text": f"现有制度中存在相似内容（匹配度: {has_match}）",
                "diff_type": "match",
                "suggestion": "内容基本一致，建议保留现有制度表述（实际落地经验更可靠），参考生成内容的补充建议。",
            }
        else:
            diff = {
                "section": heading,
                "generated_text": body[:200] + ("..." if len(body) > 200 else ""),
                "existing_text": "现有制度中未找到对应内容",
                "diff_type": "missing",
                "suggestion": f"建议在现有制度中补充「{heading}」相关内容，生成内容可作为起草参考。",
            }
        differences.append(diff)

    # 检查现有制度中有但生成内容没有的段落
    # MVP简化：仅做方向性提示
    summary = (
        f"比对完成：共分析{len(sections)}个章节。"
        f"匹配{sum(1 for d in differences if d['diff_type'] == 'match')}项，"
        f"缺失{sum(1 for d in differences if d['diff_type'] == 'missing')}项。"
        "建议：优先补充制度中的缺失模块，匹配的模块可参考生成内容做优化升级。"
    )

    return {
        "doc_id": doc_id,
        "upload_id": upload_id,
        "differences": differences,
        "summary": summary,
    }


def _fuzzy_match(heading: str, text: str) -> int:
    """简单的关键词匹配：返回命中的关键词数量（MVP版本）。"""
    keywords = heading.replace("一、", "").replace("二、", "").replace("三、", "").replace("四、", "").replace("五、", "").replace("六、", "").split()
    hits = sum(1 for kw in keywords if kw in text)
    return hits


# ═══════════════════════════════════════════════
# 版本管理
# ═══════════════════════════════════════════════

def get_version_history(db: Session, user_id: str, doc_id: str) -> dict[str, Any]:
    """获取文档的版本历史列表。"""
    doc = db.query(OfficeDocument).filter(
        OfficeDocument.id == doc_id,
        OfficeDocument.user_id == user_id,
        OfficeDocument.deleted_at.is_(None),
    ).first()
    if not doc:
        raise APIError(E_DOC_NOT_FOUND.code, "文档不存在", 404)

    versions = (
        db.query(DocumentVersion)
        .filter(
            DocumentVersion.doc_id == doc_id,
            DocumentVersion.deleted_at.is_(None),
        )
        .order_by(desc(DocumentVersion.version_num))
        .all()
    )

    version_items = []
    for v in versions:
        content = v.content_json or {}
        sections = content.get("sections", [])
        first_section_body = sections[0]["body"][:100] if sections else ""
        summary_text = first_section_body + ("..." if len(first_section_body) >= 100 else "")

        version_items.append({
            "id": v.id,
            "version_num": v.version_num,
            "created_by": v.created_by[:8] if v.created_by else "",
            "created_at": v.created_at.isoformat() if v.created_at else "",
            "summary": summary_text,
        })

    return {
        "doc_id": doc_id,
        "versions": version_items,
        "current_version": doc.version,
    }


def rollback_version(db: Session, user_id: str, doc_id: str,
                      target_version: int) -> dict[str, Any]:
    """回滚文档到指定版本。"""
    doc = db.query(OfficeDocument).filter(
        OfficeDocument.id == doc_id,
        OfficeDocument.user_id == user_id,
        OfficeDocument.deleted_at.is_(None),
    ).first()
    if not doc:
        raise APIError(E_DOC_NOT_FOUND.code, "文档不存在", 404)

    if target_version == doc.version:
        raise APIError(E_PARAM_FORMAT.code, "目标版本与当前版本相同，无需回滚", 400)

    # 获取目标版本
    target = (
        db.query(DocumentVersion)
        .filter(
            DocumentVersion.doc_id == doc_id,
            DocumentVersion.version_num == target_version,
            DocumentVersion.deleted_at.is_(None),
        )
        .first()
    )
    if not target:
        raise APIError(E_DOC_NOT_FOUND.code, f"版本{target_version}不存在", 404)

    from_version = doc.version

    # 创建新版本记录（记录回滚操作）
    new_version = DocumentVersion(
        doc_id=doc_id,
        version_num=doc.version + 1,
        content_json=target.content_json,  # 回滚到的内容
        created_by=user_id,
    )
    db.add(new_version)

    # 更新文档内容
    doc.content_json = target.content_json
    doc.version = doc.version + 1
    db.commit()

    logger.info("文档版本已回滚: doc_id=%s from=v%d to=v%d", doc_id, from_version, target_version)

    # 返回回滚后的内容
    content = target.content_json or {}
    sections = content.get("sections", [])
    result_sections = [
        {"heading": s.get("heading", ""), "body": s.get("body", ""), "level": s.get("level", 1)}
        for s in sections
    ]

    return {
        "doc_id": doc_id,
        "from_version": from_version,
        "to_version": doc.version,
        "content": result_sections,
    }


# ═══════════════════════════════════════════════
# 归档到知识库
# ═══════════════════════════════════════════════

def confirm_and_archive(db: Session, user_id: str, doc_id: str) -> dict[str, Any]:
    """确认文档并归档到知识库。统一确认入库（非每步弹窗）。"""
    doc = db.query(OfficeDocument).filter(
        OfficeDocument.id == doc_id,
        OfficeDocument.user_id == user_id,
        OfficeDocument.deleted_at.is_(None),
    ).first()
    if not doc:
        raise APIError(E_DOC_NOT_FOUND.code, "文档不存在", 404)

    if doc.status == "archived":
        return {"success": True, "doc_id": doc_id, "kb_doc_id": doc.kb_doc_id or ""}

    # 归档到知识库 Document 表
    from ...shared.models.knowledge import Document, AuditQueue

    content = doc.content_json or {}
    hr_category_map = {
        "strategy_decode": "战略解码",
        "hr_planning": "人资规划",
        "recruitment": "招聘配置",
        "training_dev": "培训开发",
        "compensation": "薪酬福利",
        "performance": "绩效管理",
        "employee_relations": "员工关系",
        "corp_culture": "企业文化",
    }

    kb_doc = Document(
        owner_user_id=user_id,
        library_type="private",
        doc_type="hr_policy" if doc.doc_type == "system" else "hr_tool",
        source_module="M7",  # 智能办公
        hr_category=hr_category_map.get(doc.module_key or "", ""),
        title=doc.title or "智能办公文档",
        content={
            "office_doc_id": doc_id,
            "doc_type": doc.doc_type,
            "module_key": doc.module_key,
            "sections": content.get("sections", []),
            "source_tags": content.get("source_tags", []),
        },
        status="draft",
        audit_status="pending",
        is_desensitized=False,
        is_negative_blocked=False,
        vector_status="pending",
        version=1,
    )
    db.add(kb_doc)
    db.flush()

    # 进入待审核区
    now = utcnow()
    db.add(AuditQueue(
        doc_id=kb_doc.id,
        entered_at=now,
        expire_remind_at=now + timedelta(days=30),
    ))

    # 更新办公文档归档状态
    doc.status = "archived"
    doc.kb_doc_id = kb_doc.id
    doc.archived_at = now.isoformat()
    db.commit()

    logger.info("智能办公文档已归档到知识库: doc_id=%s kb_doc_id=%s", doc_id, kb_doc.id)

    return {
        "success": True,
        "doc_id": doc_id,
        "kb_doc_id": kb_doc.id,
    }


# ═══════════════════════════════════════════════
# 多人协作
# ═══════════════════════════════════════════════

def invite_collaborator(db: Session, user_id: str, doc_id: str,
                         teacher_user_id: str, message: str = "") -> dict[str, Any]:
    """邀请老师进行文档协作。

    生产环境：
      1. 创建协作授权记录（AuthorizationGrant）
      2. 调用⑥推送服务发送协作邀请通知
    协作响应要求：≤3秒
    """
    doc = db.query(OfficeDocument).filter(
        OfficeDocument.id == doc_id,
        OfficeDocument.user_id == user_id,
        OfficeDocument.deleted_at.is_(None),
    ).first()
    if not doc:
        raise APIError(E_DOC_NOT_FOUND.code, "文档不存在", 404)

    if teacher_user_id == user_id:
        raise APIError(E_PARAM_FORMAT.code, "不能邀请自己", 400)

    # 检查是否已存在授权
    existing = (
        db.query(OfficeDocument)
        .filter(
            OfficeDocument.id == doc_id,
            OfficeDocument.user_id == teacher_user_id,
            OfficeDocument.deleted_at.is_(None),
        )
        .first()
    )
    # MVP：通过权限授权机制授予协作者访问

    # 创建跨用户授权（使用 AuthorizationGrant 模型）
    from ...shared.models.user import AuthorizationGrant
    from ...shared.database import new_uuid as _new_uuid

    # 检查是否已有有效授权
    existing_grant = db.query(AuthorizationGrant).filter(
        AuthorizationGrant.grantor_user_id == user_id,
        AuthorizationGrant.grantee_user_id == teacher_user_id,
        AuthorizationGrant.resource_type == "office_document",
        AuthorizationGrant.resource_id == doc_id,
        AuthorizationGrant.deleted_at.is_(None),
    ).first()

    if existing_grant:
        return {
            "success": True,
            "invite_id": existing_grant.id,
            "message": "已存在有效协作授权",
        }

    grant = AuthorizationGrant(
        grantor_user_id=user_id,
        grantee_user_id=teacher_user_id,
        resource_type="office_document",
        resource_id=doc_id,
        permission_level="read_write",
        status="active",
        expire_at=utcnow() + timedelta(days=90),
    )
    db.add(grant)
    db.commit()
    db.refresh(grant)

    logger.info("协作邀请已发送: doc_id=%s from=%s to=%s", doc_id, user_id, teacher_user_id)

    return {
        "success": True,
        "invite_id": grant.id,
        "message": f"已邀请老师进行文档协作。'{doc.title or '未命名文档'}'{message}",
    }


# ═══════════════════════════════════════════════
# 跨模块数据连接
# ═══════════════════════════════════════════════

def get_module_data_connections(db: Session, user_id: str) -> dict[str, Any]:
    """返回跨模块数据流配置。

    智能办公与其他模块的连接：
      - ②知识库：文档生成的三源检索 + 文档归档
      - ③AI引擎：智能文档生成
      - ①朝有规划：体系搭建行动项 → 计划任务
      - ⑥推送：协作邀请通知
    """
    connections = [
        {
            "from_module": "智能办公",
            "to_module": "知识库",
            "data_type": "document_retrieval",
            "description": "文档生成时检索私有库和携君库，作为三源输入之一",
        },
        {
            "from_module": "智能办公",
            "to_module": "知识库",
            "data_type": "document_archive",
            "description": "文档确认后归档到知识库，进入待审核区",
        },
        {
            "from_module": "智能办公",
            "to_module": "AI引擎",
            "data_type": "llm_generate",
            "description": "调用AI引擎进行智能文档生成和制度差异分析",
        },
        {
            "from_module": "智能办公",
            "to_module": "朝有规划",
            "data_type": "action_item",
            "description": "体系搭建完成后的HR行动计划可同步到朝有规划",
        },
        {
            "from_module": "智能办公",
            "to_module": "消息推送",
            "data_type": "collaboration_invite",
            "description": "多人协作时通过推送服务发送邀请通知",
        },
        {
            "from_module": "智能记录",
            "to_module": "智能办公",
            "data_type": "extraction_insight",
            "description": "面试/会议记录中的关键洞察可作为制度优化的输入参考",
        },
    ]

    return {"connections": connections}
