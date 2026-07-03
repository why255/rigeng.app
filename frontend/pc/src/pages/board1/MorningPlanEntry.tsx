/**
 * P1 入口页 — 今日概览 + 待办事项。
 * Route: /m/morning-plan
 * 对齐 m1-p1.html 设计。
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useOnlineStatus } from '@rigeng/shared/hooks/useOnlineStatus';
import { useMorningPlan } from './MorningPlanContext';
import * as plansApi from '@rigeng/shared/api/plans';
import type { TodayOverview, TaskList } from '@rigeng/shared/api/plans';
import './morning-plan.css';

export function MorningPlanEntry() {
  const navigate = useNavigate();
  const { isOnline } = useOnlineStatus();
  const { totalTasks, completedTasks, completionRate, plans } = useMorningPlan();

  const [stats, setStats] = useState<TodayOverview | null>(null);
  const [yesterday, setYesterday] = useState<TaskList | null>(null);
  const [syncTasks, setSyncTasks] = useState<TaskList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (isOnline) {
          const [s, y, t] = await Promise.all([
            plansApi.fetchStats(),
            plansApi.fetchYesterdayUnfinished(),
            plansApi.fetchSmartRecordSync(),
          ]);
          if (!cancelled) { setStats(s); setYesterday(y); setSyncTasks(t); }
        } else {
          if (!cancelled) { setStats(null); setYesterday(null); setSyncTasks(null); }
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : '加载失败，请检查网络后重试';
          setError(msg);
          setStats(null);
          setYesterday(null);
          setSyncTasks(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [isOnline]);

  // 优先使用 API 数据，其次使用本地 context 数据
  const taskCount = stats?.task_count ?? totalTasks;
  const displayRate = stats?.completion_rate ?? completionRate;
  const pendingCount = stats?.pending_count ?? (totalTasks - completedTasks);

  const hasApiData = stats && stats.task_count > 0;
  const hasLocalData = totalTasks > 0;
  const hasAnyData = hasApiData || hasLocalData;

  return (
    <div data-module="morning-plan">
      {/* 离线横幅 */}
      {!isOnline && (
        <div className="mp-offline-banner">
          <span>⚠️</span>
          <span>部分高级功能暂不可用，基础规划可以正常进行</span>
          <button
            onClick={() => navigate('/m/morning-plan/offline')}
            style={{ marginLeft: 'auto', fontSize: 12, color: '#E65100', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            查看详情
          </button>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="mp-offline-banner" style={{ background: '#FFF0F0', borderColor: '#FCC', color: '#C03A39' }}>
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

      <div className="mp-page">
        {/* 品牌Slogan */}
        <section className="mp-hero">
          <div className="mp-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</div>
          <div className="mp-hero__divider" />
          <h2 className="mp-hero__title">晨起做规划，整日不慌忙</h2>
        </section>

        {/* 今日概览卡片 */}
        <div className="mp-card">
          <div className="mp-card__header">
            <span className="mp-card__header-icon"><Icon icon="mingcute:chart-line" width={24} color="#D4A574" /></span>
            <h3 className="mp-card__header-title">今日概览</h3>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>加载中…</div>
          ) : (
            <>
              {/* 统计数字 — 始终显示 */}
              <div className="mp-stats">
                <div className="mp-stat">
                  <div className="mp-stat__number">{taskCount}</div>
                  <div className="mp-stat__label">今日任务</div>
                </div>
                <div className="mp-stat">
                  <div className="mp-stat__number mp-stat__number--accent">{displayRate}%</div>
                  <div className="mp-stat__label">完成率</div>
                </div>
                <div className="mp-stat">
                  <div className="mp-stat__number mp-stat__number--gold">{pendingCount}</div>
                  <div className="mp-stat__label">待处理</div>
                </div>
              </div>

              {/* 空状态引导 — 对齐 p1.html */}
              {!hasAnyData && !error && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 0 24px' }}>
                  <div style={{ color: '#D4A574', marginBottom: 12, opacity: 0.6 }}><Icon icon="mingcute:sun-line" width={40} /></div>
                  <p style={{ fontSize: 14, color: '#666', margin: '0 0 4px' }}>今日暂无计划</p>
                  <p style={{ fontSize: 12, color: '#999', margin: 0 }}>点击下方按钮，开始规划你的一天吧</p>
                </div>
              )}
            </>
          )}

          {/* 开始规划按钮 — 始终可见（除加载中） */}
          {!loading && (
            <button
              className="mp-btn-primary"
              onClick={() => navigate('/m/morning-plan/chat')}
            >
              开始规划
            </button>
          )}
        </div>

        {/* 待办事项卡片 */}
        <div className="mp-card">
          <div className="mp-card__header">
            <span className="mp-card__header-icon"><Icon icon="mingcute:clipboard-line" width={24} color="#D4A574" /></span>
            <h3 className="mp-card__header-title">待办事项</h3>
          </div>

          {/* 本地计划（从上下文） */}
          {hasLocalData && (
            <div className="mp-todo-section">
              <div className="mp-todo-section__title">今日计划</div>
              {plans.filter(p => !p.completed).slice(0, 5).map((p) => (
                <div key={p.id} className="mp-todo-item mp-todo-item--sync">
                  <span className="mp-todo-item__badge mp-todo-item__badge--sync">待完成</span>
                  <span className="mp-todo-item__text">{p.text}</span>
                </div>
              ))}
              {totalTasks - completedTasks > 5 && (
                <div style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: '4px 0' }}>
                  还有 {totalTasks - completedTasks - 5} 项…
                </div>
              )}
            </div>
          )}

          {/* 昨日未完成（API） */}
          {yesterday && yesterday.tasks.length > 0 && (
            <div className="mp-todo-section">
              <div className="mp-todo-section__title">昨日未完成</div>
              {yesterday.tasks.map((t) => (
                <div key={t.id} className="mp-todo-item mp-todo-item--yesterday">
                  <span className="mp-todo-item__badge mp-todo-item__badge--yesterday">昨日未完成</span>
                  <span className="mp-todo-item__text">{t.title}</span>
                </div>
              ))}
            </div>
          )}

          {/* 智能记录同步（API） */}
          {syncTasks && syncTasks.tasks.length > 0 && (
            <div className="mp-todo-section">
              <div className="mp-todo-section__title">智能记录同步</div>
              {syncTasks.tasks.map((t) => (
                <div key={t.id} className="mp-todo-item mp-todo-item--sync">
                  <span className="mp-todo-item__badge mp-todo-item__badge--sync">智能记录同步</span>
                  <span className="mp-todo-item__text">{t.title}</span>
                </div>
              ))}
            </div>
          )}

          {/* 完全空状态 */}
          {!hasLocalData &&
            (!yesterday || yesterday.tasks.length === 0) &&
            (!syncTasks || syncTasks.tasks.length === 0) &&
            !loading && (
              <div style={{ textAlign: 'center', color: '#999', padding: '32px 0' }}>
                <div style={{ opacity: 0.4, marginBottom: 8 }}><Icon icon="mingcute:checkbox-empty-line" width={32} color="#D4A574" /></div>
                <p style={{ fontSize: 14, margin: 0 }}>暂无待办事项</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>开始新一天的规划吧</p>
              </div>
            )}
        </div>

        {/* 快捷链接 + 语音按钮 */}
        <div style={{ textAlign: 'center', paddingTop: 8 }}>
          <a
            className="mp-nav-link"
            href="#"
            onClick={(e) => { e.preventDefault(); navigate('/m/evening-review'); }}
          >
            跳转至暮有复盘
          </a>
        </div>

        <div className="mp-voice-float">
          <button
            className="mp-voice-btn"
            aria-label="语音唤醒小耕"
            title="语音输入"
            onClick={() => navigate('/m/morning-plan/chat?voice=1')}
          >
            <Icon icon="mingcute:mic-line" width={20} style={{ color: '#fff' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
