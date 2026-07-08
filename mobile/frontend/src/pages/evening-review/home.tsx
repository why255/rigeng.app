/**
 * P1 今日复盘看板 — 概览 + 昨日摘要（对齐 m2-p1-mobile.html）。
 * Route: /m/evening-review/home
 *
 * 使用 mp-* BEM 类名（来自 morning-plan.css）+ 内联 style。
 * 无 Tailwind CSS。
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import * as reviewsApi from '@/shared/api/reviews';
import type { YesterdayReviewSummary } from '@/shared/api/reviews';
import {
  ReviewBrandHero,
  ReviewStatsCard,
  YesterdaySummaryCard,
  MODULE_NAME,
} from '@/shared/components/features/evening-review';
import '../morning-plan/morning-plan.css';

export function EveningReviewHome() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<{
    total_tasks: number;
    completed_tasks: number;
    completion_rate: number;
    sop_count: number;
    courage_value: number;
  } | null>(null);
  const [yesterday, setYesterday] = useState<YesterdayReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const s = await reviewsApi.fetchTodayReviewStats();
        if (!cancelled) setStats(s);
      } catch {
        if (!cancelled) {
          setStats({ total_tasks: 0, completed_tasks: 0, completion_rate: 0, sop_count: 0, courage_value: 0 });
        }
      }
      try {
        const y = await reviewsApi.fetchYesterdayReviewSummary();
        if (!cancelled) setYesterday(y);
      } catch {
        if (!cancelled) setYesterday(null);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  /** 转换为 ReviewStats 类型 */
  const reviewStats = stats ? {
    total_tasks: stats.total_tasks,
    completed_tasks: stats.completed_tasks,
    completion_rate: stats.completion_rate,
    sop_count: stats.sop_count,
    courage_value: stats.courage_value,
  } : null;

  return (
    <div className="mp-mobile-page">
      {/* ===== Header ===== */}
      <header className="mp-mobile-page__header" style={{ height: 48 }}>
        <button className="mp-header-btn" onClick={() => navigate(-1)}>
          <Icon icon="mingcute:arrow-left-fill" style={{ fontSize: '24px' }} />
        </button>
        <span className="font-zcool" style={{ fontSize: '18px', fontWeight: 700, color: '#C03A39' }}>
          {MODULE_NAME}
        </span>
        <div className="mp-header-spacer" />
      </header>

      {/* ===== Content ===== */}
      <main className="mp-main-scroll">
        <div className="mp-main-padding">
          {/* 品牌区 */}
          <section className="mp-hero">
            <ReviewBrandHero titleSize={26} />
          </section>

          {/* 今日复盘卡片 */}
          <ReviewStatsCard
            stats={reviewStats}
            loading={loading}
            onStartReview={() => navigate('/m/evening-review/chat')}
          />

          {/* 昨日复盘摘要 */}
          <YesterdaySummaryCard
            yesterday={yesterday}
            loading={loading}
            onViewReport={() => navigate('/m/evening-review/report')}
          />
        </div>
      </main>
    </div>
  );
}
