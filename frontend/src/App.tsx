import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ToastProvider } from '@/components/primitives/toast'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { Login } from '@/pages/Login'
import { Register } from '@/pages/Register'
import { Home } from '@/pages/Home'
import { ModuleEntry } from '@/pages/ModuleEntry'
import { TabHomePage } from '@/pages/TabHomePage'
import { MorningPlanEntry } from '@/pages/board1/MorningPlanEntry'
import { MorningPlanChat } from '@/pages/board1/MorningPlanChat'
import { MorningPlanList } from '@/pages/board1/MorningPlanList'
import { MorningPlanComplete } from '@/pages/board1/MorningPlanComplete'
import { MorningPlanOffline } from '@/pages/board1/MorningPlanOffline'
import { MorningPlanSettings } from '@/pages/board1/MorningPlanSettings'
import { MoodHavenEntry } from '@/pages/board1/MoodHavenEntry'
import { MoodHavenChat } from '@/pages/board1/MoodHavenChat'
import { MoodHavenGrowth } from '@/pages/board1/MoodHavenGrowth'
import { MoodHavenHistory } from '@/pages/board1/MoodHavenHistory'
import { EveningReviewEntry } from '@/pages/board1/EveningReviewEntry'
import { EveningReviewChat } from '@/pages/board1/EveningReviewChat'
import { EveningReviewReport } from '@/pages/board1/EveningReviewReport'
import { EveningReviewHistory } from '@/pages/board1/EveningReviewHistory'
import { SmartRecordHome } from '@/pages/board2/SmartRecordHome'
import { SmartRecordRecording } from '@/pages/board2/SmartRecordRecording'
import { SmartRecordTranscript } from '@/pages/board2/SmartRecordTranscript'
import { SmartRecordExtract } from '@/pages/board2/SmartRecordExtract'
import { SmartRecordHistory } from '@/pages/board2/SmartRecordHistory'
import { SmartQAHome } from '@/pages/board2/SmartQAHome'
import { SmartQAChat } from '@/pages/board2/SmartQAChat'
import { SmartQADetail } from '@/pages/board2/SmartQADetail'
import { SmartOfficeHome } from '@/pages/board2/SmartOfficeHome'
import { SmartOffice } from '@/pages/board2/SmartOffice'
import { SmartOfficeSystem } from '@/pages/board2/SmartOfficeSystem'
import { SmartOfficeEditor } from '@/pages/board2/SmartOfficeEditor'
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
import { DataAnalytics } from '@/pages/board4/DataAnalytics'
import { KnowledgeHub } from '@/pages/board4/KnowledgeHub'
import { KnowledgeList } from '@/pages/board4/KnowledgeList'
import { KnowledgeExport } from '@/pages/board4/KnowledgeExport'
import { KnowledgeAudit } from '@/pages/board4/KnowledgeAudit'
import { AnalyticsHome } from '@/pages/board4/AnalyticsHome'

/** ── UA 检测（对齐后端 DeviceDetectMiddleware 正则） ── */
const MOBILE_UA_RE = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|webOS/i

/** 根据客户端 UA 判断是否为移动设备 */
function isMobileDevice(): boolean {
  return MOBILE_UA_RE.test(navigator.userAgent)
}

/**
 * 受保护页面区域 — 所有需要登录才能访问的路由。
 * ProtectedRoute 会在认证检查完成前显示 loading，未认证则重定向到 /login。
 *
 * UA 分流：
 *   - 移动端 UA：/ → /b/board1（TabHomePage 小耕对话卡片布局）
 *   - PC 端 UA：/ → Home（模块总览），/b/:board → 重定向到 /m/morning-plan
 */
