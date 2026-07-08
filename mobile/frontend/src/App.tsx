import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from '@/shared/components/primitives/toast'
import { ProtectedRoute } from '@/shared/components/auth/ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'

// Pages
import { Login } from '@/pages/Login'
import { Register } from '@/pages/Register'
import { TabHomePage } from '@/pages/TabHomePage'
import { ModuleEntry } from '@/pages/ModuleEntry'

// Board 1 - 小耕对话 (朝有规划/暮有复盘/情绪树洞)
import { MorningPlanLayout } from '@/pages/morning-plan/MorningPlanLayout'
import { MorningPlanChat } from '@/pages/morning-plan/chat'
import { MorningPlanList } from '@/pages/morning-plan/list'
import { MorningPlanHome } from '@/pages/morning-plan/home'
import { MorningPlanComplete } from '@/pages/morning-plan/complete'
import { MorningPlanOffline } from '@/pages/morning-plan/offline'
import { MorningPlanSettings } from '@/pages/morning-plan/settings'
import { EveningReviewLayout } from '@/pages/evening-review/EveningReviewLayout'
import { EveningReviewHome } from '@/pages/evening-review/home'
import { EveningReviewChat } from '@/pages/evening-review/chat'
import { EveningReviewReport } from '@/pages/evening-review/report'
import { EveningReviewHistory } from '@/pages/evening-review/history'
import { EveningReviewSettings } from '@/pages/evening-review/settings'
import { MoodHavenEntry } from '@/pages/board1/MoodHavenEntry'
import { MoodHavenChat } from '@/pages/board1/MoodHavenChat'
import { MoodHavenGrowth } from '@/pages/board1/MoodHavenGrowth'
import { MoodHavenHistory } from '@/pages/board1/MoodHavenHistory'
import { MoodHavenSettings } from '@/pages/board1/MoodHavenSettings'

// Board 2 - 升值涨薪
import { SmartRecordHome } from '@/pages/board2/SmartRecordHome'
import { SmartRecordRecording } from '@/pages/board2/SmartRecordRecording'
import { SmartQaLayout } from '@/pages/smart-qa/SmartQaLayout'
import { SmartQaHome } from '@/pages/smart-qa/home'
import { SmartQaChat } from '@/pages/smart-qa/chat'
import { SmartQaDetail } from '@/pages/smart-qa/detail'
import { SmartRecordTranscript } from '@/pages/board2/SmartRecordTranscript'
import { SmartRecordExtract } from '@/pages/board2/SmartRecordExtract'
import { SmartRecordHistory } from '@/pages/board2/SmartRecordHistory'
import { SmartOfficeLayout } from '@/pages/smart-office/SmartOfficeLayout'
import { SmartOfficeHome } from '@/pages/smart-office/home'
import { SmartOfficeToolLibrary } from '@/pages/smart-office/tool-library'
import { SmartOfficeAiGuide } from '@/pages/smart-office/ai-guide'
import { SmartOfficeEditor } from '@/pages/smart-office/editor'

// 高维求职 (M7) — 五步法
import { CareerMentorEntry } from '@/pages/career-mentor/CareerMentorEntry'
import { CareerMentorYipan } from '@/pages/career-mentor/CareerMentorYipan'
import { CareerMentorErding } from '@/pages/career-mentor/CareerMentorErding'
import { CareerMentorSantou } from '@/pages/career-mentor/CareerMentorSantou'
import { CareerMentorSimian } from '@/pages/career-mentor/CareerMentorSimian'

// Board 4 - 我的智库
import { KnowledgeHub } from '@/pages/board4/KnowledgeHub'
import { KnowledgeList } from '@/pages/board4/KnowledgeList'
import { KnowledgeExport } from '@/pages/board4/KnowledgeExport'
import { KnowledgeAudit } from '@/pages/board4/KnowledgeAudit'
import { AnalyticsHome } from '@/pages/board4/AnalyticsHome'
import { DataAnalytics } from '@/pages/board4/DataAnalytics'

