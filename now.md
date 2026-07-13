# 日耕 App 当前状态 — 2026-07-12

## 版本

| 项 | 值 |
|---|-----|
| **当前版本** | `0.6.0` |
| versionCode | `6` |
| 更新内容 | 语音输入模式分离 - 按住说话全新设计(2x话筒+呼吸波纹+上滑取消) + 点击说话紧凑内联UI + 全局设置切换 |

| 项 | 值 |
|---|-----|
| **生产 IP** | `47.96.187.229` ⬅️ 当前唯一生产服务器 |
| 域名 | `rigeng365.com` ✅ 指向 47.96.187.229 |
| 旧服务器 | ~~`47.103.197.189`~~ ❌ 2026-07-12 到期 |
| 部署方式 | Docker Compose (`/opt/rigeng.app/docker-compose.yml`) |
| SSH | `ssh -i rigeng.pem root@47.96.187.229`，密钥位置 `D:\rigeng.app\rigeng.pem` |

> ⚠️ **47.103.197.189 今日到期**，所有代码已迁移至 47.96.187.229。

### 容器

| 容器 | 状态 |
|------|------|
| `rigengapp-backend-1` | FastAPI :8000 |
| `rigengapp-nginx-1` | Nginx :80，UA 双站点分流 |
| `rigengapp-db-1` | pgvector/pgvector:pg16 |
| `rigengapp-redis-1` | Redis 7 |

---

## 移动端 H5

### 技术栈

Vite + React + TypeScript + Capacitor，目录 `mobile/frontend/`，端口 `5182`。

### 模块及语音状态

| 模块 | 路由 | 语音输入 | ASR 引擎 |
|------|------|---------|----------|
| 智能记录 | `/m/smart-record/recording` | getUserMedia + MediaRecorder | 通义听悟 ASR（默认）→ 腾讯云 ASR（备用） |
| 情绪树洞 | `/m/mood-haven/chat` | getUserMedia + MediaRecorder → `/voice/asr` | 通义听悟 ASR（默认）→ 腾讯云 ASR（备用） |
| 朝有规划 | `/m/morning-plan/chat` | 同上 | 通义听悟 ASR（默认）→ 腾讯云 ASR（备用） |
| 暮有复盘 | `/m/evening-review/chat` | 同上 | 通义听悟 ASR（默认）→ 腾讯云 ASR（备用） |
| 智能问答 | `/m/smart-qa/chat` | 同上 | 通义听悟 ASR（默认）→ 腾讯云 ASR（备用） |
| 职业导师 | `/m/career-mentor/yipan` | 同上 | 通义听悟 ASR（默认）→ 腾讯云 ASR（备用） |

> **v0.3.0 改造**：全部 6 个模块从浏览器 `SpeechRecognition`（Android WebView 不可用）迁移到 `getUserMedia` → webm → WAV → `POST /voice/asr` → 在线ASR。
> **2026-07-11 多模型接入**：ASR 默认引擎从腾讯云切换到阿里云通义听悟（Excel #5），腾讯云保留为备用。

### 核心文件

| 文件 | 作用 |
|------|------|
| `shared/api/voice.ts` | 在线 ASR API + webm→WAV 转码 |
| `shared/hooks/useVoiceInput.ts` | 通用语音录制 Hook（hold/click双模式） |
| `shared/api/versionApi.ts` | APK 版本检查 |
| `components/layout/AppShell.tsx` | 全局外壳 + 顶部更新横幅 + H5 版本轮询 |
| `shared/components/chat/VoiceMessageBubble.tsx` | 语音消息气泡组件 |
| `pages/mine/SettingsPage.tsx` | 设置页（含语音输入方式切换） |

### 语音模式

| 模式 | 行为 | UI |
|------|------|-----|
| **按住说话** (hold, 默认) | 点麦克风→58vh浮层→2x大按钮144px→2x呼吸波纹→上滑取消 | 全屏浮层 + 取消区 |
| **点击说话** (click) | 点麦克风→直接录音→计时在话筒下→再点结束 | 紧凑内联 + 脉冲按钮 |

全局设置: `localStorage.rg_voice_input_mode`，路径 `/settings`。

---

## APK

### 当前版本

| 项 | 值 |
|---|-----|
| 版本号 | `0.6.0` |
| versionCode | `6` |
| 下载地址 | `http://47.96.187.229/rigeng-latest.apk` |
| 权限 | INTERNET, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS |
| androidScheme | `http`（同协议避免混合内容拦截） |
| cleartext | `true` |

