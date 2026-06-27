/**
 * M12-P1 公私智库入口页
 * 对齐 m12-p1.html 设计：面包屑、品牌标语、三卡片概览、搜索、分类树、最近文档、快捷操作
 */
import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageContainer } from '@/components/layout/AppShell';
import { Card, Text, Button, ProgressBar } from '@/components/primitives';
import { useToast } from '@/components/primitives/toast';
import * as knowledgeApi from '@/api/knowledge';
import type { DocStats, DocumentItem, Category, SearchResult } from '@/api/knowledge';
import '../pages.css';
import './knowledge.css';

export function KnowledgeHub() {
  const navigate = useNavigate();
  const toast = useToast();
  const [stats, setStats] = useState<DocStats | null>(null);
  const [recentDocs, setRecentDocs] = useState<DocumentItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [hotSearches, setHotSearches] = useState<string[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [s, docs, cats, hot, pendingResult] = await Promise.all([
          knowledgeApi.fetchDocStats().catch(() => null),
          knowledgeApi.fetchRecentDocs(5, 'latest').catch(() => []),
          knowledgeApi.fetchCategories().catch(() => []),
          knowledgeApi.fetchHotSearches().catch(() => []),
          knowledgeApi.fetchPendingDocs().catch(() => []),
        ]);
        if (!cancelled) {
          setStats(s);
          setRecentDocs(docs);
          setCategories(cats.length > 0 ? cats : getDefaultCategories());
          setHotSearches(hot);
          if (pendingResult) {
            setPendingCount(pendingResult.length);
            // 超期：超过30天
            const now = Date.now();
            const thirtyDays = 30 * 24 * 60 * 60 * 1000;
            setOverdueCount(pendingResult.filter((d) => now - new Date(d.submittedAt).getTime() > thirtyDays).length);
          }
        }
      } catch {
        if (!cancelled) {
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
          setHotSearches(['薪酬激励方案', 'SaaS市场调研', 'OKR执行手册']);
          setPendingCount(5);
          setOverdueCount(2);
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

  const privatePct = stats ? Math.round((stats.storageUsed / (stats.storageLimit || 1)) * 100) : 6;

  return (
    <PageContainer width="dashboard">
      <div data-module="knowledge-base">
        {/* ── 面包屑 ── */}
        <nav className="kb-breadcrumb">
          <Link to="/">我的智库</Link>
          <span className="kb-breadcrumb__sep">›</span>
          <span className="kb-breadcrumb__current">公私智库</span>
        </nav>

        {/* ── 品牌标语 ── */}
        <section className="kb-hero">
          <Text level="l6" as="div" color="var(--color-neutral-600)" style={{ marginBottom: 4 }}>
            日耕朝夕，耕愈工作，耕暖生活
          </Text>
          <Text level="l0" as="h2" color="var(--color-brand-primary)">
            随手存结晶，终成你底气
          </Text>
        </section>

        {/* ── 三卡片概览 ── */}
        <section className="kb-overview-grid">
          {/* 私有库 */}
          <Card clickable onClick={() => navigate('/m/knowledge-base/list?library=private')}>
            <div className="kb-overview-card">
              <div className="kb-overview-card__header">
                <div className="kb-overview-card__icon kb-overview-card__icon--private">
                  📂
                </div>
                <Text level="l3" as="div">私有库</Text>
              </div>
              <div className="kb-overview-card__count">
                <span className="kb-count-num">{loading ? '—' : stats?.privateCount ?? 0}</span>
                <span className="kb-count-unit">条文档</span>
              </div>
              <div className="kb-overview-card__storage">
                <div className="pg-row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text level="l7" color="var(--color-neutral-400)">
                    {stats ? `${(stats.storageUsed * 1024).toFixed(0)}MB / ${(stats.storageLimit * 1024).toFixed(0)}MB` : ''}
                  </Text>
                  <Text level="l7" color="var(--color-neutral-400)">{privatePct}%</Text>
                </div>
                <ProgressBar value={privatePct} />
              </div>
            </div>
          </Card>

          {/* 携君库 */}
          <Card
            barColor="#D4A574"
            clickable
            onClick={() => navigate('/m/knowledge-base/list?library=public')}
          >
            <div className="kb-overview-card">
              <div className="kb-overview-card__header">
                <div className="kb-overview-card__icon kb-overview-card__icon--public">
                  🏛️
                </div>
                <Text level="l3" as="div">携君库</Text>
              </div>
              <div className="kb-overview-card__count">
                <span className="kb-count-num">{loading ? '—' : stats?.publicCount ?? 0}</span>
                <span className="kb-count-unit">条资源</span>
              </div>
              <div className="kb-overview-card__meta">
                <span className="kb-overview-card__check">✓</span>
                <Text level="l7" color="var(--color-neutral-500)">
                  {stats ? `今日新增 ${stats.todayNew} 篇` : '覆盖 HR 八大模块'}
                </Text>
              </div>
            </div>
          </Card>

          {/* 待审核 */}
          <Card
            clickable
            onClick={() => navigate('/m/knowledge-base/audit')}
            style={{ ['--card-accent' as string]: '#C03A39' }}
          >
            <div className="kb-overview-card kb-overview-card--audit">
              <div className="kb-overview-card__header">
                <div className="kb-overview-card__icon kb-overview-card__icon--audit">
                  ⏳
                </div>
                <Text level="l3" as="div">待审核</Text>
                {pendingCount > 0 && (
                  <span className="kb-audit-badge">{pendingCount}</span>
                )}
              </div>
              <div className="kb-overview-card__count">
                <span className="kb-count-num">{pendingCount}</span>
                <span className="kb-count-unit">条内容</span>
              </div>
              {overdueCount > 0 && (
                <div className="kb-overdue-hint">
                  <span>⚠</span>
                  <Text level="l7" color="#C03A39">{overdueCount}条已超期未审</Text>
                </div>
              )}
              {pendingCount === 0 && !loading && (
                <Text level="l7" color="var(--color-neutral-400)">全部已审核 ✓</Text>
              )}
            </div>
          </Card>
        </section>

        {/* ── 搜索区 ── */}
        <section className="pg-section">
          <form onSubmit={handleSearch} className="kb-search-form">
            <div className="kb-search-bar">
              <span className="kb-search-icon">🔍</span>
              <input
                className="kb-search-input"
                type="text"
                placeholder="搜索你的知识库…"
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

          {/* 热门/最近搜索 */}
          {hotSearches.length > 0 && !searchResults && (
            <div className="kb-hot-searches">
              <Text level="l7" color="var(--color-neutral-400)">最近搜索：</Text>
              {hotSearches.map((tag) => (
                <button
                  key={tag}
                  className="kb-hot-tag"
                  onClick={() => { setSearchQuery(tag); }}
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
                  <span className="kb-file-icon">{getFileIcon(doc.fileType)}</span>
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

        {/* ── 分类目录 + 最近文档 ── */}
        <section className="pg-section">
          <div className="kb-split-layout">
            {/* 左侧分类树 */}
            <div className="kb-categories-panel">
              <div className="kb-cat-header">
                <Text level="l5" as="div">📁 全部分类</Text>
              </div>
              <div className="kb-category-list">
                {categories.map((cat) => (
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
              <div className="kb-cat-footer">
                <span className="kb-cat-footer__hint">自定义文件夹</span>
                <span className="kb-cat-footer__badge">即将上线</span>
              </div>
            </div>

            {/* 右侧最近文档 */}
            <div className="kb-recent-panel">
              <div className="pg-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
                <Text level="l5" as="div">最近更新</Text>
                <Link to="/m/knowledge-base/list" className="kb-view-all">
                  查看全部 ›
                </Link>
              </div>

              {loading ? (
                <div className="kb-loading">
                  <div className="kb-loading-spinner" />
                </div>
              ) : recentDocs.length > 0 ? (
                <div className="kb-doc-list">
                  {recentDocs.map((doc) => (
                    <Link
                      key={doc.id}
                      to={`/m/knowledge-base/list?doc=${doc.id}`}
                      className="kb-doc-item"
                    >
                      <div className={`kb-doc-icon kb-doc-icon--${doc.library === 'public' ? 'public' : 'private'}`}>
                        {getFileIcon(doc.fileType)}
                      </div>
                      <div className="kb-doc-item__info">
                        <Text level="l5" as="div" className="kb-doc-item__title">{doc.title}</Text>
                        <div className="kb-doc-item__meta">
                          <span className="kb-doc-item__tag">{doc.category}</span>
                          <span className="kb-doc-item__source">来自: 智能办公</span>
                          <span className="kb-doc-item__time">{formatTime(doc.updatedAt)}</span>
                        </div>
                      </div>
                      {doc.library === 'public' && <span className="kb-lock-icon" title="携君库受保护">🔒</span>}
                      <span className="kb-doc-arrow">›</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="kb-empty-state">
                  <Text level="l5" color="var(--color-neutral-400)">📭</Text>
                  <Text level="l6" color="var(--color-neutral-500)">暂无文档，开始上传吧</Text>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── 底部快捷操作 ── */}
        <section className="pg-section">
          <div className="kb-quick-actions">
            <Link to="/m/evening-review" className="kb-quick-action kb-quick-action--primary">
              <span className="kb-quick-action__icon">🔄</span>
              <span className="kb-quick-action__text">去做暮有复盘</span>
              <span className="kb-quick-action__arrow">›</span>
            </Link>
            <Link to="/m/smart-office" className="kb-quick-action kb-quick-action--secondary">
              <span className="kb-quick-action__icon">💼</span>
              <span className="kb-quick-action__text">生成智能办公文档</span>
              <span className="kb-quick-action__arrow">›</span>
            </Link>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}

/** 默认分类（HR八大模块，步骤12规范） */
function getDefaultCategories(): Category[] {
  const modules = [
    '战略解码', '人资规划', '招聘配置', '培训开发',
    '薪酬福利', '绩效管理', '员工关系', '企业文化',
  ];
  return modules.map((name, i) => ({ id: `cat-${i}`, name, count: 0 }));
}

/** 文件类型图标 */
function getFileIcon(fileType: string): string {
  switch (fileType) {
    case 'pdf': return '📄';
    case 'docx': return '📝';
    case 'xlsx': return '📊';
    case 'pptx': return '📽';
    default: return '📋';
  }
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
