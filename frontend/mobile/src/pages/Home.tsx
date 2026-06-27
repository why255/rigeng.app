import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { Card, Text, Tag, Button } from '@rigeng/shared/components/primitives'
import { BOARDS, getModulesByBoard, MAIN_SLOGAN, CORE_CONCEPT } from '@rigeng/shared/data/modules'
import './pages.css'

/** 首页：品牌门面 + 四板块全模块入口（验证导航 + 品牌语展示） */
export function Home() {
  const navigate = useNavigate()
  return (
    <PageContainer width="dashboard">
      <div className="pg-entry__hero" style={{ background: 'var(--color-brand-primary-light)' }}>
        <Text level="l0" as="div" color="var(--color-brand-primary)">{MAIN_SLOGAN}</Text>
        <Text level="l4" as="div" color="var(--color-neutral-700)" style={{ marginTop: 'var(--spacing-sm)', fontStyle: 'italic' }}>
          {CORE_CONCEPT}
        </Text>
      </div>

      {BOARDS.map((board) => (
        <div key={board.id} className="pg-section">
          <div className="pg-section__title">
            {board.icon} {board.name}
          </div>
          <div className="pg-grid-2">
            {getModulesByBoard(board.id).map((m) => (
              <Card
                key={m.slug}
                hover
                clickable
                barColor="var(--module-color-bar)"
                data-module={m.slug}
                onClick={() => navigate(`/m/${m.slug}`)}
              >
                <div className="pg-row" style={{ justifyContent: 'space-between' }}>
                  <Text level="l2">{m.icon} {m.name}</Text>
                  <Tag tone={m.hasPage ? 'success' : 'muted'}>{m.hasPage ? '代表页就绪' : '入口模板'}</Tag>
                </div>
                <Text level="l5" as="div" color="var(--color-brand-primary)" style={{ marginTop: 6 }}>
                  {m.slogan}
                </Text>
                <Text level="l6" as="div" color="var(--color-neutral-500)" style={{ marginTop: 4 }}>
                  {m.subtitle}
                </Text>
              </Card>
            ))}
          </div>
        </div>
      ))}

      <div className="pg-row" style={{ justifyContent: 'center', marginTop: 'var(--spacing-xl)' }}>
        <Button onClick={() => navigate('/m/morning-plan')}>从「朝有规划」开始体验</Button>
      </div>
    </PageContainer>
  )
}
