/**
 * P2 倾诉对话页 — 暗色/亮色双主题 · 计时器 · 合并话筒/发送按钮 · 大语音脉冲按钮。
 * Route: /m/mood-haven/chat
 * 对齐 m3p2-mobile.html 设计，布局模仿 MorningPlan chat.tsx 模式。
 * 暗色模式默认开启；关闭后各颜色与朝有规划 chat 页一致。
 *
 * 使用 mh-* BEM 类名（来自 mood-haven.css）+ 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。返回按钮使用 navigate(-1)。
 * 语音模式存储于 localStorage.mh_voiceMode，暗色模式存储于 localStorage.mh_darkMode。
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import * as emotionsApi from '@/shared/api/emotions';
import type { ChatMessage } from '@/shared/api/emotions';
import './mood-haven.css';

const SAFETY_PROMISE = '姐，您来了。这里只有您和我，您说的每一句话小耕都会保守秘密。想说什么就说吧，小耕在听。';

const CRISIS_KEYWORDS = ['想死', '不想活', '自杀', '结束生命', '活不下去', '没有意义', '消失', '绝望'];

const FALLBACK_REPLIES = [
  '嗯，小耕在听。这确实不容易，姐，您辛苦了。',
  '还有呢？这件事让您最难过的点是什么？',
  '小耕感受到您的心情了，想哭就哭出来吧，没关系的。',
  '谢谢您愿意跟我说这些，小耕会一直陪着您。',
  '嗯，小耕在听。这件事确实让人难受。',
  '还有更多想说的吗？小耕在听。',
  '收到，小耕会一直陪着您。',
  '说出来会好一些，小耕在这里。',
];

function getTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function readDarkMode(): boolean {
  const stored = localStorage.getItem('mh_darkMode');
  return stored === null ? true : stored === 'true';
}

type VoiceMode = 'hold' | 'click';

export function MoodHavenChat() {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── 暗色模式 ──
  const [isDark, setIsDark] = useState(readDarkMode);

  // 监听 storage 变化（设置页可能修改）
  useEffect(() => {
    const onStorage = () => setIsDark(readDarkMode());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // 应用 data-theme
  useEffect(() => {
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    return () => {
      // 离开时恢复默认暗色
      if (readDarkMode()) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    };
  }, [isDark]);

  // ── 色板 ──
  const P = isDark ? {
    pageBg: '#1a1a1a',
    headerBg: '#1a1a1a',
    headerBorder: 'rgba(255,255,255,0.05)',
    headerBtn: '#B0B0B0',
    title: '#E0E0E0',
    timer: '#FFCC80',
    settingsIcon: '#FFCC80',
    brand: '#E0E0E0',
    brandTagBg: 'rgba(255,255,255,0.05)',
    bubbleAssistant: '#2d2d44',
    bubbleUser: '#3a3a5c',
    bubbleText: '#E0E0E0',
    thinkingColor: '#B0B0B0',
    thinkingSpinnerBorder: '#3a3a5c',
    thinkingSpinnerTop: '#FFCC80',
    inputAreaBg: '#1a1a1a',
    inputAreaBorder: 'rgba(255,255,255,0.05)',
    endSessionBg: '#FFCC80',
    endSessionColor: '#2C1810',
    endSessionShadow: '0 2px 8px rgba(255,204,128,0.25)',
    endSessionActiveBg: '#e8b85a',
    micBg: '#FFCC80',
    micColor: '#2C1810',
    micActiveBg: '#e8b85a',
    voiceBg: '#1a1a1a',
    voiceBtnGradient: 'linear-gradient(135deg, #FFCC80 0%, #E8A94D 100%)',
    voiceBtnShadow: '0 10px 25px rgba(255,204,128,0.3)',
    voicePulseBg: 'rgba(255,204,128,0.2)',
    voiceTimerColor: '#FFCC80',
    cancelBg: '#333',
    cancelColor: '#FFCC80',
    cancelBorder: '#555',
    cancelActiveBg: '#FFCC80',
    cancelActiveColor: '#2C1810',
    voiceHintColor: '#888',
    micIconColor: '#2C1810',
    micSendIcon: '#2C1810',
  } : {
    pageBg: '#F5F3EF',
    headerBg: '#fff',
    headerBorder: '#f0f0f0',
    headerBtn: '#666',
    title: '#333',
    timer: '#C03A39',
    settingsIcon: '#666',
    brand: '#333',
    brandTagBg: 'rgba(0,0,0,0.03)',
    bubbleAssistant: '#FFF0E5',
    bubbleUser: '#F0F0F0',
    bubbleText: '#333',
    thinkingColor: '#999',
    thinkingSpinnerBorder: '#E8E0D6',
    thinkingSpinnerTop: '#C03A39',
    inputAreaBg: '#F5F3EF',
    inputAreaBorder: 'rgba(0,0,0,0.04)',
    endSessionBg: '#C03A39',
    endSessionColor: '#fff',
    endSessionShadow: '0 2px 8px rgba(192,58,57,0.25)',
    endSessionActiveBg: '#A0302E',
    micBg: '#C03A39',
    micColor: '#fff',
    micActiveBg: '#A0302E',
    voiceBg: '#F5F3EF',
    voiceBtnGradient: '#C03A39',
    voiceBtnShadow: '0 10px 25px rgba(192,58,57,0.4)',
    voicePulseBg: 'rgba(192,58,57,0.2)',
    voiceTimerColor: '#C03A39',
    cancelBg: '#fff',
    cancelColor: '#C03A39',
    cancelBorder: '#F1D5C7',
    cancelActiveBg: '#C03A39',
    cancelActiveColor: '#fff',
    voiceHintColor: '#999',
    micIconColor: '#fff',
    micSendIcon: '#fff',
  };

  // ── 聊天状态 ──
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: SAFETY_PROMISE, time: getTime() },
  ]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(true);

  // ── 语音状态 ──
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(() => {
    const stored = localStorage.getItem('mh_voiceMode');
    return (stored === 'hold' || stored === 'click') ? stored : 'hold';
  });
  const [voiceUIActive, setVoiceUIActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [cancelZone, setCancelZone] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const transcriptRef = useRef('');
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── 危机 + 提醒 ──
  const [showCrisis, setShowCrisis] = useState(false);
  const [showTimeAlert, setShowTimeAlert] = useState(false);

  // ── 计时器 ──
  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setElapsedSeconds(prev => {
        const next = prev + 1;
        if (next === 30 * 60) {
          setShowTimeAlert(true);
          setTimeout(() => setShowTimeAlert(false), 8000);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  // ── 滚动到底部 ──
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 80);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, thinking, voiceUIActive, scrollToBottom]);

  // ── 危机检测 ──
  const checkCrisis = useCallback((text: string) => {
    if (CRISIS_KEYWORDS.some(kw => text.includes(kw))) {
      setShowCrisis(true);
    }
  }, []);

  // ── 发送消息 ──
  const addUserMessage = useCallback(async (text: string) => {
    const time = getTime();
    const userMsg: ChatMessage = { role: 'user', text, time };
    setMessages(prev => [...prev, userMsg]);
    setThinking(true);

    try {
      await emotionsApi.logEmotionMessage({ role: 'user', text, duration_seconds: elapsedSeconds });
    } catch { /* 静默失败 */ }

    checkCrisis(text);

    let replyText: string;
    try {
      const suggest = await emotionsApi.fetchEmotionSuggest(text);
      replyText = suggest.text;
    } catch {
      const local = emotionsApi.getLocalSuggest(text);
      replyText = local.text || FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)];
    }

    await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));

    const assistantMsg: ChatMessage = { role: 'assistant', text: replyText, time: getTime() };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      await emotionsApi.logEmotionMessage({ role: 'assistant', text: replyText, duration_seconds: elapsedSeconds });
    } catch { /* 静默失败 */ }

    setThinking(false);
    scrollToBottom();
  }, [elapsedSeconds, checkCrisis, scrollToBottom]);

  // ── 键盘发送 ──
  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || thinking) return;
    setDraft('');
    await addUserMessage(text);
  }, [draft, thinking, addUserMessage]);

  // ═══════════════════════════════════════════════
  //  语音识别
  // ═══════════════════════════════════════════════

  const startTimer = () => { setRecordingTime(0); timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000); };
  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const initRecognition = useCallback(() => {
    if (recognitionRef.current) return recognitionRef.current;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const rec = new SpeechRecognition();
    rec.lang = 'zh-CN';
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcriptRef.current += event.results[i][0].transcript;
        }
      }
    };

    rec.onerror = (e: any) => {
      console.warn('语音错误', e.error);
      if (e.error === 'not-allowed') alert('请允许麦克风权限');
      setIsRecording(false);
      setVoiceUIActive(false);
    };

    rec.onend = () => {
      if (isRecording) {
        try { rec.start(); } catch (_) { /* ignore */ }
      }
    };

    recognitionRef.current = rec;
    return rec;
  }, [isRecording]);

  const startRecording = useCallback(() => {
    const rec = initRecognition();
    if (!rec) return;
    transcriptRef.current = '';
    setCancelZone(false);
    try {
      rec.start();
      setIsRecording(true);
      startTimer();
    } catch (_) { /* ignore */ }
  }, [initRecognition]);

  const stopRecording = useCallback((cancelled: boolean = false) => {
    if (!isRecording) return;
    setIsRecording(false);
    stopTimer();
    try { recognitionRef.current?.stop(); } catch (_) { /* ignore */ }

    setVoiceUIActive(false);

    if (cancelled || cancelZone || transcriptRef.current.trim() === '') {
      transcriptRef.current = '';
      return;
    }

    const userMsg = transcriptRef.current.trim();
    transcriptRef.current = '';
    addUserMessage(userMsg);
  }, [isRecording, cancelZone, addUserMessage]);

  const cancelRecording = useCallback(() => {
    stopRecording(true);
  }, [stopRecording]);

  // ── 大语音按钮事件 ──
  const handleLargeVoiceStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    if (isRecording) return;
    startRecording();
  }, [isRecording, startRecording]);

  const handleLargeVoiceEnd = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    if (!isRecording) return;
    if (voiceMode === 'hold') stopRecording(cancelZone);
  }, [isRecording, voiceMode, cancelZone, stopRecording]);

  const handleLargeVoiceMove = useCallback((e: React.PointerEvent) => {
    if (!isRecording || voiceMode !== 'hold') return;
    setCancelZone(e.clientY < window.innerHeight * 0.35);
  }, [isRecording, voiceMode]);

  const handleLargeVoiceClick = useCallback(() => {
    if (voiceMode === 'click') {
      if (isRecording) stopRecording(false);
      else startRecording();
    }
  }, [voiceMode, isRecording, startRecording, stopRecording]);

  // ── 话筒/发送合并按钮 ──
  const hasText = draft.trim().length > 0;

  const handleMicSendClick = useCallback(() => {
    if (hasText) {
      handleSend();
    } else if (!isRecording) {
      setVoiceUIActive(true);
    }
  }, [hasText, isRecording, handleSend]);

  // ── 设置按钮：跳转设置页 ──
  const handleSettingsClick = useCallback(() => {
    if (isRecording) {
      setIsRecording(false);
      stopTimer();
      try { recognitionRef.current?.stop(); } catch (_) { /* ignore */ }
      setVoiceUIActive(false);
      transcriptRef.current = '';
    }
    navigate('/m/mood-haven/settings');
  }, [isRecording, navigate]);

  // ── 结束倾诉 ──
  const handleEndChat = useCallback(async () => {
    if (isRecording) {
      setIsRecording(false);
      stopTimer();
      try { recognitionRef.current?.stop(); } catch (_) { /* ignore */ }
      setVoiceUIActive(false);
    }
    setTimerRunning(false);

    try {
      await emotionsApi.createGrowthRecord({
        chat_messages: messages.map(m => ({ role: m.role, text: m.text })),
        emotion_score: 0,
        courage_value: Math.min(100, Math.round(Math.min(elapsedSeconds / 60, 60) * 1.2 + 30)),
        duration_minutes: Math.round(elapsedSeconds / 60),
      });
    } catch { /* 静默失败 */ }

    navigate('/m/mood-haven/growth');
  }, [isRecording, messages, elapsedSeconds, navigate]);

  // ── 页面卸载清理 ──
  useEffect(() => {
    return () => {
      if (recognitionRef.current && isRecording) {
        try { recognitionRef.current.stop(); } catch (_) { /* ignore */ }
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  // ═══════════════════════════════════════════════
  //  JSX — 模仿 MorningPlan chat.tsx 布局
  // ═══════════════════════════════════════════════

  return (
    <div className="mh-mobile-page">
      {/* ═══ Header（48px 固定顶栏） ═══ */}
      <header className="mh-mobile-page__header">
        <button className="mh-header-btn" onClick={() => navigate(-1)}>
          <Icon icon="mingcute:arrow-left-fill" style={{ fontSize: '24px', color: P.headerBtn }} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: P.title }}>情绪树洞</span>
          <div style={{ fontSize: '10px', color: P.timer, fontFamily: 'monospace' }}>
            已倾诉 {formatDuration(elapsedSeconds)}
          </div>
        </div>
        <button className="mh-header-btn" onClick={handleSettingsClick}>
          <Icon icon="mingcute:settings-3-fill" style={{ fontSize: '24px', color: P.settingsIcon }} />
        </button>
      </header>

      {/* ═══ Chat Scroll Area ═══ */}
      <main className="mh-main-scroll" ref={scrollRef}>
        {/* 品牌标语 */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ color: P.brand, fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
            日耕朝夕，耕愈工作，耕暖生活
          </div>
          <span style={{
            fontSize: 10, color: P.brand, background: P.brandTagBg,
            padding: '2px 8px', borderRadius: 10,
          }}>
            心事有处说，烦恼变智慧
          </span>
        </div>

        {/* Messages */}
        {messages.map((m, i) => (
          <div key={i} className={`mh-bubble-row ${m.role === 'user' ? 'mh-bubble-row--user' : ''}`} style={{ marginBottom: 12 }}>
            <div
              className={`mh-bubble mh-bubble--${m.role} mh-message-enter`}
              style={{
                background: m.role === 'assistant' ? P.bubbleAssistant : P.bubbleUser,
                color: P.bubbleText,
              }}
            >
              {m.text}
            </div>
          </div>
        ))}

        {/* 思考动画 */}
        {thinking && (
          <div className="mh-thinking" style={{ color: P.thinkingColor }}>
            <div className="mh-thinking__spinner" style={{
              borderColor: P.thinkingSpinnerBorder,
              borderTopColor: P.thinkingSpinnerTop,
            }} />
            <span>小耕在聆听…</span>
          </div>
        )}

        <div style={{ height: 12 }} />
      </main>

      {/* ═══ Input Area ═══ */}
      <div className="mh-chat-input-area">
        {/* 大语音覆盖层 */}
        {voiceUIActive && (
          <div className="mh-voice-zone">
            <div className="mh-voice-hint" style={{ color: P.voiceHintColor }}>
              {voiceMode === 'hold' ? '按住说话，松手发送' : '点击说话，再点一下发送'}
            </div>
            <div className="mh-voice-cancel-row">
              {isRecording && (
                <button
                  className={`mh-voice-cancel-pill ${cancelZone ? 'mh-voice-cancel-pill--active' : ''}`}
                  style={cancelZone ? {} : {
                    background: P.cancelBg, color: P.cancelColor, borderColor: P.cancelBorder,
                  }}
                  onClick={(e) => { e.stopPropagation(); cancelRecording(); }}
                >取消</button>
              )}
            </div>
            <div
              className="mh-voice-large-btn"
              style={{ background: P.voiceBtnGradient, boxShadow: P.voiceBtnShadow }}
              onPointerDown={handleLargeVoiceStart}
              onPointerUp={handleLargeVoiceEnd}
              onPointerMove={handleLargeVoiceMove}
              onClick={handleLargeVoiceClick}
            >
              <div className="mh-voice-pulse-ring" style={{ background: P.voicePulseBg }} />
              <div className="mh-voice-pulse-ring" style={{ background: P.voicePulseBg }} />
              <Icon icon="solar:microphone-bold" style={{ fontSize: '30px', color: P.micIconColor, position: 'relative', zIndex: 10 }} />
            </div>
            {isRecording && <div className="mh-voice-timer" style={{ color: P.voiceTimerColor }}>{fmtTime(recordingTime)}</div>}
          </div>
        )}

        {/* 输入行 + 结束倾诉按钮 */}
        {!voiceUIActive && (
          <>
            <button
              className="mh-end-session-btn"
              style={{ background: P.endSessionBg, color: P.endSessionColor, boxShadow: P.endSessionShadow }}
              onClick={handleEndChat}
            >
              <Icon icon="mingcute:check-circle-line" style={{ fontSize: '14px' }} />
              结束倾诉
            </button>
            <div className="mh-chat-input-pill">
              <input
                placeholder="输入倾诉内容..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                autoComplete="off"
              />
              <button
                className="mh-chat-mic-btn"
                style={{ background: P.micBg, color: P.micColor }}
                onClick={handleMicSendClick}
              >
                <Icon
                  icon={hasText ? 'solar:arrow-up-linear' : 'solar:microphone-3-linear'}
                  style={{ fontSize: '22px' }}
                />
              </button>
            </div>
          </>
        )}
      </div>

      {/* ═══ 危机干预弹窗 ═══ */}
      {showCrisis && (
        <div className="mh-modal-mask" onClick={() => setShowCrisis(false)}>
          <div className="mh-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mh-modal__icon">
              <Icon icon="mingcute:phone-line" width={32} color="#C03A39" />
            </div>
            <h3 className="mh-modal__title">姐，小耕注意到您可能不太好</h3>
            <p className="mh-modal__desc">
              如果需要，可以拨打这个号码，有人帮您：
            </p>
            <div className="mh-modal__hotline">400-161-9995</div>
            <p style={{ fontSize: 12, color: '#888', marginBottom: 20 }}>
              全国 24 小时心理危机干预热线
            </p>
            <button className="mh-modal__close" onClick={() => setShowCrisis(false)}>
              我知道了
            </button>
          </div>
        </div>
      )}

      {/* ═══ 30分钟温柔提醒 ═══ */}
      {showTimeAlert && (
        <div className="mh-time-alert" onClick={() => setShowTimeAlert(false)}>
          <span className="mh-time-alert__icon">
            <Icon icon="mingcute:notification-line" width={20} />
          </span>
          <p className="mh-time-alert__text">
            姐，今天咱们已经聊了好一会儿了，要不要先休息一下？小耕一直都在。
          </p>
        </div>
      )}
    </div>
  );
}
