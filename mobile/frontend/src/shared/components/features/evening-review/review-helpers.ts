/**
 * 暮有复盘 · 共享辅助函数。
 * 移动端和 PC 端共用。
 */
import type { ReviewStage } from '../../../api/reviews';
import { AI_REPLIES, REFUSAL_KEYWORDS } from './review-constants';

/** 检测用户输入是否包含拒绝关键词 */
export function detectRefusal(text: string): boolean {
  return REFUSAL_KEYWORDS.some(kw => text.includes(kw));
}

/** 从当前阶段随机选取一条 AI 回复 */
export function pickReply(stage: ReviewStage): string {
  const replies = AI_REPLIES[stage];
  return replies[Math.floor(Math.random() * replies.length)];
}

/** 获取当前时间字符串 HH:MM */
export function getTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 判断信息收集阶段是否应推进到正式复盘 */
export function shouldAdvanceToReview(userMessages: string[], rounds: number): boolean {
  let score = 0;
  const eventKW = ['完成', '做了', '开了', '面试', '会议', '写', '提交', '处理', '对接', '沟通'];
  if (userMessages.filter(msg => eventKW.some(k => msg.includes(k))).length >= 2) score++;
  const emotionKW = ['开心', '累', '焦虑', '压力', '满意', '失望', '兴奋', '沮丧', '烦躁', '充实'];
  if (userMessages.some(msg => emotionKW.some(k => msg.includes(k)))) score++;
  const difficultyKW = ['困难', '问题', '不足', '失败', '没做好', '不顺利', '麻烦', '头疼'];
  if (userMessages.some(msg => difficultyKW.some(k => msg.includes(k)))) score++;
  const doneKW = ['差不多', '就这些', '说完了', '没有了', '就这样', '可以了'];
  if (userMessages.some(msg => doneKW.some(k => msg.includes(k)))) score++;
  if (rounds >= 6) score++;
  if (rounds >= 8) return true;
  return score >= 2;
}

/** 计算勇气值消息 */
export function getCourageMessage(courageValue: number, messages: string[]): string {
  const idx = Math.min(messages.length - 1, Math.max(0, Math.floor((courageValue / 100) * messages.length)));
  return messages[idx];
}
