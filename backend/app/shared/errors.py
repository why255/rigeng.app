"""全局统一错误码体系（步骤3 §2 冻结版）。

格式：业务码 5 位（前 2 位=域，后 3 位=序号）+ HTTP 状态。
业务层禁止自定义错误码——一律引用本文件常量。
"""
from __future__ import annotations


class APIError(Exception):
    """业务异常：携带统一业务码、提示信息、HTTP 状态。"""

    def __init__(self, code: int, message: str, http_status: int = 400):
        self.code = code
        self.message = message
        self.http_status = http_status
        super().__init__(message)


# ── 通用 ──
OK = 0

# ── 鉴权 10xxx ──
E_UNAUTHENTICATED = APIError(10001, "未登录", 401)
E_TOKEN_EXPIRED = APIError(10003, "Token已过期", 401)
E_NO_PERMISSION = APIError(10010, "无权限", 403)
E_GRANT_MISSING = APIError(10020, "横切授权缺失", 403)
E_NDA_UNSIGNED = APIError(10030, "保密协议(NDA)未签署", 403)

# ── 参数 20xxx ──
E_PARAM_MISSING = APIError(20001, "参数缺失", 400)
E_PARAM_FORMAT = APIError(20002, "参数格式错误", 400)
E_VERSION_NAMING = APIError(20010, "版本命名非法（禁止基础版/标准版/高级版，仅A版/B版）", 400)

# ── 用户 30xxx ──
E_USER_NOT_FOUND = APIError(30001, "用户不存在", 404)
E_QUOTA_EXCEEDED = APIError(30010, "VIP配额不足", 403)
E_TEACHER_NDA = APIError(30020, "老师未签NDA，不可授予私有库只读", 403)
E_TRIAL_EXPIRED = APIError(30030, "试用期已过期", 403)
E_DISCLAIMER_UNSIGNED = APIError(30040, "免责声明未签署", 403)
E_PLAN_NOT_FOUND = APIError(30050, "计划不存在", 404)
E_TASK_NOT_FOUND = APIError(30051, "任务不存在", 404)

# ── 知识库 40xxx ──
E_DOC_NOT_FOUND = APIError(40001, "文档不存在", 404)
E_NOT_DESENSITIZED = APIError(40012, "检测到未脱敏的敏感信息", 400)
E_CATEGORY_MISMATCH = APIError(40020, "分类不匹配", 400)
E_PUBLIC_KB_NO_DOWNLOAD = APIError(40030, "携君库内容不可下载", 403)
E_COPY_LIMIT = APIError(40031, "复制超过500字限制", 403)
E_NEGATIVE_BLOCKED = APIError(40040, "负面/隐私内容禁止入库", 403)
E_AGITATED_NO_CLOUD = APIError(40041, "情绪激动内容不可上云，仅本地存储", 403)

# ── 语音/AI 50xxx ──
E_ASR_LOW_CONF = APIError(50001, "识别置信度过低", 400)
E_OFFLINE_UNAVAILABLE = APIError(50010, "离线状态下该功能不可用，请联网", 503)
E_LLM_TIMEOUT = APIError(50020, "大模型超时", 504)
E_LLM_PARSE = APIError(50031, "LLM返回内容解析失败", 502)
E_CRISIS_SIGNAL = APIError(50030, "危机信号（内部标记）", 200)
E_NON_HR_GUIDED = APIError(50040, "问题超出HR范围，已温和引导", 200)

# ── 文件 60xxx ──
E_FILE_TOO_LARGE = APIError(60001, "文件过大", 413)
E_FILE_NOT_FOUND = APIError(60002, "文件不存在", 404)
E_STORAGE_FULL = APIError(60010, "存储空间已满，请清理或升级会员", 403)
E_COMPRESS_FAIL = APIError(60020, "压缩失败", 500)
E_OFFLINE_CONFLICT = APIError(60030, "离线同步冲突", 409)
E_LOCAL_ENCRYPTED_NO_DOWNLOAD = APIError(60040, "该文件仅存储在本地设备，不可从云端下载", 403)

# ── 检索 70xxx ──
E_SEARCH_EMPTY = APIError(70001, "检索为空", 200)
E_SOURCE_DISABLED = APIError(70010, "知识源未开启", 403)

# ── 推送 80xxx ──
E_PUSH_RATE = APIError(80001, "超出每周推送上限", 429)
E_PUSH_NIGHT = APIError(80002, "夜间（21:00-9:00）禁止推送", 403)
E_SMS_DISABLED = APIError(80003, "短信渠道已禁用", 403)
E_NEW_USER_QUIET = APIError(80004, "新用户7天免打扰期内", 403)
E_VERIFY_CODE_COOLDOWN = APIError(80005, "验证码发送过于频繁", 429)
E_VERIFY_CODE_HOURLY_MAX = APIError(80006, "验证码发送次数超过每小时上限", 429)
E_VERIFY_CODE_INVALID = APIError(80007, "验证码错误", 400)
E_VERIFY_CODE_EXPIRED = APIError(80008, "验证码已过期", 400)

# ── 安全 90xxx ──
E_DESENSITIZE_FAIL = APIError(90001, "脱敏失败", 500)
E_PRIVACY_CONFLICT = APIError(90010, "隐私分级冲突（负面禁上云）", 403)
E_CRISIS_PROTOCOL = APIError(90020, "危机内容触发干预协议", 200)

# ── 视频辅导 101xxx ──
E_TEACHER_UNAVAILABLE = APIError(101001, "老师当前不可用", 409)
E_SCHEDULE_CONFLICT = APIError(101010, "预约时间冲突", 409)
E_COACHING_QUOTA = APIError(101020, "辅导时长超配额", 403)

# ── 数据分析 110xxx ──
E_METRIC_NOT_FOUND = APIError(110001, "指标数据不存在", 404)
E_DATE_RANGE_INVALID = APIError(110002, "日期范围参数非法", 400)
E_REPORT_GENERATE_FAIL = APIError(110010, "报告生成失败", 500)
E_DATA_NOT_READY = APIError(110020, "数据尚未就绪，请积累更多使用记录", 200)

# ── 系统 99xxx ──
E_INTERNAL = APIError(99001, "内部错误", 500)
E_DEGRADED = APIError(99002, "服务降级", 503)
