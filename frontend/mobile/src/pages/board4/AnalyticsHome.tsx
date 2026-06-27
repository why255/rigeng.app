/**
 * M13-P1 数据分析首页 · 移动版
 * 对齐 m13-p1-mobile.html：KPI 卡片、SVG趋势图、SVG柱状图、成长贴士
 * 品牌色: #C03A39
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/AppShell';
import { Card, Text } from '@/components/primitives';
import * as knowledgeApi from '@/api/knowledge';
import type { KpiData, TrendPoint, DistributionItem, DiagnosisData } from '@/api/knowledge';
import '../pages.css';
import './knowledge.css';

/** Mobile SVG trend chart */
function MobileTrendChart({ data, labels }: { data: number[]; labels: string[] }) {
  const w = 320;
  const h = 160;
  const pad = 30;
  const maxVal = Math.max(...data, 1);
  const minVal = Math.min(...data, 0);
  const range = maxVal - minVal || 1;

  const pts = data.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, data.length - 1);
    const y = h - pad - ((v - minVal) / range) * (h - pad * 2);
    return [x, y] as const;
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={160} preserveAspectRatio="none" role="img">
      {[20, 55, 90, 125].map((y) => (
        <line key={y} x1={pad} y1={y} x2={w - pad} y2={y} stroke="#F5F3EF" strokeWidth={1} />
      ))}
      <polyline
        points={pts.map((p) => p.join(',')).join(' ')}
        fill="none"
        stroke="#C03A39"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={4} fill="#fff" stroke="#C03A39" strokeWidth={2} />
      ))}
      {labels.map((l, i) => (
        <text key={l} x={pts[i]?.[0] ?? 0} y={h - pad + 16} fontSize={10} fill="#999" textAnchor="middle">
          {l}
        </text>
      ))}
    </svg>
  );
}

