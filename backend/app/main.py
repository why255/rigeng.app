"""API 网关 / FastAPI 主应用（步骤7+9：统一入口·路由·全局异常·熔断降级·安全头）。

挂载已开发的基础服务路由；其余服务随开发逐步挂载。
启动：uvicorn app.main:app --reload
"""
from __future__ import annotations

import sys
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from . import __version__
from .middleware.device_detect import DeviceDetectMiddleware
from .shared.config import settings
from .shared.database import SessionLocal
from .shared.errors import APIError, E_DEGRADED
from .shared.models.user import User
from .shared.response import api_error_handler, ok, unhandled_error_handler
from .shared.security import get_current_user, hash_password  # noqa: F401  (确保依赖可用)

# 服务路由
from .services.user_auth.router import router as user_auth_router
from .services.knowledge_base.router import router as kb_router
from .services.voice_engine.router import router as voice_router
from .services.push_service.router import router as push_router
from .services.plans.router import router as plans_router
from .services.reviews.router import router as reviews_router
from .services.file_storage.router import router as file_storage_router
from .services.search_rag.router import router as search_rag_router
from .services.security_encrypt.router import router as security_encrypt_router
from .services.analytics.router import router as analytics_router
from .services.emotion_service.router import router as emotion_router
from .services.smart_record.router import router as smart_record_router
from .services.smart_qa.router import router as smart_qa_router
from .services.smart_office.router import router as smart_office_router
from .services.brand_building.router import router as brand_building_router
from .services.career.router import router as career_router
from .services.product_design.router import router as product_design_router
from .services.order_delivery.router import router as order_delivery_router
from .services.acquire_client.router import router as acquire_client_router
from .services.admin.router import router as admin_router
from .services.algorithm_admin.router import router as algorithm_admin_router
from .services.algorithm_admin.router import ai_config_router

# ── 启动安全校验（步骤9·审查修正S1）──
if settings.RIGENG_ENV == "prod":
    if not settings.JWT_SECRET or settings.JWT_SECRET == "dev-secret-change-me":
        sys.exit("❌ 生产环境拒绝启动：必须通过环境变量设置安全的 JWT_SECRET。")

app = FastAPI(
    title="日耕后台 API 网关",
    version=__version__,
    description="日耕产品统一后台 · 第二阶段（用户/权限 + 公私知识库 已上线）",
)

# ═══════════════════════════════════════════════
# 安全 HTTP 头中间件（L2）
# ═══════════════════════════════════════════════
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """每个响应自动注入安全 HTTP 头。"""
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        if settings.is_prod:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# ═══════════════════════════════════════════════
# 服务熔断/降级中间件（P3）
# ═══════════════════════════════════════════════
class CircuitBreaker:
    """简单熔断器：连续失败N次→熔断 60s→半开试探→恢复或继续熔断。"""

    def __init__(self, name: str):
        self.name = name
        self.failures: int = 0
        self.state: str = "closed"  # closed → open → half-open → closed
        self.last_failure_time: float = 0.0

    def record_failure(self):
        self.failures += 1
        self.last_failure_time = time.time()
        if self.failures >= settings.CB_FAILURE_THRESHOLD:
            self.state = "open"

    def record_success(self):
        self.failures = 0
        self.state = "closed"

    @property
    def is_open(self) -> bool:
        if self.state == "closed":
            return False
        if self.state == "open":
            if time.time() - self.last_failure_time > settings.CB_TIMEOUT_SECONDS:
                self.state = "half-open"
                self.failures = 0
                return False
            return True
        # half-open: allow traffic
        return False


class CircuitBreakerRegistry:
    """熔断器注册表：每个下游服务一个熔断器实例。"""

    def __init__(self):
        self._breakers: dict[str, CircuitBreaker] = {}

    def get(self, service_name: str) -> CircuitBreaker:
        if service_name not in self._breakers:
            self._breakers[service_name] = CircuitBreaker(service_name)
        return self._breakers[service_name]

cb_registry = CircuitBreakerRegistry()


class DegradationMiddleware(BaseHTTPMiddleware):
    """下游服务调用降级中间件。

    当检测到下游服务不可用（熔断器 open）时，返回降级响应 99002，
    不阻断其他正常服务的请求。
    """

    # 哪些路由路径前缀对应哪个下游服务
    ROUTE_SERVICE_MAP = {
        "/api/v1/auth": "user_auth",
        "/api/v1/users": "user_auth",
        "/api/v1/admin": "admin",
        "/api/v1/admin/algorithms": "algorithm_admin",
        "/api/v1/admin/ai-config": "ai_config",
        "/api/v1/kb": "knowledge_base",
        "/api/v1/voice": "voice_engine",
        "/api/v1/files": "file_storage",
        "/api/v1/search": "search_rag",
        "/api/v1/push": "push_service",
        "/api/v1/analytics": "analytics",
        "/api/v1/emotion": "emotion_service",
        "/api/v1/growth": "emotion_service",
        "/api/v1/security": "security_encrypt",
        "/api/v1/video": "video_coaching",
        "/api/v1/contribution": "contribution_engine",
        "/api/v1/recordings": "smart_record",
        "/api/v1/plans": "planning",
        "/api/v1/reviews": "review",
        "/api/v1/qa": "smart_qa",
        "/api/v1/office": "smart_office",
        "/api/v1/brand": "brand_building",
        "/api/v1/career": "career",
        "/api/v1/product-design": "product_design",
        "/api/v1/delivery": "order_delivery",
        "/api/v1/acquire": "acquire_client",
    }

    async def dispatch(self, request: Request, call_next):
        # 匹配路由→服务名
        service_name = None
        for prefix, name in self.ROUTE_SERVICE_MAP.items():
            if request.url.path.startswith(prefix):
                service_name = name
                break

        # 检查熔断状态
        if service_name:
            breaker = cb_registry.get(service_name)
            if breaker.is_open:
                return await api_error_handler(request, E_DEGRADED)

        # 正常执行
        try:
            response = await call_next(request)
            if service_name:
                cb_registry.get(service_name).record_success()
            return response
        except Exception as exc:
            if service_name:
                cb_registry.get(service_name).record_failure()
            # 非 APIError 的异常交给全局异常处理器
            if isinstance(exc, APIError):
                raise
            raise

