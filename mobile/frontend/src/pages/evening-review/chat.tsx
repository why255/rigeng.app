/**
 * P2 对话复盘页 — 移动端（对齐 m2-p2-mobile.html 完整语音交互设计 + 腾讯云ASR）。
 * Route: /m/evening-review/chat
 *
 * V2.0: 所有小耕输出内容由AI模型生成，AI按照五阶段算法引导用户完成复盘。
 * 前端控制阶段流转逻辑，后端负责内容生成。
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
  STAGE_TRANSITIONS,
  COURAGE_MESSAGES,
  REFUSAL_KEYWORDS,
  getTime,
  getCourageMessage,
} from '@/shared/components/features/evening-review';
import { useVoiceInput, type VoiceMode } from '@/shared/hooks/useVoiceInput';
import '../morning-plan/morning-plan.css';

/* ── Types ── */

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

function detectRefusal(text: string): boolean {
  return REFUSAL_KEYWORDS.some(kw => text.includes(kw));
}

function shouldAdvanceToReview(userTexts: string[], rounds: number): boolean {
  let score = 0;
  const eventKW = ['完成', '做了', '开了', '面试', '会议', '写', '提交', '处理', '对接', '沟通'];
  if (userTexts.filter(msg => eventKW.some(k => msg.includes(k))).length >= 2) score++;
  const emotionKW = ['开心', '累', '焦虑', '压力', '满意', '失望', '兴奋', '沮丧', '烦躁', '充实'];
  if (userTexts.some(msg => emotionKW.some(k => msg.includes(k)))) score++;
  const difficultyKW = ['困难', '问题', '不足', '失败', '没做好', '不顺利', '麻烦', '头疼'];
  if (userTexts.some(msg => difficultyKW.some(k => msg.includes(k)))) score++;
  const doneKW = ['差不多', '就这些', '说完了', '没有了', '就这样', '可以了'];
  if (userTexts.some(msg => doneKW.some(k => msg.includes(k)))) score++;
  if (rounds >= 6) score++;
  if (rounds >= 8) return true;
  return score >= 2;
}

/** Build context array from messages for API */
function buildContext(messages: ChatMessage[]): Array<{ role: 'user' | 'assistant'; text: string }> {
  return messages
    .filter(m => m.type === 'text')
    .map(m => ({ role: m.role as 'user' | 'assistant', text: m.text }));
}

/* ── Component ── */

