/* =============================================================
 * 13 模块元数据 · 4 板块
 * 品牌语为锁定书第二章固定资产，100% 引用，不可改动。
 * ============================================================= */

export type BoardId = 'board1' | 'board2' | 'board3' | 'board4' | 'board5'
export type ContainerWidth = 'chat' | 'dashboard'

export interface Board {
  id: BoardId
  name: string
  icon: string // emoji 占位，正式版替换为国风手绘图标
}

export interface ModuleMeta {
  /** 模块编号 M1..M13 */
  code: string
  /** 路由 slug，对应 data-module 主题键 */
  slug: string
  /** 中文模块名 */
  name: string
  /** 所属板块 */
  board: BoardId
  /** 模块品牌语（锁定书固定资产·10字5+5） */
  slogan: string
  /** 模块品牌语拆解/价值副标题（入口页用） */
  subtitle: string
  /** 容器宽度类型 */
  container: ContainerWidth
  /** 模块图标（emoji 占位） */
  icon: string
  /** 是否已实现独立代表页（否则走通用入口模板） */
  hasPage: boolean
}

/** 品牌主 Slogan —— 唯一，全站可见（锁定书 1.2） */
export const MAIN_SLOGAN = '日耕朝夕，耕愈工作，耕暖生活'
export const BRAND_NAME = '日耕'
export const BRAND_NAME_EN = 'RiGeng'
/** 核心理念（锁定书 1.3，斜体+括号格式） */
export const CORE_CONCEPT = '日耕（RiGeng） — 为不愿止步的高知职场人打造'

export const BOARDS: Board[] = [
  { id: 'board1', name: '小耕对话', icon: '💬' },
  { id: 'board2', name: '升值涨薪', icon: '📈' },
  { id: 'board3', name: '转型升级', icon: '🚀' },
  { id: 'board4', name: '我的智库', icon: '📚' },
]

export const MODULES: ModuleMeta[] = [
  // ===== 板块一·小耕对话 =====
  {
    code: 'M1', slug: 'morning-plan', name: '朝有规划', board: 'board1',
    slogan: '晨起做规划，整日不慌忙', subtitle: '用自然语言聊聊今天，小耕按四象限帮你把工作理清',
    container: 'chat', icon: '🌅', hasPage: true,
  },
  {
    code: 'M2', slug: 'evening-review', name: '暮有复盘', board: 'board1',
    slogan: '睡前做复盘，经验变方法', subtitle: '像聊家常一样回顾今天，做得好沉淀成 SOP',
    container: 'chat', icon: '🌙', hasPage: true,
  },
  {
    code: 'M3', slug: 'mood-haven', name: '情绪树洞', board: 'board1',
    slogan: '心事有处说，烦恼变智慧', subtitle: '一个私密安全的树洞，先被接住，再把吐槽转化为成长',
    container: 'chat', icon: '🌳', hasPage: true,
  },
  // ===== 板块二·升值涨薪 =====
  {
    code: 'M4', slug: 'smart-record', name: '智能记录', board: 'board2',
    slogan: '随时随地录，所言成资产', subtitle: '一键录音自动转文字，说过的话都变成专业资产',
    container: 'dashboard', icon: '🎙️', hasPage: true,
  },
  {
    code: 'M5', slug: 'smart-qa', name: '智能问答', board: 'board2',
    slogan: '随时随地问，答案不瞎编', subtitle: '2-4 轮追问理清真问题，结合你的知识库给可用方案',
    container: 'chat', icon: '❓', hasPage: true,
  },
  {
    code: 'M6', slug: 'smart-office', name: '智能办公', board: 'board2',
    slogan: '告别碎片化，高效又专业', subtitle: '工具库解决今天怎么写，体系库解决体系怎么搭',
    container: 'dashboard', icon: '💼', hasPage: true,
  },
  {
    code: 'M7', slug: 'career-mentor', name: '高维求职', board: 'board2',
    slogan: '高维五步法，前程自发光', subtitle: '一盘二定三投四面五选，做自己职业生涯的雕刻师',
    container: 'dashboard', icon: '🎯', hasPage: true,
  },
  // ===== 板块三·转型升级 =====
  {
    code: 'M8', slug: 'brand-building', name: '品牌打造中心', board: 'board3',
    slogan: '踏实做自己，光芒自然来', subtitle: '深耕专长，同行的认可和机会自然会找上门',
    container: 'dashboard', icon: '✨', hasPage: true,
  },
  {
    code: 'M9', slug: 'acquire-client', name: '拿下一个客户', board: 'board3',
    slogan: '真诚去触达，信任自然生', subtitle: '从第一次触达到深度匹配，从打工到顾问',
    container: 'chat', icon: '🤝', hasPage: true,
  },
  {
    code: 'M10', slug: 'product-design', name: '打磨一套产品', board: 'board3',
    slogan: '经验沉下来，产品自然成', subtitle: '用ABS模型系统化诊断客户，输出A/B双版方案',
    container: 'dashboard', icon: '📦', hasPage: true,
  },
  {
    code: 'M11', slug: 'deliver-order', name: '交付一笔订单', board: 'board3',
    slogan: '事事做到位，信任扎下根', subtitle: '建档分工、甘特可视化、问题看板，交付深扎根的信任',
    container: 'dashboard', icon: '🌱', hasPage: true,
  },
  // ===== 板块四·我的智库 =====
  {
    code: 'M12', slug: 'knowledge-base', name: '公私智库', board: 'board4',
    slogan: '随手存结晶，终成你底气', subtitle: '所有产出自动归档，RAG 语义检索一问就找到',
    container: 'dashboard', icon: '🗂️', hasPage: true,
  },
  {
    code: 'M13', slug: 'data-analytics', name: '数据分析', board: 'board4',
    slogan: '数据照一照，看到好自己', subtitle: '全平台仪表盘一屏看全貌，数据是照见成长的镜子',
    container: 'dashboard', icon: '📊', hasPage: true,
  },
]

export const getModuleBySlug = (slug: string): ModuleMeta | undefined =>
  MODULES.find((m) => m.slug === slug)

export const getModulesByBoard = (board: BoardId): ModuleMeta[] =>
  MODULES.filter((m) => m.board === board)

export const getBoard = (id: BoardId): Board =>
  BOARDS.find((b) => b.id === id)!
