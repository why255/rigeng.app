/**
 * P4 完成确认页 — 庆祝动画 + 统计总结。
 * Route: /m/morning-plan/complete
 * 对齐 m1-p4.html 设计。
 * 共享组件 PlanBrandHero, CelebrationOverlay 从 shared 引用。
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { CelebrationOverlay } from '@/shared/components/plan/CelebrationOverlay';
import { useMorningPlan } from './MorningPlanContext';
import { PlanBrandHero } from '@/shared/components/features/morning-plan';
import './morning-plan.css';

export function MorningPlanComplete() {
  const navigate = useNavigate();
  const { totalTasks, completedTasks, completionRate, reset } = useMorningPlan();
  const [showToast, setShowToast] = useState(true);

  useEffect(() => {
    if (totalTasks === 0) navigate('/m/morning-plan', { replace: true });
  }, [totalTasks, navigate]);

  useEffect(() => {
    const t = setTimeout(() => setShowToast(false), 3000);
    return () => clearTimeout(t);
  }, []);

  const content = (() => {
    if (completionRate === 100) return { icon: 'mingcute:celebrate-fill', title: '太棒了！全部完成！', sub: `今日完成 ${completedTasks} 项计划，收获满满` };
    if (completionRate >= 80) return { icon: 'mingcute:fire-fill', title: '非常不错，继续加油！', sub: `已完成 ${completedTasks}/${totalTasks} 项，完成率 ${completionRate}%` };
    return { icon: 'mingcute:seedling-fill', title: '好的开始是成功的一半', sub: `已完成 ${completedTasks}/${totalTasks} 项，继续加油` };
  })();

  const handleGoHome = () => { reset(); navigate('/m/morning-plan'); };
  if (totalTasks === 0) return null;

  return (
    <div data-module="morning-plan" style={{ position: 'relative', overflow: 'hidden' }}>
      <CelebrationOverlay />

      {showToast && (
        <div className="mp-toast">
          <Icon icon="mingcute:cloud-upload-line" width={20} />
          <span>{completionRate === 100 ? '今日计划已全部完成！' : `已完成 ${completedTasks}/${totalTasks} 项`}</span>
        </div>
      )}

      <div className="mp-page--centered" style={{ position: 'relative', zIndex: 10 }}>
        <PlanBrandHero />

        <div className="mp-celebration-hero">
          <div className="mp-celebration-hero__title">
            <Icon icon={content.icon} width={40} color="#D4A574" />
          </div>
          <div style={{ fontSize: 24, fontFamily: "'ZCOOL XiaoWei', 'Noto Sans SC', serif", fontWeight: 700, color: '#333', letterSpacing: '0.05em', marginBottom: 8 }}>{content.title}</div>
          <div className="mp-celebration-hero__sub" style={{ fontSize: 14, color: '#999' }}>{content.sub}</div>
        </div>

        <div className="mp-celebration-card">
          <div className="mp-celebration-card__header">
            <span className="mp-celebration-card__icon"><Icon icon="mingcute:celebrate-line" width={24} color="#D4A574" /></span>
            <h3 className="mp-celebration-card__title">今日计划已完成</h3>
          </div>
          <hr className="mp-celebration-card__divider" />
          <div className="mp-stats" style={{ marginBottom: 0 }}>
            <div className="mp-stat"><div className="mp-stat__number">{totalTasks}</div><div className="mp-stat__label">总任务</div></div>
            <div className="mp-stat"><div className="mp-stat__number mp-stat__number--accent">{completedTasks}</div><div className="mp-stat__label">已完成</div></div>
            <div className="mp-stat"><div className="mp-stat__number mp-stat__number--gold">{completionRate}%</div><div className="mp-stat__label">完成率</div></div>
          </div>
        </div>

        <div className="mp-actions mp-actions--vertical">
          <button className="mp-btn-primary" onClick={handleGoHome}>回到首页</button>
        </div>
      </div>
    </div>
  );
}
