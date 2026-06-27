import { useState } from 'react'
import { PageContainer } from '@/components/layout/AppShell'
import { Card, Text, ProgressBar, Tag, Button } from '@rigeng/shared/components/primitives'
import { StepFlow, RolePanel, type Step } from '@rigeng/shared/components/business'
import { RadarChart } from '@rigeng/shared/components/business/charts'
import { careerSteps, abilityRadar, offerCompare } from '@rigeng/shared/data/mock'
import '../pages.css'

const ACCENT = '#607D8B' // 军师蓝

/** M7-P2 高维求职·五步法进度页（960px · 军师蓝模块色） */
export function CareerMentor() {
  const [steps, setSteps] = useState<Step[]>(careerSteps)
  const current = steps.find((s) => s.status === 'current')

  return (
    <PageContainer width="dashboard">
      <div data-module="career-mentor">
        {/* 五步法步骤条 */}
        <div className="pg-section">
          <StepFlow
            steps={steps}
            onSelect={(key) =>
              setSteps((prev) =>
                prev.map((s) => ({ ...s, status: s.key === key ? 'current' : s.status === 'current' ? 'done' : s.status }))
              )
            }
          />
        </div>

        {/* 当前步骤展开卡片 */}
        <Card barColor={ACCENT} style={{ marginBottom: 'var(--spacing-xl)' }}>
          <div className="pg-row" style={{ justifyContent: 'space-between' }}>
            <Text level="l3">📋 当前步骤：{current?.name ?? '—'}</Text>
            <Tag>军师蓝 #607D8B</Tag>
          </div>
          <ul className="pg-stack" style={{ marginTop: 'var(--spacing-md)' }}>
            <li><Text level="l4">· 公司研究笔记 · 岗位关键要求</Text></li>
            <li><Text level="l4">· 角色模拟训练（面试官 / 客户 / 专家）</Text></li>
            <li><Text level="l4">· 面试提词器准备（联动智能记录录音）</Text></li>
          </ul>
        </Card>

        <div className="pg-split--6040">
          {/* 左：角色模拟面板 60% */}
          <Card>
            <Text level="l2" as="div" style={{ marginBottom: 'var(--spacing-md)' }}>角色模拟评分</Text>
            <RolePanel roles={['面试官', '客户', '专家']}>
              {(role) => (
                <div className="pg-stack">
                  <Card style={{ background: 'var(--color-brand-primary-light)' }}>
                    <Text level="l5" as="div">A 维度 · 关键词匹配（{role}视角）</Text>
                    <Text level="l1" as="div" color="var(--color-brand-primary)">匹配度 85%</Text>
                    <Text level="l6" as="div" color="var(--color-neutral-500)">
                      匹配关键词：项目管理 / 团队协作 / 数据分析
                    </Text>
                  </Card>
                  <div className="pg-stack">
                    {[['完整性', 80], ['逻辑性', 60], ['深度', 70], ['针对性', 50]].map(([k, v]) => (
                      <div key={k as string}>
                        <div className="pg-row" style={{ justifyContent: 'space-between' }}>
                          <Text level="l5">{k}</Text>
                          <Text level="l6" color="var(--color-neutral-500)">{v}%</Text>
                        </div>
                        <div style={{ marginTop: 4 }}><ProgressBar value={v as number} /></div>
                      </div>
                    ))}
                  </div>
                  <Text level="l2" as="div" color="var(--color-brand-primary)">A + B 综合评分：73%</Text>
                </div>
              )}
            </RolePanel>
          </Card>

          {/* 右：能力雷达 + 进度 40% */}
          <div className="pg-stack">
            <Card>
              <RadarChart title="能力分布雷达图" axes={abilityRadar.axes} values={abilityRadar.values} color={ACCENT} />
            </Card>
            <Card>
              <Text level="l2" as="div" style={{ marginBottom: 'var(--spacing-md)' }}>求职进度</Text>
              {[['投递进度', 40], ['面试进度', 20], ['Offer 进度', 0]].map(([k, v]) => (
                <div key={k as string} style={{ marginBottom: 'var(--spacing-md)' }}>
                  <div className="pg-row" style={{ justifyContent: 'space-between' }}>
                    <Text level="l5">{k}</Text>
                    <Text level="l6" color="var(--color-neutral-500)">{v}%</Text>
                  </div>
                  <div style={{ marginTop: 4 }}><ProgressBar value={v as number} /></div>
                </div>
              ))}
            </Card>
          </div>
        </div>

        {/* Offer 对比 */}
        <Card style={{ marginTop: 'var(--spacing-xl)' }}>
          <div className="pg-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
            <Text level="l2">五选 · Offer 对比</Text>
            <Button variant="secondary" size="sm">添加 Offer</Button>
          </div>
          <div className="pg-grid-2">
            <RadarChart title="公司 A" axes={offerCompare.axes} values={offerCompare.a} color="#8B4513" />
            <RadarChart title="公司 B" axes={offerCompare.axes} values={offerCompare.b} color={ACCENT} />
          </div>
        </Card>
      </div>
    </PageContainer>
  )
}
