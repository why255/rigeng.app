/**
 * P2 对话规划页 — 与小耕对话，自然语言描述今日计划。
 * Route: /m/morning-plan/chat
 *
 * 集成语音引擎多轮对话（/voice/converse, module=morning_plan），
 * 自动从 AI 回复中提取结构化任务，支持多轮追问澄清。
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlanData } from '@/hooks/usePlanData';
import { conversePlan } from '@/api/plans';
import { checkYesterdayCrisis } from '@/api/emotions';
import type { PlanTask, ConverseResult } from '@/api/plans';
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

/** 从 AI 回复中提取 tasks 代码块 */
function extractTasksFromReply(text: string): Array<{ title: string; quadrant: string }> {
  const match = text.match(/```tasks\n([\s\S]*?)```/);
  if (!match) return [];

  const lines = match[1].split('\n').filter(Boolean);
  const tasks: Array<{ title: string; quadrant: string }> = [];

  for (const line of lines) {
    // 跳过表头行
    if (line.includes('任务标题') || line.includes('---')) continue;
    const parts = line.split('|').map((s) => s.trim());
    if (parts.length >= 2 && parts[0]) {
      const title = parts[0];
      const quadrantRaw = parts[1] || '';
      // 匹配象限关键词
      let quadrant = 'not_urgent_important';
      if (/重要且紧急|urgent_important/.test(quadrantRaw)) quadrant = 'urgent_important';
      else if (/重要不紧急|not_urgent_important/.test(quadrantRaw)) quadrant = 'not_urgent_important';
      else if (/紧急不重要|urgent_not_important/.test(quadrantRaw)) quadrant = 'urgent_not_important';
      else if (/不重要不紧急|not_urgent_not_important/.test(quadrantRaw)) quadrant = 'not_urgent_not_important';
      tasks.push({ title, quadrant });
    }
  }
  return tasks;
}

/** 简单客户端回退解析（AI 不可用时的离线方案） */
function parseTasksFallback(text: string): Array<{ title: string; quadrant: string }> {
  const tasks: Array<{ title: string; quadrant: string }> = [];
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

  const DEFAULT_GREETING = '早安 ☀️ 今天是充满可能的一天，想好今天要完成哪些事了吗？告诉我你想做的事，小耕帮你整理成计划~';

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: DEFAULT_GREETING, time: formatTime() },
  ]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [extractedTasks, setExtractedTasks] = useState<PlanTask[]>([]);
  const [recording, setRecording] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [aiError, setAiError] = useState(false);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 100);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, thinking, scrollToBottom]);

  // 步骤14·跨模块联动：检查昨日危机/低落情绪，在开场时给予温和关怀
  useEffect(() => {
    let cancelled = false;
    checkYesterdayCrisis().then((result) => {
      if (cancelled) return;
      if (result.had_crisis_yesterday || result.had_low_mood_yesterday) {
        const careMsg = result.care_message || '姐，昨天还好吗？小耕一直在。今天我们一起慢慢来~';
        setMessages([
          { role: 'assistant', text: careMsg, time: formatTime() },
        ]);
      }
    }).catch(() => {
      // 检查失败静默，使用默认问候
    });
    return () => { cancelled = true; };
  }, []);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || thinking) return;

    const now = new Date();
    const time = formatTime(now);

    // 添加用户消息
    setMessages((prev) => [...prev, { role: 'user', text, time }]);
    setDraft('');
    setThinking(true);
    setAiError(false);

    try {
      // 调用真实 AI 对话
      let result: ConverseResult;
      try {
        result = await conversePlan(text, conversationId);
        setConversationId(result.conversation_id);
      } catch {
        // AI 不可用 → 降级到本地解析
        setAiError(true);
        await new Promise((r) => setTimeout(r, 800));
        const fallbackTasks = parseTasksFallback(text);
        handleExtractedTasks(fallbackTasks, time, text);
        setThinking(false);
        return;
      }

      // 添加 AI 回复
      const reply = result.assistant_reply;
      setMessages((prev) => [...prev, { role: 'assistant', text: reply, time: formatTime() }]);

      // 从回复中提取结构化任务
      const aiTasks = extractTasksFromReply(reply);

      if (aiTasks.length > 0) {
        handleExtractedTasks(aiTasks, time, reply);
      } else {
        // 没有结构化任务 → AI 可能在追问，让用户继续对话
        // 也尝试回退解析
        const fallbackTasks = parseTasksFallback(text);
        if (fallbackTasks.length > 0) {
          handleExtractedTasks(fallbackTasks, time, reply);
        }
      }
    } catch {
      // 网络错误等
      setAiError(true);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: '抱歉，小耕的网络好像有点问题…不过没关系，我已根据你的输入整理了计划 👇',
          time: formatTime(),
        },
      ]);
      const fallbackTasks = parseTasksFallback(text);
      if (fallbackTasks.length > 0) {
        handleExtractedTasks(fallbackTasks, formatTime(), text);
      }
    } finally {
      setThinking(false);
    }
  }, [draft, thinking, conversationId, createPlan]);

  /** 将提取的任务发送到后端创建计划 */
  const handleExtractedTasks = useCallback(
    async (parsed: Array<{ title: string; quadrant: string }>, _time: string, _reply: string) => {
      if (parsed.length === 0) return;

      const created = await createPlan(
        '今日计划',
        parsed.map((t) => ({
          title: t.title,
          quadrant: t.quadrant || 'not_urgent_important',
          source: 'user_input' as const,
        })),
      );

      if (created) {
        setExtractedTasks(created.tasks);
      } else {
        // 即使创建失败也显示本地提取的任务
        setExtractedTasks(
          parsed.map((t, i) => ({
            id: `local_${Date.now()}_${i}`,
            plan_id: `local_plan_${Date.now()}`,
            title: t.title,
            quadrant: t.quadrant as PlanTask['quadrant'],
            source: 'user_input' as const,
            status: 'pending' as const,
            sort_order: i,
          })),
        );
      }
    },
    [createPlan],
  );

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
      setDraft((prev) => (prev ? prev + '，' + transcript : transcript));
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

            {/* AI 思考动画 */}
            {thinking && (
              <div className="mp-bubble-row">
                <div className="mp-bubble-avatar mp-bubble-avatar--assistant">
                  <span>耕</span>
                </div>
                <div className="mp-thinking">
                  <span>{aiError ? '小耕正在本地分析你的计划…' : '小耕在整理你的计划…'}</span>
                  <span className="mp-thinking__dots">
                    <span>.</span><span>.</span><span>.</span>
                  </span>
                </div>
              </div>
            )}

            {/* AI 错误提示 */}
            {aiError && !thinking && (
              <div className="mp-bubble-row">
                <div className="mp-bubble-avatar mp-bubble-avatar--assistant">
                  <span>耕</span>
                </div>
                <div style={{
                  maxWidth: '80%', padding: '8px 16px', borderRadius: 12,
                  background: '#FFF3CD', color: '#856404', fontSize: 13,
                }}>
                  ⚠️ AI 引擎暂时不可用，已使用本地解析。联网后将自动同步。
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
                placeholder="用文字告诉我今天的计划…（Shift+Enter 换行，Enter 发送）"
                rows={3}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={thinking}
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
                disabled={thinking}
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

/** 格式化当前时间为 HH:MM */
function formatTime(d?: Date): string {
  const now = d || new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}
