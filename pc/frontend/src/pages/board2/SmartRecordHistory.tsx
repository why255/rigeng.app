import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { historyRecordings } from '@/shared/data/mock'
import type { Recording } from '@/shared/data/mock'
import { MAIN_SLOGAN } from '@/shared/data/modules'
import '../pages.css'
import './smart-record.css'

/** M4-P5 录音历史页（PC） — 搜索 + 历史列表 */
export function SmartRecordHistory() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const filtered = search
    ? historyRecordings.filter((r) => r.title.includes(search))
    : historyRecordings

  const handleClick = (rec: Recording) => {
    if (rec.status === 'completed') {
      navigate(`/m/smart-record/transcript?id=${rec.id}`)
    } else if (rec.status === 'extracting') {
      navigate(`/m/smart-record/extract?id=${rec.id}`)
    }
  }

  const statusRender = (rec: Recording) => {
    switch (rec.status) {
      case 'completed':
        return (
          <span className="sr-history-card__status sr-history-card__status--done">
            ✅ 录音完成
          </span>
        )
      case 'extracting':
        return (
          <>
            <span className="sr-history-card__status sr-history-card__status--extracting">
              ⭐ 萃取中
            </span>
            {rec.progress !== undefined && (
              <>
                <div className="sr-history-card__progress">
                  <div
                    className="sr-history-card__progress-fill"
                    style={{ width: `${rec.progress}%`, backgroundColor: '#E8A94D' }}
                  />
                </div>
                <span className="sr-history-card__progress-text">萃取中 {rec.progress}%</span>
              </>
            )}
          </>
        )
      case 'transcribing':
        return (
          <>
            <span className="sr-history-card__status sr-history-card__status--transcribing">
              🔄 转写中
            </span>
            {rec.progress !== undefined && (
              <>
                <div className="sr-history-card__progress">
                  <div
                    className="sr-history-card__progress-fill"
                    style={{ width: `${rec.progress}%`, backgroundColor: '#D4A574' }}
                  />
                </div>
                <span className="sr-history-card__progress-text">转写中 {rec.progress}%</span>
              </>
            )}
          </>
        )
      default:
        return (
          <span className="sr-history-card__status" style={{ color: 'var(--color-error)' }}>
            ❌ 失败
          </span>
        )
    }
  }

  return (
    <PageContainer width="dashboard">
      <div data-module="smart-record">
        {/* 品牌标语（简写） */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-neutral-900)' }}>{MAIN_SLOGAN}</p>
          <p style={{ fontSize: 14, color: '#666', marginTop: 4 }}>随时随地录，所言成资产</p>
        </div>

        {/* 搜索框 */}
        <div className="sr-search">
          <span className="sr-search__icon">🔍</span>
          <input
            className="sr-search__input"
            type="text"
            placeholder="搜索录音…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* 历史录音列表 */}
        <div>
          {filtered.map((rec) => (
            <div
              key={rec.id}
              className="sr-history-card"
              onClick={() => handleClick(rec)}
            >
              <div className="sr-history-card__header">
                <div className="sr-history-card__left">
                  <span
                    className="sr-history-card__scene"
                    style={{ backgroundColor: rec.sceneColor }}
                  >
                    {rec.scene}
                  </span>
                  <span className="sr-history-card__title">{rec.title}</span>
                </div>
                <span className="sr-history-card__date">{rec.date}</span>
              </div>
              <div className="sr-history-card__footer">
                <span className="sr-history-card__duration">{rec.duration}</span>
                {statusRender(rec)}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-neutral-500)' }}>
              没有找到录音记录
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  )
}
