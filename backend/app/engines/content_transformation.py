"""内容转化引擎 — 灵魂层：知识→技能→经验三层转化 (SK-5.0)

知识(Know) → 技能(Do) → 经验(Master) → 智慧(Pattern Recognition)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger("content_transformation")


class ContentTransformationPipeline:
    """知识→技能→经验 三层转化管道。

    第一层：知识→技能(Know → Do)
      触发：用户通过智能问答获取了知识
      转化：知识 → 实操SOP卡片

    第二层：技能→经验(Do → Master)
      触发：用户多次执行同类SOP + 暮有复盘过程中
      转化：单一技能的SOP → 场景化的策略手册

    第三层：经验→智慧(Pattern Recognition)
      触发：用户积累≥10个经验级文档 + 数据分析发现跨模块模式
      转化：跨场景的模式识别 → 个人方法论
    """

    @staticmethod
    def transform_knowledge_to_skill(
        qa_result: dict[str, Any],
        user_id: str,
    ) -> dict[str, Any] | None:
        """第一层转化: 知识→技能。

        从问答的四要素答案中提取操作要点，封装为可执行的Skill卡片。

        Returns:
            Skill卡片数据，含: title, steps, preconditions, verification, tags
        """
        elements = qa_result.get("elements", [])
        if not elements:
            return None

        # 提取操作要点
        key_points = next(
            (e for e in elements if e.get("key") == "key-points"), None
        )
        if not key_points:
            return None

        steps = key_points.get("detail", [])
        if not steps:
            return None

        skill_card = {
            "skill_level": "可执行",
            "title": f"实操: {qa_result.get('question', '未命名')[:40]}",
            "steps": steps,
            "preconditions": "适用于HR相关工作场景",
            "verification": "执行后确认结果是否符合预期",
            "tags": ["知识转化", "skill_level:可执行"],
            "source": "smart_qa",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        logger.info(
            "知识→技能转化: user=%s title=%s steps=%d",
            user_id[:8], skill_card["title"], len(steps),
        )

        return skill_card

    @staticmethod
    def transform_skill_to_experience(
        sop: dict[str, Any],
        execution_count: int,
        user_modifications: list[str] | None = None,
    ) -> dict[str, Any] | None:
        """第二层转化: 技能→经验。

        触发条件：用户多次执行同类SOP(≥3次)。

        Args:
            sop: 原始SOP数据
            execution_count: 执行次数
            user_modifications: 用户自定义修改记录

        Returns:
            升级后的策略手册数据
        """
        if execution_count < 3:
            return None  # 未达转化门槛

        experience = {
            "skill_level": "经验级",
            "title": f"策略手册: {sop.get('title', '未命名')}",
            "original_sop_id": sop.get("id"),
            "execution_count": execution_count,
            "user_customizations": user_modifications or [],
            "variants": [
                {
                    "scenario": "标准情境",
                    "approach": "按标准SOP执行",
                },
            ],
            "tags": ["经验级", f"执行{execution_count}次"],
            "upgraded_at": datetime.now(timezone.utc).isoformat(),
        }

        logger.info(
            "技能→经验转化: sop=%s executions=%d",
            sop.get("title", "")[:30], execution_count,
        )

        return experience

    @staticmethod
    def recognize_patterns(
        user_id: str,
        experience_docs: list[dict[str, Any]],
    ) -> dict[str, Any] | None:
        """第三层转化: 经验→智慧(模式识别)。

        触发条件：用户积累≥10个经验级文档。

        Returns:
            个人能力地图和建议
        """
        if len(experience_docs) < 10:
            return None

        # 简单聚类：按标签分组统计
        topic_counts: dict[str, int] = {}
        for doc in experience_docs:
            tags = doc.get("tags", [])
            for tag in tags:
                if tag not in ("经验级", "知识转化"):
                    topic_counts[tag] = topic_counts.get(tag, 0) + 1

        # 找出擅长领域（数量最多的主题）
        strengths = sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)[:3]
        strength_areas = [s[0] for s in strengths]

        # 识别薄弱领域
        all_topics = {"薪酬", "绩效", "招聘", "培训", "员工关系", "组织发展", "企业文化", "战略"}
        covered_topics = set(topic_counts.keys())
        gaps = list(all_topics - covered_topics)

        result = {
            "total_experiences": len(experience_docs),
            "strength_areas": strength_areas,
            "growth_areas": gaps[:3],
            "suggestion": "",
        }

        if strength_areas:
            result["suggestion"] = (
                f"姐，您在{strength_areas[0]}这块已经有{len(experience_docs)}份经验了，"
                f"要不要试着把这些串成一套自己的方法论？"
            )

        logger.info(
            "经验→智慧转化: user=%s strengths=%s gaps=%s",
            user_id[:8], strength_areas, gaps,
        )

        return result


class XiejunLibraryContentPipeline:
    """携君智库内容生产 → 审核 → 标准化 → 入库流程。

    内容来源:
    - 安老师团队创作(主要来源)
    - 用户授权分享(从私有库→携带水印入携君库)
    - 行业公开内容(合法采集+平台整理)
    """

    @staticmethod
    def auto_review(content: dict[str, Any]) -> dict[str, Any]:
        """自动审核内容质量。

        Returns:
            {score, passed, issues}
        """
        issues = []
        score = 100

        # 内容深度检查
        text = str(content.get("content", ""))
        if len(text) < 200:
            score -= 30
            issues.append("内容过短(<200字)")

        # 结构完整性检查
        required_sections = ["背景", "方法", "步骤"]
        for section in required_sections:
            if section not in text:
                score -= 10
                issues.append(f"缺少{section}部分")

        passed = score >= 60
        return {
            "score": score,
            "passed": passed,
            "issues": issues,
            "suggestion": "退回修改" if score < 60 else (
                "人工审核" if score < 80 else "自动通过"
            ),
        }

    @staticmethod
    def standardize(content: dict[str, Any]) -> dict[str, Any]:
        """内容标准化：统一模板、标签化、关联。

        Returns:
            标准化后的文档数据
        """
        standardized = dict(content)

        # 统一模板结构
        if "template" not in standardized:
            standardized["template"] = "背景→方法论→步骤→案例→注意事项"

        # 标签化
        tags = standardized.get("tags", [])
        hr_modules = ["招聘配置", "薪酬福利", "绩效管理", "培训开发", "员工关系"]
        for mod in hr_modules:
            if mod in str(content.get("title", "")) or mod in str(content.get("content", "")):
                if mod not in tags:
                    tags.append(mod)

        standardized["tags"] = tags
        standardized["standardized_at"] = datetime.now(timezone.utc).isoformat()

        return standardized
