import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { BrandSlogan } from '@rigeng/shared/components/business/BrandSlogan'
import { getModuleBySlug } from '@rigeng/shared/data/modules'
import {
  submitFeedback,
  archiveAnswer,
  getConversation,
  type QaAnswer,
  type ConversationOut,
} from '@rigeng/shared/api/smartQa'
import '../pages.css'
import './smart-qa.css'

const MODULE = getModuleBySlug('smart-qa')!

/** M5-P3 智能问答答案详情页（PC） — 完整四要素 + 来源 + 异常标注 + 纠错反馈（真实API） */
export function SmartQaDetail() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const answerId = searchParams.get('id') || ''
  const convId = searchParams.get('conv') || ''

  const [answer, setAnswer] = useState<QaAnswer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackType, setFeedbackType] = useState('内容有误')
  const [feedbackDetail, setFeedbackDetail] = useState('')
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  useEffect(() => {
    if (convId) {
      // 从对话历史中加载答案
      getConversation(convId)
        .then((conv: ConversationOut) => {
          // 找最后一个有答案的消息
          const lastAnswer = [...conv.messages]
            .reverse()
            .find((m) => m.answer)?.answer
          if (lastAnswer) {
            setAnswer(lastAnswer)
          } else {
            setError('未找到该答案')
          }
        })
        .catch((err) => {
          setError(err?.message || '加载失败')
        })
        .finally(() => setLoading(false))
    } else if (answerId) {
      // 通过 answer ID 搜索对话历史
      setError('请通过对话链接访问答案详情')
      setLoading(false)
    } else {
      setError('缺少答案ID')
      setLoading(false)
    }
  }, [answerId, convId])

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 2000)
  }

  const handleSubmitFeedback = async () => {
    if (!answer) return
    setFeedbackSubmitting(true)
    try {
      await submitFeedback(answer.id, feedbackType, feedbackDetail || undefined)
      setShowFeedback(false)
      showToast('感谢您的反馈！')
    } catch {
      showToast('提交失败，请重试')
    } finally {
      setFeedbackSubmitting(false)
    }
  }

  const handleSaveAsSop = async () => {
    if (!answer) return
    try {
      const result = await archiveAnswer(answer.id)
      if (result.success) {
        showToast(`+${result.contribution_value} 贡献值`)
      } else {
        showToast('归档失败，请重试')
      }
    } catch {
      showToast('归档失败，请重试')
    }
  }

  if (loading) {
    return (
      <PageContainer width="dashboard">
        <div data-module="smart-qa">
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--color-neutral-400)' }}>
            加载中...
          </div>
        </div>
      </PageContainer>
    )
  }

  if (error || !answer) {
    return (
      <PageContainer width="dashboard">
        <div data-module="smart-qa">
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <p style={{ color: 'var(--color-neutral-400)', marginBottom: 'var(--spacing-lg)' }}>
              {error || '答案不存在'}
            </p>
            <button
              onClick={() => navigate('/m/smart-qa')}
              style={{
                padding: '10px 24px',
                borderRadius: '999px',
                border: '1px solid var(--color-neutral-200)',
                background: 'var(--color-brand-white)',
                cursor: 'pointer',
              }}
            >
              返回首页
            </button>
          </div>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer width="dashboard">
      <div data-module="smart-qa">
        <div className="sq-detail">
          {/* 品牌语（紧凑） */}
          <BrandSlogan module={MODULE} compact />

          {/* 问题回顾 */}
          <div className="sq-detail__question">
            <p className="sq-detail__question-label">您的问题：</p>
            <h3 className="sq-detail__question-text">{answer.question}</h3>
          </div>

          {/* 完整四要素答案 */}
          <div style={{ marginBottom: 'var(--spacing-3xl)' }}>
            {answer.elements.map((el) => (
              <div key={el.key} className="sq-detail__element">
                <div className="sq-detail__element-header">
                  <div
                    className="sq-detail__element-icon"
                    style={{ background: el.color }}
                  >
                    {el.icon}
                  </div>
                  <h4 className="sq-detail__element-title">{el.title}</h4>
                </div>
                <div className="sq-detail__element-body">
                  {el.key === 'cautions' ? (
                    <>
                      <p style={{ fontSize: 'var(--font-size-l5)', marginBottom: 'var(--spacing-lg)' }}>
                        {el.summary}
                      </p>
                      <div className="sq-detail__conditions">
                        {el.detail.map((item, idx) => (
                          <div key={idx} className="sq-detail__condition">
                            <p className="sq-detail__condition-title">{idx + 1}. {item.split('：')[0] || item.slice(0, 20)}</p>
                            <p className="sq-detail__condition-text">
                              {item.includes('：') ? item.split('：').slice(1).join('：') : item}
                            </p>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <ul>
                      {el.detail.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 来源文档详情 */}
          {answer.source && (
            <div className="sq-detail__sources">
              <h4 className="sq-detail__sources-title">📚 参考来源与文档</h4>
              <div className="sq-detail__source-card">
                <div className="sq-detail__source-main">
                  <div className="sq-detail__source-thumb">📕</div>
                  <div>
                    <h5 className="sq-detail__source-name">{answer.source.title}</h5>
                    <div className="sq-detail__source-meta">
                      <span>所属库：{answer.source.library}</span>
                      <span>更新时间：{answer.source.updated_at}</span>
                      {answer.source.verified && (
                        <span className="sq-detail__source-verified">
                          ✅ 已核实
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                  <span className="sq-detail__source-view-btn" style={{ cursor: 'default' }}>
                    查看原文
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--color-neutral-500)' }}>
                    来自内部专业知识库
                  </span>
                </div>
              </div>

              {/* 异常标注（防幻觉L1+L2） */}
              <div className="sq-detail__warnings">
                {answer.source.is_internet && (
                  <div className="sq-warning sq-warning--internet">
                    <span className="sq-warning__icon">⚠️</span>
                    <div>
                      <p className="sq-warning__title">互联网来源 · 请核实</p>
                      <p className="sq-warning__text">
                        该信息检索自外部网络，可能存在时效性或准确性偏差。
                      </p>
                    </div>
                  </div>
                )}
                {answer.source.is_stale && (
                  <div className="sq-warning sq-warning--stale">
                    <span className="sq-warning__icon">⏰</span>
                    <div>
                      <p className="sq-warning__title">内容较旧 · 请注意时效</p>
                      <p className="sq-warning__text">
                        该文档更新已超过 12 个月，建议结合最新法律法规查阅。
                      </p>
                    </div>
                  </div>
                )}
                {!answer.source.is_internet && !answer.source.is_stale && answer.source.verified && (
                  <div className="sq-warning" style={{ background: '#E8F5E9', borderColor: '#27AE60' }}>
                    <span className="sq-warning__icon">✅</span>
                    <div>
                      <p className="sq-warning__title" style={{ color: '#27AE60' }}>来源可靠 · 已核实</p>
                      <p className="sq-warning__text">
                        该信息来自{answer.source.library}，经过审核验证，可放心参考。
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 底部操作 */}
          <div className="sq-detail__footer">
            <button
              className="sq-detail__feedback-btn"
              onClick={() => setShowFeedback(true)}
            >
              💬 纠错反馈
            </button>
            <button className="sq-detail__save-btn" onClick={handleSaveAsSop}>
              💾 采纳并存为 SOP
            </button>
          </div>
        </div>

        {/* 纠错反馈弹窗 */}
        {showFeedback && (
          <div
            className="sq-modal-mask"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowFeedback(false)
            }}
          >
            <div className="sq-modal" onClick={(e) => e.stopPropagation()}>
              <div className="sq-modal__header">
                <h3 className="sq-modal__title">纠错反馈</h3>
                <button
                  className="sq-modal__close"
                  onClick={() => setShowFeedback(false)}
                >
                  ✕
                </button>
              </div>
              <div className="sq-modal__body">
                <div className="sq-modal__field">
                  <label className="sq-modal__label">反馈类型</label>
                  <select
                    className="sq-modal__select"
                    value={feedbackType}
                    onChange={(e) => setFeedbackType(e.target.value)}
                  >
                    <option>内容有误</option>
                    <option>时效过期</option>
                    <option>逻辑不通</option>
                    <option>其他问题</option>
                  </select>
                </div>
                <div className="sq-modal__field">
                  <label className="sq-modal__label">详细说明</label>
                  <textarea
                    className="sq-modal__textarea"
                    placeholder="请描述具体错误内容..."
                    value={feedbackDetail}
                    onChange={(e) => setFeedbackDetail(e.target.value)}
                  />
                </div>
                <button
                  className="sq-modal__submit"
                  onClick={handleSubmitFeedback}
                  disabled={feedbackSubmitting}
                >
                  {feedbackSubmitting ? '提交中...' : '提交反馈'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toastMsg && (
          <div
            style={{
              position: 'fixed',
              top: 80,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--color-neutral-900)',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '999px',
              fontSize: 'var(--font-size-l5)',
              fontWeight: 'var(--font-weight-bold)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 'var(--z-toast)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-sm)',
            }}
          >
            ✅ {toastMsg}
          </div>
        )}
      </div>
    </PageContainer>
  )
}
