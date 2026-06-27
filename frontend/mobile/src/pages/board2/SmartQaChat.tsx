import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import {
  askQuestion,
  archiveAnswer,
  markHelpful,
  type SourceEngine,
  type QaAnswer,
  type AskResponse,
} from '@rigeng/shared/api/smartQa'
import '../pages.css'
import './smart-qa.css'

/** M5-P2 智能问答对话页（Mobile） — 三源开关 + 四要素答案 + 思考动画 + 真实API */
export function SmartQaChat() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialQuestion = searchParams.get('q') || ''

  const [engines, setEngines] = useState<SourceEngine[]>([
    { key: 'private', enabled: true },
    { key: 'xiejun', enabled: true },
    { key: 'internet', enabled: false },
  ])
  const [messages, setMessages] = useState<
    { role: 'assistant' | 'user'; text: string; answer?: QaAnswer | null }[]
  >([])
  const [inputValue, setInputValue] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [helpfulClicked, setHelpfulClicked] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>(undefined)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages([
      { role: 'assistant', text: '你好！我是小耕，你的 HR 智能助手。有什么问题尽管问我~' },
    ])
    if (initialQuestion) {
      handleAsk(initialQuestion)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isThinking])

  const toggleEngine = (key: string) => {
    setEngines((prev) =>
      prev.map((e) => (e.key === key ? { ...e, enabled: !e.enabled } : e))
    )
  }

  const handleAsk = async (q: string) => {
    if (!q.trim() || isThinking) return

    setIsThinking(true)
    setSuggestions([])
    const userMsg = q.trim()

    if (q !== initialQuestion || messages.length > 1) {
      setMessages((prev) => [...prev, { role: 'user', text: userMsg }])
    }

    try {
      const engineConfig: SourceEngine[] = engines.map((e) => ({ ...e }))
      const result: AskResponse = await askQuestion(userMsg, conversationId, engineConfig)

      setConversationId(result.conversation_id)

      if (result.is_clarification) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: result.clarification_question || '能再具体说说吗？',
            answer: null,
          },
        ])
        setSuggestions(result.suggestions || [])
      } else if (result.answer) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: result.answer!.intro,
            answer: result.answer,
          },
        ])
        setHelpfulClicked(false)
        setSuggestions(result.suggestions || [])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: '抱歉，暂时无法生成答案。请换个问题试试~',
            answer: null,
          },
        ])
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: err?.message || '网络请求失败，请检查网络后重试。',
          answer: null,
        },
      ])
    } finally {
      setIsThinking(false)
    }
  }

  const handleSend = () => {
    const q = inputValue.trim()
    if (!q || isThinking) return
    setInputValue('')
    handleAsk(q)
  }

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 2000)
  }

  const handleArchive = async (answerId: string) => {
    try {
      const result = await archiveAnswer(answerId)
      if (result.success) {
        showToast(`+${result.contribution_value} 贡献值`)
      } else {
        showToast('归档失败，请重试')
      }
    } catch {
      showToast('归档失败，请重试')
    }
  }

  const handleHelpful = async (answerId: string) => {
    if (helpfulClicked) return
    try {
      await markHelpful(answerId)
      setHelpfulClicked(true)
      showToast('感谢反馈！')
    } catch {
      showToast('反馈失败，请重试')
    }
  }

  const engineLabels: Record<string, string> = {
    private: '🔒 私有库',
    xiejun: '👥 携君库',
    internet: '🌐 互联网',
  }

  return (
    <PageContainer width="chat">
      <div data-module="smart-qa">
        <div className="sq-chat">
          {/* 对话滚动区 */}
          <div className="sq-chat__scroll" ref={scrollRef}>
            <div className="sq-chat__inner">
              {/* 品牌语（紧凑） */}
              <div style={{ textAlign: 'center', padding: '8px 0', marginBottom: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-neutral-500)' }}>
                  随时随地问，答案不瞎编
                </p>
              </div>

              {/* 三源知识引擎开关 */}
              <div className="sq-engines-mobile">
                <h4 className="sq-engines-mobile__title">知识引擎</h4>
                {engines.map((eng) => (
                  <div key={eng.key} className="sq-engine-row">
                    <div>
                      <span className="sq-engine-row__label">
                        {engineLabels[eng.key] || eng.key}
                      </span>
                      {eng.key === 'internet' && eng.enabled && (
                        <span className="sq-engine-row__hint">请核实</span>
                      )}
                    </div>
                    <button
                      className={`sq-engine-toggle ${
                        eng.enabled ? 'sq-engine-toggle--on' : 'sq-engine-toggle--off'
                      }`}
                      onClick={() => toggleEngine(eng.key)}
                    >
                      <div className="sq-engine-toggle__thumb" />
                    </button>
                  </div>
                ))}
              </div>

              {/* 消息列表 */}
              {messages.map((msg, i) => (
                <div key={i}>
                  <div
                    className={`sq-msg ${
                      msg.role === 'user' ? 'sq-msg--user' : 'sq-msg--assistant'
                    }`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="sq-msg__avatar">耕</div>
                    )}
                    <div className="sq-msg__bubble">{msg.text}</div>
                    {msg.role === 'user' && (
                      <div className="sq-msg__avatar sq-msg__avatar--user">👤</div>
                    )}
                  </div>

                  {msg.answer && (
                    <div style={{ marginLeft: 44, marginBottom: 24 }}>
                      {/* 四要素卡片 */}
                      <div className="sq-elements">
                        {msg.answer.elements.map((el) => (
                          <div
                            key={el.key}
                            className="sq-element-card"
                            style={{ ['--sq-el-color' as string]: el.color }}
                          >
                            <div
                              className="sq-element-card__header"
                              style={{ color: el.color }}
                            >
                              <span>{el.icon}</span>
                              <span>{el.title}</span>
                            </div>
                            <p className="sq-element-card__text">{el.summary}</p>
                          </div>
                        ))}
                      </div>

                      {/* 来源引用 */}
                      {msg.answer.source && (
                        <div className="sq-source">
                          <div className="sq-source__row">
                            <span className="sq-source__icon">📄</span>
                            <p className="sq-source__title">
                              {msg.answer.source.title}
                            </p>
                          </div>
                          <div className="sq-source__meta-row">
                            <span className="sq-source__meta">
                              {msg.answer.source.library} | {msg.answer.source.updated_at}
                            </span>
                            <a
                              className="sq-source__link"
                              onClick={(e) => {
                                e.preventDefault()
                                navigate(`/m/smart-qa/detail?id=${msg.answer!.id}&conv=${conversationId || ''}`)
                              }}
                              href={`/m/smart-qa/detail?id=${msg.answer.id}&conv=${conversationId || ''}`}
                            >
                              查看详情
                            </a>
                          </div>
                        </div>
                      )}

                      {/* 防幻觉标注 */}
                      {msg.answer.source?.is_internet && (
                        <div
                          style={{
                            marginBottom: 12,
                            padding: '8px 12px',
                            background: '#FFF9E6',
                            borderRadius: 8,
                            fontSize: 11,
                            color: '#B8860B',
                          }}
                        >
                          ⚠️ 互联网来源 · 请核实
                        </div>
                      )}
                      {msg.answer.source?.is_stale && (
                        <div
                          style={{
                            marginBottom: 12,
                            padding: '8px 12px',
                            background: '#FFF0E5',
                            borderRadius: 8,
                            fontSize: 11,
                            color: '#D2691E',
                          }}
                        >
                          ⏰ 内容较旧 · 请注意时效
                        </div>
                      )}

                      {/* 操作按钮 */}
                      <div className="sq-actions">
                        <button
                          className="sq-btn-save"
                          onClick={() => handleArchive(msg.answer!.id)}
                        >
                          存为 SOP
                        </button>
                        <button
                          className="sq-btn-helpful"
                          onClick={() => handleHelpful(msg.answer!.id)}
                          style={
                            helpfulClicked
                              ? { color: 'var(--module-color-primary)', borderColor: 'var(--module-color-primary)' }
                              : undefined
                          }
                        >
                          {helpfulClicked ? '已反馈' : '有帮助'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* 追问建议 */}
              {suggestions.length > 0 && !isThinking && (
                <div
                  style={{
                    marginLeft: 44,
                    marginBottom: 24,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  {suggestions.slice(0, 3).map((s, idx) => (
                    <button
                      key={idx}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 16,
                        border: '1px solid var(--color-neutral-200)',
                        background: 'var(--color-brand-white)',
                        fontSize: 11,
                        color: 'var(--color-neutral-600)',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        setInputValue(s)
                        handleAsk(s)
                      }}
                    >
                      💡 {s.slice(0, 30)}...
                    </button>
                  ))}
                </div>
              )}

              {/* 思考等待动画 */}
              {isThinking && (
                <div className="sq-thinking">
                  <div className="sq-thinking__avatar">耕</div>
                  <div className="sq-thinking__text">
                    <span className="sq-thinking__label">小耕正在思考</span>
                    <div className="sq-thinking__dots">
                      <span className="sq-thinking__dot" style={{ animationDelay: '0s' }} />
                      <span className="sq-thinking__dot" style={{ animationDelay: '0.2s' }} />
                      <span className="sq-thinking__dot" style={{ animationDelay: '0.4s' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 底部输入框 */}
          <div className="sq-composer">
            <div className="sq-composer__inner">
              <input
                className="sq-composer__input"
                type="text"
                placeholder="追问一下…"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <div className="sq-composer__actions">
                <button className="sq-composer__mic">🎤</button>
                <button className="sq-composer__send" onClick={handleSend}>📤</button>
              </div>
            </div>
          </div>
        </div>

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
            }}
          >
            ✅ {toastMsg}
          </div>
        )}
      </div>
    </PageContainer>
  )
}
