/**
 * 智能记录录音历史页 — 搜索框 + 历史录音列表（多种状态）。
 * Route: /m/smart-record/history
 * 严格对齐 m4p5-mobile.html 原型设计。
 *
 * 使用 sr-* BEM 类名（来自 smart-record.css）+ 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。返回按钮使用 navigate(-1)。
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import { fetchHistory, type Recording } from '@/shared/api/recordings'
import './smart-record.css'

const SCENE_COLORS: Record<string, string> = {
  '面试': '#6B8FBF',
  '会议': '#D4A574',
  '日常': '#BCAAA4',
  '自定义': '#E8A94D',
}

export function SmartRecordHistory() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchHistory(1, 50)
      // 兼容后端直接返回数组（而非 {items, total} 对象）
      if (Array.isArray(res)) {
        setRecordings(res)
      } else if (res && Array.isArray((res as any).items)) {
        setRecordings((res as any).items)
      } else {
        setRecordings([])
      }
    } catch (err) {
      console.error('[SmartRecord] 历史列表加载失败:', err)
      setRecordings([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleClick = (rec: Recording) => {
    if (rec.status === 'completed' || rec.status === 'extracted') {
      navigate(`/m/smart-record/transcript?id=${rec.id}`)
    } else if (rec.status === 'recording') {
      navigate(`/m/smart-record/recording?scene=${encodeURIComponent(rec.scene)}`)
    }
  }

  // 状态渲染 — 对齐原型 m4p5 L222-276
  const statusRender = (rec: Recording) => {
    switch (rec.status) {
      case 'completed':
        return (
          <span className="sr-history-item__status" style={{ color: '#4CAF50' }}>
            <Icon icon="mingcute:check-circle-fill" />
            录音完成
          </span>
        )
      case 'extracted':
        return (
          <span className="sr-history-item__status" style={{ color: '#E8A94D' }}>
            <Icon icon="mingcute:star-fill" />
            萃取完成
          </span>
        )
      case 'transcribing':
        return (
          <div>
            <span className="sr-history-item__status" style={{ color: '#D4A574' }}>
              <Icon icon="mingcute:loader-3-line" className="sr-loading__spinner" style={{ fontSize: 10 }} />
              转写中
            </span>
            {rec.progress !== undefined && (
              <>
                <div className="sr-history-item__progress">
                  <div
                    className="sr-history-item__progress-fill"
                    style={{ width: `${rec.progress}%`, backgroundColor: '#D4A574' }}
                  />
                </div>
                <span className="sr-history-item__progress-text">转写中 {rec.progress}%</span>
              </>
            )}
          </div>
        )
      case 'extracting':
        return (
          <div>
            <span className="sr-history-item__status" style={{ color: '#D4A574' }}>
              <Icon icon="mingcute:loader-3-line" className="sr-loading__spinner" style={{ fontSize: 10 }} />
              萃取中
            </span>
            {rec.progress !== undefined && (
              <div className="sr-history-item__progress">
                <div
                  className="sr-history-item__progress-fill"
                  style={{ width: `${rec.progress}%`, backgroundColor: '#E8A94D' }}
                />
              </div>
            )}
          </div>
        )
      case 'failed':
        return (
          <span className="sr-history-item__status" style={{ color: '#F44336' }}>
            <Icon icon="mingcute:close-circle-fill" />
            失败
          </span>
        )
      default:
        return <span style={{ fontSize: 10, color: '#999' }}>未知状态</span>
    }
  }

  // 前端搜索过滤
  const filtered = search.trim()
    ? recordings.filter((r) => r.title.includes(search.trim()))
    : recordings

  return (
    <div data-module="smart-record" className="sr-page">

      {/* ═══ 页面头部 — 对齐原型 m4p5 L56-60 ═══ */}
      <header className="sr-page-header">
        <button className="sr-page-header__back" onClick={() => navigate(-1)}>
          <Icon icon="mingcute:left-line" />
        </button>
        <h1 className="sr-page-header__title">录音历史</h1>
        <div className="sr-page-header__spacer" />
      </header>

      {/* ═══ 内容区 — 对齐原型 m4p5 L63-83 ═══ */}
      <div className="sr-page-body sr-scrollbar-hide">

        {/* 品牌语 — 对齐原型 m4p5 L66-69 */}
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#333', margin: '0 0 2px 0' }}>日耕朝夕，耕愈工作，耕暖生活</p>
          <p style={{ fontSize: 12, color: '#666', margin: 0 }}>随时随地录，所言成资产</p>
        </div>

        {/* 搜索框 — 对齐原型 m4p5 L72-77 */}
        <div className="sr-search">
          <Icon
            icon="mingcute:search-2-line"
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#999',
              fontSize: 14,
            }}
          />
          <input
            className="sr-search__input"
            type="text"
            placeholder="搜索录音…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* 历史列表 — 对齐原型 m4p5 L80-82, L187-297 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Icon icon="mingcute:loader-3-line" style={{ fontSize: 24, color: '#C03A39' }} className="sr-loading__spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="sr-empty">
            <div className="sr-empty-icon" style={{ display: 'inline-block', marginBottom: 12 }}>
              <Icon icon="mingcute:history-line" style={{ fontSize: 36, color: '#D4C5B0' }} />
            </div>
            <p className="sr-empty__text">暂无录音历史</p>
            <p className="sr-empty__hint">完成录音后，记录将出现在这里</p>
          </div>
        ) : (
          <div style={{ paddingBottom: 8 }}>
            {filtered.map((rec) => (
              <div
                key={rec.id}
                className="sr-history-item"
                onClick={() => handleClick(rec)}
              >
                <div className="sr-history-item__top">
                  <div className="sr-history-item__left">
                    <span
                      className="sr-history-item__tag"
                      style={{ backgroundColor: SCENE_COLORS[rec.scene] || '#6B8FBF' }}
                    >
                      {rec.scene}
                    </span>
                    <span className="sr-history-item__title">{rec.title}</span>
                  </div>
                  <span className="sr-history-item__date">{rec.date}</span>
                </div>
                <div className="sr-history-item__bottom">
                  <span className="sr-history-item__duration">{rec.duration}</span>
                  {statusRender(rec)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