// Admin pages
import { AdminDashboard } from '@/pages/admin/AdminDashboard'
import { AdminUsers } from '@/pages/admin/AdminUsers'
import { AdminTeachers } from '@/pages/admin/AdminTeachers'

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
          <Route path="/login" element={<Login defaultRedirect="/" />} />
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
                    <Route path="/m/morning-plan" element={<MorningPlanLayout />}>
                      <Route index element={<Navigate to="home" replace />} />
                      <Route path="chat" element={<MorningPlanChat />} />
                      <Route path="list" element={<MorningPlanList />} />
                      <Route path="home" element={<MorningPlanHome />} />
                      <Route path="complete" element={<MorningPlanComplete />} />
                      <Route path="offline" element={<MorningPlanOffline />} />
                      <Route path="settings" element={<MorningPlanSettings />} />
                    </Route>

                    {/* M2 暮有复盘 — mobile index = chat（直入对话） */}
                    <Route path="/m/evening-review" element={<EveningReviewLayout />}>
                      <Route index element={<EveningReviewChat />} />
                      <Route path="home" element={<EveningReviewHome />} />
                      <Route path="chat" element={<EveningReviewChat />} />
                      <Route path="report" element={<EveningReviewReport />} />
                      <Route path="history" element={<EveningReviewHistory />} />
                      <Route path="settings" element={<EveningReviewSettings />} />
                    </Route>

                    {/* 情绪树洞 — 5 个独立页面 */}
                    <Route path="/m/mood-haven" element={<MoodHavenEntry />} />
                    <Route path="/m/mood-haven/chat" element={<MoodHavenChat />} />
                    <Route path="/m/mood-haven/growth" element={<MoodHavenGrowth />} />
                    <Route path="/m/mood-haven/history" element={<MoodHavenHistory />} />
                    <Route path="/m/mood-haven/settings" element={<MoodHavenSettings />} />

                    {/* 智能记录 — 5 个独立页面 */}
                    <Route path="/m/smart-record" element={<SmartRecordHome />} />
                    <Route path="/m/smart-record/recording" element={<SmartRecordRecording />} />
                    <Route path="/m/smart-record/transcript" element={<SmartRecordTranscript />} />
                    <Route path="/m/smart-record/extract" element={<SmartRecordExtract />} />
                    <Route path="/m/smart-record/history" element={<SmartRecordHistory />} />

                    {/* 智能问答 — Layout + 嵌套路由（P1→P2→P3 跳转链路） */}
                    <Route path="/m/smart-qa" element={<SmartQaLayout />}>
                      <Route index element={<SmartQaHome />} />
                      <Route path="chat" element={<SmartQaChat />} />
                      <Route path="detail" element={<SmartQaDetail />} />
                    </Route>

                    {/* 智能办公 — Layout + 嵌套路由（P1→P2→P3→P4 跳转链路） */}
                    <Route path="/m/smart-office" element={<SmartOfficeLayout />}>
                      <Route index element={<Navigate to="home" replace />} />
                      <Route path="home" element={<SmartOfficeHome />} />
                      <Route path="tool-library" element={<SmartOfficeToolLibrary />} />
                      <Route path="ai-guide" element={<SmartOfficeAiGuide />} />
                      <Route path="editor" element={<SmartOfficeEditor />} />
                    </Route>

                    {/* 高维求职 — 五步法（对齐 m7-v31-* 原型） */}
                    <Route path="/m/career-mentor" element={<CareerMentorEntry />} />
                    <Route path="/m/career-mentor/yipan" element={<CareerMentorYipan />} />
                    <Route path="/m/career-mentor/erding" element={<CareerMentorErding />} />
                    <Route path="/m/career-mentor/santou" element={<CareerMentorSantou />} />
                    <Route path="/m/career-mentor/simian" element={<CareerMentorSimian />} />

                    {/* 知识库 */}
                    <Route path="/m/knowledge-base" element={<KnowledgeHub />} />
                    <Route path="/m/knowledge-base/list" element={<KnowledgeList />} />
                    <Route path="/m/knowledge-base/export/:id" element={<KnowledgeExport />} />
                    <Route path="/m/knowledge-base/audit" element={<KnowledgeAudit />} />

                    {/* 数据分析 */}
                    <Route path="/m/data-analytics" element={<AnalyticsHome />} />
                    <Route path="/m/data-analytics/insight" element={<DataAnalytics />} />

                    {/* 管理后台 */}
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/admin/users" element={<AdminUsers />} />
                    <Route path="/admin/teachers" element={<AdminTeachers />} />

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
