"""UA 设备检测中间件。

三层策略：
1. 优先信任 Nginx 注入的 X-Device-Type header（生产环境）
2. 回退到 User-Agent 正则匹配
3. 默认按 PC 处理

设置 request.state.device_type 供所有路由使用，
并在响应头中回写 X-Device-Type。
"""

import re
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

MOBILE_RE = re.compile(
    r'Mobile|Android|iPhone|iPad|iPod|BlackBerry|webOS',
    re.IGNORECASE,
)

VALID_DEVICE_TYPES = frozenset({'pc', 'mobile'})


class DeviceDetectMiddleware(BaseHTTPMiddleware):
    """每个请求解析设备类型，注入 request.state.device_type。"""

    async def dispatch(self, request: Request, call_next):
        ua = request.headers.get('user-agent', '')
        nginx_hint = request.headers.get('x-device-type', '').lower()

        if nginx_hint in VALID_DEVICE_TYPES:
            request.state.device_type = nginx_hint
        elif MOBILE_RE.search(ua):
            request.state.device_type = 'mobile'
        else:
            request.state.device_type = 'pc'

        response = await call_next(request)
        response.headers['X-Device-Type'] = request.state.device_type
        return response
