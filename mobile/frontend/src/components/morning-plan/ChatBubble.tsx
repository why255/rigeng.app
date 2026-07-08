/**
 * ChatBubble — 对话气泡（小耕助手 + 用户）。
 * 纯 BEM 类名 + 内联 style，无 Tailwind。
 */
import { Icon } from '@iconify/react';

export interface ChatBubbleProps { role: 'assistant' | 'user'; text: string; time?: string; }

export function ChatBubble({ role, text, time }: ChatBubbleProps) {
  const isAssistant = role === 'assistant';
  return (
    <div className={`mp-bubble-row message-enter ${isAssistant ? '' : 'mp-bubble-row--user'}`}>
      {isAssistant ? (
        <div className="mp-avatar mp-avatar--geng">耕</div>
      ) : (
        <div className="mp-avatar mp-avatar--user">苏</div>
      )}
      <div className={`mp-bubble-wrapper ${isAssistant ? '' : 'mp-bubble-wrapper--user'}`}>
        <div className={`mp-bubble ${isAssistant ? 'mp-bubble--assistant' : 'mp-bubble--user'}`}>
          <span>{text}</span>
        </div>
        {time && <span className={`mp-bubble-time ${isAssistant ? '' : 'mp-bubble-time--user'}`}>{time}</span>}
      </div>
    </div>
  );
}

export interface VoiceBubbleProps { transcript?: string; time?: string; playing?: boolean; onPlay?: () => void; }

export function VoiceBubble({ time, playing, onPlay }: VoiceBubbleProps) {
  return (
    <div className="mp-bubble-row mp-bubble-row--user message-enter">
      <div className="mp-avatar mp-avatar--user">苏</div>
      <div className="mp-bubble-wrapper mp-bubble-wrapper--user">
        <div
          className={`mp-bubble-voice ${playing ? 'mp-bubble-voice--playing' : 'mp-bubble-voice--idle'}`}
          onClick={onPlay}
        >
          <Icon
            icon={playing ? 'solar:pause-circle-bold' : 'solar:play-circle-bold'}
            className="mp-bubble-voice__icon"
          />
          <span className="mp-bubble-voice__label">语音消息</span>
        </div>
        {time && <span className="mp-bubble-time mp-bubble-time--user">{time}</span>}
      </div>
    </div>
  );
}
