/**
 * P3 智能问答答案详情页 — 完整四要素 + 来源文档 + 异常标注 + 操作按钮。
 * Route: /m/smart-qa/detail?answerId=...&convId=...
 * 对齐 m3p3-mobile.html 设计。
 *
 * 从 P2 "查看详情" 跳转进入。
 */
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import {
  getConversation,
  archiveAnswer,
  submitFeedback,
  type QaAnswer,
} from '@/shared/api/smartQa';
import './smart-qa.css';

export function SmartQaDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const answerId = searchParams.get('answerId') || '';
  const convId = searchParams.get('convId') || '';

  /* ── State ── */
  const [answer, setAnswer] = useState<QaAnswer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState('内容有误');
  const [feedbackDetail, setFeedbackDetail] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  /* ── Fetch answer ── */
  useEffect(() => {
    if (!convId) {
      setError('缺少对话ID');
      setLoading(false);
      return;
    }

    getConversation(convId)
      .then((conv) => {
        const lastAnswer = [...conv.messages]
          .reverse()
          .find((m) => m.answer)?.answer;
        if (lastAnswer) {
          setAnswer(lastAnswer);
        } else {
          setError('未找到该答案');
        }
      })
      .catch((err) => {
        setError(err?.message || '加载失败');
      })
      .finally(() => setLoading(false));
  }, [answerId, convId]);

  /* ── Toast ── */
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2000);
  };

  /* ── Actions ── */
  const handleSaveAsSop = async () => {
    if (!answer) return;
    try {
      const result = await archiveAnswer(answer.id);
      if (result.success) showToast(`+${result.contribution_value} 贡献值`);
      else showToast('归档失败，请重试');
    } catch {
      showToast('归档失败，请重试');
    }
  };

  const handleSubmitFeedback = async () => {
    if (!answer) return;
    setFeedbackSubmitting(true);
    try {
      await submitFeedback(answer.id, feedbackType, feedbackDetail || undefined);
      setShowFeedback(false);
      showToast('感谢您的反馈！');
    } catch {
      showToast('提交失败，请重试');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="sq-mobile-page">
        <header className="sq-mobile-page__header" style={{ height: 48 }}>
          <button className="sq-header-btn" onClick={() => navigate(-1)}>
            <Icon icon="mingcute:left-line" style={{ fontSize: '24px' }} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#333' }}>答案详情</span>
          <div className="sq-header-spacer" />
        </header>
        <main className="sq-main-scroll">
          <div className="sq-state">
            <p className="sq-state__text">加载中...</p>
          </div>
        </main>
      </div>
    );
  }

  /* ── Error state ── */
  if (error || !answer) {
    return (
      <div className="sq-mobile-page">
        <header className="sq-mobile-page__header" style={{ height: 48 }}>
          <button className="sq-header-btn" onClick={() => navigate(-1)}>
            <Icon icon="mingcute:left-line" style={{ fontSize: '24px' }} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#333' }}>答案详情</span>
          <div className="sq-header-spacer" />
        </header>
        <main className="sq-main-scroll">
          <div className="sq-state">
            <p className="sq-state__text">{error || '答案不存在'}</p>
            <button className="sq-state__btn" onClick={() => navigate('/m/smart-qa')}>
              返回首页
            </button>
          </div>
        </main>
      </div>
    );
  }

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
        <span style={{ fontSize: 14, fontWeight: 700, color: '#333' }}>答案详情</span>
        <button className="sq-header-btn">
          <Icon icon="mingcute:share-forward-line" style={{ fontSize: '22px', color: '#999' }} />
        </button>
      </header>

      <main className="sq-main-scroll">
        <div className="sq-detail" style={{ paddingTop: 24 }}>
          {/* Brand */}
          <div className="sq-detail__brand">
            <p className="sq-detail__brand-slogan">日耕朝夕，耕愈工作，耕暖生活</p>
            <p className="sq-detail__brand-sub">随时随地问，答案不瞎编</p>
          </div>

          {/* Question Card */}
          <div className="sq-detail__question">
            <p className="sq-detail__question-label">您的问题：</p>
            <h3 className="sq-detail__question-text">{answer.question}</h3>
          </div>

          {/* Answer Sections */}
          {answer.elements.map((el) => {
            const isChat = el.key === 'script' || el.key === 'standard';
            return (
              <div key={el.key} className="sq-detail__section">
                <div className="sq-detail__section-header" style={{ color: el.color }}>
                  <Icon icon={el.icon} className="sq-detail__section-icon" />
                  <span className="sq-detail__section-title">{el.title}</span>
                </div>
                <div
                  className={`sq-detail__section-body ${isChat ? 'sq-detail__section-body--chat' : ''}`}
                  style={isChat ? { ['--sq-section-color' as string]: el.color, borderLeftColor: el.color } : undefined}
                >
                  {el.key === 'cautions' ? (
                    <>
                      <p style={{ fontSize: 12, marginBottom: 12 }}>{el.summary}</p>
                      {el.detail.map((item, idx) => (
                        <div key={idx} style={{
                          padding: 12, background: '#F9F9F9', borderRadius: 8, marginBottom: 8,
                        }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#333', marginBottom: 4 }}>
                            {idx + 1}. {item.includes('：') ? item.split('：')[0] : item.slice(0, 20)}
                          </p>
                          <p style={{ fontSize: 11, color: '#999' }}>
                            {item.includes('：') ? item.split('：').slice(1).join('：') : item}
                          </p>
                        </div>
                      ))}
                    </>
                  ) : (
                    <ul>
                      {el.detail.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}

          {/* Source Document */}
          {answer.source && (
            <div className="sq-detail__source-section">
              <p className="sq-detail__source-title">参考文档</p>
              <div className="sq-detail__source-card">
                <Icon icon="mingcute:file-pdf-line" className="sq-detail__source-thumb" />
                <div className="sq-detail__source-info">
                  <p className="sq-detail__source-name">{answer.source.title}</p>
                  <p className="sq-detail__source-meta">
                    {answer.source.library} | {answer.source.updated_at}
                  </p>
                </div>
                <Icon icon="mingcute:right-line" className="sq-detail__source-arrow" />
              </div>

              {/* Warnings */}
              {answer.source.is_internet && (
                <div className="sq-detail__warning">
                  <Icon icon="mingcute:warning-line" className="sq-detail__warning-icon" />
                  <p className="sq-detail__warning-text">互联网来源 · 请核实准确性</p>
                </div>
              )}
              {answer.source.is_stale && (
                <div className="sq-detail__warning sq-detail__warning--stale">
                  <Icon icon="mingcute:time-line" className="sq-detail__warning-icon" />
                  <p className="sq-detail__warning-text">内容较旧 · 请注意时效</p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="sq-detail__actions">
            <button className="sq-detail__save-btn" onClick={handleSaveAsSop}>
              存为 SOP (+20贡献值)
            </button>
            <button className="sq-detail__feedback-btn" onClick={() => setShowFeedback(true)}>
              反馈错误
            </button>
          </div>
        </div>
      </main>

      {/* Feedback Modal */}
      {showFeedback && (
        <div
          className="sq-modal-mask"
          onClick={(e) => { if (e.target === e.currentTarget) setShowFeedback(false); }}
        >
          <div className="sq-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sq-modal__header">
              <h3 className="sq-modal__title">纠错反馈</h3>
              <button className="sq-modal__close" onClick={() => setShowFeedback(false)}>
                <Icon icon="mingcute:close-line" style={{ fontSize: '24px' }} />
              </button>
            </div>
            <div className="sq-modal__body">
              <div className="sq-modal__field">
                <label className="sq-modal__label">反馈类型</label>
                <select
                  className="sq-modal__select"
                  value={feedbackType}
                  onChange={(e) => setFeedbackType(e.target.value)}
                >
                  <option>内容有误</option>
                  <option>时效过期</option>
                  <option>逻辑不通</option>
                  <option>其他问题</option>
                </select>
              </div>
              <div className="sq-modal__field">
                <label className="sq-modal__label">详细说明</label>
                <textarea
                  className="sq-modal__textarea"
                  placeholder="请描述具体错误内容..."
                  value={feedbackDetail}
                  onChange={(e) => setFeedbackDetail(e.target.value)}
                />
              </div>
              <button
                className="sq-modal__submit"
                onClick={handleSubmitFeedback}
                disabled={feedbackSubmitting}
              >
                {feedbackSubmitting ? '提交中...' : '提交反馈'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMsg && <div className="sq-toast">{toastMsg}</div>}
    </div>
  );
}
