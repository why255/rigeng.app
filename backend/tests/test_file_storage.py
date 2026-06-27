"""④文件存储服务 单元/接口测试。"""
from __future__ import annotations

import io


def test_upload_and_get_info(auth, client):
    """正常流：上传 → 获取元数据 → 下载 → 配额查询。"""
    headers, user_id = auth

    # 上传文本文件
    content = b"Hello, this is a test document for file storage."
    r = client.post(
        "/api/v1/files/upload",
        files={"file": ("test.txt", io.BytesIO(content), "text/plain")},
        data={"file_type": "document", "storage_layer": "cloud"},
        headers=headers,
    )
    assert r.json()["code"] == 0
    data = r.json()["data"]
    assert data["file_id"]
    assert data["size_bytes"] == len(content)
    file_id = data["file_id"]

    # 获取元数据
    r = client.get(f"/api/v1/files/{file_id}", headers=headers)
    assert r.json()["code"] == 0
    info = r.json()["data"]
    assert info["file_type"] == "document"
    assert info["size_bytes"] == len(content)

    # 下载
    r = client.get(f"/api/v1/files/{file_id}/download", headers=headers)
    assert r.json()["code"] == 0
    assert r.json()["data"]["file_id"] == file_id

    # 配额查询
    r = client.get("/api/v1/files/quota/my", headers=headers)
    assert r.json()["code"] == 0
    assert "used_mb" in r.json()["data"]


def test_file_not_found(auth, client):
    """边界：不存在的文件 → 60002。"""
    headers, _ = auth
    r = client.get("/api/v1/files/nonexistent123", headers=headers)
    assert r.json()["code"] == 60002


def test_delete_file(auth, client):
    """删除文件 → 软删除成功。"""
    headers, _ = auth

    content = b"Temporary file to be deleted."
    r = client.post(
        "/api/v1/files/upload",
        files={"file": ("temp.txt", io.BytesIO(content), "text/plain")},
        data={"file_type": "document"},
        headers=headers,
    )
    assert r.json()["code"] == 0
    file_id = r.json()["data"]["file_id"]

    r = client.delete(f"/api/v1/files/{file_id}", headers=headers)
    assert r.json()["code"] == 0
    assert r.json()["data"]["deleted"] is True

    # 再次获取应返回 60002
    r = client.get(f"/api/v1/files/{file_id}", headers=headers)
    assert r.json()["code"] == 60002


def test_compress_audio(auth, client):
    """音频压缩（MVP stub）→ 标记 compressed。"""
    headers, _ = auth

    content = b"\x00" * 1024  # 模拟音频内容
    r = client.post(
        "/api/v1/files/upload",
        files={"file": ("audio.wav", io.BytesIO(content), "audio/wav")},
        data={"file_type": "audio"},
        headers=headers,
    )
    assert r.json()["code"] == 0
    file_id = r.json()["data"]["file_id"]

    r = client.post(f"/api/v1/files/{file_id}/compress", headers=headers)
    assert r.json()["code"] == 0
    assert r.json()["data"]["compress_status"] == "compressed"


def test_compress_non_audio_rejected(auth, client):
    """非音频文件压缩 → 60020。"""
    headers, _ = auth

    content = b"Plain text document."
    r = client.post(
        "/api/v1/files/upload",
        files={"file": ("doc.txt", io.BytesIO(content), "text/plain")},
        data={"file_type": "document"},
        headers=headers,
    )
    file_id = r.json()["data"]["file_id"]

    r = client.post(f"/api/v1/files/{file_id}/compress", headers=headers)
    assert r.json()["code"] == 60020


def test_unauthorized_access(auth, client):
    """权限：未登录 → 10001。"""
    r = client.get("/api/v1/files/some-id")
    assert r.json()["code"] == 10001


def test_local_encrypted_no_download(auth, client):
    """local_encrypted 层文件不可云端下载 → 60040。"""
    headers, _ = auth

    content = b"Sensitive content that stays on device."
    r = client.post(
        "/api/v1/files/upload",
        files={"file": ("sensitive.txt", io.BytesIO(content), "text/plain")},
        data={"file_type": "document", "storage_layer": "local_encrypted"},
        headers=headers,
    )
    assert r.json()["code"] == 0
    file_id = r.json()["data"]["file_id"]

    r = client.get(f"/api/v1/files/{file_id}/download", headers=headers)
    assert r.json()["code"] == 60040


def test_quota_unauthenticated(client):
    """未登录查配额 → 10001。"""
    r = client.get("/api/v1/files/quota/my")
    assert r.json()["code"] == 10001
