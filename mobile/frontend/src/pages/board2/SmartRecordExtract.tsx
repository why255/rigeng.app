/**
 * 智能记录萃取结果页 — 结构化信息卡片 + 归档/重新萃取/返回列表。
 * Route: /m/smart-record/extract?id=xxx
 * 严格对齐 m4p4-mobile.html 原型设计。
 *
 * 使用 sr-* BEM 类名（来自 smart-record.css）+ 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。返回按钮使用 navigate(-1)。
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '@iconify/react'
import { fetchExtraction, archiveRecording, type ExtractionResult } from '@/shared/api/recordings'
import './smart-record.css'

export function SmartRecordExtract() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const recordingId = searchParams.get('id') || ''

  const [data, setData] = useState<ExtractionResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [archiving, setArchiving] = useState(false)

  useEffect(() => {
    if (!recordingId) { setLoading(false); return }
    let cancelled = false
    async function load() {
      try {
        const result = await fetchExtraction(recordingId)
        if (!cancelled) setData(result)
      } catch {
        // 加载失败显示空状态
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [recordingId])

  // 归档 — 对齐原型 m4p4 L283-286
  const handleArchive = useCallback(async () => {
    if (!recordingId || archiving) return
    setArchiving(true)
    try {
      await archiveRecording(recordingId)
      navigate('/m/smart-record')
    } catch {
      setArchiving(false)
    }
  }, [recordingId, archiving, navigate])

  return (
    <div data-module="smart-record" className="sr-page">

      {/* ═══ 页面头部 — 对齐原型 m4p4 L62-66 ═══ */}
      <header className="sr-page-header">
        <button className="sr-page-header__back" onClick={() => navigate(-1)}>
          <Icon icon="mingcute:left-line" />
        </button>
        <h1 className="sr-page-header__title">萃取结果</h1>
        <div className="sr-page-header__spacer" />
      </header>

      {/* ═══ 内容区 — 对齐原型 m4p4 L69-95 ═══ */}
      <div className="sr-page-body sr-scrollbar-hide">

        {/* 品牌语 — 对齐原型 m4p4 L72-75 */}
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#333', margin: '0 0 2px 0' }}>日耕朝夕，耕愈工作，耕暖生活</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#333', margin: 0 }}>智能记录</p>
        </div>

        {/* 萃取结果 — 对齐原型 m4p4 L78, L172-277 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Icon icon="mingcute:loader-3-line" style={{ fontSize: 24, color: '#C03A39' }} className="sr-loading__spinner" />
          </div>
        ) : !data ? (
          <div className="sr-empty">
            <div className="sr-empty-icon" style={{ display: 'inline-block', marginBottom: 12 }}>
              <Icon icon="mingcute:file-search-line" style={{ fontSize: 36, color: '#D4C5B0' }} />
            </div>
            <p className="sr-empty__text">暂无萃取结果</p>
            <p className="sr-empty__hint">完成录音转写后，点击「生成萃取」即可获得</p>
          </div>
        ) : (
          <div className="sr-extract-card">
            {/* 画像 — 对齐原型 m4p4 L235-244 */}
            <div className="sr-extract-profile">
              <div className="sr-extract-avatar" style={{ backgroundColor: data.avatarBg || '#BCAAA4' }}>
                <Icon icon="mingcute:user-3-fill" style={{ color: '#FFFFFF', fontSize: 24 }} />
              </div>
              <div>
                <h2 className="sr-extract-name">{data.name}</h2>
                <p className="sr-extract-role">{data.role}</p>
              </div>
            </div>

            {/* 基本信息 — 对齐原型 m4p4 L247-268 */}
            <div className="sr-extract-fields">
              <div>
                <p className="sr-extract-field__label">工作年限</p>
                <p className="sr-extract-field__value">{data.years}</p>
              </div>
              <div>
                <p className="sr-extract-field__label">毕业院校</p>
                <p className="sr-extract-field__value">{data.school}</p>
              </div>
              <div>
                <p className="sr-extract-field__label">薪酬期望</p>
                <p className="sr-extract-field__value">{data.salary}</p>
              </div>
              <div>
                <p className="sr-extract-field__label">最快入职</p>
                <p className="sr-extract-field__value">{data.onboard}</p>
              </div>
              <div>
                <p className="sr-extract-field__label" style={{ marginBottom: 6 }}>核心技能</p>
                <div className="sr-extract-skills">
                  {data.skills && data.skills.length > 0
                    ? data.skills.map((skill) => (
                        <span key={skill} className="sr-extract-skill-tag">{skill}</span>
                      ))
                    : <span style={{ fontSize: 12, color: '#999' }}>暂无</span>
                  }
                </div>
              </div>
            </div>

            {/* 胜任力评估 — 对齐原型 m4p4 L271-276 */}
            <div className="sr-extract-competencies">
              <h3 className="sr-extract-competencies__title">胜任力评估</h3>
              {data.competencies && data.competencies.length > 0 ? (
                data.competencies.map((c) => (
                  <div key={c.label} className="sr-competency-row">
                    <span className="sr-competency-label">{c.label}</span>
                    <div className="sr-stars">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Icon
                          key={star}
                          icon="mingcute:star-fill"
                          style={{
                            fontSize: 14,
                            color: star <= c.stars ? '#E8A94D' : '#E8E0D6',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ fontSize: 12, color: '#999' }}>暂无评估维度</p>
              )}
            </div>
          </div>
        )}

        {/* 操作按钮 — 对齐原型 m4p4 L83-94 */}
        <div className="sr-actions" style={{ paddingBottom: 16 }}>
          <button
            className="sr-btn-primary"
            onClick={handleArchive}
            disabled={archiving || !data}
            style={{ opacity: archiving || !data ? 0.6 : 1 }}
          >
            <Icon icon="mingcute:archive-line" />
            {archiving ? '归档中...' : '归档到知识库'}
          </button>
          <button
            className="sr-btn-secondary"
            onClick={() => navigate(`/m/smart-record/transcript?id=${recordingId}`)}
          >
            重新萃取
          </button>
          <button className="sr-btn-link" onClick={() => navigate('/m/smart-record')}>
            返回录音列表
          </button>
        </div>
      </div>
    </div>
  )
}
