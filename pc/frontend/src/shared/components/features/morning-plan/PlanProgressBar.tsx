/**
 * 朝有规划 · 进度条。
 * 对齐 m1p*.html 原型，移动端和 PC 端共用。
 */

interface PlanProgressBarProps {
  /** 已完成数 */
  completed: number;
  /** 总数 */
  total: number;
  /** 高度 */
  height?: number;
}

export function PlanProgressBar({ completed, total, height = 10 }: PlanProgressBarProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (total === 0) {
    return (
      <div style={{
        width: '100%', height, background: '#E8E0D6',
        borderRadius: 99, overflow: 'hidden',
      }}>
        <div style={{
          width: '0%', height: '100%', borderRadius: 99,
          background: 'linear-gradient(90deg, #C03A39, #D4A574)',
          transition: 'width 0.8s ease-out',
        }} />
      </div>
    );
  }

  return (
    <div style={{
      width: '100%', height, background: '#E8E0D6',
      borderRadius: 99, overflow: 'hidden',
    }}>
      <div style={{
        width: `${pct}%`, height: '100%', borderRadius: 99,
        background: 'linear-gradient(90deg, #C03A39, #D4A574)',
        transition: 'width 0.8s ease-out',
      }} />
    </div>
  );
}
