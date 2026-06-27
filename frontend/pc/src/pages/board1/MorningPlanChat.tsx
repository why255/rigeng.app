/**
 * P2 对话规划页 — 与小耕对话，自然语言描述今日计划。
 * Route: /m/morning-plan/chat
 * 对齐 m1-p2.html 设计（提取 body 内 main 内容区）
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlanData } from '@rigeng/shared/hooks/usePlanData';
import type { PlanTask } from '@rigeng/shared/api/plans';
import './morning-plan.css';

interface ChatMessage {
  role: 'assistant' | 'user';
  text: string;
  time?: string;
}

const QUADRANT_LABELS: Record<string, string> = {
  urgent_important: '重要且紧急',
  not_urgent_important: '重要不紧急',
  urgent_not_important: '紧急不重要',
  not_urgent_not_important: '不重要不紧急',
};

const USER_AVATAR = 'https://modao.cc/agent-py/media/generated_images/2026-06-21/b7710ff5b95c4f7d88c9838fc465a28b.jpg';

/** 简单解析用户输入，提取任务关键词 */
function parseTasksFromInput(text: string): Array<{ title: string; quadrant?: string }> {
  const tasks: Array<{ title: string; quadrant?: string }> = [];
  const parts = text.split(/[，,。；;、\n]|还有|另外|以及/).filter(Boolean);
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.length < 2) continue;
    let quadrant = 'not_urgent_important';
    if (/紧急|马上|立刻|赶紧|急|截止/.test(trimmed)) {
      quadrant = 'urgent_important';
    } else if (/会议|客户|汇报|邮件|审批|报销/.test(trimmed)) {
      quadrant = 'urgent_not_important';
    } else if (/学习|规划|方案|复盘|整理/.test(trimmed)) {
      quadrant = 'not_urgent_important';
    }
    tasks.push({ title: trimmed, quadrant });
  }
  return tasks;
}

