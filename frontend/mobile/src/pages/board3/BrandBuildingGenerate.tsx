import { useState } from 'react'
import { PageContainer } from '@/components/layout/AppShell'
import { useToast } from '@rigeng/shared/components/primitives/toast'
import '../pages.css'
import './brand-building.css'

/** P2 内容生成 — 静态 mock 数据 */
const SOP = {
  title: '分享一个职场成长小故事',
  source: '携君库模板 / 系统推荐',
}

const CONTENT_TYPES = [
  { key: 'story', label: '职场故事' },
  { key: 'insight', label: '专业见解' },
  { key: 'observe', label: '行业观察' },
  { key: 'review', label: '个人复盘' },
]

const QUICK_TAGS = ['#HR转型', '#团队管理', '#薪酬设计', '#面试技巧']

const RESULT = {
  title: '从HR到HRBP，我的三年转型之路',
  wordCount: 1200,
  readTime: '5分钟',
  toneMatch: 92,
  tags: ['职场成长', 'HR转型', '个人品牌'],
  content:
    '三年前，我还是一名普通的HR专员，每天处理着员工的入职离职、社保公积金……' +
    '直到有一天，我的领导问我："你有没有想过往HRBP方向发展？"' +
    '这句话像一颗种子，在我心里扎下了根。从那时起，我开始主动学习业务知识，' +
    '参与部门会议，理解业务部门的真实需求……\n\n' +
    '转型之路并不平坦。刚开始参加业务会议时，我几乎听不懂他们在讨论什么。' +
    'KPI、OKR、ROI……这些名词对我来说都是陌生的。但我没有退缩，' +
    '每次听不懂的地方就记下来，会后查资料、问同事。慢慢地，我开始理解业务的逻辑，' +
    '也开始能够在会议上提出一些有价值的问题……',
}

/** M8-P2 内容生成 — AI 公众号文章生成 + 编辑操作 */
export function BrandBuildingGenerate() {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('story')
  const [prompt, setPrompt] = useState('')
  const [showResult, setShowResult] = useState(false)

  const handleTagClick = (tag: string) => {
    setPrompt((prev) => (prev ? `${prev} ${tag}` : tag))
  }

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast('请输入您想写的主题或关键词', 'warning')
      return
    }
    setShowResult(true)
    toast('内容生成成功', 'success')
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(RESULT.content).then(() => {
      toast('已复制到剪贴板', 'success')
    })
  }

  const handleSaveDraft = () => {
    toast('草稿已保存', 'success')
  }

  return (
    <PageContainer width="dashboard">
      <div data-module="brand-building">
        {/* 页面头部 */}
        <div className="bb-page-header">
          <p className="bb-slogan">日耕朝夕，耕愈工作，耕暖生活</p>
          <div className="bb-page-header__row">
            <h3 className="bb-brand-sub">踏实做自己，光芒自然来</h3>
            <span className="bb-page-badge">内容生成</span>
          </div>
        </div>

        {/* 试用期提示条 */}
        <div className="bb-trial-banner">
          <span className="bb-trial-banner__icon">🧪</span>
          <span className="bb-trial-banner__text">
            试用期每日可生成 1 次内容，今日剩余 0 次
          </span>
          <span className="bb-trial-banner__link">升级解锁 →</span>
        </div>

        {/* SOP 推荐卡片 */}
        <div className="bb-sop-card" style={{ cursor: 'default' }}>
          <div className="bb-sop-card__left">
            <div className="bb-sop-card__icon">💡</div>
            <div className="bb-sop-card__info">
              <div className="bb-sop-card__title">今日推荐：{SOP.title}</div>
              <div className="bb-sop-card__meta">
                <span className="bb-sop-card__source">{SOP.source}</span>
              </div>
            </div>
          </div>
          <button
            className="bb-sop-card__btn"
            onClick={() => setPrompt(`分享我的职场成长故事`)}
          >
            使用此 SOP
          </button>
        </div>

        {/* 内容类型标签 */}
        <div className="bb-tab-bar">
          {CONTENT_TYPES.map((t) => (
            <button
              key={t.key}
              className={`bb-tab ${activeTab === t.key ? 'bb-tab--active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 输入区 */}
        <div className="bb-input-card">
          <div className="bb-input-card__label">✏️ 输入主题或关键词</div>
          <textarea
            className="bb-input-card__textarea"
            placeholder="例如：分享一次跨部门协作的经历，突出沟通技巧和项目成果……"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="bb-tag-chips">
            {QUICK_TAGS.map((tag) => (
              <span key={tag} className="bb-tag-chip" onClick={() => handleTagClick(tag)}>
                {tag}
              </span>
            ))}
          </div>
          <button className="bb-generate-btn" onClick={handleGenerate}>
            ✨ 生成内容
          </button>
        </div>

        {/* 生成结果 */}
        {showResult && (
          <div className="bb-result-card">
            <div className="bb-result-card__header">
              <div className="bb-result-card__title">{RESULT.title}</div>
              <div className="bb-result-card__meta">
                <span className="bb-result-card__stat">📄 {RESULT.wordCount}字</span>
                <span className="bb-result-card__stat">⏱️ 预计阅读 {RESULT.readTime}</span>
                <span className="bb-tone-badge">✨ 调性匹配 {RESULT.toneMatch}%</span>
              </div>
              <div className="bb-result-card__tags">
                {RESULT.tags.map((t) => (
                  <span key={t} className="bb-result-card__tag">{t}</span>
                ))}
              </div>
            </div>
            <div className="bb-result-card__content">{RESULT.content}</div>
            <div className="bb-result-card__toolbar">
              <button className="bb-tool-btn">✏️ 编辑</button>
              <button className="bb-tool-btn" onClick={handleCopy}>📋 复制</button>
              <button className="bb-tool-btn" onClick={handleGenerate}>🔄 重新生成</button>
              <button className="bb-tool-btn">📁 归档至知识库</button>
            </div>
          </div>
        )}

        {/* 操作按钮行 */}
        <div className="bb-action-row">
          <button className="bb-action-btn bb-action-btn--primary">
            🚀 立即发布
          </button>
          <button className="bb-action-btn bb-action-btn--secondary" onClick={handleSaveDraft}>
            💾 保存草稿
          </button>
          <button className="bb-action-btn bb-action-btn--locked" disabled>
            🔒 定时发布 · 中级VIP解锁
          </button>
        </div>
      </div>
    </PageContainer>
  )
}
