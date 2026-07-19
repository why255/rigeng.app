"""携君智库接入 — A3 YAML字段映射器。

解析 Markdown 文档头部的 YAML frontmatter，按合同约定映射到 Document 模型字段。
"""
from __future__ import annotations

import re
from typing import Any

import yaml

from ...shared.models.knowledge import (
    CONTENT_TYPES,
    CRYSTAL_TYPES,
    HR_MODULES,
    ORIGIN_TYPES,
    SENSITIVITY_LEVELS,
    WISDOM_TAGS,
)

# YAML frontmatter 正则：匹配 ^---\n...\n---\n
_YAML_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)

# 必填字段（合同约定）
_REQUIRED_YAML_FIELDS = ("citation_title", "hr_module", "content_type")


def extract_yaml_frontmatter(md_content: str) -> tuple[dict[str, Any], str]:
    """从 Markdown 内容中提取 YAML frontmatter 和正文。

    Args:
        md_content: 完整的 .md 文件内容。

    Returns:
        (yaml_dict, body_text) — yaml_dict 为解析后的字典，
        若文档无 frontmatter 则返回空字典。

    Raises:
        ValueError: YAML 解析失败。
    """
    match = _YAML_FRONTMATTER_RE.match(md_content)
    if not match:
        return {}, md_content

    yaml_text = match.group(1)
    body = md_content[match.end():]

    try:
        yaml_data = yaml.safe_load(yaml_text)
    except yaml.YAMLError as e:
        raise ValueError(f"YAML frontmatter 解析失败: {e}") from e

    if yaml_data is None:
        yaml_data = {}

    if not isinstance(yaml_data, dict):
        raise ValueError("YAML frontmatter 必须是键值对映射")

    return yaml_data, body


def validate_required_fields(yaml_data: dict[str, Any]) -> list[str]:
    """检查 YAML 数据中的必填字段。

    Args:
        yaml_data: 解析后的 YAML 字典。

    Returns:
        缺失的必填字段名列表，空列表表示全部通过。
    """
    missing = []
    for field in _REQUIRED_YAML_FIELDS:
        if not yaml_data.get(field):
            missing.append(field)
    return missing


def map_yaml_to_document(
    yaml_data: dict[str, Any],
    body_text: str,
    file_path: str,
) -> dict[str, Any]:
    """将 YAML frontmatter 映射为 Document 模型构造参数。

    映射规则严格按《日耕后台接口约定.md》§三 A3 执行。

    Args:
        yaml_data: 解析后的 YAML 字典。
        body_text: Markdown 正文（去掉 frontmatter 后的部分）。
        file_path: zip 内文件路径（用于日志/错误信息）。

    Returns:
        dict，可直接作为 Document(**kwargs) 的参数。
        包含所有合同约定字段 + content。
    """
    result: dict[str, Any] = {}

    # ── 直接映射字段 ──
    result["title"] = _str_or_none(yaml_data.get("title"))
    result["citation_title"] = _str_or_none(yaml_data.get("citation_title"))
    result["source_id"] = _str_or_none(yaml_data.get("source_id"))
    result["version_number"] = _str_or_none(yaml_data.get("version"))
    result["summary"] = _str_or_none(yaml_data.get("summary"))

    # ── 枚举字段（带校验） ──
    result["hr_module"] = _validate_enum(
        yaml_data.get("hr_module"), HR_MODULES, "hr_module"
    )
    result["content_type"] = _validate_enum(
        yaml_data.get("content_type"), CONTENT_TYPES, "content_type"
    )
    result["sensitivity"] = _validate_enum(
        yaml_data.get("sensitivity", "L1"), SENSITIVITY_LEVELS, "sensitivity"
    )
    result["origin_type"] = _validate_enum(
        yaml_data.get("origin_type", "manual"), ORIGIN_TYPES, "origin_type"
    )

    # ── 布尔字段 ──
    result["is_wisdom"] = bool(yaml_data.get("is_wisdom", False))

    # ── JSON数组字段 ──
    wisdom_tags = yaml_data.get("wisdom_tags", [])
    if wisdom_tags and isinstance(wisdom_tags, list):
        # 校验每个标签在允许值内
        valid_tags = [t for t in wisdom_tags if t in WISDOM_TAGS]
        result["wisdom_tags"] = valid_tags
    elif wisdom_tags:
        result["wisdom_tags"] = [wisdom_tags] if isinstance(wisdom_tags, str) else []

    crystal_type = yaml_data.get("crystal_type")
    if crystal_type:
        result["crystal_type"] = _validate_enum(crystal_type, CRYSTAL_TYPES, "crystal_type")

    keywords = yaml_data.get("keywords", [])
    if keywords and isinstance(keywords, list):
        result["keywords"] = keywords
    elif keywords and isinstance(keywords, str):
        result["keywords"] = [k.strip() for k in keywords.split(",") if k.strip()]

    # ── 6组关联字段（JSON） ──
    for rel_field in (
        "related_upstream", "related_downstream", "related_scenario",
        "related_industry", "related_source", "related_version",
    ):
        val = yaml_data.get(rel_field)
        if val and isinstance(val, (list, dict)):
            result[rel_field] = val

    # ── 双引擎交叉 ──
    for cross_field in ("wisdom_applied", "professional_applied"):
        val = yaml_data.get(cross_field)
        if val and isinstance(val, (list, dict)):
            result[cross_field] = val

    # ── 文档正文 ──
    result["content"] = {
        "markdown": body_text,
        "source_file": file_path,
    }

    # ── 固定字段 ──
    result["library_type"] = "public"
    result["doc_type"] = _map_content_type_to_doc_type(result.get("content_type", ""))
    result["status"] = "published"  # 携君库文档直接发布
    result["audit_status"] = "passed"
    result["watermark_required"] = True
    result["copy_char_limit"] = 500
    result["vector_status"] = "pending"
    result["version"] = 1

    # sensitivity=L2 需要人工审核
    if result["sensitivity"] == "L2":
        result["audit_status"] = "pending"

    return result


def _str_or_none(val: Any) -> str | None:
    """将值转为字符串或返回 None。"""
    if val is None:
        return None
    if isinstance(val, str):
        return val.strip() or None
    return str(val).strip() or None


def _validate_enum(val: Any, allowed: tuple[str, ...], field_name: str) -> str | None:
    """校验枚举值并返回，非法值抛出 ValueError。"""
    if val is None:
        return None
    s = str(val).strip()
    if s and s not in allowed:
        raise ValueError(
            f"字段 {field_name} 的值 '{s}' 不在允许范围内: {', '.join(allowed)}"
        )
    return s or None


def _map_content_type_to_doc_type(content_type: str) -> str:
    """将合同约定的 content_type 映射到系统内部 doc_type。

    合同 content_type: 观点/方法论/SOP/流程/制度/表单/数据/案例/技能晶体
    系统 doc_type: sop/improvement_strategy/.../skill_crystal 等
    """
    mapping = {
        "观点": "improvement_strategy",
        "方法论": "improvement_guide",
        "SOP": "sop",
        "流程": "sop",
        "制度": "project_doc",
        "表单": "project_doc",
        "数据": "extraction_report",
        "案例": "growth_story",
        "技能晶体": "skill_crystal",
    }
    return mapping.get(content_type, "user_note")
