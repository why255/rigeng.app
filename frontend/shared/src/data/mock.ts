/* 各代表页假数据（演示用，正式版替换为 FastAPI 接口） */

export interface ChatMsg {
  role: 'assistant' | 'user'
  text: string
  voice?: boolean
}

/* M1 朝有规划·对话主页 */
export const morningPlanChat: ChatMsg[] = [
  { role: 'assistant', text: '早上好，姐！今天有什么计划？跟小耕说说，我帮您一起把今天理清。' },
  { role: 'user', text: '今天有 3 个会议要准备，还有一个项目方案要写。', voice: true },
  {
    role: 'assistant',
    text: '好的！小耕帮您提炼成三个计划：\n① 准备会议材料（9:00-10:30）\n② 项目方案框架（14:00-16:00）\n③ 复盘今日工作（17:00-17:30）',
  },
]

export const morningPlanItems = [
  { title: '准备会议材料', time: '9:00-10:30', quadrant: '重要且紧急', color: '#F44336' },
  { title: '项目方案框架', time: '14:00-16:00', quadrant: '重要不紧急', color: '#FF9800' },
  { title: '复盘今日工作', time: '17:00-17:30', quadrant: '不重要但紧急', color: '#2196F3' },
]

/* M3 情绪树洞·倾诉对话 */
export const moodHavenChat: ChatMsg[] = [
  { role: 'assistant', text: '小耕在这里，有什么想说的都可以告诉我，慢慢来 👂' },
  { role: 'user', text: '最近工作压力好大，感觉做什么都不太顺利……' },
  { role: 'assistant', text: '我听到了。这种感受太正常了，不是您的错。愿意多跟我说说，是什么样的压力吗？' },
]

/* M6 智能办公·双库 */
export const officeDrafts = [
  { name: '岗位 JD · 高级 HRBP', progress: 80 },
  { name: '年度培训方案', progress: 40 },
]
export const officeChartData = [12, 18, 9, 22, 16, 24]
export const officeChartLabels = ['战略', '招聘', '培训', '薪酬', '绩效', '员工']

/* M7 高维求职·五步法 */
export const careerSteps = [
  { key: 's1', name: '一盘·诊断', status: 'done' as const },
  { key: 's2', name: '二定·定位', status: 'done' as const },
  { key: 's3', name: '三投·投递', status: 'done' as const },
  { key: 's4', name: '四面·面试', status: 'current' as const },
  { key: 's5', name: '五选·选择', status: 'todo' as const },
]
export const abilityRadar = {
  axes: ['沟通', '逻辑', '专业', '抗压', '执行', '领导'],
  values: [82, 70, 88, 65, 78, 60],
}
export const offerCompare = {
  axes: ['薪资', '成长', '稳定', '文化', '通勤'],
  a: [80, 70, 60, 75, 50],
  b: [65, 85, 80, 70, 90],
}

/* ===== M5 智能问答 ===== */

export interface HotQuestion {
  id: string
  text: string
}

export const hotQuestions: HotQuestion[] = [
  { id: 'q1', text: '试用期员工不符合录用条件，如何合规解除？' },
  { id: 'q2', text: '薪酬宽带如何设计才能激励老员工？' },
  { id: 'q3', text: '年底绩效面谈怎么引导员工说出真实想法？' },
  { id: 'q4', text: '竞业限制协议在什么情况下可以免除？' },
  { id: 'q5', text: '新员工入职培训体系怎么搭建？' },
  { id: 'q6', text: '裁员补偿金怎么计算才合法？' },
]

export interface SourceEngine {
  key: 'private' | 'xiejun' | 'internet'
  label: string
  icon: string
  enabled: boolean
  warnLabel?: string
}

export const defaultSourceEngines: SourceEngine[] = [
  { key: 'private', label: '私有库', icon: '🔒', enabled: true },
  { key: 'xiejun', label: '携君库', icon: '👥', enabled: true },
  { key: 'internet', label: '互联网', icon: '🌐', enabled: false, warnLabel: '请核实' },
]

