/**
 * P2 智能问答对话页 — 三源引擎 + 四要素卡片 + 来源引用 + 追问 + 语音输入（腾讯云ASR）。
 * Route: /m/smart-qa/chat?q=...
 * 对齐 m5p2-mobile.html 设计。
 *
 * 跳转：点击"查看详情" → /m/smart-qa/detail?answerId=...&convId=...
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import {
  askQuestion,
  archiveAnswer,
  markHelpful,
  type SourceEngine,
  type QaAnswer,
} from '@/shared/api/smartQa';
import { useVoiceInput, type VoiceMode } from '@/shared/hooks/useVoiceInput';
import './smart-qa.css';

/* ── Types ── */

interface Message {
  key: string;
  role: 'assistant' | 'user';
  type: 'text' | 'voice';
  text: string;
  time: string;
  answer?: QaAnswer | null;
  /** P2-P3 跳转所需参数 */
  answerId?: string;
  convId?: string;
}

/* ── Helpers ── */
let _msgId = 0;
function nextId() { return `sqmsg_${Date.now()}_${++_msgId}`; }
function now() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ── Engine labels ── */
const ENGINE_META: Record<string, { icon: string; label: string; color: string }> = {
  private: { icon: 'mingcute:lock-line', label: '私有库', color: '#C03A39' },
  xiejun: { icon: 'mingcute:team-line', label: '携君库', color: '#E8A94D' },
  internet: { icon: 'mingcute:earth-line', label: '互联网', color: '#BCAAA4' },
};

