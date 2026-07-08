import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { ToastProvider } from '@/shared/components/primitives/toast'
import { ProtectedRoute } from '@/shared/components/auth/ProtectedRoute'
import { AdminRoute } from '@/shared/components/auth/AdminRoute'
import { AppShell } from '@/components/layout/AppShell'
import { AdminLayout } from '@/components/layout/AdminLayout'

// ── 公开页面 ──
import { Login } from '@/pages/Login'
import { Register } from '@/pages/Register'
import { AdminLogin } from '@/pages/admin/AdminLogin'

// ── 用户端页面 ──
import { Home } from '@/pages/Home'
import { ModuleEntry } from '@/pages/ModuleEntry'
import { MorningPlanEntry } from '@/pages/board1/MorningPlanEntry'
import { MorningPlanChat } from '@/pages/board1/MorningPlanChat'
import { MorningPlanList } from '@/pages/board1/MorningPlanList'
import { MorningPlanComplete } from '@/pages/board1/MorningPlanComplete'
import { MorningPlanOffline } from '@/pages/board1/MorningPlanOffline'
import { MorningPlanSettings } from '@/pages/board1/MorningPlanSettings'
import { MorningPlanProvider } from '@/pages/board1/MorningPlanContext'
import { EveningReviewLayout } from '@/pages/evening-review/EveningReviewLayout'
import { EveningReviewDashboard } from '@/pages/evening-review/dashboard'
import { EveningReviewChat } from '@/pages/evening-review/chat'
import { EveningReviewReport } from '@/pages/evening-review/report'
import { EveningReviewHistory } from '@/pages/evening-review/history'
import { MoodHavenEntry } from '@/pages/board1/MoodHavenEntry'
import { MoodHavenChatRedirect } from '@/pages/board1/MoodHavenChatRedirect'
import { MoodHavenGrowth } from '@/pages/board1/MoodHavenGrowth'
import { MoodHavenHistory } from '@/pages/board1/MoodHavenHistory'

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

import { CareerMentor } from '@/pages/board3/CareerMentor'
import { CareerMentorStep1 } from '@/pages/board3/CareerMentorStep1'
import { CareerMentorStep23 } from '@/pages/board3/CareerMentorStep23'
import { CareerMentorStep4 } from '@/pages/board3/CareerMentorStep4'
import { CareerMentorStep5 } from '@/pages/board3/CareerMentorStep5'

import { KnowledgeHub } from '@/pages/board4/KnowledgeHub'
import { KnowledgeList } from '@/pages/board4/KnowledgeList'
import { KnowledgeExport } from '@/pages/board4/KnowledgeExport'
import { KnowledgeAudit } from '@/pages/board4/KnowledgeAudit'
import { AnalyticsHome } from '@/pages/board4/AnalyticsHome'
import { DataAnalytics } from '@/pages/board4/DataAnalytics'

// ── 管理后台页面 ──
import { AdminDashboard } from '@/pages/admin/AdminDashboard'
import { AdminUsers } from '@/pages/admin/AdminUsers'
import { AdminTeachers } from '@/pages/admin/AdminTeachers'
import { AdminVip } from '@/pages/admin/AdminVip'
import { AdminTeacherWorkload } from '@/pages/admin/AdminTeacherWorkload'
import { AdminTeacherMatching } from '@/pages/admin/AdminTeacherMatching'
import { AdminContentAudit } from '@/pages/admin/AdminContentAudit'
import { AdminXiejunContent } from '@/pages/admin/AdminXiejunContent'
import { AdminRagMonitor } from '@/pages/admin/AdminRagMonitor'
import { AdminMonitorDashboard } from '@/pages/admin/AdminMonitorDashboard'
import { AdminPushTemplates } from '@/pages/admin/AdminPushTemplates'
import { AdminPushQuota } from '@/pages/admin/AdminPushQuota'
import { AdminPushNotices } from '@/pages/admin/AdminPushNotices'
import { AdminPushLogs } from '@/pages/admin/AdminPushLogs'
import { AdminSecurityCrisis } from '@/pages/admin/AdminSecurityCrisis'
import { AdminSecurityEmotion } from '@/pages/admin/AdminSecurityEmotion'
import { AdminSettingsParams } from '@/pages/admin/AdminSettingsParams'
import { AdminSettingsFlags } from '@/pages/admin/AdminSettingsFlags'
import { AdminSettingsHrModules } from '@/pages/admin/AdminSettingsHrModules'
import { AdminSettingsAbs } from '@/pages/admin/AdminSettingsAbs'
import { AdminAlgorithm } from '@/pages/admin/AdminAlgorithm'
import { AdminAuditLogs } from '@/pages/admin/AdminAuditLogs'
import { PlaceholderPage } from '@/pages/admin/PlaceholderPage'

