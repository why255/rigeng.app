/* =============================================================
 * 16 数据图表组件包（轻量内联 SVG · 占位实现）
 * 正式版可替换为 ECharts/Recharts，接口保持一致。
 * ============================================================= */
import './business.css'

const BRAND = '#8B4513'
const ACCENT = '#D2691E'
const GRID = '#E0D5C5'

/* ---------- 折线图 ---------- */
export function LineChart({ title, data, labels }: { title?: string; data: number[]; labels?: string[] }) {
  const w = 320
  const h = 160
  const pad = 24
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, data.length - 1)
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return [x, y] as const
  })
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ')
  return (
    <div className="rg-chart">
      {title && <div className="rg-chart__title">{title}</div>}
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={title ?? '折线图'}>
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke={GRID} />
        <path d={path} fill="none" stroke={BRAND} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={3} fill={BRAND} />
        ))}
        {labels?.map((l, i) => (
          <text key={l} x={pts[i]?.[0]} y={h - pad + 14} fontSize={9} fill="#8D6E63" textAnchor="middle">
            {l}
          </text>
        ))}
      </svg>
    </div>
  )
}

/* ---------- 柱状图 ---------- */
export function BarChart({ title, data, labels }: { title?: string; data: number[]; labels?: string[] }) {
  const w = 320
  const h = 160
  const pad = 24
  const max = Math.max(...data, 1)
  const bw = ((w - pad * 2) / data.length) * 0.6
  const gap = ((w - pad * 2) / data.length) * 0.4
  return (
    <div className="rg-chart">
      {title && <div className="rg-chart__title">{title}</div>}
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={title ?? '柱状图'}>
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke={GRID} />
        {data.map((v, i) => {
          const bh = (v / max) * (h - pad * 2)
          const x = pad + i * (bw + gap) + gap / 2
          return (
            <g key={i}>
              <rect x={x} y={h - pad - bh} width={bw} height={bh} rx={4} fill={i % 2 ? ACCENT : BRAND} />
              {labels?.[i] && (
                <text x={x + bw / 2} y={h - pad + 14} fontSize={9} fill="#8D6E63" textAnchor="middle">
                  {labels[i]}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/* ---------- 雷达图 ---------- */
export function RadarChart({
  title,
  axes,
  values,
  color = BRAND,
}: {
  title?: string
  axes: string[]
  values: number[] // 0~100
  color?: string
}) {
  const size = 200
  const c = size / 2
  const r = size / 2 - 28
  const n = axes.length
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2
  const point = (i: number, ratio: number) => [c + Math.cos(angle(i)) * r * ratio, c + Math.sin(angle(i)) * r * ratio] as const
  const rings = [0.25, 0.5, 0.75, 1]
  const dataPts = values.map((v, i) => point(i, Math.max(0, Math.min(1, v / 100))))
  const dataPath = dataPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + ' Z'
  return (
    <div className="rg-chart">
      {title && <div className="rg-chart__title">{title}</div>}
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" role="img" aria-label={title ?? '雷达图'}>
        {rings.map((ring) => (
          <polygon
            key={ring}
            points={axes.map((_, i) => point(i, ring).join(',')).join(' ')}
            fill="none"
            stroke={GRID}
            strokeWidth={1}
          />
        ))}
        {axes.map((_, i) => {
          const p = point(i, 1)
          return <line key={i} x1={c} y1={c} x2={p[0]} y2={p[1]} stroke={GRID} strokeWidth={1} />
        })}
        <path d={dataPath} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={2} />
        {axes.map((a, i) => {
          const p = point(i, 1.16)
          return (
            <text key={a} x={p[0]} y={p[1]} fontSize={9} fill="#5D4037" textAnchor="middle" dominantBaseline="middle">
              {a}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
