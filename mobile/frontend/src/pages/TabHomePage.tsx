import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { PageContainer } from '@/components/layout/AppShell'
import { getBoard, type BoardId } from '@/shared/data/modules'
import { apiGet } from '@/shared/api/api'
import './tab-home.css'

/* ── showPage('page-X') → React Router 路由映射 ── */
const PAGE_MAP: Record<string, string> = {
  'page-morning-plan': '/m/morning-plan/chat',
  'page-evening-review': '/m/evening-review',
  'page-emotion-cave': '/m/mood-haven',
  'page-smart-record': '/m/smart-record',
  'page-smart-qa': '/m/smart-qa',
  'page-smart-office': '/m/smart-office/home',
  'page-high-dim-job': '/m/career-mentor',
  'page-private-library': '/m/knowledge-base',
  'page-data-analysis': '/m/data-analytics',
  'page-membership': '/m/membership',
  'page-journey': '/m/journey',
  'page-model-select': '/m/model-select',
  'page-settings': '/settings',
  'page-login': '/login',
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

  const renderView = () => {
    switch (board as BoardId) {
      case 'board1':
        return <DialogHome nav={nav} />
      case 'board2':
        return <CareerHome nav={nav} />
      case 'board3':
        return <KnowledgeHome nav={nav} />
      case 'board4':
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
function DialogHome({ nav }: { nav: (k: string) => void }) {
  return (
    <div className="sub-view tab-dialog" id="tab-dialog">
      {/* Logo 区域 */}
      <div className="tab-dialog__logo">
        <div className="tab-dialog__logo-icon">
          <span>耕</span>
        </div>
        <span className="tab-dialog__logo-text">日耕</span>
      </div>

      {/* 标题区 */}
      <div className="tab-dialog__header">
        <h1 className="tab-dialog__title">小耕对话</h1>
        <p className="tab-dialog__subtitle">日耕相伴，有趣有料，有闲有爱</p>
      </div>

      {/* 功能卡片 */}
      <div className="tab-dialog__cards">
        <div className="card-notebook" onClick={() => nav('page-morning-plan')}>
          <div className="card-notebook__icon card-notebook__icon--orange">
            <Icon icon="mdi:weather-sunny" width="20" />
          </div>
          <div className="card-notebook__text">
            <h3 className="card-notebook__title">朝有规划</h3>
            <p className="card-notebook__desc">晨起做规划，整日不慌忙</p>
          </div>
        </div>

        <div className="card-notebook" onClick={() => nav('page-evening-review')}>
          <div className="card-notebook__icon card-notebook__icon--blue">
            <Icon icon="mdi:weather-night" width="20" />
          </div>
          <div className="card-notebook__text">
            <h3 className="card-notebook__title">暮有复盘</h3>
            <p className="card-notebook__desc">睡前做复盘，经验变方法</p>
          </div>
        </div>

        <div className="card-notebook" onClick={() => nav('page-emotion-cave')}>
          <div className="card-notebook__icon card-notebook__icon--purple">
            <Icon icon="mdi:leaf" width="20" />
          </div>
          <div className="card-notebook__text">
            <h3 className="card-notebook__title">情绪树洞</h3>
            <p className="card-notebook__desc">倾诉与释放，让心更轻盈</p>
          </div>
        </div>
      </div>

      {/* 底部装饰线 */}
      <div className="tab-dialog__footer-line" />
    </div>
  )
}

/* ================================================================
 * 板块二 · 涨薪（升值涨薪）— #tab-career
 * ================================================================ */
function CareerHome({ nav }: { nav: (k: string) => void }) {
  return (
    <div className="sub-view tab-career" id="tab-career">
      {/* Logo 区域 */}
      <div className="tab-career__logo">
        <div className="tab-career__logo-icon">
          <span>耕</span>
        </div>
        <span className="tab-career__logo-text">涨薪</span>
      </div>

      {/* 标题区 */}
      <div className="tab-career__header">
        <h1 className="tab-career__title">升值涨薪</h1>
        <p className="tab-career__subtitle">深耕专业力，价值自发光</p>
      </div>

      {/* 功能卡片 */}
      <div className="tab-career__cards">
        <div className="card-career" onClick={() => nav('page-smart-record')}>
          <div className="card-career__icon card-career__icon--green">
            <Icon icon="mdi:microphone" width="20" />
          </div>
          <div className="card-career__text">
            <h3 className="card-career__title">智能记录</h3>
            <p className="card-career__desc">随时随地录，所言成资产</p>
          </div>
        </div>

        <div className="card-career" onClick={() => nav('page-smart-qa')}>
          <div className="card-career__icon card-career__icon--blue">
            <Icon icon="mdi:chat-question" width="20" />
          </div>
          <div className="card-career__text">
            <h3 className="card-career__title">智能问答</h3>
            <p className="card-career__desc">随时随地问，答案不瞎编</p>
          </div>
        </div>

        <div className="card-career" onClick={() => nav('page-smart-office')}>
          <div className="card-career__icon card-career__icon--orange">
            <Icon icon="mdi:briefcase" width="20" />
          </div>
          <div className="card-career__text">
            <h3 className="card-career__title">智能办公</h3>
            <p className="card-career__desc">告别碎片化，高效又专业</p>
          </div>
        </div>

        <div className="card-career" onClick={() => nav('page-high-dim-job')}>
          <div className="card-career__icon card-career__icon--red">
            <Icon icon="mdi:trending-up" width="20" />
          </div>
          <div className="card-career__text">
            <h3 className="card-career__title">高维求职</h3>
            <p className="card-career__desc">高维五步法，前程自发光</p>
          </div>
        </div>
      </div>

      {/* 底部装饰线 */}
      <div className="tab-career__footer-line" />
    </div>
  )
}

/* ================================================================
 * 板块三 · 智库（我的智库）— #tab-knowledge
 * ================================================================ */
function KnowledgeHome({ nav }: { nav: (k: string) => void }) {
  return (
    <div className="sub-view tab-knowledge" id="tab-knowledge">
      {/* Logo 区域 */}
      <div className="tab-knowledge__logo">
        <div className="tab-knowledge__logo-icon">
          <span>耕</span>
        </div>
        <span className="tab-knowledge__logo-text">智库</span>
      </div>

      {/* 标题区 */}
      <div className="tab-knowledge__header">
        <h1 className="tab-knowledge__title">我的智库</h1>
        <p className="tab-knowledge__subtitle">知识沉淀处，成长看得见</p>
      </div>

      {/* 功能卡片 — 单列竖排 */}
      <div className="tab-knowledge__cards">
        <div className="card-knowledge" onClick={() => nav('page-private-library')}>
          <div className="card-knowledge__icon card-knowledge__icon--indigo">
            <Icon icon="mdi:bookshelf" width="22" />
          </div>
          <div className="card-knowledge__text">
            <h3 className="card-knowledge__title">公私智库</h3>
            <p className="card-knowledge__desc">随手存结晶，终成你底气</p>
          </div>
        </div>

        <div className="card-knowledge" onClick={() => nav('page-data-analysis')}>
          <div className="card-knowledge__icon card-knowledge__icon--teal">
            <Icon icon="mdi:chart-bar" width="22" />
          </div>
          <div className="card-knowledge__text">
            <h3 className="card-knowledge__title">数据分析</h3>
            <p className="card-knowledge__desc">数据照一照，看到好自己</p>
          </div>
        </div>
      </div>

      {/* 底部装饰线 */}
      <div className="tab-knowledge__footer-line" />
    </div>
  )
}

/* ================================================================
 * 板块四 · 我的 — #tab-mine
 * 对齐 index-standalone.html 设计：渐变横幅 + 统计卡片 + 列表菜单
 * ================================================================ */
function MineHome({ nav }: { nav: (k: string) => void }) {
  const [userInfo, setUserInfo] = useState<{ nickname?: string; phone?: string; vip_level?: string }>({})

  useEffect(() => {
    // 先从 localStorage 读取
    try {
      const raw = localStorage.getItem('rg_user')
      if (raw) {
        const u = JSON.parse(raw)
        setUserInfo({ nickname: u.nickname, phone: u.phone })
      }
    } catch { /* ignore */ }

    // 再从 API 拉最新数据
    apiGet<{ nickname?: string; phone?: string; vip?: { level?: string } }>('/users/me')
      .then((data) => {
        setUserInfo({
          nickname: data?.nickname,
          phone: data?.phone,
          vip_level: data?.vip?.level,
        })
      })
      .catch(() => { /* 接口失败用缓存 */ })
  }, [])

  /** 手机号中间4位用 * 替代 */
  const maskPhone = (phone: string | undefined): string => {
    if (!phone || phone.length < 11) return '未绑定'
    return phone.slice(0, 3) + '****' + phone.slice(7)
  }

  const displayName = userInfo.nickname || '日耕用户'
  const displayPhone = maskPhone(userInfo.phone)
  const vipLabel = userInfo.vip_level === 'trial' ? '试用期' : '试用期'

  return (
    <div className="sub-view tab-mine" id="tab-mine">
      {/* ===== 渐变横幅头部 ===== */}
      <div className="tab-mine__banner">
        <div className="tab-mine__banner-inner">
          {/* 用户信息行 */}
          <div className="tab-mine__banner-user">
            <div className="tab-mine__banner-avatar">
              <Icon icon="mdi:account-circle" width="32" />
            </div>
            <div className="tab-mine__banner-info">
              <span className="tab-mine__banner-name">{displayName}</span>
              <span className="tab-mine__banner-phone">{displayPhone}</span>
            </div>
          </div>
          {/* VIP 徽章 */}
          <div className="tab-mine__banner-badges">
            <span className="tab-mine__badge tab-mine__badge--vip">{vipLabel}</span>
            <span className="tab-mine__badge tab-mine__badge--open">全部开放</span>
          </div>
        </div>
        {/* 波浪 SVG */}
        <svg
          className="tab-mine__banner-wave"
          viewBox="0 0 375 40"
          fill="none"
          preserveAspectRatio="none"
        >
          <path d="M0 40H375V0C281.25 26.6667 93.75 26.6667 0 0V40Z" fill="#F5F3EF" />
        </svg>
      </div>

      {/* ===== 统计卡片 ===== */}
      <div className="tab-mine__stats-card">
        <div className="tab-mine__stats-card-header">
          <h2 className="tab-mine__stats-card-title">我的日耕</h2>
          <Icon icon="mdi:chevron-right" width="16" style={{ color: '#BCAAA4' }} />
        </div>
        <div className="tab-mine__stats-grid">
          <div className="tab-mine__stat-item">
            <span className="tab-mine__stat-value">1</span>
            <span className="tab-mine__stat-label">日耕天数</span>
          </div>
          <div className="tab-mine__stat-item">
            <span className="tab-mine__stat-value">0</span>
            <span className="tab-mine__stat-label">完成计划</span>
          </div>
          <div className="tab-mine__stat-item">
            <span className="tab-mine__stat-value">0</span>
            <span className="tab-mine__stat-label">沉淀文档</span>
          </div>
        </div>
      </div>

      {/* ===== 菜单列表卡片 ===== */}
      <div className="tab-mine__menu-card">
        <div
          className="tab-mine__menu-item"
          onClick={() => nav('page-membership')}
        >
          <div className="tab-mine__menu-item-left">
            <Icon icon="mdi:crown" width="20" style={{ color: '#666' }} />
            <span className="tab-mine__menu-item-label">会员中心</span>
          </div>
          <Icon icon="mdi:chevron-right" width="16" style={{ color: '#BCAAA4' }} />
        </div>

        <div
          className="tab-mine__menu-item"
          onClick={() => nav('page-model-select')}
        >
          <div className="tab-mine__menu-item-left">
            <Icon icon="mdi:cpu-64-bit" width="20" style={{ color: '#666' }} />
            <span className="tab-mine__menu-item-label">更换模型</span>
          </div>
          <Icon icon="mdi:chevron-right" width="16" style={{ color: '#BCAAA4' }} />
        </div>

        <div
          className="tab-mine__menu-item"
          onClick={() => nav('page-journey')}
        >
          <div className="tab-mine__menu-item-left">
            <Icon icon="mdi:history" width="20" style={{ color: '#666' }} />
            <span className="tab-mine__menu-item-label">日耕历程</span>
          </div>
          <Icon icon="mdi:chevron-right" width="16" style={{ color: '#BCAAA4' }} />
        </div>

        <div
          className="tab-mine__menu-item"
          onClick={() => nav('page-settings')}
        >
          <div className="tab-mine__menu-item-left">
            <Icon icon="mdi:cog" width="20" style={{ color: '#666' }} />
            <span className="tab-mine__menu-item-label">设置</span>
          </div>
          <Icon icon="mdi:chevron-right" width="16" style={{ color: '#BCAAA4' }} />
        </div>

        <div
          className="tab-mine__menu-item tab-mine__menu-item--last"
          onClick={() => nav('page-login')}
        >
          <div className="tab-mine__menu-item-left">
            <Icon icon="mdi:logout" width="20" style={{ color: '#666' }} />
            <span className="tab-mine__menu-item-label">退出登录</span>
          </div>
          <Icon icon="mdi:chevron-right" width="16" style={{ color: '#BCAAA4' }} />
        </div>
      </div>

      {/* 底部装饰线 */}
      <div className="tab-mine__footer-line" />
    </div>
  )
}