function ProtectedPages() {
  const mobile = isMobileDevice()

  return (
    <AppShell>
      <Routes>
        {mobile ? (
          /* ──── 移动端路由 ──── */
          <>
            <Route path="/" element={<Navigate to="/b/board1" replace />} />
            <Route path="/b/:board" element={<TabHomePage />} />
          </>
        ) : (
          /* ──── PC 端路由 ──── */
          <>
            <Route path="/" element={<Home />} />
            {/* PC 端拦截移动专属路由 → 重定向到朝有规划 */}
            <Route path="/b/:board" element={<Navigate to="/m/morning-plan" replace />} />
          </>
        )}

        {/* 朝有规划 — 6 个独立页面 */}
        <Route path="/m/morning-plan" element={<MorningPlanEntry />} />
        <Route path="/m/morning-plan/chat" element={<MorningPlanChat />} />
        <Route path="/m/morning-plan/list" element={<MorningPlanList />} />
        <Route path="/m/morning-plan/complete" element={<MorningPlanComplete />} />
        <Route path="/m/morning-plan/offline" element={<MorningPlanOffline />} />
        <Route path="/m/morning-plan/settings" element={<MorningPlanSettings />} />

        {/* 暮有复盘 — 4 个独立页面 */}
        <Route path="/m/evening-review" element={<EveningReviewEntry />} />
        <Route path="/m/evening-review/chat" element={<EveningReviewChat />} />
        <Route path="/m/evening-review/report" element={<EveningReviewReport />} />
        <Route path="/m/evening-review/history" element={<EveningReviewHistory />} />

        {/* 情绪树洞 — 4 个独立页面 */}
        <Route path="/m/mood-haven" element={<MoodHavenEntry />} />
        <Route path="/m/mood-haven/chat" element={<MoodHavenChat />} />
        <Route path="/m/mood-haven/growth" element={<MoodHavenGrowth />} />
        <Route path="/m/mood-haven/history" element={<MoodHavenHistory />} />

        {/* 智能记录 (M4) — 5 个独立页面 */}
        <Route path="/m/smart-record" element={<SmartRecordHome />} />
        <Route path="/m/smart-record/recording" element={<SmartRecordRecording />} />
        <Route path="/m/smart-record/transcript" element={<SmartRecordTranscript />} />
        <Route path="/m/smart-record/extract" element={<SmartRecordExtract />} />
        <Route path="/m/smart-record/history" element={<SmartRecordHistory />} />

        {/* 智能问答 (M5) — 3 个独立页面 */}
        <Route path="/m/smart-qa" element={<SmartQAHome />} />
        <Route path="/m/smart-qa/chat" element={<SmartQAChat />} />
        <Route path="/m/smart-qa/detail" element={<SmartQADetail />} />

        {/* 智能办公 (M6) — 4 个独立页面 */}
        <Route path="/m/smart-office" element={<SmartOfficeHome />} />
        <Route path="/m/smart-office/work" element={<SmartOffice />} />
        <Route path="/m/smart-office/system" element={<SmartOfficeSystem />} />
        <Route path="/m/smart-office/editor" element={<SmartOfficeEditor />} />

        {/* 高维求职 (M7) — 5 个独立页面 */}
        <Route path="/m/career-mentor" element={<CareerMentor />} />
        <Route path="/m/career-mentor/steps" element={<CareerMentorStep1 />} />
        <Route path="/m/career-mentor/double" element={<CareerMentorStep23 />} />
        <Route path="/m/career-mentor/interview" element={<CareerMentorStep4 />} />
        <Route path="/m/career-mentor/select" element={<CareerMentorStep5 />} />

        {/* 品牌打造中心 (M8) — 4 个独立页面 */}
        <Route path="/m/brand-building" element={<BrandBuildingEntry />} />
        <Route path="/m/brand-building/generate" element={<BrandBuildingGenerate />} />
        <Route path="/m/brand-building/schedule" element={<BrandBuildingSchedule />} />
        <Route path="/m/brand-building/data" element={<BrandBuildingData />} />

        {/* 拿下一个客户 (M9) — 4 个独立页面 */}
        <Route path="/m/acquire-client" element={<AcquireClientEntry />} />
        <Route path="/m/acquire-client/diagnosis" element={<AcquireClientDiagnosis />} />
        <Route path="/m/acquire-client/meeting" element={<AcquireClientMeeting />} />
        <Route path="/m/acquire-client/contract" element={<AcquireClientContract />} />

        {/* 打磨一套产品 (M10) — 4 个独立页面 */}
        <Route path="/m/product-design" element={<ProductDesignEntry />} />
        <Route path="/m/product-design/diagnosis" element={<ProductDesignDiagnosis />} />
        <Route path="/m/product-design/target" element={<ProductDesignTarget />} />
        <Route path="/m/product-design/finalize" element={<ProductDesignFinalize />} />

        {/* 交付一笔订单 (M11) — 3 个独立页面 */}
        <Route path="/m/deliver-order" element={<OrderDeliveryEntry />} />
        <Route path="/m/deliver-order/gantt" element={<OrderDeliveryGantt />} />
        <Route path="/m/deliver-order/issues" element={<OrderDeliveryIssues />} />

        {/* 公私智库 (M12) — 5 个独立视图 */}
        <Route path="/m/knowledge-base" element={<KnowledgeHub />} />
        <Route path="/m/knowledge-base/list" element={<KnowledgeList />} />
        <Route path="/m/knowledge-base/export/:id" element={<KnowledgeExport />} />
        <Route path="/m/knowledge-base/audit" element={<KnowledgeAudit />} />

        {/* 数据分析 (M13) — 2 个独立视图 */}
        <Route path="/m/data-analytics" element={<AnalyticsHome />} />
        <Route path="/m/data-analytics/insight" element={<DataAnalytics />} />

        {/* 模块入口模板（/m/:slug 必须放在具体路径之后） */}
        <Route path="/m/:slug" element={<ModuleEntry />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}

/**
 * 路由表：
 * /login                  登录页（全屏，无 AppShell）
 * /register               注册页（全屏，无 AppShell）
 * /*                      所有受保护路由（需登录）
 *
 * UA 分流规则（基于 navigator.userAgent）：
 * ── 移动端 ──
 * /                       重定向到 /b/board1（小耕对话卡片布局）
 * /b/:board               板块卡片网格（点底部 Tab 进入）
 * ── PC 端 ──
 * /                       Home 模块总览
 * /b/:board               → 重定向到 /m/morning-plan（PC 不展示移动卡片布局）
 *
 * 公共 /m/* 路由（PC & 移动端均可访问）：
 * /m/morning-plan/*       朝有规划 — 6 个独立页面
 * /m/evening-review/*     暮有复盘 — 4 个独立页面
 * /m/mood-haven/*         情绪树洞 — 4 个独立页面
 * /m/:slug/*              其他模块核心代表页
 */
export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          {/* 公开路由：登录/注册页（无 AppShell 全屏） */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* 受保护路由：所有其他页面均需登录 */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <ProtectedPages />
              </ProtectedRoute>
            }
          />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}
