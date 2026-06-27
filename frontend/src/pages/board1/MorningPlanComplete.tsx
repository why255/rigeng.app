/**
 * P4 完成确认页 — 庆祝动画 + 统计总结。
 * Route: /m/morning-plan/complete
 * 对齐 m1-p4.html 设计（提取 body 内 main 内容区）
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CelebrationOverlay } from '@/components/plan/CelebrationOverlay';
import { usePlanData } from '@/hooks/usePlanData';
import './morning-plan.css';

export function MorningPlanComplete() {
  const navigate = useNavigate();
  const { plan, stats, archivePlan } = usePlanData();
  const [showToast, setShowToast] = useState(true);

  useEffect(() => {
    if (plan) {
      archivePlan();
    }
    const t = setTimeout(() => setShowToast(false), 3000);
    return () => clearTimeout(t);
  }, [plan?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalTasks = plan?.stats?.total_tasks ?? stats?.task_count ?? 6;
  const completedTasks = plan?.stats?.completed_tasks ?? totalTasks;
  const completionRate = plan?.stats?.completion_rate ?? stats?.completion_rate ?? 100;

  return (
    <div data-module="morning-plan" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* 庆祝花瓣动画 */}
      <CelebrationOverlay />

      {/* Toast 提示 */}
      {showToast && (
        <div className="mp-toast">
          <span>☁️</span>
          <span>今日计划已归档</span>
        </div>
      )}

      <div className="mp-page--centered" style={{ position: 'relative', zIndex: 10 }}>
        {/* 品牌标语 */}
        <div style={{ marginBottom: 32 }}>
          <div className="mp-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</div>
          <div className="mp-hero__divider" />
          <p style={{ fontSize: 14, color: '#666', marginTop: 8 }}>晨起做规划，整日不慌忙</p>
        </div>

        {/* 庆祝主文 */}
        <div className="mp-celebration-hero">
          <div className="mp-celebration-hero__title">太棒了！</div>
          <div className="mp-celebration-hero__sub">今天的努力，明天的底气</div>
        </div>

        {/* 统计卡片 */}
        <div className="mp-celebration-card">
          <div className="mp-celebration-card__header">
            <span className="mp-celebration-card__icon">🎉</span>
            <h3 className="mp-celebration-card__title">今日计划已完成</h3>
          </div>
          <hr className="mp-celebration-card__divider" />
          <div className="mp-stats" style={{ marginBottom: 0 }}>
            <div className="mp-stat">
              <div className="mp-stat__number">{totalTasks}</div>
              <div className="mp-stat__label">总任务</div>
            </div>
            <div className="mp-stat">
              <div className="mp-stat__number mp-stat__number--accent">{completedTasks}</div>
              <div className="mp-stat__label">已完成</div>
            </div>
            <div className="mp-stat">
              <div className="mp-stat__number mp-stat__number--gold">{completionRate}%</div>
              <div className="mp-stat__label">完成率</div>
            </div>
          </div>
        </div>

        {/* 回到首页 */}
        <div className="mp-actions mp-actions--vertical">
          <button className="mp-btn-primary" onClick={() => navigate('/m/morning-plan')}>
            回到首页
          </button>
        </div>
      </div>
    </div>
  );
}
