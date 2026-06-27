import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from '@rigeng/shared/components/primitives/toast'
import { ProtectedRoute } from '@rigeng/shared/components/auth/ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'

// Pages
import { Login } from '@/pages/Login'
import { Register } from '@/pages/Register'
import { TabHomePage } from '@/pages/TabHomePage'
import { ModuleEntry } from '@/pages/ModuleEntry'

// Board 1 - 小耕对话
import { MorningPlanEntry } from '@/pages/board1/MorningPlanEntry'
import { MorningPlanChat } from '@/pages/board1/MorningPlanChat'
import { MorningPlanList } from '@/pages/board1/MorningPlanList'
import { MorningPlanComplete } from '@/pages/board1/MorningPlanComplete'
import { MorningPlanOffline } from '@/pages/board1/MorningPlanOffline'
import { MorningPlanSettings } from '@/pages/board1/MorningPlanSettings'
import { EveningReviewEntry } from '@/pages/board1/EveningReviewEntry'
import { EveningReviewChat } from '@/pages/board1/EveningReviewChat'
import { EveningReviewReport } from '@/pages/board1/EveningReviewReport'
import { EveningReviewHistory } from '@/pages/board1/EveningReviewHistory'
import { MoodHavenEntry } from '@/pages/board1/MoodHavenEntry'
import { MoodHavenChat } from '@/pages/board1/MoodHavenChat'
import { MoodHavenGrowth } from '@/pages/board1/MoodHavenGrowth'
import { MoodHavenHistory } from '@/pages/board1/MoodHavenHistory'

// Board 2 - 升值涨薪
import { SmartRecordHome } from '@/pages/board2/SmartRecordHome'
import { SmartQaHome } from '@/pages/board2/SmartQaHome'
import { SmartQaChat } from '@/pages/board2/SmartQaChat'
import { SmartQaDetail } from '@/pages/board2/SmartQaDetail'
import { SmartRecordRecording } from '@/pages/board2/SmartRecordRecording'
import { SmartRecordTranscript } from '@/pages/board2/SmartRecordTranscript'
import { SmartRecordExtract } from '@/pages/board2/SmartRecordExtract'
import { SmartRecordHistory } from '@/pages/board2/SmartRecordHistory'
import { SmartOfficeHome } from '@/pages/board2/SmartOfficeHome'
import { SmartOffice } from '@/pages/board2/SmartOffice'
import { SmartOfficeSystem } from '@/pages/board2/SmartOfficeSystem'
import { SmartOfficeEditor } from '@/pages/board2/SmartOfficeEditor'

// Board 3 - 转型升级
import { CareerMentor } from '@/pages/board3/CareerMentor'
import { CareerMentorStep1 } from '@/pages/board3/CareerMentorStep1'
import { CareerMentorStep23 } from '@/pages/board3/CareerMentorStep23'
import { CareerMentorStep4 } from '@/pages/board3/CareerMentorStep4'
import { CareerMentorStep5 } from '@/pages/board3/CareerMentorStep5'
import { BrandBuildingEntry } from '@/pages/board3/BrandBuildingEntry'
import { BrandBuildingGenerate } from '@/pages/board3/BrandBuildingGenerate'
import { BrandBuildingSchedule } from '@/pages/board3/BrandBuildingSchedule'
import { BrandBuildingData } from '@/pages/board3/BrandBuildingData'
import { AcquireClientEntry } from '@/pages/board3/AcquireClientEntry'
import { AcquireClientDiagnosis } from '@/pages/board3/AcquireClientDiagnosis'
import { AcquireClientMeeting } from '@/pages/board3/AcquireClientMeeting'
import { AcquireClientContract } from '@/pages/board3/AcquireClientContract'
import { ProductDesignEntry } from '@/pages/board3/ProductDesignEntry'
import { ProductDesignDiagnosis } from '@/pages/board3/ProductDesignDiagnosis'
import { ProductDesignTarget } from '@/pages/board3/ProductDesignTarget'
import { ProductDesignFinalize } from '@/pages/board3/ProductDesignFinalize'
import { OrderDeliveryEntry } from '@/pages/board3/OrderDeliveryEntry'
import { OrderDeliveryGantt } from '@/pages/board3/OrderDeliveryGantt'
import { OrderDeliveryIssues } from '@/pages/board3/OrderDeliveryIssues'

// Board 4 - 我的智库
import { KnowledgeHub } from '@/pages/board4/KnowledgeHub'
import { KnowledgeList } from '@/pages/board4/KnowledgeList'
import { KnowledgeExport } from '@/pages/board4/KnowledgeExport'
import { KnowledgeAudit } from '@/pages/board4/KnowledgeAudit'
import { AnalyticsHome } from '@/pages/board4/AnalyticsHome'
import { DataAnalytics } from '@/pages/board4/DataAnalytics'

/**
 * 移动端 H5 路由表 — react-router-dom v6
 * 包含 /b/:board（TabBar 导航板卡网格）
 * 未登录 → 重定向到 /login；已登录 → AppShell
 */
