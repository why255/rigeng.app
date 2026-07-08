/**
 * M13-P2 数据分析·数据洞察页 · 移动版
 * 对齐 m13-p2-mobile.html：双维度趋势、SVG饼图、情绪评分、效能预警、语音播报、推荐服务
 * 品牌色: #C03A39
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/AppShell';
import { Card, Text } from '@/components/primitives';
import * as knowledgeApi from '@/api/knowledge';
import type { TrendPoint, DistributionItem } from '@/api/knowledge';
import '../pages.css';
import './knowledge.css';

/** Mobile dual-line SVG chart */
function MobileDualTrendChart({
  data1, data2, labels,
}: {
  data1: number[]; data2: number[]; labels: string[];
}) {
  const w = 310;
  const h = 150;
  const pad = 25;
  const allVals = [...data1, ...data2];
  const maxVal = Math.max(...allVals, 1);
  const minVal = Math.min(...allVals, 0);
  const range = maxVal - minVal || 1;

  const pts1 = data1.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, data1.length - 1);
    const y = h - pad - ((v - minVal) / range) * (h - pad * 2);
    return [x, y] as const;
  });
  const pts2 = data2.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, data2.length - 1);
    const y = h - pad - ((v - minVal) / range) * (h - pad * 2);
    return [x, y] as const;
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={150} role="img">
      {[20, 52, 85, 118].map((y) => (
        <line key={y} x1={pad} y1={y} x2={w - pad} y2={y} stroke="#F5F3EF" strokeWidth={1} />
      ))}
      <polyline
        points={pts1.map((p) => p.join(',')).join(' ')}
        fill="none"
        stroke="#C03A39"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points={pts2.map((p) => p.join(',')).join(' ')}
        fill="none"
        stroke="#E8A94D"
        strokeWidth={2}
        strokeDasharray="4 2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {labels.map((l, i) => (
        <text key={l} x={pts1[i]?.[0] ?? 0} y={h - 4} fontSize={8} fill="#999" textAnchor="middle">
          {l}
        </text>
      ))}
    </svg>
  );
}

