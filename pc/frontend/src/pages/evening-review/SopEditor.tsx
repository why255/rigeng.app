/**
 * SopEditor — SOP 编辑器弹窗（PC端专属）。
 * 可从仪表盘、对话右侧、报告页三处打开。
 * 支持编辑标题、场景、步骤（增删）、话术、注意事项、关联已有SOP。
 */
import { useState } from 'react';
import type { SopDetail, SopStep } from '@/shared/api/reviews';
import './evening-review.css';

interface SopEditorProps {
  sop: SopDetail | null;
  onSave: (sop: SopDetail) => void;
  onClose: () => void;
}

export function SopEditor({ sop, onSave, onClose }: SopEditorProps) {
  const [title, setTitle] = useState(sop?.title ?? '');
  const [scenario, setScenario] = useState('');
  const [steps, setSteps] = useState<SopStep[]>(
    sop?.steps ?? [{ step_number: 1, title: '', description: '' }]
  );
  const [keyPhrases, setKeyPhrases] = useState(sop?.key_phrases ?? '');
  const [precautions, setPrecautions] = useState(sop?.precautions ?? '');
  const [linkedSopId, setLinkedSopId] = useState(sop?.kb_doc_id ?? '');

  const addStep = () => {
    setSteps(prev => [...prev, { step_number: prev.length + 1, title: '', description: '' }]);
  };

  const removeStep = (idx: number) => {
    if (steps.length <= 1) return;
    setSteps(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step_number: i + 1 })));
  };

  const updateStep = (idx: number, field: keyof SopStep, value: string) => {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const handleSave = () => {
    onSave({
      id: sop?.id ?? '',
      title: title || '未命名SOP',
      steps: steps.filter(s => s.title.trim()),
      key_phrases: keyPhrases,
      precautions: precautions,
      quality_score: sop?.quality_score,
      kb_doc_id: linkedSopId || undefined,
    });
  };

  return (
    <div className="er-sop-editor-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="er-sop-editor">
        <div className="er-sop-editor__header" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24,
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: "'ZCOOL XiaoWei', serif" }}>
            ✏️ {sop?.id ? '编辑 SOP' : '新建 SOP'}
          </h2>
          <button onClick={onClose} style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>✕</button>
        </div>

        {/* 标题 */}
        <div className="er-form-group">
          <label className="er-form-label">标题</label>
          <input className="er-form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="SOP 名称" />
        </div>

        {/* 适用场景 */}
        <div className="er-form-group">
          <label className="er-form-label">适用场景</label>
          <input className="er-form-input" value={scenario} onChange={(e) => setScenario(e.target.value)} placeholder="什么情况下使用这个 SOP？" />
        </div>

        {/* 操作步骤 */}
        <div className="er-form-group">
          <label className="er-form-label">操作步骤</label>
          {steps.map((step, i) => (
            <div key={i} className="er-sop-editor__step">
              <span style={{ color: '#999', cursor: 'grab', fontSize: 16, userSelect: 'none' }}>≡</span>
              <span style={{ fontWeight: 700, color: '#C03A39', minWidth: 20 }}>{i + 1}.</span>
              <div style={{ flex: 1 }}>
                <input className="er-form-input" value={step.title} placeholder="步骤动作"
                  onChange={(e) => updateStep(i, 'title', e.target.value)} style={{ marginBottom: 4 }} />
                <textarea className="er-diagnosis-textarea" rows={2} value={step.description}
                  placeholder="详细说明" onChange={(e) => updateStep(i, 'description', e.target.value)} />
              </div>
              <button onClick={() => removeStep(i)}
                style={{ color: '#999', fontSize: 16, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
          ))}
          <button className="er-btn-outline" onClick={addStep} style={{ width: '100%', marginTop: 8 }}>+ 添加步骤</button>
        </div>

        {/* 关键话术 */}
        <div className="er-form-group">
          <label className="er-form-label">关键话术</label>
          <textarea className="er-diagnosis-textarea" rows={2} value={keyPhrases}
            placeholder="执行 SOP 时可参考的话术模板" onChange={(e) => setKeyPhrases(e.target.value)} />
        </div>

        {/* 注意事项 */}
        <div className="er-form-group">
          <label className="er-form-label">注意事项</label>
          <textarea className="er-diagnosis-textarea" rows={2} value={precautions}
            placeholder="容易出错的环节、常见误区" onChange={(e) => setPrecautions(e.target.value)} />
        </div>

        {/* 关联智库 SOP */}
        <div className="er-form-group" style={{ marginBottom: 24 }}>
          <label className="er-form-label">关联已有智库 SOP</label>
          <input className="er-form-input" placeholder="搜索已有 SOP 标题..." value={linkedSopId}
            onChange={(e) => setLinkedSopId(e.target.value)} />
        </div>

        {/* 保存按钮 */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="er-btn-primary" onClick={handleSave} style={{ flex: 1 }}>保存</button>
          <button className="er-btn-secondary" onClick={onClose} style={{ flex: 1 }}>取消</button>
        </div>
      </div>
    </div>
  );
}
