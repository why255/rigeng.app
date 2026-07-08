import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import './admin.css'

interface Question {
  id: string
  dimension: string
  question: string
  type: 'single' | 'multiple' | 'scale' | 'text'
  options: string[]
  sort_order: number
}

const MOCK_QUESTIONS: Question[] = [
  { id: 'q1', dimension: 'A 职业能力', question: '您目前的专业领域工作年限？', type: 'single', options: ['1-3年', '3-5年', '5-10年', '10年以上'], sort_order: 1 },
  { id: 'q2', dimension: 'A 职业能力', question: '您是否有管理团队的经验？', type: 'single', options: ['无', '1-3人', '3-10人', '10人以上'], sort_order: 2 },
  { id: 'q3', dimension: 'B 转型动机', question: '您为什么考虑职业转型？（可多选）', type: 'multiple', options: ['薪资天花板', '行业前景', '工作倦怠', '个人兴趣', '家庭原因'], sort_order: 3 },
  { id: 'q4', dimension: 'B 转型动机', question: '您的转型紧迫程度自评（1-10分）', type: 'scale', options: ['1', '5', '10'], sort_order: 4 },
  { id: 'q5', dimension: 'S 个人优势', question: '请描述您最有成就感的职业经历', type: 'text', options: [], sort_order: 5 },
  { id: 'q6', dimension: 'S 个人优势', question: '您的核心竞争力是什么？（可多选）', type: 'multiple', options: ['技术能力', '管理能力', '沟通能力', '创新能力', '执行能力'], sort_order: 6 },
]

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

export function AdminSettingsAbs() {
  const navigate = useNavigate()
  const [questions, setQuestions] = useState(MOCK_QUESTIONS)
  const [dimensionFilter, setDimensionFilter] = useState('')

  useEffect(() => {
    if (getMyRole() !== 'superadmin') { navigate('/', { replace: true }); return }
  }, [navigate])

  const dimensions = [...new Set(questions.map((q) => q.dimension))]
  const filtered = dimensionFilter ? questions.filter((q) => q.dimension === dimensionFilter) : questions

  return (
          <div className="adm-page">
        <h2>ABS 诊断问卷管理</h2>

        <div className="adm-toolbar">
          <select className="adm-search" style={{ width: 180 }} value={dimensionFilter}
            onChange={(e) => setDimensionFilter(e.target.value)}>
            <option value="">全部维度</option>
            {dimensions.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <div style={{ flex: 1 }} />
          <button className="adm-btn adm-btn--primary adm-btn--sm">
            <Icon icon="mingcute:add-line" width={14} /> 添加题目
          </button>
        </div>

        <div className="adm-panel" style={{ overflow: 'hidden' }}>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>维度</th>
                  <th>题目</th>
                  <th>类型</th>
                  <th>选项</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((q) => (
                  <tr key={q.id}>
                    <td>{q.sort_order}</td>
                    <td><span className="adm-tag adm-tag--primary">{q.dimension}</span></td>
                    <td style={{ fontWeight: 500 }}>{q.question}</td>
                    <td>
                      <span className="adm-tag adm-tag--advance">
                        {{ single: '单选', multiple: '多选', scale: '量表', text: '文本' }[q.type]}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 300 }}>
                        {q.options.map((opt, i) => (
                          <span key={i} style={{ fontSize: 12, color: 'var(--color-neutral-500)', background: 'var(--color-neutral-25)', padding: '1px 6px', borderRadius: 99 }}>{opt}</span>
                        ))}
                        {q.type === 'text' && <span style={{ fontSize: 12, color: 'var(--color-neutral-300)' }}>自由文本</span>}
                      </div>
                    </td>
                    <td>
                      <div className="adm-actions">
                        <button className="adm-btn adm-btn--outline adm-btn--sm">编辑</button>
                        <button className="adm-btn adm-btn--danger adm-btn--sm">删除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
  )
}
