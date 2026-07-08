/**
 * 暮有复盘 · 诊断问卷表单。
 * 移动端和 PC 端共用。
 *
 * 移动端：Q2-Q4 为可选，显示"稍后在电脑上填写"按钮。
 * PC 端：全部必填，不显示"稍后在电脑上填写"按钮。
 */
import type { DiagnosisAnswers } from '../../../api/reviews';
import { GOAL_OPTIONS, BRAND_COLOR } from './review-constants';
import type { GoalOption } from './review-constants';

interface DiagnosisFormProps {
  diagnosis: DiagnosisAnswers;
  onChange: (field: keyof DiagnosisAnswers, value: string) => void;
  onSubmit: () => void;
  submitted?: boolean;
  submitting?: boolean;
  /** PC 端为 true（全部必填），移动端为 false（Q2-Q4 可选） */
  requireAll?: boolean;
  /** 移动端专属：点击"稍后在电脑上填写"的回调 */
  onFillLater?: () => void;
}

export function DiagnosisForm({
  diagnosis,
  onChange,
  onSubmit,
  submitted = false,
  submitting = false,
  requireAll = false,
  onFillLater,
}: DiagnosisFormProps) {
  const labelStyle: React.CSSProperties = {
    fontSize: 14, fontWeight: 600, color: '#333', marginBottom: 10,
  };

  const textareaStyle: React.CSSProperties = {
    width: '100%', padding: 12, borderRadius: 8,
    border: '1px solid #E8E0D6', fontSize: 14, color: '#333',
    resize: 'vertical', fontFamily: 'inherit', outline: 'none',
    background: '#FAFAFA', boxSizing: 'border-box',
  };

  const requiredMark = requireAll ? '*' : '';
  const optionalMark = requireAll ? '（必填）' : '（可选）';

  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 20, marginBottom: 16,
      border: '1px solid #E8E0D6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
        paddingBottom: 12, borderBottom: '1px solid #F5F3EF',
      }}>
        <span style={{ fontSize: 24, color: BRAND_COLOR }}>📝</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#333' }}>复盘诊断问卷</span>
      </div>

      {/* Q1: 目标完成情况 */}
      <div style={{ marginBottom: 20 }}>
        <p style={labelStyle}>1. 今日最重要的目标完成了吗？{requiredMark}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {GOAL_OPTIONS.map((opt: GoalOption) => (
            <label
              key={opt.value}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${diagnosis.goal_completion === opt.value ? BRAND_COLOR : '#E8E0D6'}`,
                background: diagnosis.goal_completion === opt.value ? 'rgba(192, 58, 57, 0.05)' : '#fff',
                color: diagnosis.goal_completion === opt.value ? BRAND_COLOR : '#666',
              }}
            >
              <input
                type="radio" name="goal_completion" value={opt.value}
                checked={diagnosis.goal_completion === opt.value}
                onChange={(e) => onChange('goal_completion', e.target.value)}
                style={{ accentColor: BRAND_COLOR }}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* Q2: 新经验 */}
      <div style={{ marginBottom: 20 }}>
        <p style={labelStyle}>2. 今天学到了什么新经验？{optionalMark}</p>
        <textarea
          style={textareaStyle}
          rows={2}
          placeholder={`描述今天最有价值的经验…${requireAll ? '（必填）' : ''}`}
          value={diagnosis.new_experience}
          onChange={(e) => onChange('new_experience', e.target.value)}
        />
      </div>

      {/* Q3: 改进方向 */}
      <div style={{ marginBottom: 20 }}>
        <p style={labelStyle}>3. 有哪些可以改进的地方？{optionalMark}</p>
        <textarea
          style={textareaStyle}
          rows={2}
          placeholder={`记录不足和改进方向…${requireAll ? '（必填）' : ''}`}
          value={diagnosis.improvements}
          onChange={(e) => onChange('improvements', e.target.value)}
        />
      </div>

      {/* Q4: 明日优先事项 */}
      <div style={{ marginBottom: 20 }}>
        <p style={labelStyle}>4. 明天的优先事项是什么？{optionalMark}</p>
        <textarea
          style={textareaStyle}
          rows={2}
          placeholder={`写下明天的第一要务…${requireAll ? '（必填）' : ''}`}
          value={diagnosis.tomorrow_priority}
          onChange={(e) => onChange('tomorrow_priority', e.target.value)}
        />
      </div>

      {/* 提交按钮 */}
      <button
        onClick={onSubmit}
        disabled={submitted || submitting}
        style={{
          width: '100%', padding: '12px 0', fontSize: 15, fontWeight: 600,
          color: '#fff', border: 'none', borderRadius: 10, cursor: submitted ? 'default' : 'pointer',
          background: submitted ? '#22C55E' : BRAND_COLOR,
          boxShadow: submitted ? 'none' : `0 2px 8px rgba(192,58,57,0.2)`,
        }}
      >
        {submitted ? '✓ 已提交诊断' : submitting ? '提交中…' : `提交诊断${requireAll ? '（全部必填）' : ''}`}
      </button>

      {/* 移动端专属：稍后在电脑上填写 */}
      {!requireAll && !submitted && onFillLater && (
        <button
          onClick={onFillLater}
          style={{
            width: '100%', marginTop: 8, padding: '10px 0', fontSize: 14, fontWeight: 500,
            color: '#666', background: 'transparent', border: '1px solid #E8E0D6',
            borderRadius: 10, cursor: 'pointer',
          }}
        >
          <span style={{ marginRight: 6 }}>💻</span>
          稍后在电脑上填写完整版
        </button>
      )}
    </div>
  );
}
