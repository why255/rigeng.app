/**
 * 暮有复盘 · 共享常量。
 * 移动端和 PC 端共用 —— 复盘流程的阶段定义、AI 回复模板、关键词检测等。
 */
import type { ReviewStage } from '../../../api/reviews';

// ── 五阶段定义 ──

export interface StageInfo {
  key: ReviewStage;
  label: string;
}

export const STAGES: StageInfo[] = [
  { key: 'greeting', label: '问候' },
  { key: 'inventory', label: '盘点' },
  { key: 'extraction', label: '萃取' },
  { key: 'improvement', label: '改进' },
  { key: 'archive', label: '归档' },
];

// ── 阶段提示语 ──

export const STAGE_PROMPTS: Record<ReviewStage, string> = {
  greeting: '晚上好！今天过得怎么样？完成了哪些事情呢？',
  inventory: '回顾这一天，最大的收获是什么？有没有什么让你印象深刻的？',
  extraction: '这段经历里，你觉得能提炼成标准流程（SOP）的是什么？',
  improvement: '有没有哪些地方觉得可以做得更好？明天打算怎么改进？',
  archive: '复盘得很好！今天的复盘马上归档，有任何想补充的吗？',
};

// ── 阶段流转 ──

export const STAGE_TRANSITIONS: Record<ReviewStage, ReviewStage | null> = {
  greeting: 'inventory',
  inventory: 'extraction',
  extraction: 'improvement',
  improvement: 'archive',
  archive: null,
};

// ── AI 回复模板 ──

export const AI_REPLIES: Record<ReviewStage, string[]> = {
  greeting: [
    '谢谢你分享今天的收获！听起来今天做了不少事。那回顾一下，今天最大的收获或感悟是什么呢？',
    '听起来是很充实的一天！能和我分享一下，今天最有成就感的一件事吗？',
  ],
  inventory: [
    '这个感悟很有价值！把它提炼成一个可复用的方法，你觉得关键步骤是什么？',
    '很好的反思！如果让你把这个经验教给同事，你会怎么说？',
  ],
  extraction: [
    '提炼得很清晰！那么在实践过程中，有什么可以改进的地方吗？或者有什么没想到的？',
    '这个SOP很实用！回顾一下执行过程，有哪个环节最容易被忽略？',
  ],
  improvement: [
    '好的，改进方案记下了。今天的复盘很到位！准备归档吧~',
    '改进方向很明确！明天就从最关键的一点开始突破吧。准备归档？',
  ],
  archive: [
    '复盘已归档！来看看今天的复盘报告吧！',
    '今日复盘成果已保存。每天一个小复盘，积累起来就是大成长！',
  ],
};

// ── 勇气值消息 ──

export const COURAGE_MESSAGES = [
  '你今天面对了有挑战的事情，很棒！',
  '每一次复盘都是成长的阶梯！',
  '敢于正视自己，就是最大的勇气！',
  '你的坦诚让复盘更有价值！',
  '今天的沉淀，会成为明天的底气！',
];

// ── 拒绝关键词 ──

export const REFUSAL_KEYWORDS = [
  '太累了', '不想复盘', '不做了', '明天再说', '没心情',
  '不想做了', '算了', '跳过', '不写了', '改天',
];

// ── 信息收集阶段 ──

export const INFO_COLLECTION_OPENING = '姐，晚上好~今天有什么收获想复盘的吗？';

export const INFO_FOLLOWUP_QUESTIONS = [
  '今天最有成就感的事是哪件？',
  '今天完成了什么让你觉得有收获？',
  '有没有什么不顺利的？或者遇到什么困难？',
  '今天有没有什么事情让你觉得有点棘手？',
  '今天学到了什么新东西？',
  '和昨天比，今天有什么不一样的感受？',
  '听起来是很有内容的一天！还有别的想补充的吗？',
];

export const TRANSITION_MESSAGE = '好的，我大概了解今天的情况了，我们来做一个系统的复盘吧~';

// ── 品牌标语 ──

export const BRAND_SLOGAN = '日耕朝夕，耕愈工作，耕暖生活';
export const BRAND_TITLE = '睡前做复盘，经验变方法';
export const MODULE_NAME = '暮有复盘';
export const BRAND_COLOR = '#C03A39';
export const ACCENT_COLOR = '#D4A574';
export const WARN_COLOR = '#FFB74D';

// ── 诊断问卷选项 ──

export interface GoalOption {
  value: 'exceeded' | 'completed' | 'partial' | 'delayed' | 'not_started';
  label: string;
}

export const GOAL_OPTIONS: GoalOption[] = [
  { value: 'exceeded', label: '超额完成' },
  { value: 'completed', label: '完成' },
  { value: 'partial', label: '部分完成' },
  { value: 'delayed', label: '延期' },
  { value: 'not_started', label: '未开展' },
];

// ── 星期标签 ──

export const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
