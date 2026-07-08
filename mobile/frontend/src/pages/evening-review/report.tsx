/**
 * P3 复盘报告页 — SOP预览 + 诊断问卷 + 归档确认（对齐 m2-p3-mobile.html）。
 * Route: /m/evening-review/report
 *
 * 使用 mp-* BEM 类名（来自 morning-plan.css）+ 内联 style。无 Tailwind CSS。
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useToast } from '@/shared/components/primitives/toast';
import { CelebrationOverlay } from '@/shared/components/plan/CelebrationOverlay';
import * as reviewsApi from '@/shared/api/reviews';
import type { SopDetail, DiagnosisAnswers } from '@/shared/api/reviews';
import {
  ReviewBrandHero,
  SopPreviewCard,
  DiagnosisForm,
} from '@/shared/components/features/evening-review';
import '../morning-plan/morning-plan.css';

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

  const handleArchive = async (skipDiagnosis = false) => {
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
    <div className="mp-mobile-page">
      {showCelebration && <CelebrationOverlay />}

      {/* Header */}
      <header className="mp-mobile-page__header" style={{ height: 48 }}>
        <button className="mp-header-btn" onClick={() => navigate(-1)}>
          <Icon icon="mingcute:arrow-left-fill" style={{ fontSize: '24px' }} />
        </button>
        <span className="font-zcool" style={{ fontSize: '18px', fontWeight: 700, color: '#C03A39' }}>
          复盘报告
        </span>
        <div className="mp-header-spacer" />
      </header>

      {/* Content */}
      <main className="mp-main-scroll">
        <div className="mp-main-padding">
          {/* Brand */}
          <section className="mp-hero">
            <ReviewBrandHero title="暮有复盘" subtitle="睡前做复盘，经验变方法" />
          </section>

          <h2 style={{
            fontSize: 17, fontWeight: 700, color: '#333',
            fontFamily: "'ZCOOL XiaoWei', 'Noto Sans SC', serif",
            marginBottom: 16,
          }}>
            今日复盘报告
          </h2>

          {/* SOP 预览卡片 */}
          <SopPreviewCard sop={sop} loading={loading} />

          {/* 诊断问卷（移动端：可选） */}
          <DiagnosisForm
            diagnosis={diagnosis}
            onChange={handleDiagnosisChange}
            onSubmit={handleSubmitDiagnosis}
            submitted={submitted}
            requireAll={false}
            onFillLater={() => handleArchive(true)}
          />

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: 16, paddingTop: 8 }}>
            <button className="mp-btn-outline" onClick={() => navigate('/m/evening-review/home')}>
              返回首页
            </button>
            <button
              className="mp-btn-primary"
              onClick={() => handleArchive(false)}
              disabled={archiving || archived}
              style={archived ? { background: '#22C55E', boxShadow: 'none' } : { flex: 1 }}
            >
              {archived ? (
                <><Icon icon="mingcute:check-circle-fill" style={{ fontSize: '18px', marginRight: 6, verticalAlign: 'middle' }} />已归档</>
              ) : archiving ? '归档中…' : '确认归档'}
            </button>
          </div>

          {archived && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <a
                onClick={(e) => { e.preventDefault(); navigate('/m/evening-review/history'); }}
                style={{
                  fontSize: 12, color: '#999', textDecoration: 'underline',
                  textUnderlineOffset: 4, cursor: 'pointer',
                }}
              >查看复盘历史</a>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
