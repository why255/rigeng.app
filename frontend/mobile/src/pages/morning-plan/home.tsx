/**
 * P1 入口主页 — 今日概览 + 待办事项。
 * Route: /m/morning-plan/home
 * 对齐 m1-p1.html 设计。
 * 注意：在新流程中这不是真正的「入口」—用户从 P3「确认今日计划」后到达这里。
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useMorningPlan } from '@rigeng/shared/context/MorningPlanContext';
import { ConfirmDialog } from '@/components/morning-plan/ConfirmDialog';
import {
  QUADRANT_SHORT_LABELS,
  QUADRANT_COLORS,
  sortPlansByUrgency,
} from '@rigeng/shared/utils/quadrantMapping';
import './morning-plan.css';

export function MorningPlanHome() {
  const navigate = useNavigate();
  const { plans, getStats, completePlan } = useMorningPlan();
  const stats = getStats();

  const [confirming, setConfirming] = useState<string | null>(null); // 正在确认的 plan id

  // 所有计划完成后自动跳转
  useEffect(() => {
    if (stats.total > 0 && stats.pending === 0) {
      const timer = setTimeout(() => {
        navigate('/m/morning-plan/complete', { replace: true });
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [stats.total, stats.pending, navigate]);

  // 待办事项（未完成）按紧急程度排序
  const pendingPlans = sortPlansByUrgency(
    plans.filter((p) => !p.completed),
  );

  const handleCompleteConfirm = () => {
    if (confirming) {
      completePlan(confirming);
      setConfirming(null);
    }
  };

  return (
    <div className="mp-mobile-page">
      {/* 顶部栏 */}
      <header className="mp-mobile-page__header">
        <button
          className="w-10 h-10 flex items-center justify-center text-gray-600"
          onClick={() => navigate(-1)}
        >
          <Icon icon="solar:alt-arrow-left-linear" className="text-2xl" />
        </button>
        <span className="text-lg font-bold text-[#C03A39]"
          style={{ fontFamily: "'ZCOOL XiaoWei', '华文楷体', 'KaiTi', serif" }}>
          朝有规划
        </span>
        <div className="w-10" />
      </header>

      {/* 内容区 */}
      <main className="flex-1 overflow-y-auto">
        <div className="px-4 py-6 space-y-4">

          {/* 品牌标语 */}
          <div className="mp-hero">
            <div className="mp-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</div>
          </div>

          {/* Slogan 卡片 */}
          <div className="mp-card text-center">
            <h1 className="text-2xl font-bold text-[#333]"
              style={{ fontFamily: "'ZCOOL XiaoWei', '华文楷体', 'KaiTi', serif" }}>
              晨起做规划，整日不慌忙
            </h1>
            <div className="mp-hero__divider w-2/3 mx-auto" />
            <p className="text-sm text-[#333]">日耕朝夕，耕愈工作，耕暖生活</p>
          </div>

          {/* 今日概览卡片 */}
          <div className="mp-card">
            {stats.total === 0 ? (
              /* 空状态 */
              <>
                <div className="mp-stats">
                  <div className="mp-stat">
                    <div className="mp-stat__number" style={{ color: '#999' }}>0</div>
                    <div className="mp-stat__label">今日任务</div>
                  </div>
                  <div className="mp-stat__divider" />
                  <div className="mp-stat">
                    <div className="mp-stat__number" style={{ color: '#999' }}>0%</div>
                    <div className="mp-stat__label">完成率</div>
                  </div>
                  <div className="mp-stat__divider" />
                  <div className="mp-stat">
                    <div className="mp-stat__number" style={{ color: '#999' }}>0</div>
                    <div className="mp-stat__label">待处理</div>
                  </div>
                </div>
                <div className="text-center py-3">
                  <Icon icon="mingcute:sun-line" className="text-5xl text-[#D4A574] mb-2 empty-icon" />
                  <p className="text-sm text-[#666]">今日暂无计划</p>
                  <p className="text-xs text-[#999] mt-1">点击下方按钮，开始规划你的一天吧</p>
                </div>
                <button className="mp-btn-primary" onClick={() => navigate('/m/morning-plan/chat')}>
                  开始规划
                </button>
              </>
            ) : (
              /* 有数据 */
              <>
                <div className="mp-stats">
                  <div className="mp-stat">
                    <div className="mp-stat__number">{stats.total}</div>
                    <div className="mp-stat__label">今日任务</div>
                  </div>
                  <div className="mp-stat__divider" />
                  <div className="mp-stat">
                    <div className="mp-stat__number">{stats.rate}%</div>
                    <div className="mp-stat__label">完成率</div>
                  </div>
                  <div className="mp-stat__divider" />
                  <div className="mp-stat">
                    <div className="mp-stat__number">{stats.pending}</div>
                    <div className="mp-stat__label">待处理</div>
                  </div>
                </div>
                <div className="text-center py-1">
                  <p className="text-sm text-[#666]">
                    今日已有 {stats.total} 项计划
                  </p>
                  <p className="text-xs text-[#999] mt-1">
                    已完成 {stats.completed} 项，继续加油
                  </p>
                </div>
                <button className="mp-btn-outline mt-3" onClick={() => navigate('/m/morning-plan/chat')}>
                  继续规划
                </button>
              </>
            )}
          </div>

          {/* 待办事项卡片 */}
          <div className="mp-card">
            <div className="mp-card__header">
              <Icon icon="solar:list-bold" className="text-[#D4A574] text-lg" />
              <h3 className="mp-card__header-title">待办事项</h3>
            </div>

            {pendingPlans.length === 0 ? (
              <div className="text-center py-6">
                <Icon icon="mingcute:checkbox-empty-line" className="text-3xl text-[#D4A574] mb-2 empty-icon" />
                {stats.total === 0 ? (
                  <>
                    <p className="text-sm text-[#999]">暂无待办事项</p>
                    <p className="text-xs text-[#999] mt-1">开始新一天的规划吧</p>
                  </>
                ) : (
                  <p className="text-sm text-[#999]">🎉 所有计划已完成！</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {pendingPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="mp-todo-item"
                    onClick={() => setConfirming(plan.id)}
                  >
                    <span
                      className="mp-todo-item__badge"
                      style={{
                        background: `${QUADRANT_COLORS[plan.quadrant]}15`,
                        color: QUADRANT_COLORS[plan.quadrant],
                      }}
                    >
                      {QUADRANT_SHORT_LABELS[plan.quadrant]}
                    </span>
                    <span className="mp-todo-item__text">{plan.text}</span>
                    <Icon icon="mingcute:arrow-right-line" className="text-[#ccc] text-sm flex-shrink-0 ml-2" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 完成确认弹窗 */}
      {confirming && (
        <ConfirmDialog
          open={true}
          title="确认完成"
          message="是否确认完成该计划？"
          confirmText="确认"
          cancelText="取消"
          onConfirm={handleCompleteConfirm}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}
