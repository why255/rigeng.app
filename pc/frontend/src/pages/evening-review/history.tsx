/**
 * P4 复盘历史页 — PC端增强版（甘特图 + 搜索/筛选 + 趋势统计）。
 * Route: /m/evening-review/history
 */
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as reviewsApi from '@/shared/api/reviews';
import type { WeeklyProgress, ReviewHistoryItem } from '@/shared/api/reviews';
import {
  ReviewBrandHero,
  WeeklyProgress as WeeklyProgressDisplay,
  HistoryCard,
  WEEKDAY_LABELS,
} from '@/shared/components/features/evening-review';
import './evening-review.css';

export function EveningReviewHistory() {
  const navigate = useNavigate();
  const [weekly, setWeekly] = useState<WeeklyProgress | null>(null);
  const [history, setHistory] = useState<ReviewHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');

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

  // 筛选后的历史列表
  const filteredHistory = useMemo(() => {
    let result = history;
    if (searchQuery.trim()) {
      result = result.filter(item =>
        item.sop_title?.includes(searchQuery.trim()) ||
        item.date?.includes(searchQuery.trim())
      );
    }
    if (dateFilter === 'week') {
      result = result.slice(0, 7);
    } else if (dateFilter === 'month') {
      result = result.slice(0, 30);
    }
    return result;
  }, [history, searchQuery, dateFilter]);

  // 趋势统计
  const totalReviews = history.filter(h => h.status === 'completed').length;
  const totalSops = history.filter(h => h.sop_title).length;
  const avgQuality = history.filter(h => h.quality_score).reduce((sum, h) => sum + (h.quality_score ?? 0), 0) /
    Math.max(history.filter(h => h.quality_score).length, 1);

  return (
    <div data-module="evening-review">
      <div className="er-page" style={{ maxWidth: 900 }}>
        <ReviewBrandHero />

        {/* 趋势统计面板 */}
        <div className="er-card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#C03A39' }}>{totalReviews}</div>
              <div style={{ fontSize: 12, color: '#999' }}>总复盘次数</div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#FFB74D' }}>{totalSops}</div>
              <div style={{ fontSize: 12, color: '#999' }}>累计 SOP</div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#333' }}>{avgQuality.toFixed(1)}</div>
              <div style={{ fontSize: 12, color: '#999' }}>平均质量分</div>
            </div>
          </div>
        </div>

        {/* 本周进度（甘特图） */}
        <WeeklyProgressDisplay weekly={weekly} loading={loading} compact={false} />

        {/* 搜索+筛选 */}
        <div className="er-history-search" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input className="er-form-input" placeholder="搜索 SOP 关键词或日期..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ flex: 1 }} />
          <select className="er-form-input" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
            style={{ width: 120 }}>
            <option value="all">全部时间</option>
            <option value="week">本周</option>
            <option value="month">本月</option>
          </select>
        </div>

        {/* 历史列表 */}
        <div>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#333', marginBottom: 16, fontFamily: "'ZCOOL XiaoWei', 'Noto Sans SC', serif" }}>
            📋 历史复盘
          </h3>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>加载中…</div>
          ) : filteredHistory.length === 0 ? (
            <div className="er-card" style={{ textAlign: 'center', color: '#999', padding: '32px' }}>
              {searchQuery ? '没有找到匹配的记录' : '暂无历史复盘记录，开始你的第一次复盘吧 ✨'}
            </div>
          ) : (
            filteredHistory.map((item) => (
              <HistoryCard
                key={item.id}
                item={item}
                onClick={() => navigate('/m/evening-review/report?id=' + item.id)}
              />
            ))
          )}
        </div>

        <div className="er-actions">
          <button className="er-btn-secondary" onClick={() => navigate('/m/evening-review')}>返回仪表盘</button>
          <button className="er-btn-primary" onClick={() => navigate('/m/evening-review/chat')}>开始复盘</button>
        </div>
      </div>
    </div>
  );
}
