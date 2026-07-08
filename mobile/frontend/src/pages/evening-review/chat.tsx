/**
 * P2 对话复盘页 — 移动端（对齐 m2-p2-mobile.html 完整语音交互设计）。
 * Route: /m/evening-review/chat
 *
 * UI 结构严格对照 morning-plan/chat.tsx —— 仅替换暮有复盘特有内容（5阶段进度条、
 * 信息收集→正式复盘两段落、情绪滑块、勇气值、温柔坚持）。
 *
 * 语音模式：
 *   - hold（按住说话）：长按大语音按钮，松手发送
 *   - click（点击说话）：点击大按钮开始，再点结束发送
 *
 * 使用 mp-* BEM 类名（来自 morning-plan.css）+ 内联 style。无 Tailwind CSS。
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import * as reviewsApi from '@/shared/api/reviews';
import type { ReviewStage } from '@/shared/api/reviews';
import {
  ReviewStageBar,
  EmotionSlider,
  CourageDisplay,
  STAGES,
  STAGE_PROMPTS,
  STAGE_TRANSITIONS,
  COURAGE_MESSAGES,
  INFO_COLLECTION_OPENING,
  INFO_FOLLOWUP_QUESTIONS,
  TRANSITION_MESSAGE,
  detectRefusal,
  pickReply,
  getTime,
  shouldAdvanceToReview,
  getCourageMessage,
} from '@/shared/components/features/evening-review';
import '../morning-plan/morning-plan.css';

/* ── Types ── */

type VoiceMode = 'hold' | 'click';

interface ChatMessage {
  key: string;
  role: 'assistant' | 'user';
  type: 'text' | 'voice';
  text: string;
  time: string;
}

/* ── Helpers ── */

let _id = 0;
function nextKey() { return `er-msg-${Date.now()}-${++_id}`; }

/* ── Component ── */

