# 日耕（RiGeng）FastAPI 后端 Docker 镜像
FROM python:3.11-slim

WORKDIR /app

# 系统依赖：psycopg2 编译所需
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Python 依赖层（优先缓存）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 应用代码
COPY . .

# 暴露后端端口
EXPOSE 8000

# 启动：先迁移再启动 uvicorn
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