/** Mobile SVG pie chart */
function MobilePieChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const size = 100;
  const c = size / 2;
  const r = 40;
  const strokeW = 20;

  let cumulativeDash = 0;
  const circumference = 2 * Math.PI * r;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={96} height={96} role="img">
        {data.map((d, i) => {
          const dashLen = (d.value / total) * circumference;
          const dashOffset = -cumulativeDash;
          cumulativeDash += dashLen;
          return (
            <circle
              key={i}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={strokeW}
              strokeDasharray={`${dashLen} ${circumference - dashLen}`}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${c} ${c})`}
            />
          );
        })}
        <text x={c} y={c - 4} textAnchor="middle" fontSize={14} fontWeight={700} fill="#333">{total}%</text>
      </svg>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.map((d) => (
          <div key={d.name} className="pg-row" style={{ justifyContent: 'space-between' }}>
            <div className="pg-row" style={{ gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: d.color }} />
              <Text level="l7" color="var(--color-neutral-600)">{d.name}</Text>
            </div>
            <Text level="l7" color="var(--color-neutral-800)" style={{ fontWeight: 700 }}>{d.value}%</Text>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DataAnalytics() {
  const navigate = useNavigate();
  const [trendView, setTrendView] = useState<'week' | 'month'>('week');
  const [voiceOn, setVoiceOn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        await Promise.all([
          knowledgeApi.fetchTrend(trendView === 'week' ? 7 : 30).catch(() => []),
          knowledgeApi.fetchDistribution().catch(() => []),
        ]);
      } catch {
        // fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [trendView]);

  const weekLabels = ['一', '二', '三', '四', '五', '六', '日'];
  const completionData = [82, 85, 78, 92, 88, 95, 87.5];
  const sopData = [18, 19, 21, 20, 22, 24, 24];

  const pieData = [
    { name: '计划执行', value: 45, color: '#C03A39' },
    { name: '复盘沉淀', value: 30, color: '#E8A94D' },
    { name: '知识积累', value: 25, color: '#4CAF50' },
  ];

  return (
    <PageContainer width="dashboard">
      <div data-module="data-analytics-insight" className="rg-page">
        {/* 面包屑 + 头部 */}
        <div style={{ padding: 'var(--spacing-md) var(--spacing-md) 0' }}>
          <nav className="kb-breadcrumb">
            <span>我的智库</span>
            <span className="kb-breadcrumb__sep">›</span>
            <a onClick={() => navigate('/m/data-analytics')} style={{ cursor: 'pointer', color: '#C03A39' }}>
              数据分析
            </a>
            <span className="kb-breadcrumb__sep">›</span>
            <span className="kb-breadcrumb__current">数据洞察</span>
          </nav>
          <Text level="l6" as="p" color="var(--color-neutral-600)" style={{ marginBottom: 2 }}>
            日耕朝夕，耕愈工作，耕暖生活
          </Text>
          <Text level="l4" as="h2" color="var(--color-brand-primary)" style={{ marginTop: 2 }}>
            数据照一照，看到好自己
          </Text>
        </div>

        {/* 返回链接 */}
        <a
          className="kb-back-link"
          onClick={() => navigate('/m/data-analytics')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '0 var(--spacing-md)',
            marginTop: 'var(--spacing-md)',
            cursor: 'pointer',
          }}
        >
          ← 返回概览面板
        </a>

        {/* 加载状态 */}
        {loading && (
          <div className="kb-loading" style={{ padding: 'var(--spacing-xl)' }}>
            <div className="kb-loading-spinner" />
            <Text level="l5" as="div" color="var(--color-neutral-500)" style={{ marginTop: 12 }}>
              数据深度分析中…
            </Text>
          </div>
        )}

        {/* 多维趋势洞察 */}
        <div style={{ padding: '0 var(--spacing-md)', marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
          <Card>
            <div className="pg-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
              <Text level="l4" as="div" style={{ fontWeight: 700 }}>多维趋势洞察</Text>
              <div style={{ display: 'flex', background: '#F5F3EF', borderRadius: 8, padding: 2 }}>
                <button
                  style={{
                    padding: '3px 10px',
                    fontSize: 10,
                    fontWeight: 700,
                    borderRadius: 6,
                    border: 'none',
                    background: trendView === 'week' ? '#fff' : 'transparent',
                    color: trendView === 'week' ? '#C03A39' : '#999',
                    boxShadow: trendView === 'week' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => setTrendView('week')}
                >
                  本周
                </button>
                <button
                  style={{
                    padding: '3px 10px',
                    fontSize: 10,
                    fontWeight: 700,
                    borderRadius: 6,
                    border: 'none',
                    background: trendView === 'month' ? '#fff' : 'transparent',
                    color: trendView === 'month' ? '#C03A39' : '#999',
                    boxShadow: trendView === 'month' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => setTrendView('month')}
                >
                  本月
                </button>
              </div>
            </div>

            {/* 图例 */}
            <div className="pg-row" style={{ gap: 16, marginBottom: 'var(--spacing-sm)' }}>
              <div className="pg-row" style={{ gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#C03A39' }} />
                <Text level="l7" color="var(--color-neutral-400)">计划完成率</Text>
              </div>
              <div className="pg-row" style={{ gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#E8A94D' }} />
                <Text level="l7" color="var(--color-neutral-400)">SOP沉淀量</Text>
              </div>
            </div>

            <MobileDualTrendChart data1={completionData} data2={sopData} labels={weekLabels} />
          </Card>
        </div>

        {/* 核心指标构成 (SVG饼图) */}
        <div style={{ padding: '0 var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
          <Card>
            <Text level="l4" as="div" style={{ fontWeight: 700, marginBottom: 'var(--spacing-md)' }}>
              核心指标构成
            </Text>
            <MobilePieChart data={pieData} />
          </Card>
        </div>

        {/* 情绪评分面板 */}
        <div style={{ padding: '0 var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
          <Card>
            <div className="pg-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
              <Text level="l4" as="div" style={{ fontWeight: 700 }}>本周情绪评分</Text>
              <button style={{
                fontSize: 10, color: '#C03A39', fontWeight: 700,
                padding: '2px 8px', background: 'rgba(192,58,57,0.1)', borderRadius: 8, border: 'none', cursor: 'pointer',
              }}>
                手动修正
              </button>
            </div>
            <div className="pg-row" style={{ alignItems: 'flex-end', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
              <Text level="l0" color="#27AE60" style={{ fontSize: 36, fontWeight: 800 }}>+7.2</Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 4 }}>
                <div className="pg-row" style={{ gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#27AE60' }} />
                  <Text level="l7" color="var(--color-neutral-500)">智能分析结果</Text>
                </div>
                <div className="pg-row" style={{ gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#BCAAA4' }} />
                  <Text level="l7" color="var(--color-neutral-500)">自我标注参考</Text>
                </div>
              </div>
            </div>

            {/* 情绪渐变条 */}
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <div style={{
                height: 10, borderRadius: 999,
                background: 'linear-gradient(to right, #E57373, #FFF9C4, #81C784)',
                width: '100%',
              }} />
              <div style={{
                position: 'absolute', top: '50%', left: '86%', transform: 'translate(-50%, -50%)',
                width: 16, height: 16, borderRadius: '50%', background: '#fff',
                border: '2px solid #27AE60', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
              }} />
            </div>
            <div className="pg-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
              <Text level="l7" color="var(--color-neutral-400)">-10 焦虑</Text>
              <Text level="l7" color="var(--color-neutral-400)">0 平静</Text>
              <Text level="l7" color="var(--color-neutral-400)">+10 心流</Text>
            </div>
            <div style={{
              padding: 'var(--spacing-sm)',
              background: '#F5F3EF',
              borderRadius: 8,
              borderLeft: '4px solid #27AE60',
            }}>
              <Text level="l7" color="var(--color-neutral-600)" style={{ lineHeight: 1.5 }}>
                姐，本周您的情绪多处于"心流"状态，主要集中在完成高难度任务后。
              </Text>
            </div>
          </Card>
        </div>

        {/* 效能预警 */}
        <div style={{ padding: '0 var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
          <Card style={{ backgroundColor: '#FFF3E0', border: '1px solid #FFB74D' }}>
            <div className="pg-row" style={{ gap: 'var(--spacing-sm)', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 20, color: '#E65100', flexShrink: 0 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <Text level="l5" as="div" color="#E65100" style={{ fontWeight: 700, marginBottom: 4 }}>
                  效能预警
                </Text>
                <Text level="l7" color="#795548" style={{ lineHeight: 1.5 }}>
                  检测到"朝有规划"模块的执行率已连续 3 天低于平均水平，建议适当降低单日任务复杂度。
                </Text>
              </div>
            </div>
          </Card>
        </div>

        {/* 语音播报入口 */}
        <div style={{ padding: '0 var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
          <Card clickable onClick={() => setVoiceOn(!voiceOn)}>
            <div className="pg-row" style={{ justifyContent: 'space-between' }}>
              <div className="pg-row" style={{ gap: 'var(--spacing-sm)' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'rgba(192,58,57,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#C03A39', fontSize: 18,
                }}>
                  🔊
                </div>
                <Text level="l5" as="div" style={{ fontWeight: 700 }}>语音播报今日核心洞察</Text>
              </div>
              {/* Toggle switch */}
              <div style={{
                width: 40, height: 24, borderRadius: 999,
                background: voiceOn ? '#C03A39' : '#E8E0D6',
                position: 'relative', transition: 'background 0.2s',
                flexShrink: 0,
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3,
                  left: voiceOn ? 19 : 3,
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                }} />
              </div>
            </div>
          </Card>
        </div>

        {/* 推荐服务 */}
        <div style={{ padding: '0 var(--spacing-md)', marginBottom: 'var(--spacing-xl)' }}>
          <Card>
            <div className="pg-row" style={{ gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'rgba(192,58,57,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#C03A39', fontSize: 24, flexShrink: 0,
              }}>
                💝
              </div>
              <div>
                <Text level="l4" as="div" style={{ fontWeight: 700 }}>1对1职业规划咨询</Text>
                <Text level="l7" color="var(--color-neutral-400)" style={{ marginTop: 2 }}>
                  基于您的数据模型，推荐深度咨询
                </Text>
              </div>
            </div>
            <button style={{
              width: '100%', padding: '12px 0',
              background: '#C03A39', color: '#fff',
              border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', boxShadow: '0 4px 12px rgba(192,58,57,0.2)',
            }}>
              立即预约导师
            </button>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
