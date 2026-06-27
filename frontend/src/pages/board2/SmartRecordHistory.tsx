import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { getRecordingHistory, deleteRecording } from '@/api/recordings'
import { historyRecordings } from '@/data/mock'
import { MAIN_SLOGAN } from '@/data/modules'
import type { Recording } from '@/data/mock'
import '../pages.css'
import './smart-record.css'

/** M4-P5 录音历史页 — 搜索 + 历史列表 + 删除 */
export function SmartRecordHistory() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [recordings, setRecordings] = useState<Recording[]>(historyRecordings)

  const loadHistory = useCallback(async (searchTerm?: string) => {
    try {
      const data = await getRecordingHistory(searchTerm ? { search: searchTerm } : undefined)
      if (data && data.length > 0) setRecordings(data)
    } catch {
      // 保持当前数据
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      loadHistory(search || undefined)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, loadHistory])

  const filtered = recordings

  const handleClick = (rec: Recording) => {
    if (rec.status === 'completed') {
      navigate(`/m/smart-record/transcript?id=${rec.id}`)
    } else if (rec.status === 'extracting') {
      navigate(`/m/smart-record/extract?id=${rec.id}`)
    } else if (rec.status === 'transcribing') {
      navigate(`/m/smart-record/transcript?id=${rec.id}`)
    }
  }

  const handleDelete = async (e: React.MouseEvent, recId: string) => {
    e.stopPropagation()
    if (!window.confirm('确定删除这条录音吗？')) return
    try {
      await deleteRecording(recId)
      setRecordings((prev) => prev.filter((r) => r.id !== recId))
    } catch {
      // 降级：本地移除
      setRecordings((prev) => prev.filter((r) => r.id !== recId))
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
          <span className="sr-history-card__status sr-history-card__status--extracting">
            ⭐ 萃取完成
          </span>
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
        {/* 品牌标语 */}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="sr-history-card__date">{rec.date}</span>
                  <span
                    style={{ cursor: 'pointer', fontSize: 14, opacity: 0.5 }}
                    onClick={(e) => handleDelete(e, rec.id)}
                    title="删除"
                  >
                    🗑️
                  </span>
                </div>
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
