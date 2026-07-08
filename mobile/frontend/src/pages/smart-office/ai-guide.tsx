/**
 * P3 AI智能引导 — 对话式信息采集 + 文档生成。
 * Route: /m/smart-office/ai-guide?module=&name=&tool=&toolLabel=
 * 对齐 m6-p3-mobile.html 设计规范。
 *
 * 使用 so-* BEM 类名 + 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。返回按钮使用 navigate(-1)。
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import './smart-office.css';

/* ── 引导问题库（按 toolKey 索引） ── */
const GUIDE_QUESTIONS: Record<string, string[]> = {
  jd_generator: [
    '请告诉我这个岗位的职位名称和所属部门？',
    '这个岗位的核心职责有哪些？（请列出3-5项）',
    '请描述该岗位的任职资格要求（学历、经验、技能等）',
    '有没有特殊的加分项或优先条件？',
    '公司的薪酬范围和工作地点是？',
  ],
  interview_guide: [
    '请告诉我面试的岗位名称？',
    '您希望重点考察候选人哪些能力维度？',
    '面试流程是怎样的？（初试/复试/终试）',
    '有没有需要特别关注的红线或否决项？',
  ],
  onboarding_plan: [
    '新员工的职位和部门是？',
    '入职后的直属上级是谁？',
    '您希望新人多长时间内独立上手？',
    '有没有特定需要对接的团队或项目？',
  ],
  salary_structure: [
    '请描述公司当前的薪酬策略定位（领先型/跟随型/滞后型）？',
    '公司的职级体系是怎样的？',
    '期望的薪酬带宽范围？',
    '是否需要包含长期激励或股权方案？',
  ],
  okr_framework: [
    '请告诉我公司当前季度的战略优先级？',
    '需要从哪个层级开始制定OKR（公司级/部门级/个人级）？',
    '目前是否有正在使用的KPI可以与OKR结合？',
  ],
  training_system: [
    '请描述公司目前的培训现状和痛点？',
    '期望搭建几级培训体系？',
    '培训预算的大致范围是？',
    '是否有内部讲师资源？',
  ],
  contract_template: [
    '需要哪种类型的合同模板（全职/兼职/实习/劳务）？',
    '公司所在城市（涉及社保公积金政策）？',
    '试用期时长和薪资比例？',
    '是否有竞业限制或保密条款需求？',
  ],
  handbook: [
    '公司规模和成立时间？',
    '公司所在行业？',
    '目前的考勤制度和休假政策是怎样的？',
    '有没有特殊的企业文化或福利需要体现？',
  ],
  culture_manual: [
    '公司的使命、愿景和价值观是什么？',
    '公司的发展历程中有哪些里程碑事件？',
    '有没有标杆员工故事可以融入文化手册？',
    '公司对员工行为的期望是怎样的？',
  ],
  default: [
    '请简要描述您的需求场景？',
    '您期望的文档包含哪些关键模块？',
    '有没有参考模板或风格偏好？',
    '目标受众是谁？文档将用于什么场合？',
    '有没有需要特别注意的合规或行业要求？',
  ],
};

interface ChatMessage {
  id: string;
  role: 'geng' | 'user';
  text: string;
  time: string;
}