export interface AnswerElement {
  key: string
  title: string
  icon: string
  color: string
  summary: string
  detail: string[]
}

export interface QaAnswer {
  id: string
  question: string
  intro: string
  elements: AnswerElement[]
  source: {
    title: string
    library: string
    label: string
    updatedAt: string
    verified: boolean
    isInternet?: boolean
    isStale?: boolean
  }
}

export const sampleAnswer: QaAnswer = {
  id: 'a1',
  question: '试用期员工不符合录用条件，如何合规解除？',
  intro: '针对"试用期不符合录用条件"的合规解除，建议按以下四要素结构化方案执行：',
  elements: [
    {
      key: 'key-points',
      title: '操作要点',
      icon: '📋',
      color: '#C03A39',
      summary: '必须在试用期届满前发出解除通知，并明确指出具体的录用条件及不符合的事实依据。',
      detail: [
        '明确解除时间：必须在试用期最后一天结束前，将解除通知送达员工。若试用期已过，则不能再以此理由解除。',
        '书面通知：必须出具书面的《解除劳动合同通知书》，并由员工签收。',
        '事实依据：通知书中应明确列举员工在试用期内不符合录用条件的具体事实（如：XX考核未达标、XX行为违反岗位要求等）。',
      ],
    },
    {
      key: 'cautions',
      title: '注意事项',
      icon: '⚠️',
      color: '#E8A94D',
      summary: '录用条件需提前公示并由员工签字确认；评估过程需有客观量化的证据支撑。',
      detail: [
        '录用条件公示：员工入职时已签署确认《岗位说明书》或录用标准。',
        '考核过程客观：有量化的考核数据、工作周报或导师评估记录。',
        '关联性证明：证明员工表现确实不符合当初设定的录用标准。',
      ],
    },
    {
      key: 'script',
      title: '沟通话术',
      icon: '💬',
      color: '#6B8FBF',
      summary: '"根据近期的评估反馈，您在XX方面的表现与岗位录用标准存在一定差距，经综合考虑……"',
      detail: [
        '「根据《劳动合同法》第39条，试用期员工不符合录用条件需要提供明确的考核标准和书面记录，建议您在试用期内定期进行绩效评估并保留沟通记录。」',
      ],
    },
    {
      key: 'standard',
      title: '达成标准',
      icon: '🎯',
      color: '#27AE60',
      summary: '员工签署《解除劳动合同通知书》，完成工作交接，且未产生劳动争议投诉。',
      detail: [
        '完成证据链闭环（考核标准书面化→考核过程记录→不符合结论书面告知→协商解除或依法单方解除），确保每步都有员工签字确认或邮件留存。',
      ],
    },
  ],
  source: {
    title: '《劳动法合规操作手册 · 2026版》',
    library: '携君库',
    label: '文档较新',
    updatedAt: '2026-06-15',
    verified: true,
  },
}

export interface QaConversation {
  id: string
  question: string
  messages: {
    role: 'assistant' | 'user'
    text: string
    answer?: QaAnswer
  }[]
}

export const sampleConversation: QaConversation = {
  id: 'conv1',
  question: '试用期员工不符合录用条件，如何合规解除？',
  messages: [
    { role: 'assistant', text: '你好！我是小耕，你的 HR 智能助手。有什么问题尽管问我~' },
    { role: 'user', text: '试用期员工不符合录用条件，如何合规解除？' },
    { role: 'assistant', text: '针对"试用期不符合录用条件"的合规解除，建议按以下四要素结构化方案执行：' },
  ],
}

/* M13 数据分析 */
export const growthTrend = [40, 52, 48, 65, 72, 80, 88]
export const growthLabels = ['一月', '二月', '三月', '四月', '五月', '六月', '七月']
export const moduleUsage = [24, 18, 30, 12, 20]
export const moduleUsageLabels = ['对话', '记录', '问答', '办公', '求职']
export const moodTrend = [-2, 1, -4, 3, 5, 2, 6]

/* ===== M4 智能记录 ===== */

