/**
 * P4 复盘历史页 — 本周进度 + 历史列表。
 * Route: /m/evening-review/history
 * 对齐 m2-p4.html 设计
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import * as reviewsApi from '@rigeng/shared/api/reviews';
import type { WeeklyProgress, ReviewHistoryItem } from '@rigeng/shared/api/reviews';
import './evening-review.css';

const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function StarRating({ score, max = 5 }: { score?: number; max?: number }) {
  if (score === undefined || score === null) return null;
  return (
    <div className="er-history-item__stars">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < score ? 'er-star--filled' : 'er-star--empty'}>
          {i < score ? '★' : '☆'}
        </span>
      ))}
      <span className="er-history-item__stars-label">复盘质量</span>
    </div>
  );
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
          // 使用示例数据
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
                day: WEEKDAY_LABELS[i],
                day_index: i,
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

  return (
    <div data-module="evening-review">
      <div className="er-page">
        {/* 品牌标语区 */}
        <section className="er-hero">
          <div className="er-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</div>
          <div className="er-hero__divider" />
          <h1 className="er-hero__title--small">睡前做复盘，经验变方法</h1>
        </section>

        {/* 本周复盘进度卡片 */}
        <div className="er-card">
          <div className="er-card__header">
            <span className="er-card__header-icon" style={{ color: '#FFB74D' }}>📅</span>
            <h2 className="er-card__header-title">本周复盘进度</h2>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>加载中…</div>
          ) : weekly ? (
            <>
              {/* PC端：甘特条形图 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {weekly.days.map((d) => (
                  <div key={d.day} className="er-week-row">
                    <span className="er-week-row__day">{d.day}</span>
                    <div className="er-week-row__bar">
                      {d.status === 'completed' && d.completion_rate ? (
                        <div
                          className="er-week-row__bar-fill"
                          style={{ width: `${d.completion_rate}%` }}
                        >
                          {d.completion_rate >= 80 ? '复盘完成' : ''}
                        </div>
                      ) : d.status === 'in_progress' && d.completion_rate ? (
                        <div
                          className="er-week-row__bar-fill"
                          style={{ width: `${d.completion_rate}%` }}
                        />
                      ) : null}
                    </div>
                    <span
                      className={`er-week-row__status ${
                        d.status === 'completed'
                          ? 'er-week-row__status--completed'
                          : d.status === 'in_progress'
                            ? 'er-week-row__status--in-progress'
                            : 'er-week-row__status--pending'
                      }`}
                    >
                      {d.status === 'completed' ? '✓' : d.status === 'in_progress' ? '进行中' : '待复盘'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', color: '#999', padding: '16px 0' }}>
              暂无本周数据
            </div>
          )}
        </div>

        {/* 历史复盘列表 */}
        <div>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#333', marginBottom: 16, fontFamily: "'ZCOOL XiaoWei', 'Noto Sans SC', serif" }}>
            📋 历史复盘
          </h3>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>加载中…</div>
          ) : history.length === 0 ? (
            <div className="er-card" style={{ textAlign: 'center', color: '#999', padding: '32px' }}>
              暂无历史复盘记录，开始你的第一次复盘吧 ✨
            </div>
          ) : (
            history.map((item) => (
              <div key={item.id} className="er-history-item">
                <div className="er-history-item__header">
                  <span className="er-history-item__date">
                    {item.date} {item.day_of_week}
                  </span>
                  <span
                    className={`er-history-item__status ${
                      item.status === 'completed'
                        ? 'er-history-item__status--completed'
                        : 'er-history-item__status--skipped'
                    }`}
                  >
                    {item.status === 'completed' ? '✓ 已完成' : '✗ 未复盘'}
                  </span>
                </div>

                {item.status === 'completed' && item.sop_title ? (
                  <>
                    <div className="er-history-item__title">{item.sop_title}</div>
                    <StarRating score={item.quality_score} />
                  </>
                ) : (
                  <div className="er-history-item__title er-history-item__title--empty">
                    当天未完成复盘
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* 操作按钮 */}
        <div className="er-actions">
          <button className="er-btn-secondary" onClick={() => navigate('/m/evening-review')}>
            返回首页
          </button>
          <button className="er-btn-primary" onClick={() => navigate('/m/evening-review/chat')}>
            开始复盘
          </button>
        </div>
      </div>
    </div>
  );
}
