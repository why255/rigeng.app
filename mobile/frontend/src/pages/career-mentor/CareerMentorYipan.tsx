/**
 * 高维求职 P2·一盘 — 简历盘点与重构（对话模式 + 语音输入）。
 * Route: /m/career-mentor/yipan
 * 严格对齐 m7-v31-p2-yipan.html 原型 + MorningPlanChat 语音设计。
 *
 * 使用 cm-* BEM 类名 + 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。返回按钮使用 navigate(-1)。
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import './career-mentor.css';

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
function nextId() { return `cm_${Date.now()}_${++_msgId}`; }

function now() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ── Component ── */

export function CareerMentorYipan() {
  const navigate = useNavigate();

  /* ── Core state ── */
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
     Voice Recording（对齐 MorningPlanChat）
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
    if (text) sendUserInput(text, true);
  };

  const cancelRecording = () => { if (isRecording) stopRecording(true); };

  /* ═══════════════════════════════════════════════
     Core: process user input
     ═══════════════════════════════════════════════ */

  const sendUserInput = async (text: string, isVoice = false) => {
    setIsLoading(true);
    const time = now();
    const userMsg: Message = {
      key: nextId(), role: 'user', type: isVoice ? 'voice' : 'text', text, time,
    };
    setMessages(prev => [...prev, userMsg]);

    // 模拟 AI 分析（后续接入真实 API）
    setTimeout(() => {
      const replyMsg: Message = {
        key: nextId(), role: 'assistant', type: 'text',
        text: '好的，小耕在分析您的信息中……',
        time: now(),
      };
      setMessages(prev => [...prev, replyMsg]);
      setIsLoading(false);
      scrollBottom();
    }, 600);
  };

  const handleSendText = () => {
    const text = inputText.trim();
    if (!text || isLoading) return;
    setInputText('');
    sendUserInput(text);
  };

  /* ═══════════════════════════════════════════════
     Voice UI handlers（对齐 MorningPlanChat）
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

  /* ── 切换语音模式 ── */
  const toggleVoiceMode = () => {
    const next = voiceMode === 'hold' ? 'click' : 'hold';
    setVoiceMode(next);
    localStorage.setItem('rg_voice_mode', next);
    if (isRecording) stopRecording(true);
    setVoiceUIActive(false);
  };

  /* ── 语音消息气泡长按转文字 ── */
  const [transcribeTarget, setTranscribeTarget] = useState<string | null>(null);
  const [transcribePos, setTranscribePos] = useState<{ x: number; y: number } | null>(null);

  const handleVoiceBubbleTouchStart = (transcript: string, e: React.TouchEvent | React.MouseEvent) => {
    longPressTimerRef.current = setTimeout(() => {
      setTranscribeTarget(transcript);
      if ('touches' in e) setTranscribePos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      else setTranscribePos({ x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY });
      setTimeout(() => { setTranscribeTarget(null); setTranscribePos(null); }, 2500);
    }, 600);
  };
  const handleVoiceBubbleEnd = () => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  };

  const hasMessages = messages.length > 0;

  /* ═══════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════ */

  return (
    <div className="cm-mobile-page">

      {/* ===== 顶部栏 ===== */}
      <header className="cm-mobile-page__header">
        <button className="cm-header-btn" onClick={() => navigate(-1)}>
          <Icon icon="mingcute:arrow-left-fill" style={{ fontSize: '24px' }} />
        </button>
        <div className="cm-header-subtitle-row">
          <div className="cm-header-subtitle-main" style={{ color: '#C03A39' }}>STEP 1 · 一盘</div>
          <div className="cm-header-subtitle-sub">简历盘点与重构</div>
        </div>
        <button className="cm-header-btn" onClick={toggleVoiceMode}>
          <Icon icon="mingcute:settings-6-line" style={{ fontSize: '24px' }} />
        </button>
      </header>

      {/* ===== 一盘子进度条 ===== */}
      <div className="cm-sub-progress">
        <div className="cm-sub-progress__header">
          <span className="cm-sub-progress__label">盘点进度</span>
          <span className="cm-sub-progress__count">0/5</span>
        </div>
        <div className="cm-sub-progress__bar">
          <div className="cm-sub-progress__seg" />
          <div className="cm-sub-progress__seg" />
          <div className="cm-sub-progress__seg" />
          <div className="cm-sub-progress__seg" />
          <div className="cm-sub-progress__seg" />
        </div>
        <div className="cm-sub-progress__labels">
          <span className="cm-sub-progress__seg-label">履历梳理</span>
          <span className="cm-sub-progress__seg-label">STAR追问</span>
          <span className="cm-sub-progress__seg-label">技能晶体</span>
          <span className="cm-sub-progress__seg-label">人脉资源</span>
          <span className="cm-sub-progress__seg-label">岗位建议</span>
        </div>
      </div>

      {/* ===== 对话区 ===== */}
      <main className="cm-main-scroll" ref={chatScrollRef} style={{ padding: '16px', background: '#FAF9F7' }}>

        {/* 品牌语 */}
        <div className="cm-hero" style={{ marginBottom: 4 }}>
          <p className="cm-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</p>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <p className="cm-hero__title" style={{ fontSize: 17 }}>高维五步法，前程自发光</p>
          <p className="cm-welcome-hint">告诉我您的职业经历，语音或文字都可以</p>
        </div>

        {/* 简历上传区 */}
        <div className="cm-resume-upload cm-fade-up" style={{ marginBottom: 14 }}>
          <div className="cm-resume-upload__icon">
            <Icon icon="mingcute:upload-line" width={20} />
          </div>
          <div className="cm-resume-upload__body">
            <div className="cm-resume-upload__title">上传最新简历</div>
            <div className="cm-resume-upload__hint">PDF / Word，AI自动解析</div>
          </div>
          <button className="cm-resume-upload__btn">上传</button>
        </div>

        {/* 小耕开场白 */}
        <div className="cm-bubble-row cm-fade-up">
          <div className="cm-avatar cm-avatar--geng">耕</div>
          <div className="cm-bubble-wrapper">
            <div className="cm-bubble cm-bubble--assistant">
              欢迎来到<strong>一盘·简历盘点</strong>～上传简历或直接跟我聊聊，小耕带您做<strong>五大盘点</strong>，把您过去的经历变成闪闪发光的求职资产！
            </div>
            <span className="cm-bubble-time">刚刚</span>
          </div>
        </div>

        {/* ===== 消息列表 ===== */}
        {messages.map((msg) =>
          msg.type === 'voice' ? (
            <div key={msg.key} className="cm-bubble-row cm-bubble-row--user cm-fade-up">
              <div className="cm-avatar cm-avatar--user">你</div>
              <div className="cm-bubble-wrapper cm-bubble-wrapper--user">
                <div
                  className="cm-voice-msg"
                  onTouchStart={(e) => handleVoiceBubbleTouchStart(msg.text, e)}
                  onTouchEnd={handleVoiceBubbleEnd} onTouchMove={handleVoiceBubbleEnd}
                  onMouseDown={(e) => handleVoiceBubbleTouchStart(msg.text, e)}
                  onMouseUp={handleVoiceBubbleEnd} onMouseLeave={handleVoiceBubbleEnd}
                >
                  <Icon icon="mingcute:play-circle-line" className="cm-voice-msg__icon" />
                  <span className="cm-voice-msg__label">语音消息</span>
                  <span className="cm-voice-msg__bars">▮▮▮</span>
                  {transcribeTarget === msg.text && (
                    <div className="cm-transcribe-popup" style={transcribePos ? {
                      left: transcribePos.x, top: transcribePos.y - 40,
                      transform: 'translateX(-50%)',
                    } : undefined}>
                      转文字：{transcribeTarget}
                    </div>
                  )}
                </div>
                <span className="cm-bubble-time cm-bubble-time--user">{msg.time}</span>
              </div>
            </div>
          ) : msg.role === 'user' ? (
            <div key={msg.key} className="cm-bubble-row cm-bubble-row--user cm-fade-up">
              <div className="cm-avatar cm-avatar--user">你</div>
              <div className="cm-bubble-wrapper cm-bubble-wrapper--user">
                <div className="cm-bubble cm-bubble--user">{msg.text}</div>
                <span className="cm-bubble-time cm-bubble-time--user">{msg.time}</span>
              </div>
            </div>
          ) : (
            <div key={msg.key} className="cm-bubble-row cm-fade-up">
              <div className="cm-avatar cm-avatar--geng">耕</div>
              <div className="cm-bubble-wrapper">
                <div className="cm-bubble cm-bubble--assistant">{msg.text}</div>
                <span className="cm-bubble-time">{msg.time}</span>
              </div>
            </div>
          ),
        )}

        {/* Loading */}
        {isLoading && (
          <div className="cm-thinking">
            <Icon icon="mingcute:loading-line" style={{ fontSize: '16px', animation: 'spin 1s linear infinite' }} />
            <span>小耕正在思考...</span>
          </div>
        )}

        {/* 空状态 */}
        {!hasMessages && !isLoading && (
          <div className="cm-empty-state">
            <div className="cm-empty-state__icon">
              <Icon icon="mingcute:chat-line" width={28} />
            </div>
            <p className="cm-empty-state__title">开始对话，开启一盘盘点</p>
            <p className="cm-empty-state__desc">
              上传简历或点击下方麦克风，<br />用语音或文字跟小耕聊聊您的职业经历～
            </p>
          </div>
        )}

        <div style={{ height: 12 }} />
      </main>

      {/* ===== 底部输入区 ===== */}
      <div className="cm-chat-input-area">
        <div className="cm-chat-input-pill">
          <input
            ref={inputRef} type="text" value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onFocus={() => setVoiceUIActive(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); } }}
            placeholder="输入您的职业经历..."
            autoComplete="off"
          />
          <button className="cm-chat-mic-btn" onClick={handleMicSendClick}>
            {hasText ? (
              <Icon icon="mingcute:arrow-up-fill" style={{ fontSize: '20px' }} />
            ) : (
              <Icon icon="mingcute:mic-fill" style={{ fontSize: '20px' }} />
            )}
          </button>
        </div>
      </div>

      {/* ===== 语音遮罩（对齐 mp-voice-zone：fixed bottom） ===== */}
      {voiceUIActive && (
        <div className="cm-voice-zone">
          <div className="cm-voice-hint">
            {voiceMode === 'hold' ? '按住说话，松手发送' : '点击说话，再点一下发送'}
          </div>
          <div className="cm-voice-cancel-row">
            {isRecording && (
              <button
                className={`cm-voice-cancel-pill ${cancelZone ? 'cm-voice-cancel-pill--active' : ''}`}
                onClick={(e) => { e.stopPropagation(); cancelRecording(); }}
              >取消</button>
            )}
          </div>
          <div
            className={`cm-voice-large-btn ${isRecording ? 'cm-voice-large-btn--recording' : ''}`}
            onPointerDown={handleLargeVoiceStart} onPointerUp={handleLargeVoiceEnd}
            onPointerMove={handleLargeVoiceMove} onClick={handleLargeVoiceClick}
          >
            {!isRecording && (<><div className="cm-voice-pulse-ring" /><div className="cm-voice-pulse-ring" /></>)}
            <Icon icon="mingcute:mic-fill" style={{ fontSize: '30px', color: '#fff', position: 'relative', zIndex: 10 }} />
          </div>
          {isRecording && <div className="cm-voice-timer">{fmtTime(recordingTime)}</div>}
        </div>
      )}
    </div>
  );
}