### 🔧 2026-07-12 录音修复（v0.2.0）

**问题1（v0.1.0）**：APK 录音按钮点击后报"麦克风权限被拒绝"。
**根因**：`capacitor.config.ts` 中 `server.url: "http://47.96.187.229"` 导致 WebView 从远程 HTTP 加载页面，非安全上下文 → Chrome 阻止 `getUserMedia()`。
**修复**：注释掉 `server.url`，APK 从本地 bundle 加载（origin=`http://localhost`，安全上下文），API 仍通过 `window.__RIGENG_API__` 指向远程服务器。

**问题2（v0.2.0）**：按住说话松手不发送，体验像点击说话。
**根因1**：Android WebView 中 `getUserMedia()` 在 `pointerdown` 期间调用会中断 pointer 事件流 → `pointerup` 永不触发。
**根因2**：用户快速松手时 `stopRecording` 在 `getUserMedia` 完成前执行，`mediaRecorderRef.current` 为 null，音频丢失。
**修复**：`useVoiceInput.ts` + `VoiceButton.tsx`：
- `setPointerCapture(e.pointerId)` 显式捕获 pointer，确保松手收到 `pointerup`
- `lostpointercapture` 兜底监听器（系统回收 pointer 时自动取消录音）
- `getUserMedia` 完成后检查 `recordingRef.current`，若已被取消则立即释放流
- 新增 `onPointerCancel` 处理 pointer 取消事件

> ⚠️ **构建要求**：Gradle 8.13.0 需要 Java 11+，本机 `JAVA_HOME` 指向 JDK 8 会构建失败。需 `export JAVA_HOME="C:/Program Files/Java/jdk-21.0.10"` 后构建。`build.gradle` 已添加阿里云 Maven 镜像加速。

### 自主更新机制

- **APK 壳**：启动 2 秒后调 `GET /api/v1/version/check?apk_version_code=2`，`needs_update=true` 时顶部显示紫色横幅 + 下载按钮
- **H5 浏览器**：加载时调 `/version.json`，对比 `localStorage`，版本不同时顶部显示横幅 + 刷新按钮，每 10 分钟轮询

---

## 后端

### 关键 API

| 端点 | 说明 |
|------|------|
| `GET /api/v1/version` | 最新版本信息 |
| `GET /api/v1/version/check?apk_version_code=N` | 版本对比检查 |
| `GET /api/v1/voice/health` | 语音引擎健康检查（含各LLM提供商状态） |
| `POST /api/v1/voice/asr` | 语音转文字（默认通义听悟 → 腾讯云备用 → Vosk离线） |
| `POST /api/v1/voice/llm` | AI生成回答（多提供商：豆包/通义千问/混元/Kimi/DeepSeek/智谱/Claude） |
| `POST /api/v1/recordings/chunk` | 智能记录音频流上传 |
| `POST /api/v1/recordings/{id}/asr-auth` | 实时 ASR WebSocket 授权 |

---

## 🤖 多模型架构（2026-07-11 全面升级）

按《日耕产品完整模块配置清单.xlsx》实行"一模块一模型"策略，7个提供商接入后端。

### 模块→模型映射表

| 后端模块 key | 业务功能 | 模型 | 提供商 | API Key |
|---|---|---|---|---|
| `morning_plan` | 朝有规划 | `doubao-seed-2-0-pro` | 字节火山引擎 | ✅ |
| `evening_review` | 暮有复盘 | `doubao-seed-2-0-pro` | 字节火山引擎 | ✅ |
| `emotion_treehole` | 情绪树洞 | `doubao-seed-2-0-pro` | 字节火山引擎 | ✅ |
| `mood_haven` | 情绪树洞（H5） | `doubao-seed-2-0-pro` | 字节火山引擎 | ✅ |
| `smart_qa` | 智能问答 | `doubao-seed-2-0-pro` | 字节火山引擎 | ✅ |
| `smart_office` | 智能办公通用对话 | `doubao-seed-2-0-pro` | 字节火山引擎 | ✅ |
| `career` / `smart_job` | 职业导师通用对话 | `doubao-seed-2-0-pro` | 字节火山引擎 | ✅ |
| `general` | 默认对话 | `doubao-seed-2-0-pro` | 字节火山引擎 | ✅ |
| `hr_template` | HR专业模板生成 | `qwen3.7-max-preview` | 阿里云 DashScope | ✅ |
| `smart_record` | 智能会议纪要 | `hy3-preview` | 腾讯混元 | ⚠️ 未配置Key，降级至通义千问 |
| `knowledge_base` | 私有知识库问答 | `kimi-k2.5` | 月之暗面 Kimi | ✅ |
| `growth_analysis` | 工作诊断&成长分析 | `deepseek-chat` | DeepSeek | ✅ |
| `brand_building` / `ip_creation` | IP内容创作 | `glm-4.5` | 智谱 AI | ✅ |
| `multimodal` | 多模态解析 | `doubao-seed-2-0-pro-260215` | 字节火山引擎 | ✅ |

