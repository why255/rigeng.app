/**
 * M12-P3 导出文档页 — 移动端
 * Route: /m/knowledge-base/export/:id
 * 对齐 m12-p3-mobile.html 设计：文档信息、格式选择(PDF/Word/图片)、
 *   水印设置、导出确认
 *
 * 使用 kb-* BEM 类名 + 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。无 emoji 字符。
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useToast } from '@/shared/components/primitives/toast';
import './knowledge-base.css';

type ExportFormat = 'pdf' | 'word' | 'image';
type WatermarkMode = 'default' | 'custom' | 'none';

export function KnowledgeBaseExport() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const toast = useToast();

  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [watermark, setWatermark] = useState<WatermarkMode>('default');
  const [customWatermarkText, setCustomWatermarkText] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [docTitle, setDocTitle] = useState('文档导出');

  useEffect(() => {
    // TODO: 通过 API 加载文档信息
    // knowledgeApi.fetchDocDetail(id).then(doc => { setDocTitle(doc.title); setIsPublic(doc.library_type === 'public'); });
  }, [id]);

  const handleExport = () => {
    if (isPublic) return;
    toast('正在生成导出文件...', 'neutral');
    setTimeout(() => {
      toast('导出完成', 'success');
      navigate('/m/knowledge-base');
    }, 2000);
  };

  const FORMATS: { key: ExportFormat; label: string; icon: string; disabled: boolean; hint: string }[] = [
    { key: 'pdf', label: 'PDF', icon: 'mingcute:file-pdf-line', disabled: false, hint: '推荐格式' },
    { key: 'word', label: 'Word', icon: 'mingcute:file-word-line', disabled: false, hint: '可编辑' },
    { key: 'image', label: '图片', icon: 'mingcute:file-image-line', disabled: true, hint: '即将上线' },
  ];

  const WATERMARKS: { key: WatermarkMode; label: string; desc: string }[] = [
    { key: 'default', label: '默认水印（日耕）', desc: '自动添加"日耕知识库"水印' },
    { key: 'custom', label: '自定义文字', desc: '输入你想要的水印文字' },
    { key: 'none', label: '无水印', desc: '导出的文档不包含任何水印' },
  ];

  return (
    <div className="kb-main-padding">
      {/* ── 文档信息卡片 ── */}
      <div className="kb-card" style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div className="kb-export-summary__icon">
          <Icon icon="mingcute:file-word-line" />
        </div>
        <h3 className="kb-export-summary__title">{docTitle}</h3>
        <p className="kb-export-summary__meta">信息由上一页传递</p>
      </div>

      {/* ── 携君库禁止导出 ── */}
      {isPublic && (
        <div className="kb-card" style={{ marginBottom: '24px' }}>
          <div className="kb-export-forbidden">
            <Icon icon="mingcute:forbid-circle-line" className="kb-export-forbidden__icon" />
            <p className="kb-export-forbidden__title">
              该文档属于"携君库"受保护资源，禁止导出。
            </p>
            <p className="kb-export-forbidden__text">
              如需引用，请使用分享功能或在站内查阅。
            </p>
          </div>
        </div>
      )}

      {/* ── 格式选择 ── */}
      <div className="kb-card" style={{ marginBottom: '24px' }}>
        <div className="kb-card__header">
          <h4 className="kb-card__header-title">导出格式</h4>
        </div>
        <div className="kb-format-grid">
          {FORMATS.map((f) => (
            <div
              key={f.key}
              className={`kb-format-card${format === f.key ? ' kb-format-card--selected' : ''}${f.disabled ? ' kb-format-card--disabled' : ''}`}
              onClick={() => { if (!f.disabled && !isPublic) setFormat(f.key); }}
            >
              <Icon icon={f.icon} className="kb-format-card__icon" />
              <div className="kb-format-card__label">{f.label}</div>
              <div className="kb-format-card__hint">{f.hint}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 水印设置 ── */}
      {!isPublic && (
        <div className="kb-card" style={{ marginBottom: '24px' }}>
          <div className="kb-card__header">
            <h4 className="kb-card__header-title">水印设置</h4>
          </div>
          <div className="kb-watermark-options">
            {WATERMARKS.map((w) => (
              <div
                key={w.key}
                className={`kb-watermark-option${watermark === w.key ? ' kb-watermark-option--selected' : ''}`}
                onClick={() => setWatermark(w.key)}
              >
                <div className="kb-watermark-radio">
                  {watermark === w.key && <div className="kb-watermark-radio__dot" />}
                </div>
                <div>
                  <div className="kb-watermark-option__label">{w.label}</div>
                  <div className="kb-watermark-option__desc">{w.desc}</div>
                  {w.key === 'custom' && watermark === 'custom' && (
                    <input
                      className="kb-custom-watermark-input"
                      type="text"
                      placeholder="输入自定义水印文字..."
                      value={customWatermarkText}
                      onChange={(e) => setCustomWatermarkText(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 操作按钮 ── */}
      <div className="kb-export-actions">
        <button
          className="kb-btn-sm kb-btn-sm--secondary"
          onClick={() => navigate(-1)}
        >
          取消
        </button>
        <button
          className="kb-btn-sm kb-btn-sm--primary"
          disabled={isPublic}
          onClick={handleExport}
        >
          {isPublic ? '禁止导出' : '确认并开始导出'}
        </button>
      </div>
    </div>
  );
}
