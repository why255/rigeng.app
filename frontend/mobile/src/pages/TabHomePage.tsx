import { useState } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { getBoard, type BoardId } from '@rigeng/shared/data/modules'
import './tab-home.css'

/* ── showPage('page-X') → React Router 路由映射 ── */
const PAGE_MAP: Record<string, string> = {
  'page-morning-plan': '/m/morning-plan',
  'page-evening-review': '/m/evening-review',
  'page-emotion-cave': '/m/mood-haven',
  'page-smart-record': '/m/smart-record',
  'page-smart-qa': '/m/smart-qa',
  'page-smart-office': '/m/smart-office/work',
  'page-high-dim-job': '/m/career-mentor/steps',
  'page-brand-center': '/m/brand-building',
  'page-get-client': '/m/acquire-client',
  'page-product-refine': '/m/product-design',
  'page-order-delivery': '/m/deliver-order',
  'page-private-library': '/m/knowledge-base',
  'page-data-analysis': '/m/data-analytics',
  'page-membership': '/m/membership',
  'page-journey': '/m/journey',
  'page-settings': '/settings',
  'page-login': '/login',
}

/* ── 图标色板 ── */
const iconColor = (key: string) => {
  const map: Record<string, { bg: string; fg: string }> = {
    orange: { bg: '#FFF3E0', fg: '#F57C00' },
    blue: { bg: '#E3F2FD', fg: '#1976D2' },
    purple: { bg: '#F3E5F5', fg: '#7B1FA2' },
    green: { bg: '#E8F5E9', fg: '#388E3C' },
    pink: { bg: '#FCE4EC', fg: '#C2185B' },
    teal: { bg: '#E0F2F1', fg: '#00796B' },
    amber: { bg: '#FFF8E1', fg: '#F57F17' },
    indigo: { bg: '#E8EAF6', fg: '#3F51B5' },
    cyan: { bg: '#E0F7FA', fg: '#00838F' },
    red: { bg: '#FFEBEE', fg: '#D32F2F' },
  }
  return map[key] ?? { bg: '#F5F5F5', fg: '#666666' }
}

/* ================================================================
 * 主组件 — 依据路由 :board 参数渲染对应 Tab 首页视图
 * ================================================================ */
export function TabHomePage() {
  const { board } = useParams<{ board: string }>()
  const navigate = useNavigate()

  if (!board) return <Navigate to="/" replace />

  const meta = getBoard(board as BoardId)
  if (!meta) return <Navigate to="/" replace />

  const nav = (pageKey: string) => {
    const route = PAGE_MAP[pageKey]
    if (route) {
      navigate(route)
    } else {
      const slug = pageKey.replace('page-', '')
      navigate(`/m/${slug}`)
    }
  }

  const [voiceActive, setVoiceActive] = useState(false)
  const simulateVoice = () => {
    setVoiceActive(true)
    setTimeout(() => setVoiceActive(false), 2000)
  }

  const renderView = () => {
    switch (board as BoardId) {
      case 'board1':
        return <DialogHome nav={nav} voiceActive={voiceActive} onVoice={simulateVoice} />
      case 'board2':
        return <CareerHome nav={nav} />
      case 'board3':
        return <UpgradeHome nav={nav} />
      case 'board4':
        return <KnowledgeHome nav={nav} />
      case 'board5':
        return <MineHome nav={nav} />
      default:
        return <Navigate to="/" replace />
    }
  }

  return (
    <PageContainer width="dashboard">
      <div data-module={board}>
        {renderView()}
      </div>
    </PageContainer>
  )
}

/* ================================================================
 * 板块一 · 日耕（小耕对话）— #tab-dialog
 * ================================================================ */
function DialogHome({
  nav, voiceActive, onVoice,
}: {
  nav: (k: string) => void; voiceActive: boolean; onVoice: () => void
}) {
  return (
    <div className="sub-view tab-dialog" id="tab-dialog">
      <div className="tab-dialog__header">
        <h1 className="tab-title">小耕对话</h1>
        <p className="tab-subtitle">日耕相伴，有趣有料，有闲有爱</p>
        <div className="tab-card-list">
          <div className="tab-card tab-card--row" onClick={() => nav('page-morning-plan')}>
            <div className="tab-icon-circle" style={{ background: iconColor('orange').bg, color: iconColor('orange').fg }}>
              🌅
            </div>
            <div className="tab-card__text">
              <h3 className="tab-card__title">朝有规划</h3>
              <p className="tab-card__desc">晨起做规划，整日不慌忙</p>
            </div>
          </div>
          <div className="tab-card tab-card--row" onClick={() => nav('page-evening-review')}>
            <div className="tab-icon-circle" style={{ background: iconColor('blue').bg, color: iconColor('blue').fg }}>
              🌙
            </div>
            <div className="tab-card__text">
              <h3 className="tab-card__title">暮有复盘</h3>
              <p className="tab-card__desc">睡前做复盘，经验变方法</p>
            </div>
          </div>
          <div className="tab-card tab-card--row" onClick={() => nav('page-emotion-cave')}>
            <div className="tab-icon-circle" style={{ background: iconColor('purple').bg, color: iconColor('purple').fg }}>
              🌿
            </div>
            <div className="tab-card__text">
              <h3 className="tab-card__title">情绪树洞</h3>
              <p className="tab-card__desc">心事有处说，烦恼变智慧</p>
            </div>
          </div>
        </div>
      </div>

      <div className="voice-area">
        <div className={`voice-ripple ${voiceActive ? 'voice-ripple--active' : ''}`} />
        <button className={`voice-btn ${voiceActive ? 'voice-btn--recording' : ''}`} onClick={onVoice} aria-label="语音输入">
          🎤
        </button>
        <p className="voice-hint">按住 聊聊你的心情</p>
      </div>
    </div>
  )
}