let _msgId = 0;
function nextId(): string {
  return `so-msg-${++_msgId}`;
}

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

  const questions = GUIDE_QUESTIONS[toolKey] || GUIDE_QUESTIONS['default'];
  const [questionIndex, setQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);

  const chatListRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (chatListRef.current) {
        chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
      }
    }, 80);
  }, []);

  // 添加小耕消息（带打字动画）
  const addGengMessage = useCallback((text: string, showTyping = true): Promise<void> => {
    return new Promise((resolve) => {
      if (showTyping) {
        setIsThinking(true);
        scrollToBottom();

        const delay = 800 + Math.random() * 600;
        setTimeout(() => {
          setIsThinking(false);
          setMessages((prev) => [
            ...prev,
            { id: nextId(), role: 'geng', text, time: getTimeStr() },
          ]);
          scrollToBottom();
          resolve();
        }, delay);
      } else {
        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: 'geng', text, time: getTimeStr() },
        ]);
        scrollToBottom();
        resolve();
      }
    });
  }, [scrollToBottom]);

  // 添加用户消息
  const addUserMessage = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: 'user', text, time: getTimeStr() },
    ]);
    scrollToBottom();
  }, [scrollToBottom]);

  // AI引导提问
  const askNextQuestion = useCallback(async () => {
    const idx = questionIndex;
    if (idx < questions.length) {
      const prefix = idx === 0
        ? `你好！我来帮你生成「<strong>${toolLabel}</strong>」。为了生成更精准的文档，我需要了解一些信息。`
        : '好的，我还想了解一下…';
      await addGengMessage(`${prefix}<br/><br/>${questions[idx]}`);
      setQuestionIndex((prev) => prev + 1);
    } else {
      await startDocumentGeneration();
    }
  }, [questionIndex, questions, toolLabel, addGengMessage]);

  // 开始生成文档
  const startDocumentGeneration = useCallback(async () => {
    setIsWriting(true);
    await addGengMessage('信息已经足够了，我正在为你生成文档，请稍候…', true);
    // 模拟AI生成
    await new Promise((r) => setTimeout(r, 2500));
    setIsWriting(false);
    await addGengMessage(
      '文档已生成完毕！包含了您提供的所有需求要点。请查看并确认是否需要修改。',
      false,
    );
    setTimeout(() => setShowCompletion(true), 300);
  }, [addGengMessage]);

  // 处理用户发送
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isWriting) return;

    addUserMessage(text);
    setUserAnswers((prev) => [...prev, text]);
    setInputText('');

    // 长回答可能跳过一个问题（模拟AI判断）
    let skipNext = false;
    if (text.length > 80 && questionIndex < questions.length) {
      skipNext = Math.random() > 0.5;
    }
    if (skipNext && questionIndex < questions.length - 1) {
      setQuestionIndex((prev) => prev + 1);
    }

    await askNextQuestion();
  }, [inputText, isWriting, questionIndex, questions, addUserMessage, askNextQuestion]);

  // 弹窗取消
  const handleModalCancel = useCallback(async () => {
    setShowCompletion(false);
    setIsWriting(false);
    await addGengMessage('还有什么我没说到的吗？或者您想补充什么信息？我会继续帮您完善文档。');
    inputRef.current?.focus();
  }, [addGengMessage]);

  // 弹窗确认 → 跳转编辑器
  const handleModalConfirm = useCallback(() => {
    const answers = userAnswers.join('|');
    navigate(
      `/m/smart-office/editor?module=${encodeURIComponent(moduleKey)}&name=${encodeURIComponent(moduleName)}&tool=${encodeURIComponent(toolKey)}&toolLabel=${encodeURIComponent(toolLabel)}&answers=${encodeURIComponent(answers)}`,
    );
  }, [navigate, moduleKey, moduleName, toolKey, toolLabel, userAnswers]);

  // 初始化
  useEffect(() => {
    const init = async () => {
      await addGengMessage(
        `欢迎来到智能办公！我是小耕，今天来帮您高效完成文档工作 📋<br/><br/>当前模块：<strong>${moduleName}</strong>｜工具：<strong>${toolLabel}</strong>`,
        true,
      );
      await askNextQuestion();
    };
    init();
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 回车发送
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="so-page" style={{ position: 'relative' }}>
      {/* ===== 顶部 Header ===== */}
      <header className="so-header">
        <button className="so-header__back" onClick={() => navigate(-1)}>
          <Icon icon="solar:alt-arrow-left-linear" style={{ fontSize: '24px' }} />
        </button>
        <span className="so-header__title">{toolLabel || 'AI智能引导'}</span>
        <button className="so-header__btn">
          <Icon icon="mingcute:settings-3-line" style={{ fontSize: '24px' }} />
        </button>
      </header>

      {/* ===== 对话区 ===== */}
      <div className="so-chat" ref={chatListRef}>
        <div className="so-chat-list">
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

          {/* 打字指示器 */}
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

          {/* 生成中动画 */}
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

      {/* ===== 底部输入区 ===== */}
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

      {/* ===== 完成弹窗 ===== */}
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
