import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { getModuleBySlug } from '@rigeng/shared/data/modules'
import { PageContainer } from '@/components/layout/AppShell'
import { Card, Button, Text, Tag } from '@rigeng/shared/components/primitives'
import './pages.css'

/**
 * 通用模块入口模板（对应各模块 M*-P1 入口页）。
 * 已实现独立核心页的模块（hasPage）提供"进入"按钮跳转其核心页路由。
 */
export function ModuleEntry() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const module = slug ? getModuleBySlug(slug) : undefined

  if (!module) return <Navigate to="/" replace />

  // 已实现核心页的模块 → 路由到对应核心页
  const corePath: Record<string, string> = {
    'morning-plan': `/m/morning-plan`,
    'evening-review': `/m/evening-review`,
    'mood-haven': `/m/mood-haven`,
    'smart-record': `/m/smart-record`,
    'smart-qa': `/m/smart-qa`,
    'smart-office': `/m/smart-office/work`,
    'career-mentor': `/m/career-mentor/steps`,
    'brand-building': `/m/brand-building`,
    'acquire-client': `/m/acquire-client`,
    'product-design': `/m/product-design`,
    'deliver-order': `/m/deliver-order`,
    'knowledge-base': `/m/knowledge-base`,
    'data-analytics': `/m/data-analytics`,
  }
  const target = corePath[module.slug]

  return (
    <PageContainer width={module.container}>
      <div data-module={module.slug}>
        <div className="pg-entry__hero">
          <div className="pg-row" style={{ gap: 'var(--spacing-sm)' }}>
            <span style={{ fontSize: 32 }}>{module.icon}</span>
            <Tag>{module.code}</Tag>
          </div>
          <div className="pg-entry__slogan">{module.slogan}</div>
          <div className="pg-entry__subtitle">{module.subtitle}</div>
          <div className="pg-entry__actions">
            {target ? (
              <Button onClick={() => navigate(target)}>进入{module.name}</Button>
            ) : (
              <Button onClick={() => navigate(target ?? '#')} disabled>
                核心页规划中
              </Button>
            )}
            <Button variant="secondary">设置</Button>
          </div>
        </div>

        {/* 今日概览卡片 */}
        <div className="pg-section">
          <div className="pg-section__title">今日概览</div>
          <div className="pg-grid-2">
            <Card barColor="var(--module-color-bar)">
              <Text level="l2" as="div">本周使用</Text>
              <Text level="l0" as="div" color="var(--color-brand-primary)">12</Text>
              <Text level="l6" as="div" color="var(--color-neutral-500)">次记录沉淀</Text>
            </Card>
            <Card barColor="var(--module-color-bar)">
              <Text level="l2" as="div">累计产出</Text>
              <Text level="l0" as="div" color="var(--color-brand-primary)">38</Text>
              <Text level="l6" as="div" color="var(--color-neutral-500)">份归档文档</Text>
            </Card>
          </div>
        </div>

        {!target && (
          <Card>
            <Text level="l5" color="var(--color-neutral-500)">
              本模块为通用入口模板演示。完整核心页（{module.code}-P2 及后续）将按《页面清单 V1.2》逐步落地，组件已在组件库就绪。
            </Text>
          </Card>
        )}
      </div>
    </PageContainer>
  )
}