export function MorningPlanChat() {
  const navigate = useNavigate();
  const { createPlan } = usePlanData();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: '早安 ☀️ 今天是充满可能的一天，想好今天要完成哪些事了吗？',
      time: '08:30',
    },
  ]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [extractedTasks, setExtractedTasks] = useState<PlanTask[]>([]);
  const [recording, setRecording] = useState(false);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 100);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, thinking, scrollToBottom]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || thinking) return;

    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    setMessages((prev) => [...prev, { role: 'user', text, time }]);
    setDraft('');
    setThinking(true);

    // 模拟 AI 思考延迟
    await new Promise((r) => setTimeout(r, 1200));

    const parsed = parseTasksFromInput(text);
    let reply: string;

    if (parsed.length === 0) {
      reply = '抱歉，我没有识别到具体的任务。能再说详细一点吗？比如"回复客户邮件"、"准备项目方案"这样的。';
    } else {
      const taskList = parsed.map((t, i) => `${i + 1}. ${t.title}`).join('\n');
      reply = `好的！小耕帮您提炼成 ${parsed.length} 个计划：\n${taskList}\n\n需要调整的话，可以在计划列表中拖拽调整哦~`;

      const created = await createPlan(
        '今日计划',
        parsed.map((t) => ({
          title: t.title,
          quadrant: t.quadrant || 'not_urgent_important',
          source: 'user_input',
        })),
      );

      if (created) {
        setExtractedTasks(created.tasks);
      } else {
        setExtractedTasks(
          parsed.map((t, i) => ({
            id: `local_${Date.now()}_${i}`,
            plan_id: `local_plan_${Date.now()}`,
            title: t.title,
            quadrant: (t.quadrant as PlanTask['quadrant']) || 'not_urgent_important',
            source: 'user_input' as const,
            status: 'pending' as const,
            sort_order: i,
          })),
        );
      }
    }

    setMessages((prev) => [...prev, { role: 'assistant', text: reply, time }]);
    setThinking(false);
  }, [draft, thinking, createPlan]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
      setDraft((prev) => prev + transcript);
    };
    recognition.onerror = () => setRecording(false);
    recognition.onend = () => setRecording(false);
  };

  return (
    <div data-module="morning-plan" data-page="chat">
      <div className="mp-page--chat">
        {/* 品牌标语区（紧凑版） */}
        <div style={{ textAlign: 'center', padding: '24px 0 12px', flex: 'none' }}>
          <div className="mp-hero__slogan" style={{ marginBottom: 8 }}>日耕朝夕，耕愈工作，耕暖生活</div>
          <div className="mp-hero__divider" style={{ margin: '10px auto' }} />
          <h2 className="mp-hero__title--small" style={{ marginTop: 12 }}>晨起做规划，整日不慌忙</h2>
          <p className="mp-hero__subtitle">今天想完成什么？输入你的计划~</p>
        </div>

        {/* 对话流 */}
        <div className="mp-chat">
          <div className="mp-chat__scroll" ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} className={`mp-bubble-row ${m.role === 'user' ? 'mp-bubble-row--user' : ''}`}>
                {m.role === 'assistant' ? (
                  <div className="mp-bubble-avatar mp-bubble-avatar--assistant">
                    <span>耕</span>
                  </div>
                ) : (
                  <div className="mp-bubble-avatar mp-bubble-avatar--user">
                    <img src={USER_AVATAR} alt="User" />
                  </div>
                )}
                <div style={{ maxWidth: '80%' }}>
                  <div className={`mp-bubble mp-bubble--${m.role}`}>
                    <span style={{ whiteSpace: 'pre-line' }}>{m.text}</span>
                  </div>
                  <div className="mp-bubble-time" style={m.role === 'user' ? { textAlign: 'right' } : {}}>
                    {m.time}
                  </div>
                </div>
              </div>
            ))}

            {/* 思考动画 */}
            {thinking && (
              <div className="mp-bubble-row">
                <div className="mp-bubble-avatar mp-bubble-avatar--assistant">
                  <span>耕</span>
                </div>
                <div className="mp-thinking">
                  <span>小耕在整理你的计划…</span>
                </div>
              </div>
            )}

            {/* 已提取的任务预览 */}
            {extractedTasks.length > 0 && (
              <div className="mp-chat-tasks">
                <div className="mp-chat-tasks__title">
                  📋 小耕已为您整理今日计划
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {extractedTasks.map((task) => (
                    <div key={task.id} className="mp-chat-task-item">
                      <div className="mp-chat-task-item__title">{task.title}</div>
                      <div className="mp-chat-task-item__quadrant">
                        {QUADRANT_LABELS[task.quadrant] || '重要不紧急'}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  className="mp-btn-secondary"
                  style={{ width: '100%', marginTop: 16 }}
                  onClick={() => navigate('/m/morning-plan/list')}
                >
                  查看/调整计划列表 →
                </button>
              </div>
            )}
          </div>

          {/* 底部输入区 */}
          <div className="mp-chat__composer">
            <div className="mp-composer">
              <textarea
                ref={textareaRef}
                placeholder="用文字告诉我今天的计划…"
                rows={3}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <div className="mp-composer__actions">
                <button
                  className="mp-composer__send"
                  onClick={handleSend}
                  disabled={!draft.trim() || thinking}
                  title="发送"
                >
                  ➤
                </button>
              </div>
            </div>

            {/* 语音按钮 */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
              <button
                className={`mp-voice-btn ${recording ? 'mp-voice-btn--recording' : ''}`}
                onClick={handleVoiceClick}
                title={recording ? '录音中…' : '语音输入'}
              >
                🎤
              </button>
            </div>

            {/* 跳转链接 */}
            <div style={{ textAlign: 'center', marginTop: 16, paddingBottom: 8 }}>
              <a
                className="mp-nav-link"
                href="#"
                onClick={(e) => { e.preventDefault(); navigate('/m/evening-review'); }}
              >
                跳转至暮有复盘
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
