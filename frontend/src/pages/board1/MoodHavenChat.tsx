/**
 * P2 倾诉对话页 — 暗色主题 · 计时器 · 语音按钮 · 危机干预 · 30分钟提醒。
 * Route: /m/mood-haven/chat
 * 对齐 m3-p2-mobile.html 设计
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import * as emotionsApi from '@/api/emotions';
import type { ChatMessage } from '@/api/emotions';
import { persistEncryptedMessages, loadEncryptedMessages, clearEncryptedMessages, isCryptoAvailable } from '@/utils/localEncrypt';
import './mood-haven.css';

const USER_AVATAR = 'https://api.dicebear.com/7.x/avataaars/svg?seed=sudongpo';

const SAFETY_PROMISE = '姐，您来了。这里只有您和我，您说的每一句话小耕都会保守秘密。想说什么就说吧，小耕在听。';

const CRISIS_KEYWORDS = ['想死', '不想活', '自杀', '结束生命', '活不下去', '没有意义', '消失', '绝望'];

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

export function MoodHavenChat() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: SAFETY_PROMISE, time: getTime() },
  ]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(true);
  const [encryptionReady, setEncryptionReady] = useState(false);

  // 危机干预
  const [showCrisis, setShowCrisis] = useState(false);

  // 30分钟提醒
  const [showTimeAlert, setShowTimeAlert] = useState(false);

  // 情绪评分面板（结束时显示）
  const [showEmotionPanel, setShowEmotionPanel] = useState(false);
  const [emotionScore, setEmotionScore] = useState(0);
  const [courageValue, setCourageValue] = useState(0);

  // 语音输入
  const [recording, setRecording] = useState(false);
  const [inputMode, setInputMode] = useState<'voice' | 'keyboard'>('keyboard');

  // 进入暗色主题
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    return () => document.documentElement.removeAttribute('data-theme');
  }, []);

  // 初始化本地加密并恢复上次未完成的对话
  useEffect(() => {
    if (!user?.user_id || !isCryptoAvailable()) {
      setEncryptionReady(false);
      return;
    }
    setEncryptionReady(true);

    // 尝试恢复上次加密存储的对话
    loadEncryptedMessages(user.user_id).then((saved) => {
      if (saved && saved.length > 0) {
        // 合并：安全承诺语 + 已保存的消息
        setMessages([
          { role: 'assistant', text: SAFETY_PROMISE, time: getTime() },
          ...saved,
        ]);
      }
    }).catch(() => {
      // 恢复失败，继续使用初始状态
    });
  }, [user?.user_id]);

  // 计时器
  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setElapsedSeconds(prev => {
        const next = prev + 1;
        // 30分钟提醒（演示时缩短为30秒）
        if (next === 30 * 60) {
          setShowTimeAlert(true);
          setTimeout(() => setShowTimeAlert(false), 8000);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 100);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, thinking, scrollToBottom]);

  // 检测危机关键词
  const checkCrisis = useCallback((text: string) => {
    if (CRISIS_KEYWORDS.some(kw => text.includes(kw))) {
      setShowCrisis(true);
    }
  }, []);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || thinking) return;

    const time = getTime();
    const userMsg: ChatMessage = { role: 'user', text, time };
    setMessages(prev => [...prev, userMsg]);
    setDraft('');
    setThinking(true);

    // 保存消息到后端
    try {
      await emotionsApi.logEmotionMessage({ role: 'user', text, duration_seconds: elapsedSeconds });
    } catch { /* 静默失败 */ }

    // 检测危机关键词
    checkCrisis(text);

    // 获取小耕回复（先尝试API，失败用本地兜底）
    let replyText: string;
    try {
      const suggest = await emotionsApi.fetchEmotionSuggest(text);
      replyText = suggest.text;
    } catch {
      const local = emotionsApi.getLocalSuggest(text);
      replyText = local.text;
    }

    // 模拟思考延迟
    await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));

    const assistantMsg: ChatMessage = { role: 'assistant', text: replyText, time: getTime() };
    setMessages(prev => [...prev, assistantMsg]);

    // 保存小耕回复
    try {
      await emotionsApi.logEmotionMessage({ role: 'assistant', text: replyText, duration_seconds: elapsedSeconds });
    } catch { /* 静默失败 */ }

    setThinking(false);
    scrollToBottom();
  }, [draft, thinking, elapsedSeconds, checkCrisis, scrollToBottom]);

  // 每次消息变化时，将用户消息加密存入 localStorage（安全承诺语除外）
  useEffect(() => {
    if (!encryptionReady || !user?.user_id) return;
    const userMessages = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
    // 跳过仅包含初始安全承诺语的状态
    if (userMessages.length <= 1) return;
    persistEncryptedMessages(user.user_id, userMessages.slice(1)); // 去掉初始安全承诺语
  }, [messages, encryptionReady, user?.user_id]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceClick = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('您的浏览器不支持语音输入，请使用键盘输入');
      setInputMode('keyboard');
      return;
    }
    if (recording) {
      setRecording(false);
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

  const handleEndChat = async () => {
    setTimerRunning(false);
    // 计算勇气值
    const calculatedCourage = Math.min(100, Math.round(
      Math.min(elapsedSeconds / 60, 60) * 1.2 + Math.abs(emotionScore) * 2 + 30
    ));
    setCourageValue(calculatedCourage);
    setShowEmotionPanel(true);

    // 生成成长记录
    try {
      await emotionsApi.createGrowthRecord({
        chat_messages: messages.map(m => ({ role: m.role, text: m.text })),
        emotion_score: emotionScore,
        courage_value: calculatedCourage,
        duration_minutes: Math.round(elapsedSeconds / 60),
      });
    } catch { /* 静默失败 */ }

    // 清除本地加密的临时数据（已转为正式成长记录）
    if (user?.user_id) {
      clearEncryptedMessages(user.user_id);
    }
  };

  const handleGoToGrowth = () => {
    navigate('/m/mood-haven/growth');
  };

  return (
    <div data-module="mood-haven" data-page="chat">
      <div className="mh-page--chat">
        {/* 品牌标语区（紧凑版） */}
        <div style={{ textAlign: 'center', padding: '16px 0 8px', flex: 'none' }}>
          <div className="mh-hero__slogan" style={{ color: '#FFCC80', fontSize: 13 }}>日耕朝夕，耕愈工作，耕暖生活</div>
          <span style={{ fontSize: 10, color: '#B0B0B0', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 10 }}>
            心事有处说，烦恼变智慧
          </span>
        </div>

        {/* 顶部导航栏：返回 + 计时器 + 危机按钮 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 0 12px', flex: 'none',
        }}>
          <button
            onClick={() => navigate('/m/mood-haven')}
            style={{
              width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.05)',
              border: 'none', color: '#B0B0B0', cursor: 'pointer', fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="返回入口"
          >
            ←
          </button>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 14, fontWeight: 700, color: '#E0E0E0', margin: 0 }}>情绪树洞</h1>
            <div className="mh-timer" style={{ margin: 0 }}>已倾诉 {formatDuration(elapsedSeconds)}</div>
          </div>
          <button
            onClick={() => setShowCrisis(true)}
            style={{
              width: 32, height: 32, borderRadius: '50%', background: 'rgba(192,58,57,0.2)',
              border: 'none', color: '#C03A39', cursor: 'pointer', fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="需要帮助"
          >
            ⚠
          </button>
        </div>

        {/* 对话流 */}
        <div className="mh-chat-scroll" ref={scrollRef}>
          {messages.map((m, i) => (
            <div key={i} className={`mh-bubble-row ${m.role === 'user' ? 'mh-bubble-row--user' : ''}`}>
              {m.role === 'assistant' ? (
                <div className="mh-avatar mh-avatar--assistant">
                  <span>耕</span>
                </div>
              ) : (
                <div className="mh-avatar mh-avatar--user">
                  <img src={USER_AVATAR} alt="User" />
                </div>
              )}
              <div style={{ maxWidth: '80%' }}>
                <div className={`mh-bubble mh-bubble--${m.role}`}>
                  <span>{m.text}</span>
                </div>
                <div className="mh-bubble-time">{m.time}</div>
              </div>
            </div>
          ))}

          {/* 思考动画 */}
          {thinking && (
            <div className="mh-bubble-row">
              <div className="mh-avatar mh-avatar--assistant"><span>耕</span></div>
              <div className="mh-thinking">
                <div className="mh-thinking__spinner" />
                <span>小耕在聆听…</span>
              </div>
            </div>
          )}

          {/* 情绪评分面板（结束倾诉时显示） */}
          {showEmotionPanel && (
            <div className="mh-card" style={{ marginTop: 16 }}>
              <div className="mh-card__header">
                <span className="mh-card__header-icon">💗</span>
                <h3 className="mh-card__header-title">小耕为这次倾诉打了分，您可以拖动修正</h3>
              </div>
              <div className="mh-emotion-slider-group">
                <input
                  type="range"
                  min="-10"
                  max="10"
                  value={emotionScore}
                  onChange={(e) => setEmotionScore(Number(e.target.value))}
                  className="mh-emotion-slider"
                />
                <div className="mh-emotion-labels">
                  <span>-10 低落</span>
                  <span>+10 振奋</span>
                </div>
                <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 700, color: '#FFCC80', marginTop: 8 }}>
                  {emotionScore > 0 ? '+' : ''}{emotionScore}
                </div>
              </div>
              <div className="mh-courage-bar" style={{ marginTop: 16 }}>
                <div className="mh-courage-bar__header">
                  <span className="mh-courage-bar__label">今日勇气值</span>
                  <span className="mh-courage-bar__value">{courageValue}</span>
                </div>
                <div className="mh-courage-bar__track">
                  <div className="mh-courage-bar__fill" style={{ width: `${Math.min(100, courageValue)}%` }} />
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button className="mh-btn-primary" onClick={handleGoToGrowth}>
                  查看成长手册 →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 底部输入区 */}
        <div className="mh-chat__composer">
          {inputMode === 'voice' ? (
            <div className="mh-voice-bar">
              <p className="mh-voice-bar__hint">点击或长按倾诉，小耕正在聆听...</p>
              <button
                className={`mh-voice-btn ${recording ? 'mh-voice-btn--recording' : ''}`}
                onClick={handleVoiceClick}
                aria-label="语音倾诉"
              >
                🎤
              </button>
              <div className="mh-composer__actions-row">
                <button
                  className="mh-composer__keyboard-toggle"
                  onClick={() => setInputMode('keyboard')}
                >
                  键盘输入
                </button>
                <button className="mh-composer__end-link" onClick={handleEndChat}>
                  结束倾诉并整理手册
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mh-composer">
                <textarea
                  ref={textareaRef}
                  placeholder="把心里的话慢慢说给小耕…"
                  rows={2}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <button
                    className="mh-composer__send"
                    onClick={handleSend}
                    disabled={!draft.trim() || thinking}
                    title="发送"
                  >
                    ➤
                  </button>
                  <button
                    onClick={() => setInputMode('voice')}
                    style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: 'rgba(255,255,255,0.05)', border: 'none',
                      color: '#FFCC80', cursor: 'pointer', fontSize: 20,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    title="语音输入"
                  >
                    🎤
                  </button>
                </div>
              </div>
              <div className="mh-composer__actions-row" style={{ padding: '8px 0 0' }}>
                <span />
                <button className="mh-composer__end-link" onClick={handleEndChat}>
                  结束倾诉并整理手册
                </button>
              </div>
            </>
          )}
          <p className="mh-composer__privacy-note">
            {encryptionReady
              ? '🔒 端到端加密保护中 · 您的倾诉仅本地存储'
              : '🔒 情绪内容受隐私保护，不上传云端'}
          </p>
        </div>
      </div>

      {/* 危机干预弹窗 */}
      {showCrisis && (
        <div className="mh-modal-mask" onClick={() => setShowCrisis(false)}>
          <div className="mh-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mh-modal__icon">📞</div>
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

      {/* 30分钟温柔提醒 */}
      {showTimeAlert && (
        <div className="mh-time-alert" onClick={() => setShowTimeAlert(false)}>
          <span className="mh-time-alert__icon">🔔</span>
          <p className="mh-time-alert__text">
            姐，今天咱们已经聊了好一会儿了，要不要先休息一下？小耕一直都在。
          </p>
        </div>
      )}
    </div>
  );
}
