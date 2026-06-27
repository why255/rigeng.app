import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { getBoard, getModulesByBoard, type BoardId } from '@rigeng/shared/data/modules'
import { PageContainer } from '@/components/layout/AppShell'
import { Card, Text } from '@rigeng/shared/components/primitives'
import './pages.css'

/**
 * 移动端点击底部 Tab 后弹出的「子模块入口卡片网格」。
 * 对应全局信息架构 1.2：点 Tab → 子模块入口卡片网格。
 */
export function MobileBoardGrid() {
  const { board } = useParams()
  const navigate = useNavigate()
  if (!board) return <Navigate to="/" replace />
  const meta = getBoard(board as BoardId)
  const modules = getModulesByBoard(board as BoardId)

  return (
    <PageContainer width="dashboard">
      <div className="pg-section">
        <div className="pg-section__title">
          {meta.icon} {meta.name}
        </div>
        <div className="rg-boardgrid">
          {modules.map((m) => (
            <Card
              key={m.slug}
              hover
              clickable
              barColor="var(--module-color-bar)"
              className="rg-boardgrid__card"
              data-module={m.slug}
              onClick={() => navigate(`/m/${m.slug}`)}
            >
              <span className="rg-boardgrid__emoji">{m.icon}</span>
              <Text level="l2" as="div">{m.name}</Text>
              <Text level="l6" as="div" color="var(--color-brand-primary)">{m.slogan}</Text>
            </Card>
          ))}
        </div>
      </div>
    </PageContainer>
  )
}
