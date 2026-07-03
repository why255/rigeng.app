/**
 * P4 完成页 — 庆祝动画 + 统计总结。
 * Route: /m/morning-plan/complete
 * 对齐 m1-p4.html 设计。
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { CelebrationOverlay } from '@rigeng/shared/components/plan/CelebrationOverlay';
import { useMorningPlan } from '@rigeng/shared/context/MorningPlanContext';
import './morning-plan.css';

export function MorningPlanComplete() {
  const navigate = useNavigate();
  const { getStats, plans } = useMorningPlan();
  const stats = getStats();

  // 无数据时返回首页
  useEffect(() => {
    if (plans.length === 0) {
      navigate('/m/morning-plan/home', { replace: true });
    }
  }, [plans.length, navigate]);

  return (
    <div className="mp-mobile-page">
      <CelebrationOverlay />

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
          完成
        </span>
        <div className="w-10" />
      </header>

      {/* 内容区 */}
      <main className="flex-1 overflow-y-auto px-4 py-6 text-center">
        {/* 品牌标语 */}
        <div className="mp-hero">
          <div className="mp-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</div>
          <p className="mp-hero__title mb-4">晨起做规划，整日不慌忙</p>
        </div>

        {/* 庆祝动画区 */}
        <div className="mp-celebration">
          <div className="z-10 space-y-2">
            <h2 className="text-4xl celebrate-bounce"
              style={{ fontFamily: `'ZCOOL XiaoWei', '华文楷体', 'KaiTi', serif` }}>
              🎉
            </h2>
            <h2 className="text-[28px] font-bold text-[#D4A574]"
              style={{ fontFamily: `'ZCOOL XiaoWei', '华文楷体', 'KaiTi', serif` }}>
              太棒了！全部完成！
            </h2>
            <p className="text-sm text-gray-500">
              今日完成 {stats.completed} 项计划，收获满满 ✨
            </p>
          </div>
        </div>

        {/* 完成总结卡片 */}
        <div className="mp-card max-w-sm mx-auto">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-[#F0FFF4] rounded-full flex items-center justify-center">
              <Icon icon="solar:check-circle-bold" className="text-4xl text-[#22C55E]" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-xl font-bold text-[#333] stat-number">{stats.total}</div>
              <div className="text-[10px] text-[#999]">总任务</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-[#333] stat-number">{stats.completed}</div>
              <div className="text-[10px] text-[#999]">已确认</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-[#333] stat-number">{stats.rate}%</div>
              <div className="text-[10px] text-[#999]">完成率</div>
            </div>
          </div>
        </div>

        {/* 回到首页按钮 */}
        <div className="mt-8 max-w-sm mx-auto">
          <button
            className="mp-btn-primary"
            onClick={() => navigate('/m/morning-plan/home')}
          >
            回到首页
          </button>
        </div>
      </main>
    </div>
  );
}
