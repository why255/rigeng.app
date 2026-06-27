import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { BrandSlogan } from '@rigeng/shared/components/business/BrandSlogan'
import { getModuleBySlug } from '@rigeng/shared/data/modules'
import {
  askQuestion,
  archiveAnswer,
  submitFeedback,
  markHelpful,
  type SourceEngine,
  type QaAnswer,
  type AskResponse,
} from '@rigeng/shared/api/smartQa'
import '../pages.css'
import './smart-qa.css'

const MODULE = getModuleBySlug('smart-qa')!

/** M5-P2 智能问答对话页（PC） — 三源开关 + 四要素答案 + 思考动画 + 真实API */
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
  const [currentAnswerId, setCurrentAnswerId] = useState<string | undefined>(undefined)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  // 初始化对话
  useEffect(() => {
    setMessages([
      { role: 'assistant', text: '你好！我是小耕，你的 HR 智能助手。有什么问题尽管问我~' },
    ])
    if (initialQuestion) {
      handleAsk(initialQuestion)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion])

  // 自动滚动到底部
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

    // 如果非初始问题，添加到消息列表
    if (q !== initialQuestion || messages.length > 1) {
      setMessages((prev) => [...prev, { role: 'user', text: userMsg }])
    }

    try {
      const engineConfig: SourceEngine[] = engines.map((e) => ({ ...e }))
      const result: AskResponse = await askQuestion(userMsg, conversationId, engineConfig)

      // 保存 conversation_id 用于追问
      setConversationId(result.conversation_id)

      if (result.is_clarification) {
        // 需要追问澄清
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
        // 有最终答案
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: result.answer!.intro,
            answer: result.answer,
          },
        ])
        setCurrentAnswerId(result.answer.id)
        setHelpfulClicked(false)
        setSuggestions(result.suggestions || [])
      } else {
        // 无答案（异常情况）
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

  // 引擎标签
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
              <BrandSlogan module={MODULE} compact />

              {/* 三源知识引擎开关（对话页顶部） */}
              <div
                style={{
                  background: 'var(--color-brand-white)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-neutral-100)',
                  padding: 'var(--spacing-lg)',
                  marginBottom: 'var(--spacing-xl)',
                }}
              >
                <h4
                  style={{
                    fontSize: 'var(--font-size-l5)',
                    fontWeight: 'var(--font-weight-bold)',
                    color: 'var(--color-neutral-900)',
                    marginBottom: 'var(--spacing-md)',
                  }}
                >
                  知识引擎驱动
                </h4>
                <div style={{ display: 'flex', gap: 'var(--spacing-2xl)' }}>
                  {engines.map((eng) => (
                    <div
                      key={eng.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-sm)',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 'var(--font-size-l6)',
                          color: eng.enabled
                            ? 'var(--color-neutral-900)'
                            : 'var(--color-neutral-500)',
                        }}
                      >
                        {engineLabels[eng.key] || eng.key}
                      </span>
                      {eng.key === 'internet' && eng.enabled && (
                        <span
                          style={{
                            fontSize: 10,
                            color: 'var(--color-neutral-500)',
                          }}
                        >
                          请核实
                        </span>
                      )}
                      <button
                        className={`sq-engine-toggle ${
                          eng.enabled ? 'sq-engine-toggle--on' : 'sq-engine-toggle--off'
                        }`}
                        onClick={() => toggleEngine(eng.key)}
                        aria-label={`切换${eng.key}`}
                      >
                        <div className="sq-engine-toggle__thumb" />
                      </button>
                    </div>
                  ))}
                </div>
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

                  {/* 四要素答案卡片 */}
                  {msg.answer && (
                    <div style={{ marginLeft: 52, marginBottom: 'var(--spacing-xl)' }}>
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
                          <div className="sq-source__info">
                            <span className="sq-source__icon">📄</span>
                            <div>
                              <p className="sq-source__title">
                                {msg.answer.source.title}
                              </p>
                              <p className="sq-source__meta">
                                所属库：{msg.answer.source.library} | 更新：
                                {msg.answer.source.updated_at}
                              </p>
                            </div>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--spacing-sm)',
                            }}
                          >
                            <span className="sq-source__tag">
                              {msg.answer.source.is_internet
                                ? '请核实'
                                : msg.answer.source.is_stale
                                ? '内容较旧'
                                : msg.answer.source.label}
                            </span>
                            <a
                              className="sq-source__link"
                              href={`/m/smart-qa/detail?id=${msg.answer.id}`}
                              onClick={(e) => {
                                e.preventDefault()
                                navigate(`/m/smart-qa/detail?id=${msg.answer!.id}`)
                              }}
                            >
                              详情
                            </a>
                          </div>
                        </div>
                      )}

                      {/* 防幻觉标注 */}
                      {msg.answer.source?.is_internet && (
                        <div
                          style={{
                            marginBottom: 'var(--spacing-md)',
                            padding: 'var(--spacing-md)',
                            background: '#FFF9E6',
                            borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--font-size-l6)',
                            color: '#B8860B',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-sm)',
                          }}
                        >
                          ⚠️ 互联网来源 · 请核实 — 该信息检索自外部网络，可能存在时效性或准确性偏差。
                        </div>
                      )}
                      {msg.answer.source?.is_stale && (
                        <div
                          style={{
                            marginBottom: 'var(--spacing-md)',
                            padding: 'var(--spacing-md)',
                            background: '#FFF0E5',
                            borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--font-size-l6)',
                            color: '#D2691E',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-sm)',
                          }}
                        >
                          ⏰ 内容较旧 · 请注意时效 — 该文档更新已超过 12 个月，建议结合最新法律法规查阅。
                        </div>
                      )}

                      {/* 操作按钮 */}
                      <div className="sq-actions">
                        <button
                          className="sq-btn-save"
                          onClick={() => handleArchive(msg.answer!.id)}
                        >
                          💾 存为 SOP
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
                          {helpfulClicked ? '👍 已反馈' : '👍 有帮助'}
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
                    marginLeft: 52,
                    marginBottom: 'var(--spacing-xl)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 'var(--spacing-sm)',
                  }}
                >
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '999px',
                        border: '1px solid var(--color-neutral-200)',
                        background: 'var(--color-brand-white)',
                        fontSize: 'var(--font-size-l6)',
                        color: 'var(--color-neutral-700)',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        setInputValue(s)
                        handleAsk(s)
                      }}
                    >
                      💡 {s}
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
                      <span
                        className="sq-thinking__dot"
                        style={{ animationDelay: '0s' }}
                      />
                      <span
                        className="sq-thinking__dot"
                        style={{ animationDelay: '0.2s' }}
                      />
                      <span
                        className="sq-thinking__dot"
                        style={{ animationDelay: '0.4s' }}
                      />
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
                <button className="sq-composer__mic" aria-label="语音输入">
                  🎤
                </button>
                <button
                  className="sq-composer__send"
                  onClick={handleSend}
                  aria-label="发送"
                >
                  📤
                </button>
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
