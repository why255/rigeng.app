/**
 * M12-P4 待审核区 + 智库设置 — 移动端
 * Route: /m/knowledge-base/audit
 * 对齐 m12-p4-mobile.html 设计：四步引擎状态、审核列表（确认/修改/放弃）、
 *   批量操作、确认弹窗、设置开关
 *
 * 使用 kb-* BEM 类名 + 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。无 emoji 字符。
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useToast } from '@/shared/components/primitives/toast';
import * as knowledgeApi from '@/shared/api/knowledge';
import type { PendingDocItem } from '@/shared/api/knowledge';
import './knowledge-base.css';

interface AuditItem extends PendingDocItem {
  overdue?: boolean;
  checked?: boolean;
}

export function KnowledgeBaseAudit() {
  const navigate = useNavigate();
  const toast = useToast();

  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalAction, setModalAction] = useState<(() => void) | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMsg, setModalMsg] = useState('');

  // 设置
  const [settings, setSettings] = useState({
    reminder: true,
    emotion: true,
    watermark: true,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await knowledgeApi.fetchPendingDocs().catch(() => []);
        if (!cancelled) {
          setItems(data.map((d) => ({ ...d, overdue: false, checked: false })));
        }
      } catch {
        if (!cancelled) setItems([]);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const totalCount = items.length;
  const overdueCount = items.filter((i) => i.overdue).length;

  // ── 确认归档 ──
  const confirmItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast('已归档入库', 'success');
  };

  // ── 放弃 ──
  const discardItem = (id: string) => {
    setModalTitle('放弃归档？');
    setModalMsg('内容进入回收站，30天内可恢复');
    setModalAction(() => () => {
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast('已移入回收站', 'warning');
    });
    setShowModal(true);
  };

  // ── 一键确认全部 ──
  const confirmAll = () => {
    if (items.length === 0) {
      toast('没有待审核内容', 'neutral');
      return;
    }
    setModalTitle(`确认全部 ${items.length} 条归档？`);
    setModalMsg('');
    setModalAction(() => () => {
      setItems([]);
      toast('全部归档完成！', 'success');
    });
    setShowModal(true);
  };

  // ── 批量操作 ──
  const toggleBatchMode = () => {
    setIsBatchMode(!isBatchMode);
    if (isBatchMode) {
      setItems((prev) => prev.map((i) => ({ ...i, checked: false })));
    }
  };

  const toggleCheck = (id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i))
    );
  };

  const batchConfirm = () => {
    const sel = items.filter((i) => i.checked);
    if (sel.length === 0) {
      toast('请先选择', 'warning');
      return;
    }
    setModalTitle(`确认归档 ${sel.length} 条？`);
    setModalMsg('归档后可被其他模块调用');
    setModalAction(() => () => {
      setItems((prev) => prev.filter((i) => !i.checked));
      setIsBatchMode(false);
      toast('已批量归档', 'success');
    });
    setShowModal(true);
  };

  const batchDiscard = () => {
    const sel = items.filter((i) => i.checked);
    if (sel.length === 0) {
      toast('请先选择', 'warning');
      return;
    }
    setModalTitle(`放弃 ${sel.length} 条？`);
    setModalMsg('进入回收站');
    setModalAction(() => () => {
      setItems((prev) => prev.filter((i) => !i.checked));
      setIsBatchMode(false);
      toast('已移入回收站', 'warning');
    });
    setShowModal(true);
  };

  // ── 设置切换 ──
  const toggleSetting = (key: keyof typeof settings) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      const labels: Record<string, string> = {
        reminder: '每日待审核提醒',
        emotion: '情绪内容分离存储',
        watermark: '携君库水印保护',
      };
      toast(`${next[key] ? '已开启' : '已关闭'}：${labels[key]}`, 'neutral');
      return next;
    });
  };

  return (
    <div className="kb-main-padding">
      {/* ── 四步引擎状态 ── */}
      <div className="kb-engine-status">
        <Icon icon="mingcute:check-circle-fill" className="kb-engine-status__icon" />
        <div>
          <p className="kb-engine-status__title">四步引擎就绪</p>
          <p className="kb-engine-status__desc">格式转换→智能命名→打标签→RAG向量化</p>
        </div>
      </div>

      {/* ── 审核提醒横幅 ── */}
      <div className="kb-audit-banner">
        <div className="kb-audit-banner__header">
          <Icon icon="mingcute:alert-line" className="kb-audit-banner__icon" />
          <span className="kb-audit-banner__title">待审核提醒</span>
        </div>
        <p className="kb-audit-banner__text">
          有 <span className="kb-audit-banner__count">{totalCount}</span> 条内容待审核。
          {overdueCount > 0 && <span>其中 {overdueCount} 条已超期。</span>}
          请及时确认归档以沉淀知识。
        </p>
      </div>

      {/* ── 审核工具栏 ── */}
      <div className="kb-audit-toolbar">
        <h3 className="kb-audit-toolbar__title">审核列表</h3>
        <div className="kb-audit-toolbar__actions">
          {isBatchMode ? (
            <div className="kb-audit-batch-actions">
              <button className="kb-btn-sm kb-btn-sm--primary" onClick={batchConfirm}>
                确认所选
              </button>
              <button className="kb-btn-sm kb-btn-sm--secondary" onClick={batchDiscard}>
                放弃所选
              </button>
            </div>
          ) : (
            <button className="kb-audit-toolbar__batch-btn" onClick={toggleBatchMode}>
              批量选择
            </button>
          )}
        </div>
      </div>

      {/* ── 加载 ── */}
      {loading && (
        <div className="kb-loading">
          <div className="kb-skeleton" style={{ height: '96px' }} />
          <div className="kb-skeleton" style={{ height: '96px' }} />
          <p className="kb-loading__text">正在加载待审核列表...</p>
        </div>
      )}

      {/* ── 审核列表 ── */}
      {!loading && items.length > 0 && (
        <div className="kb-audit-list">
          {items.map((item, i) => (
            <div
              key={item.id}
              className={`kb-audit-item${item.overdue ? ' kb-audit-item--overdue' : ''}`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {item.overdue && (
                <div className="kb-audit-item__overdue-badge">已超期</div>
              )}
              {isBatchMode && (
                <input
                  type="checkbox"
                  className="kb-audit-item__checkbox"
                  checked={item.checked || false}
                  onChange={() => toggleCheck(item.id)}
                />
              )}
              <h4 className={`kb-audit-item__title${isBatchMode ? ' kb-audit-item__title--shifted' : ''}`} style={item.overdue ? { paddingRight: '48px' } : {}}>
                {item.title}
              </h4>
              <div className="kb-audit-item__meta">
                <span className="kb-audit-item__meta-text">来源: {item.source || '--'}</span>
                <span className="kb-audit-item__meta-tag">{item.fileType || '--'}</span>
                <span className="kb-audit-item__meta-text">
                  {item.submittedAt?.slice(0, 10) || ''} ({0 || '?'}天前)
                </span>
              </div>
              <div className="kb-audit-item__actions">
                <button
                  className="kb-audit-item__btn kb-audit-item__btn--approve"
                  onClick={() => confirmItem(item.id)}
                >
                  确认归档
                </button>
                <button className="kb-audit-item__btn kb-audit-item__btn--edit">
                  修改并归档
                </button>
                <button
                  className="kb-audit-item__btn kb-audit-item__btn--discard"
                  onClick={() => discardItem(item.id)}
                >
                  <Icon icon="mingcute:delete-2-line" style={{ fontSize: '14px' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 空状态 ── */}
      {!loading && items.length === 0 && (
        <div className="kb-empty">
          <Icon icon="mingcute:check-circle-fill" className="kb-empty__icon" style={{ color: '#6B8E23' }} />
          <p className="kb-empty__title">全部审核完成！</p>
          <p className="kb-empty__sub">在各板块完成操作后，新的产出物会自动进入待审核区</p>
          <button className="kb-btn-primary" onClick={() => navigate('/m/knowledge-base')}>
            返回智库首页
          </button>
        </div>
      )}

      {/* ── 一键确认底栏 ── */}
      {!loading && items.length > 0 && (
        <div className="kb-sticky-bottom">
          <button className="kb-sticky-bottom__btn" onClick={confirmAll}>
            一键确认全部归档 ({items.length}条)
          </button>
        </div>
      )}

      {/* ── 设置区 ── */}
      <div className="kb-settings-section">
        <h3 className="kb-settings-title">智库设置</h3>
        <div className="kb-settings-card">
          <div className="kb-setting-row" onClick={() => toggleSetting('reminder')}>
            <div className="kb-setting-row__left">
              <Icon icon="mingcute:notification-line" className="kb-setting-row__icon" />
              <span className="kb-setting-row__title">每日待审核提醒</span>
            </div>
            <div className={`kb-toggle${settings.reminder ? ' kb-toggle--on' : ' kb-toggle--off'}`}>
              <div className="kb-toggle__knob" />
            </div>
          </div>

          <div className="kb-setting-row" onClick={() => toggleSetting('emotion')}>
            <div className="kb-setting-row__left">
              <Icon icon="mingcute:safe-flash-line" className="kb-setting-row__icon" />
              <span className="kb-setting-row__title">情绪内容分离存储</span>
            </div>
            <div className={`kb-toggle${settings.emotion ? ' kb-toggle--on' : ' kb-toggle--off'}`}>
              <div className="kb-toggle__knob" />
            </div>
          </div>

          <div className="kb-setting-row" onClick={() => toggleSetting('watermark')}>
            <div className="kb-setting-row__left">
              <Icon icon="mingcute:shield-check-line" className="kb-setting-row__icon" />
              <span className="kb-setting-row__title">携君库水印保护</span>
            </div>
            <div className={`kb-toggle${settings.watermark ? ' kb-toggle--on' : ' kb-toggle--off'}`}>
              <div className="kb-toggle__knob" />
            </div>
          </div>

          <div
            className="kb-setting-row"
            onClick={() => toast('回收站功能开发中', 'neutral')}
          >
            <div className="kb-setting-row__left">
              <Icon icon="mingcute:delete-2-line" className="kb-setting-row__icon" />
              <div>
                <span className="kb-setting-row__title">回收站 (30天自动清理)</span>
              </div>
            </div>
            <div className="kb-setting-row__right">
              <Icon icon="mingcute:right-line" style={{ color: '#999' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── 确认弹窗 ── */}
      {showModal && (
        <div className="kb-modal-overlay">
          <div className="kb-modal-backdrop" onClick={() => setShowModal(false)} />
          <div className="kb-modal-content">
            <div className="kb-modal-content__icon">
              <Icon icon="mingcute:question-line" />
            </div>
            <h3 className="kb-modal-content__title">{modalTitle}</h3>
            {modalMsg && <p className="kb-modal-content__msg">{modalMsg}</p>}
            <div className="kb-modal-content__actions">
              <button
                className="kb-modal-content__btn kb-modal-content__btn--cancel"
                onClick={() => setShowModal(false)}
              >
                取消
              </button>
              <button
                className="kb-modal-content__btn kb-modal-content__btn--confirm"
                onClick={() => {
                  modalAction?.();
                  setShowModal(false);
                }}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
