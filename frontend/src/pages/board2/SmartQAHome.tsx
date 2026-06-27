import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { hotQuestions as mockHotQuestions } from '@/data/mock'
import { MAIN_SLOGAN } from '@/data/modules'
import * as qaApi from '@/api/smart-qa'
import '../pages.css'
import './smart-qa.css'

/** M5-P1 智能问答首页 — 品牌标语 + 大号输入框 + 热门问题推荐 */
export function SmartQAHome() {
  const navigate = useNavigate()
  const [question, setQuestion] = useState('')
  const [hotQuestions, setHotQuestions] = useState<string[]>(mockHotQuestions)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await qaApi.getHotQuestions()
        if (!cancelled && res?.items?.length) {
          setHotQuestions(res.items.map((item) => item.text))
        }
      } catch {
        // keep mock fallback
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const handleAsk = (q?: string) => {
    const query = q || question.trim()
    if (!query) return
    navigate(`/m/smart-qa/chat?q=${encodeURIComponent(query)}`)
  }

  return (
    <PageContainer width="dashboard">
      <div data-module="smart-qa">
        {/* 品牌标语 */}
        <div className="sqa-brand" style={{ marginBottom: 8 }}>
          <span className="sqa-brand__main">{MAIN_SLOGAN}</span>
        </div>
        <div className="sqa-brand" style={{ marginBottom: 48 }}>
          <h1 className="sqa-brand__title">随时随地问，答案不瞎编</h1>
        </div>

        {/* 大号输入框 */}
        <div className="sqa-hero-input" style={{ marginBottom: 12 }}>
          <input
            className="sqa-hero-input__field"
            type="text"
            placeholder="输入你的 HR 问题…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
          />
          <button className="sqa-hero-input__send" onClick={() => handleAsk()}>
            ➤
          </button>
        </div>
        <p className="sqa-hero-input__hint" style={{ marginBottom: 64 }}>
          输入你的 HR 问题，小耕帮你找答案~
        </p>

        {/* 热门问题推荐 */}
        <div className="sqa-hot-section">
          <div className="sqa-hot-header">
            <span className="sqa-hot-header__icon">🔥</span>
            <span className="sqa-hot-header__label">大家都在问</span>
          </div>
          <div className="sqa-hot-grid">
            {hotQuestions.map((q, i) => (
              <a key={i} className="sqa-hot-card" onClick={() => handleAsk(q)}>
                {q}
              </a>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
