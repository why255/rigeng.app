/**
 * P1 今日看板 — 概览 + 待办列表 + 任务完成闭环。
 * Route: /m/morning-plan/home
 * 对齐 m1p1 设计（数据驱动，去除空状态占位图）。
 */
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useMorningPlan } from '@rigeng/shared/context/MorningPlanContext';
import {
  sortPlansByUrgency,
  QUADRANT_SHORT_LABELS,
} from '@rigeng/shared/utils/quadrantMapping';
import { ConfirmDialog } from '@/components/morning-plan/ConfirmDialog';
import './morning-plan.css';

export function MorningPlanHome() {
  const navigate = useNavigate();
  const { plans, getStats, completePlan } = useMorningPlan();
  const stats = getStats();
  const hasPlans = plans.length > 0;

  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);

  // Sorted incomplete plans (by quadrant urgency: 重要紧急 > 重要不紧急 > 紧急不重要 > 不重要不紧急)
  const incompletePlans = useMemo(() => {
    return sortPlansByUrgency(plans.filter((p) => !p.completed));
  }, [plans]);

  // Completed plans for display
  const completedPlans = useMemo(() => {
    return plans.filter((p) => p.completed);
  }, [plans]);

  // Auto-redirect to P4 when all plans completed and at least one plan exists
  useEffect(() => {
    if (hasPlans && incompletePlans.length === 0) {
      navigate('/m/morning-plan/complete', { replace: true });
    }
  }, [incompletePlans.length, hasPlans, navigate]);

  const handleConfirmComplete = () => {
    if (confirmTarget) {
      completePlan(confirmTarget);
      setConfirmTarget(null);
    }
  };

  const targetPlan = confirmTarget ? plans.find((p) => p.id === confirmTarget) : null;

  return (
    <div className="mp-mobile-page">
      {/* ===== 顶部栏 ===== */}
      <header className="mp-mobile-page__header" style={{ height: 48 }}>
        <div className="mp-header-spacer" />
        <span
          className="mp-header-title"
          style={{ fontFamily: `'ZCOOL XiaoWei', '华文楷体', 'KaiTi', serif` }}
        >
          朝有规划
        </span>
        <button
          className="mp-header-btn"
          onClick={() => navigate('/m/morning-plan/settings')}
        >
          <Icon icon="mingcute:settings-3-fill" style={{ fontSize: '24px' }} />
        </button>
      </header>

      {/* ===== 内容区 ===== */}
      <main className="mp-main-scroll">
        <div className="mp-main-padding">

          {/* ===== 品牌区 ===== */}
          <section className="mp-hero">
            <p className="mp-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</p>
            <div className="mp-hero__divider" />
            <h1 className="mp-hero__title" style={{ fontSize: 26, letterSpacing: '0.1em' }}>
              晨起做规划，整日不慌忙
            </h1>
          </section>

          {/* ===== 今日概览卡片 ===== */}
          <div className="mp-card">
            <div className="mp-card__header">
              <Icon icon="mingcute:chart-line" style={{ fontSize: '24px', color: '#D4A574' }} />
              <h2 className="mp-card__header-title">今日概览</h2>
            </div>

            {/* 数据行 */}
            <div className="mp-stats">
              <div className="mp-stat">
                <div className="mp-stat__number" style={{ color: hasPlans ? '#333' : '#999' }}>
                  {stats.total}
                </div>
                <div className="mp-stat__label">今日任务</div>
              </div>
              <div className="mp-stat__divider" />
              <div className="mp-stat">
                <div className="mp-stat__number" style={{ color: hasPlans ? '#333' : '#999' }}>
                  {stats.rate}%
                </div>
                <div className="mp-stat__label">完成率</div>
              </div>
              <div className="mp-stat__divider" />
              <div className="mp-stat">
                <div className="mp-stat__number" style={{ color: hasPlans ? '#333' : '#999' }}>
                  {stats.pending}
                </div>
                <div className="mp-stat__label">待处理</div>
              </div>
            </div>

            {/* 进度条（有数据时） */}
            {hasPlans && (
              <div className="mp-done-state">
                <div className="mp-progress">
                  <div
                    className="mp-progress__fill"
                    style={{ width: `${stats.rate}%` }}
                  />
                </div>
                <p className="mp-done-state__text">
                  已完成 {stats.completed}/{stats.total} 项任务
                </p>
              </div>
            )}

            <button
              className="mp-btn-primary"
              onClick={() => navigate('/m/morning-plan/chat')}
              style={{ marginTop: hasPlans ? 12 : 0 }}
            >
              {hasPlans ? '继续规划' : '开始规划'}
            </button>
          </div>

          {/* ===== 待办事项卡片 ===== */}
          <div className="mp-card">
            <div className="mp-card__header">
              <Icon icon="mingcute:clipboard-line" style={{ fontSize: '24px', color: '#D4A574' }} />
              <h2 className="mp-card__header-title">待办事项</h2>
            </div>

            {!hasPlans ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <Icon
                  icon="mingcute:checkbox-empty-line"
                  style={{ fontSize: '32px', color: '#D4A574', opacity: 0.6, marginBottom: 12 }}
                />
                <p style={{ fontSize: 14, color: '#666', margin: '0 0 4px' }}>暂无待办事项</p>
                <p style={{ fontSize: 12, color: '#999', margin: 0 }}>开始新一天的规划吧</p>
              </div>
            ) : (
              <>
                {/* Incomplete tasks — sorted by quadrant urgency */}
                {incompletePlans.length > 0 && (
                  <div className="mp-todo-list">
                    {incompletePlans.map((plan) => (
                      <div
                        key={plan.id}
                        className="mp-todo-item"
                        onClick={() => setConfirmTarget(plan.id)}
                      >
                        <span className="mp-todo-item__badge mp-todo-item__badge--pending">
                          {QUADRANT_SHORT_LABELS[plan.quadrant]}
                        </span>
                        <span className="mp-todo-item__text">
                          {QUADRANT_SHORT_LABELS[plan.quadrant]}——{plan.text}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Completed tasks — show last 3 */}
                {completedPlans.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <p style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
                      已完成 ({completedPlans.length})
                    </p>
                    {completedPlans.slice(0, 3).map((plan) => (
                      <div key={plan.id} className="mp-todo-item" style={{ opacity: 0.6 }}>
                        <span className="mp-todo-item__badge mp-todo-item__badge--done">
                          完成
                        </span>
                        <span className="mp-todo-item__text" style={{ textDecoration: 'line-through', color: '#999' }}>
                          {QUADRANT_SHORT_LABELS[plan.quadrant]}——{plan.text}
                        </span>
                      </div>
                    ))}
                    {completedPlans.length > 3 && (
                      <p style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>
                        还有 {completedPlans.length - 3} 项已完成
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {/* 底部：跳转链接 */}
            <div className="mp-card-footer">
              <div className="mp-card-footer__inner">
                <a
                  className="mp-card-footer__link"
                  onClick={() => navigate('/m/evening-review')}
                >
                  跳转至暮有复盘
                </a>
                <span className="mp-card-footer__brand">日耕·暮省</span>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* ===== 浮动语音唤醒入口 ===== */}
      <div className="mp-voice-float">
        <button
          className="mp-voice-float__btn"
          onClick={() => navigate('/m/morning-plan/chat')}
        >
          <Icon icon="mingcute:mic-fill" className="mp-voice-float__icon" />
        </button>
      </div>

      {/* ===== 完成确认弹窗 ===== */}
      <ConfirmDialog
        open={!!confirmTarget}
        title="是否确认完成该计划？"
        message={targetPlan?.text ?? ''}
        confirmText="确认"
        cancelText="取消"
        onConfirm={handleConfirmComplete}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
