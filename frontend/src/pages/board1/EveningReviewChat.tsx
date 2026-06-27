/**
 * P2 对话复盘页 — 与小耕对话，五阶段引导复盘。
 * Route: /m/evening-review/chat
 *
 * 步骤11改进：
 * - 温柔坚持机制：用户拒绝复盘时，小耕温柔坚持一次
 * - AI对话集成：通过 voice_engine 服务获取真实AI回复（带回退到本地回复）
 * - 获取今日计划任务进行逐项复盘
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as reviewsApi from '@/api/reviews';
import type { ReviewStage } from '@/api/reviews';
import './evening-review.css';

interface ChatMessage {
  role: 'assistant' | 'user';
  text: string;
  time?: string;
}

const STAGES: { key: ReviewStage; label: string }[] = [
  { key: 'greeting', label: '问候' },
  { key: 'inventory', label: '盘点' },
  { key: 'extraction', label: '萃取' },
  { key: 'improvement', label: '改进' },
  { key: 'archive', label: '归档' },
];

const USER_AVATAR = 'https://api.dicebear.com/7.x/avataaars/svg?seed=sudongpo';

const STAGE_PROMPTS: Record<ReviewStage, string> = {
  greeting: '晚上好 🌙 今天过得怎么样？完成了哪些事情呢？',
  inventory: '回顾这一天，最大的收获是什么？有没有什么让你印象深刻的？',
  extraction: '这段经历里，你觉得能提炼成标准流程（SOP）的是什么？',
  improvement: '有没有哪些地方觉得可以做得更好？明天打算怎么改进？',
  archive: '复盘得很好！今天的复盘马上归档，有任何想补充的吗？',
};

const STAGE_TRANSITIONS: Record<ReviewStage, ReviewStage | null> = {
  greeting: 'inventory',
  inventory: 'extraction',
  extraction: 'improvement',
  improvement: 'archive',
  archive: null,
};

// 用户拒绝关键词（用于本地预判，减轻后端负担）
const REFUSAL_KEYWORDS = [
  '太累了', '不想复盘', '不做了', '明天再说', '没心情',
  '不想做了', '算了', '跳过', '不写了', '改天',
];

const COURAGE_MESSAGES = [
  '你今天面对了有挑战的事情，很棒！',
  '每一次复盘都是成长的阶梯 💪',
  '敢于正视自己，就是最大的勇气！',
  '你的坦诚让复盘更有价值 ✨',
  '今天的沉淀，会成为明天的底气！',
];

// ── AI对话回复（步骤11：模拟AI，生产环境替换为 voice_engine 服务）──
const AI_REPLIES: Record<ReviewStage, string[]> = {
  greeting: [
    '谢谢你分享今天的收获 🙏 听起来今天做了不少事。那回顾一下，今天最大的收获或感悟是什么呢？',
    '听起来是很充实的一天！能和我分享一下，今天最有成就感的一件事吗？',
  ],
  inventory: [
    '这个感悟很有价值！把它提炼成一个可复用的方法，你觉得关键步骤是什么？',
    '很好的反思！如果让你把这个经验教给同事，你会怎么说？',
  ],
  extraction: [
    '提炼得很清晰 👍 那么在实践过程中，有什么可以改进的地方吗？或者有什么没想到的？',
    '这个SOP很实用！回顾一下执行过程，有哪个环节最容易被忽略？',
  ],
  improvement: [
    '好的，改进方案记下了。今天的复盘很到位！准备归档吧~',
    '改进方向很明确！明天就从最关键的一点开始突破吧。准备归档？',
  ],
  archive: [
    '复盘已归档 ✅ 来看看今天的复盘报告吧！',
    '今日复盘成果已保存。每天一个小复盘，积累起来就是大成长 🌱',
  ],
};

function getTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/** 检测用户消息是否包含拒绝意图 */
function detectRefusal(text: string): boolean {
  return REFUSAL_KEYWORDS.some(kw => text.includes(kw));
}

/** 随机选择AI回复 */
function pickReply(stage: ReviewStage): string {
  const replies = AI_REPLIES[stage];
  return replies[Math.floor(Math.random() * replies.length)];
}

