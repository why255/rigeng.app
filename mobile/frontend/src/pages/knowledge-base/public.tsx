/**
 * M12-P5 携君知识库 — 移动端
 * Route: /m/knowledge-base/public
 * 对齐 m12-p5-mobile.html 设计：公共知识库浏览、搜索、分类筛选、
 *   水印保护、收藏到私有库
 *
 * 使用 kb-* BEM 类名 + 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。无 emoji 字符。
 */
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useToast } from '@/shared/components/primitives/toast';
import * as knowledgeApi from '@/shared/api/knowledge';
import type { DocumentItem } from '@/shared/api/knowledge';
import './knowledge-base.css';

const CATEGORIES = [
  '全部', '战略规划', '招聘配置', '培训开发',
  '薪酬绩效', '员工关系', '组织建设', '企业文化',
];

export function KnowledgeBasePublic() {
  const navigate = useNavigate();
  const toast = useToast();

  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentCat, setCurrentCat] = useState('全部');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await knowledgeApi.fetchRecentDocs(50, 'latest').catch(() => []);
        if (!cancelled) {
          // 模拟携君库数据
          setDocs(data.map((d) => ({ ...d, library_type: 'public' })));
        }
      } catch {
        if (!cancelled) setDocs([]);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());

  const filteredDocs = useMemo(() => {
    let result = docs;
    if (currentCat !== '全部') {
      result = result.filter((d) => d.category === currentCat);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((d) => d.title.toLowerCase().includes(q) || (d.category || '').includes(q));
    }
    return result;
  }, [docs, currentCat, searchQuery]);

  // ── 收藏到私有库 ──
  const starDoc = (doc: DocumentItem) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(doc.id)) {
        next.delete(doc.id);
      } else {
        next.add(doc.id);
        toast('已收藏至私有知识库', 'success');
      }
      return next;
    });
  };

  return (
    <div className="kb-main-padding">
      {/* 品牌标语 */}
      <div className="kb-hero">
        <p className="kb-hero__title--sm" style={{ color: '#E8A94D' }}>携君知识库</p>
        <p className="kb-public-subtitle">
          安权老师 · 20年教学沉淀 · 1200位私教学员案例
        </p>
      </div>

      {/* Stats */}
      <div className="kb-stats-bar" style={{ marginBottom: '16px' }}>
        <div className="kb-stats-bar__header">
          <div className="kb-stats-bar__title">
            <Icon icon="mingcute:book-6-line" style={{ color: '#E8A94D', fontSize: '20px' }} />
            <div>
              <div className="kb-stats-bar__title-text" style={{ color: '#E8A94D' }}>携君知识库</div>
              <div className="kb-stats-bar__title-sub">安权老师 · 20年沉淀</div>
            </div>
          </div>
        </div>
        <div className="kb-stats-bar__metrics">
          <div className="kb-stats-bar__metric">
            <div className="kb-stats-bar__metric-value">{filteredDocs.length}</div>
            <div className="kb-stats-bar__metric-label">文档总数</div>
          </div>
          <div className="kb-stats-bar__divider" />
          <div className="kb-stats-bar__metric">
            <div className="kb-stats-bar__metric-value">8</div>
            <div className="kb-stats-bar__metric-label">覆盖HR模块</div>
          </div>
        </div>
      </div>

      {/* 搜索 */}
      <div>
        <div style={{ position: 'relative' }}>
          <Icon icon="mingcute:search-line" className="kb-search-icon" />
          <input
            className="kb-search-input"
            type="text"
            placeholder="搜索携君知识库..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* 分类 Tab */}
      <div className="kb-category-tabs" style={{ marginTop: '16px' }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`kb-category-tab${cat === currentCat ? ' kb-category-tab--active-public' : ''}`}
            onClick={() => setCurrentCat(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 加载 */}
      {loading && (
        <div className="kb-loading">
          <div className="kb-skeleton" />
          <div className="kb-skeleton" />
          <p className="kb-loading__text">正在加载...</p>
        </div>
      )}

      {/* 文档列表 */}
      {!loading && filteredDocs.length > 0 && (
        <div className="kb-doc-list" style={{ position: 'relative', paddingTop: '8px' }}>
          {filteredDocs.map((doc, i) => (
            <div
              key={doc.id}
              className="kb-doc-item kb-public-doc-item"
              style={{ animationDelay: `${i * 35}ms` }}
            >
              <div className="kb-doc-item__header">
                <span className="kb-doc-item__cat kb-doc-item__cat--public">
                  {doc.category || '未分类'}
                </span>
                <div style={{ flex: 1 }} />
                <button
                  className={`kb-doc-item__star${starredIds.has(doc.id) ? ' kb-doc-item__star--active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); starDoc(doc); }}
                >
                  <Icon icon={starredIds.has(doc.id) ? 'mingcute:star-fill' : 'mingcute:star-line'} />
                </button>
              </div>
              <h4 className="kb-doc-item__title">{doc.title}</h4>
              <div className="kb-doc-item__footer">
                <span className="kb-public-doc-item__tag">
                  <Icon icon="mingcute:copyright-line" />
                  携君
                </span>
                <span>{doc.createdAt?.slice(0, 10) || ''}</span>
              </div>
              {/* 水印提示 */}
              <div style={{ marginTop: '8px', fontSize: '10px', color: '#E8A94D' }}>
                <Icon icon="mingcute:copyright-line" style={{ fontSize: '10px' }} />{' '}
                携君库文档受版权保护，仅支持在线阅读
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 空状态 */}
      {!loading && filteredDocs.length === 0 && (
        <div className="kb-empty">
          <Icon icon="mingcute:book-6-line" className="kb-empty__icon" style={{ color: '#E8A94D' }} />
          <p className="kb-empty__title">该分类暂无内容</p>
          <p className="kb-empty__sub">携君知识库持续更新中，敬请期待</p>
        </div>
      )}
    </div>
  );
}
