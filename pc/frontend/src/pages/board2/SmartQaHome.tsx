import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { MAIN_SLOGAN } from '@/shared/data/modules'
import { fetchHotQuestions, type HotQuestion } from '@/shared/api/smartQa'
import '../pages.css'
import './smart-qa.css'

/** M5-P1 智能问答首页（PC） — 品牌语 + 大输入框 + 热门问题列表 */
export function SmartQaHome() {
  const navigate = useNavigate()
  const [question, setQuestion] = useState('')
  const [hotQuestions, setHotQuestions] = useState<HotQuestion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchHotQuestions()
      .then(setHotQuestions)
      .catch(() => {
        // 网络错误时使用默认热门问题
        setHotQuestions([
          { id: 'q1', text: '试用期员工不符合录用条件，如何合规解除？' },
          { id: 'q2', text: '薪酬宽带如何设计才能激励老员工？' },
          { id: 'q3', text: '年底绩效面谈怎么引导员工说出真实想法？' },
          { id: 'q4', text: '竞业限制协议在什么情况下可以免除？' },
          { id: 'q5', text: '新员工入职培训体系怎么搭建？' },
          { id: 'q6', text: '裁员补偿金怎么计算才合法？' },
        ])
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = () => {
    const q = question.trim()
    if (!q) return
    navigate(`/m/smart-qa/chat?q=${encodeURIComponent(q)}`)
  }

  const handleHotClick = (id: string, text: string) => {
    navigate(`/m/smart-qa/chat?q=${encodeURIComponent(text)}`)
  }

  return (
    <PageContainer width="dashboard">
      <div data-module="smart-qa">
        <div className="sq-home">
          {/* 品牌 Slogan */}
          <div className="sq-home__brand">
            <p className="sq-home__slogan">{MAIN_SLOGAN}</p>
          </div>

          {/* 品牌语 */}
          <h1 className="sq-home__title">随时随地问，答案不瞎编</h1>

          {/* 大号输入框 */}
          <div className="sq-input-wrap">
            <input
              className="sq-input"
              type="text"
              placeholder="输入你的 HR 问题…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            <button className="sq-send-btn" onClick={handleSubmit} aria-label="发送">
              📤
            </button>
          </div>
          <p className="sq-input-hint">输入你的 HR 问题，小耕帮你找答案~</p>

          {/* 热门问题推荐 */}
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div className="sq-hot__header">
              <span className="sq-hot__icon">🔥</span>
              <span>大家都在问</span>
            </div>
            {loading ? (
              <p style={{ textAlign: 'center', color: 'var(--color-neutral-400)', padding: 'var(--spacing-2xl)' }}>
                加载中...
              </p>
            ) : (
              <div className="sq-hot__grid">
                {hotQuestions.map((q) => (
                  <a
                    key={q.id}
                    className="sq-hot-card"
                    onClick={(e) => {
                      e.preventDefault()
                      handleHotClick(q.id, q.text)
                    }}
                    href={`/m/smart-qa/chat?q=${encodeURIComponent(q.text)}`}
                  >
                    {q.text}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 小耕 IP 悬浮 */}
        <div
          className="sq-ip-float"
          title="小耕在线"
          onClick={() => navigate('/m/smart-qa/chat')}
        >
          🍃
        </div>
      </div>
    </PageContainer>
  )
}
