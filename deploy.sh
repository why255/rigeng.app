#!/usr/bin/env bash
# ============================================================
# 日耕（RiGeng）一键部署脚本
# 用法：bash deploy.sh [dev|prod]
#   dev  - 开发模式（默认）：SQLite + uvicorn --reload
#   prod - 生产模式：PostgreSQL + docker compose
# ============================================================
set -euo pipefail

MODE="${1:-dev}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# ── 颜色输出 ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[✗]${NC} $*"; exit 1; }

echo "============================================================"
echo "  日耕（RiGeng）部署脚本 — 模式: $MODE"
echo "============================================================"

# ═══════════════════════════════════════════════
# 步骤 0：环境预检
# ═══════════════════════════════════════════════
log "步骤 0/6：环境预检..."

# Python
if ! command -v python3 &>/dev/null && ! command -v python &>/dev/null; then
    err "未找到 Python，请安装 Python 3.11+"
fi
PYTHON=$(command -v python3 || command -v python)
PY_VER=$($PYTHON --version 2>&1 | grep -oP '\d+\.\d+' | head -1)
log "Python: $PY_VER"

# Node.js (仅 prod 模式需要构建前端)
if [ "$MODE" = "prod" ]; then
    if ! command -v node &>/dev/null; then
        err "未找到 Node.js，生产模式需要构建前端"
    fi
    NODE_VER=$(node --version)
    log "Node.js: $NODE_VER"
fi

# ═══════════════════════════════════════════════
# 步骤 1：拉取最新代码
# ═══════════════════════════════════════════════
log "步骤 1/6：拉取最新代码..."
cd "$SCRIPT_DIR"
if [ -d .git ]; then
    git pull origin master 2>/dev/null || warn "git pull 失败（可能无网络或非 git 仓库），使用当前代码"
else
    warn "非 git 仓库，跳过拉取"
fi

# ═══════════════════════════════════════════════
# 步骤 2：安装 Python 依赖
# ═══════════════════════════════════════════════
log "步骤 2/6：安装 Python 依赖..."
cd "$BACKEND_DIR"

# 创建虚拟环境（如果不存在）
if [ ! -d ".venv" ]; then
    log "创建 Python 虚拟环境..."
    $PYTHON -m venv .venv
fi

# 激活虚拟环境
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
elif [ -f ".venv/Scripts/activate" ]; then
    source .venv/Scripts/activate
else
    err "无法找到虚拟环境激活脚本"
fi

pip install -r requirements.txt --quiet
log "Python 依赖安装完成"

# ═══════════════════════════════════════════════
# 步骤 3：前端构建（仅生产模式）
# ═══════════════════════════════════════════════
if [ "$MODE" = "prod" ]; then
    log "步骤 3/6：构建前端..."
    cd "$FRONTEND_DIR"

    if [ ! -d "node_modules" ]; then
        log "安装前端依赖..."
        npm install --legacy-peer-deps
    fi

    log "构建 PC 端..."
    npm run build:pc

    log "构建 Mobile 端..."
    npm run build:mobile

    log "前端构建完成"
else
    log "步骤 3/6：跳过前端构建（开发模式使用 Vite dev server）"
fi

# ═══════════════════════════════════════════════
# 步骤 4：检查 .env 配置
# ═══════════════════════════════════════════════
log "步骤 4/6：检查环境变量配置..."
cd "$BACKEND_DIR"

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        warn ".env 文件不存在！"
        warn "请执行以下操作后重新运行本脚本："
        echo ""
        echo "  cp backend/.env.example backend/.env"
        echo "  nano backend/.env   # 编辑配置，替换所有 changeme 占位符"
        echo ""
        if [ "$MODE" = "prod" ]; then
            echo "  ⚠️  生产环境必须设置强随机 JWT_SECRET："
            echo "  python -c \"import secrets; print(secrets.token_urlsafe(64))\""
            echo "  # 将输出粘贴到 .env 的 JWT_SECRET= 后面"
        fi
        err "缺少 .env 文件，部署中止"
    else
        err "缺少 .env 文件且未找到 .env.example 模板"
    fi
fi

# 生产环境安全检查
if [ "$MODE" = "prod" ]; then
    if grep -q "changeme" .env 2>/dev/null; then
        warn ".env 中仍存在 'changeme' 占位符，部分云服务可能不可用"
    fi
    if grep -q 'JWT_SECRET=dev-local' .env 2>/dev/null; then
        err "生产环境禁止使用默认 JWT_SECRET，请在 .env 中设置强随机密钥"
    fi
fi

log ".env 配置检查通过"

# ═══════════════════════════════════════════════
# 步骤 5：数据库迁移
# ═══════════════════════════════════════════════
log "步骤 5/6：执行数据库迁移..."
cd "$BACKEND_DIR"

# 确保虚拟环境已激活
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
elif [ -f ".venv/Scripts/activate" ]; then
    source .venv/Scripts/activate
fi

alembic upgrade head
log "数据库迁移完成"

# ═══════════════════════════════════════════════
# 步骤 6：启动服务
# ═══════════════════════════════════════════════
log "步骤 6/6：启动后端服务..."
cd "$BACKEND_DIR"

if [ "$MODE" = "prod" ]; then
    log "生产模式：使用 docker compose 启动全栈服务..."
    cd "$SCRIPT_DIR"
    docker compose up -d --build
    echo ""
    log "============================================================"
    log "  部署完成！"
    log "  - PC 端：    http://localhost"
    log "  - Mobile 端：http://localhost/mobile"
    log "  - API 文档： http://localhost:8000/docs"
    log "  - 健康检查： http://localhost:8000/health"
    log "============================================================"
else
    log "开发模式：启动 uvicorn（热重载）..."
    echo ""
    log "============================================================"
    log "  后端启动中..."
    log "  - API 文档： http://127.0.0.1:8000/docs"
    log "  - 健康检查： http://127.0.0.1:8000/health"
    log "  - 前端（另开终端）： cd frontend && npm run dev"
    log "============================================================"
    echo ""
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
fi
