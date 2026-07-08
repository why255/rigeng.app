/**
 * P2 对话规划页 — 与小耕对话，逐条添加今日计划。
 * Route: /m/morning-plan/chat
 * 对齐 m1-p2.html 设计。
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useMorningPlan } from './MorningPlanContext';
import './morning-plan.css';

interface ChatMessage {
  role: 'assistant' | 'user';
  text: string;
  time: string;
}

function getTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getUserInfo(): { nickname: string } {
  try {
    const raw = localStorage.getItem('rg_user');
    if (raw) {
      const user = JSON.parse(raw);
      return { nickname: user.nickname || '用户' };
    }
  } catch { /* ignore */ }
  return { nickname: '用户' };
}

export function MorningPlanChat() {
  const navigate = useNavigate();
  const { addPlan, clearAll, totalTasks } = useMorningPlan();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { nickname } = getUserInfo();
  const userInitial = nickname.charAt(0);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: '早安 ☀️ 新的一天开始了！\n告诉我你今天的计划吧，我来帮你整理。',
      time: getTime(),
    },
  ]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 100);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const handleAddPlan = useCallback(() => {
    const text = textareaRef.current?.value.trim();
    if (!text) {
      textareaRef.current?.focus();
      return;
    }

    const now = getTime();

    // 用户消息
    setMessages((prev) => [...prev, { role: 'user', text, time: now }]);
    if (textareaRef.current) textareaRef.current.value = '';

    // 模拟小耕回复（300ms 延迟，对齐 p2.html）
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `✅ 已记录：${text}\n继续添加，或点击「确认计划」进入下一步`,
          time: getTime(),
        },
      ]);
      scrollToBottom();
    }, 300);

    addPlan(text);
    textareaRef.current?.focus();
  }, [addPlan, scrollToBottom]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddPlan();
    }
  };

  const handleAutoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  const handleClearAll = () => {
    if (totalTasks === 0) return;
    if (!window.confirm('确定要清空所有计划吗？')) return;

    // 保留欢迎消息，清除其余
    setMessages([
      {
        role: 'assistant',
        text: '早安 ☀️ 新的一天开始了！\n告诉我你今天的计划吧，我来帮你整理。',
        time: getTime(),
      },
    ]);
    clearAll();
  };

  // 语音输入（增强功能）
  const [recording, setRecording] = useState(false);
  const handleVoiceClick = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('您的浏览器不支持语音输入');
      return;
    }
    setRecording(true);
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.start();
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (textareaRef.current) {
        textareaRef.current.value = (textareaRef.current.value + transcript).trim();
        textareaRef.current.focus();
      }
    };
    recognition.onerror = () => setRecording(false);
    recognition.onend = () => setRecording(false);
  };

  const hasItems = totalTasks > 0;

  return (
    <div data-module="morning-plan" data-page="chat">
      <div className="mp-page--chat">
        {/* 品牌标语区（紧凑版） */}
        <div style={{ textAlign: 'center', padding: '24px 0 12px', flex: 'none' }}>
          <div className="mp-hero__slogan" style={{ marginBottom: 8 }}>日耕朝夕，耕愈工作，耕暖生活</div>
          <div className="mp-hero__divider" style={{ margin: '10px auto' }} />
          <h2 className="mp-hero__title--small" style={{ marginTop: 12 }}>晨起做规划，整日不慌忙</h2>
          <p className="mp-hero__subtitle">告诉我你今天想完成什么 👇</p>
        </div>

        {/* 对话流 */}
        <div className="mp-chat">
          <div className="mp-chat__scroll" ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} className={`mp-bubble-row ${m.role === 'user' ? 'mp-bubble-row--user' : ''}`}>
                {m.role === 'assistant' ? (
                  <div className="mp-bubble-avatar mp-bubble-avatar--assistant">
                    <span>耕</span>
                  </div>
                ) : (
                  <div className="mp-bubble-avatar mp-bubble-avatar--user">
                    <span style={{ color: '#8B7A62', fontWeight: 700, fontSize: 14 }}>{userInitial}</span>
                  </div>
                )}
                <div style={{ maxWidth: '80%' }}>
                  <div className={`mp-bubble mp-bubble--${m.role}`}>
                    <span style={{ whiteSpace: 'pre-line' }}>{m.text}</span>
                  </div>
                  <div className="mp-bubble-time" style={m.role === 'user' ? { textAlign: 'right' } : {}}>
                    {m.time}
                  </div>
                </div>
              </div>
            ))}

            {/* 空状态提示 */}
            {!hasItems && (
              <div style={{ textAlign: 'center', padding: '24px 0', opacity: 0.6 }}>
                <span style={{ color: '#D4A574', display: 'block', marginBottom: 12 }}><Icon icon="mingcute:edit-line" width={32} /></span>
                <p style={{ fontSize: 14, color: '#999', margin: 0 }}>在下方输入你的计划</p>
                <p style={{ fontSize: 12, color: '#999', marginTop: 4 }}>可以逐条添加，也可以一次性列出</p>
              </div>
            )}
          </div>

          {/* 底部输入区 */}
          <div className="mp-chat__composer">
            <div className="mp-composer">
              <textarea
                ref={textareaRef}
                placeholder="输入你的计划，例如：完成项目方案初稿..."
                rows={2}
                onKeyDown={handleKeyDown}
                onChange={handleAutoResize}
              />
              <div className="mp-composer__actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: '#999', paddingLeft: 8 }}>按 Enter 添加，Shift+Enter 换行</span>
                <button
                  className="mp-composer__send"
                  onClick={handleAddPlan}
                  title="添加计划"
                  style={{ width: 'auto', padding: '8px 24px', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> 添加计划
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <span style={{ fontSize: 12, color: '#999' }}>已添加 {totalTasks} 条计划</span>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button
                  style={{
                    fontSize: 12,
                    color: '#999',
                    background: 'none',
                    border: 'none',
                    cursor: totalTasks > 0 ? 'pointer' : 'default',
                    textDecoration: 'underline',
                    textDecorationColor: 'rgba(212, 165, 116, 0.3)',
                    textUnderlineOffset: 4,
                    opacity: totalTasks > 0 ? 1 : 0.4,
                  }}
                  onClick={handleClearAll}
                  disabled={totalTasks === 0}
                >
                  清空全部
                </button>
                <button
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#C03A39',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  onClick={() => navigate('/m/morning-plan/list')}
                >
                  确认计划 →
                </button>
              </div>
            </div>

            {/* 语音按钮 */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
              <button
                className={`mp-voice-btn ${recording ? 'mp-voice-btn--recording' : ''}`}
                onClick={handleVoiceClick}
                title={recording ? '录音中…' : '语音输入'}
              >
                <Icon icon="mingcute:mic-line" width={20} style={{ color: '#fff' }} />
              </button>
            </div>

            {/* 跳转链接 */}
            <div style={{ textAlign: 'center', marginTop: 16, paddingBottom: 8 }}>
              <a
                className="mp-nav-link"
                href="#"
                onClick={(e) => { e.preventDefault(); navigate('/m/evening-review'); }}
              >
                跳转至暮有复盘
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
