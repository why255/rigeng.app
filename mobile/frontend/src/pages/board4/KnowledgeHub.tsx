/**
 * M12-P1 公私智库入口页
 * 对齐 m12-p1.html 设计：搜索、双库概览、最近文档、分类入口
 */
import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/AppShell';
import { Card, Text, Tag, Button, ProgressBar } from '@/shared/components/primitives';
import { useToast } from '@/shared/components/primitives/toast';
import * as knowledgeApi from '@/shared/api/knowledge';
import type { DocStats, DocumentItem, Category, SearchResult } from '@/shared/api/knowledge';
import '../pages.css';
import './knowledge.css';

export function KnowledgeHub() {
  const navigate = useNavigate();
  const toast = useToast();
  const [stats, setStats] = useState<DocStats | null>(null);
  const [recentDocs, setRecentDocs] = useState<DocumentItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [hotSearches, setHotSearches] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [s, docs, cats, hot] = await Promise.all([
          knowledgeApi.fetchDocStats().catch(() => null),
          knowledgeApi.fetchRecentDocs(5, 'latest').catch(() => []),
          knowledgeApi.fetchCategories().catch(() => []),
          knowledgeApi.fetchHotSearches().catch(() => []),
        ]);
        if (!cancelled) {
          setStats(s);
          setRecentDocs(docs);
          setCategories(cats);
          setHotSearches(hot);
        }
      } catch {
        if (!cancelled) {
          // 使用 fallback 占位数据
          setStats({
            totalDocs: 3584,
            privateCount: 128,
            publicCount: 3456,
            storageUsed: 2.3,
            storageLimit: 5,
            todayNew: 12,
          });
          setRecentDocs([]);
          setCategories(getDefaultCategories());
          setHotSearches(['绩效考核模板', '离职补偿方案', 'HRBP胜任力', '薪酬体系设计']);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleSearch = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchResults(null);
    try {
      const result = await knowledgeApi.searchDocs(q, 20);
      setSearchResults(result);
      if (result.items.length === 0) {
        toast('未找到匹配文档，请尝试其他关键词', 'warning');
      }
    } catch {
      toast('搜索失败，请稍后重试', 'error');
    } finally {
      setSearching(false);
    }
  }, [searchQuery, toast]);

  const storagePercent = stats ? Math.round((stats.storageUsed / stats.storageLimit) * 100) : 0;

  return (
    <PageContainer width="dashboard">
      <div data-module="knowledge-base">
        {/* 品牌标语 */}
        <section className="kb-hero">
          <Text level="l6" as="div" color="var(--color-neutral-600)" style={{ marginBottom: 4 }}>
            日耕朝夕，耕愈工作，耕暖生活
          </Text>
          <Text level="l0" as="h2" color="var(--color-brand-primary)">
            随手存结晶，终成你底气
          </Text>
        </section>

        {/* 搜索栏 */}
        <section className="pg-section">
          <form onSubmit={handleSearch} className="kb-search-form">
            <div className="kb-search-bar">
              <span className="kb-search-icon">🔍</span>
              <input
                className="kb-search-input"
                type="text"
                placeholder="搜索文档、知识点或 SOP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button type="button" className="kb-search-clear" onClick={() => { setSearchQuery(''); setSearchResults(null); }}>
                  ✕
                </button>
              )}
            </div>
            <Button type="submit" disabled={searching || !searchQuery.trim()}>
              {searching ? '搜索中…' : '检索'}
            </Button>
          </form>

          {/* 热门搜索 */}
          {hotSearches.length > 0 && !searchResults && (
            <div className="kb-hot-searches">
              <Text level="l7" color="var(--color-neutral-500)">热门搜索：</Text>
              {hotSearches.map((tag) => (
                <button
                  key={tag}
                  className="kb-hot-tag"
                  onClick={() => { setSearchQuery(tag); handleSearch({ preventDefault: () => {} } as FormEvent); }}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* 搜索结果 */}
          {searchResults && (
            <Card style={{ marginTop: 'var(--spacing-md)' }}>
              <div className="pg-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
                <Text level="l5">
                  搜索 "{searchResults.query}" — 找到 {searchResults.total} 条结果
                </Text>
                <Button variant="text" size="sm" onClick={() => setSearchResults(null)}>
                  清除
                </Button>
              </div>
              {searchResults.items.slice(0, 10).map((doc) => (
                <div
                  key={doc.id}
                  className="kb-search-result-item"
                  onClick={() => navigate(`/m/knowledge-base/list?doc=${doc.id}`)}
                >
                  <span className="kb-file-icon">{doc.fileType === 'pdf' ? '📄' : doc.fileType === 'docx' ? '📝' : '📋'}</span>
                  <div className="kb-search-result-info">
                    <Text level="l5">{doc.title}</Text>
                    <Text level="l7" color="var(--color-neutral-500)">
                      {doc.library === 'private' ? '私有库' : '携君库'} · {doc.category}
                    </Text>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </section>

        {/* 双库概览卡片 */}
        <section className="pg-section">
          <div className="pg-grid-2">
            {/* 私有库 */}
            <Card
              barColor="var(--module-color-bar)"
              clickable
              onClick={() => navigate('/m/knowledge-base/list?library=private')}
            >
              <div className="kb-lib-card">
                <div className="kb-lib-card__header">
                  <span className="kb-lib-icon">📂</span>
                  <div>
                    <Text level="l3" as="div">私有库</Text>
                    <Text level="l6" color="var(--color-neutral-500)">
                      {loading ? '加载中…' : `${stats?.privateCount ?? 0} 份文档`}
                    </Text>
                  </div>
                </div>
                <div className="kb-lib-card__storage">
                  <div className="pg-row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text level="l7" color="var(--color-neutral-500)">
                      {stats ? `${stats.storageUsed}GB / ${stats.storageLimit}GB` : ''}
                    </Text>
                    <Text level="l7" color="var(--color-neutral-500)">{storagePercent}%</Text>
                  </div>
                  <ProgressBar value={storagePercent} />
                </div>
                <Button variant="primary" style={{ width: '100%', marginTop: 'var(--spacing-md)' }}>
                  进入私有库
                </Button>
              </div>
            </Card>

            {/* 携君库 */}
            <Card
              barColor="#D4A574"
              clickable
              onClick={() => navigate('/m/knowledge-base/list?library=public')}
            >
              <div className="kb-lib-card">
                <div className="kb-lib-card__header">
                  <span className="kb-lib-icon">🏛️</span>
                  <div>
                    <Text level="l3" as="div">携君库</Text>
                    <Text level="l6" color="var(--color-neutral-500)">
                      {loading ? '加载中…' : `${stats?.publicCount ?? 0} 份文档`}
                    </Text>
                  </div>
                </div>
                <div className="kb-lib-card__desc">
                  <Text level="l7" color="var(--color-neutral-500)">覆盖 HR 八大模块</Text>
                  {stats && stats.todayNew > 0 && (
                    <Tag tone="brand">今日新增 {stats.todayNew} 篇</Tag>
                  )}
                </div>
                <Button
                  variant="secondary"
                  style={{ width: '100%', marginTop: 'var(--spacing-md)', borderColor: '#D4A574', color: '#8B6914' }}
                >
                  探索携君库
                </Button>
              </div>
            </Card>
          </div>
        </section>

        {/* 分类目录 + 最近文档 */}
        <section className="pg-section">
          <div className="kb-split-layout">
            {/* 分类目录 */}
            <div className="kb-categories-panel">
              <div className="pg-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
                <Text level="l5" as="div">📁 分类目录</Text>
              </div>
              <div className="kb-category-list">
                {(categories.length > 0 ? categories : getDefaultCategories()).map((cat) => (
                  <button
                    key={cat.id}
                    className="kb-category-item"
                    onClick={() => navigate(`/m/knowledge-base/list?category=${encodeURIComponent(cat.name)}`)}
                  >
                    <span className="kb-category-icon">📂</span>
                    <span className="kb-category-name">{cat.name}</span>
                    <span className="kb-category-count">{cat.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 最近文档 */}
            <div className="kb-recent-panel">
              <div className="pg-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
                <Text level="l5" as="div">最近更新</Text>
                <div className="pg-row" style={{ gap: 'var(--spacing-sm)' }}>
                  <Button variant="text" size="sm" onClick={() => navigate('/m/knowledge-base/audit')}>
                    查看待审核
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => navigate('/m/knowledge-base/list')}>
                    上传文档
                  </Button>
                </div>
              </div>

              {loading ? (
                <Text level="l6" color="var(--color-neutral-500)" style={{ textAlign: 'center', padding: '24px 0' }}>
                  加载中…
                </Text>
              ) : recentDocs.length > 0 ? (
                <div className="kb-doc-list">
                  {recentDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="kb-doc-item"
                      onClick={() => navigate(`/m/knowledge-base/list?doc=${doc.id}`)}
                    >
                      <span className="kb-file-icon">
                        {doc.fileType === 'pdf' ? '📄' : doc.fileType === 'docx' ? '📝' : '📋'}
                      </span>
                      <div className="kb-doc-item__info">
                        <Text level="l5" as="div" className="kb-doc-item__title">{doc.title}</Text>
                        <Text level="l7" color="var(--color-neutral-500)">
                          {doc.library === 'private' ? '私有库' : '携君库'} / {doc.category} · {formatTime(doc.updatedAt)}
                        </Text>
                      </div>
                      {doc.library === 'public' && <span className="kb-lock-icon" title="携君库受保护">🔒</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="kb-empty-state">
                  <Text level="l5" color="var(--color-neutral-500)">📭</Text>
                  <Text level="l6" color="var(--color-neutral-500)">暂无文档，开始上传吧</Text>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}

/** 默认分类（HR八大模块） */
function getDefaultCategories(): Category[] {
  const modules = [
    '战略解码', '人资规划', '招聘配置', '培训开发',
    '薪酬福利', '绩效管理', '员工关系', '企业文化',
  ];
  return modules.map((name, i) => ({ id: `cat-${i}`, name, count: 0 }));
}

/** 格式化相对时间 */
function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHrs < 1) return '刚刚';
    if (diffHrs < 24) return `${diffHrs}小时前`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString('zh-CN');
  } catch {
    return dateStr;
  }
}
