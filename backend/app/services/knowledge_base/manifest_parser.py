"""携君智库接入 — A2 Manifest解析器。

从zip包中提取并校验 manifest.json，按 action 字段分派文件操作。
"""
from __future__ import annotations

import hashlib
import json
import zipfile
from typing import Any


# manifest.json 必需顶层字段
_REQUIRED_TOP_FIELDS = ("package_id", "package_time", "files")
# files[] 中每个条目的必需字段
_REQUIRED_FILE_FIELDS = ("path", "action", "checksum", "yaml_summary")
# 合法的 action 值
VALID_ACTIONS = ("new", "updated", "deleted")


def parse_manifest(zip_path: str) -> dict[str, Any]:
    """从 zip 包中提取并解析 manifest.json。

    Args:
        zip_path: zip 文件路径。

    Returns:
        解析后的 manifest 字典。

    Raises:
        ValueError: manifest.json 不存在、JSON 格式错误、或结构校验失败。
    """
    with zipfile.ZipFile(zip_path, "r") as zf:
        # 查找 manifest.json（支持根目录或嵌套一层目录）
        manifest_path = None
        for name in zf.namelist():
            if name.endswith("manifest.json") and (name == "manifest.json" or name.count("/") <= 1):
                manifest_path = name
                break

        if manifest_path is None:
            raise ValueError("zip包中未找到 manifest.json")

        raw = zf.read(manifest_path).decode("utf-8")

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"manifest.json JSON格式错误: {e}") from e

    errors = validate_manifest(data)
    if errors:
        raise ValueError(f"manifest.json 结构校验失败: {'; '.join(errors)}")

    return data


def validate_manifest(data: dict[str, Any]) -> list[str]:
    """校验 manifest.json 结构是否符合合同约定。

    Args:
        data: 已解析的 manifest 字典。

    Returns:
        错误信息列表，空列表表示校验通过。
    """
    errors: list[str] = []

    for field in _REQUIRED_TOP_FIELDS:
        if field not in data:
            errors.append(f"缺少顶层字段: {field}")

    if "files" not in data:
        return errors

    files = data["files"]
    if not isinstance(files, list):
        errors.append("files 字段必须是数组")
        return errors

    for i, f in enumerate(files):
        prefix = f"files[{i}]"
        if not isinstance(f, dict):
            errors.append(f"{prefix}: 必须是对象")
            continue
        for field in _REQUIRED_FILE_FIELDS:
            if field not in f:
                errors.append(f"{prefix}: 缺少字段 {field}")
        action = f.get("action", "")
        if action and action not in VALID_ACTIONS:
            errors.append(f"{prefix}: 非法 action={action}, 合法值: {', '.join(VALID_ACTIONS)}")
        # 校验 checksum 格式: sha256:xxxx
        checksum = f.get("checksum", "")
        if checksum and not checksum.startswith("sha256:"):
            errors.append(f"{prefix}: checksum 格式错误, 应为 sha256:xxx")

    # 校验 deleted_files（可选）
    deleted = data.get("deleted_files", [])
    if deleted and not isinstance(deleted, list):
        errors.append("deleted_files 字段必须是数组")

    return errors


def dispatch_files(manifest: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    """按 action 字段分派文件操作。

    Args:
        manifest: 已校验的 manifest 字典。

    Returns:
        {"new": [...], "updated": [...], "deleted": [...]}
        其中 deleted 包含 deleted_files 中的路径字符串。
    """
    result: dict[str, list[dict[str, Any]]] = {
        "new": [],
        "updated": [],
        "deleted": [],
    }

    for f in manifest.get("files", []):
        action = f.get("action", "new")
        if action in result:
            result[action].append(f)

    # deleted_files 是纯路径字符串列表
    for path in manifest.get("deleted_files", []):
        result["deleted"].append({"path": path, "action": "deleted"})

    return result


def verify_checksum(zip_path: str, file_path: str, expected_checksum: str) -> bool:
    """验证 zip 内单个文件的 SHA256 校验和。

    Args:
        zip_path: zip 文件路径。
        file_path: zip 内的文件路径。
        expected_checksum: 期望的校验和，格式 "sha256:xxxx"。

    Returns:
        True 表示校验通过。
    """
    if not expected_checksum.startswith("sha256:"):
        return False

    expected = expected_checksum[7:]  # 去掉 "sha256:" 前缀

    with zipfile.ZipFile(zip_path, "r") as zf:
        try:
            content = zf.read(file_path)
        except KeyError:
            return False

    actual = hashlib.sha256(content).hexdigest()
    return actual == expected


def extract_file_content(zip_path: str, file_path: str) -> bytes:
    """从 zip 中提取单个文件的内容。

    Args:
        zip_path: zip 文件路径。
        file_path: zip 内的文件路径。

    Returns:
        文件原始字节。

    Raises:
        KeyError: 文件在 zip 中不存在。
    """
    with zipfile.ZipFile(zip_path, "r") as zf:
        return zf.read(file_path)
