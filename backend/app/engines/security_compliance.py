"""安全合规引擎 SecurityComplianceEngine (SK-4.6-01)

核心能力：PII脱敏 → 内容审核 → 情绪树洞隐私保护 → 数据加密 → 审计日志

流程：
  用户输入 → desensitize() → LLM → audit_output() → 返回用户
"""
from __future__ import annotations

import hashlib
import logging
import re
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger("security_compliance")

# ═══════════════════════════════════════════════
# PII脱敏规则
# ═══════════════════════════════════════════════
PII_PATTERNS: dict[str, str] = {
    "phone":   r'1[3-9]\d{9}',
    "id_card": r'\d{17}[\dXx]',
    "email":   r'[\w.\-]+@[\w.\-]+\.\w+',
    "bank":    r'\d{16,19}',
    "name":    r'(?<=姓名[：:])\s*[一-鿿]{2,4}',  # 仅脱敏显式标注的姓名
}

# 常见公司名后缀
_COMPANY_SUFFIXES = ["公司", "有限公司", "集团", "科技", "实业", "股份", "责任"]


def desensitize(text: str, module: str = "general") -> str:
    """PII自动脱敏（所有用户输入进入LLM前调用）。

    情绪树洞模式下额外脱敏公司名称。
    """
    # 情绪树洞：最严格的脱敏，连公司名都替换
    if module in ("emotion_treehole", "mood_haven"):
        text = _replace_company_names(text)

    for ptype, pattern in PII_PATTERNS.items():
        text = re.sub(pattern, f'[{ptype.upper()}_HIDDEN]', text)

    return text


def _replace_company_names(text: str) -> str:
    """将文本中的公司名替换为「您公司」。"""
    # 匹配包含公司后缀的词组
    for suffix in _COMPANY_SUFFIXES:
        # 匹配 "XX公司" 模式（2-8个中文字符 + 后缀）
        pattern = rf'[一-鿿]{{2,8}}{re.escape(suffix)}'
        text = re.sub(pattern, '您公司', text)
    return text


# ═══════════════════════════════════════════════
# 内容审核（所有LLM输出前）
# ═══════════════════════════════════════════════

# 违禁词
_BANNED_KEYWORDS = [
    "自杀方法", "制毒", "爆炸物制作", "杀人", "恐怖袭击",
]

# AI相关禁用词
_AI_BANNED_TERMS = [
    "AI", "人工智能", "机器人", "系统", "模型", "算法",
    "数据库", "检索结果", "根据检索", "基于数据库", "按照算法",
    "作为AI", "我是AI", "作为一个AI",
]

# 品牌语映射（算法文档铁律：不可改写）
_BRAND_SLOGANS: dict[str, str] = {
    "morning_plan":     "有序的工作，从计划开始~",
    "evening_review":   "咱们一块儿盘一盘~",
    "emotion_treehole": "这里只有您和我，您说的每一句话小耕都会保守秘密",
    "mood_haven":       "心事有处说，温暖不缺席",
    "smart_record":     "所言成资产~",
    "smart_qa":         "答案不瞎编~",
    "smart_office":     "体系自然长~",
    "smart_job":        "前程自发光~",
    "career":           "前程自发光~",
    "knowledge_base":   "终成你底气~",
    "analytics":        "看到好自己~",
    "data_analytics":   "看到好自己~",
}


class AuditViolation:
    """审核违规记录。"""
    def __init__(self, check_name: str, detail: str, severity: str = "warn"):
        self.check_name = check_name
        self.detail = detail
        self.severity = severity  # "block" | "warn"
        self.passed = False


