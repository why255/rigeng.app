"""共享 HTTP 客户端 模块（P1-3.1 — 替换 urllib.request）。

为每个 LLM 提供商维护全局 httpx.Client，实现：
- 连接复用（keep-alive），消除每次请求的 TCP/TLS 握手开销（100-300ms）
- HTTP/2 多路复用（减少并发请求的延迟）
- 连接池限流（防止连接泄漏）

用法:
    from app.shared.http_client import get_http_client
    client = get_http_client("volcano")
    resp = client.post("/v1/chat/completions", json=body, headers=headers)
    result = resp.json()
"""

from __future__ import annotations

import logging
import threading

import httpx

logger = logging.getLogger("http_client")


# ── 默认连接池配置 ──

DEFAULT_LIMITS = httpx.Limits(
    max_connections=100,         # 最大连接数
    max_keepalive_connections=20,  # 最大空闲连接数
    keepalive_expiry=30.0,       # 空闲连接保持时间（秒）
)

DEFAULT_TIMEOUT = httpx.Timeout(
    connect=10.0,   # TCP 连接超时
    read=60.0,      # 读取超时
    write=10.0,     # 写入超时
    pool=5.0,       # 连接池获取超时
)

# ── 全局客户端注册表（线程安全惰性初始化）──

_clients: dict[str, httpx.Client] = {}
_lock = threading.Lock()


def get_http_client(
    provider: str,
    base_url: str | None = None,
    *,
    timeout: httpx.Timeout | None = None,
    limits: httpx.Limits | None = None,
    http2: bool = True,
) -> httpx.Client:
    """获取或创建指定提供商的共享 HTTP 客户端。

    每个 provider 一个全局实例，所有调用方共享连接池。
    首次调用时惰性创建，线程安全。

    Args:
        provider: 提供商标识（如 "volcano", "dashscope", "anthropic" 等）
        base_url: 可选的基础 URL
        timeout: 超时配置（默认 10s 连接 / 60s 读取）
        limits: 连接池限制
        http2: 是否启用 HTTP/2（默认 True）
    """
    key = provider
    if base_url:
        key = f"{provider}:{base_url}"

    # 快速路径：缓存命中
    if key in _clients:
        return _clients[key]

    with _lock:
        # 双重检查
        if key in _clients:
            return _clients[key]

        t = timeout or DEFAULT_TIMEOUT
        l = limits or DEFAULT_LIMITS

        client = httpx.Client(
            base_url=base_url or "",
            timeout=t,
            limits=l,
            http2=http2,
        )
        _clients[key] = client
        logger.info("HTTP客户端创建: provider=%s http2=%s max_conn=%d keepalive=%d",
                     provider, http2, l.max_connections, l.max_keepalive_connections)
        return client


def close_all_clients() -> None:
    """关闭所有 HTTP 客户端连接池（用于应用关闭时清理）。"""
    with _lock:
        for key, client in list(_clients.items()):
            try:
                client.close()
                logger.info("HTTP客户端关闭: %s", key)
            except Exception:
                pass
        _clients.clear()


# ── 便捷函数：各提供商客户端 ──

# 提供商 base_url 常量
PROVIDER_BASE_URLS: dict[str, str] = {}

# 这些 base_url 会从 settings 动态读取，在首次调用 get_http_client 时传入。
# 惰性绑定以避免循环导入（settings 依赖可能尚未加载）。


def get_provider_client(provider: str) -> httpx.Client:
    """根据提供商名称获取对应的 HTTP 客户端（需要先通过 get_http_client 创建）。

    这是一个便捷包装，用于向后兼容。
    """
    if provider not in _clients:
        # 惰性创建：从 settings 读取 base_url
        from ..shared.config import settings  # noqa: PLC0415

        base_url_map = {
            "volcano": settings.VOLCANO_BASE_URL,
            "dashscope": settings.DASHSCOPE_BASE_URL,
            "kimi": settings.KIMI_BASE_URL,
            "deepseek": settings.DEEPSEEK_BASE_URL,
            "zhipu": "https://open.bigmodel.cn/api/paas/v4",
            "anthropic": "https://api.anthropic.com",
            "hunyuan": "https://hunyuan.tencentcloudapi.com",
        }
        base_url = base_url_map.get(provider, "")

        return get_http_client(provider, base_url=base_url, http2=True)

    return _clients[provider]


def ensure_provider_clients() -> None:
    """预初始化所有已知提供商的 HTTP 客户端（应用启动时调用）。"""
    from ..shared.config import settings  # noqa: PLC0415

    providers = {
        "volcano": settings.VOLCANO_BASE_URL,
        "dashscope": settings.DASHSCOPE_BASE_URL,
        "kimi": settings.KIMI_BASE_URL,
        "deepseek": settings.DEEPSEEK_BASE_URL,
        "zhipu": "https://open.bigmodel.cn/api/paas/v4",
        "anthropic": "https://api.anthropic.com",
        "hunyuan": "https://hunyuan.tencentcloudapi.com",
    }

    for prov, base_url in providers.items():
        if base_url:
            get_http_client(prov, base_url=base_url, http2=True)
