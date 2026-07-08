/**
 * P4 复盘历史页 — 统计概览 + 本周进度 + 历史列表（对齐 m2-p4-mobile.html）。
 * Route: /m/evening-review/history
 *
 * 使用 mp-* BEM 类名（来自 morning-plan.css）+ 内联 style。无 Tailwind CSS。
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import * as reviewsApi from '@/shared/api/reviews';
import type { WeeklyProgress, ReviewHistoryItem } from '@/shared/api/reviews';
import {
  ReviewBrandHero,
  WeeklyProgress as WeeklyProgressDisplay,
  HistoryCard,
  WEEKDAY_LABELS,
} from '@/shared/components/features/evening-review';
import '../morning-plan/morning-plan.css';

/** 计算连续复盘天数 */
function calcConsecutiveDays(history: ReviewHistoryItem[]): number {
  let count = 0;
  const today = new Date();
  for (let i = 0; i < history.length; i++) {
    const itemDate = new Date(history[i].date);
    const expectedDate = new Date(today);
    expectedDate.setDate(today.getDate() - i);
    if (itemDate.toDateString() === expectedDate.toDateString() && history[i].status === 'completed') {
      count++;
    } else break;
  }
  return count;
}

/** 计算本周完成度 */
function calcWeekCompletion(weekly: WeeklyProgress | null): number {
  if (!weekly) return 0;
  return weekly.days.filter(d => d.status === 'completed').length;
}

export function EveningReviewHistory() {
  const navigate = useNavigate();
  const [weekly, setWeekly] = useState<WeeklyProgress | null>(null);
  const [history, setHistory] = useState<ReviewHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [w, h] = await Promise.all([
          reviewsApi.fetchWeeklyProgress(),
          reviewsApi.fetchReviewHistory(),
        ]);
        if (!cancelled) { setWeekly(w); setHistory(h); }
      } catch {
        if (!cancelled) {
          const today = new Date();
          const dayOfWeek = today.getDay();
          const monday = new Date(today);
          monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
          setWeekly({
            week_label: '本周',
            days: Array.from({ length: 7 }, (_, i) => {
              const d = new Date(monday);
              d.setDate(monday.getDate() + i);
              const isToday = d.toDateString() === today.toDateString();
              const isPast = d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
              return {
                day: WEEKDAY_LABELS[i], day_index: i,
                status: isPast ? (i < 3 ? 'completed' : 'pending') : isToday ? 'in_progress' : 'pending',
                completion_rate: isPast ? (i < 3 ? (60 + i * 10) : undefined) : isToday ? 60 : undefined,
              };
            }),
          });
          setHistory([
            { id: 'h1', date: '6月20日', day_of_week: '周五', sop_title: '萃取SOP：招聘方案初稿流程', quality_score: 4, status: 'completed' },
            { id: 'h2', date: '6月19日', day_of_week: '周四', sop_title: '萃取SOP：会议纪要编写规范', quality_score: 5, status: 'completed' },
            { id: 'h3', date: '6月18日', day_of_week: '周三', sop_title: undefined, quality_score: undefined, status: 'skipped' },
          ]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const consecutiveDays = calcConsecutiveDays(history);
  const weekCompleted = calcWeekCompletion(weekly);

  return (
    <div className="mp-mobile-page">
      {/* Header */}
      <header className="mp-mobile-page__header" style={{ height: 48 }}>
        <button className="mp-header-btn" onClick={() => navigate(-1)}>
          <Icon icon="mingcute:arrow-left-fill" style={{ fontSize: '24px' }} />
        </button>
        <span className="font-zcool" style={{ fontSize: '18px', fontWeight: 700, color: '#C03A39' }}>
          复盘历史
        </span>
        <div className="mp-header-spacer" />
      </header>

      {/* Content */}
      <main className="mp-main-scroll">
        <div className="mp-main-padding">
          {/* Brand */}
          <section className="mp-hero">
            <ReviewBrandHero />
          </section>

          {/* 统计概览卡片 */}
          <div className="mp-card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#C03A39' }}>{consecutiveDays}</div>
                <div style={{ fontSize: 12, color: '#999' }}>连续复盘天数</div>
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#FFB74D' }}>{weekCompleted}/7</div>
                <div style={{ fontSize: 12, color: '#999' }}>本周完成度</div>
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#333' }}>{history.length}</div>
                <div style={{ fontSize: 12, color: '#999' }}>总记录数</div>
              </div>
            </div>
          </div>

          {/* 本周进度 */}
          <WeeklyProgressDisplay
            weekly={weekly}
            loading={loading}
            compact
            consecutiveDays={consecutiveDays}
          />

          {/* 历史列表 */}
          <div>
            <h3 style={{
              fontSize: 17, fontWeight: 700, color: '#333', marginBottom: 16,
              fontFamily: "'ZCOOL XiaoWei', 'Noto Sans SC', serif",
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Icon icon="mingcute:clipboard-line" style={{ fontSize: '20px', color: '#D4A574' }} />
              历史复盘
            </h3>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#999', fontSize: 14 }}>加载中…</div>
            ) : history.length === 0 ? (
              <div className="mp-card" style={{ textAlign: 'center', padding: 32 }}>
                <Icon icon="mingcute:history-line" style={{ fontSize: '40px', color: '#ccc', marginBottom: 12 }} />
                <p style={{ fontSize: 14, color: '#999', margin: 0 }}>暂无历史复盘记录</p>
                <p style={{ fontSize: 12, color: '#ccc', marginTop: 4 }}>开始你的第一次复盘吧</p>
              </div>
            ) : (
              history.map((item) => (
                <HistoryCard
                  key={item.id}
                  item={item}
                  onClick={() => navigate('/m/evening-review/report?id=' + item.id)}
                />
              ))
            )}
          </div>

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: 16 }}>
            <button className="mp-btn-outline" onClick={() => navigate('/m/evening-review/home')}>
              返回首页
            </button>
            <button className="mp-btn-primary" onClick={() => navigate('/m/evening-review/chat')}>
              开始复盘
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
