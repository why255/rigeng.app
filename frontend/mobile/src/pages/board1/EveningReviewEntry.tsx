/**
 * P1 入口页 — 今日复盘概览 + 开始复盘入口。
 * Route: /m/evening-review
 * 对齐 m2-p1.html 设计
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnlineStatus } from '@rigeng/shared/hooks/useOnlineStatus';
import * as reviewsApi from '@rigeng/shared/api/reviews';
import type { ReviewStats, YesterdayReviewSummary } from '@rigeng/shared/api/reviews';
import './evening-review.css';

export function EveningReviewEntry() {
  const navigate = useNavigate();
  const { isOnline } = useOnlineStatus();
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [yesterday, setYesterday] = useState<YesterdayReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (isOnline) {
          const [s, y] = await Promise.all([
            reviewsApi.fetchTodayReviewStats(),
            reviewsApi.fetchYesterdayReviewSummary(),
          ]);
          if (!cancelled) { setStats(s); setYesterday(y); }
        } else {
          if (!cancelled) {
            setStats({ total_tasks: 0, completed_tasks: 0, completion_rate: 0, sop_count: 0, courage_value: 0 });
            setYesterday(null);
          }
        }
      } catch {
        if (!cancelled) {
          setError('加载失败，请稍后重试');
          // 不设置假零值 —— 让渲染层区分「加载失败」与「暂无数据」
          setYesterday(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [isOnline]);

  const completionText = stats ? `${stats.completed_tasks}/${stats.total_tasks}` : '0/0';
  const completionPercent = stats?.total_tasks ? Math.round((stats.completed_tasks / stats.total_tasks) * 100) : 0;
  const sopCount = stats?.sop_count ?? 0;
  const courageValue = stats?.courage_value ?? 0;

  return (
    <div data-module="evening-review">
      {/* 离线横幅 */}
      {!isOnline && (
        <div className="er-offline-banner">
          <span>⚠️</span>
          <span>当前处于离线模式，部分数据可能不是最新</span>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="er-offline-banner" style={{ background: '#FFF0F0', borderColor: '#FCC', color: '#C03A39' }}>
          <span>❌</span>
          <span>{error}</span>
          <button
            onClick={() => window.location.reload()}
            style={{ marginLeft: 'auto', fontSize: 12, color: '#C03A39', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            重试
          </button>
        </div>
      )}

      <div className="er-page">
        {/* 品牌标语区 */}
        <section className="er-hero">
          <div className="er-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</div>
          <div className="er-hero__divider" />
          <h1 className="er-hero__title">睡前做复盘，经验变方法</h1>
        </section>

        {/* 今日复盘卡片 */}
        <div className="er-card">
          <div className="er-card__header">
            <span className="er-card__header-icon">📋</span>
            <h2 className="er-card__header-title">今日复盘</h2>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>加载中…</div>
          ) : error && !stats ? (
            /* API 调用失败且无缓存数据 */
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
              <p style={{ marginBottom: 8, fontSize: 15 }}>😕 暂时无法获取今日数据</p>
              <p style={{ fontSize: 13, color: '#bbb' }}>请检查网络连接后刷新重试</p>
            </div>
          ) : stats && stats.total_tasks === 0 ? (
            /* API 成功但今日没有计划数据 */
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
              <p style={{ marginBottom: 8, fontSize: 15 }}>📋 今日暂无计划</p>
              <p style={{ fontSize: 13, color: '#bbb' }}>先去「朝有规划」安排今日任务吧</p>
            </div>
          ) : stats ? (
            /* 有真实数据 */
            <>
              {/* 完成事项 */}
              <div className="er-metric">
                <span className="er-metric__label">今日完成事项</span>
                <span className="er-metric__value">{completionText}</span>
              </div>
              <div className="er-progress" style={{ marginBottom: 12 }}>
                <div
                  className="er-progress__fill er-progress__fill--orange"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>

              {/* 萃取SOP */}
              <div className="er-metric">
                <span className="er-metric__label">萃取SOP</span>
                <span className="er-metric__value er-metric__value--accent">
                  {sopCount > 0 ? `${sopCount}条` : '暂无'}
                </span>
              </div>

              {/* 勇气值 */}
              <div className="er-metric">
                <span className="er-metric__label">今日勇气值</span>
                <span className="er-metric__value er-metric__value--brand">
                  {courageValue > 0 ? `${courageValue}/100` : '待复盘'}
                </span>
              </div>
              <div className="er-progress" style={{ marginBottom: 4 }}>
                <div
                  className="er-progress__fill er-progress__fill--brand"
                  style={{ width: `${Math.max(Math.min(courageValue, 100), 2)}%` }}
                />
              </div>
            </>
          ) : null}
        </div>

        {/* 开始复盘按钮 */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <button
            className="er-btn-primary"
            onClick={() => navigate('/m/evening-review/chat')}
            disabled={loading}
          >
            开始复盘
          </button>
        </div>

        {/* 昨日复盘摘要 */}
        {!loading && yesterday && (
          <div className="er-card er-card--compact">
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#999', marginBottom: 12 }}>
              📄 昨日复盘摘要
            </h3>
            <div className="er-yesterday-summary">
              <div className="er-yesterday-summary__info">
                <div className="er-yesterday-summary__title">
                  萃取SOP：{yesterday.sop_title}
                </div>
                <div className="er-yesterday-summary__meta">
                  完成率 {yesterday.completion_rate} · 勇气值 {yesterday.courage_value}
                </div>
              </div>
              {yesterday.archived && (
                <span className="er-yesterday-summary__badge">已归档</span>
              )}
            </div>
          </div>
        )}

        {/* 空状态：无昨日数据 */}
        {!loading && !yesterday && isOnline && (
          <div style={{ textAlign: 'center', color: '#999', padding: '16px 0', fontSize: 13 }}>
            暂无昨日复盘记录
          </div>
        )}

        {/* 快捷链接 */}
        <div style={{ textAlign: 'center', paddingTop: 8 }}>
          <a
            className="er-nav-link"
            href="#"
            onClick={(e) => { e.preventDefault(); navigate('/m/evening-review/history'); }}
          >
            查看历史复盘 →
          </a>
        </div>
      </div>
    </div>
  );
}
