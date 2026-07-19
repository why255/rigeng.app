
"""
版本检查 API — 供 H5/APK 客户端检测更新。
"""
from __future__ import annotations

from fastapi import APIRouter

from ...shared.response import ok

router = APIRouter(tags=["版本/更新"])

CURRENT_VERSION = {
    "apk_version": "0.3.0",
    "apk_version_code": 3,
    "apk_url": "http://47.96.187.229/rigeng-latest.apk",
    "h5_version": "0.3.0",
    "h5_build_time": "2026-07-12T16:05:00+08:00",
    "release_notes": "全面同步：版本检测API、nginx安全配置、APK下载",
    "min_apk_version_code": 1,
}


@router.get("/version")
def get_version():
    return ok(CURRENT_VERSION)


@router.get("/version/check")
def check_version(
    apk_version_code: int = 0,
    h5_version: str = "0",
):
    needs_update = False
    update_info = {}

    if apk_version_code > 0 and apk_version_code < CURRENT_VERSION["apk_version_code"]:
        needs_update = True
        update_info = {
            "current_version": CURRENT_VERSION["apk_version"],
            "latest_version": CURRENT_VERSION["apk_version"],
            "download_url": CURRENT_VERSION["apk_url"],
            "release_notes": CURRENT_VERSION["release_notes"],
            "is_critical": apk_version_code < CURRENT_VERSION["min_apk_version_code"],
        }

    return ok({
        "needs_update": needs_update,
        "update": update_info,
        "server_version": CURRENT_VERSION,
    })
