/**
 * P2 对话规划页 — 与小耕对话，自然语言/语音描述今日计划。
 * Route: /m/morning-plan/chat [ENTRY POINT]
 * 对齐 m1-p2.html 设计。
 *
 * 新流程：用户从主页点击「朝有规划」→ 直接进入此页。
 * 输入方式：文字输入（回车发送）+ 语音输入（大语音按钮）。
 * AI 提炼计划后每条默认放入「重要紧急」象限。
 * 点击「确认计划」→ /m/morning-plan/list
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useMorningPlan } from '@rigeng/shared/context/MorningPlanContext';
import { useOnlineStatus } from '@rigeng/shared/hooks/useOnlineStatus';
import type { Quadrant } from '@rigeng/shared/api/plans';
import { ChatBubble } from '@/components/morning-plan/ChatBubble';
import { VoiceButton } from '@/components/morning-plan/VoiceButton';
import type { VoiceMode } from '@/components/morning-plan/VoiceButton';
import './morning-plan.css';

interface ChatMessage {
  role: 'assistant' | 'user';
  text: string;
  time: string;
}

function getTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function MorningPlanChat() {
  const navigate = useNavigate();
  const { isOnline } = useOnlineStatus();
  const { addPlan, plans } = useMorningPlan();

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 从 localStorage 读取语音模式设置
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(() => {
    const v = localStorage.getItem('rg_voice_mode');
    return (v === 'click' ? 'click' : 'hold') as VoiceMode;
  });

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: '早安 ☀️ 新的一天开始了！\n告诉我你今天的计划，语音或文字都可以。',
      time: getTimeStr(),
    },
  ]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [showVoiceUI, setShowVoiceUI] = useState(false);

  // 检测离线 → 自动跳转离线模式
  useEffect(() => {
    if (!isOnline) {
      const offlineEnabled = localStorage.getItem('rg_offline_mode_enabled');
      if (offlineEnabled !== 'false') {
        navigate('/m/morning-plan/offline', { replace: true });
      }
    }
  }, [isOnline, navigate]);

  // 监听语音模式变化
  useEffect(() => {
    const handler = () => {
      const v = localStorage.getItem('rg_voice_mode');
      setVoiceMode((v === 'click' ? 'click' : 'hold') as VoiceMode);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }, 100);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, thinking, scrollToBottom]);

  // ── 文字发送 ──────────────────────────────────────
  const handleSendText = useCallback(() => {
    const text = draft.trim();
    if (!text || thinking) return;

    const time = getTimeStr();
    setMessages((prev) => [...prev, { role: 'user', text, time }]);
    setDraft('');
    setThinking(true);

    // 模拟 AI 提炼（可替换为真实 API 调用）
    setTimeout(() => {
      // 简单解析：按中文标点分割
      const parts = text.split(/[，,。；;、\n]|还有|另外|以及/).filter((s) => s.trim().length >= 2);

      if (parts.length === 0) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: '抱歉，我没有识别到具体的任务。能再说详细一点吗？比如"回复客户邮件"、"准备项目方案"这样的。',
            time: getTimeStr(),
          },
        ]);
      } else {
        // 默认放入「重要紧急」
        const defaultQuadrant: Quadrant = 'urgent_important';
        parts.forEach((title) => addPlan(title.trim(), defaultQuadrant));

        const taskList = parts.map((t, i) => `${i + 1}. ${t.trim()}`).join('\n');
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: `✅ 已记录：\n${taskList}\n\n继续添加，或点击下方「确认计划」进入下一步`,
            time: getTimeStr(),
          },
        ]);
      }
      setThinking(false);
    }, 1200);
  }, [draft, thinking, addPlan]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  // ── 语音识别回调 ──────────────────────────────────
  const handleTranscript = useCallback(
    (text: string) => {
      const time = getTimeStr();
      // 添加语音消息气泡
      setMessages((prev) => [...prev, { role: 'user', text: `🎤 语音消息`, time }]);
      setShowVoiceUI(false);
      setThinking(true);

      setTimeout(() => {
        const parts = text.split(/[，,。；;、\n]|还有|另外|以及/).filter((s) => s.trim().length >= 2);
        if (parts.length === 0) {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              text: '未能从语音中识别到具体计划，请再试一次或使用文字输入。',
              time: getTimeStr(),
            },
          ]);
        } else {
          const defaultQuadrant: Quadrant = 'urgent_important';
          parts.forEach((title) => addPlan(title.trim(), defaultQuadrant));

          const taskList = parts.map((t, i) => `${i + 1}. ${t.trim()}`).join('\n');
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              text: `✅ 已记录语音计划：\n${taskList}\n\n继续添加，或点击下方「确认计划」进入下一步`,
              time: getTimeStr(),
            },
          ]);
        }
        setThinking(false);
      }, 800);
    },
    [addPlan],
  );

  // ── 确认计划 → 跳转到列表页 ────────────────────────
  const handleConfirm = () => {
    if (plans.length === 0) {
      alert('请先添加至少一项计划');
      return;
    }
    navigate('/m/morning-plan/list');
  };

  // ── 输入框按钮状态 ──────────────────────────────────
  const hasText = draft.trim().length > 0;

  return (
    <div className="mp-mobile-page">
      {/* 顶部栏（含设置按钮） */}
      <header className="mp-mobile-page__header" style={{ height: 48 }}>
        <button
          className="w-10 h-10 flex items-center justify-center text-gray-600"
          onClick={() => navigate(-1)}
        >
          <Icon icon="solar:alt-arrow-left-linear" className="text-2xl" />
        </button>
        <span className="text-lg font-bold text-[#C03A39] tracking-wide"
          style={{ fontFamily: "'ZCOOL XiaoWei', '华文楷体', 'KaiTi', serif" }}>
          朝有规划
        </span>
        <button
          className="w-9 h-9 flex items-center justify-center rounded-full text-[#C03A39] active:bg-[rgba(192,58,57,0.1)] transition-colors"
          onClick={() => navigate('/m/morning-plan/settings')}
        >
          <Icon icon="solar:settings-linear" className="text-2xl" />
        </button>
      </header>

      {/* 对话区 */}
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-2" ref={scrollRef}>
        {/* 品牌标语 */}
        <div className="text-center mb-2">
          <div className="text-[15px] font-bold text-[#333]">日耕朝夕，耕愈工作，耕暖生活</div>
        </div>
        <div className="text-center mb-6">
          <p className="text-[17px] font-bold text-[#333]"
            style={{ fontFamily: "'ZCOOL XiaoWei', '华文楷体', 'KaiTi', serif" }}>
            晨起做规划，整日不慌忙
          </p>
          <p className="text-xs text-gray-400 mt-1">告诉我你今天想完成什么 👇</p>
        </div>

        {/* 消息列表 */}
        <div className="space-y-4">
          {messages.map((m, i) => (
            <ChatBubble key={i} role={m.role} text={m.text} time={m.time} />
          ))}

          {/* 思考动画 */}
          {thinking && (
            <div className="flex items-start gap-2 message-enter">
              <div className="flex-none w-9 h-9 rounded-full bg-[#C03A39] flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                style={{ fontFamily: "'ZCOOL XiaoWei', '华文楷体', 'KaiTi', serif" }}>
                耕
              </div>
              <div className="mp-thinking">
                <span>小耕在整理你的计划…</span>
              </div>
            </div>
          )}

          {/* 已提取任务预览 + 确认按钮 */}
          {plans.length > 0 && (
            <div className="mp-chat-tasks">
              <div className="mp-chat-tasks__title">
                <Icon icon="mingcute:clipboard-line" className="inline mr-1 text-[#C03A39]" />
                小耕已为您整理今日计划
              </div>
              <div className="flex flex-col gap-2">
                {plans.map((p) => (
                  <div key={p.id} className="mp-chat-task-item">
                    <span className="mp-chat-task-item__title">{p.text}</span>
                    <span className="mp-chat-task-item__quadrant">重要紧急</span>
                  </div>
                ))}
              </div>
              <button
                className="mp-btn-primary mt-4"
                onClick={handleConfirm}
              >
                确认计划
              </button>
            </div>
          )}
        </div>
      </main>

      {/* 底部输入区域 */}
      <div className="flex flex-col px-4 pt-2 pb-2 bg-gradient-to-t from-[#F5F3EF] to-transparent">
        {/* 语音输入 UI（大按钮模式） */}
        {showVoiceUI && (
          <div className="mb-2">
            <VoiceButton
              mode={voiceMode}
              offline={false}
              onTranscript={handleTranscript}
            />
          </div>
        )}

        {/* 输入框行 */}
        <div className="flex items-center gap-2 bg-white rounded-2xl border border-[#D4C5B0] px-2 py-1 shadow-sm">
          <input
            ref={inputRef}
            className="flex-1 bg-transparent px-3 py-3 text-sm outline-none placeholder-gray-400"
            placeholder="输入今天的计划..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowVoiceUI(false)}
            autoComplete="off"
          />
          <button
            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#C03A39] text-white transition-all flex-shrink-0"
            onClick={() => {
              if (hasText) {
                handleSendText();
              } else {
                setShowVoiceUI((prev) => !prev);
              }
            }}
          >
            <Icon
              icon={hasText ? 'solar:arrow-up-linear' : 'solar:microphone-3-linear'}
              className="text-xl"
            />
          </button>
        </div>
      </div>
    </div>
  );
}