// ── 老师工作台页面 ──
import { TeacherDashboard } from '@/pages/teacher/TeacherDashboard'
import { TeacherStudents } from '@/pages/teacher/TeacherStudents'
import { TeacherAppointments } from '@/pages/teacher/TeacherAppointments'
import { TeacherIntelligence } from '@/pages/teacher/TeacherIntelligence'
import { TeacherCollaboration } from '@/pages/teacher/TeacherCollaboration'
import { TeacherPerformance } from '@/pages/teacher/TeacherPerformance'

/* ═══════════════════════════════════════════════════════════════
 * PC 站路由 — 三个独立路由树，同级并列
 *
 *   /login        用户登录（公开）
 *   /register     用户注册（公开）
 *   /admin/login  管理后台登录（公开）
 *
 *   /*            用户端（ProtectedRoute → AppShell）
 *   /admin/*      管理后台（AdminRoute → AdminLayout）
 *   /teacher/*    老师工作台（AdminRoute → AdminLayout）
 * ═══════════════════════════════════════════════════════════════ */

/** 用户端 13 模块路由（在 AppShell 内渲染） */
function UserRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/b/:board" element={<Navigate to="/" replace />} />

      {/* M1 朝有规划 — 共享 MorningPlanContext */}
      <Route path="/m/morning-plan" element={<MorningPlanProvider><Outlet /></MorningPlanProvider>}>
        <Route index element={<MorningPlanEntry />} />
        <Route path="chat" element={<MorningPlanChat />} />
        <Route path="list" element={<MorningPlanList />} />
        <Route path="complete" element={<MorningPlanComplete />} />
        <Route path="offline" element={<MorningPlanOffline />} />
        <Route path="settings" element={<MorningPlanSettings />} />
      </Route>

      {/* M2 暮有复盘 — PC index = dashboard（仪表盘入口） */}
      <Route path="/m/evening-review" element={<EveningReviewLayout />}>
        <Route index element={<EveningReviewDashboard />} />
        <Route path="chat" element={<EveningReviewChat />} />
        <Route path="report" element={<EveningReviewReport />} />
        <Route path="history" element={<EveningReviewHistory />} />
      </Route>

      {/* M3 情绪树洞 */}
      <Route path="/m/mood-haven" element={<MoodHavenEntry />} />
      <Route path="/m/mood-haven/chat" element={<MoodHavenChatRedirect />} />
      <Route path="/m/mood-haven/growth" element={<MoodHavenGrowth />} />
      <Route path="/m/mood-haven/history" element={<MoodHavenHistory />} />

      {/* M4 智能记录 */}
      <Route path="/m/smart-record" element={<SmartRecordHome />} />
      <Route path="/m/smart-record/recording" element={<SmartRecordRecording />} />
      <Route path="/m/smart-record/transcript" element={<SmartRecordTranscript />} />
      <Route path="/m/smart-record/extract" element={<SmartRecordExtract />} />
      <Route path="/m/smart-record/history" element={<SmartRecordHistory />} />

      {/* M5 智能问答 */}
      <Route path="/m/smart-qa" element={<SmartQaHome />} />
      <Route path="/m/smart-qa/chat" element={<SmartQaChat />} />
      <Route path="/m/smart-qa/detail" element={<SmartQaDetail />} />

      {/* M6 智能办公 */}
      <Route path="/m/smart-office" element={<SmartOfficeHome />} />
      <Route path="/m/smart-office/work" element={<SmartOffice />} />
      <Route path="/m/smart-office/system" element={<SmartOfficeSystem />} />
      <Route path="/m/smart-office/editor" element={<SmartOfficeEditor />} />

      {/* M7 高维求职 */}
      <Route path="/m/career-mentor" element={<CareerMentor />} />
      <Route path="/m/career-mentor/steps" element={<CareerMentorStep1 />} />
      <Route path="/m/career-mentor/double" element={<CareerMentorStep23 />} />
      <Route path="/m/career-mentor/interview" element={<CareerMentorStep4 />} />
      <Route path="/m/career-mentor/select" element={<CareerMentorStep5 />} />

      {/* M12 知识库 */}
      <Route path="/m/knowledge-base" element={<KnowledgeHub />} />
      <Route path="/m/knowledge-base/list" element={<KnowledgeList />} />
      <Route path="/m/knowledge-base/export/:id" element={<KnowledgeExport />} />
      <Route path="/m/knowledge-base/audit" element={<KnowledgeAudit />} />

      {/* M13 数据分析 */}
      <Route path="/m/data-analytics" element={<AnalyticsHome />} />
      <Route path="/m/data-analytics/insight" element={<DataAnalytics />} />

      {/* 通用模块入口 */}
      <Route path="/m/:slug" element={<ModuleEntry />} />

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

