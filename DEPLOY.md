# 日耕（RiGeng）生产环境部署手册

> **最后更新**: 2026-07-08
> **部署目标**: 阿里云 ECS `47.103.197.189`
> **部署方式**: Docker Compose 全栈容器化

---

## 目录

- [1. 环境概览](#1-环境概览)
- [2. Docker Compose 架构](#2-docker-compose-架构)
- [3. 前置准备](#3-前置准备)
- [4. 首次部署](#4-首次部署)
- [5. 日常更新部署](#5-日常更新部署)
- [6. 验证清单](#6-验证清单)
- [7. 踩坑记录与解决方案](#7-踩坑记录与解决方案)
- [8. 常用运维命令](#8-常用运维命令)
- [9. 架构图](#9-架构图)

---

## 1. 环境概览

### 1.1 服务器信息

| 项目 | 值 |
|------|-----|
| **公网 IP** | `47.103.197.189` |
| **SSH 账户** | `root` |
| **操作系统** | Ubuntu 22.04.5 LTS |
| **CPU / 内存** | 2 核 / 3.4 GB |
| **磁盘** | 49 GB |
| **⚠️ 国际带宽** | 极低（~10 KB/s），禁止下载大文件 |

### 1.2 已安装组件

| 组件 | 版本 | 安装方式 | 用途 |
|------|------|----------|------|
| Docker | 最新 | apt-get | 容器运行时 |
| Docker Compose | v2 (plugin) | apt-get | 多容器编排 |
| Node.js | ≥18 | 系统安装 | 前端构建 (npm) |
| Git | 系统自带 | apt | 代码同步 |

> **注意**: 无需在本机安装 Python/PostgreSQL/Redis — 全部由 Docker 容器提供。

### 1.3 ⚠️ 关键路径

```
正确部署路径:  /opt/rigeng.app/        ← Docker Compose 工作目录
废弃旧路径:    /www/wwwroot/www.rigeng.com/  ← 不要操作这个！
```

服务器上有两套代码副本，**Docker 容器绑定的挂载路径都是 `/opt/rigeng.app/`**。历史原因存在 `/www/wwwroot/` 目录，部署时请确保 `cd /opt/rigeng.app/`。

验证当前路径是否正确：
```bash
docker inspect rigengapp-nginx-1 --format '{{json .Mounts}}' | python3 -m json.tool
```

---

## 2. Docker Compose 架构

### 2.1 容器清单

| 容器名 | 镜像 | 端口映射 | 数据持久化 |
|--------|------|----------|-----------|
| `rigengapp-nginx-1` | `nginx:alpine` | `80:80` | 无（bind mount 宿主机目录） |
| `rigengapp-backend-1` | 自定义构建 (`./backend/Dockerfile`) | `8000:8000` | 无状态 |
| `rigengapp-redis-1` | `redis:7-alpine` | `6379:6379` | Docker volume `redisdata` |
| `rigengapp-db-1` | `pgvector/pgvector:pg16` | `5432:5432` | Docker volume `pgdata` |

### 2.2 数据库凭证

```
数据库类型: PostgreSQL 16 + pgvector
容器内主机名: db
用户: rigeng
密码: rigeng
数据库: rigeng
连接串: postgresql+psycopg2://rigeng:rigeng@db:5432/rigeng
```

> 凭证由 `docker-compose.yml` 环境变量注入，无需 `.env` 文件。

### 2.3 Nginx Bind Mount（生产环境核心）

| 宿主机路径 | 容器内路径 | 说明 |
|-----------|-----------|------|
| `/opt/rigeng.app/nginx/rigeng.conf` | `/etc/nginx/conf.d/default.conf` | Nginx 配置（UA 分流） |
| `/opt/rigeng.app/pc/dist/pc/` | `/usr/share/nginx/html/pc/` | PC 端静态文件 |
| `/opt/rigeng.app/mobile/dist/mobile/` | `/usr/share/nginx/html/mobile/` | Mobile 端静态文件 |

> **这些是实时 bind mount** — 宿主机上更新 `dist/` 文件后 Nginx 立即可见，无需重启 Nginx 容器。但如果 Nginx 配置改了则需要 `docker restart rigengapp-nginx-1`。

### 2.4 docker-compose.yml 完整内容

```yaml
version: "3.8"

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - RIGENG_ENV=prod
      - JWT_SECRET=${JWT_SECRET:-change-me-in-production}
      - DATABASE_URL=postgresql+psycopg2://rigeng:rigeng@db:5432/rigeng
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    restart: unless-stopped

  db:
    image: pgvector/pgvector:pg16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: rigeng
      POSTGRES_PASSWORD: rigeng
      POSTGRES_DB: rigeng
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U rigeng"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redisdata:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/rigeng.conf:/etc/nginx/conf.d/default.conf:ro
      - ./pc/dist/pc:/usr/share/nginx/html/pc:ro
      - ./mobile/dist/mobile:/usr/share/nginx/html/mobile:ro
    depends_on:
      - backend

volumes:
  pgdata:
  redisdata:
```

### 2.5 Nginx UA 分流机制

Nginx 通过 `$http_user_agent` map 实现双站点分流：

```
PC 浏览器           → /usr/share/nginx/html/pc/index.html
Mobile/iPhone/Android → /usr/share/nginx/html/mobile/index.html
```

HTML 文件设置了 `Cache-Control: no-cache`，确保用户始终获取最新入口。JS/CSS 资源使用 Vite 的 content-hash 文件名实现长效缓存。

---

## 3. 前置准备

### 3.1 本地开发机

- Git 已安装，能访问 GitHub `why255/rigeng.app`
- 代码已推送到 GitHub master 分支
- （可选）已配置 SSH 免密登录服务器

### 3.2 服务器

以下为首次环境搭建所需（当前服务器已完成，仅供参考）：

```bash
# 安装 Docker
apt-get update
apt-get install -y docker.io docker-compose-v2

# 安装 Node.js (前端构建用)
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# 启动 Docker
systemctl enable docker
systemctl start docker

# 克隆仓库
mkdir -p /opt && cd /opt
git clone https://github.com/why255/rigeng.app.git
```

---

## 4. 首次部署

> 当前服务器已完成首次部署。以下为完整记录，供新服务器参考。

### 4.1 拉取代码

```bash
git clone https://github.com/why255/rigeng.app.git /opt/rigeng.app
cd /opt/rigeng.app
```

### 4.2 构建前端

```bash
# PC 端
cd /opt/rigeng.app/pc/frontend
npm install --legacy-peer-deps
npx vite build

# Mobile 端
cd /opt/rigeng.app/mobile/frontend
npm install --legacy-peer-deps
npx vite build
```

构建产物：
- PC: `pc/dist/pc/index.html` + `assets/index-XXXXXXXX.js` + `assets/index-XXXXXXXX.css`
- Mobile: `mobile/dist/mobile/index.html` + `assets/index-XXXXXXXX.js` + `assets/index-XXXXXXXX.css`

### 4.3 启动全栈容器

```bash
cd /opt/rigeng.app
docker compose up -d
```

Docker Compose 会自动：
1. 拉取 `pgvector/pgvector:pg16`、`redis:7-alpine`、`nginx:alpine` 镜像
2. 构建 backend 镜像（`./backend/Dockerfile`）
3. 按依赖顺序启动：db → redis → backend → nginx

### 4.4 数据库初始化（仅首次）

```bash
docker exec rigengapp-backend-1 alembic upgrade head
```

---

## 5. 日常更新部署

> **这是每次推送代码后的标准操作流程。**

### 5.1 步骤总览

| 步骤 | 操作 | 预计耗时 | 是否必需 |
|------|------|---------|---------|
| ① | 拉取最新代码 | ~30s | ✅ |
| ② | 构建 PC 前端 | ~15s | 如有前端变更 |
| ③ | 构建 Mobile 前端 | ~5s | 如有前端变更 |
| ④ | 更新后端容器代码 | ~2s | 如有后端变更 |
| ⑤ | 重启后端容器 | ~10s | 如有后端变更 |
| ⑥ | 运行数据库迁移 | ~3s | 如有新 migration |
| ⑦ | 验证端点 | ~10s | ✅ |

### 5.2 执行命令（复制粘贴版）

```bash
# =========================================
# 日耕生产环境更新部署 — 标准操作流程
# =========================================
set -e

DEPLOY_DIR="/opt/rigeng.app"
cd "$DEPLOY_DIR"

# ① 拉取最新代码
echo "=== ① 拉取代码 ==="
git pull origin master

# ② 构建 PC 前端
echo "=== ② 构建 PC 前端 ==="
cd "$DEPLOY_DIR/pc/frontend"
npm install --legacy-peer-deps --quiet
npx vite build

# ③ 构建 Mobile 前端
echo "=== ③ 构建 Mobile 前端 ==="
cd "$DEPLOY_DIR/mobile/frontend"
npm install --legacy-peer-deps --quiet
npx vite build

# ④ 更新后端代码（不重建镜像）
echo "=== ④ 更新后端代码 ==="
docker cp "$DEPLOY_DIR/backend/app" rigengapp-backend-1:/app/
docker cp "$DEPLOY_DIR/backend/migrations" rigengapp-backend-1:/app/
docker cp "$DEPLOY_DIR/backend/alembic.ini" rigengapp-backend-1:/app/

# ⑤ 重启后端
echo "=== ⑤ 重启后端 ==="
docker restart rigengapp-backend-1
sleep 5

# ⑥ 数据库迁移
echo "=== ⑥ 数据库迁移 ==="
docker exec rigengapp-backend-1 alembic upgrade head

# ⑦ 验证
echo "=== ⑦ 验证 ==="
echo "Health: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/health)"
echo "PC:     $(curl -s -o /dev/null -w '%{http_code}' http://localhost/)"
echo "Mobile: $(curl -s -o /dev/null -w '%{http_code}' -H 'User-Agent: Mozilla/5.0 (iPhone)' http://localhost/)"

echo ""
echo "✅ 部署完成！"
echo "   PC:      http://47.103.197.189/"
echo "   Mobile:  http://47.103.197.189/ (手机访问)"
echo "   Health:  http://47.103.197.189/health"
echo "   Docs:    http://47.103.197.189/docs"
```

### 5.3 仅更新后端（前端未改）

```bash
cd /opt/rigeng.app && git pull origin master
docker cp /opt/rigeng.app/backend/app rigengapp-backend-1:/app/
docker cp /opt/rigeng.app/backend/migrations rigengapp-backend-1:/app/
docker restart rigengapp-backend-1
sleep 5
docker exec rigengapp-backend-1 alembic upgrade head
curl -s -o /dev/null -w 'Health: %{http_code}\n' http://localhost:8000/health
```

### 5.4 仅更新前端（后端未改）

```bash
cd /opt/rigeng.app && git pull origin master
cd /opt/rigeng.app/pc/frontend && npm install --legacy-peer-deps --quiet && npx vite build
cd /opt/rigeng.app/mobile/frontend && npm install --legacy-peer-deps --quiet && npx vite build
# bind mount 自动生效，无需重启 Nginx
curl -s -o /dev/null -w 'PC: %{http_code}\n' http://localhost/
```

### 5.5 新增前端依赖时的处理

如果 `package.json` 新增了依赖（如本次的 `@dnd-kit/core`），`npm install --legacy-peer-deps` 会自动安装。如果 `npm ci` 方式构建，需确认 `package-lock.json` 已提交。

---

## 6. 验证清单

### 6.1 服务状态检查

```bash
# 所有容器应 STATUS = Up
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

期望输出：
```
NAMES                 STATUS                  PORTS
rigengapp-nginx-1     Up XX hours             0.0.0.0:80->80/tcp
rigengapp-backend-1   Up XX seconds           0.0.0.0:8000->8000/tcp
rigengapp-redis-1     Up XX hours             0.0.0.0:6379->6379/tcp
rigengapp-db-1        Up XX hours (healthy)   0.0.0.0:5432->5432/tcp
```

`db` 容器状态必须含 `(healthy)` — 否则 backend 不会启动。

### 6.2 端点验证

```bash
# 后端 Health
curl -s http://localhost:8000/health
# 期望: {"code":0,"message":"ok","data":{"env":"prod","version":"0.2.0","status":"up"}}

# PC 页面 (200)
curl -s -o /dev/null -w '%{http_code}' http://localhost/

# Mobile 页面 (200, iPhone UA)
curl -s -o /dev/null -w '%{http_code}' -H 'User-Agent: Mozilla/5.0 (iPhone)' http://localhost/

# API 文档 (200)
curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/docs
```

### 6.3 公网验证

```bash
# 应全部返回 200
curl -s -o /dev/null -w 'PC:      %{http_code}\n' http://47.103.197.189/
curl -s -o /dev/null -w 'Mobile:  %{http_code}\n' -H 'User-Agent: Mozilla/5.0 (iPhone)' http://47.103.197.189/
curl -s -o /dev/null -w 'Health:  %{http_code}\n' http://47.103.197.189/health
curl -s -o /dev/null -w 'Docs:    %{http_code}\n' http://47.103.197.189/docs
```

### 6.4 验证前端已更新

```bash
# 查看 Nginx 容器内挂载的 JS 文件名
docker exec rigengapp-nginx-1 ls /usr/share/nginx/html/mobile/assets/
docker exec rigengapp-nginx-1 ls /usr/share/nginx/html/pc/assets/

# 验证实际返回页面引用的 JS hash
curl -s -H 'User-Agent: Mozilla/5.0 (iPhone)' http://localhost/ | grep -o 'assets/index-[A-Za-z0-9]*\.js'
```

---

## 7. 踩坑记录与解决方案

### 坑 ①：部署到错误目录（本次最大问题）

**现象**：手机打开网站看到的仍是旧版，但 `/www/wwwroot/www.rigeng.com/` 代码和构建产物都是最新的。

**原因**：Docker Nginx 容器的 bind mount 源是 `/opt/rigeng.app/pc/dist/pc/` 和 `/opt/rigeng.app/mobile/dist/mobile/`，不是 `/www/wwwroot/www.rigeng.com/` 下的任何路径。服务器上有两套代码副本，我们在错误的目录操作。

**诊断方式**：
```bash
docker inspect rigengapp-nginx-1 --format '{{json .Mounts}}' | python3 -m json.tool
```

**解决**：所有部署操作必须在 `/opt/rigeng.app/` 目录下进行。

### 坑 ②：试图用 PM2 管理进程

**现象**：习惯性地 `pm2 restart rigeng-backend` 报错 `Process not found`。

**原因**：服务器用的是 Docker Compose 而非 PM2。Docker 负责进程管理（`restart: unless-stopped`）。

**解决**：用 `docker restart rigengapp-backend-1` 而非 PM2。

### 坑 ③：尝试重建 Docker 镜像导致超长耗时

**现象**：`docker compose build backend` 卡了 10+ 分钟仍在下载 apt 包。

**原因**：服务器国际带宽仅 ~10KB/s。`python:3.12-slim` 镜像的 `apt-get install libpq-dev gcc` 需要下载 ~56MB。

**解决**：**永远不要重建 Docker 镜像**。改用 `docker cp` 将更新后的 Python 代码直接复制进容器：

```bash
docker cp /opt/rigeng.app/backend/app rigengapp-backend-1:/app/
docker restart rigengapp-backend-1
```

### 坑 ④：PostgreSQL 密码认证失败

**现象**：`alembic upgrade head` 报错 `FATAL: password authentication failed for user "myuser"`。

**原因**：`/www/wwwroot/www.rigeng.com/backend/.env` 中 DATABASE_URL 密码是 `your_db_password` 占位符。

**解决**：Docker Compose 中 backend 的环境变量由 `docker-compose.yml` 直接注入，不读取 `.env` 文件。在正确的架构下，数据库凭证是 `rigeng:rigeng@db:5432/rigeng`。

### 坑 ⑤：PG14 集群与 Docker PG16 冲突

**现象**：`systemctl start postgresql` 失败，日志显示 `Address already in use`。

**原因**：宿主机装了 PG14（端口 5432），但 Docker 容器 `rigengapp-db-1`（PG16）已通过 docker-proxy 占用 5432 端口。

**解决**：不需要宿主机 PG14。所有数据库操作通过 Docker 容器进行：
```bash
docker exec rigengapp-backend-1 alembic upgrade head
```

### 坑 ⑥：Mobile 前端构建报 missing dependency

**现象**：`npx vite build` 报 `Rollup failed to resolve import "@dnd-kit/core"`。

**原因**：`package.json` 新增了 `@dnd-kit/core` 和 `@dnd-kit/utilities`，但 `package-lock.json` 可能未同步或 `node_modules` 未更新。

**解决**：
```bash
cd /opt/rigeng.app/mobile/frontend
npm install --legacy-peer-deps
npx vite build
```

### 坑 ⑦：GitHub Push Protection 阻止推送

**现象**：`git push` 被 GitHub 拒绝，提示发现腾讯云/阿里云密钥。

**原因**：`backend/.env.example` 中包含了真实的云服务密钥。

**解决**：将 `.env.example` 中所有密钥替换为 `YOUR_XXX` 占位符后重新提交。本地 `.env` 文件不受影响（已在 `.gitignore` 中）。

### 坑 ⑧：Git rebase 冲突

**现象**：`git push` 被拒绝，`git pull --rebase` 产生多个 add/add 冲突。

**原因**：GitHub 上有人同时推送了同名文件（MorningPlan 重构）。

**解决**：用 `git checkout --theirs` 接受本地版本后 `git rebase --continue`。

### 坑 ⑨：Windows 终端编码问题

**现象**：Python 脚本的 Unicode 字符（✓、🎉 等）在 Windows GBK 终端输出乱码或报错。

**解决**：
```python
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
```
或直接用 ASCII 替代（如 `[OK]`、`[FAIL]`）。

---

## 8. 常用运维命令

### 8.1 容器管理

```bash
# 查看所有容器
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 查看某容器日志
docker logs rigengapp-backend-1 --tail 50
docker logs rigengapp-backend-1 -f   # 实时跟踪

# 进入容器 shell
docker exec -it rigengapp-backend-1 bash

# 重启单个服务
docker restart rigengapp-backend-1

# 完全重启全栈（谨慎）
cd /opt/rigeng.app && docker compose down && docker compose up -d
```

### 8.2 数据库

```bash
# 进入 PostgreSQL
docker exec -it rigengapp-db-1 psql -U rigeng -d rigeng

# 查看数据库迁移历史
docker exec rigengapp-backend-1 alembic history

# 查看当前迁移版本
docker exec rigengapp-backend-1 alembic current

# 生成新迁移（开发时用）
docker exec rigengapp-backend-1 alembic revision --autogenerate -m "描述"

# 回滚一个版本
docker exec rigengapp-backend-1 alembic downgrade -1

# 手动执行 SQL
docker exec -it rigengapp-db-1 psql -U rigeng -d rigeng -c "SELECT ..."
```

### 8.3 前端

```bash
# 查看当前 dist 构建时间
ls -la /opt/rigeng.app/pc/dist/pc/assets/
ls -la /opt/rigeng.app/mobile/dist/mobile/assets/

# 对比容器内文件
docker exec rigengapp-nginx-1 ls -la /usr/share/nginx/html/mobile/assets/
```

### 8.4 后端调试

```bash
# 查看后端环境变量
docker exec rigengapp-backend-1 env | grep -E 'DATABASE|REDIS|JWT|RIGENG'

# 测试数据库连接
docker exec rigengapp-backend-1 python -c "
from app.shared.config import settings
print(settings.DATABASE_URL)
"

# 查看 API 路由
curl -s http://localhost:8000/docs | head -20
```

### 8.5 磁盘空间

```bash
# Docker 占用
docker system df

# 清理构建缓存（谨慎）
docker builder prune -a -f   # 清理所有构建缓存
docker system prune -a -f    # 清理所有未使用资源（包括镜像）
```

---

## 9. 架构图

```
┌──────────────────────────────────────────────────────────────────┐
│                    阿里云 ECS 47.103.197.189                      │
│                    Ubuntu 22.04 / Docker Compose                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │                  Docker Network (bridge)                  │     │
│  │                                                           │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │     │
│  │  │   nginx      │  │   backend    │  │    redis     │    │     │
│  │  │   :80        │  │   :8000      │  │    :6379     │    │     │
│  │  │              │  │              │  │              │    │     │
│  │  │  bind mount: │  │  FastAPI     │  │  Redis 7     │    │     │
│  │  │  /pc   ← dist│  │  Uvicorn     │  │  alpine      │    │     │
│  │  │  /mobile←dist│  │              │  │              │    │     │
│  │  └──────┬───────┘  └──────┬───────┘  └──────────────┘    │     │
│  │         │                 │                                │     │
│  │         │   /api/*        │                                │     │
│  │         ├────────────────►│                                │     │
│  │         │                 │                                │     │
│  │         │                 ├───────►  ┌──────────────┐     │     │
│  │         │                 │  pg      │     db       │     │     │
│  │         │                 │ ────────►│    :5432      │     │     │
│  │         │                 │          │  pgvector:pg16│     │     │
│  │         │                 │          │  volume:pgdata│     │     │
│  │         │                 │          └──────────────┘     │     │
│  │         │                 │                                │     │
│  └─────────┼─────────────────┼────────────────────────────────┘     │
│            │                 │                                      │
│  ┌─────────▼─────────────────▼─────────────────────────────────┐   │
│  │                      宿主机文件系统                           │   │
│  │                                                              │   │
│  │  /opt/rigeng.app/                                            │   │
│  │  ├── docker-compose.yml                                      │   │
│  │  ├── backend/                                                │   │
│  │  │   ├── Dockerfile                                          │   │
│  │  │   ├── app/           ──docker cp──► 容器 backend:/app/    │   │
│  │  │   ├── migrations/    ──docker cp──► 容器 backend:/app/    │   │
│  │  │   └── requirements.txt                                    │   │
│  │  ├── pc/                                                       │   │
│  │  │   ├── frontend/    (源码 → vite build → pc/dist/pc/)        │   │
│  │  │   └── dist/pc/     ──bind mount──► 容器 nginx html/pc       │   │
│  │  ├── mobile/                                                    │   │
│  │  │   ├── frontend/    (源码 → vite build → mobile/dist/mobile/) │   │
│  │  │   └── dist/mobile/ ──bind mount──► 容器 nginx html/mobile    │   │
│  │  └── nginx/rigeng.conf ──bind mount──► nginx conf.d/            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  外部访问:                                                         │
│  http://47.103.197.189:80 ──► nginx (UA分流) ──► PC or Mobile      │
│  http://47.103.197.189:80/api/* ──► nginx ──► backend:8000          │
│  http://47.103.197.189:80/health ──► nginx ──► backend:8000         │
└──────────────────────────────────────────────────────────────────────┘
```

---

> **快速参考卡**
>
> ```bash
> # 部署三步走
> cd /opt/rigeng.app && git pull origin master                   # ① 拉代码
> cd /opt/rigeng.app/pc/frontend && npm install --legacy-peer-deps --quiet && npx vite build  # ② 构建PC前端
> cd /opt/rigeng.app/mobile/frontend && npm install --legacy-peer-deps --quiet && npx vite build  # ② 构建Mobile前端
> docker cp /opt/rigeng.app/backend/app rigengapp-backend-1:/app/ && docker restart rigengapp-backend-1  # ③ 更新后端
> ```
>
> **记住四个字**: `/opt` 不是 `/www`！