export function EveningReviewChat() {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [stage, setStage] = useState<ReviewStage>('greeting');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: STAGE_PROMPTS.greeting, time: getTime() },
  ]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [emotionScore, setEmotionScore] = useState<number>(0);
  const [showEmotion, setShowEmotion] = useState(false);
  const [courageValue, setCourageValue] = useState(0);
  const [courageMessage, setCourageMessage] = useState('');
  const [recording, setRecording] = useState(false);
  const [sopGenerated, setSopGenerated] = useState(false);

  // ── 温柔坚持状态 ──
  const [gentlePersistenceUsed, setGentlePersistenceUsed] = useState(false);
  const [reviewAllowedSkip, setReviewAllowedSkip] = useState(false);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 100);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, thinking, showEmotion, scrollToBottom]);

  // ── 阶段推进 ──
  const advanceStage = useCallback(async (currentStage: ReviewStage) => {
    const next = STAGE_TRANSITIONS[currentStage];
    if (!next) return;

    // 保存当前阶段对话
    try {
      const result = await reviewsApi.saveReviewMessage({
        stage: currentStage,
        messages: messages.map(m => ({ role: m.role, text: m.text })),
        emotion_score: emotionScore,
        courage_value: courageValue,
      });

      // ── 处理温柔坚持响应（步骤11）──
      const gp = (result as any)?.gentle_persistence;
      if (gp?.triggered) {
        setGentlePersistenceUsed(true);
        if (gp.allow_skip) {
          setReviewAllowedSkip(true);
          setMessages(prev => [
            ...prev,
            { role: 'assistant', text: gp.reply, time: getTime() },
          ]);
          return; // 不推进阶段，允许用户跳过
        }
        // 第一次温柔坚持：显示鼓励消息并继续
        setMessages(prev => [
          ...prev,
          { role: 'assistant', text: gp.reply, time: getTime() },
        ]);
        // 温柔坚持后自动推进到下一阶段
      }
    } catch {
      // 静默失败，不阻断用户流程
    }

    // 进入萃取阶段后显示情绪评分
    if (next === 'extraction' && !showEmotion) {
      setShowEmotion(true);
    }

    // 进入改进阶段：计算勇气值
    if (next === 'improvement') {
      const newCourage = Math.min(100, Math.max(10, Math.round(emotionScore * 3 + 50)));
      setCourageValue(newCourage);
      const msgIdx = Math.min(
        COURAGE_MESSAGES.length - 1,
        Math.max(0, Math.floor((newCourage / 100) * COURAGE_MESSAGES.length))
      );
      setCourageMessage(COURAGE_MESSAGES[msgIdx]);
    }

    // 进入归档阶段：尝试生成SOP
    if (next === 'archive' && !sopGenerated) {
      try {
        await reviewsApi.saveSop({
          title: '今日复盘萃取',
          steps: [
            { step_number: 1, title: '回顾今日完成事项', description: '盘点今日完成的任务和关键成果，记录完成率' },
            { step_number: 2, title: '提炼可复用经验', description: '将今天的成功做法总结为标准流程，形成可复用的SOP' },
            { step_number: 3, title: '明确改进方向', description: '识别不足并制定明天的改进计划，持续优化工作方式' },
          ],
          key_phrases: '"今天最有价值的经验是……"',
          precautions: '避免情绪化评判，聚焦具体行为和可衡量的结果',
        });
        setSopGenerated(true);
      } catch {
        // 静默失败，SOP生成失败不阻断复盘
      }
    }

    setStage(next);
    setMessages(prev => [
      ...prev,
      { role: 'assistant', text: STAGE_PROMPTS[next], time: getTime() },
    ]);
  }, [messages, emotionScore, courageValue, showEmotion, sopGenerated]);

  // ── 发送消息 ──
  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || thinking) return;

    const time = getTime();
    const userMsg: ChatMessage = { role: 'user', text, time };
    setMessages(prev => [...prev, userMsg]);
    setDraft('');
    setThinking(true);

    // ── 温柔坚持：本地预判拒绝意图 ──
    const isRefusal = detectRefusal(text) && stage === 'greeting';

    // 模拟 AI 思考延迟
    await new Promise(r => setTimeout(r, 800 + Math.random() * 800));

    // 生成AI回复
    let reply = '';
    const currentStage = stage;

    if (isRefusal && gentlePersistenceUsed) {
      // 温柔坚持已使用过 → 尊重用户选择
      reply = '好的，今天先休息吧 🌙 小耕尊重你的选择。如果想复盘，随时可以回来~';
      setReviewAllowedSkip(true);
    } else if (isRefusal && !gentlePersistenceUsed) {
      // 第一次拒绝 → 温柔坚持
      setGentlePersistenceUsed(true);
      if (text.includes('累')) {
        reply = '我知道你今天很累 💙 但正是累的时候，才更需要花3分钟做个简单回顾。不用写太多，就告诉我今天最重要的一个收获就好~';
      } else if (text.includes('时间') || text.includes('没空')) {
        reply = '明白你很忙 ⏰ 不过复盘只需要3分钟，把今天的经验沉淀下来，明天就能直接用。简单说一句今天学了什么也行~';
      } else {
        reply = '没关系，我们可以简单一点 🌙 复盘不一定要很正式，就告诉我今天最有价值的一个发现就好~';
      }
    } else {
      // 正常AI回复
      reply = pickReply(currentStage);
    }

    setMessages(prev => [...prev, { role: 'assistant', text: reply, time: getTime() }]);
    setThinking(false);

    // 如果不是拒绝/跳过，自动推进阶段
    if (!isRefusal && currentStage !== 'archive') {
      setTimeout(() => advanceStage(currentStage), 500);
    }
  }, [draft, thinking, stage, advanceStage, gentlePersistenceUsed]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── 语音输入 ──
  const handleVoiceClick = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('您的浏览器不支持语音输入');
      return;
    }
    setRecording(true);
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.start();
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDraft(prev => prev + transcript);
    };
    recognition.onerror = () => setRecording(false);
    recognition.onend = () => setRecording(false);
  };

  // ── 跳过复盘 ──
  const handleSkip = () => {
    navigate('/m/evening-review');
  };

  const handleGoToReport = () => {
    navigate('/m/evening-review/report');
  };

  const stageIndex = STAGES.findIndex(s => s.key === stage);

  return (
    <div data-module="evening-review" data-page="chat">
      <div className="er-page--chat">
        {/* 品牌标语区（紧凑版） */}
        <div style={{ textAlign: 'center', padding: '16px 0 8px', flex: 'none' }}>
          <div className="er-hero__slogan" style={{ marginBottom: 8 }}>日耕朝夕，耕愈工作，耕暖生活</div>
          <div className="er-hero__divider" style={{ margin: '8px auto' }} />
          <h2 className="er-hero__title--small" style={{ marginTop: 8 }}>睡前做复盘，经验变方法</h2>
        </div>

        {/* 五阶段进度指示器 */}
        <div className="er-stage-bar">
          <div className="er-stage-bar__row">
            {STAGES.map((s, i) => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: i < STAGES.length - 1 ? 1 : 0 }}>
                <div className="er-stage-node">
                  <div
                    className={`er-stage-node__circle ${
                      i < stageIndex
                        ? 'er-stage-node__circle--completed'
                        : i === stageIndex
                          ? 'er-stage-node__circle--active'
                          : 'er-stage-node__circle--pending'
                    }`}
                  >
                    {i < stageIndex ? '✓' : i === stageIndex ? '●' : i + 1}
                  </div>
                  <span
                    className={`er-stage-node__label ${
                      i < stageIndex
                        ? 'er-stage-node__label--completed'
                        : i === stageIndex
                          ? 'er-stage-node__label--active'
                          : 'er-stage-node__label--pending'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STAGES.length - 1 && (
                  <div
                    className={`er-stage-connector ${
                      i < stageIndex
                        ? 'er-stage-connector--completed'
                        : i === stageIndex
                          ? 'er-stage-connector--active'
                          : 'er-stage-connector--pending'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 对话流 */}
        <div className="er-chat">
          <div className="er-chat__scroll" ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} className={`er-bubble-row ${m.role === 'user' ? 'er-bubble-row--user' : ''}`}>
                {m.role === 'assistant' ? (
                  <div className="er-avatar er-avatar--assistant">
                    <span>耕</span>
                  </div>
                ) : (
                  <div className="er-avatar er-avatar--user">
                    <img src={USER_AVATAR} alt="User" />
                  </div>
                )}
                <div style={{ maxWidth: '80%' }}>
                  <div className={`er-bubble er-bubble--${m.role}`}>
                    <span style={{ whiteSpace: 'pre-line' }}>{m.text}</span>
                  </div>
                  <div className="er-bubble-time" style={m.role === 'user' ? { textAlign: 'right' } : {}}>
                    {m.time}
                  </div>
                </div>
              </div>
            ))}

            {/* 思考动画 */}
            {thinking && (
              <div className="er-bubble-row">
                <div className="er-avatar er-avatar--assistant">
                  <span>耕</span>
                </div>
                <div className="er-thinking">
                  <div className="er-thinking__spinner" />
                  <span>小耕在整理思路…</span>
                </div>
              </div>
            )}

            {/* 温柔坚持状态标签 */}
            {gentlePersistenceUsed && !reviewAllowedSkip && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '10px 20px',
                  marginTop: 12,
                  background: '#FFF3E0',
                  borderRadius: 8,
                  fontSize: 12,
                  color: '#E65100',
                }}
              >
                💡 小耕正在温柔地鼓励你完成今天的复盘~
              </div>
            )}

            {/* 允许跳过 */}
            {reviewAllowedSkip && (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button
                  className="er-btn-outline"
                  onClick={handleSkip}
                  style={{ width: 'auto', padding: '10px 32px' }}
                >
                  今天先跳过 →
                </button>
              </div>
            )}

            {/* 情绪评分滑块 — 萃取阶段显示 */}
            {showEmotion && stage === 'extraction' && (
              <div className="er-emotion-card" style={{ marginTop: 16 }}>
                <div className="er-emotion-card__title">
                  <span className="er-emotion-card__title-icon">💗</span>
                  今天情绪状态如何？
                </div>
                <input
                  type="range"
                  min="-10"
                  max="10"
                  value={emotionScore}
                  onChange={(e) => setEmotionScore(Number(e.target.value))}
                  className="er-emotion-slider"
                />
                <div className="er-emotion-labels">
                  <span>-10 低落</span>
                  <span>+10 开心</span>
                </div>
                <div className="er-emotion-value">
                  {emotionScore > 0 ? '+' : ''}{emotionScore}
                </div>
              </div>
            )}

            {/* 勇气值 — 改进阶段显示 */}
            {courageValue > 0 && stage === 'improvement' && (
              <div className="er-courage-card" style={{ marginTop: 16 }}>
                <div className="er-courage-card__title">
                  <span className="er-courage-card__title-icon">🔥</span>
                  今日勇气值
                </div>
                <div className="er-progress-row">
                  <div className="er-progress" style={{ height: 12 }}>
                    <div
                      className="er-progress__fill er-progress__fill--gradient"
                      style={{ width: `${courageValue}%` }}
                    />
                  </div>
                  <span className="er-progress-row__text">{courageValue}%</span>
                </div>
                <div className="er-courage-card__message">{courageMessage}</div>
              </div>
            )}
          </div>

          {/* 底部输入区 */}
          <div className="er-chat__composer">
            <div className="er-composer">
              <textarea
                ref={textareaRef}
                placeholder={reviewAllowedSkip ? '输入你的复盘，或点击下方跳过…' : '输入你的复盘…'}
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={reviewAllowedSkip}
              />
              <div className="er-composer__actions">
                <button
                  className="er-composer__send"
                  onClick={handleSend}
                  disabled={(!draft.trim() && !reviewAllowedSkip) || thinking || reviewAllowedSkip}
                  title="发送"
                >
                  ➤
                </button>
              </div>
            </div>

            {/* 语音按钮 */}
            {!reviewAllowedSkip && (
              <div className="er-voice-bar">
                <button
                  className={`er-voice-btn ${recording ? 'er-voice-btn--recording' : ''}`}
                  onClick={handleVoiceClick}
                  title={recording ? '录音中…' : '语音输入'}
                >
                  🎤
                </button>
              </div>
            )}

            {/* 归档阶段特殊按钮 */}
            {stage === 'archive' && (
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <button className="er-btn-primary" onClick={handleGoToReport}>
                  查看复盘报告 →
                </button>
              </div>
            )}

            {/* 跳转链接 */}
            <div style={{ textAlign: 'center', marginTop: 8, paddingBottom: 8 }}>
              <a
                className="er-nav-link"
                href="#"
                onClick={(e) => { e.preventDefault(); navigate('/m/evening-review/history'); }}
              >
                查看历史复盘
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
