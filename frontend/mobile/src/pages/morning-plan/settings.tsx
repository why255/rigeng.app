/**
 * P6 设置页 — 关怀模式/语音方式/离线模式开关。
 * Route: /m/morning-plan/settings
 * 对齐 m1-p6.html 设计。
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import './morning-plan.css';

type VoiceMode = 'hold' | 'click';

export function MorningPlanSettings() {
  const navigate = useNavigate();

  const [careMode, setCareMode] = useState(true);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('hold');
  const [offlineMode, setOfflineMode] = useState(true);
  const [saving, setSaving] = useState(false);

  // 加载设置
  useEffect(() => {
    const cm = localStorage.getItem('rg_care_mode');
    setCareMode(cm !== null ? cm === 'true' : true);

    const vm = localStorage.getItem('rg_voice_mode');
    setVoiceMode(vm === 'click' ? 'click' : 'hold');

    const om = localStorage.getItem('rg_offline_mode_enabled');
    setOfflineMode(om !== null ? om === 'true' : true);
  }, []);

  const handleSave = useCallback(() => {
    setSaving(true);
    localStorage.setItem('rg_care_mode', String(careMode));
    localStorage.setItem('rg_voice_mode', voiceMode);
    localStorage.setItem('rg_offline_mode_enabled', String(offlineMode));

    setTimeout(() => {
      setSaving(false);
      navigate(-1);
    }, 600);
  }, [careMode, voiceMode, offlineMode, navigate]);

  return (
    <div className="mp-mobile-page">
      {/* 顶部栏 */}
      <header className="mp-mobile-page__header">
        <button
          className="w-10 h-10 flex items-center justify-center text-gray-600"
          onClick={() => navigate(-1)}
        >
          <Icon icon="solar:alt-arrow-left-linear" className="text-2xl" />
        </button>
        <span className="text-lg font-bold text-[#C03A39] tracking-wide"
          style={{ fontFamily: "'ZCOOL XiaoWei', '华文楷体', 'KaiTi', serif" }}>
          朝有规划 · 设置
        </span>
        <div className="w-10" />
      </header>

      {/* 内容区 */}
      <main className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="p-5 space-y-6">
          {/* 品牌标语 */}
          <div className="text-center mb-1">
            <div className="text-[15px] font-bold text-[#333]">日耕朝夕，耕愈工作，耕暖生活</div>
          </div>
          <div className="text-center mb-4">
            <p className="text-[17px] font-bold text-[#333]" style={{ fontFamily: "'ZCOOL XiaoWei', '华文楷体', 'KaiTi', serif" }}>
              对话设置
            </p>
          </div>

          {/* 主动关怀模式 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-50 p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-800">主动关怀模式</div>
              <div className="text-[11px] text-gray-400 mt-0.5">小耕将主动询问您的状态</div>
            </div>
            <label className="mp-switch">
              <input
                type="checkbox"
                checked={careMode}
                onChange={(e) => setCareMode(e.target.checked)}
              />
              <span className="mp-switch__slider" />
            </label>
          </div>

          {/* 语音输入方式 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-50 p-4 space-y-3">
            <div>
              <div className="text-sm font-medium text-gray-800">语音输入方式</div>
              <div className="text-[11px] text-gray-400 mt-0.5">选择适合您的录音交互方式</div>
            </div>
            <div className="flex gap-2">
              <button
                className={`mp-voice-mode-option ${voiceMode === 'hold' ? 'active' : ''}`}
                onClick={() => setVoiceMode('hold')}
              >
                按住说话
              </button>
              <button
                className={`mp-voice-mode-option ${voiceMode === 'click' ? 'active' : ''}`}
                onClick={() => setVoiceMode('click')}
              >
                点击说话
              </button>
            </div>
          </div>

          {/* 离线模式开关 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-50 p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-800">离线模式</div>
              <div className="text-[11px] text-gray-400 mt-0.5">网络不佳时自动进入离线录音模式</div>
            </div>
            <label className="mp-switch">
              <input
                type="checkbox"
                checked={offlineMode}
                onChange={(e) => setOfflineMode(e.target.checked)}
              />
              <span className="mp-switch__slider" />
            </label>
          </div>

          {/* 分隔线 */}
          <div className="mp-hero__divider my-2" />

          {/* 保存按钮 */}
          <button
            className="w-full py-4 rounded-2xl font-medium shadow-lg transition-all flex items-center justify-center gap-2 text-white"
            style={{ background: saving ? '#2E7D32' : '#C03A39' }}
            onClick={handleSave}
            disabled={saving}
          >
            <Icon icon={saving ? 'mingcute:check-circle-line' : 'mingcute:save-2-line'} className="text-xl" />
            {saving ? '设置已保存' : '保存设置'}
          </button>

          <p className="text-center text-[11px] text-gray-400 pb-2">
            设置将自动同步至语音对话与离线模式
          </p>
        </div>
      </main>
    </div>
  );
}
