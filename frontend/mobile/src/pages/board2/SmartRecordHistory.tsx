import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { historyRecordings } from '@rigeng/shared/data/mock'
import type { Recording } from '@rigeng/shared/data/mock'
import { MAIN_SLOGAN } from '@rigeng/shared/data/modules'
import '../pages.css'
import './smart-record.css'

/** M4-P5 录音历史页（移动端） */
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
          <span className="sr-history-card__status sr-history-card__status--done" style={{ fontSize: 11 }}>
            ✅ 录音完成
          </span>
        )
      case 'extracting':
        return (
          <>
            <span className="sr-history-card__status sr-history-card__status--extracting" style={{ fontSize: 11 }}>
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
            <span className="sr-history-card__status sr-history-card__status--transcribing" style={{ fontSize: 11 }}>
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
          <span style={{ fontSize: 11, color: 'var(--color-error)' }}>
            ❌ 失败
          </span>
        )
    }
  }

  return (
    <PageContainer width="dashboard">
      <div data-module="smart-record">
        {/* 品牌标语（简写） */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-neutral-900)' }}>{MAIN_SLOGAN}</p>
          <p style={{ fontSize: 13, color: '#666', marginTop: 2 }}>随时随地录，所言成资产</p>
        </div>

        {/* 搜索框 */}
        <div className="sr-search" style={{ maxWidth: '100%' }}>
          <span className="sr-search__icon" style={{ fontSize: 16 }}>🔍</span>
          <input
            className="sr-search__input"
            type="text"
            placeholder="搜索录音…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ fontSize: 14, padding: '10px 10px 10px 36px' }}
          />
        </div>

        {/* 历史录音列表 */}
        <div>
          {filtered.map((rec) => (
            <div
              key={rec.id}
              className="sr-history-card"
              onClick={() => handleClick(rec)}
              style={{ padding: 12 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 500,
                      color: 'white',
                      backgroundColor: rec.sceneColor,
                    }}
                  >
                    {rec.scene}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-neutral-900)' }}>{rec.title}</span>
                </div>
                <span style={{ fontSize: 11, color: '#999' }}>{rec.date}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="sr-history-card__duration" style={{ fontSize: 11 }}>{rec.duration}</span>
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
