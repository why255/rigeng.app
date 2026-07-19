"""RAG 加速层 —— L1 Redis 缓存、L2 全文检索(后续接入)。

与 search_rag 服务的关系:
- search_rag 保持原有职责:向量检索、三层编排、prompt 注入格式化
- 本包只做加速/缓存,由 search_rag 在入口处显式调用
"""
