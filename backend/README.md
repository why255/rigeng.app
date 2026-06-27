# 日耕后台（RiGeng Backend）

> 日耕产品·第二阶段「统一后台框架」。技术栈 **Python / FastAPI / SQLAlchemy**。
> 上游依据：步骤1《全局技术架构》/ 步骤2《统一数据模型 V1.1》/ 步骤3《标准接口规范 V1.1》。

## 一、项目结构（模块化微服务）

```
backend/
├─ app/
│  ├─ main.py                 # API 网关（FastAPI 主应用·统一入口/路由/全局异常）
│  ├─ shared/                 # 基础设施：配置/DB/响应信封/错误码/JWT/ORM
│  │  ├─ config.py  database.py  response.py  errors.py  security.py
│  │  └─ models/              # ORM：用户域/权限域/知识库域（其余随服务补齐）
│  └─ services/               # 业务/基础服务层（每服务独立目录：router/schemas/service）
│     ├─ user_auth/           # ①用户/权限服务（已上线）
│     └─ knowledge_base/      # ②公私知识库服务（已上线）
├─ migrations/                # Alembic 全量迁移（九大数据域一次性建表·可回滚）
├─ tests/                     # 单元/接口测试
├─ requirements.txt  docker-compose.yml  alembic.ini  .env.example
```

分层：接入层(`main.py`网关) → 业务/基础服务层(`services/*`) → 基础设施(`shared`)。
**业务模块只调用基础服务标准接口，不写基础代码。**

## 二、环境准备（昊宇·步骤7 开发环境配置）

1. 安装 **Python 3.11+**（⚠️ 当前机器仅有 Microsoft Store 的 `python` 占位别名，需安装真实运行时）。
2. 建虚拟环境并装依赖：
   ```bash
   cd backend
   python -m venv .venv
   # Windows Git Bash: source .venv/Scripts/activate ；PowerShell: .venv\Scripts\Activate.ps1
   source .venv/Scripts/activate
   pip install -r requirements.txt
   ```
3. 复制环境变量：`cp .env.example .env`（本地默认走 SQLite，零中间件即可起步）。
   - **JWT 密钥**：开发环境使用默认值或任意字符串；生产环境必须生成强随机密钥：
     ```bash
     # 方式A：Python
     python -c "import secrets; print(secrets.token_urlsafe(64))"
     # 方式B：openssl
     openssl rand -hex 64
     ```
     将输出粘贴到 `.env` 的 `JWT_SECRET=` 后。若生产环境未设置或使用弱密钥，应用将拒绝启动。
4. 生产数据库（PostgreSQL+pgvector / Redis）：`docker compose up -d`，再把 `.env` 的 `DATABASE_URL` 改为 PostgreSQL。

## 三、建表（步骤7 数据库初始化）

```bash
# 方式A（推荐·生产）：Alembic 全量迁移，九大数据域一次性建表
alembic upgrade head      # 回滚：alembic downgrade base

# 方式B（本地快速起步）：应用启动时由 ORM 建已上线服务的表
python -c "from app.shared.database import Base, engine; import app.shared.models; Base.metadata.create_all(engine)"
```

## 四、启动

```bash
uvicorn app.main:app --reload
# 健康检查： GET http://127.0.0.1:8000/health
# 交互文档： http://127.0.0.1:8000/docs
# 服务进度： GET http://127.0.0.1:8000/api/v1/services
```

## 五、自测（T1 门禁）

```bash
pytest -q
```

> ⚠️ **本轮未在本机执行**：当前环境无可用 Python 运行时（仅 WindowsApps 占位别名），
> 测试已按规范编写但需昊宇在配好环境后运行验证。预期覆盖：注册/登录/鉴权、
> 归档→审核→检索全流程、情绪激动拒上云(40041)、负面禁入库(40040)、未脱敏(40012)、
> 版本命名(20010)、携君库复制限制(40031)/防下载(40030)、成长素材确认。

## 六、已上线接口

| 服务 | 接口 |
|---|---|
| ①用户/权限 | U1登录 U2当前用户 U3资料 U4配额 U5老师分配 U6授权(NDA) U7免责声明 U8试用期 U9关怀模式 + 注册 |
| ②公私知识库 | K1归档 K2检索 K3详情 K4编辑 K5待审核区 K6审核 K7一键确认 K8放弃 K9恢复 K10携君库阅读 K13文件夹 K14成长素材确认 + 复制校验/防下载 |

下一批：③语音/AI引擎 → ④文件存储 → ⑤搜索/RAG …（按依赖顺序，逐个带评审门禁）。
