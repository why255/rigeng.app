/**
 * P2 计划输入与提炼 — 语音/文字对话（对齐 m1p2.html 设计）。
 * Route: /m/morning-plan/chat
 *
 * 提炼流程：
 * 1. 用户输入 → conversePlan API（morning_plan 模块）
 * 2. LLM 回复尾部包含 ```tasks 块，前端解析出结构化任务+象限
 * 3. 仅展示人性化文案部分（任务块不显示），确认区展示已提炼任务
 * 4. 确认后 → 每个任务连同象限写入 context → 跳转 P3
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useMorningPlan } from '@rigeng/shared/context/MorningPlanContext';
import { useOnlineStatus } from '@rigeng/shared/hooks/useOnlineStatus';
import { conversePlan } from '@rigeng/shared/api/plans';
import type { Quadrant } from '@rigeng/shared/api/plans';
import { QUADRANT_SHORT_LABELS } from '@rigeng/shared/utils/quadrantMapping';
import './morning-plan.css';

/* ── Types ── */

type VoiceMode = 'hold' | 'click';

interface Message {
  key: string;
  role: 'assistant' | 'user';
  type: 'text' | 'voice';
  text: string;       // display text
  time: string;
}

/** 提炼后的结构化任务 */
interface ParsedTask {
  text: string;
  quadrant: Quadrant;
}

/* ── Helpers ── */

let _msgId = 0;
function nextId() { return `msg_${Date.now()}_${++_msgId}`; }
function genPlanId() { return `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
function now() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * 解析 LLM 回复中的 ```tasks 块，提取任务标题 + 象限。
 * @param raw LLM 原始回复
 * @param fallbackText 提取失败时回退到用户原始输入（而非 LLM 全文）
 */
function parseTasksReply(raw: string, fallbackText: string): { displayText: string; tasks: ParsedTask[] } {
  const tasks: ParsedTask[] = [];

  // 匹配 ```tasks ... ``` 区块
  const blockRe = /```tasks\s*\n([\s\S]*?)```/i;
  const match = raw.match(blockRe);

  // 去掉 tasks 块后的纯文本用于气泡展示
  const displayText = match ? raw.replace(blockRe, '').trim().replace(/\n{3,}/g, '\n\n') : raw;

  if (match) {
    const lines = match[1].split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      const parts = line.split(/[|｜]/).map(s => s.trim());
      if (parts.length < 2) continue;

      const title = parts.slice(0, -1).join(' | ');
      const label = parts[parts.length - 1];

      // 过滤占位行：...、___、quadrant 等 LLM 生成的填充内容
      if (/^[.…_—\-]+$/.test(title) || title === '...' || title === '……' || title.length < 2) continue;
      if (/^[.…_—\-]+$/.test(label) || label === '...' || label === '……' || label === 'quadrant' || label === '___') continue;

      // 象限映射（中英文均可）
      const quadrantMap: Record<string, Quadrant> = {
        '重要紧急': 'urgent_important', '重要且紧急': 'urgent_important',
        'urgent_important': 'urgent_important',
        '重要不紧急': 'not_urgent_important',
        'not_urgent_important': 'not_urgent_important',
        '紧急不重要': 'urgent_not_important',
        'urgent_not_important': 'urgent_not_important',
        '不重要不紧急': 'not_urgent_not_important',
        'not_urgent_not_important': 'not_urgent_not_important',
      };
      const q = quadrantMap[label] || 'urgent_important';
      tasks.push({ text: title, quadrant: q });
    }
  }

  // 兜底：无 tasks 块时用用户原始输入，不把 AI 回复当计划
  if (tasks.length === 0) {
    // 尝试按换行/逗号/分号拆成多条
    const rawPlans = fallbackText
      .split(/[,，;；\n。\.]+/)
      .map(s => s.trim())
      .filter(s => s.length > 1);
    if (rawPlans.length > 0) {
      for (const t of rawPlans) tasks.push({ text: t.slice(0, 80), quadrant: 'urgent_important' });
    } else {
      tasks.push({ text: fallbackText.slice(0, 80), quadrant: 'urgent_important' });
    }
  }

  return { displayText: displayText || raw, tasks };
}

/* ── Component ── */

