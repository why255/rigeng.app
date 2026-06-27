/**
 * P6 设置页 — 关怀模式开关等偏好设置。
 * Route: /m/morning-plan/settings
 * 对齐 m1-p6.html 设计（提取 body 内 main 内容区）
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as plansApi from '@rigeng/shared/api/plans';
import './morning-plan.css';

export function MorningPlanSettings() {
  const navigate = useNavigate();
  const [careMode, setCareMode] = useState<'active' | 'passive'>('active');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    plansApi.fetchCurrentUser().then((user) => {
      if (user.care_mode) {
        setCareMode(user.care_mode as 'active' | 'passive');
      }
    }).catch(() => {
      const savedMode = localStorage.getItem('rg_care_mode');
      if (savedMode) setCareMode(savedMode as 'active' | 'passive');
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await plansApi.updateCareMode(careMode);
    } catch {
      localStorage.setItem('rg_care_mode', careMode);
    }
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div data-module="morning-plan">
      <div className="mp-page">
        {/* 品牌标语区 */}
        <div style={{ marginBottom: 24 }}>
          <div className="mp-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</div>
          <div className="mp-hero__divider" style={{ margin: '12px 0' }} />
          <p style={{ fontSize: 14, color: '#666', marginTop: 8 }}>晨起做规划，整日不慌忙</p>
        </div>

        {/* 标题 */}
        <h2 style={{ fontSize: 18, fontFamily: "'ZCOOL XiaoWei', 'Noto Sans SC', serif", fontWeight: 700, color: '#333', marginBottom: 32 }}>
          小耕对话·设置
        </h2>

        {/* 关怀模式 */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E8E0D6', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div className="mp-setting-row">
            <div className="mp-setting-row__info">
              <div className="mp-setting-row__title">关怀模式</div>
              <div className="mp-setting-row__state">当前状态：{careMode === 'active' ? '主动' : '被动'}</div>
            </div>
            <label className="mp-switch">
              <input
                type="checkbox"
                checked={careMode === 'active'}
                onChange={(e) => setCareMode(e.target.checked ? 'active' : 'passive')}
              />
              <span className="mp-switch__slider" />
            </label>
          </div>
        </div>

        {/* 即将开放项 */}
        <div style={{ marginTop: 24, opacity: 0.7 }}>
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E8E0D6', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 16 }}>
            <div className="mp-setting-row">
              <div className="mp-setting-row__info">
                <div className="mp-setting-row__title">暮有复盘 · 复盘提醒时间</div>
                <div className="mp-setting-row__state">每日提醒时间</div>
              </div>
              <span className="mp-setting-row__badge">即将开放</span>
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E8E0D6', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div className="mp-setting-row">
              <div className="mp-setting-row__info">
                <div className="mp-setting-row__title">情绪树洞 · 暗色模式开关</div>
                <div className="mp-setting-row__state">暗色模式</div>
              </div>
              <span className="mp-setting-row__badge">即将开放</span>
            </div>
          </div>
        </div>

        {/* 保存按钮 */}
        <div style={{ marginTop: 32 }}>
          <button
            className="mp-btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存中…' : saved ? '✅ 已保存' : '保存设置'}
          </button>
        </div>

        {/* 返回 */}
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <button
            onClick={() => navigate('/m/morning-plan')}
            style={{
              fontSize: 14, color: '#666', textDecoration: 'underline',
              background: 'none', border: 'none', cursor: 'pointer',
            }}
          >
            ← 返回入口
          </button>
        </div>
      </div>
    </div>
  );
}