export function MobileApp() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          {/* 登录/注册页 — 公开路由 */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* 所有受保护路由 */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Routes>
                    <Route path="/" element={<Navigate to="/b/board1" replace />} />

                    {/* 底部 Tab 导航 → 板卡网格 */}
                    <Route path="/b/:board" element={<TabHomePage />} />

                    {/* M1 朝有规划 */}
                    <Route path="/m/morning-plan" element={<MorningPlanEntry />} />
                    <Route path="/m/morning-plan/chat" element={<MorningPlanChat />} />
                    <Route path="/m/morning-plan/list" element={<MorningPlanList />} />
                    <Route path="/m/morning-plan/complete" element={<MorningPlanComplete />} />
                    <Route path="/m/morning-plan/offline" element={<MorningPlanOffline />} />
                    <Route path="/m/morning-plan/settings" element={<MorningPlanSettings />} />

                    {/* M2 暮有复盘 */}
                    <Route path="/m/evening-review" element={<EveningReviewEntry />} />
                    <Route path="/m/evening-review/chat" element={<EveningReviewChat />} />
                    <Route path="/m/evening-review/report" element={<EveningReviewReport />} />
                    <Route path="/m/evening-review/history" element={<EveningReviewHistory />} />

                    {/* M3 心有灵犀 */}
                    <Route path="/m/mood-haven" element={<MoodHavenEntry />} />
                    <Route path="/m/mood-haven/chat" element={<MoodHavenChat />} />
                    <Route path="/m/mood-haven/growth" element={<MoodHavenGrowth />} />
                    <Route path="/m/mood-haven/history" element={<MoodHavenHistory />} />

                    {/* M4 智能记录 — 5 个独立页面 */}
                    <Route path="/m/smart-record" element={<SmartRecordHome />} />
                    <Route path="/m/smart-record/recording" element={<SmartRecordRecording />} />
                    <Route path="/m/smart-record/transcript" element={<SmartRecordTranscript />} />
                    <Route path="/m/smart-record/extract" element={<SmartRecordExtract />} />
                    <Route path="/m/smart-record/history" element={<SmartRecordHistory />} />

                    {/* M5 智能问答 — 3 个独立页面 */}
                    <Route path="/m/smart-qa" element={<SmartQaHome />} />
                    <Route path="/m/smart-qa/chat" element={<SmartQaChat />} />
                    <Route path="/m/smart-qa/detail" element={<SmartQaDetail />} />

                    {/* M6 智能办公 — 4 个独立页面 */}
                    <Route path="/m/smart-office" element={<SmartOfficeHome />} />
                    <Route path="/m/smart-office/work" element={<SmartOffice />} />
                    <Route path="/m/smart-office/system" element={<SmartOfficeSystem />} />
                    <Route path="/m/smart-office/editor" element={<SmartOfficeEditor />} />

                    {/* M7 职业导师 — 5 个独立页面 */}
                    <Route path="/m/career-mentor" element={<CareerMentor />} />
                    <Route path="/m/career-mentor/steps" element={<CareerMentorStep1 />} />
                    <Route path="/m/career-mentor/double" element={<CareerMentorStep23 />} />
                    <Route path="/m/career-mentor/interview" element={<CareerMentorStep4 />} />
                    <Route path="/m/career-mentor/select" element={<CareerMentorStep5 />} />

                    {/* M8 品牌打造中心 — 4 个独立页面 */}
                    <Route path="/m/brand-building" element={<BrandBuildingEntry />} />
                    <Route path="/m/brand-building/generate" element={<BrandBuildingGenerate />} />
                    <Route path="/m/brand-building/schedule" element={<BrandBuildingSchedule />} />
                    <Route path="/m/brand-building/data" element={<BrandBuildingData />} />

                    {/* M9 拿下一个客户 — 4 个独立页面 */}
                    <Route path="/m/acquire-client" element={<AcquireClientEntry />} />
                    <Route path="/m/acquire-client/diagnosis" element={<AcquireClientDiagnosis />} />
                    <Route path="/m/acquire-client/meeting" element={<AcquireClientMeeting />} />
                    <Route path="/m/acquire-client/contract" element={<AcquireClientContract />} />

                    {/* M10 打磨一套产品 — 4 个独立页面 */}
                    <Route path="/m/product-design" element={<ProductDesignEntry />} />
                    <Route path="/m/product-design/diagnosis" element={<ProductDesignDiagnosis />} />
                    <Route path="/m/product-design/target" element={<ProductDesignTarget />} />
                    <Route path="/m/product-design/finalize" element={<ProductDesignFinalize />} />

                    {/* M11 交付一笔订单 — 3 个独立页面 */}
                    <Route path="/m/deliver-order" element={<OrderDeliveryEntry />} />
                    <Route path="/m/deliver-order/gantt" element={<OrderDeliveryGantt />} />
                    <Route path="/m/deliver-order/issues" element={<OrderDeliveryIssues />} />

                    {/* M12 知识库 */}
                    <Route path="/m/knowledge-base" element={<KnowledgeHub />} />
                    <Route path="/m/knowledge-base/list" element={<KnowledgeList />} />
                    <Route path="/m/knowledge-base/export/:id" element={<KnowledgeExport />} />
                    <Route path="/m/knowledge-base/audit" element={<KnowledgeAudit />} />

                    {/* M13 数据分析 */}
                    <Route path="/m/data-analytics" element={<AnalyticsHome />} />
                    <Route path="/m/data-analytics/insight" element={<DataAnalytics />} />

                    {/* 通用模块入口 — 兜底路由 */}
                    <Route path="/m/:slug" element={<ModuleEntry />} />

                    {/* 404 → 首页 */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </AppShell>
              </ProtectedRoute>
            }
          />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}
