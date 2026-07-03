/**
 * P4 完成确认页 — 庆祝动画 + 统计总结。
 * Route: /m/morning-plan/complete
 * 对齐 m1-p4.html 设计。
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { CelebrationOverlay } from '@rigeng/shared/components/plan/CelebrationOverlay';
import { useMorningPlan } from './MorningPlanContext';
import './morning-plan.css';

export function MorningPlanComplete() {
  const navigate = useNavigate();
  const { totalTasks, completedTasks, completionRate, reset } = useMorningPlan();
  const [showToast, setShowToast] = useState(true);

  // 无数据时自动跳转回入口页（对齐 p4.html）
  useEffect(() => {
    if (totalTasks === 0) {
      navigate('/m/morning-plan', { replace: true });
    }
  }, [totalTasks, navigate]);

  // Toast 自动消失
  useEffect(() => {
    const t = setTimeout(() => setShowToast(false), 3000);
    return () => clearTimeout(t);
  }, []);

  // ── 根据完成率调整庆祝强度 ──
  let mainEmoji: string;
  let mainMessage: string;
  let subMessage: string;
  let toastText: string;

  if (completionRate === 100) {
    mainEmoji = '🎉';
    mainMessage = '太棒了！全部完成！';
    subMessage = `今日完成 ${completedTasks} 项计划，收获满满 ✨`;
    toastText = '🎊 今日计划已全部完成！';
  } else if (completionRate >= 80) {
    mainEmoji = '💪';
    mainMessage = '非常不错，继续加油！';
    subMessage = `已完成 ${completedTasks}/${totalTasks} 项，完成率 ${completionRate}%`;
    toastText = `📈 已完成 ${completedTasks}/${totalTasks} 项`;
  } else {
    mainEmoji = '🌱';
    mainMessage = '好的开始是成功的一半';
    subMessage = `已完成 ${completedTasks}/${totalTasks} 项，继续加油 💪`;
    toastText = `📋 已完成 ${completedTasks}/${totalTasks} 项`;
  }

  const handleGoHome = () => {
    reset();
    navigate('/m/morning-plan');
  };

  // 无数据时不渲染（useEffect 会处理跳转）
  if (totalTasks === 0) return null;

  return (
    <div data-module="morning-plan" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* 庆祝花瓣 + 星星动画 */}
      <CelebrationOverlay />

      {/* Toast 提示 */}
      {showToast && (
        <div className="mp-toast">
          <Icon icon="mingcute:cloud-upload-line" width={20} />
          <span>{toastText}</span>
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
          <div className="mp-celebration-hero__title">{mainEmoji}</div>
          <div style={{ fontSize: 24, fontFamily: "'ZCOOL XiaoWei', 'Noto Sans SC', serif", fontWeight: 700, color: '#333', letterSpacing: '0.05em', marginBottom: 8 }}>
            {mainMessage}
          </div>
          <div className="mp-celebration-hero__sub" style={{ fontSize: 14, color: '#999' }}>{subMessage}</div>
        </div>

        {/* 统计卡片 */}
        <div className="mp-celebration-card">
          <div className="mp-celebration-card__header">
            <span className="mp-celebration-card__icon"><Icon icon="mingcute:celebrate-line" width={24} color="#D4A574" /></span>
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
          <button className="mp-btn-primary" onClick={handleGoHome}>
            回到首页
          </button>
        </div>
      </div>
    </div>
  );
}
