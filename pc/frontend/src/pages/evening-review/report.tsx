/**
 * P3 复盘报告页 — PC端完整版。
 * Route: /m/evening-review/report
 * PC端专属：诊断问卷全部必填、SOP可编辑、无"稍后再填"按钮
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/shared/components/primitives/toast';
import { CelebrationOverlay } from '@/shared/components/plan/CelebrationOverlay';
import * as reviewsApi from '@/shared/api/reviews';
import type { SopDetail, DiagnosisAnswers } from '@/shared/api/reviews';
import {
  ReviewBrandHero,
  SopPreviewCard,
  DiagnosisForm,
} from '@/shared/components/features/evening-review';
import { SopEditor } from './SopEditor';
import './evening-review.css';

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
  const [editingSop, setEditingSop] = useState<SopDetail | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await reviewsApi.fetchTodaySop();
        if (!cancelled) setSop(data);
      } catch {
        if (!cancelled) {
          setSop({
            id: 'demo', title: '今日复盘萃取',
            steps: [
              { step_number: 1, title: '回顾今日完成事项', description: '盘点今日完成的任务和关键成果，记录完成率和效率数据' },
              { step_number: 2, title: '提炼可复用经验', description: '将今天的成功做法总结为标准流程，形成可复用的SOP' },
              { step_number: 3, title: '明确改进方向', description: '识别不足并制定明天的改进计划，持续优化工作方式' },
            ],
            key_phrases: '"今天最有价值的经验是……"',
            precautions: '避免情绪化评判，聚焦具体行为和可衡量的结果',
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
    // PC端：全部必填
    if (!diagnosis.new_experience.trim() || !diagnosis.improvements.trim() || !diagnosis.tomorrow_priority.trim()) {
      toast('请完成所有诊断问题后再提交', 'error');
      return;
    }
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
        navigate('/m/evening-review');
      }, 2500);
    } catch {
      toast('归档失败，请稍后重试', 'error');
    } finally {
      setArchiving(false);
    }
  };

  const handleSopSave = async (updatedSop: SopDetail) => {
    try {
      await reviewsApi.saveSop({
        title: updatedSop.title,
        steps: updatedSop.steps,
        key_phrases: updatedSop.key_phrases,
        precautions: updatedSop.precautions,
      });
      setSop(updatedSop);
      setEditingSop(null);
      toast('SOP 已保存', 'success');
    } catch {
      toast('保存失败，请稍后重试', 'error');
    }
  };

  return (
    <div data-module="evening-review">
      {showCelebration && <CelebrationOverlay />}
      {editingSop && <SopEditor sop={editingSop} onSave={handleSopSave} onClose={() => setEditingSop(null)} />}

      <div className="er-page" style={{ maxWidth: 800 }}>
        <ReviewBrandHero title="暮有复盘" />

        {/* SOP 预览卡片 */}
        <SopPreviewCard
          sop={sop}
          loading={loading}
          showEdit
          onEdit={() => sop && setEditingSop(sop)}
        />

        {/* 诊断问卷（PC端：全部必填） */}
        <DiagnosisForm
          diagnosis={diagnosis}
          onChange={handleDiagnosisChange}
          onSubmit={handleSubmitDiagnosis}
          submitted={submitted}
          requireAll
        />

        {/* 操作按钮 */}
        <div className="er-actions">
          <button className="er-btn-secondary" onClick={() => navigate('/m/evening-review')}>返回仪表盘</button>
          <button className="er-btn-primary" onClick={handleArchive}
            disabled={archiving || archived} style={archived ? { background: '#22C55E', boxShadow: 'none' } : {}}>
            {archived ? '✓ 已归档' : archiving ? '归档中…' : '确认归档'}
          </button>
        </div>

        {archived && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <a className="er-nav-link" href="#" onClick={(e) => { e.preventDefault(); navigate('/m/evening-review/history'); }}>
              查看复盘历史 →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
