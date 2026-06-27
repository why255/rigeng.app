/**
 * P3 复盘报告页 — SOP预览 + 诊断问卷 + 归档确认。
 * Route: /m/evening-review/report
 * 对齐 m2-p3.html 设计
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/primitives/toast';
import { CelebrationOverlay } from '@/components/plan/CelebrationOverlay';
import * as reviewsApi from '@/api/reviews';
import type { SopDetail, DiagnosisAnswers } from '@/api/reviews';
import './evening-review.css';

const GOAL_OPTIONS: { value: DiagnosisAnswers['goal_completion']; label: string }[] = [
  { value: 'exceeded', label: '超额完成' },
  { value: 'completed', label: '完成' },
  { value: 'partial', label: '部分完成' },
  { value: 'delayed', label: '延期' },
  { value: 'not_started', label: '未开展' },
];

export function EveningReviewReport() {
  const navigate = useNavigate();
  const toast = useToast();
  const [sop, setSop] = useState<SopDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [diagnosis, setDiagnosis] = useState<DiagnosisAnswers>({
    goal_completion: 'completed',
    new_experience: '',
    improvements: '',
    tomorrow_priority: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [archived, setArchived] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await reviewsApi.fetchTodaySop();
        if (!cancelled) setSop(data);
      } catch {
        // 无SOP数据时使用示例数据
        if (!cancelled) {
          setSop({
            id: 'demo',
            title: '今日复盘萃取',
            steps: [
              { step_number: 1, title: '回顾今日完成事项', description: '盘点今日完成的任务和关键成果，记录完成率和效率数据' },
              { step_number: 2, title: '提炼可复用经验', description: '将今天的成功做法总结为标准流程，形成可复用的SOP' },
              { step_number: 3, title: '明确改进方向', description: '识别不足并制定明天的改进计划，持续优化工作方式' },
            ],
            key_phrases: '"今天最有价值的经验是……请分享一个您过去处理过的类似案例"',
            precautions: '避免情绪化评判，聚焦具体行为和可衡量的结果，而非假设性回答',
            quality_score: 4,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleDiagnosisChange = (field: keyof DiagnosisAnswers, value: string) => {
    setDiagnosis(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmitDiagnosis = async () => {
    try {
      await reviewsApi.submitDiagnosis(diagnosis);
      setSubmitted(true);
      toast('诊断问卷已提交', 'success');
    } catch {
      toast('提交失败，请稍后重试', 'error');
    }
  };

  const handleArchive = async () => {
    setArchiving(true);
    try {
      await reviewsApi.archiveReview();
      setShowCelebration(true);
      setArchived(true);
      toast('复盘成果已归档', 'success');
      setTimeout(() => {
        setShowCelebration(false);
        navigate('/m/evening-review/history');
      }, 2500);
    } catch {
      toast('归档失败，请稍后重试', 'error');
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div data-module="evening-review">
      {showCelebration && <CelebrationOverlay />}

      <div className="er-page">
        {/* 品牌标语区 */}
        <section className="er-hero">
          <div className="er-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</div>
          <div className="er-hero__divider" />
          <h1 className="er-hero__title--small">暮有复盘</h1>
        </section>

        {/* SOP 预览卡片 */}
        <div className="er-card">
          <div className="er-card__header">
            <span className="er-card__header-icon" style={{ color: '#C03A39' }}>📄</span>
            <h2 className="er-card__header-title">萃取SOP</h2>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>加载SOP数据…</div>
          ) : sop ? (
            <>
              <div className="er-sop-preview">
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#333', marginBottom: 16 }}>
                  {sop.title}
                </h3>
                {sop.steps.map((step) => (
                  <div key={step.step_number} className="er-sop-step">
                    <div className="er-sop-step__number">{step.step_number}</div>
                    <div className="er-sop-step__content">
                      <div className="er-sop-step__title">{step.title}</div>
                      <div className="er-sop-step__desc">{step.description}</div>
                    </div>
                  </div>
                ))}
              </div>

              {(sop.key_phrases || sop.precautions) && (
                <div className="er-sop-extra">
                  {sop.key_phrases && (
                    <div className="er-sop-extra__item">
                      <span className="er-sop-extra__icon">🔑</span>
                      <span><strong>关键话术：</strong>{sop.key_phrases}</span>
                    </div>
                  )}
                  {sop.precautions && (
                    <div className="er-sop-extra__item">
                      <span className="er-sop-extra__icon">⚠️</span>
                      <span><strong>注意事项：</strong>{sop.precautions}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', color: '#999', padding: '24px 0' }}>
              暂无今日SOP数据，请先完成复盘对话
            </div>
          )}
        </div>

        {/* 诊断问卷卡片 */}
        <div className="er-card">
          <div className="er-card__header">
            <span className="er-card__header-icon" style={{ color: '#C03A39' }}>📝</span>
            <h2 className="er-card__header-title">复盘诊断问卷</h2>
          </div>

          {/* Q1: 目标完成情况 */}
          <div className="er-diagnosis-q">
            <div className="er-diagnosis-q__label">1. 今日最重要的目标完成了吗？</div>
            <div className="er-diagnosis-radio-group">
              {GOAL_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`er-diagnosis-radio ${diagnosis.goal_completion === opt.value ? 'er-diagnosis-radio--checked' : ''}`}
                >
                  <input
                    type="radio"
                    name="goal_completion"
                    value={opt.value}
                    checked={diagnosis.goal_completion === opt.value}
                    onChange={(e) => handleDiagnosisChange('goal_completion', e.target.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Q2: 新经验 */}
          <div className="er-diagnosis-q">
            <div className="er-diagnosis-q__label">2. 今天学到了什么新经验？</div>
            <textarea
              className="er-diagnosis-textarea"
              rows={2}
              placeholder="描述今天最有价值的经验…"
              value={diagnosis.new_experience}
              onChange={(e) => handleDiagnosisChange('new_experience', e.target.value)}
            />
          </div>

          {/* Q3: 改进方向 */}
          <div className="er-diagnosis-q">
            <div className="er-diagnosis-q__label">3. 有哪些可以改进的地方？</div>
            <textarea
              className="er-diagnosis-textarea"
              rows={2}
              placeholder="记录不足和改进方向…"
              value={diagnosis.improvements}
              onChange={(e) => handleDiagnosisChange('improvements', e.target.value)}
            />
          </div>

          {/* Q4: 明日优先事项 */}
          <div className="er-diagnosis-q">
            <div className="er-diagnosis-q__label">4. 明天的优先事项是什么？</div>
            <textarea
              className="er-diagnosis-textarea"
              rows={2}
              placeholder="写下明天的第一要务…"
              value={diagnosis.tomorrow_priority}
              onChange={(e) => handleDiagnosisChange('tomorrow_priority', e.target.value)}
            />
          </div>

          <button
            className="er-btn-primary"
            onClick={handleSubmitDiagnosis}
            disabled={submitted}
            style={submitted ? { background: '#22C55E', boxShadow: 'none' } : {}}
          >
            {submitted ? '✓ 已提交诊断' : '提交诊断'}
          </button>
        </div>

        {/* 操作按钮 */}
        <div className="er-actions">
          <button className="er-btn-secondary" onClick={() => navigate('/m/evening-review')}>
            返回首页
          </button>
          <button
            className="er-btn-primary"
            onClick={handleArchive}
            disabled={archiving || archived}
            style={archived ? { background: '#22C55E', boxShadow: 'none' } : {}}
          >
            {archived ? '✓ 已归档' : archiving ? '归档中…' : '确认归档'}
          </button>
        </div>

        {/* 归档后查看历史 */}
        {archived && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <a
              className="er-nav-link"
              href="#"
              onClick={(e) => { e.preventDefault(); navigate('/m/evening-review/history'); }}
            >
              查看复盘历史 →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