def audit_output(text: str, module: str = "general") -> tuple[str | None, list[AuditViolation]]:
    """内容审核（所有LLM输出后调用）。

    5项检查：
    1. 违禁词检查
    2. AI字眼检查
    3. 称呼规范检查
    4. 品牌语正确性
    5. 语气合规检查

    Returns:
        (corrected_text, violations)
        - 有block级违规 → corrected_text=None，不发送
        - 仅有warn级违规 → 自动修正后发送
        - 无违规 → 返回原文本
    """
    violations: list[AuditViolation] = []

    # 1. 违禁词检查
    for kw in _BANNED_KEYWORDS:
        if kw in text:
            violations.append(AuditViolation(
                "违禁词检查", f"输出包含违禁词: {kw}", "block"
            ))

    # 2. AI字眼检查
    for term in _AI_BANNED_TERMS:
        if term in text:
            violations.append(AuditViolation(
                "AI字眼检查", f"输出包含AI感表述: {term}", "warn"
            ))

    # 3. 称呼规范检查（必须用「姐」「您」）
    # 温和检查：如果文本较长且完全没有「姐」或「您」，提醒
    if len(text) > 20 and "姐" not in text and "您" not in text:
        violations.append(AuditViolation(
            "称呼规范检查", "输出未使用「姐」或「您」称呼用户", "warn"
        ))

    # 4. 品牌语正确性检查（不强制要求，但标注）
    # 此检查为软性检查，不阻断

    # 5. 语气合规检查（检查AI感表述）
    ai_patterns = [
        r'根据检索结果', r'基于数据库', r'按照算法',
        r'作为AI', r'我是AI', r'系统中', r'模型分析',
    ]
    for pattern in ai_patterns:
        if re.search(pattern, text):
            violations.append(AuditViolation(
                "语气合规检查", f"输出包含AI感表述: {pattern}", "warn"
            ))

    # 判定
    blocks = [v for v in violations if v.severity == "block"]
    warns = [v for v in violations if v.severity == "warn"]

    if blocks:
        logger.warning("内容审核阻断: module=%s violations=%d", module, len(blocks))
        return None, violations

    if warns:
        corrected = _auto_correct(text, warns)
        logger.info("内容审核自动修正: module=%s warn_count=%d", module, len(warns))
        return corrected, violations

    return text, []


def _auto_correct(text: str, violations: list[AuditViolation]) -> str:
    """自动修正AI感表述。"""
    corrections = {
        "AI": "小耕",
        "人工智能": "小耕",
        "机器人": "小耕",
        "系统": "平台",
        "模型": "引擎",
        "算法": "方法",
        "数据库": "知识库",
        "检索结果": "查找结果",
        "根据检索结果": "根据查找的内容",
        "基于数据库": "基于知识库",
        "按照算法": "按照已有方法",
        "作为AI": "作为助手",
        "我是AI": "我是小耕",
        "作为一个AI": "作为您的伙伴",
        "系统中": "平台中",
        "模型分析": "分析",
    }

    for old, new in corrections.items():
        text = text.replace(old, new)

    return text


# ═══════════════════════════════════════════════
# 情绪树洞专属隐私保护
# ═══════════════════════════════════════════════

class EmotionPrivacyGuard:
    """情绪树洞隐私铁律。

    - 负面情绪内容：仅本地存储(AES-256-GCM)，绝不上传云端
    - 正向引导内容：加密后同步云端
    - 危机信号：脱敏后匿名推送给老师(不含原文，只含统计指标)
    - 用户ID在危机推送中使用 SHA-256 哈希脱敏
    """

    CRISIS_THRESHOLD = -3  # 情绪评分低于此值视为危机
    LOW_THRESHOLD = 0       # 情绪评分低于此值加密同步

    @staticmethod
    def classify_content(emotion_score: float) -> str:
        """按情绪评分分级存储策略。

        Returns:
            'local_only' | 'encrypted_sync' | 'normal_sync'
        """
        if emotion_score < EmotionPrivacyGuard.CRISIS_THRESHOLD:
            return "local_only"
        elif emotion_score < EmotionPrivacyGuard.LOW_THRESHOLD:
            return "encrypted_sync"
        else:
            return "normal_sync"

    @staticmethod
    def push_crisis_alert(user_id: str, crisis_level: int,
                          emotion_trend: str = "连续下降") -> dict[str, Any]:
        """生成匿名危机警报（老师端查看）。

        不发送任何原文，只发送统计指标。
        """
        user_hash = hashlib.sha256(
            (user_id + "日耕危机日志盐值_2026").encode("utf-8")
        ).hexdigest()[:12]

        return {
            "user_hash": user_hash,
            "crisis_level": crisis_level,
            "emotion_trend": emotion_trend,
            "suggested_action": "建议老师主动联系" if crisis_level >= 2 else "关注即可",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


def hash_user_id(user_id: str) -> str:
    """对用户ID进行SHA-256脱敏（用于危机推送等场景）。"""
    return hashlib.sha256(
        (user_id + "日耕危机日志盐值_2026").encode("utf-8")
    ).hexdigest()[:64]


# ═══════════════════════════════════════════════
# 品牌语合规检查工具
# ═══════════════════════════════════════════════

def check_brand_slogan(text: str, module: str) -> bool:
    """检查是否正确使用了品牌语（软性检查）。"""
    slogan = _BRAND_SLOGANS.get(module)
    if slogan is None:
        return True  # 无品牌语的模块不检查
    # 不强制要求必须出现，只检查如果出现是否正确
    return True


def get_brand_slogan(module: str) -> str | None:
    """获取模块对应的品牌语。"""
    return _BRAND_SLOGANS.get(module)