/* ================================================================
 * 板块二 · 涨薪（升值涨薪）— #tab-career
 * ================================================================ */
function CareerHome({ nav }: { nav: (k: string) => void }) {
  return (
    <div className="sub-view tab-career" id="tab-career">
      <div className="tab-career__header">
        <h1 className="tab-title">升值涨薪</h1>
        <div className="tab-card-grid">
          <div className="tab-card tab-card--col" onClick={() => nav('page-smart-record')}>
            <div className="tab-icon-box" style={{ background: iconColor('green').bg, color: iconColor('green').fg }}>
              🎙️
            </div>
            <h3 className="tab-card__title">智能记录</h3>
            <p className="tab-card__desc tab-card__desc--sm">所言成资产</p>
          </div>
          <div className="tab-card tab-card--col" onClick={() => nav('page-smart-qa')}>
            <div className="tab-icon-box" style={{ background: iconColor('blue').bg, color: iconColor('blue').fg }}>
              ❓
            </div>
            <h3 className="tab-card__title">智能问答</h3>
            <p className="tab-card__desc tab-card__desc--sm">答案不瞎编</p>
          </div>
          <div className="tab-card tab-card--col" onClick={() => nav('page-smart-office')}>
            <div className="tab-icon-box" style={{ background: iconColor('orange').bg, color: iconColor('orange').fg }}>
              💼
            </div>
            <h3 className="tab-card__title">智能办公</h3>
            <p className="tab-card__desc tab-card__desc--sm">高效又专业</p>
          </div>
          <div className="tab-card tab-card--col" onClick={() => nav('page-high-dim-job')}>
            <div className="tab-icon-box" style={{ background: iconColor('red').bg, color: iconColor('red').fg }}>
              📈
            </div>
            <h3 className="tab-card__title">高维求职</h3>
            <p className="tab-card__desc tab-card__desc--sm">前程自发光</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ================================================================
 * 板块三 · 升级（转型升级）— #tab-upgrade
 * ================================================================ */
function UpgradeHome({ nav }: { nav: (k: string) => void }) {
  return (
    <div className="sub-view tab-upgrade" id="tab-upgrade">
      <div className="tab-upgrade__header">
        <h1 className="tab-title">转型升级</h1>
        <div className="tab-card-list">
          <div className="tab-card tab-card--row tab-card--chevron" onClick={() => nav('page-brand-center')}>
            <div className="tab-card__left">
              <div className="tab-icon-box tab-icon-box--sm" style={{ background: iconColor('pink').bg, color: iconColor('pink').fg }}>
                ⭐
              </div>
              <div className="tab-card__text">
                <h3 className="tab-card__title">品牌打造中心</h3>
                <p className="tab-card__desc tab-card__desc--sm">踏实做自己，光芒自然来</p>
              </div>
            </div>
            <span className="tab-chevron">›</span>
          </div>
          <div className="tab-card tab-card--row tab-card--chevron" onClick={() => nav('page-get-client')}>
            <div className="tab-card__left">
              <div className="tab-icon-box tab-icon-box--sm" style={{ background: iconColor('teal').bg, color: iconColor('teal').fg }}>
                🤝
              </div>
              <div className="tab-card__text">
                <h3 className="tab-card__title">拿下一个客户</h3>
                <p className="tab-card__desc tab-card__desc--sm">真诚去触达，信任自然生</p>
              </div>
            </div>
            <span className="tab-chevron">›</span>
          </div>
          <div className="tab-card tab-card--row tab-card--chevron" onClick={() => nav('page-product-refine')}>
            <div className="tab-card__left">
              <div className="tab-icon-box tab-icon-box--sm" style={{ background: iconColor('amber').bg, color: iconColor('amber').fg }}>
                ✨
              </div>
              <div className="tab-card__text">
                <h3 className="tab-card__title">打磨一套产品</h3>
                <p className="tab-card__desc tab-card__desc--sm">经验沉下来，产品自然成</p>
              </div>
            </div>
            <span className="tab-chevron">›</span>
          </div>
          <div className="tab-card tab-card--row tab-card--chevron" onClick={() => nav('page-order-delivery')}>
            <div className="tab-card__left">
              <div className="tab-icon-box tab-icon-box--sm" style={{ background: iconColor('blue').bg, color: iconColor('blue').fg }}>
                🚚
              </div>
              <div className="tab-card__text">
                <h3 className="tab-card__title">交付一笔订单</h3>
                <p className="tab-card__desc tab-card__desc--sm">事事做到位，信任扎下根</p>
              </div>
            </div>
            <span className="tab-chevron">›</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ================================================================
 * 板块四 · 智库（我的智库）— #tab-knowledge
 * ================================================================ */
function KnowledgeHome({ nav }: { nav: (k: string) => void }) {
  return (
    <div className="sub-view tab-knowledge" id="tab-knowledge">
      <div className="tab-knowledge__header">
        <h1 className="tab-title">我的智库</h1>
        <div className="tab-card-list">
          <div className="tab-card tab-card--row" onClick={() => nav('page-private-library')}>
            <div className="tab-icon-circle tab-icon-circle--lg" style={{ background: iconColor('indigo').bg, color: iconColor('indigo').fg }}>
              🔍
            </div>
            <div className="tab-card__text">
              <h3 className="tab-card__title">公私智库</h3>
              <p className="tab-card__desc">随手存结晶，终成你底气</p>
            </div>
          </div>
          <div className="tab-card tab-card--row" onClick={() => nav('page-data-analysis')}>
            <div className="tab-icon-circle tab-icon-circle--lg" style={{ background: iconColor('cyan').bg, color: iconColor('cyan').fg }}>
              📊
            </div>
            <div className="tab-card__text">
              <h3 className="tab-card__title">数据分析</h3>
              <p className="tab-card__desc">数据照一照，看到好自己</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ================================================================
 * 板块五 · 我的 — #tab-mine
 * ================================================================ */
function MineHome({ nav }: { nav: (k: string) => void }) {
  return (
    <div className="sub-view tab-mine" id="tab-mine">
      <div className="tab-mine__header">
        <div className="tab-mine__profile">
          <div className="tab-mine__avatar">👤</div>
          <div className="tab-mine__info">
            <h2 className="tab-mine__name">墨刀用户</h2>
            <p className="tab-mine__phone">138****0000</p>
            <div className="tab-mine__badges">
              <span className="tab-badge tab-badge--vip">中级VIP · 99元/月</span>
              <span className="tab-badge tab-badge--open">全部功能开放</span>
            </div>
          </div>
          <button className="tab-mine__settings-btn" onClick={() => nav('page-settings')} aria-label="设置">⚙️</button>
        </div>
      </div>
      <div className="tab-mine__stats">
        <div className="tab-mine__stat">
          <p className="tab-mine__stat-num">128</p>
          <p className="tab-mine__stat-label">日耕天数</p>
        </div>
        <div className="tab-mine__stat tab-mine__stat--bordered">
          <p className="tab-mine__stat-num">346</p>
          <p className="tab-mine__stat-label">完成计划</p>
        </div>
        <div className="tab-mine__stat">
          <p className="tab-mine__stat-num">89</p>
          <p className="tab-mine__stat-label">沉淀文档</p>
        </div>
      </div>
      <div className="tab-mine__menu">
        <div className="tab-mine__menu-item" onClick={() => nav('page-membership')}>
          <div className="tab-mine__menu-left">
            <div className="tab-mine__menu-icon" style={{ background: '#FFF3E0' }}>⭐</div>
            <div>
              <p className="tab-mine__menu-title">会员中心</p>
              <p className="tab-mine__menu-sub">中级VIP · 查看权益</p>
            </div>
          </div>
          <span className="tab-chevron">›</span>
        </div>
        <div className="tab-mine__menu-item" onClick={() => nav('page-journey')}>
          <div className="tab-mine__menu-left">
            <div className="tab-mine__menu-icon" style={{ background: '#E8F5E9' }}>🌱</div>
            <div>
              <p className="tab-mine__menu-title">日耕历程</p>
              <p className="tab-mine__menu-sub">128天 · 你的成长轨迹</p>
            </div>
          </div>
          <span className="tab-chevron">›</span>
        </div>
        <div className="tab-mine__menu-item" onClick={() => nav('page-settings')}>
          <div className="tab-mine__menu-left">
            <div className="tab-mine__menu-icon" style={{ background: '#E3F2FD' }}>⚙️</div>
            <div>
              <p className="tab-mine__menu-title">设置</p>
              <p className="tab-mine__menu-sub">通知 · 隐私 · 关于</p>
            </div>
          </div>
          <span className="tab-chevron">›</span>
        </div>
        <div className="tab-mine__menu-item" onClick={() => nav('page-login')}>
          <div className="tab-mine__menu-left">
            <div className="tab-mine__menu-icon" style={{ background: '#FFEBEE' }}>🚪</div>
            <div>
              <p className="tab-mine__menu-title">退出登录</p>
              <p className="tab-mine__menu-sub">切换账号</p>
            </div>
          </div>
          <span className="tab-chevron">›</span>
        </div>
      </div>
    </div>
  )
}
