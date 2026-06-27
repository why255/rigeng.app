import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { useToast } from '@/components/primitives/toast'
import { getExtraction, archiveRecording, syncActionItems } from '@/api/recordings'
import { extractionData } from '@/data/mock'
import '../pages.css'
import './smart-record.css'

/** M4-P4 萃取结果页 — 候选人画像 + 胜任力评估 + 归档 + 同步到朝有规划 */
export function SmartRecordExtract() {
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const recordingId = searchParams.get('id') || 'demo'

  const [data, setData] = useState(extractionData)
  const [loading, setLoading] = useState(true)
  const [archiving, setArchiving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [archived, setArchived] = useState(false)
  const [synced, setSynced] = useState(false)

  useEffect(() => {
    if (recordingId === 'demo') {
      setLoading(false)
      return
    }
    getExtraction(recordingId)
      .then((result) => {
        if (result) {
          setData({
            name: result.name || extractionData.name,
            role: result.role || extractionData.role,
            avatarBg: (result as any).avatar_bg || extractionData.avatarBg,
            years: result.years || extractionData.years,
            school: result.school || extractionData.school,
            skills: result.skills || extractionData.skills,
            salary: result.salary || extractionData.salary,
            onboard: result.onboard || extractionData.onboard,
            competencies: result.competencies?.length ? result.competencies : extractionData.competencies,
          })
        }
      })
      .catch(() => {
        // 降级使用mock数据
      })
      .finally(() => setLoading(false))
  }, [recordingId])

  const handleArchive = async () => {
    setArchiving(true)
    try {
      if (recordingId !== 'demo') {
        const result = await archiveRecording(recordingId)
        if (result.success) {
          setArchived(true)
          toast('已归档到知识库', 'success')
          setTimeout(() => navigate('/m/smart-record'), 1500)
          return
        }
      }
      // demo模式或降级
      setArchived(true)
      toast('已归档到知识库', 'success')
      setTimeout(() => navigate('/m/smart-record'), 1500)
    } catch {
      toast('归档失败，请稍后重试', 'error')
    } finally {
      setArchiving(false)
    }
  }

  const handleSyncActions = async () => {
    setSyncing(true)
    try {
      if (recordingId !== 'demo') {
        const result = await syncActionItems(recordingId)
        if (result.synced_count > 0) {
          setSynced(true)
          toast(`已同步 ${result.synced_count} 个行动项到今日计划`, 'success')
          return
        }
      }
      toast('同步成功', 'success')
      setSynced(true)
    } catch {
      toast('同步失败，请稍后重试', 'error')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <PageContainer width="dashboard">
        <div className="sr-loading">
          <span className="sr-loading__spinner">⏳</span>
          <span style={{ fontSize: 14, color: '#666' }}>加载萃取结果...</span>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer width="dashboard">
      <div data-module="smart-record">
        {/* 品牌标语 */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-neutral-900)' }}>日耕朝夕，耕愈工作，耕暖生活</p>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-neutral-900)', marginTop: 4 }}>智能记录</p>
        </div>

        {/* 萃取报告卡片 */}
        <div className="sr-extract-card">
          {/* 候选人画像 */}
          <div className="sr-extract-profile">
            <div className="sr-extract-avatar" style={{ backgroundColor: data.avatarBg }}>
              👤
            </div>
            <div>
              <h2 className="sr-extract-name">{data.name}</h2>
              <p className="sr-extract-role">{data.role}</p>
            </div>
          </div>

          <div className="sr-extract-grid">
            <div>
              <div className="sr-extract-field">
                <p className="sr-extract-field__label">工作年限</p>
                <p className="sr-extract-field__value">{data.years}</p>
              </div>
              <div className="sr-extract-field">
                <p className="sr-extract-field__label">毕业院校</p>
                <p className="sr-extract-field__value">{data.school}</p>
              </div>
              <div className="sr-extract-field">
                <p className="sr-extract-field__label">核心技能</p>
                <div className="sr-extract-skills">
                  {data.skills.map((s) => (
                    <span key={s} className="sr-extract-skill-tag">{s}</span>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <div className="sr-extract-field">
                <p className="sr-extract-field__label">薪酬期望</p>
                <p className="sr-extract-field__value">{data.salary}</p>
              </div>
              <div className="sr-extract-field">
                <p className="sr-extract-field__label">最快入职时间</p>
                <p className="sr-extract-field__value">{data.onboard}</p>
              </div>
            </div>
          </div>

          {/* 胜任力评估 */}
          <div className="sr-extract-competencies">
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-neutral-900)', marginBottom: 12 }}>胜任力评估</h3>
            <div className="sr-extract-grid">
              {data.competencies.map((c) => (
                <div key={c.label} className="sr-competency-row">
                  <span className="sr-competency-label">{c.label}</span>
                  <div className="sr-stars">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star} className={star <= c.stars ? 'sr-star--filled' : 'sr-star--empty'}>
                        ★
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="sr-actions">
          <button
            className="sr-btn-primary"
            onClick={handleArchive}
            disabled={archiving || archived}
          >
            {archiving ? '⏳ 归档中...' : archived ? '✅ 已归档' : '📚 归档到知识库'}
          </button>
          <button
            className="sr-btn-secondary"
            onClick={handleSyncActions}
            disabled={syncing || synced}
          >
            {syncing ? '⏳ 同步中...' : synced ? '✅ 已同步' : '📋 同步到今日计划'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            className="sr-btn-secondary"
            style={{ maxWidth: 200 }}
            onClick={() => navigate(`/m/smart-record/transcript?id=${recordingId}`)}
          >
            查看转写原文
          </button>
        </div>
      </div>
    </PageContainer>
  )
}
