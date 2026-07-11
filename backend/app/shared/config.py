"""全局配置（步骤7+9：环境分离·配置不硬编码·10大基础服务全覆盖）。

从环境变量 / .env 读取，dev/test/prod 三环境完全隔离。
"""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore")

    # ═══════ 运行环境 ═══════
    RIGENG_ENV: str = "dev"

    # ═══════ 数据库 ═══════
    DATABASE_URL: str = "sqlite:///./rigeng_dev.db"

    # ═══════ JWT 鉴权 ═══════
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 7 * 24 * 60

    # ═══════ 试用期 ═══════
    TRIAL_DAYS: int = 7

    # ═══════ 携君库版权防护 ═══════
    PUBLIC_KB_COPY_CHAR_LIMIT: int = 500

    # ────────────────────────────────────────────
    # ③ 语音/智能引擎服务（P1）
    # ────────────────────────────────────────────
    # ═══ 腾讯云语音识别（保留作为备用） ═══
    TENCENT_ASR_SECRET_ID: str = ""
    TENCENT_ASR_SECRET_KEY: str = ""
    TENCENT_ASR_APPID: str = ""  # 腾讯云账号 APPID（实时语音识别 WebSocket 需要）
    TENCENT_ASR_REGION: str = "ap-guangzhou"
    TENCENT_ASR_ENGINE: str = "16k_zh"  # 中文普通话
    # 离线语音（Vosk）
    ENABLE_OFFLINE_ASR: bool = True
    OFFLINE_ASR_MODEL_PATH: str = "./models/vosk-model-small-cn-0.22"

    # ═══ 阿里云 通义听悟 ASR（默认在线ASR — Excel #5） ═══
    TINGWU_API_KEY: str = ""
    TINGWU_APP_KEY: str = ""  # 通义听悟控制台→应用管理→AppKey
    TINGWU_ENDPOINT: str = "https://tingwu.cn-beijing.aliyuncs.com"
    TINGWU_POLL_INTERVAL: float = 1.0  # 轮询间隔(秒)

    # ═══ 字节火山引擎 — 豆包 Seed 2.0 Pro（AI对话主模块 — Excel #1） ═══
    VOLCANO_API_KEY: str = ""
    VOLCANO_BASE_URL: str = "https://ark.cn-beijing.volces.com/api/v3"
    VOLCANO_CHAT_MODEL: str = "doubao-seed-2-0-pro"
    VOLCANO_MULTIMODAL_MODEL: str = "doubao-seed-2-0-pro-260215"
    VOLCANO_MAX_TOKENS: int = 4096
    VOLCANO_TEMPERATURE: float = 0.7

    # ═══ 阿里云 DashScope — 通义千问 Qwen3.7-Max（HR模板 — Excel #2） ═══
    DASHSCOPE_API_KEY: str = ""
    DASHSCOPE_BASE_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    DASHSCOPE_CHAT_MODEL: str = "qwen3.7-max-preview"
    DASHSCOPE_TTS_MODEL: str = "qwen-tts-hd"  # Excel #6 TTS
    DASHSCOPE_MAX_TOKENS: int = 4096
    DASHSCOPE_TEMPERATURE: float = 0.3

    # ═══ 腾讯混元 Hy3（会议纪要 — Excel #3） ═══
    HUNYUAN_SECRET_ID: str = ""
    HUNYUAN_SECRET_KEY: str = ""
    HUNYUAN_MODEL: str = "hy3-preview"
    HUNYUAN_ENDPOINT: str = "https://api.hunyuan.cloud.tencent.com/v1"
    HUNYUAN_MAX_TOKENS: int = 4096
    HUNYUAN_TEMPERATURE: float = 0.2

    # ═══ 月之暗面 Kimi K2.5（私有知识库问答 — Excel #4） ═══
    KIMI_API_KEY: str = ""
    KIMI_BASE_URL: str = "https://api.moonshot.cn/v1"
    KIMI_MODEL: str = "kimi-k2.5"
    KIMI_MAX_TOKENS: int = 4096
    KIMI_TEMPERATURE: float = 0.3

    # ═══ DeepSeek V4-Pro（工作诊断&成长分析 — Excel #9） ═══
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com/v1"
    DEEPSEEK_MODEL: str = "deepseek-chat"
    DEEPSEEK_MAX_TOKENS: int = 4096
    DEEPSEEK_TEMPERATURE: float = 0.3

    # ═══ 智谱AI GLM-4.5（IP内容创作 — Excel #10，保留通用推理能力） ═══
    ZHIPUAI_API_KEY: str = ""
    ZHIPUAI_MODEL: str = "glm-4.5"
    # 余额不足时按顺序降级尝试的备用模型
    ZHIPUAI_FALLBACK_MODELS: list[str] = [
        "GLM-4.7", "GLM-5.1", "GLM-4.5-Air",
    ]
    ZHIPUAI_MAX_TOKENS: int = 4096
    ZHIPUAI_TEMPERATURE: float = 0.7

    # ═══ Anthropic Claude（保留作为备用/特殊场景） ═══
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-sonnet-4-6"
    ANTHROPIC_MAX_TOKENS: int = 4096
    ANTHROPIC_TEMPERATURE: float = 0.7

    # LLM 提供商选择: "anthropic" | "zhipu" | "volcano" | "dashscope" | "hunyuan" | "kimi" | "deepseek" | "auto"
    # "auto" = 按模块自动路由到对应模型（推荐）
    LLM_PROVIDER: str = "auto"

    # ────────────────────────────────────────────
    # ④ 文件存储服务
    # ────────────────────────────────────────────
    OBJECT_STORAGE_PROVIDER: str = "local"  # local / aliyun-oss / s3
    UPLOAD_MAX_MB: int = 1024  # 单文件最大 1GB
    AUDIO_COMPRESS_BITRATE: str = "64k"

    # ────────────────────────────────────────────
    # ⑤ 搜索/RAG 服务（S1）
    # ────────────────────────────────────────────
    EMBEDDING_MODEL: str = "bge-large-zh"
    EMBEDDING_DIM: int = 1024
    VECTOR_INDEX_METHOD: str = "ivfflat"  # pgvector 索引方法
    RAG_TOP_N: int = 10
    RAG_SIMILARITY_THRESHOLD: float = 0.65

    # ────────────────────────────────────────────
    # ⑥ 消息/推送服务（P2）
    # ────────────────────────────────────────────
    # 阿里云移动推送
    ALIYUN_PUSH_APP_KEY: str = ""
    ALIYUN_PUSH_APP_SECRET: str = ""
    ALIYUN_PUSH_REGION: str = "cn-hangzhou"
    # 阿里云短信
    ALIYUN_SMS_ACCESS_KEY_ID: str = ""
    ALIYUN_SMS_ACCESS_KEY_SECRET: str = ""
    ALIYUN_SMS_SIGN_NAME: str = "长沙仝聚教育科技有限公司"
    ALIYUN_SMS_TEMPLATE_LOGIN_VERIFY: str = ""
    ALIYUN_SMS_TEMPLATE_ALERT: str = ""
    # 推送频控
    CARE_PUSH_MAX_PER_WEEK: int = 5
    CARE_PUSH_WINDOW_START: int = 9
    CARE_PUSH_WINDOW_END: int = 21
    NEW_USER_QUIET_DAYS: int = 7
    SMS_ENABLED: bool = False

    # ────────────────────────────────────────────
    # ⑧ 安全/加密服务（S3）
    # ────────────────────────────────────────────
    ENCRYPTION_ALGO: str = "AES-256-GCM"
    ENCRYPTION_ALGO_VERSION: str = "v1"
    LOCAL_ENCRYPTION_KEY: str = ""  # 端侧加密密钥（Hex, 64字符 = 32字节）

    # ────────────────────────────────────────────
    # 服务熔断/降级（P3）
    # ────────────────────────────────────────────
    CB_FAILURE_THRESHOLD: int = 5   # 熔断器：连续失败N次→熔断
    CB_TIMEOUT_SECONDS: int = 60    # 熔断器：熔断恢复前冷却时间
    CB_HALF_OPEN_LIMIT: int = 3     # 熔断器：半开状态最大试探次数
    DOWNSTREAM_TIMEOUT_SECONDS: int = 10  # 下游服务调用超时

    # ────────────────────────────────────────────
    # 智脑层引擎配置（算法基础设施）
    # ────────────────────────────────────────────
    # LLM调度引擎
    LLM_COMPLEX_MODEL: str = "claude-sonnet-4-6"    # 复杂任务模型
    LLM_MEDIUM_MODEL: str = "GLM-4.7"               # 中等任务模型
    LLM_SIMPLE_MODEL: str = "GLM-4.5-Air"           # 简单任务模型
    # 会话上下文引擎
    SESSION_MAX_TURNS: int = 20                      # 最大对话轮数
    SESSION_MEMORY_MAX: int = 5                      # 每次注入LLM的最大记忆数
    SESSION_CONTEXT_TOKEN_BUDGET: int = 4500         # 上下文总Token预算
    # 安全合规引擎
    PII_DESENSITIZE_ENABLED: bool = True             # 是否启用PII脱敏
    AUDIT_LOG_RETENTION_DAYS: int = 90               # 审计日志保留天数
    # 数据底座引擎
    EVENT_ASYNC_WRITE: bool = True                   # 事件是否异步写入
    # 语音全链路引擎
    VOICE_SILENCE_NUDGE_SECONDS: int = 30            # 静默提醒秒数
    VOICE_SILENCE_PAUSE_SECONDS: int = 60            # 静默暂停秒数
    VOICE_SNAPSHOT_TTL_SECONDS: int = 600            # 语音快照有效期(10分钟)
    # 内容转化引擎
    SKILL_TO_EXPERIENCE_THRESHOLD: int = 3            # 技能→经验转化门槛(执行次数)
    EXPERIENCE_TO_WISDOM_THRESHOLD: int = 10          # 经验→智慧转化门槛(文档数)

    # ────────────────────────────────────────────
    # ⑦ 数据仪表盘服务（P4）
    # ────────────────────────────────────────────
    ANALYTICS_CACHE_TTL_SECONDS: int = 300      # 数据面板缓存 5分钟
    ANALYTICS_DEFAULT_DAYS: int = 30            # 默认统计范围 30天
    ANALYTICS_MAX_DATA_POINTS: int = 1000       # 趋势图最大数据点

    # ────────────────────────────────────────────
    # Redis（缓存 / 会话 / 推送频控）
    # ────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ═══════ 属性 ═══════

    @property
    def is_sqlite(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")

    @property
    def is_prod(self) -> bool:
        return self.RIGENG_ENV == "prod"

    @property
    def offline_asr_enabled(self) -> bool:
        return self.ENABLE_OFFLINE_ASR and self.RIGENG_ENV != "prod"


settings = Settings()
