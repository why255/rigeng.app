/**
 * M12-P3 导出确认页
 * 对齐 m12-p3.html：面包屑、格式选择、水印设置、导出进度遮罩、携君库禁止导出
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { PageContainer } from '@/components/layout/AppShell';
import { Card, Text, Button } from '@/components/primitives';
import { useToast } from '@/components/primitives/toast';
import * as knowledgeApi from '@/api/knowledge';
import type { DocumentItem, ExportFormat } from '@/api/knowledge';
import '../pages.css';
import './knowledge.css';

export function KnowledgeExport() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [doc, setDoc] = useState<DocumentItem | null>(null);
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [watermark, setWatermark] = useState<'default' | 'custom' | 'none'>('default');
  const [customWatermark, setCustomWatermark] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  const docId = id!;

  useEffect(() => {
    if (!docId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const detail = await knowledgeApi.fetchDocDetail(docId);
        if (!cancelled) setDoc(detail);
      } catch {
        if (!cancelled) toast('加载文档信息失败', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [docId, toast]);

  const handleExport = async () => {
    if (!doc || exporting) return;
    setExporting(true);
    setExportProgress(0);

    // 模拟进度动画
    const interval = setInterval(() => {
      setExportProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 400);

    try {
      const wm = watermark === 'custom' ? customWatermark : watermark === 'default' ? '日耕' : undefined;
      await knowledgeApi.exportDoc(doc.id, format, wm);
      clearInterval(interval);
      setExportProgress(100);
      toast('导出成功！文件已开始下载', 'success');
      setTimeout(() => navigate('/m/knowledge-base'), 2000);
    } catch (err: any) {
      clearInterval(interval);
      setExportProgress(0);
      if (err?.code === 403 || err?.httpStatus === 403) {
        toast('携君库文档禁止导出', 'error');
      } else {
        toast('导出失败，请稍后重试', 'error');
      }
    } finally {
      setTimeout(() => setExporting(false), 500);
    }
  };

  const isForbidden = doc?.library === 'public';

  return (
    <PageContainer width="dashboard">
      <div data-module="knowledge-base">
        {/* ── 面包屑 ── */}
        <nav className="kb-breadcrumb">
          <Link to="/m/knowledge-base">公私智库</Link>
          <span className="kb-breadcrumb__sep">›</span>
          <Link to="/m/knowledge-base/list">文档查看</Link>
          <span className="kb-breadcrumb__sep">›</span>
          <span className="kb-breadcrumb__current">导出确认</span>
        </nav>

        {/* 品牌标语 */}
        <div style={{ textAlign: 'center', padding: 'var(--spacing-md) 0' }}>
          <Text level="l6" as="div" color="var(--color-neutral-600)">
            日耕朝夕，耕愈工作，耕暖生活
          </Text>
        </div>

        {/* ── 导出进度遮罩 ── */}
        {exporting && (
          <div className="kb-export-overlay">
            <div className="kb-export-overlay__card">
              <div className="kb-export-overlay__spinner" />
              <Text level="l3" as="div" style={{ marginTop: 'var(--spacing-md)' }}>
                {exportProgress >= 100 ? '✅ 导出完成' : '⏳ 正在生成文档…'}
              </Text>
              <div className="kb-export-overlay__progress">
                <div
                  className="kb-export-overlay__progress-fill"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
              <Text level="l6" color="var(--color-neutral-500)" style={{ marginTop: 'var(--spacing-sm)' }}>
                {exportProgress >= 100 ? '文件已开始下载' : `生成中 ${Math.round(exportProgress)}%`}
              </Text>
            </div>
          </div>
        )}

        <div className="kb-export-card">
          <Card>
            <Text level="l2" as="div" style={{ marginBottom: 'var(--spacing-xs)' }}>导出确认</Text>
            <Text level="l6" color="var(--color-neutral-500)" style={{ marginBottom: 'var(--spacing-lg)' }}>
              请确认导出设置，完成后将开始生成文档
            </Text>

            {loading ? (
              <div className="kb-loading">
                <div className="kb-loading-spinner" />
              </div>
            ) : doc ? (
              <>
                {/* 文件摘要 */}
                <div className="kb-export-doc-summary">
                  <span className="kb-file-icon" style={{ fontSize: 36 }}>
                    {getFileIcon(doc.fileType)}
                  </span>
                  <div className="kb-export-doc-summary__info">
                    <Text level="l4" as="div">{doc.title}</Text>
                    <Text level="l7" color="var(--color-neutral-500)">
                      大小: {formatFileSize(doc.fileSize)} | 格式: {doc.fileType.toUpperCase()} | 创建时间: {doc.createdAt}
                    </Text>
                  </div>
                </div>

                {/* 携君库禁止导出提示 */}
                {isForbidden && (
                  <div className="kb-export-forbidden">
                    <span className="kb-export-forbidden__icon">🚫</span>
                    <div>
                      <Text level="l5" color="#C03A39" as="div">
                        该文档属于"携君库"受保护资源，禁止导出。
                      </Text>
                      <Text level="l7" color="#C03A39">
                        如需引用，请使用分享功能或在站内查阅。
                      </Text>
                    </div>
                  </div>
                )}

                {/* 导出格式选择 */}
                <Text level="l5" as="div" style={{ marginBottom: 'var(--spacing-sm)' }}>导出格式</Text>
                <div className="kb-format-grid">
                  {([
                    { key: 'pdf' as ExportFormat, icon: '📕', label: 'PDF', disabled: false },
                    { key: 'word' as ExportFormat, icon: '📝', label: 'Word', disabled: false },
                    { key: 'image' as ExportFormat, icon: '🖼️', label: '图片', disabled: true },
                  ]).map((f) => (
                    <button
                      key={f.key}
                      className={[
                        'kb-format-card',
                        format === f.key && 'kb-format-card--selected',
                        f.disabled && 'kb-format-card--disabled',
                      ].filter(Boolean).join(' ')}
                      onClick={() => !f.disabled && !isForbidden && setFormat(f.key)}
                      disabled={f.disabled || isForbidden}
                    >
                      <div className="kb-format-icon">{f.icon}</div>
                      <Text level="l5" as="div">{f.label}</Text>
                      {f.disabled && <Text level="l7" color="var(--color-neutral-400)">即将上线</Text>}
                    </button>
                  ))}
                </div>

                {/* 水印设置 */}
                <Text level="l5" as="div" style={{ marginBottom: 'var(--spacing-sm)' }}>水印设置</Text>
                <div className="kb-watermark-options">
                  {([
                    { key: 'default' as const, label: '默认水印（日耕）', desc: '使用"日耕"品牌水印' },
                    { key: 'custom' as const, label: '自定义文字', desc: '输入您想要的水印文字' },
                    { key: 'none' as const, label: '无水印', desc: '不添加任何水印' },
                  ]).map((opt) => (
                    <button
                      key={opt.key}
                      className={[
                        'kb-watermark-option',
                        watermark === opt.key && 'kb-watermark-option--selected',
                      ].filter(Boolean).join(' ')}
                      onClick={() => !isForbidden && setWatermark(opt.key)}
                      disabled={isForbidden}
                    >
                      <div className="kb-watermark-radio" />
                      <div>
                        <Text level="l5" as="div">{opt.label}</Text>
                        <Text level="l7" color="var(--color-neutral-500)">{opt.desc}</Text>
                      </div>
                    </button>
                  ))}
                </div>

                {watermark === 'custom' && (
                  <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <input
                      className="kb-search-input"
                      style={{ width: '100%', border: '1px solid var(--color-neutral-200)', borderRadius: 'var(--radius-md)', padding: '8px 12px' }}
                      type="text"
                      placeholder="请输入自定义水印文字…"
                      value={customWatermark}
                      onChange={(e) => setCustomWatermark(e.target.value)}
                      disabled={isForbidden}
                    />
                  </div>
                )}

                {/* 移动端 PC 专享提示 */}
                <div className="kb-mobile-hint">
                  <span>💻</span>
                  <Text level="l7" color="var(--color-neutral-500)">
                    推荐使用 PC 端进行导出操作，体验更佳
                  </Text>
                </div>

                {/* 操作按钮 */}
                <div className="kb-export-actions">
                  <Button variant="secondary" onClick={() => navigate(-1)}>
                    取消
                  </Button>
                  {isForbidden ? (
                    <Button disabled>
                      🚫 禁止导出
                    </Button>
                  ) : (
                    <Button onClick={handleExport} disabled={exporting}>
                      {exporting ? '⏳ 生成中…' : '确认并开始导出'}
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className="kb-empty-state">
                <Text level="l5" color="var(--color-neutral-500)">📋</Text>
                <Text level="l6" color="var(--color-neutral-500)">文档信息不可用</Text>
              </div>
            )}
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

function getFileIcon(fileType: string): string {
  switch (fileType) {
    case 'pdf': return '📄';
    case 'docx': return '📝';
    case 'xlsx': return '📊';
    default: return '📋';
  }
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
