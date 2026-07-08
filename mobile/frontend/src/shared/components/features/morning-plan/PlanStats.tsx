/**
 * 朝有规划 · 统计 3 列栏。
 * 对齐 m1p*.html 原型，移动端和 PC 端共用。
 */

interface StatItem {
  value: string | number;
  label: string;
  /** 值颜色（可选） */
  valueColor?: string;
}

interface PlanStatsProps {
  items: StatItem[];
}

export function PlanStats({ items }: PlanStatsProps) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      marginBottom: 16,
    }}>
      {items.map((item, i) => (
        <div key={i} style={{ textAlign: 'center', flex: 1 }}>
          <div style={{
            fontSize: 24, fontWeight: 700,
            color: item.valueColor ?? '#333',
          }}>
            {item.value}
          </div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}
