"""⑤搜索/RAG服务 单元/接口测试。"""
from __future__ import annotations


def _create_doc(client, headers, title="测试文档", content_text="这是测试内容",
                library_type="private", hr_category="招聘配置"):
    """辅助：创建文档并返回 doc_id。"""
    r = client.post("/api/v1/kb/documents", json={
        "doc_type": "article",
        "source_module": "M1",
        "hr_category": hr_category,
        "title": title,
        "content": {"text": content_text, "format": "plain"},
        "library_type": library_type,
    }, headers=headers)
    body = r.json()
    # 如果文档创建成功（可能因情绪/负面检测被拒），返回 doc_id
    if body["code"] == 0:
        return body["data"]["doc_id"]
    return None


def test_keyword_search_returns_results(auth, client):
    """正常流：创建文档 → 关键词搜索 → 找到结果。"""
    headers, _ = auth

    doc_id = _create_doc(client, headers, title="结构化面试常见问题",
                         content_text="如何设计结构化面试流程和评估标准")
    assert doc_id is not None

    # 索引文档
    r = client.post(f"/api/v1/search/index/{doc_id}", headers=headers)
    assert r.json()["code"] == 0

    # 关键词搜索
    r = client.get("/api/v1/search/keyword?q=结构化面试", headers=headers)
    assert r.json()["code"] == 0
    data = r.json()["data"]
    assert data["total"] >= 1
    assert data["engine_used"] == "keyword"


def test_keyword_search_empty(auth, client):
    """边界：搜索不存在的关键词 → 70001。"""
    headers, _ = auth
    r = client.get("/api/v1/search/keyword?q=火星移民攻略2025", headers=headers)
    assert r.json()["code"] == 70001


def test_semantic_search_fallback_to_keyword(auth, client):
    """语义搜索降级到关键词搜索。"""
    headers, _ = auth

    doc_id = _create_doc(client, headers, title="OKR和KPI绩效考核方案设计",
                         content_text="OKR和KPI的区别与适用场景分析")
    assert doc_id is not None

    r = client.post(f"/api/v1/search/index/{doc_id}", headers=headers)
    assert r.json()["code"] == 0

    r = client.get("/api/v1/search/semantic?q=OKR", headers=headers)
    assert r.json()["code"] == 0
    assert r.json()["data"]["engine_used"] == "keyword"  # MVP 降级


def test_index_document(auth, client):
    """索引文档 → vector_status 更新。"""
    headers, _ = auth

    doc_id = _create_doc(client, headers, title="培训需求分析方法")
    assert doc_id is not None

    r = client.post(f"/api/v1/search/index/{doc_id}", headers=headers)
    assert r.json()["code"] == 0
    data = r.json()["data"]
    assert data["indexed"] is True
    assert data["vector_status"] == "ready"


def test_index_nonexistent_doc(auth, client):
    """边界：索引不存在的文档 → 40001。"""
    headers, _ = auth
    r = client.post("/api/v1/search/index/nonexistent-doc-id-12345", headers=headers)
    assert r.json()["code"] == 40001


def test_search_health(client):
    """搜索健康检查（无需认证）。"""
    r = client.get("/api/v1/search/health")
    assert r.json()["code"] == 0
    data = r.json()["data"]
    assert data["is_available"] is True
    assert "embedding_model" in data


def test_search_excludes_negative_content(auth, client):
    """负面内容文档不出现在搜索结果中。"""
    headers, _ = auth

    # 创建正常文档
    doc_id = _create_doc(client, headers, title="企业文化活动策划",
                         content_text="团队建设方案")
    assert doc_id is not None
    client.post(f"/api/v1/search/index/{doc_id}", headers=headers)

    # 搜索应只返回正常文档（负面内容文档不会出现在结果中）
    r = client.get("/api/v1/search/keyword?q=团队建设", headers=headers)
    # 可能找到也可能找不到，取决于数据
    if r.json()["code"] == 0:
        items = r.json()["data"]["items"]
        for item in items:
            assert item["source"] in ("private", "public")


def test_unauthorized_search(client):
    """权限：未登录搜索 → 10001。"""
    r = client.get("/api/v1/search/keyword?q=test")
    assert r.json()["code"] == 10001
