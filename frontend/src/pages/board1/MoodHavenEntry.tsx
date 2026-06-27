/**
 * P1 入口页 — 安全承诺语 + 今日情绪概览 + 成长手册预览。
 * Route: /m/mood-haven
 * 对齐 m3-p1.html 设计
 */
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import * as emotionsApi from '@/api/emotions';
import type { TodayEmotion, GrowthRecord } from '@/api/emotions';
import './mood-haven.css';

export function MoodHavenEntry() {
  const navigate = useNavigate();
  const { isOnline } = useOnlineStatus();
  const [emotion, setEmotion] = useState<TodayEmotion | null>(null);
  const [recentRecords, setRecentRecords] = useState<GrowthRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        if (isOnline) {
          const [emo, records] = await Promise.all([
            emotionsApi.fetchTodayEmotion(),
            emotionsApi.fetchRecentGrowthRecords(3),
          ]);
          if (!cancelled) { setEmotion(emo); setRecentRecords(records); }
        } else {
          if (!cancelled) {
            setEmotion({
              mood: '平静', mood_emoji: '😊', score: 0,
              courage_value: 0, has_today_chat: false,
            });
            setRecentRecords([]);
          }
        }
      } catch {
        if (!cancelled) {
          setEmotion({
            mood: '平静', mood_emoji: '😊', score: 5,
            courage_value: 80, has_today_chat: false,
          });
          setRecentRecords([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [isOnline]);

  const score = emotion?.score ?? 0;
  const courage = emotion?.courage_value ?? 0;
  const recordCount = recentRecords.length;
  const recentSnippet = recentRecords[0]?.content?.slice(0, 30) ?? '';

  return (
    <div data-module="mood-haven">
      {/* 离线横幅 */}
      {!isOnline && (
        <div style={{
          background: '#FFF3E0', color: '#E65100', textAlign: 'center',
          padding: '8px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>⚠️</span>
          <span>当前离线，部分功能暂不可用</span>
        </div>
      )}

      <div className="mh-page">
        {/* 品牌标语区 */}
        <section className="mh-hero">
          <div className="mh-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</div>
          <div className="mh-hero__divider" />
          <h2 className="mh-hero__title">心事有处说，烦恼变智慧</h2>
        </section>

        {/* 安全承诺语气泡 */}
        <div className="mh-safe-promise">
          <div className="mh-safe-promise__avatar">🌳</div>
          <div className="mh-safe-promise__bubble">
            <p className="mh-safe-promise__text">
              <strong>姐，您来了。</strong>这里只有您和我，您说的每一句话小耕都会保守秘密。
            </p>
            <p className="mh-safe-promise__text" style={{ marginTop: 8, fontWeight: 500 }}>
              想说什么就说吧，小耕在听。
            </p>
          </div>
        </div>

        {/* 今日情绪概览卡片 */}
        <div className="mh-card">
          <div className="mh-card__header">
            <span className="mh-card__header-icon">📊</span>
            <h3 className="mh-card__header-title">今日情绪概览</h3>
            <span className={`mh-mood-badge ${getMoodBadgeClass(emotion?.mood ?? '')}`}>
              当前情绪：{emotion?.mood ?? '--'} {emotion?.mood_emoji ?? ''}
            </span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>加载中…</div>
          ) : (
            <div>
              {/* 情绪评分滑块 */}
              <div className="mh-emotion-slider-group">
                <div className="mh-emotion-slider-group__header">
                  <span className="mh-emotion-slider-group__label">情绪评分</span>
                  <span className="mh-emotion-slider-group__value">
                    {score > 0 ? '+' : ''}{score}
                  </span>
                </div>
                <input
                  type="range"
                  min="-10"
                  max="10"
                  value={score}
                  readOnly
                  className="mh-emotion-slider"
                />
                <div className="mh-emotion-labels">
                  <span>焦虑/沮丧</span>
                  <span>平和</span>
                  <span>喜悦/振奋</span>
                </div>
              </div>

              {/* 勇气值进度条 */}
              <div className="mh-courage-bar">
                <div className="mh-courage-bar__header">
                  <span className="mh-courage-bar__label">勇气值</span>
                  <span className="mh-courage-bar__value">{courage}/100</span>
                </div>
                <div className="mh-courage-bar__track">
                  <div
                    className="mh-courage-bar__fill"
                    style={{ width: `${Math.min(100, courage)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 成长手册预览卡片 */}
        <div
          className="mh-card mh-card--link"
          onClick={() => navigate('/m/mood-haven/growth')}
        >
          <div className="mh-card__header" style={{ marginBottom: 16 }}>
            <span className="mh-card__header-icon">📖</span>
            <h3 className="mh-card__header-title">我的成长手册</h3>
            <span style={{ marginLeft: 'auto', color: '#ddd', fontSize: 18 }}>›</span>
          </div>
          <div className="mh-growth-preview__stats">
            <div className="mh-growth-preview__stat mh-growth-preview__stat--count">
              <div className="mh-growth-preview__stat-label">已积累</div>
              <div className="mh-growth-preview__stat-value">
                {recordCount} <small>条记录</small>
              </div>
            </div>
            {recentSnippet && (
              <div className="mh-growth-preview__stat mh-growth-preview__stat--recent">
                <div className="mh-growth-preview__stat-label">最近一条</div>
                <div className="mh-growth-preview__recent-text">{recentSnippet}…</div>
              </div>
            )}
          </div>
        </div>

        {/* 主CTA按钮 */}
        <div style={{ paddingTop: 16, textAlign: 'center' }}>
          <button
            className="mh-btn-primary"
            onClick={() => navigate('/m/mood-haven/chat')}
          >
            我想说说
          </button>
          <p className="mh-footer-note" style={{ paddingTop: 12 }}>
            倾诉功能在移动端体验更佳，所有对话均严格加密
          </p>

          <div className="mh-footer-links">
            <Link to="/m/mood-haven/history" className="mh-nav-link">
              📅 情绪历史
            </Link>
            <span className="mh-footer-links__divider">|</span>
            <Link to="/m/mood-haven/growth" className="mh-nav-link">
              📖 成长手册
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function getMoodBadgeClass(mood: string): string {
  if (['开心', '喜悦', '振奋'].includes(mood)) return 'mh-mood-badge--happy';
  if (['平静', '平和'].includes(mood)) return 'mh-mood-badge--calm';
  if (['疲惫', '累'].includes(mood)) return 'mh-mood-badge--tired';
  if (['委屈', '难过', '焦虑', '沮丧'].includes(mood)) return 'mh-mood-badge--sad';
  return 'mh-mood-badge--calm';
}
