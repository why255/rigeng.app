"""测试夹具：内存 SQLite + ORM 建表 + TestClient（依赖覆盖）。"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# ⚠️ import app.shared.models 必须先于 from app.main import app
# 因为 `import a.b.c` 会在本地作用域绑定 `a`（模块），覆盖后面的 FastAPI 实例
import app.shared.models  # noqa: F401  触发 ORM 模型注册

from app.main import app as fastapi_app  # FastAPI 实例，用别名避免与包名冲突
from app.shared.database import Base, get_db

# 内存库（StaticPool 保证多连接共享同一内存库）
_engine = create_engine(
    "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool, future=True,
)
_TestSession = sessionmaker(bind=_engine, autoflush=False, autocommit=False, future=True)


@pytest.fixture(autouse=True)
def _schema():
    Base.metadata.create_all(_engine)
    yield
    Base.metadata.drop_all(_engine)


def _override_db():
    db = _TestSession()
    try:
        yield db
    finally:
        db.close()


fastapi_app.dependency_overrides[get_db] = _override_db


@pytest.fixture
def client():
    return TestClient(fastapi_app)


@pytest.fixture
def auth(client):
    """注册并登录一个学员，返回 (headers, user_id)。"""
    client.post("/api/v1/auth/register", json={
        "phone": "13800000001", "password": "secret123", "gender": "female",
    })
    r = client.post("/api/v1/auth/login", json={"phone": "13800000001", "password": "secret123"})
    data = r.json()["data"]
    return {"Authorization": f"Bearer {data['token']}"}, data["user_id"]
