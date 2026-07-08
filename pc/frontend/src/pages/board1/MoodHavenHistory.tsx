/**
 * P4 情绪历史页 — 本周情绪趋势图 + 历史记录列表。
 * Route: /m/mood-haven/history
 * 对齐 m3-p4.html 设计。
 * 共享业务组件 EmotionChart, HistoryList 从 @/shared/components/features/emotion 引用。
 * 暗色模式开关已移至设置页，本页不再包含。
 */
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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

  return (
    <div data-module="mood-haven">
      <div className="mh-page">
        {/* 品牌标语区 */}
        <section className="mh-hero" style={{ marginBottom: 24 }}>
          <div className="mh-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</div>
          <div className="mh-hero__divider" />
          <h2 className="mh-hero__title" style={{ fontSize: 28 }}>情绪历史</h2>
          <p className="mh-hero__subtitle">心事有处说，烦恼变智慧</p>
        </section>

        {/* 本周情绪趋势图 */}
        <EmotionChart weekly={weekly} loading={loading} />

        {/* 历史记录列表 */}
        <div style={{ marginTop: 24 }}>
          <h3 className="mh-chart__section-title">历史详请</h3>

          <HistoryList
            items={history}
            loading={loading}
            emptyState={
              <div className="mh-card" style={{ textAlign: 'center', padding: '32px', color: '#999' }}>
                <p>暂无历史记录</p>
                <p style={{ fontSize: 13, marginTop: 8 }}>
                  去<button
                    onClick={() => navigate('/m/mood-haven/chat')}
                    style={{ color: '#C03A39', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >情绪树洞</button>开始第一次倾诉吧
                </p>
              </div>
            }
          />
        </div>

        {/* 返回链接 */}
        <div className="mh-footer-links">
          <Link to="/m/mood-haven" className="mh-nav-link">
            <Icon icon="mingcute:left-line" width={14} /> 返回树洞
          </Link>
          <span className="mh-footer-links__divider">|</span>
          <Link to="/m/mood-haven/growth" className="mh-nav-link">
            <Icon icon="mingcute:book-2-line" width={14} /> 成长手册
          </Link>
        </div>
      </div>
    </div>
  );
}
