/**
 * P1 入口页 — 今日概览 + 待办事项。
 * Route: /m/morning-plan
 * 对齐 m1-p1.html 设计（提取 body 内 main 内容区）
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnlineStatus } from '@rigeng/shared/hooks/useOnlineStatus';
import * as plansApi from '@rigeng/shared/api/plans';
import type { TodayOverview, TaskList } from '@rigeng/shared/api/plans';
import './morning-plan.css';

export function MorningPlanEntry() {
  const navigate = useNavigate();
  const { isOnline } = useOnlineStatus();
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
          // 离线模式：使用本地缓存或空数据
          if (!cancelled) {
            setStats(null);
            setYesterday(null);
            setSyncTasks(null);
          }
        }
      } catch (e) {
        if (!cancelled) {
          // 区分「网络错误」和「业务错误」，保留 stats 为 null 以触发空状态
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

  const taskCount = stats?.task_count ?? 0;
  const completionRate = stats?.completion_rate ?? 0;
  const pendingCount = stats?.pending_count ?? 0;

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
        {/* 24d 品牌Slogan展示位 */}
        <section className="mp-hero">
          <div className="mp-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</div>
          <div className="mp-hero__divider" />
          <h2 className="mp-hero__title">晨起做规划，整日不慌忙</h2>
        </section>

        {/* 今日概览卡片 */}
        <div className="mp-card">
          <div className="mp-card__header">
            <span className="mp-card__header-icon">📊</span>
            <h3 className="mp-card__header-title">今日概览</h3>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>加载中…</div>
          ) : error ? (
            /* API 调用失败 */
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
              <p style={{ marginBottom: 8, fontSize: 15 }}>😕 暂时无法获取今日数据</p>
              <p style={{ fontSize: 13, color: '#bbb' }}>请检查网络连接后刷新重试</p>
            </div>
          ) : !stats ? (
            /* 离线且无本地缓存 */
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
              <p style={{ marginBottom: 8, fontSize: 15 }}>📋 当前离线且无本地缓存</p>
              <p style={{ fontSize: 13, color: '#bbb' }}>联网后将自动加载今日数据</p>
            </div>
          ) : stats.task_count === 0 ? (
            /* API 成功但今日无计划数据 —— 空状态 */
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
              <p style={{ marginBottom: 8, fontSize: 15 }}>📋 今日暂无计划</p>
              <p style={{ fontSize: 13, color: '#bbb' }}>点击下方按钮，开始规划你的一天吧</p>
            </div>
          ) : (
            /* 有真实数据 */
            <>
              <div className="mp-stats">
                <div className="mp-stat">
                  <div className="mp-stat__number">{taskCount}</div>
                  <div className="mp-stat__label">今日任务</div>
                </div>
                <div className="mp-stat">
                  <div className="mp-stat__number mp-stat__number--accent">{completionRate}%</div>
                  <div className="mp-stat__label">完成率</div>
                </div>
                <div className="mp-stat">
                  <div className="mp-stat__number mp-stat__number--gold">{pendingCount}</div>
                  <div className="mp-stat__label">待处理</div>
                </div>
              </div>
            </>
          )}

          {/* 开始规划按钮：仅在有数据或明确为空状态时显示 */}
          {!loading && !error && (
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
            <span className="mp-card__header-icon">📋</span>
            <h3 className="mp-card__header-title">待办事项</h3>
          </div>

          {/* 昨日未完成 */}
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

          {/* 智能记录同步 */}
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

          {/* 空状态 */}
          {(!yesterday || yesterday.tasks.length === 0) &&
            (!syncTasks || syncTasks.tasks.length === 0) &&
            !loading && (
              <div style={{ textAlign: 'center', color: '#999', padding: '16px 0' }}>
                暂无待办事项，开始新一天的规划吧 ✨
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
            onClick={() => {
              navigate('/m/morning-plan/chat?voice=1');
            }}
          >
            🎤
          </button>
        </div>
      </div>
    </div>
  );
}
