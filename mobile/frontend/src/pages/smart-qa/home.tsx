/**
 * P1 智能问答首页 — 品牌语 + 输入框 + 热门话题 + 语音输入。
 * Route: /m/smart-qa (index)
 * 对齐 m5p1-mobile.html 设计。
 *
 * 跳转：输入/选择问题 → /m/smart-qa/chat?q=...
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { fetchHotQuestions, type HotQuestion } from '@/shared/api/smartQa';
import './smart-qa.css';

type VoiceMode = 'hold' | 'click';

/* ── Helpers ── */
function now() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ── Hot topics fallback ── */
const FALLBACK_HOT: HotQuestion[] = [
  { id: 'q1', text: '试用期员工不符合录用条件，如何合规解除？' },
  { id: 'q2', text: '薪酬宽带如何设计才能激励老员工？' },
  { id: 'q3', text: '年底绩效面谈怎么引导员工说出真实想法？' },
  { id: 'q4', text: '新员工入职培训体系怎么搭建？' },
];

export function SmartQaHome() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  /* ── Input state ── */
  const [question, setQuestion] = useState('');
  const [hotQuestions, setHotQuestions] = useState<HotQuestion[]>([]);

  /* ── Voice state ── */
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('hold');
  const [voiceUIActive, setVoiceUIActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [cancelZone, setCancelZone] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  /* ── Refs ── */
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pressStartYRef = useRef(0);

  /* ── Init ── */
  useEffect(() => {
    const saved = localStorage.getItem('rg_voice_mode') as VoiceMode | null;
    if (saved === 'hold' || saved === 'click') setVoiceMode(saved);

    fetchHotQuestions()
      .then(setHotQuestions)
      .catch(() => setHotQuestions(FALLBACK_HOT));

    // 从 URL 恢复问题
    const q = searchParams.get('q');
    if (q) setQuestion(decodeURIComponent(q));
  }, [searchParams]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  /* ── Navigation ── */
  const hasText = question.trim().length > 0;

  const handleSubmit = useCallback(() => {
    const q = question.trim();
    if (!q) return;
    navigate(`/m/smart-qa/chat?q=${encodeURIComponent(q)}`);
  }, [question, navigate]);

  const handleHotClick = (text: string) => {
    navigate(`/m/smart-qa/chat?q=${encodeURIComponent(text)}`);
  };

  /* ═══════════════════════════════════════════════
     Voice Recording
     ═══════════════════════════════════════════════ */

  const startTimer = () => { setRecordingTime(0); timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000); };
  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const initRecognition = () => {
    if (recognitionRef.current) return recognitionRef.current;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('浏览器不支持语音识别，请使用 Chrome 或 Edge。'); return null; }
    const r = new SpeechRecognition();
    r.lang = 'zh-CN'; r.continuous = true; r.interimResults = true;
    r.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++)
        if (e.results[i].isFinal) transcriptRef.current += e.results[i][0].transcript;
    };
    r.onerror = (e: any) => {
      if (e.error === 'not-allowed') alert('请允许麦克风权限后重试');
      stopRecording(true);
    };
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
    if (text) {
      setQuestion(text);
      inputRef.current?.focus();
    }
  };

  const cancelRecording = () => { if (isRecording) stopRecording(true); };

  /* ── Voice UI ── */
  const showVoiceUI = () => {
    if (isRecording) return;
    setVoiceUIActive(true);
    inputRef.current?.blur();
  };

  const handleMicSendClick = () => {
    if (hasText) { handleSubmit(); }
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

  /* ── Settings ── */
  const toggleVoiceMode = () => {
    if (isRecording) stopRecording(true);
    setVoiceUIActive(false);
    const next = voiceMode === 'hold' ? 'click' : 'hold';
    setVoiceMode(next);
    localStorage.setItem('rg_voice_mode', next);
    alert(next === 'click' ? '已切换为「点击说话」模式\n点击话筒开始录音，再次点击发送' : '已切换为「按住说话」模式\n按住录音，松开发送');
  };

  /* ═══════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════ */

  return (
    <div className="sq-mobile-page">
      {/* Header */}
      <header className="sq-mobile-page__header" style={{ height: 48 }}>
        <button className="sq-header-btn" onClick={() => navigate(-1)}>
          <Icon icon="mingcute:left-line" style={{ fontSize: '24px' }} />
        </button>
        <div className="sq-header-center">
          <span className="sq-header-slogan">日耕朝夕，耕愈工作，耕暖生活</span>
          <span className="sq-header-title">智能问答</span>
        </div>
        <button className="sq-header-btn" onClick={toggleVoiceMode}>
          <Icon icon="mingcute:settings-3-line" style={{ fontSize: '24px', color: '#C03A39' }} />
        </button>
      </header>

      {/* Main Content */}
      <main className="sq-main-scroll">
        <div className="sq-main-padding" style={{ paddingTop: 16, paddingBottom: 96 }}>
          {/* Brand Slogan */}
          <p className="sq-brand__slogan" style={{ textAlign: 'center', marginBottom: 4 }}>
            日耕朝夕，耕愈工作，耕暖生活
          </p>
          {/* Brand Title */}
          <h1 className="sq-brand__title">随时随地问，答案不瞎编</h1>

          {/* Input Row */}
          <div className="sq-input-row">
            <input
              ref={inputRef}
              className="sq-input-row__input"
              type="text"
              placeholder="输入你的 HR 问题…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onFocus={() => setVoiceUIActive(false)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } }}
              autoComplete="off"
            />
            <button className="sq-input-row__btn" onClick={handleMicSendClick}>
              {hasText ? (
                <Icon icon="mingcute:send-fill" style={{ fontSize: '20px' }} />
              ) : (
                <Icon icon="mingcute:microphone-fill" style={{ fontSize: '20px' }} />
              )}
            </button>
          </div>

          {/* Hot Topics */}
          <div className="sq-hot">
            <div className="sq-hot__header">
              <Icon icon="mingcute:fire-line" className="sq-hot__header-icon" />
              <span className="sq-hot__header-text">热门话题</span>
            </div>
            {hotQuestions.slice(0, 4).map((q) => (
              <a
                key={q.id}
                className="sq-hot-card"
                onClick={(e) => { e.preventDefault(); handleHotClick(q.text); }}
                href={`/m/smart-qa/chat?q=${encodeURIComponent(q.text)}`}
              >
                {q.text}
              </a>
            ))}
          </div>
        </div>
      </main>

      {/* Voice Recording Overlay */}
      {voiceUIActive && (
        <div className="sq-voice-zone">
          <div className="sq-voice-hint">
            {voiceMode === 'hold' ? '按住说话，松手发送' : '点击说话，再点一下发送'}
          </div>
          <div className="sq-voice-cancel-row">
            {isRecording && (
              <button
                className={`sq-voice-cancel-btn ${cancelZone ? 'sq-voice-cancel-btn--active' : ''}`}
                onClick={(e) => { e.stopPropagation(); cancelRecording(); }}
              >取消</button>
            )}
          </div>
          <div
            className={`sq-voice-large-btn ${isRecording ? 'sq-voice-large-btn--recording' : ''}`}
            onPointerDown={handleLargeVoiceStart}
            onPointerUp={handleLargeVoiceEnd}
            onPointerMove={handleLargeVoiceMove}
            onClick={handleLargeVoiceClick}
          >
            {!isRecording && (<><div className="sq-voice-pulse-ring" /><div className="sq-voice-pulse-ring" /></>)}
            <Icon icon="mingcute:microphone-fill" style={{ fontSize: '30px', color: '#fff', position: 'relative', zIndex: 10 }} />
          </div>
          {isRecording && <div className="sq-voice-timer">{fmtTime(recordingTime)}</div>}
        </div>
      )}
    </div>
  );
}