### 在线 ASR 引擎

| 优先级 | 引擎 | 提供商 | API Key |
|---|---|---|---|
| 1（默认） | 通义听悟 ASR | 阿里云 | ✅ |
| 2（备用） | 腾讯云 ASR（16k_zh） | 腾讯云 | ✅ |
| 3（离线） | Vosk | 本地 | ✅ |

### TTS 语音合成

| 引擎 | 模型 | 提供商 | 状态 |
|---|---|---|---|
| 通义 TTS-HD | `qwen-tts-hd` | 阿里云 DashScope | ✅ 已接入，支持情绪自适应语速 |

### Fallback 降级链

每个模型失败时自动切换到备用模型（如豆包→通义千问→DeepSeek→智谱），全部失败则使用模板化兜底回复。

### 核心变更文件

| 文件 | 变更 |
|---|---|
| `backend/app/shared/config.py` | 新增 7 个提供商 ~30 个配置项 |
| `backend/app/services/voice_engine/service.py` | 新增 `_openai_compatible_generate()` + 5个LLM客户端 + `asr_tingwu()` + 重写 `tts_speak()` |
| `backend/app/engines/llm_orchestrator.py` | 重写为模块→模型映射引擎 (`MODULE_MODEL_MAP`) |
| `backend/app/engines/__init__.py` | 新增导出 `get_provider_for_model`, `MODULE_MODEL_MAP` |
| `backend/app/services/voice_engine/router.py` | 更新 `/voice/health` 返回多提供商状态 |
| `backend/app/services/smart_office/service.py` | HR文档生成改用 `hr_template` 模块 |
| `backend/app/services/career/service.py` | STAR深度萃取改用 `growth_analysis` 模块 |
| `backend/.env` | 新增所有 API Key |
| `backend/.env.example` | 新增所有模板变量 |

### 已知问题

- `voice_engine/service.py` 中 `asr_online()` 的 `DataLen` 已修复（`len(audio_base64)` → `len(audio_bytes)`）
- 后端代码在 Docker 镜像内（非 bind mount），每次改代码需 `docker compose up -d --build backend`
- **2026-07-11 登录 Failed to fetch 已修复**：CORS `allow_origins` 缺少 `http://localhost`（Capacitor WebView origin），已添加并部署到 47.96.187.229
- **2026-07-11 腾讯混元 Hy3 Key 缺失**：Excel中未提供，`smart_record` 模块目前降级到通义千问。需联系腾讯云获取 Key 填入 `HUNYUAN_SECRET_ID` / `HUNYUAN_SECRET_KEY`

---

## 发布流程

1. 改 `deploy-apk.py` 顶部的 `VERSION` / `VERSION_CODE` / `RELEASE_NOTES`
2. 运行 `python deploy-apk.py`
3. APK 自动覆盖 `rigeng-latest.apk`，同时保留版本化副本

---

## 目录对应

| 本地路径 | 服务器路径 |
|---------|-----------|
| `mobile/frontend/dist/mobile/` | `/opt/rigeng.app/mobile/dist/mobile/`（nginx bind mount） |
| `mobile/frontend/android/.../app-debug.apk` | `/opt/rigeng.app/mobile/dist/mobile/rigeng-latest.apk` |
| `backend/app/main.py` | `/opt/rigeng.app/backend/app/main.py`（Docker 内 `/app/app/main.py`） |
| `backend/app/services/voice_engine/service.py` | `/opt/rigeng.app/backend/app/services/voice_engine/service.py` |
| `backend/app/engines/llm_orchestrator.py` | `/opt/rigeng.app/backend/app/engines/llm_orchestrator.py` |
