/**
 * P4 完成页 — 庆祝动画 + 今日计划完成统计。
 * Route: /m/morning-plan/complete
 * 对齐 m1p4 设计。
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useMorningPlan } from '@rigeng/shared/context/MorningPlanContext';
import { CelebrationOverlay } from '@rigeng/shared/components/plan/CelebrationOverlay';
import './morning-plan.css';

export function MorningPlanComplete() {
  const navigate = useNavigate();
  const { getStats, reset } = useMorningPlan();
  const stats = getStats();
  const [showToast, setShowToast] = useState(true);

  // Toast auto-dismiss after 3s
  useEffect(() => {
    const t = setTimeout(() => setShowToast(false), 3000);
    return () => clearTimeout(t);
  }, []);

  // Determine celebration message based on completion rate
  const getCelebrationContent = () => {
    if (stats.rate === 100) {
      return {
        icon: 'mingcute:celebrate-fill',
        title: '太棒了！全部完成！',
        sub: `今日完成 ${stats.completed} 项计划，收获满满`,
      };
    }
    if (stats.rate >= 80) {
      return {
        icon: 'mingcute:fire-fill',
        title: '非常不错，继续加油！',
        sub: `已完成 ${stats.completed}/${stats.total} 项，完成率 ${stats.rate}%`,
      };
    }
    return {
      icon: 'mingcute:seedling-fill',
      title: '好的开始是成功的一半',
      sub: `已完成 ${stats.completed}/${stats.total} 项，继续加油`,
    };
  };

  const content = getCelebrationContent();

  // 回到首页：reset context（清空今日计划） → P1，避免 P1 检测到全部完成又踢回 P4
  const handleGoHome = () => {
    reset();
    navigate('/m/morning-plan/home', { replace: true });
  };

  return (
    <div className="mp-mobile-page" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Celebration overlay (petals + sparkles) — uses .mp-celebration class */}
      <CelebrationOverlay />

      {/* Toast */}
      {showToast && (
        <div className="mp-toast">
          今日计划已全部完成！
        </div>
      )}

      {/* ===== Header ===== */}
      <header className="mp-mobile-page__header" style={{ height: 48, position: 'relative', zIndex: 10 }}>
        <button className="mp-header-btn" onClick={() => navigate(-1)}>
          <Icon icon="mingcute:arrow-left-fill" style={{ fontSize: '24px' }} />
        </button>
        <span className="font-zcool" style={{ fontSize: '18px', fontWeight: 700, color: '#C03A39' }}>
          完成
        </span>
        <div className="mp-header-spacer" />
      </header>

      {/* ===== Content ===== */}
      <main className="mp-main-scroll" style={{ position: 'relative', zIndex: 10 }}>
        <div className="mp-main-padding" style={{ textAlign: 'center' }}>
          {/* Brand */}
          <p style={{ fontSize: 15, fontWeight: 700, color: '#333', marginBottom: 4 }}>
            日耕朝夕，耕愈工作，耕暖生活
          </p>
          <p className="font-zcool" style={{ fontSize: 17, fontWeight: 700, color: '#333', marginBottom: 24 }}>
            晨起做规划，整日不慌忙
          </p>

          {/* Celebration Zone */}
          <div className="mp-celebration-zone" style={{ marginBottom: 32 }}>
            <Icon
              icon={content.icon}
              className="mp-celebrate-bounce"
              style={{ fontSize: '48px', color: '#D4A574', position: 'relative', zIndex: 10 }}
            />
            <h2
              className="font-zcool"
              style={{ fontSize: 28, color: '#D4A574', fontWeight: 700, position: 'relative', zIndex: 10, margin: '12px 0 8px' }}
            >
              {content.title}
            </h2>
            <p style={{ fontSize: 14, color: '#999', position: 'relative', zIndex: 10, margin: 0 }}>
              {content.sub}
            </p>
          </div>

          {/* Stats Card */}
          <div className="mp-card" style={{ position: 'relative', zIndex: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: '#F0FFF4',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon icon="mingcute:check-circle-fill" style={{ fontSize: '40px', color: '#22C55E' }} />
              </div>
            </div>
            <div className="mp-stats">
              <div className="mp-stat">
                <div className="mp-stat-number">{stats.total}</div>
                <div className="mp-stat__label">总任务</div>
              </div>
              <div className="mp-stat__divider" />
              <div className="mp-stat">
                <div className="mp-stat-number">{stats.completed}</div>
                <div className="mp-stat__label">已确认</div>
              </div>
              <div className="mp-stat__divider" />
              <div className="mp-stat">
                <div className="mp-stat-number">{stats.rate}%</div>
                <div className="mp-stat__label">完成率</div>
              </div>
            </div>
          </div>

          {/* Back to home */}
          <div style={{ marginTop: 24, position: 'relative', zIndex: 10 }}>
            <button className="mp-btn-primary" onClick={handleGoHome}>
              回到首页
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
