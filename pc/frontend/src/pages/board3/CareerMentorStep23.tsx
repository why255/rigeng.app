import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { getApplications, type JobApplication } from '@/api/career'
import '../pages.css'
import './career-mentor.css'

/** M7-P3 STEP 2-3·二定三投 — 资源人脉盘点(灰置) + 投递追踪表(灰置) */
export function CareerMentorStep23() {
  const navigate = useNavigate()
  const [, setApplications] = useState<JobApplication[]>([])

  useEffect(() => {
    getApplications().then(d => {
      if (d && d.applications) setApplications(d.applications)
    }).catch(() => {})
  }, [])

  return (
    <PageContainer width="dashboard">
      <div data-module="career-mentor">
        <div style={{ marginBottom: 32 }}>
          <p className="cm-slogan">日耕朝夕，耕愈工作，耕暖生活</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <h3 className="cm-brand-sub">高维五步法，前程自发光</h3>
            <span className="cm-step-badge">STEP 2-3/5 · 二定三投</span>
          </div>
        </div>

        {/* 资源人脉盘点 (灰置) */}
        <div className="cm-disabled-block">
          <div className="cm-disabled-block__badge">即将上线</div>
          <h4 className="cm-section-title">
            <span style={{ color: '#607D8B' }}>👥</span> 资源人脉盘点
          </h4>
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="cm-disabled-person">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="cm-disabled-person__avatar" />
                <div>
                  <div style={{ height: 16, width: 96, background: 'var(--color-neutral-100)', borderRadius: 4, marginBottom: 8 }} />
                  <div style={{ height: 12, width: 160, background: 'var(--color-neutral-100)', borderRadius: 4 }} />
                </div>
              </div>
              <div style={{ height: 32, width: 80, background: 'var(--color-neutral-100)', borderRadius: 4 }} />
            </div>
            <div className="cm-disabled-person">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="cm-disabled-person__avatar" />
                <div>
                  <div style={{ height: 16, width: 128, background: 'var(--color-neutral-100)', borderRadius: 4, marginBottom: 8 }} />
                  <div style={{ height: 12, width: 192, background: 'var(--color-neutral-100)', borderRadius: 4 }} />
                </div>
              </div>
              <div style={{ height: 32, width: 80, background: 'var(--color-neutral-100)', borderRadius: 4 }} />
            </div>
          </div>
          <p className="cm-disabled-block__note">人脉资源梳理与拓展规划模块开发中...</p>
        </div>

        {/* 投递追踪表 (灰置) */}
        <div className="cm-disabled-block" style={{ marginBottom: 40 }}>
          <div className="cm-disabled-block__badge">即将上线</div>
          <h4 className="cm-section-title">
            <span style={{ color: 'var(--module-color-primary)' }}>📨</span> 投递追踪
          </h4>
          <div style={{ marginTop: 24, overflowX: 'auto' }}>
            <table className="cm-disabled-table">
              <thead>
                <tr style={{ background: 'var(--color-neutral-25)' }}>
                  <th>公司岗位</th>
                  <th>投递渠道</th>
                  <th>当前状态</th>
                  <th>最后更新</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2].map((i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-neutral-25)' }}>
                    <td><div className="cm-disabled-table__placeholder" style={{ width: 128 }} /></td>
                    <td><div className="cm-disabled-table__placeholder" style={{ width: 64 }} /></td>
                    <td><div className="cm-disabled-table__placeholder" style={{ width: 80 }} /></td>
                    <td><div className="cm-disabled-table__placeholder" style={{ width: 96 }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="cm-disabled-block__note">投递记录与自动化追踪模块开发中...</p>
        </div>

        {/* 下一步按钮 */}
        <div className="cm-step-nav">
          <button className="cm-step-nav-btn cm-step-nav-btn--brand" onClick={() => navigate('/m/career-mentor/interview')}>
            进入下一步：四面 →
          </button>
        </div>
      </div>
    </PageContainer>
  )
}
