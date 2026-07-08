/**
 * P2 对话复盘页 — PC端（对齐 m2-p2.html 单栏居中设计）。
 * Route: /m/evening-review/chat
 *
 * 布局：单栏居中 680px，五阶段进度指示器可点击跳阶段，键盘优先（Enter发送）。
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  detectRefusal,
  pickReply,
  getTime,
  getCourageMessage,
} from '@/shared/components/features/evening-review';
import './evening-review.css';

interface ChatMessage {
  role: 'assistant' | 'user';
  text: string;
  time?: string;
}

const USER_AVATAR = 'https://api.dicebear.com/7.x/avataaars/svg?seed=sudongpo';

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
  const [sopGenerated, setSopGenerated] = useState(false);
  const [gentlePersistenceUsed, setGentlePersistenceUsed] = useState(false);
  const [reviewAllowedSkip, setReviewAllowedSkip] = useState(false);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 100);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, thinking, showEmotion, scrollToBottom]);
  useEffect(() => { textareaRef.current?.focus(); }, []);

  const jumpToStage = (targetStage: ReviewStage, _targetIndex: number) => {
    if (targetStage && targetStage !== stage) {
      setStage(targetStage);
      setMessages(prev => [...prev, { role: 'assistant', text: STAGE_PROMPTS[targetStage], time: getTime() }]);
    }
  };

  const advanceStage = useCallback(async (currentStage: ReviewStage) => {
    const next = STAGE_TRANSITIONS[currentStage];
    if (!next) return;

    try {
      const result = await reviewsApi.saveReviewMessage({
        stage: currentStage,
        messages: messages.map(m => ({ role: m.role, text: m.text })),
        emotion_score: emotionScore,
        courage_value: courageValue,
      });

      const gp = (result as any)?.gentle_persistence;
      if (gp?.triggered) {
        setGentlePersistenceUsed(true);
        if (gp.allow_skip) {
          setReviewAllowedSkip(true);
          setMessages(prev => [...prev, { role: 'assistant', text: gp.reply, time: getTime() }]);
          return;
        }
        setMessages(prev => [...prev, { role: 'assistant', text: gp.reply, time: getTime() }]);
      }
    } catch { /* 静默失败 */ }

    if (next === 'extraction' && !showEmotion) setShowEmotion(true);

    if (next === 'improvement') {
      const newCourage = Math.min(100, Math.max(10, Math.round(emotionScore * 3 + 50)));
      setCourageValue(newCourage);
      setCourageMessage(getCourageMessage(newCourage, COURAGE_MESSAGES));
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
      } catch { /* 静默失败 */ }
    }

    setStage(next);
    setMessages(prev => [...prev, { role: 'assistant', text: STAGE_PROMPTS[next], time: getTime() }]);
  }, [messages, emotionScore, courageValue, showEmotion, sopGenerated]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || thinking) return;

    const time = getTime();
    const userMsg: ChatMessage = { role: 'user', text, time };
    setMessages(prev => [...prev, userMsg]);
    setDraft('');
    setThinking(true);

    const isRefusal = detectRefusal(text) && stage === 'greeting';
    await new Promise(r => setTimeout(r, 800 + Math.random() * 800));

    let reply = '';
    const currentStage = stage;

    if (isRefusal && gentlePersistenceUsed) {
      reply = '好的，今天先休息吧 🌙 小耕尊重你的选择。如果想复盘，随时可以回来~';
      setReviewAllowedSkip(true);
    } else if (isRefusal && !gentlePersistenceUsed) {
      setGentlePersistenceUsed(true);
      if (text.includes('累')) {
        reply = '我知道你今天很累 💙 但正是累的时候，才更需要花3分钟做个简单回顾。不用写太多，就告诉我今天最重要的一个收获就好~';
      } else if (text.includes('时间') || text.includes('没空')) {
        reply = '明白你很忙 ⏰ 不过复盘只需要3分钟，把今天的经验沉淀下来，明天就能直接用。简单说一句今天学了什么也行~';
      } else {
        reply = '没关系，我们可以简单一点 🌙 复盘不一定要很正式，就告诉我今天最有价值的一个发现就好~';
      }
    } else {
      reply = pickReply(currentStage);
    }

    setMessages(prev => [...prev, { role: 'assistant', text: reply, time: getTime() }]);
    setThinking(false);

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

  const handleSkip = () => navigate('/m/evening-review');
  const handleGoToReport = () => navigate('/m/evening-review/report');

  return (
    <div data-module="evening-review">
      {/* 单栏居中布局，对齐 m2-p2.html */}
      <div className="er-page--chat" style={{ height: 'calc(100vh - 80px)' }}>
        {/* 品牌标语区 L1 */}
        <div style={{ textAlign: 'center', padding: '16px 0 8px', flex: 'none' }}>
          <div className="er-hero__slogan" style={{ marginBottom: 4 }}>日耕朝夕，耕愈工作，耕暖生活</div>
          <div className="er-hero__title--small" style={{ fontWeight: 700 }}>睡前做复盘，经验变方法</div>
        </div>

        {/* 五阶段进度指示器（可点击） */}
        <ReviewStageBar
          currentStage={stage}
          clickable
          onStageClick={jumpToStage}
        />

        {/* 对话流 */}
        <div className="er-chat" style={{ flex: 1, minHeight: 0 }}>
          <div className="er-chat__scroll" ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} className={`er-bubble-row ${m.role === 'user' ? 'er-bubble-row--user' : ''}`}>
                {m.role === 'assistant' ? (
                  <div className="er-avatar er-avatar--assistant"><span>耕</span></div>
                ) : (
                  <div className="er-avatar er-avatar--user"><img src={USER_AVATAR} alt="User" /></div>
                )}
                <div style={{ maxWidth: '75%' }}>
                  <div className={`er-bubble er-bubble--${m.role}`}>
                    <span style={{ whiteSpace: 'pre-line' }}>{m.text}</span>
                  </div>
                  <div className="er-bubble-time" style={m.role === 'user' ? { textAlign: 'right' } : {}}>{m.time}</div>
                </div>
              </div>
            ))}
            {thinking && (
              <div className="er-bubble-row">
                <div className="er-avatar er-avatar--assistant"><span>耕</span></div>
                <div className="er-thinking">
                  <div className="er-thinking__spinner" />
                  <span>小耕在整理思路…</span>
                </div>
              </div>
            )}
            {gentlePersistenceUsed && !reviewAllowedSkip && (
              <div style={{ textAlign: 'center', padding: '10px 20px', marginTop: 12, background: '#FFF3E0', borderRadius: 8, fontSize: 12, color: '#E65100' }}>
                💡 小耕正在温柔地鼓励你完成今天的复盘~
              </div>
            )}
            {reviewAllowedSkip && (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button className="er-btn-outline" onClick={handleSkip} style={{ width: 'auto', padding: '10px 32px' }}>今天先跳过 →</button>
              </div>
            )}
            {showEmotion && stage === 'extraction' && (
              <EmotionSlider value={emotionScore} onChange={setEmotionScore} />
            )}
            {courageValue > 0 && stage === 'improvement' && (
              <CourageDisplay value={courageValue} message={courageMessage} />
            )}
          </div>

          {/* 底部输入区 */}
          <div className="er-chat__composer">
            <div className="er-composer">
              <textarea
                ref={textareaRef}
                placeholder={reviewAllowedSkip ? '输入你的复盘，或点击下方跳过…' : '输入你的复盘…（Enter发送）'}
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={reviewAllowedSkip}
              />
              <div className="er-composer__actions">
                <button className="er-composer__send" onClick={handleSend}
                  disabled={(!draft.trim() && !reviewAllowedSkip) || thinking || reviewAllowedSkip} title="发送 (Enter)">➤</button>
              </div>
            </div>
            {stage === 'archive' && (
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <button className="er-btn-primary" onClick={handleGoToReport}>查看复盘报告 →</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
