/**
 * 会员中心 — 移动端
 * Route: /m/membership
 * 对齐项目现有设计规范（kb, so, cm 等页面模式）。
 *
 * 使用 mm-* BEM 类名 + 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。无 emoji 字符。
 */
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import './mine.css';

export function MembershipPage() {
  const navigate = useNavigate();

  return (
    <div className="mm-page">
      {/* ===== 顶部 Header ===== */}
      <header className="mm-page__header">
        <button className="mm-header-btn" onClick={() => navigate(-1)}>
          <Icon icon="mingcute:left-line" style={{ fontSize: '24px' }} />
        </button>
        <span className="mm-header-title">会员中心</span>
        <div className="mm-header-spacer" />
      </header>

      {/* ===== 主内容区 ===== */}
      <main className="mm-main-scroll">
        <div className="mm-main-padding">
          {/* 品牌标语 */}
          <div className="mm-hero">
            <p className="mm-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</p>
            <h2 className="mm-hero__title">深耕专业力，价值自发光</h2>
          </div>

          {/* ===== 试用期 — 当前生效方案 ===== */}
          <div className="mm-vip-card" style={{ background: '#FFFFFF' }}>
            <div className="mm-vip-card__badge" style={{ background: 'rgba(107,142,35,0.15)', color: '#6B8E23' }}>
              <Icon icon="mingcute:check-circle-line" style={{ fontSize: '14px' }} />
              当前生效
            </div>
            <div className="mm-vip-card__plan" style={{ color: '#333' }}>试用期</div>
            <div className="mm-vip-card__price" style={{ color: '#999' }}>免费 · 新用户体验期</div>
            <div className="mm-vip-card__expire" style={{ color: '#999', background: '#F5F3EF' }}>
              <Icon icon="mingcute:time-line" style={{ fontSize: '12px', marginRight: 4 }} />
              有效期 7 天
            </div>
            <div className="mm-vip-card__benefits">
              <span className="mm-vip-card__benefit" style={{ background: '#F5F3EF', color: '#666' }}>核心功能体验</span>
              <span className="mm-vip-card__benefit" style={{ background: '#F5F3EF', color: '#666' }}>AI 对话试用</span>
              <span className="mm-vip-card__benefit" style={{ background: '#F5F3EF', color: '#666' }}>知识库尝鲜</span>
              <span className="mm-vip-card__benefit" style={{ background: '#F5F3EF', color: '#666' }}>零成本上手</span>
            </div>
          </div>

          {/* ===== 会员方案列表 ===== */}
          <div>
            <h3 className="mm-section-title">升级方案</h3>
          </div>
          <div className="mm-plan-list">
            {/* 初级VIP — 暂未上线 */}
            <div
              className="mm-plan-card"
              style={{ background: 'linear-gradient(135deg, #2d5016 0%, #3a6b1e 50%, #4a8a2a 100%)', border: 'none', cursor: 'default' }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '3px 10px',
                  background: 'rgba(255,255,255,0.2)',
                  color: '#B8E986',
                  borderRadius: 10,
                }}
              >
                暂未上线
              </div>
              <div className="mm-plan-card__header">
                <span className="mm-plan-card__name" style={{ color: '#fff' }}>初级 VIP</span>
              </div>
              <div
                style={{
                  textAlign: 'right',
                  fontSize: 18,
                  fontWeight: 900,
                  color: '#B8E986',
                  marginBottom: 6,
                }}
              >
                29 - 99<span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.6)' }}>元</span>
              </div>
              <p className="mm-plan-card__desc" style={{ color: 'rgba(255,255,255,0.7)' }}>基础会员 · 有效时间一个月</p>
              <div className="mm-plan-card__features">
                <div className="mm-plan-card__feature" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  <Icon icon="mingcute:check-circle-line" style={{ color: '#B8E986', fontSize: 16, flexShrink: 0 }} />
                  解锁全部功能模块
                </div>
                <div className="mm-plan-card__feature" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  <Icon icon="mingcute:check-circle-line" style={{ color: '#B8E986', fontSize: 16, flexShrink: 0 }} />
                  无限 AI 对话次数
                </div>
                <div className="mm-plan-card__feature" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  <Icon icon="mingcute:check-circle-line" style={{ color: '#B8E986', fontSize: 16, flexShrink: 0 }} />
                  无限知识库存储空间
                </div>
              </div>
            </div>

            {/* 终极VIP — 暂未上线 */}
            <div
              className="mm-plan-card"
              style={{ background: 'linear-gradient(135deg, #5c3d0e 0%, #7a5520 50%, #a67c2e 100%)', border: 'none', cursor: 'default' }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '3px 10px',
                  background: 'rgba(255,255,255,0.2)',
                  color: '#F5D78C',
                  borderRadius: 10,
                }}
              >
                暂未上线
              </div>
              <div className="mm-plan-card__header">
                <span className="mm-plan-card__name" style={{ color: '#fff' }}>终极 VIP</span>
              </div>
              <div
                style={{
                  textAlign: 'right',
                  fontSize: 18,
                  fontWeight: 900,
                  color: '#F5D78C',
                  marginBottom: 6,
                }}
              >
                一人一价
              </div>
              <p className="mm-plan-card__desc" style={{ color: 'rgba(255,255,255,0.7)' }}>定制化高端服务 · 按人报价 · 终身有效</p>
              <div className="mm-plan-card__features">
                <div className="mm-plan-card__feature" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  <Icon icon="mingcute:check-circle-line" style={{ color: '#F5D78C', fontSize: 16, flexShrink: 0 }} />
                  初级 VIP 全部权益
                </div>
                <div className="mm-plan-card__feature" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  <Icon icon="mingcute:check-circle-line" style={{ color: '#F5D78C', fontSize: 16, flexShrink: 0 }} />
                  1 对 1 专属顾问
                </div>
                <div className="mm-plan-card__feature" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  <Icon icon="mingcute:check-circle-line" style={{ color: '#F5D78C', fontSize: 16, flexShrink: 0 }} />
                  定制化知识体系建设
                </div>
                <div className="mm-plan-card__feature" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  <Icon icon="mingcute:check-circle-line" style={{ color: '#F5D78C', fontSize: 16, flexShrink: 0 }} />
                  终身有效 · 持续迭代
                </div>
              </div>
            </div>
          </div>

          {/* 敬请期待提示 */}
          <div
            style={{
              textAlign: 'center',
              padding: '8px 0',
              fontSize: 12,
              color: '#999',
            }}
          >
            <Icon icon="mingcute:time-line" style={{ fontSize: '14px', marginRight: 4, verticalAlign: -2 }} />
            初级 VIP · 终极 VIP 暂未上线，敬请期待
          </div>
        </div>
      </main>
    </div>
  );
}
