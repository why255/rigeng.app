"""LLM 工具函数：JSON解析、结构化Prompt构建等。

所有需要从LLM文本回复中提取结构化数据的模块共用此工具。
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


class LLMParsingError(Exception):
    """LLM返回内容无法解析为预期结构。"""

    def __init__(self, message: str, raw_content: str = ""):
        self.raw_content = raw_content[:500]  # 截断以保护日志
        super().__init__(message)


def extract_json_from_llm_response(content: str) -> dict | list:
    """从LLM文本回复中提取JSON对象/数组。

    处理常见情况：
    - ```json ... ``` 或 ``` ... ``` markdown代码块
    - JSON前后有额外自然语言文本
    - 中文标点干扰

    Raises:
        LLMParsingError: 无法提取有效JSON
    """
    if not content or not content.strip():
        raise LLMParsingError("LLM返回空内容", "")

    text = content.strip()

    # 策略1: 尝试直接解析（LLM可能直接输出纯JSON）
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 策略2: 提取 ```json ... ``` 或 ``` ... ``` 代码块
    code_block_pattern = r'```(?:json)?\s*\n?(.*?)\n?```'
    matches = re.findall(code_block_pattern, text, re.DOTALL)
    for match in matches:
        try:
            return json.loads(match.strip())
        except json.JSONDecodeError:
            continue

    # 策略3: 查找第一个 { 和最后一个 }（最外层JSON对象）
    first_brace = text.find('{')
    last_brace = text.rfind('}')
    if first_brace != -1 and last_brace > first_brace:
        candidate = text[first_brace:last_brace + 1]
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    # 策略4: 查找第一个 [ 和最后一个 ]（JSON数组）
    first_bracket = text.find('[')
    last_bracket = text.rfind(']')
    if first_bracket != -1 and last_bracket > first_bracket:
        candidate = text[first_bracket:last_bracket + 1]
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    raise LLMParsingError(
        f"无法从LLM回复中提取有效JSON（内容前100字符: {text[:100]}）",
        raw_content=content,
    )


def safe_extract_json(content: str, default: Any = None) -> dict | list | None:
    """安全提取JSON，失败时返回default而非抛异常。

    Args:
        content: LLM返回的原始文本
        default: 解析失败时的默认返回值

    Returns:
        解析后的dict/list，或default
    """
    try:
        return extract_json_from_llm_response(content)
    except (LLMParsingError, Exception) as e:
        logger.warning("JSON解析失败: %s", e)
        return default


# ── 标准化JSON输出指令 ──

JSON_OUTPUT_INSTRUCTION = (
    "\n\n请以严格的JSON格式输出，不要包含markdown代码块标记（不要用```json```包裹），"
    "只输出纯JSON对象。确保所有字符串使用双引号，不要使用单引号。"
    "JSON的属性名必须使用双引号。"
)


def build_structured_prompt(
    task_description: str,
    input_data: dict[str, str],
    output_schema_desc: str,
) -> str:
    """构建要求LLM输出结构化JSON的prompt。

    Args:
        task_description: 任务描述
        input_data: 输入数据 dict（key为字段名，value为内容）
        output_schema_desc: 期望的JSON schema描述

    Returns:
        完整的用户prompt字符串
    """
    parts = [task_description, ""]

    for label, value in input_data.items():
        if value:
            parts.append(f"{label}：\n{value}\n")

    parts.append(f"输出格式要求：\n{output_schema_desc}")
    parts.append(JSON_OUTPUT_INSTRUCTION)

    return "\n".join(parts)
