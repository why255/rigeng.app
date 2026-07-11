/**
 * M12-P1 公私智库入口页 — 移动端
 * Route: /m/knowledge-base (index)
 * 对齐 m12-p1-mobile.html 设计：搜索+语音、双库概览、分类目录、最近文档
 *
 * 使用 kb-* BEM 类名 + 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。无 emoji 字符。
 */
import { useEffect, useState, useCallback, useRef, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useToast } from '@/shared/components/primitives/toast';
import * as knowledgeApi from '@/shared/api/knowledge';
import type { DocStats, DocumentItem, Category } from '@/shared/api/knowledge';
import './knowledge-base.css';

/** 分类标签（HR八大模块） */
const CATEGORIES = [
  '全部', '战略规划', '招聘配置', '培训开发',
  '薪酬绩效', '员工关系', '组织建设', '企业文化',
];

/** 热门搜索词 */
const HOT_SEARCHES = [
  '绩效考核模板', '离职补偿方案', 'HRBP胜任力', '薪酬体系设计',
];

export function KnowledgeBaseHome() {
  const navigate = useNavigate();
  const toast = useToast();

  // ── 数据状态 ──
  const [stats, setStats] = useState<DocStats | null>(null);
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // ── UI 状态 ──
  const [searchQuery, setSearchQuery] = useState('');
  const [currentCat, setCurrentCat] = useState('全部');
  const [currentView, setCurrentView] = useState<'card' | 'list'>('card');
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const voiceTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // ── 加载数据 ──
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [s, recentDocs] = await Promise.all([
          knowledgeApi.fetchDocStats().catch(() => null),
          knowledgeApi.fetchRecentDocs(20, 'latest').catch(() => []),
        ]);
        if (!cancelled) {
          setStats(s || {
            totalDocs: 0, privateCount: 0, publicCount: 0,
            storageUsed: 0, storageLimit: 200, todayNew: 0,
          });
          setDocs(recentDocs);
        }
      } catch {
        if (!cancelled) {
          setStats({ totalDocs: 0, privateCount: 0, publicCount: 0, storageUsed: 0, storageLimit: 200, todayNew: 0 });
          setDocs([]);
        }
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // ── 收藏状态（本地跟踪） ──
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());

  // ── 搜索 ──
  const filteredDocs = docs.filter((d) => {
    const matchCat = currentCat === '全部' || d.category === currentCat;
    const q = searchQuery.trim().toLowerCase();
    const matchSearch = !q || d.title.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    // 搜索已通过 filteredDocs 实时过滤
  };

  // ── 语音搜索 ──
  const toggleVoiceSearch = () => {
    if (isVoiceActive) {
      stopVoiceSearch();
    } else {
      setIsVoiceActive(true);
      toast('正在语音识别中，请说话...', 'neutral');
      voiceTimerRef.current = setTimeout(() => stopVoiceSearch(), 3000);
    }
  };

  const stopVoiceSearch = useCallback(() => {
    setIsVoiceActive(false);
    if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current);
  }, []);

  // ── 收藏切换 ──
  const toggleStar = (docId: string) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
        toast('已取消收藏', 'warning');
      } else {
        next.add(docId);
        toast('已收藏至私有知识库', 'success');
      }
      return next;
    });
  };

  // ── 计算统计数据 ──
  const auditCount = 0; // TODO: 接入待审核 API
  const privateCount = stats?.privateCount ?? 0;
  const publicCount = stats?.publicCount ?? 0;
  const storagePercent = stats ? Math.min((stats.storageUsed / stats.storageLimit) * 100, 100) : 0;

  return (
    <div className="kb-main-padding">
      {/* ── 搜索栏 ── */}
      <div className="kb-search-wrap">
        <form className="kb-search-bar" onSubmit={handleSearchSubmit}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Icon icon="mingcute:search-line" className="kb-search-icon" />
            <input
              className="kb-search-input"
              type="text"
              placeholder="搜索你的知识库..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="kb-search-clear"
                onClick={() => setSearchQuery('')}
              >
                <Icon icon="mingcute:close-circle-line" />
              </button>
            )}
          </div>
          <button
            type="button"
            className={`kb-search-voice-btn${isVoiceActive ? ' kb-search-voice-btn--active' : ''}`}
            onClick={toggleVoiceSearch}
            title="语音搜索"
          >
            <Icon icon={isVoiceActive ? 'mingcute:mic-fill' : 'mingcute:mic-line'} />
          </button>
        </form>

        {/* 语音指示器 */}
        {isVoiceActive && (
          <div className="kb-voice-indicator">
            <div className="kb-voice-waves">
              <div className="kb-voice-wave" />
              <div className="kb-voice-wave" />
              <div className="kb-voice-wave" />
              <div className="kb-voice-wave" />
              <div className="kb-voice-wave" />
            </div>
            <span className="kb-voice-indicator__text">正在聆听...</span>
            <span className="kb-voice-indicator__hint">说出你想找的内容</span>
          </div>
        )}
      </div>

      {/* ── 品牌标语 ── */}
      <div className="kb-hero">
        <p className="kb-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</p>
        <h2 className="kb-hero__title">随手存结晶，终成你底气</h2>
      </div>

      {/* ── 双库卡片 + 待审核入口 ── */}
      <div className="kb-lib-grid">
        {/* 私有库卡片 */}
        <div
          className="kb-lib-card"
          onClick={() => navigate('/m/knowledge-base/list?library=private')}
        >
          <div className="kb-lib-card__header">
            <div className="kb-lib-card__icon kb-lib-card__icon--private">
              <Icon icon="mingcute:folder-lock-line" />
            </div>
            <span className="kb-lib-card__label">私有库</span>
          </div>
          <div className="kb-lib-card__count">
            {loading ? (
              <span style={{ fontSize: '16px', color: '#999' }}>加载中...</span>
            ) : (
              <>{privateCount} <span style={{ fontSize: '10px', fontWeight: 400, color: '#999' }}>条</span></>
            )}
          </div>
          <div className="kb-lib-card__bar">
            <div
              className="kb-lib-card__bar-fill kb-lib-card__bar-fill--private"
              style={{ width: `${storagePercent}%` }}
            />
          </div>
          <p className="kb-lib-card__storage">
            {stats ? `${stats.storageUsed}GB / ${stats.storageLimit}GB` : '-- / --'}
          </p>
          <div className="kb-lib-card__footer">
            <button className="kb-btn-sm kb-btn-sm--primary" style={{ width: '100%' }}>
              进入私有库
            </button>
          </div>
        </div>

        {/* 携君库卡片 */}
        <div
          className="kb-lib-card"
          onClick={() => navigate('/m/knowledge-base/public')}
        >
          <div className="kb-lib-card__header">
            <div className="kb-lib-card__icon kb-lib-card__icon--public">
              <Icon icon="mingcute:book-6-line" />
            </div>
            <span className="kb-lib-card__label">携君库</span>
          </div>
          <div className="kb-lib-card__count">
            {loading ? (
              <span style={{ fontSize: '16px', color: '#999' }}>加载中...</span>
            ) : (
              <>{publicCount} <span style={{ fontSize: '10px', fontWeight: 400, color: '#999' }}>条</span></>
            )}
          </div>
          <div className="kb-lib-card__footer" style={{ marginTop: '8px' }}>
            <Icon icon="mingcute:book-6-line" style={{ color: '#E8A94D', fontSize: '12px' }} />
            <span className="kb-lib-card__tag">安权老师·20年沉淀</span>
          </div>
          <div className="kb-lib-card__footer" style={{ marginTop: '12px' }}>
            <button
              className="kb-btn-sm kb-btn-sm--secondary"
              style={{ width: '100%', color: '#8B6914', borderColor: '#E8A94D' }}
            >
              探索携君库
            </button>
          </div>
        </div>
      </div>

      {/* 待审核入口 */}
      <Link to="/m/knowledge-base/audit" className="kb-audit-entry">
        <div className="kb-audit-entry__left">
          <span className="kb-audit-entry__icon">
            <Icon icon="mingcute:time-line" />
            {auditCount > 0 && <span className="kb-audit-entry__dot" />}
          </span>
          <span className="kb-audit-entry__text">待审核区</span>
          {auditCount > 0 && (
            <span className="kb-audit-entry__badge">{auditCount}条待办</span>
          )}
        </div>
        <div className="kb-audit-entry__right">
          <span className={`kb-audit-entry__status${auditCount > 0 ? ' kb-audit-entry__status--urgent' : ''}`}>
            {auditCount > 0 ? '点击处理' : '暂无待办'}
          </span>
          <Icon icon="mingcute:right-line" style={{ color: '#999', fontSize: '16px' }} />
        </div>
      </Link>

      {/* ── 热门搜索 ── */}
      {!searchQuery && (
        <div className="kb-hot-searches">
          {HOT_SEARCHES.map((term) => (
            <button
              key={term}
              className="kb-hot-tag"
              onClick={() => setSearchQuery(term)}
            >
              {term}
            </button>
          ))}
        </div>
      )}

      {/* ── 视图切换 + 标题 ── */}
      <div className="kb-view-toggle">
        <h3 className="kb-view-toggle__title">
          {searchQuery ? `搜索结果 (${filteredDocs.length})` : currentCat === '全部' ? '最近沉淀' : currentCat}
        </h3>
        <div className="kb-view-toggle__btns">
          <button
            className={`kb-view-toggle__btn${currentView === 'card' ? ' kb-view-toggle__btn--active' : ''}`}
            onClick={() => setCurrentView('card')}
          >
            卡片
          </button>
          <button
            className={`kb-view-toggle__btn${currentView === 'list' ? ' kb-view-toggle__btn--active' : ''}`}
            onClick={() => setCurrentView('list')}
          >
            列表
          </button>
        </div>
      </div>

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

      {/* ── 加载状态 ── */}
      {loading && (
        <div className="kb-loading">
          <div className="kb-skeleton" />
          <div className="kb-skeleton" />
          <div className="kb-skeleton" />
          <p className="kb-loading__text">正在加载数据...</p>
        </div>
      )}

      {/* ── 文档列表 ── */}
      {!loading && filteredDocs.length > 0 && (
        <div className="kb-doc-list">
          {filteredDocs.map((doc, i) => (
            currentView === 'card' ? (
              <div
                key={doc.id}
                className="kb-doc-item"
                style={{ animationDelay: `${i * 50}ms` }}
                onClick={() => navigate(`/m/knowledge-base/list?doc=${doc.id}`)}
              >
                <div className="kb-doc-item__header">
                  <span className="kb-doc-item__cat">{doc.category || '未分类'}</span>
                  <div className="kb-doc-item__meta-right">
                    <button
                      className={`kb-doc-item__star${starredIds.has(doc.id) ? ' kb-doc-item__star--active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); toggleStar(doc.id); }}
                    >
                      <Icon icon={starredIds.has(doc.id) ? 'mingcute:star-fill' : 'mingcute:star-line'} />
                    </button>
                    <span className="kb-doc-item__date">{doc.createdAt?.slice(0, 10) || ''}</span>
                  </div>
                </div>
                <h4 className="kb-doc-item__title">{doc.title}</h4>
                <div className="kb-doc-item__footer">
                  <span>
                    <Icon icon="mingcute:box-3-line" className="kb-doc-item__footer-icon" />
                    {' '}来源: {doc.library || '手动上传'}
                  </span>
                  <span>{doc.fileSize ? String(doc.fileSize) : '--'}</span>
                </div>
              </div>
            ) : (
              <div
                key={doc.id}
                className="kb-doc-item kb-doc-item--list"
                style={{ animationDelay: `${i * 40}ms` }}
                onClick={() => navigate(`/m/knowledge-base/list?doc=${doc.id}`)}
              >
                <div className="kb-doc-item__thumb">
                  <Icon icon="mingcute:file-config-line" />
                </div>
                <div className="kb-doc-item__body">
                  <h4 className="kb-doc-item__body-title">{doc.title}</h4>
                  <div className="kb-doc-item__body-meta">
                    <span>{doc.category || '未分类'}</span>
                    <span>{doc.library || ''}</span>
                    <span>{doc.createdAt?.slice(0, 10) || ''}</span>
                  </div>
                </div>
                <button
                  className={`kb-doc-item__star${starredIds.has(doc.id) ? ' kb-doc-item__star--active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); toggleStar(doc.id); }}
                >
                  <Icon icon={starredIds.has(doc.id) ? 'mingcute:star-fill' : 'mingcute:star-line'} />
                </button>
              </div>
            )
          ))}
        </div>
      )}

      {/* ── 空状态 ── */}
      {!loading && filteredDocs.length === 0 && (
        <div className="kb-empty">
          <Icon icon="mingcute:file-search-line" className="kb-empty__icon" />
          <p className="kb-empty__title">还没有沉淀内容</p>
          <p className="kb-empty__sub">在各板块完成操作后，产出物会自动归档到这里</p>
          <Link
            to="/m/knowledge-base/audit"
            className="kb-btn-primary"
            style={{ marginBottom: '8px' }}
          >
            前往待审核区
          </Link>
        </div>
      )}

      {/* ── 数据分析入口 ── */}
      <Link to="/m/data-analytics" className="kb-analytics-entry">
        <div className="kb-analytics-entry__left">
          <div className="kb-analytics-entry__icon">
            <Icon icon="mingcute:chart-bar-line" />
          </div>
          <div>
            <p className="kb-analytics-entry__title">数据分析</p>
            <p className="kb-analytics-entry__desc">数据照一照，看到好自己</p>
          </div>
        </div>
        <Icon icon="mingcute:right-line" style={{ color: '#999', fontSize: '16px' }} />
      </Link>

      {/* ── 快捷按钮 ── */}
      <div className="kb-shortcut-section">
        <button className="kb-shortcut-btn" onClick={() => navigate('/m/knowledge-base/list')}>
          <Icon icon="mingcute:edit-line" className="kb-shortcut-btn__icon kb-shortcut-btn__icon--primary" />
          <span className="kb-shortcut-btn__label">新建笔记</span>
        </button>
        <button className="kb-shortcut-btn" onClick={() => navigate('/m/knowledge-base/list')}>
          <Icon icon="mingcute:upload-line" className="kb-shortcut-btn__icon kb-shortcut-btn__icon--blue" />
          <span className="kb-shortcut-btn__label">上传文档</span>
        </button>
      </div>
    </div>
  );
}
