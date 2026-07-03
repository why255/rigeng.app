/**
 * P5 离线模式页 — 离线录音 + IndexedDB 存储 + 网络恢复自动同步。
 * Route: /m/morning-plan/offline
 * 对齐 m1-p5.html 设计。
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useMorningPlan } from '@rigeng/shared/context/MorningPlanContext';
import { VoiceButton } from '@/components/morning-plan/VoiceButton';
import { ChatBubble, VoiceBubble } from '@/components/morning-plan/ChatBubble';
import {
  getAllRecordings,
  clearAllRecordings,
  getRecordingCount,
  type OfflineRecording,
} from '@rigeng/shared/utils/offlineRecordingsDB';
import type { VoiceMode } from '@/components/morning-plan/VoiceButton';
import './morning-plan.css';

interface ChatMessage {
  role: 'assistant' | 'user';
  type: 'text' | 'voice';
  text: string;
  time: string;
}

function getTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function MorningPlanOffline() {
  const navigate = useNavigate();
  const { addPlan, plans } = useMorningPlan();

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [voiceMode, setVoiceMode] = useState<VoiceMode>(() => {
    const v = localStorage.getItem('rg_voice_mode');
    return (v === 'click' ? 'click' : 'hold') as VoiceMode;
  });

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      type: 'text',
      text: '当前处于离线模式 🎙️\n语音输入将录音保存到本地，网络恢复后可同步发送。',
      time: getTimeStr(),
    },
  ]);

  const [draft, setDraft] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [showVoiceUI, setShowVoiceUI] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  // ── 初始化：加载已存储录音数量 ──────────────────────
  useEffect(() => {
    getRecordingCount().then(setPendingCount);
  }, []);

  // ── 网络恢复检测 ──────────────────────────────────
  useEffect(() => {
    const handleOnline = () => {
      const offlineEnabled = localStorage.getItem('rg_offline_mode_enabled');
      if (offlineEnabled === 'false') {
        // 开关关闭，自动同步并退出
        syncAndExit();
        return;
      }
      // 延迟确认网络真的恢复了
      setTimeout(() => {
        if (navigator.onLine) {
          getRecordingCount().then((count) => {
            if (count > 0) {
              setShowModal(true);
            }
          });
        }
      }, 1500);
    };

    window.addEventListener('online', handleOnline);

    // 如果当前就在线且离线模式关闭，自动退出
    if (navigator.onLine) {
      const offlineEnabled = localStorage.getItem('rg_offline_mode_enabled');
      if (offlineEnabled === 'false') {
        syncAndExit();
      }
    }

    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 100);
  }, []);

  // ── 同步并退出离线模式 ──────────────────────────────
  const syncAndExit = useCallback(async () => {
    const recordings = await getAllRecordings();
    if (recordings.length > 0) {
      // 逐条添加到聊天中
      for (const rec of recordings) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'user',
            type: 'voice',
            text: `离线录音 · ${formatDuration(rec.duration)}`,
            time: getTimeStr(),
          },
        ]);
        // 同时添加到计划
        addPlan(`离线录音计划 · ${formatDuration(rec.duration)}`);
      }
      await clearAllRecordings();
      setPendingCount(0);
    }
    // 退出离线 → 返回对话页
    setTimeout(() => navigate('/m/morning-plan/chat', { replace: true }), 500);
  }, [addPlan, navigate]);

  // ── 文字发送 ──────────────────────────────────────
  const handleSendText = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    const time = getTimeStr();
    setMessages((prev) => [...prev, { role: 'user', type: 'text', text, time }]);
    setDraft('');

    // 在离线模式下也添加到计划中
    const parts = text.split(/[，,。；;、\n]|还有|另外|以及/).filter((s) => s.trim().length >= 2);
    parts.forEach((title) => addPlan(title.trim()));

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          type: 'text',
          text: `✅ 已记录（离线）：${text}`,
          time: getTimeStr(),
        },
      ]);
    }, 300);
  }, [draft, addPlan]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  // ── 离线录音存储回调 ──────────────────────────────
  const handleRecordingStored = useCallback(
    (recording: OfflineRecording) => {
      setPendingCount((c) => c + 1);
      const time = getTimeStr();
      setMessages((prev) => [
        ...prev,
        { role: 'user', type: 'voice', text: `离线录音 · ${formatDuration(recording.duration)}`, time },
      ]);

      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            type: 'text',
            text: `✅ 离线录音已存储 · 时长 ${formatDuration(recording.duration)}`,
            time: getTimeStr(),
          },
        ]);
      }, 350);
    },
    [],
  );

  const hasText = draft.trim().length > 0;

  return (
    <div className="mp-mobile-page">
      {/* 顶部栏 */}
      <header className="mp-mobile-page__header" style={{ height: 48 }}>
        <button
          className="w-10 h-10 flex items-center justify-center text-gray-600"
          onClick={() => {
            if (navigator.onLine) {
              getRecordingCount().then((count) => {
                if (count > 0) setShowModal(true);
                else navigate(-1);
              });
            } else {
              navigate(-1);
            }
          }}
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
          <p className="text-xs text-gray-400 mt-1">离线模式 · 录音将保存在本地 📦</p>
        </div>

        {/* 消息列表 */}
        <div className="space-y-4">
          {messages.map((m, i) => (
            <ChatBubble key={i} role={m.role} text={m.text} time={m.time} />
          ))}

          {/* 已提取任务预览 */}
          {plans.length > 0 && (
            <div className="mp-chat-tasks">
              <div className="mp-chat-tasks__title">
                <Icon icon="mingcute:clipboard-line" className="inline mr-1 text-[#C03A39]" />
                已记录计划（离线）
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
                onClick={() => navigate('/m/morning-plan/list')}
              >
                确认计划
              </button>
            </div>
          )}
        </div>
      </main>

      {/* 底部输入区域 */}
      <div className="flex flex-col px-4 pt-2 pb-2 bg-gradient-to-t from-[#F5F3EF] to-transparent">
        {/* 离线指示器 */}
        {pendingCount > 0 && (
          <div className="flex justify-center mb-2">
            <span className="mp-offline-badge">
              <Icon icon="solar:cloud-cross-linear" className="text-sm" />
              离线录音模式 · {pendingCount}条待同步
            </span>
          </div>
        )}

        {/* 语音输入 UI */}
        {showVoiceUI && (
          <div className="mb-2">
            <VoiceButton
              mode={voiceMode}
              offline={true}
              onRecordingStored={handleRecordingStored}
            />
          </div>
        )}

        {/* 输入框行 */}
        <div className="flex items-center gap-2 bg-white rounded-2xl border border-[#D4C5B0] px-2 py-1 shadow-sm">
          <input
            ref={inputRef}
            className="flex-1 bg-transparent px-3 py-3 text-sm outline-none placeholder-gray-400"
            placeholder="离线模式下输入规划..."
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

      {/* 退出离线模式弹窗 */}
      {showModal && (
        <div className="mp-modal-overlay">
          <div className="mp-modal">
            <h3 className="text-base font-semibold text-[#333] mb-1.5">检测到信号</h3>
            <p className="text-[13px] text-[#666] mb-[18px] leading-relaxed">
              {pendingCount > 0
                ? `您有 ${pendingCount} 条离线录音待同步，是否退出离线模式并自动发送？`
                : '是否退出离线模式？'}
            </p>
            <div className="flex gap-2.5">
              <button
                className="flex-1 py-2.5 rounded-[25px] text-sm font-medium bg-[#f0f0f0] text-[#666] active:bg-[#e0e0e0] transition-colors"
                onClick={() => setShowModal(false)}
              >
                取消
              </button>
              <button
                className="flex-1 py-2.5 rounded-[25px] text-sm font-medium bg-[#C03A39] text-white active:bg-[#A0302E] transition-colors"
                onClick={() => {
                  setShowModal(false);
                  syncAndExit();
                }}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
