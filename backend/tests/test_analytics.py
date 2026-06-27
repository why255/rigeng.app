"""⑦数据仪表盘服务 单元/接口测试（MVP 演示数据模式）。"""
from __future__ import annotations


def test_get_kpi(auth, client):
    """核心指标：返回完整结构。"""
    headers, _ = auth
    r = client.get("/api/v1/analytics/kpi", headers=headers)
    assert r.json()["code"] == 0
    data = r.json()["data"]
    assert "completion_rate" in data
    assert "sop_count" in data
    assert "streak_days" in data
    assert isinstance(data["completion_rate"], (int, float))


def test_get_trend(auth, client):
    """趋势数据：返回时序数据点。"""
    headers, _ = auth
    r = client.get("/api/v1/analytics/trend?metric_type=completion_rate&days=7", headers=headers)
    assert r.json()["code"] == 0
    data = r.json()["data"]
    assert len(data["points"]) == 7
    assert data["metric_type"] == "completion_rate"


def test_get_trend_detail(auth, client):
    """趋势详细版：返回双维度。"""
    headers, _ = auth
    r = client.get("/api/v1/analytics/trend/detail?period=week", headers=headers)
    assert r.json()["code"] == 0
    data = r.json()["data"]
    assert "completion" in data
    assert "sop" in data


def test_get_trend_detail_invalid_period(auth, client):
    """边界：非法 period → 422（Pydantic pattern 校验）。"""
    headers, _ = auth
    r = client.get("/api/v1/analytics/trend/detail?period=year", headers=headers)
    # FastAPI Pydantic 校验返回 422，不在我们的信封内
    assert r.status_code == 422


def test_get_distribution(auth, client):
    """分布统计：返回模块分布。"""
    headers, _ = auth
    r = client.get("/api/v1/analytics/distribution?dimension=module", headers=headers)
    assert r.json()["code"] == 0
    data = r.json()["data"]
    assert len(data["items"]) >= 1
    assert data["dimension"] == "module"


def test_get_comparison(auth, client):
    """双时段对比。"""
    headers, _ = auth
    r = client.get("/api/v1/analytics/comparison", headers=headers)
    assert r.json()["code"] == 0
    data = r.json()["data"]
    assert "current" in data
    assert "previous" in data


def test_get_sop_weekly(auth, client):
    """每周SOP。"""
    headers, _ = auth
    r = client.get("/api/v1/analytics/sop/weekly", headers=headers)
    assert r.json()["code"] == 0
    data = r.json()["data"]
    assert "week" in data or "count" in data


def test_get_contribution(auth, client):
    """模块贡献度。"""
    headers, _ = auth
    r = client.get("/api/v1/analytics/contribution", headers=headers)
    assert r.json()["code"] == 0
    data = r.json()["data"]
    assert "items" in data


def test_get_composition(auth, client):
    """指标构成。"""
    headers, _ = auth
    r = client.get("/api/v1/analytics/composition", headers=headers)
    assert r.json()["code"] == 0
    data = r.json()["data"]
    assert len(data["items"]) == 3


def test_get_emotion(auth, client):
    """情绪评分。"""
    headers, _ = auth
    r = client.get("/api/v1/analytics/emotion", headers=headers)
    assert r.json()["code"] == 0
    data = r.json()["data"]
    assert "score" in data
    assert "weekly_trend" in data


def test_get_alerts(auth, client):
    """预警列表。"""
    headers, _ = auth
    r = client.get("/api/v1/analytics/alerts", headers=headers)
    assert r.json()["code"] == 0
    data = r.json()["data"]
    assert "items" in data


def test_get_recommendations(auth, client):
    """推荐服务。"""
    headers, _ = auth
    r = client.get("/api/v1/analytics/recommendations", headers=headers)
    assert r.json()["code"] == 0
    data = r.json()["data"]
    assert "items" in data


def test_get_diagnosis(auth, client):
    """双向诊断（步骤13核心）：返回诊断类型和文案。"""
    headers, _ = auth
    r = client.get("/api/v1/analytics/diagnosis", headers=headers)
    assert r.json()["code"] == 0
    data = r.json()["data"]
    assert "type" in data
    assert data["type"] in ("positive", "encouraging", "caring")
    assert "message" in data
    assert "tone" in data
    assert "emoji" in data
    assert "completion_rate" in data
    assert "suggestion" in data


def test_unauthorized_access(client):
    """权限：未登录 → 10001。"""
    r = client.get("/api/v1/analytics/kpi")
    assert r.json()["code"] == 10001
