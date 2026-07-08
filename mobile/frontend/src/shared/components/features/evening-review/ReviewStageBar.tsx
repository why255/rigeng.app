/**
 * 暮有复盘 · 五阶段进度指示器。
 * 移动端和 PC 端共用。
 *
 * 移动端：显示只读进度条，不响应点击。
 * PC 端：可点击各阶段节点跳转。
 */
import type { ReviewStage } from '../../../api/reviews';
import { STAGES } from './review-constants';

interface ReviewStageBarProps {
  /** 当前所在阶段 */
  currentStage: ReviewStage;
  /** 是否可点击跳阶段（PC 端为 true，移动端为 false） */
  clickable?: boolean;
  /** 点击阶段回调（仅 clickable=true 时生效） */
  onStageClick?: (stage: ReviewStage, index: number) => void;
}

export function ReviewStageBar({
  currentStage,
  clickable = false,
  onStageClick,
}: ReviewStageBarProps) {
  const stageIndex = STAGES.findIndex(s => s.key === currentStage);

  return (
    <div style={{ padding: '12px 16px', marginBottom: 16, background: '#fff', borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {STAGES.map((s, i) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: i < STAGES.length - 1 ? 1 : 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div
                onClick={() => clickable && onStageClick?.(s.key, i)}
                style={{
                  width: 24, height: 24, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700,
                  cursor: clickable ? 'pointer' : 'default',
                  ...(i < stageIndex
                    ? { background: '#22C55E', color: '#fff' }
                    : i === stageIndex
                      ? { background: '#FFB74D', color: '#fff' }
                      : { border: '2px solid #D4C5B0', color: '#BCAAA4', background: 'transparent' }),
                }}
              >
                {i < stageIndex ? '✓' : i === stageIndex ? '●' : '○'}
              </div>
              <span style={{
                fontSize: 9,
                color: i < stageIndex ? '#666' : i === stageIndex ? '#FFB74D' : '#999',
                fontWeight: i === stageIndex ? 500 : 400,
              }}>{s.label}</span>
            </div>
            {i < STAGES.length - 1 && (
              <div style={{
                flex: 1, height: 2, margin: '0 2px', marginBottom: 16, borderRadius: 1,
                background: i < stageIndex ? '#22C55E' : i === stageIndex ? '#FFB74D' : '#E8E0D6',
              }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
