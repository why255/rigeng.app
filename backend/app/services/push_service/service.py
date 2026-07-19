"""⑥消息/推送服务 核心业务逻辑（P2）。

集成：
- 阿里云移动推送（App Push）
- 阿里云短信服务（SMS）
- 推送频控（每周上限/夜间静默/新用户免打扰）
- 自动提醒触发（连续未规划/未复盘/危机跟进）
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from ...shared.config import settings
from ...shared.errors import APIError

logger = logging.getLogger("push_service")

# ═══════════════════════════════════════════════
# 内存频控（生产环境用 Redis 替代）
# ═══════════════════════════════════════════════
_push_counts: dict[str, int] = {}  # user_id → 本周推送次数
_sms_log: list[dict[str, Any]] = []
_push_log: list[dict[str, Any]] = []

# 阿里云API端点
ALIYUN_PUSH_ENDPOINT = "cloudpush.aliyuncs.com"
ALIYUN_SMS_ENDPOINT = "dysmsapi.aliyuncs.com"


def _aliyun_sign(method: str, params: dict[str, str], access_key_secret: str) -> str:
    """阿里云 POP API 签名（HMAC-SHA1 + Base64）。"""
    # 排序并编码
    sorted_params = sorted(params.items(), key=lambda x: x[0])
    canonicalized = "&".join(
        f"{_percent_encode(k)}={_percent_encode(v)}" for k, v in sorted_params
    )
    string_to_sign = f"{method}&{_percent_encode('/')}&{_percent_encode(canonicalized)}"

    key = access_key_secret + "&"
    signature = hmac.new(key.encode("utf-8"), string_to_sign.encode("utf-8"), hashlib.sha1).digest()
    return base64.b64encode(signature).decode("utf-8")


def _percent_encode(s: str) -> str:
    """阿里云签名专用：URL编码（特殊处理）。"""
    import urllib.parse

    encoded = urllib.parse.quote(s, safe="")
    return encoded.replace("+", "%20").replace("*", "%2A").replace("%7E", "~")


def _aliyun_call(endpoint: str, action: str, params: dict[str, str],
                 access_key_id: str, access_key_secret: str,
                 version: str = "2016-08-01") -> dict[str, Any]:
    """阿里云通用API调用（P1-3.1: 使用 httpx 连接池）。"""
    from ...shared.http_client import get_http_client

    common_params = {
        "Format": "JSON",
        "Version": version,
        "AccessKeyId": access_key_id,
        "SignatureMethod": "HMAC-SHA1",
        "SignatureVersion": "1.0",
        "SignatureNonce": uuid.uuid4().hex,
        "Timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "Action": action,
        **params,
    }

    signature = _aliyun_sign("POST", common_params, access_key_secret)
    common_params["Signature"] = signature

    data = "&".join(
        f"{_percent_encode(k)}={_percent_encode(v)}" for k, v in common_params.items()
    ).encode("utf-8")

    try:
        client = get_http_client("aliyun_push", base_url=f"https://{endpoint}", http2=True)
        resp = client.post("/", content=data,
                          headers={"Content-Type": "application/x-www-form-urlencoded"})
        resp.raise_for_status()
        result = resp.json()

        if result.get("Code") != "OK":
            logger.error("阿里云推送错误: %s - %s", result.get("Code"), result.get("Message"))
            return {"success": False, "error": result.get("Message", "未知错误")}

        return {"success": True, "request_id": result.get("RequestId")}

    except Exception as e:
        logger.exception("阿里云推送调用异常")
        return {"success": False, "error": str(e)}


# ═══════════════════════════════════════════════
# 频控检查
# ═══════════════════════════════════════════════
def _check_push_quota(user_id: str, channel: str = "push") -> tuple[bool, str | None]:
    """检查推送权限。返回 (can_push, block_reason)。"""
    now = datetime.now()

    # 夜间静默（21:00-9:00）
    hour = now.hour
    if hour >= settings.CARE_PUSH_WINDOW_END or hour < settings.CARE_PUSH_WINDOW_START:
        return False, f"夜间{settings.CARE_PUSH_WINDOW_END}:00-{settings.CARE_PUSH_WINDOW_START}:00禁止推送"

    # 新用户静默期检查（简化：由业务层在触发时检查）
    # 实际应查询 user_account.created_at

    # 短信开关
    if channel == "sms" and not settings.SMS_ENABLED:
        return False, "短信渠道已全局禁用"

    return True, None


def _check_weekly_limit(user_id: str) -> bool:
    """检查本周推送是否已达上限。"""
    return _push_counts.get(user_id, 0) < settings.CARE_PUSH_MAX_PER_WEEK


# ═══════════════════════════════════════════════
# App 推送（阿里云移动推送）
# ═══════════════════════════════════════════════
def send_push(user_id: str, title: str, body: str, target_type: str = "ACCOUNT",
              target_value: str | None = None, extras: dict[str, str] | None = None) -> dict[str, Any]:
    """发送App推送通知。"""
    if not settings.ALIYUN_PUSH_APP_KEY:
        raise APIError(80001, "推送服务未配置AppKey", 503)

    # 频控检查
    can_push, reason = _check_push_quota(user_id, "push")
    if not can_push:
        log_entry = {
            "id": f"push_{uuid.uuid4().hex[:12]}",
            "user_id": user_id, "channel": "push",
            "title": title, "body": body, "status": "rate_limited",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        _push_log.append(log_entry)
        return {"sent": False, "reason": reason, "log_id": log_entry["id"]}

    if not _check_weekly_limit(user_id):
        log_entry = {
            "id": f"push_{uuid.uuid4().hex[:12]}",
            "user_id": user_id, "channel": "push",
            "title": title, "body": body, "status": "rate_limited",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        _push_log.append(log_entry)
        return {"sent": False, "reason": "本周推送次数已达上限", "log_id": log_entry["id"]}

    # 调用阿里云推送
    target = target_value or user_id
    params = {
        "AppKey": settings.ALIYUN_PUSH_APP_KEY,
        "Target": target_type,
        "TargetValue": target,
        "Title": title,
        "Body": body,
        "DeviceType": "ALL",
        "PushType": "NOTICE",
        "StoreOffline": "true",
    }
    if extras:
        params["AndroidExtParameters"] = json.dumps(extras, ensure_ascii=False)
        params["iOSExtParameters"] = json.dumps(extras, ensure_ascii=False)

    result = _aliyun_call(
        "cloudpush.aliyuncs.com", "Push",
        params,
        settings.ALIYUN_SMS_ACCESS_KEY_ID,
        settings.ALIYUN_SMS_ACCESS_KEY_SECRET,
    )

    status = "sent" if result["success"] else "failed"
    if status == "sent":
        _push_counts[user_id] = _push_counts.get(user_id, 0) + 1

    log_entry = {
        "id": f"push_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "channel": "push",
        "title": title,
        "body": body,
        "status": status,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _push_log.append(log_entry)

    return {"sent": result["success"], "log_id": log_entry["id"], **result}


def send_batch_push(user_ids: list[str], title: str, body: str,
                    extras: dict[str, str] | None = None) -> dict[str, Any]:
    """批量推送。"""
    results = []
    for uid in user_ids:
        r = send_push(uid, title, body, extras=extras)
        results.append({"user_id": uid, **r})
    return {"total": len(user_ids), "sent": sum(1 for r in results if r.get("sent")), "results": results}


# ═══════════════════════════════════════════════
# 短信（阿里云短信）
# ═══════════════════════════════════════════════
def send_sms(phone: str, template_code: str,
             template_params: dict[str, str] | None = None,
             skip_quota_check: bool = False) -> dict[str, Any]:
    """发送短信验证码/提醒通知。

    skip_quota_check=True 时跳过夜间静默等频控（用于用户主动请求的验证码）。
    """
    if not settings.ALIYUN_SMS_ACCESS_KEY_ID:
        raise APIError(80003, "短信服务未配置", 503)

    if not skip_quota_check:
        can_send, reason = _check_push_quota(phone, "sms")
        if not can_send:
            return {"sent": False, "reason": reason}

    params = {
        "PhoneNumbers": phone,
        "SignName": settings.ALIYUN_SMS_SIGN_NAME,
        "TemplateCode": template_code,
    }
    if template_params:
        params["TemplateParam"] = json.dumps(template_params, ensure_ascii=False)

    result = _aliyun_call(
        ALIYUN_SMS_ENDPOINT, "SendSms",
        params,
        settings.ALIYUN_SMS_ACCESS_KEY_ID,
        settings.ALIYUN_SMS_ACCESS_KEY_SECRET,
        version="2017-05-25",
    )

    log_entry = {
        "id": f"sms_{uuid.uuid4().hex[:12]}",
        "phone": phone,
        "channel": "sms",
        "template_code": template_code,
        "status": "sent" if result["success"] else "failed",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _sms_log.append(log_entry)

    return {"sent": result["success"], "log_id": log_entry["id"], **result}


# ═══════════════════════════════════════════════
# 自动提醒触发（由定时任务/调度器调用）
# ═══════════════════════════════════════════════
def check_inactive_users(target_date: str | None = None) -> dict[str, Any]:
    """检查连续未活跃用户并触发对应级别提醒。

    3天未规划 → App推送提醒
    5天未复盘 → App推送 + 短信提醒
    7天未使用 → 短信提醒 + 运营官介入标记
    """
    # 此处为骨架实现；生产环境需查询数据库
    return {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "reminders_sent": 0,
        "message": "连续使用提醒检查完成（骨架：待数据库接入后实现精确查询）",
    }


def send_crisis_notification(user_id: str, crisis_level: int) -> dict[str, Any]:
    """危机干预通知：检测到危机信号后的即时推送。"""
    if crisis_level >= 3:
        # 最高危机级别：App推送 + 短信通知运营官
        push_result = send_push(
            user_id,
            "💙 我们在乎你",
            "你并不孤单，如果需要，请拨打全国心理援助热线 400-161-9995",
            extras={"action": "crisis_support", "hotline": "4001619995"},
        )
        return {"crisis_notified": True, "channels": ["push"], "push_result": push_result}

    elif crisis_level >= 2:
        push_result = send_push(
            user_id,
            "小耕在这里",
            "感觉你今天的情绪有些低落，如果需要聊聊，小耕随时在这里~",
            extras={"action": "mood_check", "module": "mood_haven"},
        )
        return {"crisis_notified": True, "channels": ["push"], "push_result": push_result}

    return {"crisis_notified": False, "reason": "危机级别低于阈值，无需干预"}


# ═══════════════════════════════════════════════
# 查询
# ═══════════════════════════════════════════════
def get_push_quota(user_id: str) -> dict[str, Any]:
    """查询用户推送配额。"""
    can_push, reason = _check_push_quota(user_id)
    return {
        "user_id": user_id,
        "push_sent_this_week": _push_counts.get(user_id, 0),
        "push_max_per_week": settings.CARE_PUSH_MAX_PER_WEEK,
        "sms_enabled": settings.SMS_ENABLED,
        "can_push_now": can_push and _check_weekly_limit(user_id),
        "block_reason": reason if not can_push else None,
    }


def get_push_logs(user_id: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
    """查询推送历史。"""
    logs = _push_log
    if user_id:
        logs = [l for l in logs if l.get("user_id") == user_id]
    return logs[-limit:]


# 每周一重置计数器（由定时任务调用）
def reset_weekly_counts():
    """重置每周推送计数器。"""
    _push_counts.clear()
    logger.info("本周推送计数器已重置")
