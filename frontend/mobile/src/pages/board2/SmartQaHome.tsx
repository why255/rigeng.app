import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { BrandSlogan } from '@rigeng/shared/components/business/BrandSlogan'
import { getModuleBySlug } from '@rigeng/shared/data/modules'
import { fetchHotQuestions, type HotQuestion } from '@rigeng/shared/api/smartQa'
import '../pages.css'
import './smart-qa.css'

const MODULE = getModuleBySlug('smart-qa')!

/** M5-P1 智能问答首页（Mobile） — 品牌语 + 输入框 + 热门问题列表 */
export function SmartQaHome() {
  const navigate = useNavigate()
  const [question, setQuestion] = useState('')
  const [hotQuestions, setHotQuestions] = useState<HotQuestion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchHotQuestions()
      .then(setHotQuestions)
      .catch(() => {
        setHotQuestions([
          { id: 'q1', text: '试用期员工不符合录用条件，如何合规解除？' },
          { id: 'q2', text: '薪酬宽带如何设计才能激励老员工？' },
          { id: 'q3', text: '年底绩效面谈怎么引导员工说出真实想法？' },
          { id: 'q4', text: '竞业限制协议在什么情况下可以免除？' },
        ])
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = () => {
    const q = question.trim()
    if (!q) return
    navigate(`/m/smart-qa/chat?q=${encodeURIComponent(q)}`)
  }

  const handleHotClick = (text: string) => {
    navigate(`/m/smart-qa/chat?q=${encodeURIComponent(text)}`)
  }

  return (
    <PageContainer width="chat">
      <div data-module="smart-qa">
        <div className="sq-home">
          {/* 品牌语 */}
          <BrandSlogan module={MODULE} />

          {/* 输入框 */}
          <div className="sq-input-wrap">
            <input
              className="sq-input"
              type="text"
              placeholder="输入你的 HR 问题…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            <div className="sq-input-wrap__actions">
              <span>🎤</span>
              <span className="sq-input-wrap__send" onClick={handleSubmit}>📤</span>
            </div>
          </div>
          <p className="sq-input-hint">输入你的 HR 问题，小耕帮你找答案~</p>

          {/* 热门话题 */}
          <div>
            <div className="sq-hot__header">
              <span className="sq-hot__icon">🔥</span>
              <span>热门话题</span>
            </div>
            {loading ? (
              <p style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-neutral-400)' }}>
                加载中...
              </p>
            ) : (
              <div className="sq-hot__list">
                {hotQuestions.slice(0, 4).map((q) => (
                  <a
                    key={q.id}
                    className="sq-hot-card"
                    onClick={(e) => {
                      e.preventDefault()
                      handleHotClick(q.text)
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

        {/* 小耕IP */}
        <div className="sq-ip-float">🍃</div>
      </div>
    </PageContainer>
  )
}
