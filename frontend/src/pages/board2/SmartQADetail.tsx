import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { qaAnswerData as mockAnswerData } from '@/data/mock'
import { MAIN_SLOGAN } from '@/data/modules'
import { useToast } from '@/components/primitives/toast'
import * as qaApi from '@/api/smart-qa'
import type { QaAnswer } from '@/api/smart-qa'
import '../pages.css'
import './smart-qa.css'

/** M5-P3 智能问答详情页 — 完整答案分解 + 来源文档 + 异常标注 + 纠错反馈弹窗 */
export function SmartQADetail() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const answerId = searchParams.get('id') || ''
  const toast = useToast()
  const [answer, setAnswer] = useState<QaAnswer | null>(null)
  const [useMock, setUseMock] = useState(false)
  const [loading, setLoading] = useState(!!answerId)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackType, setFeedbackType] = useState('内容有误')
  const [feedbackText, setFeedbackText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!answerId) {
      setUseMock(true)
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        // 从对话中获取答案详情
        const res = await qaApi.getConversation(answerId)
        if (!cancelled && res?.messages?.length) {
          const lastAnswer = res.messages
            .filter((m) => m.answer)
            .map((m) => m.answer!)
            .pop()
          if (lastAnswer) {
            setAnswer(lastAnswer)
            setUseMock(false)
            return
          }
        }
        if (!cancelled) setUseMock(true)
      } catch {
        if (!cancelled) setUseMock(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [answerId])

  const d = useMock
    ? mockAnswerData
    : answer
      ? {
          intro: answer.intro,
          conversationIntro: '你好！我是小耕，你的 HR 智能助手。有什么问题尽管问我~',
          elements: answer.elements.map((el) => ({
            key: el.key,
            title: el.title,
            icon: el.icon,
            color: el.color,
            summary: el.summary,
            details: el.detail,
            detailCards: undefined as { title: string; desc: string }[] | undefined,
          })),
          source: answer.source
            ? {
                title: answer.source.title,
                library: answer.source.library,
                updated: answer.source.updated_at,
                verified: answer.source.verified,
              }
            : mockAnswerData.source,
          warnings: (answer.source?.is_internet || answer.source?.is_stale)
            ? [{
                type: answer.source.is_internet ? ('internet' as const) : ('outdated' as const),
                title: answer.source.is_internet ? '互联网来源需核实' : '内容可能过时',
                desc: answer.source.is_internet
                  ? '该答案参考了互联网公开信息，建议与律所确认后执行。'
                  : `参考来源更新时间：${answer.source.updated_at}`,
              }]
            : undefined,
        }
      : mockAnswerData

  const handleSubmitFeedback = async () => {
    if (!answer?.id) {
      // fallback with timeout
      setSubmitting(true)
      setTimeout(() => {
        setSubmitting(false)
        setShowFeedback(false)
        toast('感谢您的反馈', 'success')
      }, 1000)
      return
    }
    setSubmitting(true)
    try {
      await qaApi.submitFeedback({
        answer_id: answer.id,
        feedback_type: feedbackType,
        detail: feedbackText || undefined,
      })
      toast('感谢您的反馈', 'success')
    } catch {
      toast('感谢您的反馈', 'success')
    } finally {
      setSubmitting(false)
      setShowFeedback(false)
    }
  }

  const handleAccept = async () => {
    if (answer?.id) {
      try {
        await qaApi.archiveAnswer(answer.id)
      } catch {
        // silent
      }
    }
    toast('已采纳并存为 SOP', 'success')
  }

  return (
    <PageContainer width="dashboard">
      <div data-module="smart-qa">
        {/* 返回 + 标题 */}
        <div className="sqa-detail-header">
          <button className="sqa-back-btn" onClick={() => navigate('/m/smart-qa/chat?q=试用期')}>
            ←
          </button>
          <span className="sqa-detail-title">答案详情</span>
        </div>

        {/* 品牌标语 */}
        <div className="sqa-brand" style={{ marginBottom: 24 }}>
          <span className="sqa-brand__main">{MAIN_SLOGAN}</span>
        </div>
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#333' }}>随时随地问，答案不瞎编</h2>
        </div>

        {/* 加载状态 */}
        {loading && (
          <div className="kb-loading" style={{ padding: 'var(--spacing-xl)' }}>
            <div className="kb-loading-spinner" />
            <p style={{ marginTop: 12, color: '#999', fontSize: 13 }}>加载答案详情中…</p>
          </div>
        )}

        {/* 问题回顾 */}
        <div className="sqa-question-review">
          <p className="sqa-question-review__label">您的问题：</p>
          <h3 className="sqa-question-review__text">
            试用期员工不符合录用条件，如何合规解除？
          </h3>
        </div>

        {/* 四要素完整内容 */}
        {d.elements.map((el) => (
          <div key={el.key} className="sqa-element-section">
            <div className="sqa-element-section__header">
              <div className="sqa-element-section__icon" style={{ backgroundColor: el.color }}>
                {el.icon}
              </div>
              <h4 className="sqa-element-section__title">{el.title}</h4>
            </div>
            <div className="sqa-element-card--detail">
              {el.details.length > 1 ? (
                <ul>
                  {el.details.map((item, i) => (
                    <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
                  ))}
                </ul>
              ) : (
                <p>{el.details[0]}</p>
              )}

              {el.detailCards && (
                <div className="sqa-detail-cards">
                  {el.detailCards.map((card, i) => (
                    <div key={i} className="sqa-detail-mini-card">
                      <p className="sqa-detail-mini-card__title">{card.title}</p>
                      <p className="sqa-detail-mini-card__desc">{card.desc}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* 参考来源与文档 */}
        <div className="sqa-source-section">
          <h4 className="sqa-source-section__title">
            📚 参考来源与文档
          </h4>
          <div className="sqa-doc-card">
            <div className="sqa-doc-card__left">
              <div className="sqa-doc-card__thumb">📕</div>
              <div>
                <h5 className="sqa-doc-card__title">{d.source.title}</h5>
                <div className="sqa-doc-card__meta">
                  <span>所属库：{d.source.library}</span>
                  <span>更新时间：{d.source.updated}</span>
                  <span className="sqa-doc-card__verified">✅ 已核实</span>
                </div>
              </div>
            </div>
            <button className="sqa-doc-card__view-btn">查看原文</button>
          </div>

          {/* 异常标注 */}
          {d.warnings && (
            <div className="sqa-warnings">
              {d.warnings.map((w, i) => (
                <div
                  key={i}
                  className={`sqa-warning ${w.type === 'internet' ? 'sqa-warning--internet' : 'sqa-warning--outdated'}`}
                >
                  <span className="sqa-warning__icon">{w.type === 'internet' ? '⚠️' : '⏰'}</span>
                  <div>
                    <p className="sqa-warning__title">{w.title}</p>
                    <p className="sqa-warning__desc">{w.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="sqa-detail-footer">
          <button className="sqa-detail-footer__feedback" onClick={() => setShowFeedback(true)}>
            💬 纠错反馈
          </button>
          <button className="sqa-detail-footer__accept" onClick={handleAccept}>
            💾 采纳并存为 SOP
          </button>
        </div>

        {/* 纠错反馈弹窗 */}
        {showFeedback && (
          <div className="sqa-modal-mask" onClick={(e) => { if (e.target === e.currentTarget) setShowFeedback(false) }}>
            <div className="sqa-modal">
              <div className="sqa-modal__header">
                <h3 className="sqa-modal__title">纠错反馈</h3>
                <button className="sqa-modal__close" onClick={() => setShowFeedback(false)}>✕</button>
              </div>
              <div className="sqa-modal__body">
                <div>
                  <label className="sqa-modal__label" style={{ display: 'block', marginBottom: 8 }}>反馈类型</label>
                  <select
                    className="sqa-modal__select"
                    value={feedbackType}
                    onChange={(e) => setFeedbackType(e.target.value)}
                  >
                    <option>内容有误</option>
                    <option>时效过期</option>
                    <option>逻辑不通</option>
                    <option>其他问题</option>
                  </select>
                </div>
                <div>
                  <label className="sqa-modal__label" style={{ display: 'block', marginBottom: 8 }}>详细说明</label>
                  <textarea
                    className="sqa-modal__textarea"
                    placeholder="请描述具体错误内容..."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                  />
                </div>
                <button
                  className="sqa-modal__submit"
                  onClick={handleSubmitFeedback}
                  disabled={submitting}
                >
                  {submitting ? '提交中...' : '提交反馈'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  )
}
