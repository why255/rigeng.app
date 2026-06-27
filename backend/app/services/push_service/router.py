"""⑥消息/推送服务 路由层。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from ...shared.response import ok
from ...shared.security import CurrentUser, get_current_user, require_role
from . import service
from .schemas import PushBatchRequest, PushRequest, SMSRequest

router = APIRouter(tags=["⑥消息/推送"], prefix="/push")


@router.post("/send")  # 单条推送
def send_push(body: PushRequest,
              operator: CurrentUser = Depends(require_role("operator", "superadmin"))):
    """发送App推送通知（运营/超管权限）。"""
    result = service.send_push(
        user_id=body.user_id,
        title=body.title,
        body=body.body,
        target_type=body.target_type,
        target_value=body.target_value,
        extras=body.extras,
    )
    return ok(result)


@router.post("/send-batch")  # 批量推送
def send_batch(body: PushBatchRequest,
               operator: CurrentUser = Depends(require_role("operator", "superadmin"))):
    """批量发送App推送。"""
    result = service.send_batch_push(
        user_ids=body.user_ids,
        title=body.title,
        body=body.body,
        extras=body.extras,
    )
    return ok(result)


@router.post("/sms")  # 发送短信
def send_sms(body: SMSRequest,
             operator: CurrentUser = Depends(require_role("operator", "superadmin"))):
    """发送短信验证码/通知。"""
    result = service.send_sms(
        phone=body.phone,
        template_code=body.template_code,
        template_params=body.template_params,
    )
    return ok(result)


@router.get("/quota/{user_id}")  # 推送配额查询
def get_quota(user_id: str,
              user: CurrentUser = Depends(get_current_user)):
    """查询用户本周推送配额使用情况。"""
    return ok(service.get_push_quota(user_id))


@router.get("/logs")  # 推送历史
def get_logs(user_id: str | None = Query(None),
             limit: int = Query(default=50, le=200),
             operator: CurrentUser = Depends(require_role("operator", "superadmin"))):
    """查询推送历史记录。"""
    return ok(service.get_push_logs(user_id=user_id, limit=limit))


@router.post("/crisis-notify")  # 危机通知（内部调用）
def crisis_notify(user_id: str, crisis_level: int,
                  operator: CurrentUser = Depends(require_role("operator", "superadmin"))):
    """触发危机干预通知。"""
    result = service.send_crisis_notification(user_id, crisis_level)
    return ok(result)


@router.post("/admin/reset-weekly")  # 重置周计数器（管理接口）
def reset_weekly(operator: CurrentUser = Depends(require_role("superadmin"))):
    """重置每周推送计数器（超管）。"""
    service.reset_weekly_counts()
    return ok({"reset": True})


@router.post("/admin/check-inactive")  # 检查不活跃用户
def check_inactive(target_date: str | None = None,
                   operator: CurrentUser = Depends(require_role("operator", "superadmin"))):
    """触发连续不活跃用户检查（建议配置为每日定时任务）。"""
    result = service.check_inactive_users(target_date)
    return ok(result)


@router.get("/health")  # 服务健康检查
def push_health():
    """推送服务健康检查。"""
    push_ready = bool(service.settings.ALIYUN_PUSH_APP_KEY)
    sms_ready = bool(service.settings.ALIYUN_SMS_ACCESS_KEY_ID)
    return ok({
        "status": "up",
        "push": push_ready,
        "sms": sms_ready,
        "sms_enabled": service.settings.SMS_ENABLED,
    })