/** Mobile SVG bar chart */
function MobileBarChart({ data, labels, colors }: { data: number[]; labels: string[]; colors: string[] }) {
  const w = 310;
  const h = 140;
  const pad = 20;
  const barW = 25;
  const maxVal = Math.max(...data, 1);
  const totalBars = data.length;
  const totalWidth = totalBars * barW + (totalBars - 1) * (barW * 0.5);
  const startX = (w - totalWidth) / 2;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={140} preserveAspectRatio="none" role="img">
      {data.map((v, i) => {
        const bh = (v / maxVal) * (h - pad * 2 - 20);
        const x = startX + i * (barW * 1.5);
        const y = h - pad - bh;
        const shortLabel = labels[i]?.length > 3 ? labels[i].slice(0, 3) : labels[i];
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bh} rx={4} fill={colors[i % colors.length]} />
            <text x={x + barW / 2} y={y - 6} fontSize={9} fontWeight={700} fill="#333" textAnchor="middle">
              {v}
            </text>
            <text x={x + barW / 2} y={h - 3} fontSize={8} fill="#999" textAnchor="middle">
              {shortLabel}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function AnalyticsHome() {
  const navigate = useNavigate();
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [distribution, setDistribution] = useState<DistributionItem[]>([]);
  const [diagnosis, setDiagnosis] = useState<DiagnosisData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [k, t, d, diag] = await Promise.all([
          knowledgeApi.fetchKpi().catch(() => null),
          knowledgeApi.fetchTrend(28, 'week').catch(() => []),
          knowledgeApi.fetchDistribution().catch(() => []),
          knowledgeApi.fetchDiagnosis().catch(() => null),
        ]);
        if (!cancelled) {
          setKpi(k);
          setTrend(t);
          setDistribution(d);
          setDiagnosis(diag);
        }
      } catch {
        if (!cancelled) {
          setKpi({ completionRate: 87.5, completionRateChange: 5.2, sopCount: 24, sopCountChange: 3, streakDays: 0 });
          setTrend([{ label: 'W1', value: 62 }, { label: 'W2', value: 71 }, { label: 'W3', value: 78 }, { label: 'W4', value: 87.5 }]);
          setDistribution([
            { name: '朝规划', value: 8 }, { name: '暮复盘', value: 5 },
            { name: '智记录', value: 12 }, { name: '智问答', value: 7 }, { name: '智办公', value: 4 },
          ]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const trendData = trend.length > 0 ? trend.map((p) => p.value) : [62, 71, 78, 87.5];
  const trendLbls = trend.length > 0 ? trend.map((p) => p.label) : ['W1', 'W2', 'W3', 'W4'];

  const distData = distribution.length > 0 ? distribution.map((d) => d.value) : [8, 5, 12, 7, 4];
  const distLbls = distribution.length > 0 ? distribution.map((d) => d.name) : ['朝规划', '暮复盘', '智记录', '智问答', '智办公'];
  const distColors = ['#C03A39', '#E8A94D', '#4CAF50', '#2196F3', '#9C27B0'];

  return (
    <PageContainer width="dashboard">
      <div data-module="data-analytics" className="rg-page">
        {/* 头部 */}
        <div style={{ padding: 'var(--spacing-md) var(--spacing-md) 0' }}>
          <div className="kb-breadcrumb">
            <span>我的智库</span>
            <span className="kb-breadcrumb__sep">›</span>
            <span className="kb-breadcrumb__current">数据分析</span>
          </div>
          <Text level="l6" as="p" color="var(--color-neutral-600)" style={{ marginBottom: 2 }}>
            日耕朝夕，耕愈工作，耕暖生活
          </Text>
          <Text level="l1" as="h2" color="var(--color-brand-primary)" style={{ marginTop: 4 }}>
            数据照一照，看到好自己
          </Text>
        </div>

        {/* 核心指标卡片 */}
        <div style={{ padding: 'var(--spacing-md)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
          {/* 计划完成率 - 可点击跳转 */}
          <Card
            clickable
            onClick={() => navigate('/m/data-analytics/insight')}
            barColor="#C03A39"
          >
            <div className="pg-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
              <Text level="l7" color="var(--color-neutral-500)">计划完成率</Text>
              <span style={{ fontSize: 12, color: '#BCAAA4' }}>›</span>
            </div>
            <Text level="l0" color="#C03A39" style={{ fontSize: 28, fontWeight: 800 }}>
              {loading ? '--' : `${kpi?.completionRate ?? 0}%`}
            </Text>
            {!loading && (kpi?.completionRateChange ?? 0) > 0 && (
              <div className="pg-row" style={{ gap: 4, marginTop: 2 }}>
                <span style={{ fontSize: 10, color: '#27AE60' }}>↑</span>
                <Text level="l7" color="#27AE60">+{(kpi?.completionRateChange ?? 0).toFixed(1)}%</Text>
              </div>
            )}
            <div style={{ marginTop: 'var(--spacing-sm)', height: 6, borderRadius: 999, background: '#F5F3EF', overflow: 'hidden' }}>
              <div style={{ width: `${kpi?.completionRate ?? 0}%`, height: '100%', background: '#C03A39', borderRadius: 999 }} />
            </div>
          </Card>

          {/* SOP 沉淀量 */}
          <Card barColor="#D4A574">
            <Text level="l7" color="var(--color-neutral-500)" style={{ marginBottom: 'var(--spacing-sm)' }}>
              SOP沉淀量
            </Text>
            <Text level="l0" color="#C03A39" style={{ fontSize: 28, fontWeight: 800 }}>
              {loading ? '--' : kpi?.sopCount ?? 0}
            </Text>
            {!loading && (
              <Text level="l7" color="var(--color-neutral-400)" style={{ marginTop: 2 }}>
                本月新增 {kpi?.sopCountChange ?? 0} 篇
              </Text>
            )}
            <div className="pg-row" style={{ gap: 4, marginTop: 'var(--spacing-sm)' }}>
              <span style={{ fontSize: 14, color: '#C03A39' }}>📄</span>
              <Text level="l7" color="var(--color-neutral-500)">累计文档库</Text>
            </div>
          </Card>
        </div>

        {/* 趋势图 */}
        <div style={{ padding: '0 var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
          <Card>
            <div className="pg-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
              <Text level="l4" as="div" style={{ fontWeight: 700 }}>近期完成趋势</Text>
              <Text level="l7" color="var(--color-neutral-400)">近4周数据</Text>
            </div>
            <MobileTrendChart data={trendData} labels={trendLbls} />
          </Card>
        </div>

        {/* 各模块SOP分布 */}
        <div style={{ padding: '0 var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
          <Card>
            <Text level="l4" as="div" style={{ fontWeight: 700, marginBottom: 'var(--spacing-md)' }}>
              各模块SOP分布
            </Text>
            <MobileBarChart data={distData} labels={distLbls} colors={distColors} />
          </Card>
        </div>

        {/* 双向诊断（步骤13核心） */}
        {diagnosis && !loading && (
          <div style={{ padding: '0 var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
            <div
              style={{
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--spacing-md)',
                background:
                  diagnosis.type === 'positive'
                    ? 'linear-gradient(135deg, rgba(192,58,57,0.06), rgba(76,175,80,0.08))'
                    : diagnosis.type === 'encouraging'
                      ? 'linear-gradient(135deg, rgba(232,169,77,0.08), rgba(255,243,224,0.6))'
                      : 'linear-gradient(135deg, rgba(107,143,191,0.08), rgba(227,242,253,0.6))',
                border:
                  diagnosis.type === 'positive'
                    ? '1px solid rgba(192,58,57,0.12)'
                    : diagnosis.type === 'encouraging'
                      ? '1px solid rgba(232,169,77,0.2)'
                      : '1px solid rgba(107,143,191,0.15)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--spacing-sm)',
              }}
            >
              <span style={{ fontSize: 28, flexShrink: 0, lineHeight: 1 }}>
                {diagnosis.emoji}
              </span>
              <div style={{ flex: 1 }}>
                <Text level="l5" as="div" style={{
                  fontWeight: 600,
                  lineHeight: 1.5,
                  color:
                    diagnosis.type === 'positive' ? '#2E7D32'
                    : diagnosis.type === 'encouraging' ? '#E65100'
                    : '#1565C0',
                }}>
                  {diagnosis.message}
                </Text>
                {diagnosis.suggestion && (
                  <Text level="l7" color="var(--color-neutral-500)" style={{ marginTop: 4 }}>
                    💡 {diagnosis.suggestion}
                  </Text>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 成长贴士（无诊断数据时显示） */}
        {!diagnosis && !loading && (
          <div style={{ padding: '0 var(--spacing-md)', marginBottom: 'var(--spacing-xl)' }}>
            <Card style={{ backgroundColor: '#FFF8E1', border: '1px solid #FFE082' }}>
              <div className="pg-row" style={{ gap: 'var(--spacing-sm)', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 20, color: '#E8A94D', flexShrink: 0 }}>💡</span>
                <div>
                  <Text level="l5" as="div" color="#856404" style={{ fontWeight: 700, marginBottom: 4 }}>
                    成长贴士
                  </Text>
                  <Text level="l7" color="var(--color-neutral-600)" style={{ lineHeight: 1.5 }}>
                    数据积累中，坚持使用会越来越精准~
                  </Text>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
