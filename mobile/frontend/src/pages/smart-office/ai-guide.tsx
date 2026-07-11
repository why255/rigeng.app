/**
 * P3 AI智能引导 — 对话式信息采集 + 文档生成。
 * Route: /m/smart-office/ai-guide?module=&name=&tool=&toolLabel=
 * 对齐 m6-p3-mobile.html 设计规范。
 *
 * V2.0: 所有小耕输出内容由AI模型生成，AI根据模块/工具动态生成引导问题。
 *       修复 StrictMode 双重挂载导致的4条重复消息 bug。
 *
 * 使用 so-* BEM 类名 + 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。返回按钮使用 navigate(-1)。
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { officeChat, generateDocument } from '@/shared/api/office';
import './smart-office.css';

interface ChatMessage {
  id: string;
  role: 'geng' | 'user';
  text: string;
  time: string;
}

let _msgId = 0;
function nextId(): string { return `so-msg-${++_msgId}`; }

function getTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function SmartOfficeAiGuide() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const moduleKey = searchParams.get('module') || '';
  const moduleName = searchParams.get('name') || '';
  const toolKey = searchParams.get('tool') || '';
  const toolLabel = searchParams.get('toolLabel') || '';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [docId, setDocId] = useState<string | null>(null);

  const chatListRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initRef = useRef(false);  // ← 防 StrictMode 双重挂载

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (chatListRef.current) {
        chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
      }
    }, 80);
  }, []);

  /* ═══════════════════════════════════════════════
     Init — AI 生成初始问候（只执行一次）
     ═══════════════════════════════════════════════ */

  useEffect(() => {
    if (initRef.current) return;  // StrictMode 防护
    initRef.current = true;

    let cancelled = false;

    async function init() {
      try {
        setIsThinking(true);
        const result = await officeChat({
          message: '',
          module_key: moduleKey,
          module_name: moduleName,
          tool_key: toolKey,
          tool_label: toolLabel,
          context: [],
          question_index: 0,
        });
        if (cancelled) return;
        setIsThinking(false);
        setMessages([{ id: nextId(), role: 'geng', text: result.reply, time: getTimeStr() }]);
        setQuestionIndex(1);
      } catch {
        if (cancelled) return;
        setIsThinking(false);
        const fallback = `姐，我来帮您生成「${toolLabel || '文档'}」。请先跟我说说您的具体需求吧～`;
        setMessages([{ id: nextId(), role: 'geng', text: fallback, time: getTimeStr() }]);
        setQuestionIndex(1);
      } finally {
        scrollToBottom();
      }
    }

    init();
    inputRef.current?.focus();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isThinking, isWriting, scrollToBottom]);

  /* ═══════════════════════════════════════════════
     Core: send user input → AI 生成回复
     ═══════════════════════════════════════════════ */

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isWriting || isThinking) return;

    // 添加用户消息
    const userMsg: ChatMessage = { id: nextId(), role: 'user', text, time: getTimeStr() };
    const currentMessages = [...messages, userMsg];
    setMessages(currentMessages);
    setUserAnswers(prev => [...prev, text]);
    setInputText('');
    setIsThinking(true);

    try {
      // 构建对话上下文
      const context = currentMessages
        .filter(m => m.text)
        .map(m => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, text: m.text }));

      const qi = questionIndex;

      // 判断是否应该生成文档（已收集足够信息）
      const totalUserChars = [...userAnswers, text].reduce((sum, a) => sum + a.length, 0);
      const shouldGenerate = (qi >= 3 && totalUserChars > 200) || qi >= 5;

      if (shouldGenerate) {
        // ── 开始生成文档 ──
        setIsWriting(true);
        setIsThinking(false);

        try {
          // 调用 AI 告知用户正在生成
          const genMsg = await officeChat({
            message: text,
            module_key: moduleKey,
            module_name: moduleName,
            tool_key: toolKey,
            tool_label: toolLabel,
            context,
            question_index: qi,
          });
          const aiMsg: ChatMessage = { id: nextId(), role: 'geng', text: genMsg.reply, time: getTimeStr() };
          setMessages(prev => [...prev, aiMsg]);
        } catch {
          // 降级
          setMessages(prev => [...prev, {
            id: nextId(), role: 'geng', text: '信息已经足够了，我正在为你生成文档…', time: getTimeStr(),
          }]);
        }

        // 调用文档生成 API
        try {
          const docResult = await generateDocument({
            module_key: moduleKey,
            doc_type: 'tool',
            tool_key: toolKey,
          });
          setDocId(docResult.doc_id);
        } catch { /* 即使后端生成失败也不阻塞流程 */ }

        setIsWriting(false);
        setMessages(prev => [...prev, {
          id: nextId(), role: 'geng',
          text: '文档已生成完毕！包含了您提供的所有需求要点。请查看并确认是否需要修改。',
          time: getTimeStr(),
        }]);
        setTimeout(() => setShowCompletion(true), 300);

      } else {
        // ── 继续引导提问 ──
        const result = await officeChat({
          message: text,
          module_key: moduleKey,
          module_name: moduleName,
          tool_key: toolKey,
          tool_label: toolLabel,
          context,
          question_index: qi,
        });

        const aiMsg: ChatMessage = { id: nextId(), role: 'geng', text: result.reply, time: getTimeStr() };
        setMessages(prev => [...prev, aiMsg]);
        setQuestionIndex(prev => prev + 1);
      }
    } catch {
      // 兜底
      setMessages(prev => [...prev, {
        id: nextId(), role: 'geng',
        text: '姐，小耕正在努力思考中，稍等一下哦～',
        time: getTimeStr(),
      }]);
    } finally {
      setIsThinking(false);
    }
  }, [messages, inputText, isWriting, isThinking, questionIndex, userAnswers, moduleKey, moduleName, toolKey, toolLabel]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* ── 弹窗操作 ── */

  const handleModalCancel = useCallback(async () => {
    setShowCompletion(false);
    setIsWriting(false);

    try {
      const context = messages
        .filter(m => m.text)
        .map(m => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, text: m.text }));
      const result = await officeChat({
        message: '',
        module_key: moduleKey,
        module_name: moduleName,
        tool_key: toolKey,
        tool_label: toolLabel,
        context,
        question_index: questionIndex,
      });
      setMessages(prev => [...prev, { id: nextId(), role: 'geng', text: result.reply, time: getTimeStr() }]);
    } catch {
      setMessages(prev => [...prev, {
        id: nextId(), role: 'geng',
        text: '还有什么我没说到的吗？或者您想补充什么信息？',
        time: getTimeStr(),
      }]);
    }
    inputRef.current?.focus();
  }, [messages, moduleKey, moduleName, toolKey, toolLabel, questionIndex]);

  const handleModalConfirm = useCallback(() => {
    const answers = userAnswers.join('|');
    navigate(
      `/m/smart-office/editor?module=${encodeURIComponent(moduleKey)}&name=${encodeURIComponent(moduleName)}&tool=${encodeURIComponent(toolKey)}&toolLabel=${encodeURIComponent(toolLabel)}&answers=${encodeURIComponent(answers)}&docId=${encodeURIComponent(docId || '')}`,
    );
  }, [navigate, moduleKey, moduleName, toolKey, toolLabel, userAnswers, docId]);

  /* ═══════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════ */

  return (
    <div className="so-page" style={{ position: 'relative' }}>
      {/* Header */}
      <header className="so-header">
        <button className="so-header__back" onClick={() => navigate(-1)}>
          <Icon icon="solar:alt-arrow-left-linear" style={{ fontSize: '24px' }} />
        </button>
        <span className="so-header__title">{toolLabel || 'AI智能引导'}</span>
        <button className="so-header__btn">
          <Icon icon="mingcute:settings-3-line" style={{ fontSize: '24px' }} />
        </button>
      </header>

      {/* Chat Area */}
      <div className="so-chat" ref={chatListRef}>
        <div className="so-chat-list">
          {/* 品牌信息 */}
          <div style={{ textAlign: 'center', padding: '12px 0', opacity: 0.6 }}>
            <div className="so-hero__slogan" style={{ fontSize: 12 }}>日耕朝夕，耕愈工作，耕暖生活</div>
          </div>

          {messages.map((msg) => (
            <div key={msg.id} className={`so-msg${msg.role === 'user' ? ' so-msg--user' : ''}`}>
              <div className={`so-msg__avatar so-msg__avatar--${msg.role}`}>
                {msg.role === 'geng' ? '耕' : '苏'}
              </div>
              <div className={`so-msg__wrap${msg.role === 'user' ? ' so-msg__wrap--user' : ''}`}>
                <div className={`so-msg__bubble so-msg__bubble--${msg.role}`}>
                  <span dangerouslySetInnerHTML={{ __html: msg.text }} />
                </div>
                <span className={`so-msg__time${msg.role === 'user' ? ' so-msg__time--user' : ''}`}>
                  {msg.time}
                </span>
              </div>
            </div>
          ))}

          {/* Thinking indicator */}
          {isThinking && (
            <div className="so-msg">
              <div className="so-msg__avatar so-msg__avatar--geng">耕</div>
              <div className="so-msg__wrap">
                <div className="so-msg__bubble so-msg__bubble--geng">
                  <div className="so-typing">
                    <span className="so-typing__dot" />
                    <span className="so-typing__dot" />
                    <span className="so-typing__dot" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Document generation indicator */}
          {isWriting && (
            <div className="so-msg">
              <div className="so-msg__avatar so-msg__avatar--geng">耕</div>
              <div className="so-msg__wrap">
                <div className="so-msg__bubble so-msg__bubble--geng">
                  <div className="so-writing">
                    <span className="so-writing__text">正在生成文档</span>
                    <span className="so-writing__dot" />
                    <span className="so-writing__dot" />
                    <span className="so-writing__dot" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="so-input-area">
        <div className="so-input-row">
          <input
            ref={inputRef}
            type="text"
            placeholder="输入你的回答..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isWriting}
            autoComplete="off"
          />
          <button
            className="so-send-btn"
            onClick={handleSend}
            disabled={!inputText.trim() || isWriting}
          >
            <Icon icon="solar:arrow-up-linear" style={{ fontSize: '20px' }} />
          </button>
        </div>
      </div>

      {/* Completion Modal */}
      {showCompletion && (
        <div className="so-modal-overlay">
          <div className="so-modal-card">
            <div className="so-modal__icon-wrap">
              <Icon icon="mingcute:check-circle-fill" style={{ fontSize: '40px', color: '#C03A39' }} />
            </div>
            <h3 className="so-modal__title">文档已完成</h3>
            <p className="so-modal__desc">AI已为您生成文档，是否立即查看？</p>
            <div className="so-modal__actions">
              <button className="so-modal__btn so-modal__btn--cancel" onClick={handleModalCancel}>
                取消
              </button>
              <button className="so-modal__btn so-modal__btn--confirm" onClick={handleModalConfirm}>
                确认查看
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
