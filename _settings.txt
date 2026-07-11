/**
 * 设置 — 移动端
 * Route: /settings
 * 对齐项目现有设计规范（mm-* BEM 类名）。
 *
 * 包含：账号设置（昵称/性别/称呼/密码）、通知设置、关于、退出登录。
 * 昵称修改后同步到 localStorage，首页"我的"即时反映。
 *
 * 使用 mm-* BEM 类名 + 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。无 emoji 字符。
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useToast } from '@/shared/components/primitives/toast';
import { apiGet, apiPatch } from '@/shared/api/api';
import './mine.css';

/* ── 称呼预设选项 ── */
const ADDRESSING_PRESETS = ['哥', '姐', '用户昵称'];

/* ── 通知设置项 ── */
interface ToggleRow {
  key: string;
  icon: string;
  title: string;
  desc: string;
  enabled: boolean;
}

export function SettingsPage() {
  const navigate = useNavigate();
  const toast = useToast();

  // ── 账号设置 ──
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<string>('');
  const [addressing, setAddressing] = useState('');
  const [addressingOpen, setAddressingOpen] = useState(false);

  // ── 修改密码 ──
  const [showPassword, setShowPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  // ── 通知设置 ──
  const [notifications, setNotifications] = useState<ToggleRow[]>([
    { key: 'morning', icon: 'mingcute:weather-sunny-line', title: '晨间提醒', desc: '每天早上7:30提醒做规划', enabled: true },
    { key: 'evening', icon: 'mingcute:weather-night-line', title: '夜间提醒', desc: '每晚21:00提醒做复盘', enabled: true },
    { key: 'review', icon: 'mingcute:refresh-line', title: '复盘待办', desc: '未完成复盘时次日提醒', enabled: true },
    { key: 'weekly', icon: 'mingcute:chart-line', title: '每周报告', desc: '每周日推送本周日耕周报', enabled: false },
    { key: 'system', icon: 'mingcute:notification-line', title: '系统通知', desc: '版本更新、活动通知等', enabled: true },
  ]);

  // ── 初始化：加载用户数据 ──
  useEffect(() => {
    apiGet<{ nickname?: string; gender?: string; addressing?: string }>('/users/me')
      .then((data) => {
        if (data?.nickname) setNickname(data.nickname);
        if (data?.gender) setGender(data.gender);
        if (data?.addressing) setAddressing(data.addressing);
      })
      .catch(() => { /* 使用默认值 */ });
  }, []);

  // ── 保存 profile 并同步 localStorage ──
  const saveProfile = useCallback(async (fields: Record<string, string>) => {
    try {
      await apiPatch('/users/me/profile', fields);
      // 同步昵称到 localStorage，首页"我的"即时反映
      if (fields.nickname !== undefined) {
        try {
          const raw = localStorage.getItem('rg_user');
          const u = raw ? JSON.parse(raw) : {};
          u.nickname = fields.nickname;
          localStorage.setItem('rg_user', JSON.stringify(u));
        } catch { /* ignore */ }
      }
      toast('已保存', 'success');
    } catch {
      toast('保存失败，请重试', 'error');
    }
  }, [toast]);

  const handleNicknameSave = () => {
    if (!nickname.trim()) { toast('昵称不能为空', 'error'); return; }
    saveProfile({ nickname: nickname.trim() });
  };

  const handleGenderChange = (val: string) => {
    setGender(val);
    saveProfile({ gender: val });
  };

  const handleAddressingSave = () => {
    saveProfile({ addressing: addressing.trim() || '' });
  };

  const handleAddressingPreset = (preset: string) => {
    setAddressingOpen(false);
    const val = preset === '用户昵称' ? (nickname || '') : preset;
    setAddressing(val);
    saveProfile({ addressing: val });
  };

  // ── 修改密码 ──
  const handlePasswordSave = async () => {
    if (!oldPassword) { toast('请输入旧密码', 'error'); return; }
    if (newPassword.length < 6) { toast('新密码至少6位', 'error'); return; }
    setPasswordSaving(true);
    try {
      await apiPatch('/users/me/password', {
        old_password: oldPassword,
        new_password: newPassword,
      });
      toast('密码已更新', 'success');
      setOldPassword('');
      setNewPassword('');
      setShowPassword(false);
    } catch (e: any) {
      toast(e?.message || '修改失败', 'error');
    } finally {
      setPasswordSaving(false);
    }
  };

  // ── 通知 toggle ──
  const toggleNotification = (key: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.key === key ? { ...n, enabled: !n.enabled } : n))
    );
    toast('已更新', 'success');
  };

  const handleLogout = () => {
    localStorage.removeItem('rg_token');
    localStorage.removeItem('rg_user');
    navigate('/login');
  };

  return (
    <div className="mm-page">
      {/* ===== 顶部 Header ===== */}
      <header className="mm-page__header">
        <button className="mm-header-btn" onClick={() => navigate(-1)}>
          <Icon icon="mingcute:left-line" style={{ fontSize: '24px' }} />
        </button>
        <span className="mm-header-title">设置</span>
        <div className="mm-header-spacer" />
      </header>

      {/* ===== 主内容区 ===== */}
      <main className="mm-main-scroll">
        <div className="mm-main-padding">
          {/* ===== 账号设置 ===== */}
          <div>
            <h3 className="mm-section-title">账号设置</h3>
          </div>
          <div className="mm-card" style={{ padding: '20px' }}>
            {/* 用户昵称 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#333', display: 'block', marginBottom: '6px' }}>
                用户昵称
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="输入昵称"
                  style={{
                    flex: 1, padding: '10px 12px', fontSize: '14px', color: '#333',
                    border: '1px solid #E8E0D6', borderRadius: '10px', outline: 'none',
                    background: '#FAFAF8',
                  }}
                />
                <button
                  onClick={handleNicknameSave}
                  style={{
                    padding: '10px 16px', fontSize: '13px', fontWeight: 700, color: '#fff',
                    background: '#C03A39', border: 'none', borderRadius: '10px', cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  保存
                </button>
              </div>
            </div>

            {/* 性别 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#333', display: 'block', marginBottom: '6px' }}>
                性别
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {[
                  { value: 'male', label: '男', icon: 'mingcute:male-line' },
                  { value: 'female', label: '女', icon: 'mingcute:female-line' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleGenderChange(opt.value)}
                    style={{
                      flex: 1, padding: '10px', fontSize: '14px', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      border: gender === opt.value ? '2px solid #C03A39' : '1px solid #E8E0D6',
                      borderRadius: '10px',
                      background: gender === opt.value ? 'rgba(192,58,57,0.04)' : '#FAFAF8',
                      color: gender === opt.value ? '#C03A39' : '#999',
                      cursor: 'pointer',
                    }}
                  >
                    <Icon icon={opt.icon} style={{ fontSize: '16px' }} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 称呼设置 */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#333', display: 'block', marginBottom: '6px' }}>
                您希望小耕怎么称呼您
              </label>
              <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
                <input
                  type="text"
                  value={addressing}
                  onChange={(e) => setAddressing(e.target.value)}
                  onBlur={handleAddressingSave}
                  placeholder="例如：姐、亲爱的"
                  style={{
                    flex: 1, padding: '10px 12px', fontSize: '14px', color: '#333',
                    border: '1px solid #E8E0D6', borderRadius: '10px', outline: 'none',
                    background: '#FAFAF8',
                  }}
                />
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setAddressingOpen(!addressingOpen)}
                    style={{
                      padding: '10px 12px', fontSize: '14px', fontWeight: 700, color: '#C03A39',
                      background: 'rgba(192,58,57,0.06)', border: '1px solid #E8E0D6',
                      borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                    }}
                  >
                    预设
                    <Icon icon={addressingOpen ? 'mingcute:up-line' : 'mingcute:down-line'} style={{ fontSize: '14px' }} />
                  </button>
                  {addressingOpen && (
                    <div
                      style={{
                        position: 'absolute', top: '100%', right: 0, marginTop: '4px',
                        background: '#fff', borderRadius: '10px', border: '1px solid #E8E0D6',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)', overflow: 'hidden',
                        zIndex: 20, minWidth: '120px',
                      }}
                    >
                      {ADDRESSING_PRESETS.map((preset) => (
                        <div
                          key={preset}
                          onClick={() => handleAddressingPreset(preset)}
                          style={{
                            padding: '10px 14px', fontSize: '13px', color: '#333', cursor: 'pointer',
                            borderBottom: '1px solid #F5F3EF',
                          }}
                        >
                          {preset}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ===== 修改密码 ===== */}
          <div className="mm-card" style={{ padding: '20px' }}>
            <div
              onClick={() => setShowPassword(!showPassword)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#333' }}>修改密码</span>
              <Icon
                icon={showPassword ? 'mingcute:up-line' : 'mingcute:down-line'}
                style={{ fontSize: '18px', color: '#999' }}
              />
            </div>
            {showPassword && (
              <div style={{ marginTop: '14px' }}>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="输入旧密码"
                  style={{
                    width: '100%', padding: '10px 12px', fontSize: '14px', color: '#333',
                    border: '1px solid #E8E0D6', borderRadius: '10px', outline: 'none',
                    background: '#FAFAF8', marginBottom: '10px', boxSizing: 'border-box',
                  }}
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="输入新密码（至少6位）"
                  style={{
                    width: '100%', padding: '10px 12px', fontSize: '14px', color: '#333',
                    border: '1px solid #E8E0D6', borderRadius: '10px', outline: 'none',
                    background: '#FAFAF8', marginBottom: '12px', boxSizing: 'border-box',
                  }}
                />
                <button
                  className="mm-btn mm-btn--primary"
                  onClick={handlePasswordSave}
                  disabled={passwordSaving}
                  style={{ opacity: passwordSaving ? 0.6 : 1 }}
                >
                  {passwordSaving ? '保存中...' : '更新密码'}
                </button>
              </div>
            )}
          </div>

          {/* ===== 通知设置 ===== */}
          <div>
            <h3 className="mm-section-title">通知设置</h3>
          </div>
          <div className="mm-settings-card">
            {notifications.map((item) => (
              <div className="mm-setting-row" key={item.key} onClick={() => toggleNotification(item.key)}>
                <div className="mm-setting-row__left">
                  <div className="mm-setting-row__icon mm-setting-row__icon--red">
                    <Icon icon={item.icon} style={{ fontSize: '18px' }} />
                  </div>
                  <div className="mm-setting-row__info">
                    <div className="mm-setting-row__title">{item.title}</div>
                    <div className="mm-setting-row__desc">{item.desc}</div>
                  </div>
                </div>
                <div className="mm-setting-row__right">
                  <button
                    className={`mm-toggle ${item.enabled ? 'mm-toggle--on' : 'mm-toggle--off'}`}
                    onClick={(e) => { e.stopPropagation(); toggleNotification(item.key); }}
                  >
                    <div className="mm-toggle__knob" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ===== 关于 ===== */}
          <div>
            <h3 className="mm-section-title">关于</h3>
          </div>
          <div className="mm-settings-card">
            <div className="mm-setting-row">
              <div className="mm-setting-row__left">
                <div className="mm-setting-row__icon mm-setting-row__icon--amber">
                  <Icon icon="mingcute:info-line" style={{ fontSize: '18px' }} />
                </div>
                <div className="mm-setting-row__info">
                  <div className="mm-setting-row__title">关于日耕</div>
                  <div className="mm-setting-row__desc">版本与开发者信息</div>
                </div>
              </div>
              <div className="mm-setting-row__right">
                <Icon icon="mingcute:right-line" className="mm-setting-row__arrow" />
              </div>
            </div>
            <div className="mm-setting-row">
              <div className="mm-setting-row__left">
                <div className="mm-setting-row__icon mm-setting-row__icon--amber">
                  <Icon icon="mingcute:document-line" style={{ fontSize: '18px' }} />
                </div>
                <div className="mm-setting-row__info">
                  <div className="mm-setting-row__title">用户协议</div>
                  <div className="mm-setting-row__desc">使用条款与隐私政策</div>
                </div>
              </div>
              <div className="mm-setting-row__right">
                <Icon icon="mingcute:right-line" className="mm-setting-row__arrow" />
              </div>
            </div>
            <div className="mm-setting-row">
              <div className="mm-setting-row__left">
                <div className="mm-setting-row__icon mm-setting-row__icon--amber">
                  <Icon icon="mingcute:help-circle-line" style={{ fontSize: '18px' }} />
                </div>
                <div className="mm-setting-row__info">
                  <div className="mm-setting-row__title">帮助与反馈</div>
                  <div className="mm-setting-row__desc">常见问题与意见反馈</div>
                </div>
              </div>
              <div className="mm-setting-row__right">
                <Icon icon="mingcute:right-line" className="mm-setting-row__arrow" />
              </div>
            </div>
          </div>

          {/* 品牌区域 */}
          <div className="mm-card mm-about-info">
            <div className="mm-about-info__logo">
              <span>耕</span>
            </div>
            <div className="mm-about-info__name">日耕 RiGeng</div>
            <div className="mm-about-info__version">版本 2.1.0</div>
            <p style={{ fontSize: '12px', color: '#999', marginTop: '8px', lineHeight: '1.6' }}>
              日耕朝夕，耕愈工作，耕暖生活<br />
              为不愿止步的高知职场人打造
            </p>
          </div>

          {/* ===== 退出登录 ===== */}
          <div className="mm-logout-section">
            <button className="mm-btn mm-btn--danger" onClick={handleLogout}>
              <Icon icon="mingcute:logout-line" style={{ fontSize: '18px' }} />
              退出登录
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
