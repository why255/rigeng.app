/**
 * 朝有规划 — AI聊天（纯模型回复）。
 * Route: /m/morning-plan/chat
 *
 * 用户说任何话都直接走小耕AI模型回复。
 * 输入框右上角「提炼计划」按钮：AI根据上下文提取计划，确认后跳转列表页。
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { morningChat, extractPlan } from '@/shared/api/plans';
import type { PlanItemOut } from '@/shared/api/plans';
import { useMorningPlan } from '@/shared/context/MorningPlanContext';
import type { Quadrant } from '@/shared/api/plans';
import './morning-plan.css';

/* ── Types ── */

type VoiceMode = 'hold' | 'click';

interface Message {
  key: string;
  role: 'assistant' | 'user';
  type: 'text' | 'voice';
  text: string;
  time: string;
}

/* ── Helpers ── */

let _msgId = 0;
function nextId() { return `msg_${Date.now()}_${++_msgId}`; }
function now() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ── Component ── */

export function MorningPlanChat() {
  const navigate = useNavigate();
  const { addPlan } = useMorningPlan();

  /* ── Core state ── */
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  /* ── Extract state ── */
  const [extractedItems, setExtractedItems] = useState<PlanItemOut[]>([]);
  const [showExtractConfirm, setShowExtractConfirm] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

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
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const scrollBottom = useCallback(() => {
    setTimeout(() => {
      chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 80);
  }, []);
  useEffect(() => { scrollBottom(); }, [messages, isLoading, voiceUIActive, scrollBottom]);

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
     Core: send user input → AI reply
     ═══════════════════════════════════════════════ */

  const processUserInput = async (text: string, isVoice = false) => {
    setIsLoading(true);
    const time = now();
    setMessages(prev => [...prev, {
      key: nextId(), role: 'user', type: isVoice ? 'voice' : 'text', text, time,
    }]);

    try {
      const result = await morningChat(text);
      setMessages(prev => [...prev, {
        key: nextId(), role: 'assistant', type: 'text', text: result.reply, time: now(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        key: nextId(), role: 'assistant', type: 'text',
        text: '姐，小耕正在努力思考中，稍等一下哦～',
        time: now(),
      }]);
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

  /* ── 提炼计划 ── */

  const handleExtractPlan = async () => {
    if (messages.length === 0) return;
    setIsExtracting(true);

    try {
      const chatMessages = messages
        .filter(m => m.type === 'text')
        .map(m => ({ role: m.role, text: m.text }));

      const result = await extractPlan(chatMessages);

      // 添加小耕的提炼回复气泡
      setMessages(prev => [...prev, {
        key: nextId(), role: 'assistant', type: 'text', text: result.reply, time: now(),
      }]);

      if (result.plan_items.length > 0) {
        setExtractedItems(result.plan_items);
        setShowExtractConfirm(true);
      }
    } catch {
      setMessages(prev => [...prev, {
        key: nextId(), role: 'assistant', type: 'text',
        text: '姐，提炼计划时出了点小问题，稍后再试哦～',
        time: now(),
      }]);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleConfirmExtract = () => {
    // 将提炼的计划写入 context → 跳转列表页
    for (const item of extractedItems) {
      addPlan(item.title, (item.quadrant as Quadrant) || 'urgent_important');
    }
    setShowExtractConfirm(false);
    setExtractedItems([]);
    navigate('/m/morning-plan/list');
  };

  const handleCancelExtract = () => {
    setShowExtractConfirm(false);
    setExtractedItems([]);
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
          <p className="mp-welcome-hint">告诉我你今天想完成什么，或者随便聊聊~</p>
        </div>

        <div className="mp-bubble-row message-enter" style={{ marginBottom: 16 }}>
          <div className="mp-avatar mp-avatar--geng">耕</div>
          <div className="mp-bubble-wrapper">
            <div className="mp-bubble mp-bubble--assistant">
              早安！新的一天开始了！<br />告诉我你今天想做什么，或者有什么想问的~
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

        {isExtracting && (
          <div className="mp-thinking">
            <Icon icon="mingcute:loading-line" style={{ fontSize: '16px', animation: 'spin 1s linear infinite' }} />
            <span>小耕正在提炼计划...</span>
          </div>
        )}

        {/* 提炼计划确认区 */}
        {showExtractConfirm && extractedItems.length > 0 && (
          <div className="mp-confirm-bubble message-enter">
            <div className="mp-confirm-bubble__title">
              <Icon icon="mingcute:check-fill" style={{ fontSize: '16px', color: '#4CAF50', marginRight: 4, verticalAlign: 'middle' }} />
              已提炼 {extractedItems.length} 项计划，是否确认？
            </div>
            {extractedItems.slice(0, 8).map((item, i) => (
              <div key={i} className="mp-confirm-task">
                <span className="mp-confirm-task__text">{item.title}</span>
                <span className="mp-confirm-task__badge">{item.time_hint}</span>
              </div>
            ))}
            {extractedItems.length > 8 && (
              <p style={{ fontSize: 12, color: '#999', textAlign: 'center', margin: '4px 0' }}>
                还有 {extractedItems.length - 8} 项...
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={handleCancelExtract}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
                  background: '#F5F3EF', color: '#666', fontSize: 14, fontWeight: 500,
                }}
              >取消</button>
              <button
                onClick={handleConfirmExtract}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
                  background: '#C03A39', color: '#fff', fontSize: 14, fontWeight: 600,
                }}
              >确认计划</button>
            </div>
          </div>
        )}

        <div style={{ height: 12 }} />
      </main>

      {/* Input Area */}
      <div className="mp-chat-input-area">
        {/* 提炼计划按钮 */}
        {messages.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
            <button
              onClick={handleExtractPlan}
              disabled={isExtracting || isLoading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '6px 14px', borderRadius: 16, border: '1px solid #C03A39',
                background: isExtracting ? '#f5f5f5' : '#fff',
                color: '#C03A39', fontSize: 13, fontWeight: 500,
                opacity: isExtracting || isLoading ? 0.5 : 1,
              }}
            >
              <Icon icon="mingcute:magic-2-line" style={{ fontSize: '16px' }} />
              提炼计划
            </button>
          </div>
        )}
        <div className="mp-chat-input-pill">
          <input
            ref={inputRef} type="text" value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onFocus={() => setVoiceUIActive(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); } }}
            placeholder="说点什么..." autoComplete="off"
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
