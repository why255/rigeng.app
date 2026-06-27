import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { qaAnswerData as mockAnswerData } from '@/data/mock'
import { useToast } from '@/components/primitives/toast'
import * as qaApi from '@/api/smart-qa'
import type { QaAnswer } from '@/api/smart-qa'
import '../pages.css'
import './smart-qa.css'

/** M5-P2 智能问答对话页 — 对话流 + 四要素答案卡片 + 来源引用 + 追问 */
export function SmartQAChat() {
  const [searchParams] = useSearchParams()
  const initialQ = searchParams.get('q') || '试用期员工不符合录用条件，如何合规解除？'
  const toast = useToast()
  const [followUp, setFollowUp] = useState('')
  const [showThinking, setShowThinking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [answer, setAnswer] = useState<QaAnswer | null>(null)
  const [useMock, setUseMock] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 初始化加载 — 发起首次提问
  useEffect(() => {
    let cancelled = false
    async function ask() {
      setLoading(true)
      try {
        const res = await qaApi.askQuestion({ question: initialQ })
        if (!cancelled) {
          setConversationId(res.conversation_id)
          setAnswer(res.answer)
          setUseMock(false)
        }
      } catch {
        if (!cancelled) {
          setUseMock(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    ask()
    return () => { cancelled = true }
  }, [initialQ])

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [answer, showThinking])

  const d = useMock ? mockAnswerData : answer
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
        })),
        source: answer.source ? {
          title: answer.source.title,
          library: answer.source.library,
          updated: answer.source.updated_at,
          verified: answer.source.verified,
        } : mockAnswerData.source,
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

  const handleSaveSOP = async () => {
    if (answer?.id) {
      try {
        const res = await qaApi.archiveAnswer(answer.id)
        toast(`+${res.contribution_value} 贡献值`, 'success')
      } catch {
        toast('+20 贡献值', 'success')
      }
    } else {
      toast('+20 贡献值', 'success')
    }
  }

  const handleHelpful = async () => {
    if (answer?.id) {
      try {
        await qaApi.markHelpful(answer.id)
      } catch {
        // silent
      }
    }
  }

  const handleFollowUp = async () => {
    if (!followUp.trim()) return
    setShowThinking(true)
    try {
      const res = await qaApi.askQuestion({
        question: followUp.trim(),
        conversation_id: conversationId,
      })
      setAnswer(res.answer)
      setUseMock(false)
    } catch {
      // keep existing answer
    } finally {
      setShowThinking(false)
      setFollowUp('')
    }
  }

  return (
    <PageContainer width="chat">
      <div data-module="smart-qa">
        <div className="sqa-chat">
          <div className="sqa-chat__scroll" ref={scrollRef}>
            {/* 加载状态 */}
            {loading && (
              <div className="sqa-thinking">
                <div className="sqa-thinking__avatar">耕</div>
                <div className="sqa-thinking__text">
                  <span>小耕正在思考</span>
                  <span className="sqa-thinking__dots">
                    <span className="sqa-thinking__dot" />
                    <span className="sqa-thinking__dot" />
                    <span className="sqa-thinking__dot" />
                  </span>
                </div>
              </div>
            )}
            {/* 小耕开场 */}
            <div className="sqa-msg">
              <div className="sqa-msg__avatar sqa-msg__avatar--assistant">耕</div>
              <div className="sqa-msg__bubble sqa-msg__bubble--assistant">
                {d.conversationIntro}
              </div>
            </div>

            {/* 用户提问 */}
            <div className="sqa-msg sqa-msg--user">
              <div className="sqa-msg__bubble sqa-msg__bubble--user">
                {initialQ}
              </div>
              <div className="sqa-msg__avatar sqa-msg__avatar--user">👤</div>
            </div>

            {/* 小耕回复 + 四要素卡片 */}
            <div className="sqa-msg">
              <div className="sqa-msg__avatar sqa-msg__avatar--assistant">耕</div>
              <div style={{ flex: 1 }}>
                <div className="sqa-msg__bubble sqa-msg__bubble--assistant" style={{ marginBottom: 16 }}>
                  {d.intro}
                </div>

                {/* 四要素卡片 */}
                <div className="sqa-elements">
                  {d.elements.map((el) => (
                    <div key={el.key} className="sqa-element-card" style={{ borderLeftColor: el.color }}>
                      <div className="sqa-element-card__header" style={{ color: el.color }}>
                        <span>{el.icon}</span>
                        <span>{el.title}</span>
                      </div>
                      <p className="sqa-element-card__text">{el.summary}</p>
                    </div>
                  ))}
                </div>

                {/* 来源引用 */}
                <div className="sqa-source-bar" style={{ marginTop: 16, marginBottom: 16 }}>
                  <div className="sqa-source-bar__left">
                    <span className="sqa-source-bar__icon">📄</span>
                    <div>
                      <p className="sqa-source-bar__title">{d.source.title}</p>
                      <p className="sqa-source-bar__meta">
                        所属库：{d.source.library} | 更新：{d.source.updated}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="sqa-source-badge" style={{ background: '#E8F5E9', color: '#4CAF50', border: '1px solid #C8E6C9' }}>
                      文档较新
                    </span>
                    <a href="/m/smart-qa/detail" style={{ fontSize: 10, color: 'var(--module-color-primary)', fontWeight: 700 }}>
                      详情
                    </a>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="sqa-actions">
                  <button className="sqa-action-btn sqa-action-btn--primary" onClick={handleSaveSOP}>
                    💾 存为 SOP
                  </button>
                  <button className="sqa-action-btn sqa-action-btn--secondary" onClick={handleHelpful}>
                    👍 有帮助
                  </button>
                </div>
              </div>
            </div>

            {/* 思考动画 */}
            {showThinking && (
              <div className="sqa-thinking">
                <div className="sqa-thinking__avatar">耕</div>
                <div className="sqa-thinking__text">
                  <span>小耕正在思考</span>
                  <span className="sqa-thinking__dots">
                    <span className="sqa-thinking__dot" />
                    <span className="sqa-thinking__dot" />
                    <span className="sqa-thinking__dot" />
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 底部追问输入框 */}
        <div className="sqa-composer">
          <div className="sqa-composer__inner">
            <input
              className="sqa-composer__input"
              type="text"
              placeholder="追问一下…"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFollowUp()}
            />
            <div className="sqa-composer__actions">
              <button className="sqa-composer__mic">🎤</button>
              <button className="sqa-composer__send" onClick={handleFollowUp}>➤</button>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
