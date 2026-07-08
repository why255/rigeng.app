/**
 * 智能记录 · 共享常量。
 * 移动端和 PC 端共用。
 */

export const BRAND_SLOGAN = '日耕朝夕，耕愈工作，耕暖生活';
export const BRAND_TITLE = '随时随地录，所言成资产';
export const MODULE_NAME = '智能记录';

export interface SceneInfo {
  key: string;
  icon: string;
  color: string;
}

export const SCENES: SceneInfo[] = [
  { key: '面试', icon: 'mingcute:user-3-line', color: '#6B8FBF' },
  { key: '会议', icon: 'mingcute:presentation-1-line', color: '#D4A574' },
  { key: '日常', icon: 'mingcute:chat-1-line', color: '#BCAAA4' },
  { key: '自定义', icon: 'mingcute:settings-2-line', color: '#E8A94D' },
];

export const SCENE_COLORS: Record<string, string> = {
  '面试': '#6B8FBF',
  '会议': '#D4A574',
  '日常': '#BCAAA4',
  '自定义': '#E8A94D',
};

export const TELEPROMPTER_ITEMS = [
  '1. 请候选人简要自我介绍（1-2分钟）',
  '2. 追问上一段离职原因及职业规划',
  '3. 核心技能匹配度评估',
  '4. 期望薪资与到岗时间确认',
];

/** 格式化秒数 → MM:SS */
export function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
