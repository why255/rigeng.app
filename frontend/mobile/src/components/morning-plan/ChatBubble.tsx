/**
 * ChatBubble — 对话气泡组件（小耕助手 + 用户）。
 * 对齐 m1-p2.html 气泡样式。
 */
import { Icon } from '@iconify/react';

export interface ChatBubbleProps {
  role: 'assistant' | 'user';
  text: string;
  time?: string;
  /** 打字机效果：逐字显示文本 */
  typing?: boolean;
}

export function ChatBubble({ role, text, time, typing }: ChatBubbleProps) {
  const isAssistant = role === 'assistant';

  return (
    <div className={`flex items-start gap-2 message-enter ${isAssistant ? '' : 'flex-row-reverse'}`}>
      {/* 头像 */}
      {isAssistant ? (
        <div className="flex-none w-9 h-9 rounded-full bg-[#C03A39] flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
          style={{ fontFamily: "'ZCOOL XiaoWei', '华文楷体', 'KaiTi', serif" }}>
          耕
        </div>
      ) : (
        <div className="flex-none w-9 h-9 rounded-full bg-[#E8D5B7] border border-[#D4A574]/30 flex items-center justify-center text-[#8B7A62] font-bold text-sm flex-shrink-0">
          苏
        </div>
      )}

      {/* 气泡内容 */}
      <div className={`flex flex-col gap-1 ${isAssistant ? '' : 'items-end'} max-w-[80%]`}>
        <div
          className={`p-3 text-sm shadow-sm leading-relaxed ${
            isAssistant
              ? 'bg-[#FFF0E5] rounded-2xl rounded-tl-sm text-[#333]'
              : 'bg-[#F0F0F0] rounded-2xl rounded-tr-sm text-[#333]'
          } ${typing ? 'typing-cursor' : ''}`}
        >
          <span style={{ whiteSpace: 'pre-line' }}>{text}</span>
        </div>
        {time && (
          <span className={`text-[10px] text-gray-400 ${isAssistant ? 'ml-1' : 'mr-1'}`}>
            {time}
          </span>
        )}
      </div>
    </div>
  );
}

/** 语音消息气泡（用户侧） */
export interface VoiceBubbleProps {
  transcript?: string;
  time?: string;
  duration?: string;
  playing?: boolean;
  onPlay?: () => void;
  onLongPress?: () => void;
}

export function VoiceBubble({ transcript, time, duration, playing, onPlay }: VoiceBubbleProps) {
  return (
    <div className="flex items-start gap-2 flex-row-reverse message-enter">
      <div className="flex-none w-9 h-9 rounded-full bg-[#E8D5B7] border border-[#D4A574]/30 flex items-center justify-center text-[#8B7A62] font-bold text-sm flex-shrink-0">
        苏
      </div>
      <div className="flex flex-col gap-1 items-end max-w-[80%]">
        <div
          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl rounded-tr-sm shadow-sm cursor-pointer ${
            playing ? 'bg-[#FFE8E0]' : 'bg-[#F0F0F0]'
          }`}
          onClick={onPlay}
        >
          <Icon
            icon={playing ? 'solar:pause-circle-bold' : 'solar:play-circle-bold'}
            className="text-[#C03A39] text-xl flex-shrink-0"
          />
          <span className="text-sm font-medium">语音消息</span>
          {duration && <span className="text-xs text-gray-400 ml-1">{duration}</span>}
        </div>
        {time && <span className="text-[10px] text-gray-400 mr-1">{time}</span>}
      </div>
    </div>
  );
}