export interface Recording {
  id: string
  title: string
  scene: '面试' | '会议' | '日常' | '自定义'
  sceneColor: string
  date: string
  duration: string
  durationSec: number
  status: 'completed' | 'transcribing' | 'extracting' | 'failed'
  progress?: number
}

export const todayStats = { count: 3, totalMinutes: 45 }

export const recentRecordings: Recording[] = [
  { id: 'r1', title: '产品经理面试 - 张三', scene: '面试', sceneColor: '#6B8FBF', date: '今天 14:30', duration: '32:15', durationSec: 1935, status: 'completed' },
  { id: 'r2', title: '周会记录', scene: '会议', sceneColor: '#D4A574', date: '今天 10:00', duration: '45:20', durationSec: 2720, status: 'extracting' },
  { id: 'r3', title: '日常随记', scene: '日常', sceneColor: '#BCAAA4', date: '昨天 16:45', duration: '08:30', durationSec: 510, status: 'completed' },
]

export const historyRecordings: Recording[] = [
  { id: 'r1', title: '前端工程师面试 - 张三', scene: '面试', sceneColor: '#6B8FBF', date: '今天', duration: '12:30', durationSec: 750, status: 'completed' },
  { id: 'r4', title: '部门周会 - 项目进度同步', scene: '会议', sceneColor: '#D4A574', date: '昨天', duration: '45:20', durationSec: 2720, status: 'completed' },
  { id: 'r5', title: '产品灵感记录', scene: '日常', sceneColor: '#BCAAA4', date: '06-20', duration: '08:15', durationSec: 495, status: 'transcribing', progress: 60 },
  { id: 'r6', title: '产品经理面试 - 李四', scene: '面试', sceneColor: '#6B8FBF', date: '06-19', duration: '35:00', durationSec: 2100, status: 'extracting', progress: 30 },
]

export interface TranscriptSegment {
  speaker: string
  time: string
  text: string
  confidence: number
  isCandidate?: boolean
}

export const transcriptData: TranscriptSegment[] = [
  { speaker: '面试官', time: '00:00', text: '你好，欢迎来参加面试。请先简单介绍一下你自己吧。', confidence: 97 },
  { speaker: '候选人', time: '00:05', text: '面试官你好，我叫张三，毕业于浙江大学计算机专业，有5年前端开发经验。', confidence: 95, isCandidate: true },
  { speaker: '面试官', time: '00:18', text: '你在之前的项目中遇到过什么技术挑战吗？', confidence: 98 },
  { speaker: '候选人', time: '00:25', text: '之前做一个大型电商平台的项目时，遇到了首屏加载性能瓶颈。我们通过代码分割、图片懒加载和SSR优化，最终将加载时间从6秒降到了1.8秒。', confidence: 88, isCandidate: true },
  { speaker: '面试官', time: '00:45', text: '听起来很不错。那你能说说你平时是怎么做技术选型的吗？', confidence: 96 },
  { speaker: '候选人', time: '00:52', text: '我一般会根据项目需求、团队技术栈和社区生态来做选型。如果项目偏重SEO和首屏性能，我会优先考虑SSR框架如Next.js；如果是内部管理系统，Vue3 + Element Plus会更高效。', confidence: 93, isCandidate: true },
]

export interface ExtractionResult {
  name: string
  role: string
  avatarBg: string
  years: string
  school: string
  skills: string[]
  salary: string
  onboard: string
  competencies: { label: string; stars: number }[]
}

export const extractionData: ExtractionResult = {
  name: '张三',
  role: '前端工程师 · 面试记录',
  avatarBg: '#BCAAA4',
  years: '5 年',
  school: '浙江大学 · 计算机专业',
  skills: ['React', 'Vue', 'TypeScript', 'SSR', '性能优化'],
  salary: '30K - 35K · 14 薪',
  onboard: '1 个月内',
  competencies: [
    { label: '技术能力', stars: 4 },
    { label: '沟通表达', stars: 3 },
    { label: '项目经验', stars: 5 },
    { label: '文化匹配', stars: 3 },
  ],
}
