/**
 * P4 情绪历史页 — 本周情绪趋势图 + 历史记录列表。
 * Route: /m/mood-haven/history
 * 严格对齐 m3p4-mobile.html 原型设计。
 *
 * 使用 mh-* BEM 类名（来自 mood-haven.css）+ 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。返回按钮使用 navigate(-1)。
 * 共享业务组件 EmotionChart, HistoryList 从 @/shared/components/features/emotion 引用。
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import * as emotionsApi from '@/shared/api/emotions';
import type { WeeklyEmotion, EmotionDaySummary } from '@/shared/api/emotions';
import { EmotionChart, HistoryList } from '@/shared/components/features/emotion';
import './mood-haven.css';

export function MoodHavenHistory() {
  const navigate = useNavigate();
  const { isOnline } = useOnlineStatus();
  const [weekly, setWeekly] = useState<WeeklyEmotion | null>(null);
  const [history, setHistory] = useState<EmotionDaySummary[]>([]);
  const [loading, setLoading] = useState(true);

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
        // 加载失败显示空状态
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [isOnline]);

  return (
    <div data-module="mood-haven">
      <div className="mh-page">

        {/* ═══ 顶部导航 ═══ */}
        <header className="mh-page-header" style={{ marginBottom: 12 }}>
          <button className="mh-page-header__back" onClick={() => navigate(-1)}>
            <Icon icon="mingcute:left-line" width={20} />
          </button>
          <h1 className="mh-page-header__title">情绪历史</h1>
          <div className="mh-page-header__spacer" />
        </header>

        {/* ═══ 品牌 Slogan ═══ */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ color: '#333', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
            日耕朝夕，耕愈工作，耕暖生活
          </div>
          <p style={{ fontSize: 17, fontWeight: 700, color: '#333', margin: 0 }}>
            心事有处说，烦恼变智慧
          </p>
        </div>

        {/* ═══ 本周情绪曲线 ═══ */}
        <EmotionChart weekly={weekly} loading={loading} />

        {/* ═══ 历史记录列表 ═══ */}
        <div style={{ marginBottom: 16 }}>
          <h3 style={{
            fontSize: 12, fontWeight: 700, color: '#9ca3af',
            padding: '0 4px 12px',
          }}>
            历史记录
          </h3>

          <HistoryList
            items={history}
            loading={loading}
            emptyState={
              <div style={{
                background: '#fff', borderRadius: 16, padding: 32,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)', textAlign: 'center',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: '50%', background: '#f9fafb',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon icon="mingcute:time-line" width={32} color="#d1d5db" />
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#333', margin: '0 0 4px' }}>
                      暂无历史记录
                    </p>
                    <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>
                      每一次倾诉都会被记录在这里
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/m/mood-haven/chat')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 24px', background: '#C03A39', color: '#fff',
                      borderRadius: 8, border: 'none', fontSize: 14, cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontFamily: 'inherit',
                    }}
                  >
                    <Icon icon="mingcute:chat-2-line" width={16} />
                    去倾诉
                  </button>
                </div>
              </div>
            }
          />
        </div>

        {/* ═══ 底部轻提示 ═══ */}
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>
            — 每一次倾诉都是成长的印记 —
          </p>
        </div>

      </div>
    </div>
  );
}
