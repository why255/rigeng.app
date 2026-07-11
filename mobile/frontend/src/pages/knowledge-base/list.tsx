/**
 * M12-P2 私有知识库列表页 — 移动端
 * Route: /m/knowledge-base/list
 * 对齐 m12-p2-mobile.html 设计：搜索、排序、分类筛选、来源筛选、
 *   文档列表、底部滑入预览面板
 *
 * 使用 kb-* BEM 类名 + 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。无 emoji 字符。
 */
import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useToast } from '@/shared/components/primitives/toast';
import * as knowledgeApi from '@/shared/api/knowledge';
import type { DocumentItem } from '@/shared/api/knowledge';
import './knowledge-base.css';

const CATEGORIES = [
  '全部', '战略规划', '招聘配置', '培训开发',
  '薪酬绩效', '员工关系', '组织建设', '企业文化',
];

type SortMode = 'newest' | 'oldest' | 'name' | 'source';
type SourceFilter = 'all' | 'private' | 'public';

export function KnowledgeBaseList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();

  // ── 状态 ──
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentCat, setCurrentCat] = useState('全部');
  const [currentSort, setCurrentSort] = useState<SortMode>('newest');
  const [currentSource, setCurrentSource] = useState<SourceFilter>('all');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);

  // ── 加载 ──
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await knowledgeApi.fetchRecentDocs(100, 'latest').catch(() => []);
        if (!cancelled) setDocs(data);
      } catch {
        if (!cancelled) setDocs([]);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };

    // 从 URL 参数恢复搜索词
    const q = searchParams.get('q') || '';
    if (q) setSearchQuery(q);
  }, [searchParams]);

  // ── 过滤 + 排序 ──
  const filteredDocs = useMemo(() => {
    let result = [...docs];

    if (currentCat !== '全部') {
      result = result.filter((d) => d.category === currentCat);
    }
    if (currentSource === 'private') {
      result = result.filter((d) => d.library === 'private');
    } else if (currentSource === 'public') {
      result = result.filter((d) => d.library === 'public');
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (d) => d.title.toLowerCase().includes(q) || (d.category || '').includes(q)
      );
    }

    switch (currentSort) {
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
        break;
      case 'name':
        result.sort((a, b) => a.title.localeCompare(b.title, 'zh'));
        break;
      case 'source':
        result.sort((a, b) => (a.library || '').localeCompare(b.library || '', 'zh'));
        break;
    }

    return result;
  }, [docs, currentCat, currentSource, currentSort, searchQuery]);

  const isPublicDoc = (doc: DocumentItem) => doc.library === 'public';

  // ── 删除 ──
  const deleteDoc = (doc: DocumentItem) => {
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    toast('已移出私有库', 'warning');
  };

  return (
    <div className="kb-main-padding">
      {/* ── Stats 横幅 ── */}
      <div className="kb-stats-bar">
        <div className="kb-stats-bar__header">
          <div className="kb-stats-bar__title">
            <Icon icon="mingcute:folder-lock-line" className="kb-stats-bar__title-icon" />
            <div>
              <div className="kb-stats-bar__title-text">私有知识库</div>
              <div className="kb-stats-bar__title-sub">个人知识资产 · 可编辑/导出/删除</div>
            </div>
          </div>
          <Link to="/m/knowledge-base/audit" className="kb-stats-bar__link">
            <Icon icon="mingcute:time-line" />
            待审核
          </Link>
        </div>
        <div className="kb-stats-bar__metrics">
          <div className="kb-stats-bar__metric">
            <div className="kb-stats-bar__metric-value">{filteredDocs.length}</div>
            <div className="kb-stats-bar__metric-label">文档总数</div>
          </div>
          <div className="kb-stats-bar__divider" />
          <div className="kb-stats-bar__metric">
            <div className="kb-stats-bar__metric-value">--</div>
            <div className="kb-stats-bar__metric-label">/ 200MB</div>
          </div>
        </div>
      </div>

      {/* ── 搜索 + 排序 ── */}
      <div className="kb-sort-bar">
        <div style={{ position: 'relative', flex: 1 }}>
          <Icon icon="mingcute:search-line" className="kb-search-icon" />
          <input
            className="kb-search-input"
            type="text"
            placeholder="搜索私有知识库..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          className="kb-sort-icon-btn"
          onClick={() => setSortMenuOpen(!sortMenuOpen)}
        >
          <Icon icon="mingcute:sort-line" />
        </button>
      </div>

      {/* 排序菜单 */}
      {sortMenuOpen && (
        <div className="kb-sort-bar" style={{ flexWrap: 'wrap' }}>
          {(['newest', 'oldest', 'name', 'source'] as SortMode[]).map((mode) => (
            <button
              key={mode}
              className={`kb-sort-btn${currentSort === mode ? ' kb-sort-btn--active' : ''}`}
              onClick={() => { setCurrentSort(mode); setSortMenuOpen(false); }}
            >
              {mode === 'newest' ? '最新优先' : mode === 'oldest' ? '最早优先' : mode === 'name' ? '按名称' : '按来源'}
            </button>
          ))}
        </div>
      )}

      {/* ── 分类 Tab ── */}
      <div className="kb-category-tabs">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`kb-category-tab${cat === currentCat ? ' kb-category-tab--active' : ''}`}
            onClick={() => setCurrentCat(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── 来源筛选 ── */}
      <div className="kb-source-filter">
        <span className="kb-source-filter__count">
          共 <span style={{ fontWeight: 700 }}>{filteredDocs.length}</span> 条
        </span>
        <div className="kb-source-filter__btns">
          {(['all', 'private', 'public'] as SourceFilter[]).map((src) => (
            <button
              key={src}
              className={`kb-source-filter__btn${currentSource === src ? ' kb-source-filter__btn--active' : ''}`}
              onClick={() => setCurrentSource(src)}
            >
              {src === 'all' ? '全部' : src === 'private' ? '自建' : '收藏·携君'}
            </button>
          ))}
        </div>
      </div>

      {/* ── 加载状态 ── */}
      {loading && (
        <div className="kb-loading">
          <div className="kb-skeleton" />
          <div className="kb-skeleton" />
          <p className="kb-loading__text">正在加载...</p>
        </div>
      )}

      {/* ── 文档列表 ── */}
      {!loading && filteredDocs.length > 0 && (
        <div className="kb-doc-list">
          {filteredDocs.map((doc, i) => {
            const isPub = isPublicDoc(doc);
            return (
              <div
                key={doc.id}
                className="kb-doc-item"
                style={{ animationDelay: `${i * 35}ms` }}
                onClick={() => setPreviewDoc(doc)}
              >
                <div className="kb-doc-item__header">
                  <span className={`kb-doc-item__cat${isPub ? ' kb-doc-item__cat--public' : ''}`}>
                    {doc.category || '未分类'}
                  </span>
                  {isPub && (
                    <Icon icon="mingcute:copyright-line" style={{ color: '#E8A94D', fontSize: '10px', marginLeft: '4px' }} />
                  )}
                  <div style={{ flex: 1 }} />
                  <button
                    className="kb-doc-item__star"
                    onClick={(e) => { e.stopPropagation(); deleteDoc(doc); }}
                    style={{ color: '#BCAAA4' }}
                  >
                    <Icon icon="mingcute:delete-2-line" style={{ fontSize: '14px' }} />
                  </button>
                </div>
                <h4 className="kb-doc-item__title">{doc.title}</h4>
                <div className="kb-doc-item__footer">
                  {isPub ? (
                    <span className="kb-public-doc-item__tag">
                      <Icon icon="mingcute:copyright-line" />
                      携君
                    </span>
                  ) : (
                    <span>来源: {doc.library || '手动上传'}</span>
                  )}
                  {!isPub && <span>{doc.fileSize ? String(doc.fileSize) : '--'}</span>}
                  <span style={{ marginLeft: 'auto' }}>{doc.createdAt?.slice(0, 10) || ''}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 空状态 ── */}
      {!loading && filteredDocs.length === 0 && (
        <div className="kb-empty">
          <Icon icon="mingcute:folder-lock-line" className="kb-empty__icon" />
          <p className="kb-empty__title">私有库还没有内容</p>
          <p className="kb-empty__sub">在「最近沉淀」或「携君知识库」中收藏后，这里就会出现</p>
        </div>
      )}

      {/* ── 预览弹窗 ── */}
      <div className={`kb-preview-overlay${previewDoc ? ' kb-preview-overlay--open' : ''}`}>
        {previewDoc && (
          <>
            <div className="kb-preview-header">
              <button className="kb-preview-close" onClick={() => setPreviewDoc(null)}>
                <Icon icon="mingcute:close-line" style={{ fontSize: '20px' }} />
                <span>关闭</span>
              </button>
              <h3 className="kb-preview-title">{previewDoc.title}</h3>
              <Icon
                icon="mingcute:share-forward-line"
                className="kb-preview-share"
                onClick={() => navigate(`/m/knowledge-base/export/${previewDoc.id}`)}
              />
            </div>
            <div className="kb-preview-body">
              <h1 style={{ fontSize: '18px', fontWeight: 900, color: '#333', marginBottom: '16px' }}>
                {previewDoc.title}
              </h1>
              <p style={{ fontSize: '14px', color: '#666', lineHeight: 1.8 }}>
                私有库文档正文...
              </p>
            </div>
            <div className="kb-preview-footer">
              <button
                className="kb-preview-footer__btn kb-preview-footer__btn--primary"
                onClick={() => navigate(`/m/knowledge-base/export/${previewDoc.id}`)}
              >
                在线编辑
              </button>
              <button
                className="kb-preview-footer__btn kb-preview-footer__btn--secondary"
                onClick={() => navigate(`/m/knowledge-base/export/${previewDoc.id}`)}
              >
                导出/分享
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