app.add_middleware(DegradationMiddleware)

# ═══════════════════════════════════════════════
# UA 设备检测中间件（双站点分流）
# ═══════════════════════════════════════════════
app.add_middleware(DeviceDetectMiddleware)

# ═══════════════════════════════════════════════
# CORS 跨域（前端开发服务器）
# ═══════════════════════════════════════════════
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        # 本地开发服务器（Vite，各端口）
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:5180",
        "http://localhost:5181",
        "http://localhost:5182",
        # Capacitor WebView（APK 壳）— androidScheme: 'http' 时 origin 为 http://localhost
        "http://localhost",
        # 生产域名 & 直连 IP
        "http://rigeng365.com",
        "http://47.103.197.189",
        "http://47.96.187.229",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局异常 → 统一响应信封
app.add_exception_handler(APIError, api_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)


# ── 启动事件：预置测试账号 ──
@app.on_event("startup")
def seed_test_user():
    """确保测试账号 19248998160 / rigeng666 存在。"""
    from sqlalchemy import select
    db = SessionLocal()
    try:
        existing = db.scalar(select(User).where(User.phone == "19248998160"))
        if not existing:
            user = User(
                phone="19248998160",
                password_hash=hash_password("rigeng666"),
                nickname="测试用户",
                role="student",
                trial_start_at=None,  # 测试账号无试用限制
                status="active",
            )
            db.add(user)
            db.commit()
            print("[seed] 测试账号已创建: 19248998160 / rigeng666")
    except Exception as e:
        db.rollback()
        # 表不存在时静默跳过（等待首次迁移）
        print(f"[seed] 跳过（可能表未创建）: {e}")
    finally:
        db.close()

# ── 路由挂载（统一前缀 /api/v1）──
API = "/api/v1"
app.include_router(user_auth_router, prefix=API)
app.include_router(kb_router, prefix=API)
app.include_router(voice_router, prefix=API)
app.include_router(push_router, prefix=API)
app.include_router(plans_router, prefix=API)
app.include_router(reviews_router, prefix=API)
app.include_router(file_storage_router, prefix=API)
app.include_router(search_rag_router, prefix=API)
app.include_router(security_encrypt_router, prefix=API)
app.include_router(analytics_router, prefix=API)
app.include_router(emotion_router, prefix=API)
app.include_router(smart_record_router, prefix=API)
app.include_router(smart_qa_router, prefix=API)
app.include_router(smart_office_router, prefix=API)
app.include_router(brand_building_router, prefix=API)
app.include_router(career_router, prefix=API)
app.include_router(product_design_router, prefix=API)
app.include_router(order_delivery_router, prefix=API)
app.include_router(acquire_client_router, prefix=API)
app.include_router(admin_router, prefix=API)
app.include_router(algorithm_admin_router, prefix=API)
app.include_router(ai_config_router, prefix=API)

@app.get(f"{API}/device")
def device_info(request: Request):
    """返回当前请求的设备类型（PC / 移动端）。"""
    return ok({
        "device_type": getattr(request.state, "device_type", "pc"),
        "user_agent": request.headers.get("user-agent", ""),
    })


@app.get("/health")
def health():
    """健康检查。"""
    return ok({"env": settings.RIGENG_ENV, "version": __version__, "status": "up"})


# ═══════════════════════════════════════════════
# APK 版本检查（APP自主更新）
# ═══════════════════════════════════════════════
_LATEST_APK = {
    "apk_version": "0.3.1",
    "apk_version_code": 3,
    "apk_url": "http://47.103.197.189/日耕-latest.apk",
    "h5_version": "0.3.1",
    "h5_build_time": "2026-07-11",
    "release_notes": "多模型接入:豆包Seed2.0Pro/通义千问Qwen3.7/KimiK2.5/DeepSeekV4/通义听悟ASR/通义TTS-HD/智谱GLM4.5",
    "min_apk_version_code": 1,
}


@app.get(f"{API}/version")
def get_version():
    """获取最新版本信息。"""
    return ok(_LATEST_APK)


@app.get(f"{API}/version/check")
def check_version(apk_version_code: int = 0):
    """检查 APK 是否需要更新。"""
    needs_update = apk_version_code > 0 and apk_version_code < _LATEST_APK["apk_version_code"]
    is_critical = apk_version_code > 0 and apk_version_code < _LATEST_APK["min_apk_version_code"]

    return ok({
        "needs_update": needs_update,
        "update": {
            "current_version": str(apk_version_code),
            "latest_version": _LATEST_APK["apk_version"],
            "download_url": _LATEST_APK["apk_url"],
            "release_notes": _LATEST_APK["release_notes"],
            "is_critical": is_critical,
        } if needs_update else None,
        "server_version": _LATEST_APK,
    })


@app.get(f"{API}/services")
def services_status():
    """已上线/规划中的 10 大基础服务状态（步骤8 进度看板）。"""
    return ok({
        "online": ["①用户/权限", "②公私知识库", "③语音/智能引擎", "④文件存储", "⑤搜索/RAG", "⑥消息/推送", "⑦数据仪表盘", "⑧安全/加密", "M5智能问答"],
        "pending": [
            "⑨视频辅导", "⑩校友贡献值",
        ],
    })
