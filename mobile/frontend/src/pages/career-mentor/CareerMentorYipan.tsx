/**
 * 高维求职 P2·一盘 — 简历盘点与重构（对话模式 + 语音输入 + 文件上传）。
 * Route: /m/career-mentor/yipan
 *
 * V3.0: 所有小耕输出内容由AI模型生成，AI按五大盘点算法引导：
 *       履历梳理→STAR追问→技能晶体→人脉资源→岗位建议。
 *
 * 使用 cm-* BEM 类名 + 内联 style。无 Tailwind CSS。
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { uploadResumeFile, careerChat } from '@/shared/api/career';
import type { ResumeFileUploadResult } from '@/shared/api/career';
import './career-mentor.css';

type VoiceMode = 'hold' | 'click';

interface Message {
  key: string;
  role: 'assistant' | 'user';
  type: 'text' | 'voice' | 'upload';
  text: string;
  time: string;
}

let _msgId = 0;
function nextId() { return `cm_${Date.now()}_${++_msgId}`; }
function now() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function buildCtx(msgs: Message[]): Array<{ role: string; text: string }> {
  return msgs.filter(m => m.text).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', text: m.text }));
}

const ACCEPTED_TYPES = '.pdf,.doc,.docx';
const MAX_SIZE = 20 * 1024 * 1024;

export function CareerMentorYipan() {
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [parseResult, setParseResult] = useState<ResumeFileUploadResult | null>(null);
  const [subIndex, setSubIndex] = useState(0); // 0-4: 履历梳理→STAR追问→技能晶体→人脉资源→岗位建议
  const [progressId, setProgressId] = useState('');

  const [voiceMode, setVoiceMode] = useState<VoiceMode>('hold');
  const [voiceUIActive, setVoiceUIActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [cancelZone, setCancelZone] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pressStartYRef = useRef(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initRef = useRef(false);

  /* ── Init: AI 生成初始问候 ── */
  useEffect(() => {
    if (initRef.current) return; initRef.current = true;
    const saved = localStorage.getItem('rg_voice_mode') as VoiceMode | null;
    if (saved === 'hold' || saved === 'click') setVoiceMode(saved);

    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const result = await careerChat({ message: '', step: 'yipan', context: [], sub_index: 0, has_resume: false });
        if (cancelled) return;
        setIsLoading(false);
        setMessages([{ key: nextId(), role: 'assistant', type: 'text', text: result.reply, time: now() }]);
      } catch {
        if (cancelled) return;
        setIsLoading(false);
        setMessages([{ key: nextId(), role: 'assistant', type: 'text',
          text: '欢迎来到<strong>一盘·简历盘点</strong>～上传简历或直接跟我聊聊，小耕带您做<strong>五大盘点</strong>，把过去的经历变成求职资产！', time: now() }]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const scrollBottom = useCallback(() => {
    setTimeout(() => { chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' }); }, 80);
  }, []);
  useEffect(() => { scrollBottom(); }, [messages, isLoading, isUploading, voiceUIActive, scrollBottom]);

  /* ═══════════════════════════════════════════════
     File Upload + AI 解析
     ═══════════════════════════════════════════════ */

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['pdf', 'doc', 'docx'].includes(ext)) {
      setMessages(prev => [...prev, { key: nextId(), role: 'assistant', type: 'text',
        text: '姐，小耕目前支持PDF和Word格式的简历哦～', time: now() }]);
      return;
    }
    if (file.size > MAX_SIZE) {
      setMessages(prev => [...prev, { key: nextId(), role: 'assistant', type: 'text',
        text: '姐，文件太大了（超过20MB），能压缩一下或者换个文件吗？', time: now() }]);
      return;
    }

    setMessages(prev => [...prev, { key: nextId(), role: 'user', type: 'upload', text: `上传了「${file.name}」`, time: now() }]);
    setIsUploading(true); setIsLoading(true);

    try {
      const result = await uploadResumeFile(file);
      setParseResult(result); setProgressId(result.career_progress_id);

      // AI 生成上传成功的回复
      try {
        const ctx = buildCtx([...messages]);
        ctx.push({ role: 'user', text: `已上传简历：${result.parsed_summary}` });
        const aiReply = await careerChat({
          message: `已上传简历，解析结果：${result.parsed_summary}`,
          step: 'yipan', context: ctx, sub_index: 0, has_resume: true,
        });
        setMessages(prev => [...prev, { key: nextId(), role: 'assistant', type: 'text', text: aiReply.reply, time: now() }]);
      } catch {
        setMessages(prev => [...prev, { key: nextId(), role: 'assistant', type: 'text',
          text: `姐，简历解析完成！${result.parsed_summary}\n\n识别到核心技能：${result.key_skills.slice(0, 6).join('、')}\n关键经历：${result.key_experiences.slice(0, 3).map(e => `• ${e}`).join('\n')}\n\n✅ 已存入一盘·简历盘点。`, time: now() }]);
      }
      setSubIndex(1); // 进入STAR追问
    } catch (err: any) {
      setMessages(prev => [...prev, { key: nextId(), role: 'assistant', type: 'text',
        text: `姐，简历解析出了点问题：${err.message || '请稍后重试'}\n\n要不直接跟我说说您的经历？小耕也能帮您梳理～`, time: now() }]);
    } finally {
      setIsUploading(false); setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /* ═══════════════════════════════════════════════
     Voice Recording
     ═══════════════════════════════════════════════ */

  const startTimer = () => { setRecordingTime(0); timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000); };
  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const initRecognition = () => {
    if (recognitionRef.current) return recognitionRef.current;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('浏览器不支持语音识别'); return null; }
    const r = new SR(); r.lang = 'zh-CN'; r.continuous = true; r.interimResults = true;
    r.onresult = (e: any) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) transcriptRef.current += e.results[i][0].transcript; };
    r.onerror = (e: any) => { if (e.error === 'not-allowed') alert('请允许麦克风权限'); stopRecording(true); };
    r.onend = () => { if (isRecording) { try { r.start(); } catch { /* */ } } };
    recognitionRef.current = r; return r;
  };

  const startRecording = () => { const r = initRecognition(); if (!r) return; transcriptRef.current = ''; setCancelZone(false); try { r.start(); setIsRecording(true); startTimer(); } catch { /* */ } };
  const stopRecording = (cancelled = false) => { if (!isRecording) return; setIsRecording(false); stopTimer(); try { recognitionRef.current?.stop(); } catch { /* */ } setVoiceUIActive(false); if (cancelled || cancelZone) return; const t = transcriptRef.current.trim(); if (t) processUserInput(t, true); };
  const cancelRecording = () => { if (isRecording) stopRecording(true); };

  /* ═══════════════════════════════════════════════
     Core: send user input → AI 生成回复
     ═══════════════════════════════════════════════ */

  const processUserInput = useCallback(async (text: string, isVoice = false) => {
    setIsLoading(true);
    const userMsg: Message = { key: nextId(), role: 'user', type: isVoice ? 'voice' : 'text', text, time: now() };
    const curMsgs = [...messages, userMsg];
    setMessages(curMsgs);

    try {
      const ctx = buildCtx(curMsgs);
      const result = await careerChat({
        message: text,
        step: 'yipan',
        context: ctx,
        sub_index: subIndex,
        has_resume: !!parseResult,
      });

      const aiMsg: Message = { key: nextId(), role: 'assistant', type: 'text', text: result.reply, time: now() };
      setMessages(prev => [...prev, aiMsg]);

      // 自动推进子阶段（根据用户输入长度和子阶段判断）
      if (subIndex < 4 && text.length > 30) {
        setSubIndex(prev => Math.min(4, prev + 1));
      }
    } catch {
      setMessages(prev => [...prev, { key: nextId(), role: 'assistant', type: 'text',
        text: '姐，小耕正在努力思考中，请稍等一下哦～', time: now() }]);
    } finally {
      setIsLoading(false);
      scrollBottom();
    }
  }, [messages, subIndex, parseResult, scrollBottom]);

  const handleSendText = () => { const t = inputText.trim(); if (!t || isLoading) return; setInputText(''); processUserInput(t); };

  /* ═══════════════════════════════════════════════
     Voice UI
     ═══════════════════════════════════════════════ */

  const showVoiceUI = () => { setVoiceUIActive(true); inputRef.current?.blur(); };
  const hasText = inputText.trim().length > 0;

  const handleMicSendClick = () => { if (hasText) handleSendText(); else if (!isRecording) showVoiceUI(); };
  const handleLargeVoiceStart = (e: React.PointerEvent) => { e.preventDefault(); if (isRecording) return; startRecording(); pressStartYRef.current = e.clientY; };
  const handleLargeVoiceEnd = (e: React.PointerEvent) => { e.preventDefault(); if (!isRecording) return; if (voiceMode === 'hold') stopRecording(cancelZone); };
  const handleLargeVoiceMove = (e: React.PointerEvent) => { if (!isRecording || voiceMode !== 'hold') return; setCancelZone(pressStartYRef.current - e.clientY > 80); };
  const handleLargeVoiceClick = () => { if (voiceMode === 'click') { if (isRecording) stopRecording(false); else startRecording(); } };

  const toggleVoiceMode = () => {
    const next = voiceMode === 'hold' ? 'click' : 'hold'; setVoiceMode(next);
    localStorage.setItem('rg_voice_mode', next);
    if (isRecording) stopRecording(true); setVoiceUIActive(false);
  };

  const handleGoNext = () => {
    const pid = progressId || parseResult?.career_progress_id || '';
    navigate(`/m/career-mentor/erding?progress_id=${encodeURIComponent(pid)}`);
  };

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
  const handleVoiceBubbleEnd = () => { if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; } };

  const hasMessages = messages.length > 0;
  const phaseLabels = ['履历梳理', 'STAR追问', '技能晶体', '人脉资源', '岗位建议'];

  return (
    <div className="cm-mobile-page">
      <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} style={{ display: 'none' }} onChange={handleFileChange} />

      <header className="cm-mobile-page__header">
        <button className="cm-header-btn" onClick={() => navigate(-1)}><Icon icon="mingcute:arrow-left-fill" style={{ fontSize: '24px' }} /></button>
        <div className="cm-header-subtitle-row">
          <div className="cm-header-subtitle-main" style={{ color: '#C03A39' }}>STEP 1 · 一盘</div>
          <div className="cm-header-subtitle-sub">简历盘点与重构</div>
        </div>
        <button className="cm-header-btn" onClick={toggleVoiceMode}><Icon icon="mingcute:settings-6-line" style={{ fontSize: '24px' }} /></button>
      </header>

      <div className="cm-sub-progress">
        <div className="cm-sub-progress__header">
          <span className="cm-sub-progress__label">盘点进度 · {phaseLabels[subIndex]}</span>
          <span className="cm-sub-progress__count">{subIndex + 1}/5</span>
        </div>
        <div className="cm-sub-progress__bar">
          {[0,1,2,3,4].map(i => (
            <div key={i} className={`cm-sub-progress__seg${i <= subIndex ? ' cm-sub-progress__seg--active' : ''}`} />
          ))}
        </div>
        <div className="cm-sub-progress__labels">
          {phaseLabels.map((l, i) => (
            <span key={i} className="cm-sub-progress__seg-label" style={{ color: i <= subIndex ? '#C03A39' : undefined }}>{l}</span>
          ))}
        </div>
      </div>

      <main className="cm-main-scroll" ref={chatScrollRef} style={{ padding: '16px', background: '#FAF9F7' }}>
        <div className="cm-hero" style={{ marginBottom: 4 }}><p className="cm-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</p></div>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <p className="cm-hero__title" style={{ fontSize: 17 }}>高维五步法，前程自发光</p>
          <p className="cm-welcome-hint">告诉我您的职业经历，语音或文字都可以</p>
        </div>

        {/* 上传区 */}
        {!parseResult && (
          <div className="cm-resume-upload cm-fade-up" style={{ marginBottom: 14, cursor: 'pointer' }} onClick={handleUploadClick}>
            <div className="cm-resume-upload__icon"><Icon icon="mingcute:upload-line" width={20} /></div>
            <div className="cm-resume-upload__body">
              <div className="cm-resume-upload__title">上传最新简历</div>
              <div className="cm-resume-upload__hint">PDF / Word，AI自动解析</div>
            </div>
            <button className="cm-resume-upload__btn">上传</button>
          </div>
        )}
        {parseResult && (
          <div className="cm-resume-upload cm-fade-up" style={{ marginBottom: 14, background: '#F0FFF0', border: '1px solid #C8E6C9' }}>
            <div className="cm-resume-upload__icon"><Icon icon="mingcute:check-circle-fill" width={24} style={{ color: '#4CAF50' }} /></div>
            <div className="cm-resume-upload__body">
              <div className="cm-resume-upload__title" style={{ color: '#2E7D32' }}>简历已解析</div>
              <div className="cm-resume-upload__hint">{parseResult.filename} · {parseResult.text_length}字</div>
            </div>
            <button className="cm-resume-upload__btn" style={{ background: '#4CAF50' }} onClick={handleGoNext}>下一步</button>
          </div>
        )}

        {/* Messages */}
        {messages.map(msg => msg.type === 'voice' ? (
          <div key={msg.key} className="cm-bubble-row cm-bubble-row--user cm-fade-up">
            <div className="cm-avatar cm-avatar--user">你</div>
            <div className="cm-bubble-wrapper cm-bubble-wrapper--user">
              <div className="cm-voice-msg" onTouchStart={e => handleVoiceBubbleTouchStart(msg.text, e)} onTouchEnd={handleVoiceBubbleEnd} onTouchMove={handleVoiceBubbleEnd} onMouseDown={e => handleVoiceBubbleTouchStart(msg.text, e)} onMouseUp={handleVoiceBubbleEnd} onMouseLeave={handleVoiceBubbleEnd}>
                <Icon icon="mingcute:play-circle-line" className="cm-voice-msg__icon" />
                <span className="cm-voice-msg__label">语音消息</span>
                <span className="cm-voice-msg__bars">▮▮▮</span>
                {transcribeTarget === msg.text && <div className="cm-transcribe-popup" style={transcribePos ? { left: transcribePos.x, top: transcribePos.y - 40, transform: 'translateX(-50%)' } : undefined}>转文字：{transcribeTarget}</div>}
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
              <div className="cm-bubble cm-bubble--assistant" style={{ whiteSpace: 'pre-line' }} dangerouslySetInnerHTML={{ __html: msg.text }} />
              <span className="cm-bubble-time">{msg.time}</span>
            </div>
          </div>
        ))}

        {isUploading && <div className="cm-thinking"><Icon icon="mingcute:loading-line" style={{ fontSize: '16px', animation: 'spin 1s linear infinite' }} /><span>小耕正在解析简历...</span></div>}
        {isLoading && !isUploading && <div className="cm-thinking"><Icon icon="mingcute:loading-line" style={{ fontSize: '16px', animation: 'spin 1s linear infinite' }} /><span>小耕正在思考...</span></div>}

        {!hasMessages && !isLoading && !isUploading && (
          <div className="cm-empty-state">
            <div className="cm-empty-state__icon"><Icon icon="mingcute:chat-line" width={28} /></div>
            <p className="cm-empty-state__title">开始对话，开启一盘盘点</p>
            <p className="cm-empty-state__desc">上传简历或点击下方麦克风，<br />用语音或文字跟小耕聊聊您的职业经历～</p>
          </div>
        )}
        <div style={{ height: 12 }} />
      </main>

      <div className="cm-chat-input-area">
        <div className="cm-chat-input-pill">
          <input ref={inputRef} type="text" value={inputText} onChange={e => setInputText(e.target.value)} onFocus={() => setVoiceUIActive(false)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); } }} placeholder="输入您的职业经历..." autoComplete="off" />
          <button className="cm-chat-mic-btn" onClick={handleMicSendClick}>
            {hasText ? <Icon icon="mingcute:arrow-up-fill" style={{ fontSize: '20px' }} /> : <Icon icon="mingcute:mic-fill" style={{ fontSize: '20px' }} />}
          </button>
        </div>
      </div>

      {voiceUIActive && (
        <div className="cm-voice-zone">
          <div className="cm-voice-hint">{voiceMode === 'hold' ? '按住说话，松手发送' : '点击说话，再点一下发送'}</div>
          <div className="cm-voice-cancel-row">
            {isRecording && <button className={`cm-voice-cancel-pill ${cancelZone ? 'cm-voice-cancel-pill--active' : ''}`} onClick={e => { e.stopPropagation(); cancelRecording(); }}>取消</button>}
          </div>
          <div className={`cm-voice-large-btn ${isRecording ? 'cm-voice-large-btn--recording' : ''}`} onPointerDown={handleLargeVoiceStart} onPointerUp={handleLargeVoiceEnd} onPointerMove={handleLargeVoiceMove} onClick={handleLargeVoiceClick}>
            {!isRecording && <><div className="cm-voice-pulse-ring" /><div className="cm-voice-pulse-ring" /></>}
            <Icon icon="mingcute:mic-fill" style={{ fontSize: '30px', color: '#fff', position: 'relative', zIndex: 10 }} />
          </div>
          {isRecording && <div className="cm-voice-timer">{fmtTime(recordingTime)}</div>}
        </div>
      )}
    </div>
  );
}
