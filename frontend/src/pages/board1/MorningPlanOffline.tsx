/**
 * P5 离线模式页 — 离线功能状态矩阵 + 离线输入。
 * Route: /m/morning-plan/offline
 * 对齐 m1-p5.html 设计（提取 body 内 main 内容区）
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { queueSyncAction } from '@/api/offlineStore';
import './morning-plan.css';

export function MorningPlanOffline() {
  const navigate = useNavigate();
  const { isOnline } = useOnlineStatus();
  const [draft, setDraft] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  // 恢复联网后自动跳转回入口页
  useEffect(() => {
    if (isOnline) {
      setTimeout(() => navigate('/m/morning-plan'), 1500);
    }
  }, [isOnline, navigate]);

  const handleOfflineSave = () => {
    const text = draft.trim();
    if (!text) return;
    queueSyncAction({
      action: 'create_plan',
      payload: {
        title: '离线计划',
        tasks: [{ title: text, quadrant: 'not_urgent_important', source: 'user_input' }],
      },
      timestamp: Date.now(),
    });
    setDraft('');
    setSavedMsg('✅ 已保存到本地，网络恢复后将自动同步');
    setTimeout(() => setSavedMsg(''), 3000);
  };

  return (
    <div data-module="morning-plan">
      {/* 离线横幅 */}
      {!isOnline && (
        <div className="mp-offline-banner">
          <span>⚠️</span>
          <span>部分高级功能暂不可用，基础规划可以正常进行</span>
        </div>
      )}

      <div className="mp-page">
        {/* 品牌标语区 */}
        <section className="mp-hero" style={{ marginBottom: 32 }}>
          <div className="mp-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</div>
          <div className="mp-hero__divider" />
          <h2 className="mp-hero__title--small" style={{ marginTop: 12 }}>晨起做规划，整日不慌忙</h2>
        </section>

        {/* 离线模式说明卡片 */}
        <div className="mp-card">
          <div className="mp-card__header">
            <span className="mp-card__header-icon">📡</span>
            <h3 className="mp-card__header-title">离线模式</h3>
          </div>
          <p style={{ fontSize: 14, color: '#666', marginBottom: 24 }}>
            当前处于离线状态，基础规划功能可正常使用，部分高级功能暂不可用。
          </p>

          {/* 功能状态矩阵 */}
          <div>
            <OfflineStatusRow icon="✅" label="文字输入规划" status="可用" variant="available" />
            <OfflineStatusRow icon="⚠️" label="语音输入" status="离线可用" variant="limited" />
            <OfflineStatusRow icon="❌" label="智能分析推荐" status="不可用" variant="unavailable" />
            <OfflineStatusRow icon="❌" label="历史计划同步" status="不可用" variant="unavailable" />
          </div>
        </div>

        {/* 离线输入 */}
        <div className="mp-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#333', marginBottom: 16 }}>
            离线输入规划
          </h3>
          <div className="mp-offline-input">
            <input
              type="text"
              placeholder="离线模式下输入规划…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleOfflineSave(); }}
            />
            <button onClick={handleOfflineSave} disabled={!draft.trim()}>
              ➤
            </button>
          </div>
          {savedMsg && (
            <div style={{ color: '#4CAF50', fontSize: 13, marginTop: 12 }}>
              {savedMsg}
            </div>
          )}
        </div>

        {/* 联网恢复提示 */}
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <p style={{ color: '#999', fontSize: 12 }}>网络恢复后，系统将自动同步您的离线数据</p>
        </div>

        {/* 品牌底部 Logo 区 */}
        <div className="mp-brand-footer">
          <div className="mp-brand-footer__logo">
            <span>耕</span>
          </div>
          <div className="mp-brand-footer__slogan">日耕朝夕，耕愈工作，耕暖生活</div>
          <div className="mp-brand-footer__subtitle">晨起做规划，整日不慌忙</div>
        </div>
      </div>
    </div>
  );
}

/** 离线功能状态行 */
function OfflineStatusRow({
  icon, label, status, variant,
}: {
  icon: string; label: string; status: string; variant: 'available' | 'limited' | 'unavailable';
}) {
  return (
    <div className={`mp-offline-row mp-offline-row--${variant}`}>
      <span className="mp-offline-row__icon">{icon}</span>
      <span className="mp-offline-row__label">{label}</span>
      <span className={`mp-offline-row__badge mp-offline-row__badge--${variant}`}>{status}</span>
    </div>
  );
}