export function EveningReviewChat() {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Voice mode ── */
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(() => {
    return (localStorage.getItem('er_voiceMode') as VoiceMode) || 'hold';
  });

  /* ── Phase one: info collection ── */
  const [infoPhase, setInfoPhase] = useState<'collecting' | 'reviewing' | 'completed'>('collecting');
  const [showStageBar, setShowStageBar] = useState(true);
  const [infoRounds, setInfoRounds] = useState(0);
  const [transitionTriggered, setTransitionTriggered] = useState(false);

  /* ── Phase two: 5-stage review ── */
  const [stage, setStage] = useState<ReviewStage>('greeting');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [thinking, setThinking] = useState(false);
  const [emotionScore, setEmotionScore] = useState(0);
  const [showEmotion, setShowEmotion] = useState(false);
  const [courageValue, setCourageValue] = useState(0);
  const [courageMessage, setCourageMessage] = useState('');
  const [sopGenerated, setSopGenerated] = useState(false);

  /* ── Gentle persistence ── */
  const [gentlePersistenceUsed, setGentlePersistenceUsed] = useState(false);
  const [reviewAllowedSkip, setReviewAllowedSkip] = useState(false);

  /* ── Voice recording state ── */
  const [voiceUIActive, setVoiceUIActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [cancelZone, setCancelZone] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pressStartYRef = useRef(0);

  /* ── Init ── */
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const s = await reviewsApi.fetchTodayReviewStats();
        if (cancelled) return;
        if (s.total_tasks > 0) {
          if (s.completion_rate >= 100) {
            setInfoPhase('completed');
          } else {
            setInfoPhase('reviewing');
            setShowStageBar(true);
          }
          setMessages([{ key: nextKey(), role: 'assistant', type: 'text', text: '欢迎回来~上次我们聊到……继续复盘吧？', time: getTime() }]);
        } else {
          setInfoPhase('collecting');
          setMessages([{ key: nextKey(), role: 'assistant', type: 'text', text: INFO_COLLECTION_OPENING, time: getTime() }]);
        }
      } catch {
        if (!cancelled) {
          setInfoPhase('collecting');
          setMessages([{ key: nextKey(), role: 'assistant', type: 'text', text: INFO_COLLECTION_OPENING, time: getTime() }]);
        }
      }
    }
    check();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onFocus = () => {
      const saved = localStorage.getItem('er_voiceMode') as VoiceMode | null;
      if (saved === 'hold' || saved === 'click') setVoiceMode(saved);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  /* ── Scroll ── */
  const scrollBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 80);
  }, []);
  useEffect(() => { scrollBottom(); }, [messages, thinking, showEmotion, voiceUIActive, scrollBottom]);

  /* ═══════════════════════════════════════════════
     Voice Recording (对照 morning-plan/chat.tsx)
     ═══════════════════════════════════════════════ */

  const startTimer = () => { setRecordingTime(0); timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000); };
  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const initRecognition = useCallback(() => {
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
  }, [isRecording]);

  const startRecording = useCallback(() => {
    const r = initRecognition(); if (!r) return;
    transcriptRef.current = ''; setCancelZone(false);
    try { r.start(); setIsRecording(true); startTimer(); } catch { /* */ }
  }, [initRecognition]);

  const stopRecording = useCallback((cancelled = false) => {
    if (!isRecording) return;
    setIsRecording(false); stopTimer();
    try { recognitionRef.current?.stop(); } catch { /* */ }
    setVoiceUIActive(false);
    if (cancelled || cancelZone) return;
    const text = transcriptRef.current.trim();
    if (text) processUserInput(text, true);
  }, [isRecording, cancelZone]);

  const cancelRecording = useCallback(() => { if (isRecording) stopRecording(true); }, [isRecording, stopRecording]);

  /* ═══════════════════════════════════════════════
     Core: process user input
     ═══════════════════════════════════════════════ */

  const processUserInput = useCallback(async (text: string, isVoice = false) => {
    setThinking(true);
    const time = getTime();
    const userMsg: ChatMessage = { key: nextKey(), role: 'user', type: isVoice ? 'voice' : 'text', text, time };
    setMessages(prev => [...prev, userMsg]);

    if (infoPhase === 'collecting') {
      const newRounds = infoRounds + 1;
      setInfoRounds(newRounds);
      await new Promise(r => setTimeout(r, 800 + Math.random() * 600));
      const userTexts = messages.filter(m => m.role === 'user').map(m => m.text);
      userTexts.push(text);
      if (shouldAdvanceToReview(userTexts, newRounds * 2) && !transitionTriggered) {
        setTransitionTriggered(true);
        setInfoPhase('reviewing');
        setShowStageBar(true);
        setStage('greeting');
        setMessages(prev => [
          ...prev,
          { key: nextKey(), role: 'assistant', type: 'text', text: TRANSITION_MESSAGE, time: getTime() },
          { key: nextKey(), role: 'assistant', type: 'text', text: STAGE_PROMPTS.greeting, time: getTime() },
        ]);
      } else {
        const qi = Math.min(newRounds - 1, INFO_FOLLOWUP_QUESTIONS.length - 1);
        setMessages(prev => [...prev, { key: nextKey(), role: 'assistant', type: 'text', text: INFO_FOLLOWUP_QUESTIONS[qi], time: getTime() }]);
      }
      setThinking(false);
      return;
    }

    // ── 段落二：5阶段复盘 ──
    const isRefusal = detectRefusal(text) && stage === 'greeting';
    await new Promise(r => setTimeout(r, 800 + Math.random() * 800));
    const cs = stage;
    let reply = '';

    if (isRefusal && gentlePersistenceUsed) {
      reply = '好的，今天先休息吧！小耕尊重你的选择。如果想复盘，随时可以回来~';
      setReviewAllowedSkip(true);
    } else if (isRefusal && !gentlePersistenceUsed) {
      setGentlePersistenceUsed(true);
      if (text.includes('累')) reply = '我知道你今天很累！但正是累的时候，才更需要花3分钟做个简单回顾~';
      else if (text.includes('时间') || text.includes('没空')) reply = '明白你很忙！不过复盘只需要3分钟，把今天的经验沉淀下来~';
      else reply = '没关系，我们可以简单一点！告诉我今天最有价值的一个发现就好~';
    } else {
      reply = pickReply(cs);
    }

    setMessages(prev => [...prev, { key: nextKey(), role: 'assistant', type: 'text', text: reply, time: getTime() }]);

    // 阶段推进
    if (!isRefusal && cs !== 'archive') {
      const next = STAGE_TRANSITIONS[cs];
      if (next) {
        try {
          const result = await reviewsApi.saveReviewMessage({
            stage: cs,
            messages: messages.filter(m => m.type === 'text').map(m => ({ role: m.role, text: m.text })),
            emotion_score: emotionScore,
            courage_value: courageValue,
          });
          const gp = (result as any)?.gentle_persistence;
          if (gp?.triggered) {
            setGentlePersistenceUsed(true);
            if (gp.allow_skip) { setReviewAllowedSkip(true); setThinking(false); return; }
          }
        } catch { /* silent */ }

        if (next === 'extraction' && !showEmotion) setShowEmotion(true);
        if (next === 'improvement') {
          const nc = Math.min(100, Math.max(10, Math.round(emotionScore * 3 + 50)));
          setCourageValue(nc);
          setCourageMessage(getCourageMessage(nc, COURAGE_MESSAGES));
        }
        if (next === 'archive' && !sopGenerated) {
          try {
            await reviewsApi.saveSop({
              title: '今日复盘萃取',
              steps: [
                { step_number: 1, title: '回顾今日完成事项', description: '盘点今日完成的任务和关键成果' },
                { step_number: 2, title: '提炼可复用经验', description: '将成功做法总结为标准流程' },
                { step_number: 3, title: '明确改进方向', description: '识别不足并制定改进计划' },
              ],
              key_phrases: '"今天最有价值的经验是……"',
              precautions: '避免情绪化评判，聚焦具体行为',
            });
            setSopGenerated(true);
          } catch { /* silent */ }
        }
        setStage(next);
        setTimeout(() => {
          setMessages(prev => [...prev, { key: nextKey(), role: 'assistant', type: 'text', text: STAGE_PROMPTS[next], time: getTime() }]);
        }, 400);
      }
    }
    setThinking(false);
  }, [infoPhase, infoRounds, transitionTriggered, stage, gentlePersistenceUsed, messages, emotionScore, courageValue, showEmotion, sopGenerated]);

  /* ── Send ── */
  const handleSendText = useCallback(() => {
    const text = inputText.trim();
    if (!text || thinking) return;
    setInputText('');
    processUserInput(text);
  }, [inputText, thinking, processUserInput]);

  /* ── Voice UI (对照 morning-plan) ── */
  const showVoiceUI = () => { setVoiceUIActive(true); inputRef.current?.blur(); };

  const handleMicSendClick = () => {
    if (inputText.trim()) { handleSendText(); }
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

  /* ── Nav ── */
  const handleSkip = () => navigate('/m/evening-review/home');
  const handleGoReport = () => navigate('/m/evening-review/report');
  const handleGoSettings = () => navigate('/m/evening-review/settings');

  const stageIndex = STAGES.findIndex(s => s.key === stage);
  const hasText = inputText.trim().length > 0;

  /* ── Completed state ── */
  if (infoPhase === 'completed') {
    return (
      <div className="mp-mobile-page">
        <header className="mp-mobile-page__header" style={{ height: 48 }}>
          <button className="mp-header-btn" onClick={() => navigate(-1)}>
            <Icon icon="mingcute:arrow-left-fill" style={{ fontSize: '24px' }} />
          </button>
          <span className="font-zcool" style={{ fontSize: '18px', fontWeight: 700, color: '#C03A39' }}>暮有复盘</span>
          <div className="mp-header-spacer" />
        </header>
        <main className="mp-main-scroll">
          <div className="mp-main-padding" style={{ paddingTop: 80, textAlign: 'center' }}>
            <section className="mp-hero">
              <p className="mp-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</p>
              <div className="mp-hero__divider" />
              <h1 className="mp-hero__title" style={{ fontSize: 26, letterSpacing: '0.1em' }}>睡前做复盘，经验变方法</h1>
            </section>
            <div className="mp-card" style={{ textAlign: 'center' }}>
              <Icon icon="mingcute:celebrate-fill" style={{ fontSize: '48px', color: '#D4A574', marginBottom: 16 }} />
              <p style={{ fontSize: 16, color: '#333', marginBottom: 8 }}>今日复盘已完成</p>
              <p style={{ fontSize: 13, color: '#999', marginBottom: 24 }}>太棒了，今天又进步了一点！</p>
              <button className="mp-btn-primary" onClick={handleGoReport}>查看复盘报告</button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════
     Render — 对照 morning-plan/chat.tsx 结构
     ═══════════════════════════════════════════════ */

  return (
    <div className="mp-mobile-page">
      {/* Header */}
      <header className="mp-mobile-page__header" style={{ height: 48 }}>
        <button className="mp-header-btn" onClick={() => navigate(-1)}>
          <Icon icon="mingcute:arrow-left-fill" style={{ fontSize: '24px' }} />
        </button>
        <span className="font-zcool" style={{ fontSize: '18px', fontWeight: 700, color: '#C03A39' }}>
          暮有复盘
        </span>
        <button className="mp-header-btn" onClick={handleGoSettings}>
          <Icon icon="mingcute:settings-3-fill" style={{ fontSize: '24px' }} />
        </button>
      </header>

      {/* Chat Area */}
      <main className="mp-main-scroll" ref={scrollRef} style={{ padding: '16px' }}>
        {/* Brand — 对齐 morning-plan chat */}
        <div className="mp-hero" style={{ marginBottom: 8 }}>
          <p className="mp-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</p>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <p className="mp-hero__title" style={{ fontSize: 17 }}>睡前做复盘，经验变方法</p>
          {infoPhase === 'collecting' && (
            <p className="mp-welcome-hint">告诉我你今天想复盘什么</p>
          )}
        </div>

        {/* ── 五阶段进度条 ── */}
        {showStageBar && (
          <ReviewStageBar currentStage={stage} />
        )}

        {/* Messages */}
        {messages.map((msg) =>
          msg.type === 'voice' ? (
            <div key={msg.key} className="mp-bubble-row mp-bubble-row--user message-enter" style={{ marginBottom: 16 }}>
              <div className="mp-avatar mp-avatar--user">苏</div>
              <div className="mp-bubble-wrapper mp-bubble-wrapper--user">
                <div className="mp-voice-msg">
                  <Icon icon="mingcute:play-circle-line" className="mp-voice-msg__icon" />
                  <span className="mp-voice-msg__label">语音消息</span>
                  <span className="mp-voice-msg__bars">▮▮▮</span>
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

        {/* Thinking */}
        {thinking && (
          <div className="mp-thinking">
            <Icon icon="mingcute:loading-line" style={{ fontSize: '16px', animation: 'spin 1s linear infinite' }} />
            <span>小耕在整理思路…</span>
          </div>
        )}

        {/* 温柔坚持提示 */}
        {gentlePersistenceUsed && !reviewAllowedSkip && (
          <div style={{
            textAlign: 'center', padding: '10px 20px', marginTop: 12,
            background: '#FFF3E0', borderRadius: 8, fontSize: 12, color: '#E65100',
          }}>
            <Icon icon="mingcute:bulb-line" style={{ fontSize: '14px', marginRight: 4, verticalAlign: 'middle' }} />
            小耕正在温柔地鼓励你完成今天的复盘~
          </div>
        )}

        {/* Skip */}
        {reviewAllowedSkip && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button className="mp-btn-outline" onClick={handleSkip}
              style={{ width: 'auto', padding: '10px 32px', display: 'inline-block' }}>
              今天先跳过
            </button>
          </div>
        )}

        {/* 情绪滑块 — 萃取阶段 */}
        {showEmotion && stage === 'extraction' && (
          <EmotionSlider value={emotionScore} onChange={setEmotionScore} />
        )}

        {/* 勇气值 — 改进阶段 */}
        {courageValue > 0 && stage === 'improvement' && (
          <CourageDisplay value={courageValue} message={courageMessage} />
        )}

        <div style={{ height: 12 }} />
      </main>

      {/* 归档阶段：查看复盘报告按钮 */}
      {stage === 'archive' && (
        <div style={{ textAlign: 'center', padding: '0 16px 8px' }}>
          <button className="mp-btn-primary" onClick={handleGoReport}>查看复盘报告</button>
        </div>
      )}

      {/* Input Area */}
      <div className="mp-chat-input-area">
        <div className="mp-chat-input-pill">
          <input
            ref={inputRef} type="text" value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onFocus={() => setVoiceUIActive(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); } }}
            placeholder={reviewAllowedSkip ? '输入你的复盘，或点击跳过...' : '输入你的复盘...'}
            autoComplete="off"
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

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