export function EveningReviewChat() {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Voice mode ── */
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(() => {
    return (localStorage.getItem('er_voiceMode') as VoiceMode) || 'hold';
  });

  /* ── Phase: collecting / reviewing / completed ── */
  const [infoPhase, setInfoPhase] = useState<'collecting' | 'reviewing' | 'completed'>('collecting');
  const [showStageBar, setShowStageBar] = useState(false);
  const [infoRounds, setInfoRounds] = useState(0);
  const [transitionTriggered, setTransitionTriggered] = useState(false);

  /* ── Review state ── */
  const [stage, setStage] = useState<ReviewStage>('greeting');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [thinking, setThinking] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [emotionScore, setEmotionScore] = useState(0);
  const [showEmotion, setShowEmotion] = useState(false);
  const [courageValue, setCourageValue] = useState(0);
  const [courageMessage, setCourageMessage] = useState('');
  const [sopGenerated, setSopGenerated] = useState(false);

  /* ── Gentle persistence ── */
  const [gentlePersistenceUsed, setGentlePersistenceUsed] = useState(false);
  const [reviewAllowedSkip, setReviewAllowedSkip] = useState(false);

  /* ── Voice: 腾讯云 ASR ── */
  const voice = useVoiceInput({
    mode: voiceMode,
    onResult: (text: string) => processUserInput(text, true),
    onError: (err) => alert(err),
  });

  /* ═══════════════════════════════════════════════
     Init — AI 生成初始问候
     ═══════════════════════════════════════════════ */

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const s = await reviewsApi.fetchTodayReviewStats();
        if (cancelled) return;

        if (s.total_tasks > 0 && s.completion_rate >= 100) {
          setInfoPhase('completed');
          setInitializing(false);
          return;
        }

        const phase: 'collecting' | 'reviewing' =
          (s.total_tasks > 0 && s.completion_rate < 100) ? 'reviewing' : 'collecting';

        setInfoPhase(phase);
        if (phase === 'reviewing') setShowStageBar(true);

        try {
          const result = await reviewsApi.reviewChat({
            message: '',
            phase,
            stage: 'greeting',
            context: [],
            info_rounds: 0,
            gentle_persistence_used: false,
          });
          if (!cancelled) {
            setMessages([{ key: nextKey(), role: 'assistant', type: 'text', text: result.reply, time: getTime() }]);
          }
        } catch {
          if (!cancelled) {
            const fallback = phase === 'collecting'
              ? '姐，晚上好~今天有什么收获想复盘的吗？'
              : '欢迎回来~上次我们聊到哪儿了？继续复盘吧！';
            setMessages([{ key: nextKey(), role: 'assistant', type: 'text', text: fallback, time: getTime() }]);
          }
        }
      } catch {
        if (!cancelled) {
          setInfoPhase('collecting');
          try {
            const result = await reviewsApi.reviewChat({
              message: '',
              phase: 'collecting',
              stage: 'greeting',
              context: [],
              info_rounds: 0,
              gentle_persistence_used: false,
            });
            if (!cancelled)
              setMessages([{ key: nextKey(), role: 'assistant', type: 'text', text: result.reply, time: getTime() }]);
          } catch {
            if (!cancelled)
              setMessages([{ key: nextKey(), role: 'assistant', type: 'text', text: '姐，晚上好~今天有什么收获想复盘的吗？', time: getTime() }]);
          }
        }
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onFocus = () => {
      const saved = localStorage.getItem('er_voiceMode') as VoiceMode | null;
      if (saved === 'hold' || saved === 'click') setVoiceMode(saved);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  /* ── Scroll ── */
  const scrollBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 80);
  }, []);
  useEffect(() => { scrollBottom(); }, [messages, thinking, showEmotion, voice.voiceUIActive, initializing, scrollBottom]);

  /* ═══════════════════════════════════════════════
     Core: process user input → AI 生成回复
     ═══════════════════════════════════════════════ */

  const processUserInput = useCallback(async (text: string, isVoice = false) => {
    setThinking(true);
    const time = getTime();
    const userMsg: ChatMessage = { key: nextKey(), role: 'user', type: isVoice ? 'voice' : 'text', text, time };

    setMessages(prev => [...prev, userMsg]);

    try {
      const currentMessages = [...messages, userMsg];
      const context = buildContext(currentMessages);

      const phase = infoPhase === 'collecting' ? 'collecting' as const : 'reviewing' as const;
      const isRefusal = detectRefusal(text);

      const result = await reviewsApi.reviewChat({
        message: text,
        phase,
        stage,
        context,
        info_rounds: infoRounds,
        gentle_persistence_used: gentlePersistenceUsed,
      });

      const aiMsg: ChatMessage = { key: nextKey(), role: 'assistant', type: 'text', text: result.reply, time: getTime() };
      setMessages(prev => [...prev, aiMsg]);

      if (infoPhase === 'collecting') {
        const newRounds = infoRounds + 1;
        setInfoRounds(newRounds);

        const userTexts = currentMessages.filter(m => m.role === 'user').map(m => m.text);
        if (shouldAdvanceToReview(userTexts, newRounds * 2) && !transitionTriggered) {
          setTransitionTriggered(true);
          setInfoPhase('reviewing');
          setShowStageBar(true);
          setStage('greeting');

          setTimeout(async () => {
            try {
              const ctx2 = buildContext([...currentMessages, aiMsg]);
              const tResult = await reviewsApi.reviewChat({
                message: '',
                phase: 'reviewing',
                stage: 'greeting',
                context: ctx2,
                info_rounds: newRounds,
                gentle_persistence_used: false,
              });
              setMessages(prev2 => [...prev2, {
                key: nextKey(), role: 'assistant', type: 'text',
                text: tResult.reply, time: getTime(),
              }]);
            } catch {
              setMessages(prev2 => [...prev2, {
                key: nextKey(), role: 'assistant', type: 'text',
                text: '好的，我大概了解今天的情况了，我们来做一个系统的复盘吧~\n晚上好！今天过得怎么样？完成了哪些事情呢？',
                time: getTime(),
              }]);
            }
          }, 600);
        }
      } else {
        if (isRefusal && stage === 'greeting') {
          if (!gentlePersistenceUsed) {
            setGentlePersistenceUsed(true);
          } else {
            setReviewAllowedSkip(true);
            setThinking(false);
            return;
          }
        }

        if (!isRefusal || gentlePersistenceUsed) {
          try {
            const ctx3 = buildContext([...currentMessages, aiMsg]);
            await reviewsApi.saveReviewMessage({
              stage,
              messages: ctx3,
              emotion_score: emotionScore,
              courage_value: courageValue,
            });
          } catch { /* silent */ }
        }

        if (!isRefusal || gentlePersistenceUsed) {
          const next = STAGE_TRANSITIONS[stage];
          if (next) {
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

            setTimeout(async () => {
              try {
                const ctx4 = buildContext([...currentMessages, aiMsg]);
                const sResult = await reviewsApi.reviewChat({
                  message: '',
                  phase: 'reviewing',
                  stage: next,
                  context: ctx4,
                  info_rounds: infoRounds,
                  gentle_persistence_used: gentlePersistenceUsed,
                });
                setMessages(prev2 => [...prev2, {
                  key: nextKey(), role: 'assistant', type: 'text',
                  text: sResult.reply, time: getTime(),
                }]);
              } catch {
                // 降级：无下一阶段引导语也OK
              }
            }, 600);
          }
        }
      }
    } catch {
      setMessages(prev => [...prev, {
        key: nextKey(), role: 'assistant', type: 'text',
        text: '姐，小耕正在努力思考中，稍等一下哦～',
        time: getTime(),
      }]);
    } finally {
      setThinking(false);
    }
  }, [messages, infoPhase, infoRounds, transitionTriggered, stage, gentlePersistenceUsed, emotionScore, courageValue, showEmotion, sopGenerated]);

  /* ── Send ── */
  const handleSendText = useCallback(() => {
    const text = inputText.trim();
    if (!text || thinking) return;
    setInputText('');
    processUserInput(text);
  }, [inputText, thinking, processUserInput]);

  /* ── Voice UI ── */
  const showVoiceUI = () => { voice.setVoiceUIActive(true); inputRef.current?.blur(); };

  const handleMicSendClick = () => {
    if (inputText.trim()) { handleSendText(); }
    else if (!voice.isRecording) { showVoiceUI(); }
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
          暮有复盘
        </span>
        <button className="mp-header-btn" onClick={handleGoSettings}>
          <Icon icon="mingcute:settings-3-fill" style={{ fontSize: '24px' }} />
        </button>
      </header>

      {/* Chat Area */}
      <main className="mp-main-scroll" ref={scrollRef} style={{ padding: '16px' }}>
        {/* Brand */}
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

        {/* ── 初始加载状态 ── */}
        {initializing && messages.length === 0 && (
          <div className="mp-thinking">
            <Icon icon="mingcute:loading-line" style={{ fontSize: '16px', animation: 'spin 1s linear infinite' }} />
            <span>小耕正在准备...</span>
          </div>
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
            onFocus={() => voice.setVoiceUIActive(false)}
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
      {voice.voiceUIActive && (
        <div className="mp-voice-zone">
          <div className="mp-voice-hint">
            {voiceMode === 'hold' ? '按住说话，松手发送' : '点击说话，再点一下发送'}
          </div>
          <div className="mp-voice-cancel-row">
            {voice.isRecording && (
              <button
                className={`mp-voice-cancel-pill ${voice.cancelZone ? 'mp-voice-cancel-pill--active' : ''}`}
                onClick={(e) => { e.stopPropagation(); voice.cancelRecording(); }}
              >取消</button>
            )}
          </div>
          <div
            className={`mp-voice-large-btn ${voice.isRecording ? 'mp-voice-large-btn--recording' : ''}`}
            onPointerDown={voice.handlePointerDown} onPointerUp={voice.handlePointerUp}
            onPointerMove={voice.handlePointerMove} onClick={voice.handleClick}
          >
            {!voice.isRecording && (<><div className="mp-voice-pulse-ring" /><div className="mp-voice-pulse-ring" /></>)}
            <Icon icon="mingcute:mic-fill" style={{ fontSize: '30px', color: '#fff', position: 'relative', zIndex: 10 }} />
          </div>
          {voice.isRecording && <div className="mp-voice-timer">{voice.formatTime(voice.recordingTime)}</div>}
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
