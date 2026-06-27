"""智能问答服务 — 核心业务逻辑（步骤16）。

跨模块调用链（步骤16 §16.3）：
  问题 → ⑤搜索/RAG（三源检索：私有库+携君库+互联网）
  检索 → ③AI引擎（四要素答案生成 + 2-4轮追问澄清）
  答案 → ②知识库（SOP沉淀归档）
  质控 → 防幻觉四级防线（来源标注+时效性标注+申诉纠错+人工抽检）

设计原则：
  - 只写业务逻辑层，基础能力全部调用已有服务
  - 三源引擎各可独立开关
  - 追问答疑不超过4轮
  - 每份答案自动标注来源和时效性
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import desc
from sqlalchemy.orm import Session

from ...shared.config import settings
from ...shared.database import new_uuid, utcnow
from ...shared.errors import APIError, E_DOC_NOT_FOUND, E_PARAM_FORMAT
from ...shared.models.qa import (
    QA_SOURCE_TYPES,
    QaAnswer,
    QaConversation,
    QaFeedback,
)
from ...shared.models.knowledge import Document, AuditQueue

logger = logging.getLogger("smart_qa")

# ── 四要素图标/颜色常量 ──
ELEMENT_META = {
    "key-points": {"title": "操作要点", "icon": "📋", "color": "#C03A39"},
    "cautions": {"title": "注意事项", "icon": "⚠️", "color": "#E8A94D"},
    "script": {"title": "沟通话术", "icon": "💬", "color": "#6B8FBF"},
    "standard": {"title": "达成标准", "icon": "🎯", "color": "#27AE60"},
}

# ── HR八大模块分类 ──
HR_CATEGORIES = [
    "战略解码", "人资规划", "招聘配置", "培训开发",
    "薪酬福利", "绩效管理", "员工关系", "企业文化",
]

# ── 热门问题模板 ──
HOT_QUESTIONS_DEFAULT = [
    {"id": "q1", "text": "试用期员工不符合录用条件，如何合规解除？"},
    {"id": "q2", "text": "薪酬宽带如何设计才能激励老员工？"},
    {"id": "q3", "text": "年底绩效面谈怎么引导员工说出真实想法？"},
    {"id": "q4", "text": "竞业限制协议在什么情况下可以免除？"},
    {"id": "q5", "text": "新员工入职培训体系怎么搭建？"},
    {"id": "q6", "text": "裁员补偿金怎么计算才合法？"},
]


# ═══════════════════════════════════════════════
# 主问答流程
# ═══════════════════════════════════════════════

def ask_question(
    db: Session,
    user_id: str,
    question: str,
    conversation_id: str | None = None,
    source_engines: list[dict] | None = None,
) -> dict[str, Any]:
    """提问主流程：

    1. 三源检索（⑤搜索/RAG）
    2. AI生成四要素答案（③AI引擎）
    3. 判断是否需要追问澄清（2-4轮）
    4. 标注来源和时效性（防幻觉L1+L2）
    5. 存储对话和答案
    """
    # 默认三源配置
    if not source_engines:
        source_engines = [
            {"key": "private", "enabled": True},
            {"key": "xiejun", "enabled": True},
            {"key": "internet", "enabled": False},
        ]

    enabled_sources = {s["key"] for s in source_engines if s.get("enabled")}

    # 获取或创建对话
    is_clarification = False
    if conversation_id:
        conv = db.query(QaConversation).filter(
            QaConversation.id == conversation_id,
            QaConversation.user_id == user_id,
            QaConversation.deleted_at.is_(None),
        ).first()
        if not conv:
            raise APIError(99002, "对话不存在", 404)
        # 追问轮次+1
        conv.rounds = (conv.rounds or 0) + 1
        is_clarification = True
    else:
        conv = QaConversation(
            user_id=user_id,
            question=question,
            rounds=0,
            source_engines_json=source_engines,
            status="active",
        )
        db.add(conv)
        db.flush()

    # ── 1. 三源检索 ──
    search_results = _search_three_sources(db, user_id, question, enabled_sources)

    # ── 2. 判断是否需要追问澄清 ──
    if not is_clarification and conv.rounds < 4:
        needs_clarify, clarifications = _check_needs_clarification(question, conv.rounds)
        if needs_clarify:
            db.commit()
            return {
                "conversation_id": conv.id,
                "answer": None,
                "is_clarification": True,
                "clarification_question": clarifications[0] if clarifications else "",
                "suggestions": clarifications,
            }

    # ── 3. AI生成四要素答案 ──
    answer_data = _generate_four_element_answer(question, search_results, conv.rounds)

    # ── 4. 存储答案 ──
    answer = QaAnswer(
        user_id=user_id,
        conversation_id=conv.id,
        question=question,
        intro=answer_data.get("intro", ""),
        elements_json=answer_data.get("elements", []),
        source_json=answer_data.get("source"),
        has_source_label=True,
        has_timeliness_label=True,
        audit_status="pending",
        model_used="mock_mvp",
        generation_cost_tokens=0,
    )
    db.add(answer)
    db.flush()

    conv.answer_id = answer.id
    db.commit()
    db.refresh(answer)

    # ── 5. 构建输出 ──
    answer_out = _build_answer_out(answer)

    suggestions = _generate_followup_suggestions(question, conv.rounds)

    logger.info(
        "智能问答: conv=%s question=%s rounds=%d sources=%s",
        conv.id, question[:50], conv.rounds, enabled_sources,
    )

    return {
        "conversation_id": conv.id,
        "answer": answer_out,
        "is_clarification": False,
        "clarification_question": "",
        "suggestions": suggestions,
    }


# ═══════════════════════════════════════════════
# 三源检索
# ═══════════════════════════════════════════════

def _search_three_sources(
    db: Session, user_id: str, question: str, enabled_sources: set[str],
) -> list[dict]:
    """三源检索：私有库 + 携君库 + 互联网。

    调用⑤搜索/RAG服务，按启用的源分别检索。
    MVP阶段：keyword search + 模拟互联网结果。
    """
    results = []

    if "private" in enabled_sources:
        # 检索用户私有库
        private_docs = (
            db.query(Document)
            .filter(
                Document.owner_user_id == user_id,
                Document.library_type == "private",
                Document.status == "published",
                Document.deleted_at.is_(None),
            )
            .order_by(desc(Document.updated_at))
            .limit(5)
            .all()
        )
        for doc in private_docs:
            results.append({
                "title": doc.title or "",
                "library": "私有库",
                "library_type": "private",
                "updated_at": doc.updated_at.strftime("%Y-%m-%d") if doc.updated_at else "",
                "verified": doc.audit_status == "passed",
                "doc_id": doc.id,
                "snippet": _extract_snippet(doc.content, question),
            })

    if "xiejun" in enabled_sources:
        # 检索携君库（公有库）
        public_docs = (
            db.query(Document)
            .filter(
                Document.library_type == "public",
                Document.status == "published",
                Document.audit_status == "passed",
                Document.deleted_at.is_(None),
            )
            .order_by(desc(Document.updated_at))
            .limit(5)
            .all()
        )
        for doc in public_docs:
            results.append({
                "title": doc.title or "",
                "library": "携君库",
                "library_type": "public",
                "updated_at": doc.updated_at.strftime("%Y-%m-%d") if doc.updated_at else "",
                "verified": True,
                "doc_id": doc.id,
                "snippet": _extract_snippet(doc.content, question),
            })

    if "internet" in enabled_sources:
        # 互联网源（MVP模拟）
        results.append({
            "title": f"互联网搜索：{question[:30]}...",
            "library": "互联网",
            "library_type": "internet",
            "updated_at": date.today().isoformat(),
            "verified": False,
            "doc_id": None,
            "snippet": f"搜索\"{question[:40]}\"相关网络结果（需自行核实）",
            "is_internet": True,
        })

    return results


def _extract_snippet(content: dict | None, question: str) -> str:
    """从文档内容中提取与问题相关的片段。"""
    if not content:
        return ""
    if isinstance(content, dict):
        # 优先返回 summary
        summary = content.get("summary", "")
        if summary:
            return summary[:200]
        # 其次返回 content 的字符串表示
        inner = content.get("content", content)
        if isinstance(inner, str):
            return inner[:200]
        return str(inner)[:200]
    return str(content)[:200]


# ═══════════════════════════════════════════════
# 追问澄清判断
# ═══════════════════════════════════════════════

def _check_needs_clarification(question: str, current_rounds: int) -> tuple[bool, list[str]]:
    """判断是否需要追问澄清。

    MVP逻辑：第0轮（首问）时，若问题较短（<15字）或过于宽泛，追问澄清。
    最多追问4轮。
    """
    if current_rounds >= 4:
        return False, []

    # 需要澄清的情况：
    # 1. 问题太短（<10字），可能信息不足
    # 2. 问题没有具体场景
    short_q = len(question.strip()) < 10

    if short_q and current_rounds == 0:
        return True, [
            "能再具体说说是什么场景吗？比如涉及的岗位级别、业务线或具体政策？",
            "你想了解的是法律合规层面，还是操作执行层面？",
        ]

    if current_rounds == 1 and len(question.strip()) < 20:
        return True, [
            "是否需要我进一步说明具体的操作步骤？",
            "有没有特定的行业或地区限制需要考虑？",
        ]

    return False, []


# ═══════════════════════════════════════════════
# 四要素答案生成
# ═══════════════════════════════════════════════

def _generate_four_element_answer(
    question: str, sources: list[dict], rounds: int,
) -> dict[str, Any]:
    """生成四要素结构化答案。

    生产环境：调用③AI引擎（voice_engine.llm_generate），传入 system_prompt 指定四要素格式。
    MVP阶段：基于模板生成模拟答案。
    """
    # 确定最佳来源
    best_source = _pick_best_source(sources)

    # 生成四要素
    elements = _generate_mock_elements(question, best_source)

    # 来源引用
    source_out = _build_source_out(best_source)

    intro = f'针对"{question[:40]}{"..." if len(question) > 40 else ""}"，建议按以下四要素结构化方案执行：'

    return {
        "intro": intro,
        "elements": elements,
        "source": source_out,
    }


def _pick_best_source(sources: list[dict]) -> dict | None:
    """从检索结果中选取最佳来源（优先已验证的内部文档）。"""
    if not sources:
        return None

    # 优先级：私有库（已验证）> 携君库 > 互联网
    for src in sources:
        if src.get("verified") and src.get("library") == "私有库":
            return src
    for src in sources:
        if src.get("verified") and src.get("library") == "携君库":
            return src
    return sources[0]


def _build_source_out(source: dict | None) -> dict | None:
    """构建来源引用输出。"""
    if not source:
        return None

    is_internet = source.get("is_internet", False) or source.get("library") == "互联网"
    updated_at = source.get("updated_at", "")
    is_stale = False

    # 时效性检查：超过12个月标注"内容较旧"
    if updated_at and not is_internet:
        try:
            dt = datetime.strptime(updated_at, "%Y-%m-%d")
            if (datetime.now() - dt).days > 365:
                is_stale = True
        except ValueError:
            pass

    # 标签
    if is_internet:
        label = "请核实"
        verified = False
    elif is_stale:
        label = "内容较旧"
        verified = source.get("verified", False)
    else:
        label = "文档较新"
        verified = source.get("verified", False)

    return {
        "title": source.get("title", ""),
        "library": source.get("library", "内部知识库"),
        "label": label,
        "updated_at": updated_at,
        "verified": verified,
        "is_internet": is_internet,
        "is_stale": is_stale,
        "doc_id": source.get("doc_id"),
    }


def _generate_mock_elements(question: str, source: dict | None) -> list[dict]:
    """生成模拟四要素（MVP阶段，生产环境用AI引擎替换）。

    四要素：
    - key-points: 操作要点（红色 #C03A39）
    - cautions: 注意事项（橙黄 #E8A94D）
    - script: 沟通话术（蓝灰 #6B8FBF）
    - standard: 达成标准（绿色 #27AE60）
    """
    source_title = source.get("title", "内部知识库") if source else "内部知识库"
    source_library = source.get("library", "内部知识库") if source else "内部知识库"

    # 基于问题关键词匹配模板
    if "试用期" in question or "解除" in question:
        return [
            {
                "key": "key-points", "title": "操作要点", "icon": "📋", "color": "#C03A39",
                "summary": "必须在试用期届满前发出解除通知，并明确指出具体的录用条件及不符合的事实依据。",
                "detail": [
                    "明确解除时间：必须在试用期最后一天结束前，将解除通知送达员工。若试用期已过，则不能再以此理由解除。",
                    "书面通知：必须出具书面的《解除劳动合同通知书》，并由员工签收。",
                    "事实依据：通知书中应明确列举员工在试用期内不符合录用条件的具体事实（如：XX考核未达标、XX行为违反岗位要求等）。",
                ],
            },
            {
                "key": "cautions", "title": "注意事项", "icon": "⚠️", "color": "#E8A94D",
                "summary": "录用条件需提前公示并由员工签字确认；评估过程需有客观量化的证据支撑。",
                "detail": [
                    "录用条件公示：员工入职时已签署确认《岗位说明书》或录用标准。",
                    "考核过程客观：有量化的考核数据、工作周报或导师评估记录。",
                    "关联性证明：证明员工表现确实不符合当初设定的录用标准。",
                ],
            },
            {
                "key": "script", "title": "沟通话术", "icon": "💬", "color": "#6B8FBF",
                "summary": "\"根据近期的评估反馈，您在XX方面的表现与岗位录用标准存在一定差距，经综合考虑……\"",
                "detail": [
                    "「根据《劳动合同法》第39条，试用期员工不符合录用条件需要提供明确的考核标准和书面记录，建议您在试用期内定期进行绩效评估并保留沟通记录。」",
                    "「在沟通时保持客观和尊重，聚焦于事实和标准而非个人评价，给员工充分的表达机会。」",
                ],
            },
            {
                "key": "standard", "title": "达成标准", "icon": "🎯", "color": "#27AE60",
                "summary": "员工签署《解除劳动合同通知书》，完成工作交接，且未产生劳动争议投诉。",
                "detail": [
                    "完成证据链闭环（考核标准书面化→考核过程记录→不符合结论书面告知→协商解除或依法单方解除），确保每步都有员工签字确认或邮件留存。",
                    "劳动争议零发生：解除流程合法合规，所有材料归档完整，可在劳动仲裁时作为有效证据。",
                ],
            },
        ]

    if "薪酬" in question or "宽带" in question or "激励" in question:
        return [
            {
                "key": "key-points", "title": "操作要点", "icon": "📋", "color": "#C03A39",
                "summary": "薪酬宽带设计需基于岗位价值评估，确定带宽（中位值±20%~50%）和重叠度，与绩效调薪机制联动。",
                "detail": [
                    "岗位价值评估：用Hay或IPE方法论对所有岗位进行评分，确定职等职级。",
                    "带宽设计：每级薪酬带宽=中位值×(1±带宽%)，带宽%根据层级递增（基层20%→中层35%→高层50%）。",
                    "重叠度设置：相邻职等薪酬重叠度控制在30%-50%，防止\"晋升不涨薪\"或\"涨薪无上限\"。",
                    "与绩效联动：绩效调薪在带宽内移动，A级员工可超中位值，C级员工应低于中位值。",
                ],
            },
            {
                "key": "cautions", "title": "注意事项", "icon": "⚠️", "color": "#E8A94D",
                "summary": "老员工薪酬倒挂问题需通过\"长期服务津贴+技能工资+特殊调薪\"组合解决，不可单靠宽带本身。",
                "detail": [
                    "薪酬倒挂是普遍问题：新员工往往以市场价招聘，老员工则按历史薪酬增长，两者之间可能产生倒挂。",
                    "宽带不能解决一切：薪酬宽带只是结构工具，激励老员工需要\"绩效调薪+晋升通道+长期激励\"三管齐下。",
                    "避免\"大锅饭\"：带宽过宽可能导致同岗不同酬过大，引发内部公平性争议。",
                ],
            },
            {
                "key": "script", "title": "沟通话术", "icon": "💬", "color": "#6B8FBF",
                "summary": "\"公司正在优化薪酬体系，您的岗位价值已被重新评估，您的薪酬区间调整为XX-XX，与市场对标更具竞争力。\"",
                "detail": [
                    "「薪酬体系的优化是为了让大家的价值得到更公平的体现，不是单纯\"涨薪\"或\"降薪\"。」",
                    "「您的薪酬在带宽中的位置取决于两个因素：一是您当前的绩效表现，二是您在岗的年限和技能积累。」",
                ],
            },
            {
                "key": "standard", "title": "达成标准", "icon": "🎯", "color": "#27AE60",
                "summary": "薪酬宽带方案通过管理层审批，老员工满意度调查≥75%，核心员工留存率提升。",
                "detail": [
                    "方案审批通过：薪酬委员会（或CEO）签字确认新的薪酬宽带结构。",
                    "员工理解度≥80%：通过薪酬沟通会议确保员工理解新体系。",
                    "核心员工流失率下降：实施6个月内核心员工主动离职率≤行业平均水平。",
                ],
            },
        ]

    if "绩效" in question or "面谈" in question:
        return [
            {
                "key": "key-points", "title": "操作要点", "icon": "📋", "color": "#C03A39",
                "summary": "绩效面谈的核心是\"先听后说\"，用GROW模型引导员工自评，用STAR事实而非主观评价展开对话。",
                "detail": [
                    "GROW模型：Goal（回顾目标）→Reality（评估现状）→Options（探讨方案）→Will（确定行动）。",
                    "STAR事实法：用Situation（情境）、Task（任务）、Action（行动）、Result（结果）描述具体事例，避免模糊评价。",
                    "\"三明治\"反馈：先肯定→再改进→再鼓励，让员工在安全氛围中接受建设性反馈。",
                ],
            },
            {
                "key": "cautions", "title": "注意事项", "icon": "⚠️", "color": "#E8A94D",
                "summary": "避免\"秋后算账\"（平时不说，年底一起说）；避免\"你好我好大家好\"（不敢给真实反馈）；避免\"单向宣贯\"（面试官自己说太多）。",
                "detail": [
                    "绩效面谈不是\"审判\"：平时有feedback culture，年底面谈只是正式总结。",
                    "提问比告诉更有效：\"你觉得今年最大的成长是什么？\"比\"你这里做得不好\"更能引发真诚对话。",
                    "关注未来而非过去：50%的时间谈过去表现，50%的时间谈明年目标和发展。",
                ],
            },
            {
                "key": "script", "title": "沟通话术", "icon": "💬", "color": "#6B8FBF",
                "summary": "\"今年你觉得最有成就感的一件事是什么？如果满分10分，你给自己打几分？差的那几分，你觉得可以从哪里开始提升？\"",
                "detail": [
                    "「不是来评价你，是来跟你一起回顾今年的成长和明年的方向。」（定调）",
                    "「你刚才提到XX项目遇到瓶颈，如果再来一次，你会怎么做不同？」（引导反思）",
                    "「明年你最想挑战的一件事是什么？我能怎么支持你？」（关注未来）",
                ],
            },
            {
                "key": "standard", "title": "达成标准", "icon": "🎯", "color": "#27AE60",
                "summary": "员工愿意说\"真话\"而非\"正确的话\"；面谈后员工有清晰的改进方向和动力；绩效确认书签字率100%。",
                "detail": [
                    "面谈时长≥30分钟（少于30分钟说明双方没有深入交流）。",
                    "员工说话占比≥50%（避免面试官单方面输出）。",
                    "产出具体的明年目标（至少3个SMART目标）和发展计划（至少1项能力提升）。",
                ],
            },
        ]

    # 通用模板
    q_short = question[:30]
    q_vshort = question[:20]
    return [
        {
            "key": "key-points", "title": "操作要点", "icon": "📋", "color": "#C03A39",
            "summary": f'关于「{q_short}...」的核心操作要点，建议从流程规范、关键节点、责任分工三个维度展开。',
            "detail": [
                f'梳理「{q_vshort}」相关的政策法规/公司制度/行业标准，确保操作有据可依。',
                "明确各环节的负责人和完成时限，形成可追踪的执行计划。",
                "设置关键检查点，在每个阶段结束后进行效果评估和纠偏。",
            ],
        },
        {
            "key": "cautions", "title": "注意事项", "icon": "⚠️", "color": "#E8A94D",
            "summary": "执行过程中需重点关注合规风险、沟通成本和员工接受度三个潜在问题。",
            "detail": [
                "合规检查：确保操作方案不违反劳动法规、公司制度和行业规范。",
                "充分沟通：涉及员工切身利益的事项，需提前沟通、取得共识后再执行。",
                "循序渐进：重大变革建议分阶段实施，给团队适应的时间和空间。",
            ],
        },
        {
            "key": "script", "title": "沟通话术", "icon": "💬", "color": "#6B8FBF",
            "summary": "建议以\"我们一起来解决这个问题\"的协作姿态进行沟通，而非\"你们需要听我的\"的单向指令。",
            "detail": [
                "「关于XX事项，我想先听听你的看法和建议。」（先听再说）",
                "「我们的共同目标是XX，基于这个目标，你觉得哪些做法是可行的？」（共识导向）",
                "「如果有顾虑或者不同意见，现在提出来我们一起讨论。」（鼓励坦诚）",
            ],
        },
        {
            "key": "standard", "title": "达成标准", "icon": "🎯", "color": "#27AE60",
            "summary": "方案落地执行率达到预期，相关方反馈满意度≥80%，无合规风险事件发生。",
            "detail": [
                "执行率：方案中的关键行动项按计划完成≥80%。",
                "满意度：通过匿名问卷收集相关方反馈，满意率≥80%。",
                "零风险：操作过程不触发劳动仲裁、合规审计异常或重大员工投诉。",
            ],
        },
    ]


def _generate_followup_suggestions(question: str, rounds: int) -> list[str]:
    """生成推荐追问方向。"""
    if rounds >= 3:
        return ["是否需要对以上方案进行细化？", "需要我帮你生成相关的执行模板吗？"]

    base = [
        "能给我一个具体的操作模板吗？",
        "有哪些常见的坑需要特别注意？",
    ]

    if "试用期" in question or "解除" in question:
        return base + ["如果员工拒绝签字怎么办？", "违法解除的赔偿标准是什么？"]
    if "薪酬" in question:
        return base + ["如何说服老板接受新的薪酬方案？", "中小企业的薪酬宽带怎么简化？"]
    if "绩效" in question:
        return base + ["强制分布法在中国企业适用吗？", "绩效面谈后员工情绪低落怎么办？"]

    return base + ["这个方案的法律依据是什么？"]


# ═══════════════════════════════════════════════
# 答案输出构建
# ═══════════════════════════════════════════════

def _build_answer_out(answer: QaAnswer) -> dict[str, Any]:
    """构建答案输出字典。"""
    elements = []
    if answer.elements_json:
        for el in answer.elements_json:
            elements.append({
                "key": el.get("key", ""),
                "title": el.get("title", ""),
                "icon": el.get("icon", ""),
                "color": el.get("color", ""),
                "summary": el.get("summary", ""),
                "detail": el.get("detail", []),
            })

    source = None
    if answer.source_json:
        src = answer.source_json
        source = {
            "title": src.get("title", ""),
            "library": src.get("library", ""),
            "label": src.get("label", ""),
            "updated_at": src.get("updated_at", ""),
            "verified": src.get("verified", False),
            "is_internet": src.get("is_internet", False),
            "is_stale": src.get("is_stale", False),
            "doc_id": src.get("doc_id"),
        }

    return {
        "id": answer.id,
        "question": answer.question or "",
        "intro": answer.intro or "",
        "elements": elements,
        "source": source,
        "conversation_id": answer.conversation_id or "",
        "rounds": 0,
        "created_at": answer.created_at.isoformat() if answer.created_at else "",
    }


# ═══════════════════════════════════════════════
# 对话历史
# ═══════════════════════════════════════════════

def get_conversation(db: Session, user_id: str, conversation_id: str) -> dict[str, Any]:
    """获取对话历史。"""
    conv = db.query(QaConversation).filter(
        QaConversation.id == conversation_id,
        QaConversation.user_id == user_id,
        QaConversation.deleted_at.is_(None),
    ).first()
    if not conv:
        raise APIError(99002, "对话不存在", 404)

    # 获取对话中的所有答案
    answers = (
        db.query(QaAnswer)
        .filter(
            QaAnswer.conversation_id == conversation_id,
            QaAnswer.deleted_at.is_(None),
        )
        .order_by(QaAnswer.created_at)
        .all()
    )

    # 构建消息列表
    messages = []
    # 首条：小耕欢迎
    messages.append({
        "role": "assistant",
        "text": "你好！我是小耕，你的 HR 智能助手。有什么问题尽管问我~",
        "answer": None,
    })
    # 用户首问
    messages.append({
        "role": "user",
        "text": conv.question or "",
        "answer": None,
    })

    for ans in answers:
        messages.append({
            "role": "assistant",
            "text": ans.intro or "",
            "answer": _build_answer_out(ans),
        })

    return {
        "conversation_id": conv.id,
        "question": conv.question or "",
        "rounds": conv.rounds or 0,
        "status": conv.status or "active",
        "messages": messages,
        "created_at": conv.created_at.isoformat() if conv.created_at else "",
    }


def delete_conversation(db: Session, user_id: str, conversation_id: str) -> dict[str, Any]:
    """软删除对话及其关联答案。"""
    conv = db.query(QaConversation).filter(
        QaConversation.id == conversation_id,
        QaConversation.user_id == user_id,
        QaConversation.deleted_at.is_(None),
    ).first()
    if not conv:
        raise APIError(99002, "对话不存在", 404)

    conv.deleted_at = utcnow()
    # 级联软删除答案
    db.query(QaAnswer).filter(
        QaAnswer.conversation_id == conversation_id,
    ).update({"deleted_at": utcnow()})
    db.commit()

    logger.info("对话已删除: conversation_id=%s", conversation_id)

    return {"deleted": True, "conversation_id": conversation_id}


# ═══════════════════════════════════════════════
# 纠错反馈（防幻觉L3：申诉纠错）
# ═══════════════════════════════════════════════

def submit_feedback(
    db: Session, user_id: str, answer_id: str, feedback_type: str, detail: str | None,
) -> dict[str, Any]:
    """提交纠错反馈（防幻觉四级防线第3级）。"""
    answer = db.query(QaAnswer).filter(
        QaAnswer.id == answer_id,
        QaAnswer.deleted_at.is_(None),
    ).first()
    if not answer:
        raise APIError(99002, "答案不存在", 404)

    feedback = QaFeedback(
        user_id=user_id,
        answer_id=answer_id,
        feedback_type=feedback_type,
        detail=detail,
        status="pending",
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)

    logger.info(
        "纠错反馈已提交: answer_id=%s type=%s feedback_id=%s",
        answer_id, feedback_type, feedback.id,
    )

    return {
        "feedback_id": feedback.id,
        "answer_id": answer_id,
        "status": "pending",
    }


def mark_helpful(db: Session, user_id: str, answer_id: str) -> dict[str, Any]:
    """标记答案有帮助。"""
    answer = db.query(QaAnswer).filter(
        QaAnswer.id == answer_id,
        QaAnswer.deleted_at.is_(None),
    ).first()
    if not answer:
        raise APIError(99002, "答案不存在", 404)

    answer.helpful_count = (answer.helpful_count or 0) + 1
    db.commit()

    return {
        "answer_id": answer_id,
        "helpful_count": answer.helpful_count,
    }


# ═══════════════════════════════════════════════
# 归档到知识库（SOP沉淀）
# ═══════════════════════════════════════════════

def archive_answer_to_kb(
    db: Session, user_id: str, answer_id: str, hr_category: str | None = None,
) -> dict[str, Any]:
    """将答案归档到知识库（SOP沉淀）。

    跨模块调用：直接写入Document表（统一数据模型）。
    复用②知识库服务的归档接口。
    """
    answer = db.query(QaAnswer).filter(
        QaAnswer.id == answer_id,
        QaAnswer.user_id == user_id,
        QaAnswer.deleted_at.is_(None),
    ).first()
    if not answer:
        raise APIError(99002, "答案不存在", 404)

    if answer.archived_to_kb and answer.kb_doc_id:
        return {
            "success": True,
            "doc_id": answer.kb_doc_id,
            "answer_id": answer_id,
            "contribution_value": 0,
        }

    # 确定HR分类
    if not hr_category:
        hr_category = _guess_hr_category(answer.question or "")

    # 提取四要素文本作为文档内容
    elements_text = ""
    if answer.elements_json:
        for el in answer.elements_json:
            elements_text += f"## {el.get('title', '')}\n"
            elements_text += f"{el.get('summary', '')}\n"
            for detail in el.get("detail", []):
                elements_text += f"- {detail}\n"
            elements_text += "\n"

    # 创建知识库文档
    doc = Document(
        owner_user_id=user_id,
        library_type="private",
        doc_type="qa_sop",
        source_module="M5",  # 智能问答
        hr_category=hr_category,
        title=f"QA-SOP: {answer.question[:50] if answer.question else '未命名'}",
        content={
            "question": answer.question,
            "intro": answer.intro,
            "elements": answer.elements_json,
            "source": answer.source_json,
            "extracted_at": utcnow().isoformat(),
        },
        status="draft",
        audit_status="pending",
        is_desensitized=False,
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

    answer.archived_to_kb = True
    answer.kb_doc_id = doc.id
    db.commit()

    logger.info("答案已归档到知识库: answer_id=%s doc_id=%s", answer_id, doc.id)

    return {
        "success": True,
        "doc_id": doc.id,
        "answer_id": answer_id,
        "contribution_value": 20,
    }


def _guess_hr_category(question: str) -> str | None:
    """根据问题内容推测HR八大模块分类。"""
    category_keywords = {
        "战略解码": ["战略", "规划", "目标", "解码", "愿景"],
        "人资规划": ["编制", "定岗", "定编", "人力规划", "组织架构"],
        "招聘配置": ["招聘", "面试", "录用", "试用期", "入职", "竞业", "候选人"],
        "培训开发": ["培训", "培养", "学习", "课程", "讲师", "导师", "入职培训"],
        "薪酬福利": ["薪酬", "工资", "奖金", "宽带", "激励", "福利", "股权"],
        "绩效管理": ["绩效", "考核", "KPI", "OKR", "面谈", "评估", "目标管理"],
        "员工关系": ["解除", "裁员", "离职", "劳动", "仲裁", "投诉", "合同", "纠纷"],
        "企业文化": ["文化", "价值观", "团建", "活动", "年会", "员工关怀"],
    }

    for category, keywords in category_keywords.items():
        for kw in keywords:
            if kw in question:
                return category

    return None


# ═══════════════════════════════════════════════
# 热门问题
# ═══════════════════════════════════════════════

def get_hot_questions(db: Session, user_id: str) -> list[dict[str, str]]:
    """获取热门问题列表。

    MVP：返回预设的6个HR高频问题。
    生产环境：基于用户搜索历史 + 全局热门统计动态生成。
    """
    # 尝试获取用户最近的问答历史，个性化推荐
    recent_qs = (
        db.query(QaConversation.question)
        .filter(
            QaConversation.user_id == user_id,
            QaConversation.deleted_at.is_(None),
        )
        .order_by(desc(QaConversation.created_at))
        .limit(3)
        .all()
    )

    # 如果用户有历史提问，优先推荐相关领域的问题
    if recent_qs:
        # 简单去重+补充默认问题
        asked = {q[0][:20] for q in recent_qs if q[0]}
        personalized = [{"id": "hq_hist", "text": f"追问：{q[0][:40]}..."} for q in recent_qs[:2] if q[0]]
        # 补充默认热门
        defaults = [hq for hq in HOT_QUESTIONS_DEFAULT if not any(
            hq["text"][:10] in a for a in asked
        )]
        return personalized + defaults[:4]

    return HOT_QUESTIONS_DEFAULT


# ═══════════════════════════════════════════════
# 搜索问答历史
# ═══════════════════════════════════════════════

def search_qa_history(
    db: Session, user_id: str, query: str | None = None,
) -> list[dict[str, Any]]:
    """搜索用户的问答历史。"""
    q = db.query(QaConversation).filter(
        QaConversation.user_id == user_id,
        QaConversation.deleted_at.is_(None),
    )

    if query:
        q = q.filter(QaConversation.question.ilike(f"%{query}%"))

    convs = q.order_by(desc(QaConversation.created_at)).limit(20).all()

    result = []
    for conv in convs:
        answer = None
        if conv.answer_id:
            ans = db.query(QaAnswer).filter(
                QaAnswer.id == conv.answer_id,
                QaAnswer.deleted_at.is_(None),
            ).first()
            if ans:
                answer = _build_answer_out(ans)

        result.append({
            "conversation_id": conv.id,
            "question": conv.question,
            "rounds": conv.rounds or 0,
            "status": conv.status or "active",
            "latest_answer": answer,
            "created_at": conv.created_at.isoformat() if conv.created_at else "",
        })

    return result
