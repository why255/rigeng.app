import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import './admin.css'

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

const MOCK_PROJECTS = [
  { id: 'p1', name: '某科技公司HR体系搭建', student: '学员3', progress: 75, status: '进行中', node: '方案评审', node_deadline: '2026-07-15' },
  { id: 'p2', name: '某新能源企业组织诊断', student: '学员5', progress: 40, status: '进行中', node: '数据收集', node_deadline: '2026-07-10' },
  { id: 'p3', name: '某金融集团薪酬体系优化', student: '学员8', progress: 90, status: '收尾中', node: '最终交付', node_deadline: '2026-07-05' },
]

export function TeacherCollaboration() {
  const navigate = useNavigate()

  useEffect(() => {
    if (getMyRole() !== 'teacher') { navigate('/', { replace: true }); return }
  }, [navigate])

  return (
          <div className="adm-page">
        <h2>项目协作</h2>

        <div className="adm-dashboard" style={{ gap: 'var(--spacing-lg)' }}>
          {MOCK_PROJECTS.map((p) => (
            <div key={p.id} className="adm-panel">
              <div className="adm-panel__header">
                <div>
                  <span className="adm-panel__title">{p.name}</span>
                  <span className="adm-tag adm-tag--primary" style={{ marginLeft: 8 }}>{p.student}</span>
                </div>
                <span className={`adm-tag ${p.status === '进行中' ? 'adm-tag--advance' : 'adm-tag--active'}`}>{p.status}</span>
              </div>
              <div className="adm-panel__body">
                {/* 进度条 */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: 'var(--color-neutral-500)' }}>进度</span>
                    <span style={{ fontWeight: 600 }}>{p.progress}%</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--color-neutral-50)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${p.progress}%`, background: p.progress > 80 ? 'var(--color-success)' : 'var(--color-brand-primary)', borderRadius: 4, transition: 'width 0.3s' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <div>
                    <span style={{ color: 'var(--color-neutral-500)' }}>当前节点：</span>
                    <span style={{ fontWeight: 600 }}>{p.node}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-neutral-500)' }}>截止日期：</span>
                    <span style={{ fontWeight: 600, color: new Date(p.node_deadline) < new Date() ? 'var(--color-error)' : undefined }}>
                      {p.node_deadline}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
  )
}
