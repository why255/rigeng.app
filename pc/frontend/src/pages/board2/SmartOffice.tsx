import { useState } from 'react'
import { PageContainer } from '@/components/layout/AppShell'
import { Button, Card, Text, ProgressBar } from '@/shared/components/primitives'
import { DualLibTabs, RichTextStub } from '@/shared/components/business'
import { BarChart } from '@/shared/components/business/charts'
import { ChatBubble } from '@/shared/components/chat'
import { useToast } from '@/shared/components/primitives/toast'
import { officeDrafts, officeChartData, officeChartLabels } from '@/shared/data/mock'
import '../pages.css'

/** M6-P2 智能办公·工具库/体系库切换页（960px · 编辑器 + 预览双栏） */
export function SmartOffice() {
  const [lib, setLib] = useState('tool')
  const toast = useToast()

  return (
    <PageContainer width="dashboard">
      <div data-module="smart-office">
        <div className="pg-section">
          <DualLibTabs
            active={lib}
            onChange={setLib}
            tabs={[
              { key: 'tool', label: '📂 工具库' },
              { key: 'system', label: '📚 体系库' },
            ]}
          />
          <Text level="l6" as="div" color="var(--color-neutral-500)" style={{ marginTop: 8 }}>
            {lib === 'tool'
              ? '工具库：按 HR 八大模块单点生成 JD、薪酬测算、培训计划等'
              : '体系库：从战略解码到模块落地，一步步引导搭建人资体系'}
          </Text>
        </div>

        <div className="pg-split">
          {/* 左：富文本编辑器 65% */}
          <div className="pg-stack">
            <RichTextStub placeholder={lib === 'tool' ? '编写岗位 JD…' : '搭建绩效体系方案…'} />
            <Card>
              <Text level="l2" as="div" style={{ marginBottom: 'var(--spacing-md)' }}>草稿箱进度</Text>
              <div className="pg-stack">
                {officeDrafts.map((d) => (
                  <div key={d.name}>
                    <div className="pg-row" style={{ justifyContent: 'space-between' }}>
                      <Text level="l5">{d.name}</Text>
                      <Text level="l6" color="var(--color-neutral-500)">{d.progress}%</Text>
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <ProgressBar value={d.progress} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* 右：预览 + 图表 35% */}
          <div className="pg-stack">
            <Card>
              <Text level="l2" as="div">文档预览</Text>
              <Text level="l6" as="div" color="var(--color-neutral-500)">暖心姐 · 刚刚 · 自动保存草稿</Text>
              <div className="pg-spacer" />
              <Text level="l5" as="div">📊 ABS 模型流程进度</Text>
              <div style={{ marginTop: 8 }}>
                <ProgressBar value={50} />
              </div>
              <Text level="l6" as="div" color="var(--color-neutral-500)" style={{ marginTop: 6 }}>
                步骤 1 ✅ → 2 ✅ → 3 🔵 → 4 ⬜
              </Text>
            </Card>
            <Card>
              <BarChart title="HR 八大模块产出分布" data={officeChartData} labels={officeChartLabels} />
            </Card>
          </div>
        </div>

        {/* 底部操作栏 */}
        <Card style={{ marginTop: 'var(--spacing-xl)' }}>
          <div className="pg-row" style={{ justifyContent: 'space-between' }}>
            <div className="pg-row">
              <ChatBubble role="assistant" avatar>
                是否需要小耕帮您补全这份文档？
              </ChatBubble>
            </div>
            <div className="pg-row">
              <Button variant="secondary" onClick={() => toast('草稿已保存', 'success')}>保存草稿</Button>
              <Button onClick={() => toast('已确认入库', 'success')}>确认入库</Button>
            </div>
          </div>
        </Card>
      </div>
    </PageContainer>
  )
}
