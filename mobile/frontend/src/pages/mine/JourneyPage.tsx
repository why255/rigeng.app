/**
 * 日耕历程 — 移动端
 * Route: /m/journey
 * 对齐项目现有设计规范（kb, so, cm 等页面模式）。
 *
 * 使用 mm-* BEM 类名 + 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。无 emoji 字符。
 *
 * 数据来源：
 * - 注册日期来自 GET /users/me → created_at
 * - 后续成长足迹根据用户实际使用动态记录
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { apiGet } from '@/shared/api/api';
import './mine.css';

interface TimelineItem {
  date: string;
  title: string;
  desc: string;
  icon: string;
  color: string;
}

export function JourneyPage() {
  const navigate = useNavigate();
  const [registerDate, setRegisterDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ created_at?: string }>('/users/me')
      .then((data) => {
        if (data?.created_at) {
          // 取日期部分 YYYY-MM-DD
          setRegisterDate(data.created_at.slice(0, 10));
        }
      })
      .catch(() => {
        // 接口失败时静默，使用 undefined
      })
      .finally(() => setLoading(false));
  }, []);

  /** 根据注册日期生成时间线 */
  const buildTimeline = (): TimelineItem[] => {
    if (!registerDate) return [];
    return [
      {
        date: registerDate,
        title: '注册日耕，开始第1天',
        desc: '加入日耕，晨起做规划，整日不慌忙。日耕朝夕，耕愈工作，耕暖生活。',
        icon: 'mingcute:sparkles-line',
        color: '#C03A39',
      },
    ];
  };

  const timeline = buildTimeline();

  return (
    <div className="mm-page">
      {/* ===== 顶部 Header ===== */}
      <header className="mm-page__header">
        <button className="mm-header-btn" onClick={() => navigate(-1)}>
          <Icon icon="mingcute:left-line" style={{ fontSize: '24px' }} />
        </button>
        <span className="mm-header-title">日耕历程</span>
        <div className="mm-header-spacer" />
      </header>

      {/* ===== 主内容区 ===== */}
      <main className="mm-main-scroll">
        <div className="mm-main-padding">
          {/* 品牌标语 */}
          <div className="mm-hero">
            <p className="mm-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</p>
            <h2 className="mm-hero__title">每一天，都是成长的印记</h2>
          </div>

          {/* 核心数据（初始为零，随使用动态累计） */}
          <div className="mm-stat-row">
            <div className="mm-stat-item">
              <span className="mm-stat-item__num">1</span>
              <span className="mm-stat-item__label">日耕天数</span>
            </div>
            <div className="mm-stat-item">
              <span className="mm-stat-item__num">0</span>
              <span className="mm-stat-item__label">完成计划</span>
            </div>
            <div className="mm-stat-item">
              <span className="mm-stat-item__num">0</span>
              <span className="mm-stat-item__label">沉淀文档</span>
            </div>
          </div>

          {/* 成长时间线 */}
          <div>
            <h3 className="mm-section-title">成长足迹</h3>
          </div>
          <div className="mm-card" style={{ padding: '20px 16px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#999' }}>
                <Icon icon="mingcute:loading-line" style={{ fontSize: '24px', animation: 'spin 1s linear infinite' }} />
                <p style={{ fontSize: 12, marginTop: 8 }}>加载中...</p>
              </div>
            ) : timeline.length > 0 ? (
              <div className="mm-timeline">
                {timeline.map((item, i) => (
                  <div className="mm-timeline-item" key={i}>
                    <div
                      className="mm-timeline-item__dot"
                      style={{ borderColor: item.color }}
                    />
                    <div className="mm-timeline-item__date">{item.date}</div>
                    <div className="mm-timeline-item__title">
                      <Icon
                        icon={item.icon}
                        style={{ fontSize: '14px', color: item.color, marginRight: '4px', verticalAlign: 'middle' }}
                      />
                      {item.title}
                    </div>
                    <div className="mm-timeline-item__desc">{item.desc}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#999' }}>
                <Icon icon="mingcute:sparkles-line" style={{ fontSize: '28px' }} />
                <p style={{ fontSize: 13, marginTop: 8 }}>成长足迹将随你的使用动态记录</p>
              </div>
            )}
          </div>

          {/* 激励卡片 */}
          <div className="mm-card" style={{ textAlign: 'center', padding: '24px 20px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>
              <Icon icon="mingcute:fire-line" style={{ fontSize: '36px', color: '#F57C00' }} />
            </div>
            <p style={{ fontSize: '16px', fontWeight: 700, color: '#333', marginBottom: '4px' }}>
              日耕之路，刚刚启程
            </p>
            <p style={{ fontSize: '13px', color: '#999' }}>
              每一天的坚持，都会在这里留下印记
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