/* ── Component ── */
export function SmartQaChat() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuestion = searchParams.get('q') || '';

  /* ── Engine state ── */
  const [engines, setEngines] = useState<SourceEngine[]>([
    { key: 'private', enabled: true },
    { key: 'xiejun', enabled: true },
    { key: 'internet', enabled: false },
  ]);

  /* ── Chat state ── */
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [helpfulClicked, setHelpfulClicked] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  /* ── Voice mode ── */
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(() => {
    const saved = localStorage.getItem('rg_voice_mode') as VoiceMode | null;
    return (saved === 'hold' || saved === 'click') ? saved : 'hold';
  });

  /* ── Refs ── */
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const askedRef = useRef(false);  // 防 StrictMode 双重调用
  const askingRef = useRef(false); // 防 handleAsk 重入

  /* ── Voice: 腾讯云 ASR ── */
  const voice = useVoiceInput({
    mode: voiceMode,
    onResult: (text: string) => handleAsk(text),
    onError: (err) => alert(err),
  });

  /* ── Init ── */
  useEffect(() => {
    // 初始欢迎消息
    setMessages([
      {
        key: nextId(),
        role: 'assistant',
        type: 'text',
        text: '你好！我是小耕，你的 HR 智能助手。有什么问题尽管问我~',
        time: now(),
      },
    ]);

    if (initialQuestion && !askedRef.current) {
      askedRef.current = true;
      handleAsk(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  const scrollBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 80);
  }, []);
  useEffect(() => { scrollBottom(); }, [messages, isThinking, voice.voiceUIActive, scrollBottom]);

  /* ═══════════════════════════════════════════════
     Engine Toggle
     ═══════════════════════════════════════════════ */

  const toggleEngine = (key: string) => {
    setEngines((prev) =>
      prev.map((e) => (e.key === key ? { ...e, enabled: !e.enabled } : e)),
    );
  };

  /* ═══════════════════════════════════════════════
     Ask API
     ═══════════════════════════════════════════════ */

  const handleAsk = async (q: string) => {
    if (!q.trim() || isThinking || askingRef.current) return;
    askingRef.current = true;
    setIsThinking(true);
    setSuggestions([]);
    setHelpfulClicked(false);
    const userText = q.trim();

    // 只有追问时才添加用户消息
    if (q !== initialQuestion || messages.length > 1) {
      setMessages((prev) => [
        ...prev,
        { key: nextId(), role: 'user', type: 'text', text: userText, time: now() },
      ]);
    }

    try {
      const engineConfig: SourceEngine[] = engines.map((e) => ({ ...e }));
      const result = await askQuestion(userText, conversationId, engineConfig);

      setConversationId(result.conversation_id);

      if (result.is_clarification) {
        setMessages((prev) => [
          ...prev,
          {
            key: nextId(),
            role: 'assistant',
            type: 'text',
            text: result.clarification_question || '能再具体说说吗？',
            time: now(),
          },
        ]);
        setSuggestions(result.suggestions || []);
      } else if (result.answer) {
        const answer = result.answer;
        setMessages((prev) => [
          ...prev,
          {
            key: nextId(),
            role: 'assistant',
            type: 'text',
            text: answer.intro,
            time: now(),
            answer,
            answerId: answer.id,
            convId: result.conversation_id,
          },
        ]);
        setSuggestions(result.suggestions || []);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            key: nextId(),
            role: 'assistant',
            type: 'text',
            text: '抱歉，暂时无法生成答案。请换个问题试试~',
            time: now(),
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          key: nextId(),
          role: 'assistant',
          type: 'text',
          text: err?.message || '网络请求失败，请检查网络后重试。',
          time: now(),
        },
      ]);
    } finally {
      setIsThinking(false);
      askingRef.current = false;
    }
  };

  /* ── Send text ── */
  const handleSend = () => {
    const q = inputValue.trim();
    if (!q || isThinking) return;
    setInputValue('');
    handleAsk(q);
  };

  /* ═══════════════════════════════════════════════
     Actions
     ═══════════════════════════════════════════════ */

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2000);
  };

  const handleArchive = async (answerId: string) => {
    try {
      const result = await archiveAnswer(answerId);
      if (result.success) showToast(`+${result.contribution_value} 贡献值`);
      else showToast('归档失败，请重试');
    } catch { showToast('归档失败，请重试'); }
  };

  const handleHelpful = async (answerId: string) => {
    if (helpfulClicked) return;
    try {
      await markHelpful(answerId);
      setHelpfulClicked(true);
      showToast('感谢反馈！');
    } catch { showToast('反馈失败，请重试'); }
  };

  /* ── P2 → P3 跳转 ── */
  const handleViewDetail = (answerId: string, convId: string) => {
    navigate(`/m/smart-qa/detail?answerId=${encodeURIComponent(answerId)}&convId=${encodeURIComponent(convId)}`);
  };

  /* ── Mic/Send toggle ── */
  const hasText = inputValue.trim().length > 0;

  const showVoiceUI = () => {
    if (voice.isRecording) return;
    voice.setVoiceUIActive(true);
    inputRef.current?.blur();
  };

  const handleMicSendClick = () => {
    if (hasText) { handleSend(); }
    else if (!voice.isRecording) { showVoiceUI(); }
  };

  /* ── Settings: toggle voice mode ── */
  const toggleVoiceMode = () => {
    if (voice.isRecording) voice.stopRecording(true);
    voice.setVoiceUIActive(false);
    const next: VoiceMode = voiceMode === 'hold' ? 'click' : 'hold';
    setVoiceMode(next);
    localStorage.setItem('rg_voice_mode', next);
    alert(next === 'click' ? '已切换为「点击说话」模式' : '已切换为「按住说话」模式');
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

      {/* Chat Scroll Area */}
      <main className="sq-main-scroll" ref={scrollRef} style={{ padding: '16px' }}>
        {/* Brand text */}
        <div style={{ textAlign: 'center', padding: '8px 0', marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#999' }}>随时随地问，答案不瞎编</p>
        </div>

        {/* Knowledge Engines */}
        <div className="sq-engines">
          <h4 className="sq-engines__title">知识引擎</h4>
          {engines.map((eng) => {
            const meta = ENGINE_META[eng.key] || { icon: 'mingcute:question-line', label: eng.key, color: '#999' };
            return (
              <div key={eng.key} className="sq-engine-row">
                <div className="sq-engine-row__left">
                  <Icon icon={meta.icon} className="sq-engine-row__icon" style={{ color: eng.enabled ? meta.color : '#BCAAA4' }} />
                  <span className="sq-engine-row__label" style={{ color: eng.enabled ? '#333' : '#999' }}>
                    {meta.label}
                  </span>
                  {eng.key === 'internet' && eng.enabled && (
                    <span className="sq-engine-row__hint">请核实</span>
                  )}
                </div>
                <button
                  className={`sq-engine-toggle ${eng.enabled ? 'sq-engine-toggle--on' : 'sq-engine-toggle--off'}`}
                  onClick={() => toggleEngine(eng.key)}
                >
                  <div className="sq-engine-toggle__thumb" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Messages */}
        {messages.map((msg) => (
          <div key={msg.key}>
            {/* Bubble */}
            <div className={`sq-bubble-row ${msg.role === 'user' ? 'sq-bubble-row--user' : ''} message-enter`}>
              {msg.role === 'assistant' && (
                <div className="sq-avatar sq-avatar--geng">耕</div>
              )}
              <div className={`sq-bubble-wrapper ${msg.role === 'user' ? 'sq-bubble-wrapper--user' : ''}`}>
                {msg.type === 'voice' ? (
                  <div className="sq-voice-msg">
                    <Icon icon="mingcute:play-circle-line" className="sq-voice-msg__icon" />
                    <span className="sq-voice-msg__label">语音消息</span>
                    <span className="sq-voice-msg__bars">▮▮▮</span>
                  </div>
                ) : (
                  <div className={`sq-bubble ${msg.role === 'assistant' ? 'sq-bubble--assistant' : 'sq-bubble--user'}`}>
                    {msg.text}
                  </div>
                )}
                <span className={`sq-bubble-time ${msg.role === 'user' ? 'sq-bubble-time--user' : ''}`}>
                  {msg.time}
                </span>
              </div>
              {msg.role === 'user' && (
                <div className="sq-avatar sq-avatar--user">苏</div>
              )}
            </div>

            {/* Answer with 4-element cards + source */}
            {msg.answer && (
              <div style={{ marginLeft: 44, marginBottom: 24 }}>
                {/* 4-element cards */}
                <div className="sq-elements">
                  {msg.answer.elements.map((el) => (
                    <div
                      key={el.key}
                      className="sq-element-card"
                      style={{ ['--sq-el-color' as string]: el.color }}
                    >
                      <div className="sq-element-card__header" style={{ color: el.color }}>
                        <Icon icon={el.icon} className="sq-element-card__icon" />
                        <span>{el.title}</span>
                      </div>
                      <p className="sq-element-card__text">{el.summary}</p>
                    </div>
                  ))}
                </div>

                {/* Source + 查看详情 */}
                {msg.answer.source && (
                  <div className="sq-source">
                    <div className="sq-source__row">
                      <Icon icon="mingcute:file-info-line" className="sq-source__icon" />
                      <p className="sq-source__title">{msg.answer.source.title}</p>
                    </div>
                    <div className="sq-source__meta-row">
                      <span className="sq-source__meta">
                        {msg.answer.source.library} | {msg.answer.source.updated_at}
                      </span>
                      <button
                        className="sq-source__link"
                        onClick={() => msg.answerId && msg.convId && handleViewDetail(msg.answerId, msg.convId)}
                      >
                        查看详情
                      </button>
                    </div>
                  </div>
                )}

                {/* 防幻觉标注 */}
                {msg.answer.source?.is_internet && (
                  <div style={{
                    marginBottom: 12, padding: '8px 12px', background: '#FFF0F0',
                    borderRadius: 12, border: '1px solid rgba(192,58,57,0.1)',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <Icon icon="mingcute:warning-line" style={{ fontSize: '14px', color: '#C03A39' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#C03A39' }}>互联网来源 · 请核实准确性</span>
                  </div>
                )}
                {msg.answer.source?.is_stale && (
                  <div style={{
                    marginBottom: 12, padding: '8px 12px', background: '#FFF8F0',
                    borderRadius: 12, border: '1px solid rgba(232,169,77,0.2)',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <Icon icon="mingcute:time-line" style={{ fontSize: '14px', color: '#D2691E' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#D2691E' }}>内容较旧 · 请注意时效</span>
                  </div>
                )}

                {/* Actions */}
                <div className="sq-actions">
                  <button className="sq-btn-save" onClick={() => handleArchive(msg.answer!.id)}>
                    存为 SOP
                  </button>
                  <button
                    className="sq-btn-helpful"
                    onClick={() => handleHelpful(msg.answer!.id)}
                    style={helpfulClicked ? { color: '#C03A39', borderColor: '#C03A39' } : undefined}
                  >
                    {helpfulClicked ? '已反馈' : '有帮助'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Thinking */}
        {isThinking && (
          <div className="sq-thinking message-enter">
            <div className="sq-thinking__avatar">耕</div>
            <div className="sq-thinking__text">
              <span className="sq-thinking__label">小耕正在思考</span>
              <div className="sq-thinking__dots">
                <span className="sq-thinking__dot" style={{ animationDelay: '0s' }} />
                <span className="sq-thinking__dot" style={{ animationDelay: '0.2s' }} />
                <span className="sq-thinking__dot" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && !isThinking && (
          <div className="sq-suggestions" style={{ marginLeft: 44 }}>
            {suggestions.slice(0, 3).map((s, idx) => (
              <button
                key={idx}
                className="sq-suggest-btn"
                onClick={() => {
                  setInputValue(s);
                  handleAsk(s);
                }}
              >
                <Icon icon="mingcute:lightbulb-line" style={{ fontSize: '12px', marginRight: 4 }} />
                {s.slice(0, 30)}...
              </button>
            ))}
          </div>
        )}

        <div style={{ height: 12 }} />
      </main>

      {/* Composer */}
      <div className="sq-composer">
        <div className="sq-composer__pill">
          <input
            ref={inputRef}
            className="sq-composer__input"
            type="text"
            placeholder="追问一下…"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => voice.setVoiceUIActive(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            autoComplete="off"
          />
          <button className="sq-composer__btn" onClick={handleMicSendClick}>
            {hasText ? (
              <Icon icon="mingcute:send-fill" style={{ fontSize: '20px' }} />
            ) : (
              <Icon icon="mingcute:microphone-fill" style={{ fontSize: '20px' }} />
            )}
          </button>
        </div>
      </div>

      {/* Voice Overlay */}
      {voice.voiceUIActive && (
        <div className="sq-voice-zone">
          <div className="sq-voice-hint">
            {voiceMode === 'hold' ? '按住说话，松手发送' : '点击说话，再点一下发送'}
          </div>
          <div className="sq-voice-cancel-row">
            {voice.isRecording && (
              <button
                className={`sq-voice-cancel-btn ${voice.cancelZone ? 'sq-voice-cancel-btn--active' : ''}`}
                onClick={(e) => { e.stopPropagation(); voice.cancelRecording(); }}
              >取消</button>
            )}
          </div>
          <div
            className={`sq-voice-large-btn ${voice.isRecording ? 'sq-voice-large-btn--recording' : ''}`}
            onPointerDown={voice.handlePointerDown}
            onPointerUp={voice.handlePointerUp}
            onPointerMove={voice.handlePointerMove}
            onClick={voice.handleClick}
          >
            {!voice.isRecording && (<><div className="sq-voice-pulse-ring" /><div className="sq-voice-pulse-ring" /></>)}
            <Icon icon="mingcute:microphone-fill" style={{ fontSize: '30px', color: '#fff', position: 'relative', zIndex: 10 }} />
          </div>
          {voice.isRecording && <div className="sq-voice-timer">{voice.formatTime(voice.recordingTime)}</div>}
        </div>
      )}

      {/* Toast */}
      {toastMsg && <div className="sq-toast">{toastMsg}</div>}
    </div>
  );
}