export function MorningPlanChat() {
  const navigate = useNavigate();
  const { isOnline } = useOnlineStatus();
  const { addPlan } = useMorningPlan();

  /* ── Core state ── */
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [recordedTasks, setRecordedTasks] = useState<ParsedTask[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  /* ── Voice state ── */
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('hold');
  const [voiceUIActive, setVoiceUIActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [cancelZone, setCancelZone] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  /* ── Refs ── */
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pressStartYRef = useRef(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Init ── */
  useEffect(() => {
    const saved = localStorage.getItem('rg_voice_mode') as VoiceMode | null;
    if (saved === 'hold' || saved === 'click') setVoiceMode(saved);
  }, []);
  useEffect(() => { if (!isOnline) navigate('/m/morning-plan/offline', { replace: true }); }, [isOnline, navigate]);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const scrollBottom = useCallback(() => {
    setTimeout(() => {
      chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 80);
  }, []);
  useEffect(() => { scrollBottom(); }, [messages, isLoading, showConfirm, voiceUIActive, scrollBottom]);

  /* ═══════════════════════════════════════════════
     Voice Recording
     ═══════════════════════════════════════════════ */

  const startTimer = () => { setRecordingTime(0); timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000); };
  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const initRecognition = () => {
    if (recognitionRef.current) return recognitionRef.current;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('浏览器不支持语音识别'); return null; }
    const r = new SpeechRecognition();
    r.lang = 'zh-CN'; r.continuous = true; r.interimResults = true;
    r.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++)
        if (e.results[i].isFinal) transcriptRef.current += e.results[i][0].transcript;
    };
    r.onerror = (e: any) => { if (e.error === 'not-allowed') alert('请允许麦克风权限'); stopRecording(true); };
    r.onend = () => { if (isRecording) { try { r.start(); } catch { /* */ } } };
    recognitionRef.current = r;
    return r;
  };

  const startRecording = () => {
    const r = initRecognition(); if (!r) return;
    transcriptRef.current = ''; setCancelZone(false);
    try { r.start(); setIsRecording(true); startTimer(); } catch { /* */ }
  };

  const stopRecording = (cancelled = false) => {
    if (!isRecording) return;
    setIsRecording(false); stopTimer();
    try { recognitionRef.current?.stop(); } catch { /* */ }
    setVoiceUIActive(false);
    if (cancelled || cancelZone) return;
    const text = transcriptRef.current.trim();
    if (text) processUserInput(text, true);
  };

  const cancelRecording = () => { if (isRecording) stopRecording(true); };

  /* ═══════════════════════════════════════════════
     Core: process user input through LLM + parse reply
     ═══════════════════════════════════════════════ */

  const processUserInput = async (text: string, isVoice = false) => {
    setIsLoading(true);
    const time = now();
    const userMsg: Message = {
      key: nextId(), role: 'user', type: isVoice ? 'voice' : 'text', text, time,
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const result = await conversePlan(text, conversationId);
      if (result.conversation_id) setConversationId(result.conversation_id);

      const fullReply = result.assistant_reply || `已记录：${text}`;

      // ── 解析 tasks 块 ──
      const { displayText, tasks } = parseTasksReply(fullReply, text);

      // 助理气泡只展示人性化文本
      const replyMsg: Message = {
        key: nextId(), role: 'assistant', type: 'text', text: displayText, time: now(),
      };
      setMessages(prev => [...prev, replyMsg]);

      // 追加提炼后的任务
      setRecordedTasks(prev => {
        const next = [...prev];
        for (const t of tasks) {
          if (!next.some(p => p.text === t.text)) next.push(t);
        }
        return next;
      });
      setShowConfirm(true);
    } catch {
      // LLM 不可用：回退 — 把原始输入当一条计划
      const fallbackReply = `已记录：${text}`;
      setMessages(prev => [...prev, { key: nextId(), role: 'assistant', type: 'text', text: fallbackReply, time: now() }]);
      setRecordedTasks(prev => {
        if (prev.some(p => p.text === text)) return prev;
        return [...prev, { text, quadrant: 'urgent_important' }];
      });
      setShowConfirm(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendText = () => {
    const text = inputText.trim();
    if (!text || isLoading) return;
    setInputText('');
    processUserInput(text);
  };

  const handleConfirm = () => {
    for (const t of recordedTasks) addPlan(t.text, t.quadrant);
    navigate('/m/morning-plan/list');
  };

  /* ═══════════════════════════════════════════════
     Voice UI
     ═══════════════════════════════════════════════ */

  const showVoiceUI = () => { setVoiceUIActive(true); inputRef.current?.blur(); };

  const hasText = inputText.trim().length > 0;

  const handleMicSendClick = () => {
    if (hasText) { handleSendText(); }
    else if (!isRecording) { showVoiceUI(); }
  };

  const handleLargeVoiceStart = (e: React.PointerEvent) => {
    e.preventDefault();
    if (isRecording) return;
    startRecording();
    pressStartYRef.current = e.clientY;
  };

  const handleLargeVoiceEnd = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!isRecording) return;
    if (voiceMode === 'hold') stopRecording(cancelZone);
  };

  const handleLargeVoiceMove = (e: React.PointerEvent) => {
    if (!isRecording || voiceMode !== 'hold') return;
    setCancelZone(pressStartYRef.current - e.clientY > 80);
  };

  const handleLargeVoiceClick = () => {
    if (voiceMode === 'click') {
      if (isRecording) stopRecording(false);
      else startRecording();
    }
  };

  /* Voice bubble long-press */
  const [transcribeTarget, setTranscribeTarget] = useState<string | null>(null);
  const [transcribePos, setTranscribePos] = useState<{ x: number; y: number } | null>(null);

  const handleVoiceBubbleTouchStart = (transcript: string, e: React.TouchEvent | React.MouseEvent) => {
    longPressTimerRef.current = setTimeout(() => {
      setTranscribeTarget(transcript);
      if ('touches' in e) setTranscribePos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      else setTranscribePos({ x: e.clientX, y: e.clientY });
      setTimeout(() => { setTranscribeTarget(null); setTranscribePos(null); }, 2500);
    }, 600);
  };
  const handleVoiceBubbleEnd = () => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  };

  /* ═══════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════ */

  return (
    <div className="mp-mobile-page">
      {/* Header */}
      <header className="mp-mobile-page__header" style={{ height: 48 }}>
        <button className="mp-header-btn" onClick={() => navigate(-1)}>
          <Icon icon="mingcute:arrow-left-fill" style={{ fontSize: '24px' }} />
        </button>
        <span className="font-zcool" style={{ fontSize: '18px', fontWeight: 700, color: '#C03A39' }}>
          朝有规划
        </span>
        <button className="mp-header-btn" onClick={() => navigate('/m/morning-plan/settings')}>
          <Icon icon="mingcute:settings-3-fill" style={{ fontSize: '24px' }} />
        </button>
      </header>

      {/* Chat Area */}
      <main className="mp-main-scroll" ref={chatScrollRef} style={{ padding: '16px' }}>
        {/* Welcome */}
        <div className="mp-hero" style={{ marginBottom: 8 }}>
          <p className="mp-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</p>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <p className="mp-hero__title" style={{ fontSize: 17 }}>晨起做规划，整日不慌忙</p>
          <p className="mp-welcome-hint">告诉我你今天想完成什么</p>
        </div>

        <div className="mp-bubble-row message-enter" style={{ marginBottom: 16 }}>
          <div className="mp-avatar mp-avatar--geng">耕</div>
          <div className="mp-bubble-wrapper">
            <div className="mp-bubble mp-bubble--assistant">
              早安！新的一天开始了！<br />告诉我你今天的计划，语音或文字都可以。
            </div>
            <span className="mp-bubble-time">刚刚</span>
          </div>
        </div>

        {/* Messages */}
        {messages.map((msg) =>
          msg.type === 'voice' ? (
            <div key={msg.key} className="mp-bubble-row mp-bubble-row--user message-enter" style={{ marginBottom: 16 }}>
              <div className="mp-avatar mp-avatar--user">苏</div>
              <div className="mp-bubble-wrapper mp-bubble-wrapper--user">
                <div
                  className="mp-voice-msg" style={{ position: 'relative' }}
                  onTouchStart={(e) => handleVoiceBubbleTouchStart(msg.text, e)}
                  onTouchEnd={handleVoiceBubbleEnd} onTouchMove={handleVoiceBubbleEnd}
                  onMouseDown={(e) => handleVoiceBubbleTouchStart(msg.text, e)}
                  onMouseUp={handleVoiceBubbleEnd} onMouseLeave={handleVoiceBubbleEnd}
                >
                  <Icon icon="mingcute:play-circle-line" className="mp-voice-msg__icon" />
                  <span className="mp-voice-msg__label">语音消息</span>
                  <span className="mp-voice-msg__bars">▮▮▮</span>
                  {transcribeTarget === msg.text && (
                    <div className="mp-transcribe-popup" style={transcribePos ? {
                      position: 'fixed', left: transcribePos.x, top: transcribePos.y - 40,
                      transform: 'translateX(-50%)',
                    } : undefined}>
                      转文字：{transcribeTarget}
                    </div>
                  )}
                </div>
                <span className="mp-bubble-time mp-bubble-time--user">{msg.time}</span>
              </div>
            </div>
          ) : msg.role === 'user' ? (
            <div key={msg.key} className="mp-bubble-row mp-bubble-row--user message-enter" style={{ marginBottom: 16 }}>
              <div className="mp-avatar mp-avatar--user">苏</div>
              <div className="mp-bubble-wrapper mp-bubble-wrapper--user">
                <div className="mp-bubble mp-bubble--user">{msg.text}</div>
                <span className="mp-bubble-time mp-bubble-time--user">{msg.time}</span>
              </div>
            </div>
          ) : (
            <div key={msg.key} className="mp-bubble-row message-enter" style={{ marginBottom: 16 }}>
              <div className="mp-avatar mp-avatar--geng">耕</div>
              <div className="mp-bubble-wrapper">
                <div className="mp-bubble mp-bubble--assistant" style={{ whiteSpace: 'pre-line' }}>{msg.text}</div>
                <span className="mp-bubble-time">{msg.time}</span>
              </div>
            </div>
          ),
        )}

        {isLoading && (
          <div className="mp-thinking">
            <Icon icon="mingcute:loading-line" style={{ fontSize: '16px', animation: 'spin 1s linear infinite' }} />
            <span>小耕正在思考...</span>
          </div>
        )}

        {/* Confirm bubble — 展示提炼后的任务 + 象限 */}
        {showConfirm && recordedTasks.length > 0 && !isLoading && (
          <div className="mp-confirm-bubble message-enter">
            <div className="mp-confirm-bubble__title">
              <Icon icon="mingcute:check-fill" style={{ fontSize: '16px', color: '#4CAF50', marginRight: 4, verticalAlign: 'middle' }} />
              已提炼 {recordedTasks.length} 项计划：
            </div>
            {recordedTasks.slice(-5).map((t, i) => (
              <div key={i} className="mp-confirm-task">
                <span className="mp-confirm-task__text">{t.text}</span>
                <span className="mp-confirm-task__badge">
                  {QUADRANT_SHORT_LABELS[t.quadrant] || '重要紧急'}
                </span>
              </div>
            ))}
            {recordedTasks.length > 5 && (
              <p style={{ fontSize: 12, color: '#999', textAlign: 'center', margin: '4px 0' }}>
                还有 {recordedTasks.length - 5} 项...
              </p>
            )}
            <p style={{ fontSize: 13, color: '#666', marginTop: 8, marginBottom: 4 }}>
              继续添加，或点击「确认计划」进入下一步
            </p>
            <button className="mp-confirm-btn" onClick={handleConfirm}>
              确认计划
            </button>
          </div>
        )}

        <div style={{ height: 12 }} />
      </main>

      {/* Input Area */}
      <div className="mp-chat-input-area">
        <div className="mp-chat-input-pill">
          <input
            ref={inputRef} type="text" value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onFocus={() => setVoiceUIActive(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); } }}
            placeholder="输入今天的计划..." autoComplete="off"
          />
          <button className="mp-chat-mic-btn" onClick={handleMicSendClick}>
            {hasText ? (
              <Icon icon="mingcute:arrow-up-fill" style={{ fontSize: '20px' }} />
            ) : (
              <Icon icon="mingcute:mic-fill" style={{ fontSize: '20px' }} />
            )}
          </button>
        </div>
      </div>

      {/* Voice Overlay */}
      {voiceUIActive && (
        <div className="mp-voice-zone">
          <div className="mp-voice-hint">
            {voiceMode === 'hold' ? '按住说话，松手发送' : '点击说话，再点一下发送'}
          </div>
          <div className="mp-voice-cancel-row">
            {isRecording && (
              <button
                className={`mp-voice-cancel-pill ${cancelZone ? 'mp-voice-cancel-pill--active' : ''}`}
                onClick={(e) => { e.stopPropagation(); cancelRecording(); }}
              >取消</button>
            )}
          </div>
          <div
            className={`mp-voice-large-btn ${isRecording ? 'mp-voice-large-btn--recording' : ''}`}
            onPointerDown={handleLargeVoiceStart} onPointerUp={handleLargeVoiceEnd}
            onPointerMove={handleLargeVoiceMove} onClick={handleLargeVoiceClick}
          >
            {!isRecording && (<><div className="mp-voice-pulse-ring" /><div className="mp-voice-pulse-ring" /></>)}
            <Icon icon="mingcute:mic-fill" style={{ fontSize: '30px', color: '#fff', position: 'relative', zIndex: 10 }} />
          </div>
          {isRecording && <div className="mp-voice-timer">{fmtTime(recordingTime)}</div>}
        </div>
      )}
    </div>
  );
}
