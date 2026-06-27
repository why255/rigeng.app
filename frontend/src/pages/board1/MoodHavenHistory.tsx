/**
 * P4 情绪历史页 — 本周情绪趋势图 + 历史记录列表 + 暗色模式切换。
 * Route: /m/mood-haven/history
 * 对齐 m3-p4.html 设计
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import * as emotionsApi from '@/api/emotions';
import type { WeeklyEmotion, EmotionDaySummary } from '@/api/emotions';
import './mood-haven.css';


const MOOD_EMOJI: Record<string, string> = {
  '开心': '😊', '喜悦': '😄', '振奋': '🤩',
  '平静': '😌', '平和': '🙂',
  '疲惫': '😔', '累': '😫',
  '委屈': '😢', '难过': '😭', '焦虑': '😰', '沮丧': '😞',
};

function getEmojiClass(mood: string): string {
  const negativeMoods = ['委屈', '难过', '焦虑', '沮丧', '悲伤', '愤怒'];
  const neutralMoods = ['疲惫', '累'];
  if (negativeMoods.includes(mood)) return 'mh-history-item__emoji--sad';
  if (neutralMoods.includes(mood)) return 'mh-history-item__emoji--neutral';
  return 'mh-history-item__emoji--happy';
}

function getTitleClass(mood: string): string {
  const negativeMoods = ['委屈', '难过', '焦虑', '沮丧', '悲伤', '愤怒'];
  return negativeMoods.includes(mood) ? 'mh-history-item__title--negative' : '';
}

export function MoodHavenHistory() {
  const navigate = useNavigate();
  const { isOnline } = useOnlineStatus();
  const [weekly, setWeekly] = useState<WeeklyEmotion | null>(null);
  const [history, setHistory] = useState<EmotionDaySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  });

  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => {
      const next = !prev;
      if (next) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
      return next;
    });
  }, []);

  useEffect(() => {
    // 恢复暗色模式状态（如果从倾诉页跳转过来可能已经是暗色）
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    setDarkMode(isDark);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        if (isOnline) {
          const [w, h] = await Promise.all([
            emotionsApi.fetchWeeklyEmotion(),
            emotionsApi.fetchEmotionHistory(),
          ]);
          if (!cancelled) { setWeekly(w); setHistory(h); }
        }
      } catch {
        // 加载失败使用模拟数据
        if (!cancelled) {
          setWeekly({
            week_label: '本周',
            days: [
              { day: '周一', day_index: 0, score: 3, has_record: true },
              { day: '周二', day_index: 1, score: -1, has_record: false },
              { day: '周三', day_index: 2, score: -5, has_record: true },
              { day: '周四', day_index: 3, score: 2, has_record: true },
              { day: '周五', day_index: 4, score: 0, has_record: false },
              { day: '周六', day_index: 5, score: 5, has_record: true },
              { day: '周日', day_index: 6, score: 4, has_record: false },
            ],
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [isOnline]);

  // bar height: 0~100%, mapping score from -10~10
  const scoreToHeight = (score: number) => {
    const pct = ((score + 10) / 20) * 100;
    return Math.max(4, Math.min(100, pct));
  };

  return (
    <div data-module="mood-haven">
      <div className="mh-page">
        {/* 品牌标语区 */}
        <section className="mh-hero" style={{ marginBottom: 24 }}>
          <div className="mh-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</div>
          <div className="mh-hero__divider" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 className="mh-hero__title" style={{ fontSize: 28 }}>情绪历史</h2>
              <p className="mh-hero__subtitle">心事有处说，烦恼变智慧</p>
            </div>
            {/* 暗色模式切换 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => { if (darkMode) toggleDarkMode(); }}
                style={{
                  padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 500,
                  background: !darkMode ? '#C03A39' : '#f0f0f0',
                  color: !darkMode ? '#fff' : '#999',
                  transition: 'all 0.2s',
                }}
              >
                浅色
              </button>
              <button
                onClick={() => { if (!darkMode) toggleDarkMode(); }}
                style={{
                  padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 500,
                  background: darkMode ? '#C03A39' : '#f0f0f0',
                  color: darkMode ? '#fff' : '#999',
                  transition: 'all 0.2s',
                }}
              >
                暗色
              </button>
            </div>
          </div>
        </section>

        {/* 本周情绪趋势图 */}
        <div className="mh-card">
          <div className="mh-card__header">
            <span className="mh-card__header-icon">📈</span>
            <h3 className="mh-card__header-title">本周情绪趋势</h3>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>加载中…</div>
          ) : weekly ? (
            <div className="mh-chart">
              {weekly.days.map((day) => (
                <div key={day.day_index} className="mh-chart__bar-wrap">
                  <div
                    className={`mh-chart__bar ${day.score >= 0 ? 'mh-chart__bar--positive' : 'mh-chart__bar--negative'}`}
                    style={{ height: `${scoreToHeight(day.score)}%` }}
                    title={`${day.day}: ${day.score > 0 ? '+' : ''}${day.score}`}
                  />
                  <span className="mh-chart__label">{day.day}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* 暗色模式开关（移动端风格） */}
        <div className="mh-dark-toggle" style={{ marginTop: 16 }}>
          <span className="mh-dark-toggle__icon">{darkMode ? '🌙' : '☀️'}</span>
          <span className="mh-dark-toggle__label">暗色模式</span>
          <button
            className={`mh-dark-toggle__switch ${darkMode ? 'mh-dark-toggle__switch--on' : ''}`}
            onClick={toggleDarkMode}
            aria-label={darkMode ? '切换到浅色模式' : '切换到暗色模式'}
          >
            <div className="mh-dark-toggle__switch-knob" />
          </button>
        </div>

        {/* 历史记录列表 */}
        <div style={{ marginTop: 24 }}>
          <h3 className="mh-chart__section-title">历史详请</h3>

          {history.length === 0 && !loading ? (
            <div className="mh-card" style={{ textAlign: 'center', padding: '32px', color: '#999' }}>
              <p>暂无历史记录</p>
              <p style={{ fontSize: 13, marginTop: 8 }}>
                去<button
                  onClick={() => navigate('/m/mood-haven/chat')}
                  style={{ color: '#C03A39', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >情绪树洞</button>开始第一次倾诉吧
              </p>
            </div>
          ) : (
            <div className="mh-history-list">
              {history.map((item, idx) => (
                <div key={idx} className="mh-history-item">
                  <div className="mh-history-item__left">
                    <div className={`mh-history-item__emoji ${getEmojiClass(item.mood)}`}>
                      {MOOD_EMOJI[item.mood] ?? item.mood_emoji ?? '😐'}
                    </div>
                    <div className="mh-history-item__info">
                      <span className={`mh-history-item__title ${getTitleClass(item.mood)}`}>
                        {item.date} · {item.mood}
                      </span>
                      <span className="mh-history-item__detail">
                        倾诉时长：{item.duration_minutes}分钟
                        {item.growth_record_count > 0
                          ? ` | 生成 ${item.growth_record_count} 条成长记录`
                          : ' | 暂无成长记录'}
                      </span>
                    </div>
                  </div>
                  <span className="mh-history-item__arrow">›</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 返回链接 */}
        <div className="mh-footer-links">
          <Link to="/m/mood-haven" className="mh-nav-link">← 返回树洞</Link>
          <span className="mh-footer-links__divider">|</span>
          <Link to="/m/mood-haven/growth" className="mh-nav-link">📖 成长手册</Link>
        </div>
      </div>
    </div>
  );
}