/** 管理后台路由（AdminLayout 内渲染） */
function AdminRoutes() {
  return (
    <Routes>
      <Route index element={<AdminDashboard />} />
      <Route path="users" element={<AdminUsers />} />
      <Route path="users/vip" element={<AdminVip />} />
      <Route path="users/contribution" element={<PlaceholderPage title="贡献值配置" />} />
      <Route path="teachers" element={<AdminTeachers />} />
      <Route path="teachers/workload" element={<AdminTeacherWorkload />} />
      <Route path="teachers/matching" element={<AdminTeacherMatching />} />
      <Route path="content/audit" element={<AdminContentAudit />} />
      <Route path="content/xiejun" element={<AdminXiejunContent />} />
      <Route path="content/contribution" element={<PlaceholderPage title="用户贡献审核" />} />
      <Route path="content/rag" element={<AdminRagMonitor />} />
      <Route path="monitor/dashboard" element={<AdminMonitorDashboard />} />
      <Route path="monitor/health" element={<AdminMonitorDashboard />} />
      <Route path="monitor/storage" element={<PlaceholderPage title="文件存储用量" />} />
      <Route path="monitor/token" element={<PlaceholderPage title="AI Token 消耗" />} />
      <Route path="monitor/alerts" element={<PlaceholderPage title="系统告警" />} />
      <Route path="push/templates" element={<AdminPushTemplates />} />
      <Route path="push/quota" element={<AdminPushQuota />} />
      <Route path="push/notices" element={<AdminPushNotices />} />
      <Route path="push/logs" element={<AdminPushLogs />} />
      <Route path="security/crisis" element={<AdminSecurityCrisis />} />
      <Route path="security/emotion" element={<AdminSecurityEmotion />} />
      <Route path="security/violations" element={<PlaceholderPage title="内容违规追踪" />} />
      <Route path="security/inactive" element={<PlaceholderPage title="不活跃用户检测" />} />
      <Route path="security/privacy" element={<PlaceholderPage title="数据隐私审计" />} />
      <Route path="settings/params" element={<AdminSettingsParams />} />
      <Route path="settings/flags" element={<AdminSettingsFlags />} />
      <Route path="settings/brand" element={<PlaceholderPage title="品牌配置" />} />
      <Route path="settings/hr-modules" element={<AdminSettingsHrModules />} />
      <Route path="settings/abs" element={<AdminSettingsAbs />} />
      <Route path="settings/algorithm" element={<AdminAlgorithm />} />
      <Route path="audit" element={<AdminAuditLogs />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}

/** 老师工作台路由（AdminLayout 内渲染） */
function TeacherRoutes() {
  return (
    <Routes>
      <Route index element={<TeacherDashboard />} />
      <Route path="students" element={<TeacherStudents />} />
      <Route path="appointments" element={<TeacherAppointments />} />
      <Route path="intelligence" element={<TeacherIntelligence />} />
      <Route path="collaboration" element={<TeacherCollaboration />} />
      <Route path="performance" element={<TeacherPerformance />} />
      <Route path="*" element={<Navigate to="/teacher" replace />} />
    </Routes>
  )
}

/* ═══════════════════════════════════════════════════════════════
 * 顶层路由 — 三个路由树平级
 * ═══════════════════════════════════════════════════════════════ */
export function PcApp() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          {/* ── 公开路由 ── */}
          <Route path="/login" element={<Login defaultRedirect="/m/morning-plan" />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* ── 管理后台（超管/运营/项目负责人）── */}
          <Route
            path="/admin/*"
            element={
              <AdminRoute roles={['superadmin', 'operator', 'project_manager']}>
                <AdminLayout>
                  <AdminRoutes />
                </AdminLayout>
              </AdminRoute>
            }
          />

          {/* ── 老师工作台 ── */}
          <Route
            path="/teacher/*"
            element={
              <AdminRoute roles={['teacher']}>
                <AdminLayout>
                  <TeacherRoutes />
                </AdminLayout>
              </AdminRoute>
            }
          />

          {/* ── 用户端（所有已登录用户）── */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppShell>
                  <UserRoutes />
                </AppShell>
              </ProtectedRoute>
            }
          />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}
