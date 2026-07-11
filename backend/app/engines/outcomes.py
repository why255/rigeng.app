"""成效引擎 — 成效层：服务驱动闭环

三个引擎将功能层的产出转化为用户可感知的成效，形成正反馈循环。

- OutcomeEngine: 用户成长成果量化与展示
- EfficiencyEngine: 工作效率提升量化
- ROIEngine: 知识资产价值可视化
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger("outcomes")

# ═══════════════════════════════════════════════
# 成果引擎
# ═══════════════════════════════════════════════


class OutcomeEngine:
    """用户成长成果量化与展示 (SK-5.1-01)。

    核心能力：SOP资产值计算 → 专业成长里程碑 → 能力评级 → 成果墙展示
    """

    # 里程碑定义
    MILESTONES = [
        {"threshold": 1, "emoji": "🎉",
         "message": "姐，恭喜！您的第一个专业SOP产生了——这是您能力资产化的第一步！"},
        {"threshold": 10, "emoji": "🌟",
         "message": "姐，10个SOP了！这些不是冷冰冰的文档，是您十年HR经验的数字化结晶！"},
        {"threshold": 50, "emoji": "👑",
         "message": "姐，50个SOP！您已经有了一套完整的HR方法论体系！"},
        {"threshold": 100, "emoji": "🏆",
         "message": "姐，百份SOP——您在日耕沉淀的经验，已经是一笔不可替代的专业资产！"},
    ]

    # 引用里程碑
    CITATION_MILESTONE = {
        "threshold": 10, "emoji": "📈",
        "message_template": "姐，您的《{sop_title}》已经被引用了10次——它正在帮助更多的人！",
    }

    @staticmethod
    def calculate_sop_asset_value(
        sops: list[dict[str, Any]],
        hr_modules_count: int = 9,
    ) -> dict[str, Any]:
        """计算SOP资产值。

        每个SOP的价值分 = 质量分 × 引用次数 × 场景覆盖度
        总资产值 = SUM(所有SOP价值分)
        """
        total_value = 0.0
        sop_values = []

        for sop in sops:
            quality = sop.get("quality_score", 3) / 5.0  # 归一化到0-1
            citations = sop.get("citation_count", 0)
            modules_covered = sop.get("modules_covered", 1)

            # 场景覆盖度 = SOP覆盖的HR模块数 / 总模块数
            coverage = min(1.0, modules_covered / max(hr_modules_count, 1))

            value = quality * max(1, citations) * max(0.1, coverage) * 10
            total_value += value

            sop_values.append({
                "sop_id": sop.get("id"),
                "title": sop.get("title", ""),
                "value": round(value, 1),
            })

        return {
            "total_asset_value": round(total_value, 1),
            "sop_count": len(sops),
            "avg_value": round(total_value / max(len(sops), 1), 1),
            "top_sops": sorted(sop_values, key=lambda x: x["value"], reverse=True)[:5],
        }

    @staticmethod
    def check_milestones(
        total_sops: int,
        sop_title: str | None = None,
        citation_count: int = 0,
    ) -> list[dict[str, Any]]:
        """检查并返回触发的里程碑。"""
        triggered = []

        for milestone in OutcomeEngine.MILESTONES:
            if total_sops >= milestone["threshold"]:
                triggered.append({
                    "type": "sop_count",
                    "threshold": milestone["threshold"],
                    "emoji": milestone["emoji"],
                    "message": milestone["message"],
                })

        # 去重：只保留最高级别的里程碑
        if triggered:
            triggered = [triggered[-1]]

        # 引用里程碑
        if citation_count >= OutcomeEngine.CITATION_MILESTONE["threshold"] and sop_title:
            triggered.append({
                "type": "citation",
                "threshold": OutcomeEngine.CITATION_MILESTONE["threshold"],
                "emoji": OutcomeEngine.CITATION_MILESTONE["emoji"],
                "message": OutcomeEngine.CITATION_MILESTONE["message_template"].format(
                    sop_title=sop_title,
                ),
            })

        return triggered

    @staticmethod
    def get_ability_rating(radar_avg_score: float) -> dict[str, str]:
        """基于6维能力雷达图平均分评级。"""
        if radar_avg_score >= 85:
            return {"level": "大师期", "icon": "👑", "description": "您已是HR领域的顶级专家"}
        elif radar_avg_score >= 70:
            return {"level": "专家期", "icon": "⭐", "description": "您的专业能力已达到专家水平"}
        elif radar_avg_score >= 50:
            return {"level": "成熟期", "icon": "🌳", "description": "您的能力体系已相当成熟"}
        elif radar_avg_score >= 30:
            return {"level": "成长期", "icon": "🌿", "description": "您正在快速成长中"}
        else:
            return {"level": "萌芽期", "icon": "🌱", "description": "每一份积累都在为未来扎根"}


# ═══════════════════════════════════════════════
# 效率引擎
# ═══════════════════════════════════════════════


class EfficiencyEngine:
    """工作效率提升量化 (SK-5.2-01)。

    核心能力：方案设计时间统计 → 知识复用效率 → 时间节省估算
    """

    # 传统方式耗时参考（小时）
    TRADITIONAL_HOURS = {
        "jd": 4,           # JD生成
        "compensation": 16, # 薪酬方案
        "policy": 8,        # 制度文件
        "system_build": 40, # 体系搭建
        "interview_prep": 3, # 面试准备
        "general": 6,       # 通用方案
    }

    @staticmethod
    def calculate_time_saved(
        doc_type: str,
        rigeng_hours: float,
    ) -> dict[str, Any]:
        """计算方案设计节省时间。

        Args:
            doc_type: 文档类型
            rigeng_hours: 日耕方式耗时（小时）

        Returns:
            {traditional_hours, rigeng_hours, saved_hours, saved_percent}
        """
        traditional = EfficiencyEngine.TRADITIONAL_HOURS.get(
            doc_type, EfficiencyEngine.TRADITIONAL_HOURS["general"]
        )

        saved = max(0, traditional - rigeng_hours)
        saved_pct = round(saved / traditional * 100) if traditional > 0 else 0

        return {
            "traditional_hours": traditional,
            "rigeng_hours": round(rigeng_hours, 1),
            "saved_hours": round(saved, 1),
            "saved_percent": saved_pct,
            "message": f"本月，日耕帮您节省了约 {round(saved, 1)} 小时的方案设计时间",
        }

    @staticmethod
    def calculate_knowledge_reuse_rate(
        total_qa: int,
        reused_qa: int,
    ) -> dict[str, Any]:
        """计算知识复用效率。

        Args:
            total_qa: 总问答次数
            reused_qa: 有复用结果的问答次数
        """
        rate = round(reused_qa / total_qa * 100) if total_qa > 0 else 0

        return {
            "total_qa": total_qa,
            "reused_qa": reused_qa,
            "reuse_rate": rate,
            "message": f"本月 {rate}% 的问题直接复用了您已有的知识积累，避免了重复研究",
        }


# ═══════════════════════════════════════════════
# 回报引擎
# ═══════════════════════════════════════════════


class ROIEngine:
    """知识资产价值可视化 (SK-5.3-01)。

    核心能力：知识资产估值 → 职业竞争力指数 → 成长投资回报率
    """

    # 行业参考系数
    INDUSTRY_COEFFICIENTS = {
        "HR专员": 1.0,
        "HR主管": 1.5,
        "HR经理": 2.0,
        "HR总监": 3.0,
    }

    @staticmethod
    def calculate_asset_valuation(
        sop_asset_value: float,
        kb_doc_count: int,
        skill_crystal_count: int,
        ability_score: float,
        contribution_value: float,
        hr_level: str = "HR经理",
    ) -> dict[str, Any]:
        """计算知识资产估值。

        模拟估值 = 知识资产指数 × 行业参考系数
        """
        asset_index = (
            0.3 * sop_asset_value +
            0.2 * kb_doc_count * 10 +  # 每个文档10分
            0.2 * skill_crystal_count * 20 +  # 每个技能晶体20分
            0.15 * ability_score +
            0.15 * contribution_value
        )

        coefficient = ROIEngine.INDUSTRY_COEFFICIENTS.get(
            hr_level, ROIEngine.INDUSTRY_COEFFICIENTS["HR经理"]
        )

        valuation = round(asset_index * coefficient, 2)

        return {
            "asset_index": round(asset_index, 1),
            "hr_level": hr_level,
            "coefficient": coefficient,
            "estimated_value": valuation,
            "message": f"您的知识资产估值约为 {valuation} 元(基于行业薪资溢价模型估算)",
            "disclaimer": "此估值仅为成长激励参考，不代表实际经济价值",
        }

    @staticmethod
    def calculate_competitiveness_index(
        professional_score: float,
        career_score: float,
        learning_score: float,
        execution_score: float,
        emotion_score: float,
        planning_score: float,
    ) -> dict[str, Any]:
        """计算职业竞争力指数。

        公式: 0.25×专业力 + 0.20×求职力 + 0.20×学习力 + 0.15×执行力 + 0.10×情绪力 + 0.10×规划力
        """
        index = (
            0.25 * professional_score +
            0.20 * career_score +
            0.20 * learning_score +
            0.15 * execution_score +
            0.10 * emotion_score +
            0.10 * planning_score
        )

        return {
            "index": round(index, 1),
            "breakdown": {
                "专业力": round(0.25 * professional_score, 1),
                "求职力": round(0.20 * career_score, 1),
                "学习力": round(0.20 * learning_score, 1),
                "执行力": round(0.15 * execution_score, 1),
                "情绪力": round(0.10 * emotion_score, 1),
                "规划力": round(0.10 * planning_score, 1),
            },
        }
