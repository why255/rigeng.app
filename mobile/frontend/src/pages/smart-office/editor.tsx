/**
 * P4 文档编辑器 — AI生成文档查看/编辑/保存/入库/导出。
 * Route: /m/smart-office/editor?module=&name=&tool=&toolLabel=&answers=
 * 对齐 m6-p4-mobile.html 设计规范。
 *
 * 使用 so-* BEM 类名 + 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。返回按钮使用 navigate(-1)。
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import './smart-office.css';

function getTimeString(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function SmartOfficeEditor() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const moduleKey = searchParams.get('module') || '';
  const moduleName = searchParams.get('name') || '';
  const toolLabel = searchParams.get('toolLabel') || '';
  const answersRaw = searchParams.get('answers') || '';

  const userAnswers = answersRaw ? answersRaw.split('|').filter(Boolean) : [];

  // 根据回答构建文档内容
  const buildContent = useCallback(() => {
    const sections: string[] = [];
    if (toolLabel) {
      sections.push(`以下是根据您的需求生成的「${toolLabel}」文档：\n`);
    }
    userAnswers.forEach((answer, i) => {
      const labelMap = ['需求概述', '核心内容', '具体要求', '补充说明', '注意事项'];
      const label = labelMap[i] || `第${i + 1}部分`;
      sections.push(`【${label}】\n${answer}\n`);
    });
    if (userAnswers.length === 0) {
      sections.push('（文档将从AI引导对话中生成，请先在AI引导页面完成信息采集）\n\nAI将根据您提供的信息，自动生成结构化的专业文档。');
    }
    sections.push('──────────────────');
    sections.push('📌 本文档由日耕AI自动生成');
    sections.push('📎 数据来源：私有库 + 携君库 + 互联网');
    sections.push('✏️ 支持自由修改内容');
    if (moduleName) sections.push(`📂 所属模块：${moduleName}`);
    return sections.join('\n');
  }, [toolLabel, userAnswers, moduleName]);

  const [title, setTitle] = useState(toolLabel || '');
  const [content, setContent] = useState(buildContent);
  const [status, setStatus] = useState<'ai' | 'draft' | 'archived'>('ai');
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    setContent(buildContent());
  }, [buildContent]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2000);
  };

  const handleSave = () => {
    setStatus('draft');
    showToast('草稿已保存');
  };

  const handleArchive = () => {
    setStatus('archived');
    showToast('已归档到知识库');
  };

  const handleExport = () => {
    showToast('请在PC端导出');
  };

  const statusLabel = status === 'ai' ? 'AI生成' : status === 'draft' ? '草稿' : '已归档';
  const statusColor = status === 'ai' ? '#E8A94D' : status === 'draft' ? '#E8A94D' : '#27AE60';
  const statusBg = status === 'ai' ? 'rgba(232,169,77,0.1)' : status === 'draft' ? 'rgba(232,169,77,0.1)' : 'rgba(39,174,96,0.1)';

  return (
    <div className="so-page">
      {/* ===== 顶部 Header ===== */}
      <header className="so-header">
        <button className="so-header__back" onClick={() => navigate(-1)}>
          <Icon icon="solar:alt-arrow-left-linear" style={{ fontSize: '24px' }} />
        </button>
        <span className="so-header__title">文档编辑</span>
        <div className="so-header__spacer" />
      </header>

      <main className="so-main">
        <div className="so-main-pad">
          {/* 品牌副标题 */}
          <div className="so-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</div>
          <p style={{ fontSize: '12px', fontWeight: 700, color: '#333', marginTop: 4 }}>
            告别碎片化，高效又专业
          </p>

          {/* AI生成来源标注 */}
          {moduleKey && (
            <div className="so-editor__source">
              <Icon icon="mingcute:ai-line" style={{ color: '#C03A39', fontSize: '14px' }} />
              <span>AI生成 · 基于您的对话输入 · {toolLabel}</span>
            </div>
          )}

          {/* 文档编辑区 */}
          <div className="so-editor">
            <input
              className="so-editor__title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入文档标题"
            />
            <div className="so-editor__meta">
              {moduleName && <span className="so-editor__meta-tag">{moduleName}</span>}
              <span
                className="so-editor__meta-status so-editor__meta-status--ai"
                style={{ color: statusColor, background: statusBg }}
              >
                {statusLabel}
              </span>
              <span>{status === 'ai' ? '刚刚' : `更新于：${getTimeString()}`}</span>
            </div>
            <textarea
              className="so-editor__content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="AI生成的文档内容将显示在这里..."
            />
            <div className="so-editor__footer-note">
              本方案由日耕AI生成 · 支持自由修改
            </div>

            {/* 删除保护（禁用态） */}
            <div className="so-delete-protect">
              <p className="so-delete-protect__label">删除保护（输入"确认"二字后可删除）</p>
              <div className="so-delete-protect__row">
                <input className="so-delete-protect__input" placeholder="输入「确认」" disabled />
                <button className="so-delete-protect__btn" disabled>删除</button>
              </div>
            </div>
          </div>

          {/* 按钮组 */}
          <div className="so-editor-actions">
            <button className="so-btn so-btn--outline" onClick={handleSave}>
              保存草稿
            </button>
            <button className="so-btn so-btn--primary" onClick={handleArchive}>
              确认入库
            </button>
            <button className="so-btn so-btn--gold-outline" onClick={handleExport}>
              <Icon icon="mingcute:file-export-line" style={{ fontSize: '16px' }} />
              <span>导出文档</span>
            </button>
          </div>
        </div>
      </main>

      {/* Toast */}
      <div className={`so-toast${toastVisible ? ' so-toast--show' : ''}`}>{toastMsg}</div>
    </div>
  );
}
