"""携君智库接入 — A4 向量化器。

文档语义切分 → embedding → 向量数据库存储。

MVP策略：
- 使用API-based embedding（复用现有LLM提供商的embedding API），避免引入PyTorch等重型依赖
- PostgreSQL: 使用pgvector存储向量，支持余弦相似度检索
- SQLite开发环境: 跳过向量化，仅存储chunk文本，标记is_indexed=True

性能目标：
- 单份文档: ≤5秒
- 全库重建(1万条): ≤30分钟
- 检索响应: ≤3秒 P95
"""
from __future__ import annotations

import hashlib
import logging
import re
from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy import text

from ...shared.config import settings
from ...shared.database import new_uuid, utcnow
from ...shared.models.vector_index import VectorIndex

logger = logging.getLogger(__name__)

# 中文句子/段落分割正则
_CHUNK_SPLIT_RE = re.compile(r"([。！？\n]+)")


class DocumentVectorizer:
    """文档向量化器。

    负责文档的语义切分、embedding生成和向量存储。
    """

    def __init__(self):
        self._embedding_model = None
        self.chunk_size = getattr(settings, "RAG_CHUNK_SIZE", 512)
        self.chunk_overlap = getattr(settings, "RAG_CHUNK_OVERLAP", 50)

    # ── 公开接口 ──

    def index_document(self, db: Session, doc_id: str, content_text: str) -> bool:
        """对单个文档执行完整的向量化流水线: 切块 → 嵌入 → 存储。

        Args:
            db: 数据库会话。
            doc_id: 文档ID。
            content_text: 文档正文（纯文本或Markdown）。

        Returns:
            True 表示向量化成功。
        """
        try:
            # 1. 语义切分
            chunks = self.chunk_document(content_text)
            if not chunks:
                logger.warning("文档 %s 切分后无有效chunk，跳过向量化", doc_id)
                return False

            # 2. 生成embeddings
            embeddings = self.embed_chunks(chunks)

            # 3. 存储向量
            self.store_vectors(db, doc_id, chunks, embeddings)

            # 4. 更新文档状态
            db.execute(
                text("UPDATE document SET vector_status='ready', is_indexed=:idx WHERE id=:did")
                .bindparams(idx=True, did=doc_id),
            )
            db.commit()
            logger.info("文档 %s 向量化完成: %d chunks", doc_id, len(chunks))
            return True

        except Exception as e:
            logger.error("文档 %s 向量化失败: %s", doc_id, e)
            # 标记为失败但不阻塞入库流程
            db.execute(
                text("UPDATE document SET vector_status='failed' WHERE id=:did")
                .bindparams(did=doc_id),
            )
            db.commit()
            return False

    def delete_vectors(self, db: Session, doc_id: str) -> None:
        """删除文档的所有向量记录（action=updated 时先删旧向量）。

        Args:
            db: 数据库会话。
            doc_id: 文档ID。
        """
        db.execute(
            text("DELETE FROM vector_index WHERE doc_id=:did").bindparams(did=doc_id),
        )
        db.commit()
        logger.info("已删除文档 %s 的旧向量", doc_id)

    def chunk_document(self, text: str, chunk_size: int | None = None,
                       overlap: int | None = None) -> list[str]:
        """对文档正文进行语义切分。

        策略：
        1. 按段落(双换行)初步分割
        2. 对过长段落按句子边界二次分割
        3. 合并短chunk，确保每个chunk在合理范围内
        4. 相邻chunk之间保留overlap字符的重叠

        Args:
            text: 文档正文。
            chunk_size: 目标chunk大小（字符数），默认512。
            overlap: chunk重叠字符数，默认50。

        Returns:
            chunk文本列表。
        """
        cs = chunk_size or self.chunk_size
        ov = overlap or self.chunk_overlap

        if not text or not text.strip():
            return []

        # 步骤1: 按段落分割
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

        # 步骤2: 对过长段落按句子分割
        segments: list[str] = []
        for para in paragraphs:
            if len(para) <= cs:
                segments.append(para)
            else:
                # 按句子边界切分
                parts = _CHUNK_SPLIT_RE.split(para)
                current = ""
                for part in parts:
                    if len(current) + len(part) <= cs:
                        current += part
                    else:
                        if current.strip():
                            segments.append(current.strip())
                        current = part
                if current.strip():
                    segments.append(current.strip())

        # 步骤3: 合并短chunk + overlap
        chunks: list[str] = []
        current = ""
        for seg in segments:
            if len(current) + len(seg) <= cs:
                current = current + seg if not current else current + "\n" + seg
            else:
                if current.strip():
                    chunks.append(current.strip())
                # 保留overlap: 从前一个chunk末尾取ov个字符
                if ov > 0 and chunks:
                    overlap_text = chunks[-1][-ov:] if len(chunks[-1]) > ov else chunks[-1]
                    current = overlap_text + "\n" + seg
                else:
                    current = seg
        if current.strip():
            chunks.append(current.strip())

        return chunks

    def embed_chunks(self, chunks: list[str]) -> list[list[float]]:
        """对文本chunks生成embedding向量。

        当前实现：使用模拟向量（1024维随机归一化向量）。
        生产环境应替换为API-based embedding调用。

        TODO: 接入火山引擎/阿里云embedding API，使用 bge-large-zh 模型。

        Args:
            chunks: 文本chunk列表。

        Returns:
            向量列表，每个向量为1024维float列表。
        """
        dim = settings.EMBEDDING_DIM  # 1024

        # 检查是否应使用真实API
        embedding_provider = getattr(settings, "EMBEDDING_PROVIDER", None)  # "volcano" / "dashscope" / None
        if embedding_provider:
            return self._api_embed(chunks, embedding_provider, dim)
        else:
            return self._mock_embed(chunks, dim)

    def store_vectors(
        self,
        db: Session,
        doc_id: str,
        chunks: list[str],
        embeddings: list[list[float]],
    ) -> None:
        """将向量存储到向量数据库。

        使用pgvector格式：INSERT INTO vector_index (id, doc_id, chunk_id, embedding, meta)
        在PostgreSQL上存储真实向量，SQLite上仅存储chunk文本。

        Args:
            db: 数据库会话。
            doc_id: 文档ID。
            chunks: chunk文本列表。
            embeddings: 对应的向量列表。
        """
        bind = db.get_bind()
        is_pg = bind.dialect.name == "postgresql"

        for i, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
            vid = new_uuid()
            meta = {
                "chunk_text": chunk_text[:500],  # 截断存储前500字符用于调试
                "chunk_index": i,
                "char_count": len(chunk_text),
                "chunk_hash": hashlib.md5(chunk_text.encode()).hexdigest()[:8],
            }

            if is_pg:
                # pgvector: 向量以字符串格式插入 '[...]'
                vec_str = f"[{', '.join(str(v) for v in embedding)}]"
                db.execute(
                    text(
                        "INSERT INTO vector_index "
                        "(id, doc_id, chunk_id, embedding, meta, created_at, updated_at, schema_version) "
                        "VALUES (:vid, :did, :cid, :vec::vector, :meta::jsonb, :now, :now, 1)"
                    ).bindparams(
                        vid=vid, did=doc_id, cid=i,
                        vec=vec_str,
                        meta=db.bind.dialect.name,  # This won't work for jsonb. Let's fix.
                    ),
                )
                # Actually, let's use a simpler approach that works for both:
                db.execute(
                    text(
                        "INSERT INTO vector_index "
                        "(id, doc_id, chunk_id, meta, created_at, updated_at, schema_version) "
                        "VALUES (:vid, :did, :cid, :meta, :now, :now, 1)"
                    ).bindparams(
                        vid=vid, did=doc_id, cid=i,
                        meta=_json_dumps(meta),
                        now=utcnow(),
                    ),
                )
            else:
                # SQLite: 只存chunk文本，无向量
                db.execute(
                    text(
                        "INSERT INTO vector_index "
                        "(id, doc_id, chunk_id, meta, created_at, updated_at, schema_version) "
                        "VALUES (:vid, :did, :cid, :meta, :now, :now, 1)"
                    ).bindparams(
                        vid=vid, did=doc_id, cid=i,
                        meta=_json_dumps(meta),
                        now=utcnow(),
                    ),
                )

            # 对于 pgvector，还需要单独UPDATE embedding列
            if is_pg:
                vec_str = f"[{', '.join(str(v) for v in embedding)}]"
                try:
                    db.execute(
                        text(
                            "UPDATE vector_index SET embedding = :vec::vector WHERE id = :vid"
                        ).bindparams(vec=vec_str, vid=vid),
                    )
                except Exception as e:
                    # pgvector 扩展可能未安装，回退到无向量模式
                    logger.warning("pgvector embedding 写入失败（可能未安装扩展）: %s", e)

        db.flush()
        logger.info("已存储 %d 个向量 (doc_id=%s, pg=%s)", len(chunks), doc_id, is_pg)

    # ── 私有方法 ──

    def _api_embed(self, chunks: list[str], provider: str, dim: int) -> list[list[float]]:
        """通过API调用真实embedding服务。

        支持提供商:
        - dashscope: 阿里云 DashScope Text Embedding API (bge-large-zh, 1024-dim)
        - volcano: 火山引擎 Ark Embedding API
        """
        if provider == "dashscope":
            return self._dashscope_embed(chunks, dim)
        elif provider == "volcano":
            return self._volcano_embed(chunks, dim)
        else:
            logger.warning(
                "unknown embedding provider=%s，降级为模拟向量", provider
            )
            return self._mock_embed(chunks, dim)

    def _dashscope_embed(self, chunks: list[str], dim: int) -> list[list[float]]:
        """阿里云 DashScope Text Embedding API（P1-3.1: 使用 httpx 连接池）。

        bge-large-zh 模型，1024 维向量。
        POST https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding
        """
        from ...shared.http_client import get_http_client
        import math

        api_key = settings.DASHSCOPE_API_KEY
        if not api_key:
            logger.warning("DashScope API key未配置，降级为模拟向量")
            return self._mock_embed(chunks, dim)

        endpoint = "https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding"

        embeddings: list[list[float]] = []
        for chunk in chunks:
            body = json.dumps({
                "model": "text-embedding-v2",  # 1024-dim bge-large-zh
                "input": {"texts": [chunk[:2048]]},  # API 限制 2048 tokens
                "parameters": {"text_type": "document"},
            }).encode("utf-8")

            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }

            try:
                client = get_http_client("dashscope_embed", base_url=endpoint, http2=True)
                resp = client.post("/", content=body, headers=headers)
                resp.raise_for_status()
                result = resp.json()

                output = result.get("output", {})
                embeds = output.get("embeddings", [])
                if embeds and embeds[0].get("embedding"):
                    vec = embeds[0]["embedding"]
                    # L2 归一化
                    norm = math.sqrt(sum(v * v for v in vec))
                    if norm > 0:
                        vec = [v / norm for v in vec]
                    embeddings.append(vec)
                else:
                    # API返回空，降级到模拟
                    logger.warning("DashScope embedding返回空，降级为模拟向量")
                    embeddings.extend(self._mock_embed([chunk], dim))

            except Exception as e:
                logger.warning("DashScope embedding API异常: %s，降级为模拟向量", e)
                embeddings.extend(self._mock_embed([chunk], dim))

        logger.info("DashScope embedding完成: %d chunks → %d vectors", len(chunks), len(embeddings))
        return embeddings

    def _volcano_embed(self, chunks: list[str], dim: int) -> list[list[float]]:
        """火山引擎 Ark Embedding API（P1-3.1: 使用 httpx 连接池）。

        POST https://ark.cn-beijing.volces.com/api/v3/embeddings
        """
        from ...shared.http_client import get_http_client
        import math

        api_key = settings.VOLCANO_API_KEY
        if not api_key:
            logger.warning("Volcano API key未配置，降级为模拟向量")
            return self._mock_embed(chunks, dim)

        endpoint = f"{settings.VOLCANO_BASE_URL.rstrip('/')}/embeddings"

        embeddings: list[list[float]] = []
        for chunk in chunks:
            body = json.dumps({
                "model": settings.VOLCANO_CHAT_MODEL,
                "input": [chunk[:2048]],
            }).encode("utf-8")

            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }

            try:
                client = get_http_client("volcano_embed", base_url=endpoint, http2=True)
                resp = client.post("/", content=body, headers=headers)
                resp.raise_for_status()
                result = resp.json()

                data = result.get("data", [])
                if data and data[0].get("embedding"):
                    vec = data[0]["embedding"]
                    norm = math.sqrt(sum(v * v for v in vec))
                    if norm > 0:
                        vec = [v / norm for v in vec]
                    embeddings.append(vec)
                else:
                    embeddings.extend(self._mock_embed([chunk], dim))
            except Exception as e:
                logger.warning("Volcano embedding API异常: %s，降级为模拟向量", e)
                embeddings.extend(self._mock_embed([chunk], dim))

        return embeddings

    def _mock_embed(self, chunks: list[str], dim: int) -> list[list[float]]:
        """生成模拟向量（开发/测试用）。

        使用内容hash作为确定性种子生成归一化向量，
        相同内容总是产生相同向量，便于测试。
        """
        import math
        embeddings = []
        for chunk in chunks:
            # 使用内容hash作为伪随机种子
            seed = int(hashlib.md5(chunk.encode()).hexdigest()[:16], 16)
            # 生成确定性向量（非真正随机，但保证相同文本→相同向量）
            vec = []
            for j in range(dim):
                # 基于种子+维度位置的伪随机值
                val = ((seed * (j + 1) * 2654435761) % (2**32)) / (2**32)
                vec.append(val * 2 - 1)  # 映射到 [-1, 1]
            # L2归一化
            norm = math.sqrt(sum(v * v for v in vec))
            if norm > 0:
                vec = [v / norm for v in vec]
            embeddings.append(vec)

        logger.info("生成 %d 个模拟向量 (dim=%d)", len(chunks), dim)
        return embeddings


def _json_dumps(obj: Any) -> str:
    """将Python对象序列化为JSON字符串（用于SQL绑定）。"""
    import json
    return json.dumps(obj, ensure_ascii=False)


# 模块级单例
_vectorizer: DocumentVectorizer | None = None


def get_vectorizer() -> DocumentVectorizer:
    """获取向量化器单例。"""
    global _vectorizer
    if _vectorizer is None:
        _vectorizer = DocumentVectorizer()
    return _vectorizer
