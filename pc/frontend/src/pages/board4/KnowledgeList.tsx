/**
 * M12-P2 文档列表页
 * 对齐 m12-p2.html：分类目录树、文档列表/表格、右侧预览面板
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageContainer } from '@/components/layout/AppShell';
import { Card, Text, Tag, Button } from '@/shared/components/primitives';
import { useToast } from '@/shared/components/primitives/toast';
import * as knowledgeApi from '@/shared/api/knowledge';
import type { DocumentItem, Category, LibraryType } from '@/shared/api/knowledge';
import '../pages.css';
import './knowledge.css';

export function KnowledgeList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const initialCategory = searchParams.get('category') || '';
  const initialLibrary = (searchParams.get('library') as LibraryType) || undefined;
  const initialDocId = searchParams.get('doc') || '';

  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [activeLibrary, setActiveLibrary] = useState<LibraryType | undefined>(initialLibrary);
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [totalDocs, setTotalDocs] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [searchText, setSearchText] = useState('');

  // 加载分类
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const cats = await knowledgeApi.fetchCategories();
        if (!cancelled) setCategories(cats.length > 0 ? cats : getDefaultCategories());
      } catch {
        if (!cancelled) setCategories(getDefaultCategories());
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // 加载文档列表
  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await knowledgeApi.fetchDocsByCategory(
        activeCategory || undefined,
        activeLibrary,
        page,
        20,
      );
      setDocs(result.items);
      setTotalDocs(result.total);
    } catch {
      toast('加载文档列表失败', 'error');
      setDocs([]);
      setTotalDocs(0);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, activeLibrary, page, toast]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // 加载初始选中文档
  useEffect(() => {
    if (initialDocId) {
      knowledgeApi.fetchDocDetail(initialDocId)
        .then(setSelectedDoc)
        .catch(() => {});
    }
  }, [initialDocId]);

  const handleCategoryClick = (catName: string) => {
    setActiveCategory(catName === activeCategory ? '' : catName);
    setPage(1);
    setSelectedDoc(null);
  };

  const handleLibraryClick = (lib: LibraryType | undefined) => {
    setActiveLibrary(lib === activeLibrary ? undefined : lib);
    setPage(1);
    setSelectedDoc(null);
  };

  const handleDocClick = async (doc: DocumentItem) => {
    setSelectedDoc(doc);
    try {
      const detail = await knowledgeApi.fetchDocDetail(doc.id);
      setSelectedDoc(detail);
    } catch {
      // keep basic info
    }
  };

  const isPublicDoc = selectedDoc?.library === 'public';

  return (
    <PageContainer width="dashboard">
      <div data-module="knowledge-base">
        {/* 品牌标语（小） */}
        <div style={{ textAlign: 'center', padding: 'var(--spacing-md) 0' }}>
          <Text level="l6" as="div" color="var(--color-neutral-500)">
            日耕朝夕，耕愈工作，耕暖生活
          </Text>
        </div>

        {/* 工具栏 */}
        <div className="kb-list-toolbar">
          <div className="kb-search-bar" style={{ maxWidth: 280 }}>
            <span className="kb-search-icon">🔍</span>
            <input
              className="kb-search-input"
              type="text"
              placeholder="搜索文档…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
            <Button
              size="sm"
              variant={activeLibrary === undefined ? 'primary' : 'secondary'}
              onClick={() => handleLibraryClick(undefined)}
            >
              全部
            </Button>
            <Button
              size="sm"
              variant={activeLibrary === 'private' ? 'primary' : 'secondary'}
              onClick={() => handleLibraryClick('private')}
            >
              私有库
            </Button>
            <Button
              size="sm"
              variant={activeLibrary === 'public' ? 'primary' : 'secondary'}
              onClick={() => handleLibraryClick('public')}
            >
              携君库
            </Button>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <Button size="sm" onClick={() => navigate(-1)}>
              ← 返回
            </Button>
          </div>
        </div>

        {/* 三栏布局 */}
        <div className="kb-list-layout">
          {/* 左侧：分类目录 */}
          <div className="kb-categories-panel">
            <Text level="l5" as="div" style={{ marginBottom: 'var(--spacing-sm)' }}>
              📁 分类目录
            </Text>
            <div className="kb-category-list">
              <button
                className={`kb-category-item ${!activeCategory ? 'active' : ''}`}
                onClick={() => handleCategoryClick('')}
              >
                <span className="kb-category-name">全部文档</span>
                <span className="kb-category-count">{totalDocs}</span>
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  className={`kb-category-item ${activeCategory === cat.name ? 'active' : ''}`}
                  onClick={() => handleCategoryClick(cat.name)}
                >
                  <span className="kb-category-icon">📂</span>
                  <span className="kb-category-name">{cat.name}</span>
                  <span className="kb-category-count">{cat.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 中间：文档列表 */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {loading ? (
              <div className="kb-loading">
                <div className="kb-loading-spinner" />
                <Text level="l6" as="div" color="var(--color-neutral-500)" style={{ marginTop: 8 }}>
                  加载中…
                </Text>
              </div>
            ) : docs.length > 0 ? (
              <>
                {/* 表头 */}
                <div className="kb-doc-table-row kb-doc-table-row--header">
                  <div className="kb-doc-table-col--title">文件名</div>
                  <div>所属库</div>
                  <div>分类</div>
                  <div>修改时间</div>
                  <div></div>
                </div>
                {/* 数据行 */}
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="kb-doc-table-row"
                    onClick={() => handleDocClick(doc)}
                    style={selectedDoc?.id === doc.id ? { background: 'var(--module-color-light)' } : undefined}
                  >
                    <div className="kb-doc-table-col--title">
                      <span className="kb-file-icon" style={{ fontSize: 18 }}>
                        {doc.fileType === 'pdf' ? '📄' : doc.fileType === 'docx' ? '📝' : '📋'}
                      </span>
                      <span>{doc.title}</span>
                    </div>
                    <div>
                      <Tag tone={doc.library === 'private' ? 'muted' : 'brand'}>
                        {doc.library === 'private' ? '私有库' : '携君库'}
                        {doc.library === 'public' && ' 🔒'}
                      </Tag>
                    </div>
                    <div>
                      <Text level="l7" color="var(--color-neutral-500)">{doc.category}</Text>
                    </div>
                    <div>
                      <Text level="l7" color="var(--color-neutral-500)">{formatTime(doc.updatedAt)}</Text>
                    </div>
                    <div>
                      <Button
                        variant="text"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleDocClick(doc); }}
                      >
                        ⋯
                      </Button>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="kb-empty-state">
                <Text level="l5" color="var(--color-neutral-500)">📭</Text>
                <Text level="l6" color="var(--color-neutral-500)">
                  {activeCategory ? `"${activeCategory}" 下暂无文档` : '暂无文档'}
                </Text>
              </div>
            )}

            {/* 分页 */}
            {totalDocs > 20 && (
              <div className="pg-row" style={{ justifyContent: 'center', padding: 'var(--spacing-md)' }}>
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  上一页
                </Button>
                <Text level="l6" color="var(--color-neutral-500)">
                  {page} / {Math.ceil(totalDocs / 20)}
                </Text>
                <Button variant="secondary" size="sm" disabled={page >= Math.ceil(totalDocs / 20)} onClick={() => setPage(p => p + 1)}>
                  下一页
                </Button>
              </div>
            )}
          </Card>

          {/* 右侧：预览面板 */}
          <div className="kb-preview-panel">
            {selectedDoc ? (
              <>
                <div className={isPublicDoc ? 'kb-preview-watermark' : ''}>
                  <div className="kb-preview-placeholder">
                    {selectedDoc.fileType === 'pdf' ? '📄' : selectedDoc.fileType === 'docx' ? '📝' : '📋'}
                  </div>
                </div>
                <Text level="l3" as="div" style={{ marginBottom: 'var(--spacing-sm)' }}>
                  {selectedDoc.title}
                </Text>

                <div className="kb-preview-meta">
                  <div className="kb-preview-meta-row">
                    <Text level="l7" color="var(--color-neutral-500)">文件大小</Text>
                    <Text level="l7">{formatFileSize(selectedDoc.fileSize)}</Text>
                  </div>
                  <div className="kb-preview-meta-row">
                    <Text level="l7" color="var(--color-neutral-500)">创建者</Text>
                    <Text level="l7">{selectedDoc.creator || '苏东坡'}</Text>
                  </div>
                  <div className="kb-preview-meta-row">
                    <Text level="l7" color="var(--color-neutral-500)">分类</Text>
                    <Text level="l7">{selectedDoc.category}</Text>
                  </div>
                  <div className="kb-preview-meta-row">
                    <Text level="l7" color="var(--color-neutral-500)">更新时间</Text>
                    <Text level="l7">{selectedDoc.updatedAt}</Text>
                  </div>
                </div>

                {selectedDoc.keywords && selectedDoc.keywords.length > 0 && (
                  <div className="kb-preview-keywords">
                    {selectedDoc.keywords.map((kw) => (
                      <span key={kw} className="kb-keyword-tag">{kw}</span>
                    ))}
                  </div>
                )}

                {isPublicDoc && (
                  <div className="kb-export-forbidden" style={{ marginTop: 'var(--spacing-md)' }}>
                    <span className="kb-export-forbidden__icon">⚠️</span>
                    <Text level="l7" color="#C03A39">
                      携君库文档受版权保护，仅支持在线阅读，不可下载。
                    </Text>
                  </div>
                )}

                <div className="kb-preview-actions">
                  {isPublicDoc ? (
                    <Button variant="secondary" disabled style={{ flex: 1 }}>
                      🚫 禁止导出
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      style={{ flex: 1 }}
                      onClick={() => navigate(`/m/knowledge-base/export/${selectedDoc.id}`)}
                    >
                      📥 导出
                    </Button>
                  )}
                  <Button variant="secondary" style={{ flex: 1 }}>
                    🔗 分享
                  </Button>
                </div>
              </>
            ) : (
              <div className="kb-empty-state">
                <Text level="l4" color="var(--color-neutral-400)">📋</Text>
                <Text level="l6" color="var(--color-neutral-500)">
                  点击左侧文档查看详情
                </Text>
              </div>
            )}
          </div>
        </div>
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

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
