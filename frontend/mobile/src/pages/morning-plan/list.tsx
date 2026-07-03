/**
 * P3 计划列表页 — 四象限矩阵 + 拖拽调整。
 * Route: /m/morning-plan/list
 * 对齐 m1-p3.html 设计。
 * 在新流程中，「确认今日计划」跳转到 P1(home)，而不是 P4(complete)。
 */
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useMorningPlan } from '@rigeng/shared/context/MorningPlanContext';
import { PlanQuadrantGrid } from '@/components/morning-plan/PlanQuadrantGrid';
import './morning-plan.css';

export function MorningPlanList() {
  const navigate = useNavigate();
  const { plans, confirmAll } = useMorningPlan();

  const total = plans.length;

  const handleConfirm = () => {
    if (plans.length === 0) {
      alert('还没有任何计划呢！先去对话页添加计划吧 📝');
      return;
    }
    // 确认计划（不标记为completed），跳转到 home 页
    confirmAll();
    navigate('/m/morning-plan/home');
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
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
        {/* 品牌标语 */}
        <div className="text-center mb-2">
          <div className="text-[15px] font-bold text-[#333]">日耕朝夕，耕愈工作，耕暖生活</div>
        </div>
        <div className="text-center mb-5">
          <p className="text-[17px] font-bold text-[#333]"
            style={{ fontFamily: "'ZCOOL XiaoWei', '华文楷体', 'KaiTi', serif" }}>
            晨起做规划，整日不慌忙
          </p>
        </div>

        {/* 进度条 */}
        <div className="bg-white rounded-xl p-4 mb-5 shadow-sm border border-gray-50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">今日计划完成率</span>
            <span className="text-sm font-bold text-[#C03A39]">0%</span>
          </div>
          <div className="mp-progress">
            <div className="mp-progress__fill" style={{ width: '0%' }} />
          </div>
          <div className="text-right mt-1">
            <span className="text-[10px] text-[#999]">
              {total === 0 ? '暂无计划' : `共 ${total} 项`}
            </span>
          </div>
        </div>

        {/* 四象限网格 */}
        <div className="mb-5">
          <PlanQuadrantGrid />
        </div>

        {/* 操作按钮 */}
        <div className="space-y-3">
          <button
            className="mp-btn-outline"
            onClick={() => navigate('/m/morning-plan/chat')}
          >
            继续规划
          </button>
          <button className="mp-btn-primary" onClick={handleConfirm}>
            确认今日计划
          </button>
        </div>
      </main>
    </div>
  );
}
