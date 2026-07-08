/**
 * 情绪树洞 · Emotions API 函数。
 */
import { apiGet, apiPost } from './api';

// ── Types ──

export interface TodayEmotion {
  mood: string;           // 当前情绪标签：平静/开心/焦虑/疲惫/委屈…
  mood_emoji: string;     // 对应 emoji
  score: number;          // -10 ~ +10
  courage_value: number;  // 0-100
  has_today_chat: boolean;
}

export interface GrowthRecord {
  id: string;
  date: string;
  category: string;       // 自我成长 / 情绪调节 / 认知转化 …
  category_color: string; // #FFCC80 / #C03A39 / #9E9E9E
  content: string;
  tags: string[];         // 勇气+1 / 小耕启发 / 情绪韧性+1 …
  created_at: string;
}

export interface ChatMessage {
  role: 'assistant' | 'user';
  text: string;
  time?: string;
}

export interface EmotionLogResult {
  saved: boolean;
  message_id: string;
}

export interface CrisisResult {
  triggered: boolean;
  hotline: string;
  message: string;
}

export interface EmotionDaySummary {
  date: string;
  day_of_week: string;
  mood: string;
  mood_emoji: string;
  duration_minutes: number;
  growth_record_count: number;
  score: number;
}

export interface WeeklyEmotion {
  week_label: string;
  days: Array<{
    day: string;          // 周一 ~ 周日
    day_index: number;    // 0-6
    score: number;        // -10 ~ +10
    has_record: boolean;
  }>;
}

export interface EmotionSuggest {
  text: string;
  type: 'empathy' | 'question' | 'reflection';
}

// ── 预设小耕共情回复（离线/兜底用） ──
const XIAOGENG_REPLIES: EmotionSuggest[] = [
  { text: '嗯，小耕在听。这确实不容易，姐，您辛苦了。', type: 'empathy' },
  { text: '还有呢？这件事让您最难过的点是什么？', type: 'question' },
  { text: '姐，小耕在，想哭就哭出来吧，没关系的。', type: 'empathy' },
  { text: '我听到您说的了。有时候，说出来本身就是一种疗愈。', type: 'reflection' },
  { text: '这种感觉我理解。您已经很勇敢了，能面对这些情绪。', type: 'empathy' },
  { text: '如果换个角度看这件事，您会怎么想？', type: 'question' },
  { text: '您的感受是真实且重要的，不需要为此自责。', type: 'empathy' },
  { text: '经历过这些之后，您觉得自己有什么变化吗？', type: 'reflection' },
  { text: '姐，能在这种处境下坚持到现在，已经很了不起了。', type: 'empathy' },
  { text: '有时候烦恼其实是未被拆解的智慧，我们一起慢慢理。', type: 'reflection' },
];

// ── API Functions ──

/** 获取今日情绪概览 */
export function fetchTodayEmotion(): Promise<TodayEmotion> {
  return apiGet<TodayEmotion>('/emotion/today');
}

/** 获取最近成长记录（预览用） */
export function fetchRecentGrowthRecords(limit: number = 3): Promise<GrowthRecord[]> {
  return apiGet<GrowthRecord[]>('/growth/records', { limit: String(limit) });
}

/** 获取成长记录列表 */
export function fetchGrowthRecords(limit: number = 10): Promise<GrowthRecord[]> {
  return apiGet<GrowthRecord[]>('/growth/records', { limit: String(limit) });
}

/** 保存倾诉对话消息 */
export function logEmotionMessage(data: {
  role: 'user' | 'assistant';
  text: string;
  duration_seconds?: number;
}): Promise<EmotionLogResult> {
  return apiPost<EmotionLogResult>('/emotion/log', data);
}

/** 获取小耕共情回复（可调用AI，也可本地兜底） */
export function fetchEmotionSuggest(userMessage: string): Promise<EmotionSuggest> {
  return apiPost<EmotionSuggest>('/emotion/suggest', { message: userMessage });
}

/** 本地生成小耕回复（离线兜底） */
export function getLocalSuggest(_userMessage: string): EmotionSuggest {
  const idx = Math.floor(Math.random() * XIAOGENG_REPLIES.length);
  return XIAOGENG_REPLIES[idx];
}

/** 触发危机干预 */
export function triggerCrisis(reason?: string): Promise<CrisisResult> {
  return apiPost<CrisisResult>('/emotion/crisis', { reason });
}

/** 生成成长记录（结束倾诉时调用） */
export function createGrowthRecord(data: {
  chat_messages: Array<{ role: string; text: string }>;
  emotion_score: number;
  courage_value: number;
  duration_minutes: number;
}): Promise<GrowthRecord> {
  return apiPost<GrowthRecord>('/growth/record', data);
}

/** 获取本周情绪趋势 */
export function fetchWeeklyEmotion(): Promise<WeeklyEmotion> {
  return apiGet<WeeklyEmotion>('/emotion/history', { week: 'current' });
}

/** 获取历史情绪记录列表 */
export function fetchEmotionHistory(): Promise<EmotionDaySummary[]> {
  return apiGet<EmotionDaySummary[]>('/emotion/history', { month: 'current' });
}

/** 检查昨日是否有危机/低落情绪（供朝有规划开场关怀） */
export interface YesterdayCheck {
  had_crisis_yesterday: boolean;
  had_low_mood_yesterday: boolean;
  care_message?: string;
}

export function checkYesterdayCrisis(): Promise<YesterdayCheck> {
  return apiGet<YesterdayCheck>('/emotion/yesterday-check');
}
