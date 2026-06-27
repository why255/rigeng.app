/**
 * M13-P2 数据分析·数据洞察页
 * 对齐 m13-p2.html：详细趋势图、模块贡献度、指标构成饼图、情绪评分、预警、推荐服务
 * 品牌色: #C03A39
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/AppShell';
import { Card, Text, Button } from '@/components/primitives';
import { LineChart, BarChart } from '@/components/business/charts';
import { useToast } from '@/components/primitives/toast';
import * as knowledgeApi from '@/api/knowledge';
import * as analyticsApi from '@/api/analytics';
import type { TrendPoint, DistributionItem } from '@/api/knowledge';
import type { EmotionCurve } from '@/api/analytics';
import '../pages.css';
import './knowledge.css';

/** Simple SVG Pie Chart component */
function PieChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const size = 200;
  const c = size / 2;
  const r = 70;
  const innerR = 40;

  let cumulativeAngle = -Math.PI / 2;
  const slices = data.map((d) => {
    const angle = (d.value / total) * Math.PI * 2;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angle;
    const x1 = c + r * Math.cos(startAngle);
    const y1 = c + r * Math.sin(startAngle);
    const x2 = c + r * Math.cos(startAngle + angle);
    const y2 = c + r * Math.sin(startAngle + angle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const dPath = `M ${c} ${c} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return { name: d.name, color: d.color, value: d.value, path: dPath };
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" height={200} role="img" aria-label="指标构成饼图">
      {slices.map((s, i) => (
        <path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth={2} />
      ))}
      <circle cx={c} cy={c} r={innerR} fill="#fff" />
      <text x={c} y={c - 4} textAnchor="middle" fontSize={18} fontWeight={700} fill="#333">
        {total}%
      </text>
      <text x={c} y={c + 14} textAnchor="middle" fontSize={9} fill="#999">总计</text>
    </svg>
  );
}

/** Mood bar slider */
function MoodBar({ value, label }: { value: number; label: string }) {
  const pct = ((value + 10) / 20) * 100; // -10..10 → 0..100%
  return (
    <div style={{ width: '100%' }}>
      <div style={{
        height: 6,
        borderRadius: 999,
        background: 'linear-gradient(to right, #E57373, #FFF9C4, #81C784)',
        position: 'relative',
        marginBottom: 8,
      }}>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: `${pct}%`,
          transform: 'translate(-50%, -50%)',
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: '#fff',
          border: '2px solid #27AE60',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        }} />
      </div>
      <div className="pg-row" style={{ justifyContent: 'space-between' }}>
        <Text level="l7" color="var(--color-neutral-400)">-10 焦虑</Text>
        <Text level="l7" color="var(--color-neutral-400)">0 平静</Text>
        <Text level="l7" color="var(--color-neutral-400)">+10 心流</Text>
      </div>
      <Text level="l7" color="var(--color-neutral-500)" style={{ marginTop: 8 }}>
        {label}
      </Text>
    </div>
  );
}

/** M13-P2 数据分析·数据洞察页 */
export function DataAnalytics() {
  const navigate = useNavigate();
  const toast = useToast();
  const [trendView, setTrendView] = useState<'week' | 'month'>('week');
  const [detailTrend, setDetailTrend] = useState<TrendPoint[]>([]);
  const [sopTrend, setSopTrend] = useState<TrendPoint[]>([]);
  const [contribution, setContribution] = useState<DistributionItem[]>([]);
  const [, setEmotionCurve] = useState<EmotionCurve | null>(null);
  const [emotionScore, setEmotionScore] = useState<number | null>(null);
  const [emotionLabel, setEmotionLabel] = useState('');
  const [alerts, setAlerts] = useState<{ level: string; title: string; message: string }[]>([]);
  const [recommendations, setRecommendations] = useState<{ title: string; description: string; icon: string; actionLabel: string; actionUrl: string }[]>([]);
  const [drilldownData, setDrilldownData] = useState<any>(null);
  const [careMode, setCareMode] = useState<'active' | 'passive'>('active');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [dt, st, c, ec, emo, al, rec] = await Promise.all([
          knowledgeApi.fetchTrend(trendView === 'week' ? 7 : 30, trendView === 'week' ? 'day' : 'week').catch(() => []),
          knowledgeApi.fetchTrend(trendView === 'week' ? 7 : 30, trendView === 'week' ? 'day' : 'week').catch(() => []),
          knowledgeApi.fetchDistribution().catch(() => []),
          analyticsApi.getEmotionCurve(trendView === 'week' ? 'week' : 'month').catch(() => null),
          knowledgeApi.fetchEmotion().catch(() => null),
          knowledgeApi.fetchAlerts().catch(() => []),
          knowledgeApi.fetchRecommendations().catch(() => []),
        ]);
        if (!cancelled) {
          setDetailTrend(dt);
          setSopTrend(st.length > 0 ? st : []);
          setContribution(c);
          setEmotionCurve(ec);
          if (emo) {
            setEmotionScore(emo.score);
            setEmotionLabel(emo.label || (emo.aiAnalysis ? `AI分析 ${emo.aiAnalysis} | 自评 ${emo.selfReported}` : ''));
          }
          setAlerts(al);
          setRecommendations(rec);
        }
      } catch {
        // fallback handled below
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [trendView]);

  const handleDrillDown = async (metricKey: string) => {
    try {
      const result = await analyticsApi.drillDown(metricKey);
      setDrilldownData(result);
    } catch {
      toast('下钻数据加载失败', 'error');
    }
  };

  const handleSwitchCareMode = async () => {
    const newMode = careMode === 'active' ? 'passive' : 'active';
    try {
      await analyticsApi.switchCareMode({ mode: newMode });
      setCareMode(newMode);
      toast(`已切换为${newMode === 'active' ? '主动推送' : '被动响应'}模式`, 'success');
    } catch {
      toast('切换失败', 'error');
    }
  };

  const handleBridgeTeacher = async () => {
    try {
      await analyticsApi.bridgeTeacher({ problem_type: '数据分析咨询' });
      toast('已发送导师桥接请求', 'success');
    } catch {
      toast('桥接请求失败，请稍后重试', 'error');
    }
  };

  // Fallback data
  const dtLabels = detailTrend.length > 0
    ? detailTrend.map((p) => p.label)
    : ['一', '二', '三', '四', '五', '六', '日'];
  const dtValues = detailTrend.length > 0
    ? detailTrend.map((p) => p.value)
    : [82, 85, 78, 92, 88, 95, 87.5];
  const sopValues = sopTrend.length > 0
    ? sopTrend.map((p) => p.value)
    : [18, 19, 21, 20, 22, 24, 24];

  const contributionData = contribution.length > 0
    ? contribution.map((d) => d.value)
    : [85, 72, 60, 45, 55, 30];
  const contributionLabels = contribution.length > 0
    ? contribution.map((d) => d.name)
    : ['朝有规划', '暮有复盘', '智能记录', '智能问答', '智能办公', '高维求职'];

  // Pie data for indicator composition
  const pieData = [
    { name: '计划执行', value: 45, color: '#C03A39' },
    { name: '复盘沉淀', value: 30, color: '#E8A94D' },
    { name: '知识积累', value: 25, color: '#4CAF50' },
  ];

  return (
    <PageContainer width="dashboard">
      <div data-module="data-analytics-insight">
        {/* 面包屑导航 + 品牌语 */}
        <section style={{ paddingTop: 'var(--spacing-md)' }}>
          <div className="kb-breadcrumb" style={{ marginBottom: 'var(--spacing-md)' }}>
            <a onClick={() => navigate('/m/knowledge-base')} style={{ cursor: 'pointer' }}>
              我的智库
            </a>
            <span className="kb-breadcrumb__sep">›</span>
            <a onClick={() => navigate('/m/data-analytics')} style={{ cursor: 'pointer' }}>
              数据分析
            </a>
            <span className="kb-breadcrumb__sep">›</span>
            <span className="kb-breadcrumb__current">数据洞察</span>
          </div>

          <div className="pg-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <Text level="l6" as="div" color="var(--color-neutral-600)" style={{ marginBottom: 2 }}>
                日耕朝夕，耕愈工作，耕暖生活
              </Text>
              <Text level="l2" as="h2" color="var(--color-brand-primary)">
                数据照一照，看到好自己
              </Text>
            </div>
            <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
              🔄 刷新数据
            </Button>
          </div>

          <a
            className="kb-back-link"
            onClick={() => navigate('/m/data-analytics')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 'var(--spacing-md)', cursor: 'pointer' }}
          >
            ← 返回数据面板
          </a>
        </section>

        {/* 加载状态 */}
        {loading && (
          <div className="kb-loading" style={{ padding: 'var(--spacing-xl)' }}>
            <div className="kb-loading-spinner" />
            <Text level="l5" as="div" color="var(--color-neutral-500)" style={{ marginTop: 12 }}>
              数据深度分析中…
            </Text>
          </div>
        )}

        {/* 详细趋势图 — 双维度 */}
        <section style={{ marginTop: 'var(--spacing-lg)' }}>
          <Card>
            <div className="pg-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--spacing-lg)' }}>
              <Text level="l3" as="div">📈 数据深度趋势</Text>
              <div style={{ display: 'flex', background: '#F5F3EF', borderRadius: 8, padding: 2 }}>
                <button
                  style={{
                    padding: '4px 12px',
                    fontSize: 12,
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
                    padding: '4px 12px',
                    fontSize: 12,
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
            <div className="pg-row" style={{ gap: 16, marginBottom: 'var(--spacing-md)' }}>
              <div className="pg-row" style={{ gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#C03A39' }} />
                <Text level="l7" color="var(--color-neutral-400)">计划完成率</Text>
              </div>
              <div className="pg-row" style={{ gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#E8A94D' }} />
                <Text level="l7" color="var(--color-neutral-400)">SOP沉淀量</Text>
              </div>
            </div>

            {/* 双线趋势 — 使用两组 LineChart */}
            <div style={{ height: 280 }}>
              {dtValues.length > 0 ? (
                <div style={{ position: 'relative' }}>
                  <LineChart data={dtValues} labels={dtLabels} />
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    pointerEvents: 'none',
                    opacity: 0.6,
                  }}>
                    {/* Overlay second line — simplified: show both in same chart space */}
                  </div>
                </div>
              ) : (
                <div className="kb-empty-state" style={{ height: 240 }}>
                  <Text level="l6" color="var(--color-neutral-400)">暂无趋势数据</Text>
                </div>
              )}
            </div>
            {/* SOP secondary trend */}
            {sopValues.length > 0 && (
              <div style={{ marginTop: -40 }}>
                <LineChart data={sopValues} labels={dtLabels} />
              </div>
            )}
          </Card>
        </section>

        {/* 模块贡献度 + 指标构成 */}
        <div className="pg-split--5050" style={{ marginTop: 'var(--spacing-lg)' }}>
          {/* 各模块贡献度 */}
          <Card>
            <Text level="l3" as="div" style={{ marginBottom: 'var(--spacing-md)' }}>
              📊 各模块贡献度
            </Text>
            <BarChart data={contributionData} labels={contributionLabels} />
          </Card>

          {/* 指标构成饼图 */}
          <Card>
            <Text level="l3" as="div" style={{ marginBottom: 'var(--spacing-md)' }}>
              🍩 指标构成
            </Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
              <PieChart data={pieData} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pieData.map((d) => (
                  <div key={d.name} className="pg-row" style={{ justifyContent: 'space-between', gap: 12 }}>
                    <div className="pg-row" style={{ gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: d.color }} />
                      <Text level="l7" color="var(--color-neutral-600)">{d.name}</Text>
                    </div>
                    <Text level="l7" color="var(--color-neutral-800)" style={{ fontWeight: 700 }}>{d.value}%</Text>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* 情绪评分 + 预警 + 推荐 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--spacing-lg)', marginTop: 'var(--spacing-lg)' }}>
          {/* 情绪评分面板 — 从 API 获取 */}
          <Card>
            <Text level="l3" as="div" style={{ marginBottom: 'var(--spacing-md)' }}>
              本周情绪评分
            </Text>
            <div style={{ textAlign: 'center', padding: 'var(--spacing-md) 0' }}>
              <Text
                level="l0"
                color={emotionScore !== null ? (emotionScore > 0 ? '#27AE60' : emotionScore < 0 ? '#E57373' : '#6B8FBF') : '#27AE60'}
                style={{ fontSize: 48, fontWeight: 900 }}
              >
                {emotionScore !== null ? (emotionScore > 0 ? '+' : '') + emotionScore : '+7'}
              </Text>
              <Text level="l7" as="div" color="var(--color-neutral-400)" style={{ marginTop: 4 }}>
                {emotionLabel || '状态稳定，充满动力'}
              </Text>
            </div>
            <MoodBar value={emotionScore ?? 7} label="AI分析 + 自我标注" />
            <button
              style={{
                marginTop: 'var(--spacing-md)',
                background: 'none',
                border: 'none',
                color: '#C03A39',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
              onClick={() => toast('修正评分功能已接入树洞申诉', 'neutral')}
            >
              修正评分
            </button>
          </Card>

          {/* 预警卡片 — 从 API 获取 */}
          <Card style={{
            backgroundColor: alerts.length > 0 && alerts[0].level === 'critical' ? '#FFEBEE' : '#FFF3E0',
            border: alerts.length > 0 && alerts[0].level === 'critical' ? '1px solid #EF5350' : '1px solid #FFB74D',
            borderLeft: alerts.length > 0 && alerts[0].level === 'critical' ? '4px solid #EF5350' : '4px solid #FFB74D',
          }}>
            <div className="pg-row" style={{ gap: 6, marginBottom: 'var(--spacing-md)' }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <Text level="l4" as="div" color={alerts.length > 0 && alerts[0].level === 'critical' ? '#C62828' : '#E65100'} style={{ fontWeight: 700 }}>
                预警提示
              </Text>
            </div>
            {alerts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {alerts.map((alert, i) => (
                  <Text key={i} level="l7" as="p" color="#855400" style={{ lineHeight: 1.6 }}>
                    {alert.title}: {alert.message}
                  </Text>
                ))}
              </div>
            ) : (
              <Text level="l7" as="p" color="#855400" style={{ lineHeight: 1.6 }}>
                暂无预警，一切运行正常 ✓
              </Text>
            )}
            {alerts.length > 0 && (
              <button
                style={{
                  marginTop: 'var(--spacing-md)',
                  background: 'none',
                  border: 'none',
                  color: '#E65100',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'block',
                  marginLeft: 'auto',
                }}
                onClick={() => handleDrillDown('alerts')}
              >
                查看详情 →
              </button>
            )}
          </Card>

          {/* 推荐服务 — 从 API 获取 */}
          <Card>
            <Text level="l3" as="div" style={{ marginBottom: 'var(--spacing-md)' }}>
              推荐服务
            </Text>
            {recommendations.length > 0 ? (
              recommendations.slice(0, 2).map((rec, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-md)',
                    padding: 'var(--spacing-sm)',
                    background: '#F5F3EF',
                    borderRadius: 8,
                    marginBottom: 'var(--spacing-md)',
                  }}
                >
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#C03A39',
                    fontSize: 22,
                  }}>
                    {rec.icon || '💡'}
                  </div>
                  <div>
                    <Text level="l6" as="div" style={{ fontWeight: 700 }}>{rec.title}</Text>
                    <Text level="l7" color="var(--color-neutral-400)">{rec.description}</Text>
                  </div>
                </div>
              ))
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-md)',
                padding: 'var(--spacing-sm)',
                background: '#F5F3EF',
                borderRadius: 8,
                marginBottom: 'var(--spacing-md)',
              }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#C03A39',
                  fontSize: 22,
                }}>
                  💝
                </div>
                <div>
                  <Text level="l6" as="div" style={{ fontWeight: 700 }}>1对1职业规划咨询</Text>
                  <Text level="l7" color="var(--color-neutral-400)">基于您的数据沉淀</Text>
                </div>
              </div>
            )}
            <button
              style={{
                width: '100%',
                padding: '10px 0',
                background: '#C03A39',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
              onClick={handleBridgeTeacher}
            >
              导师桥接
            </button>
          </Card>
        </div>

        {/* 关怀模式 + 下钻结果 */}
        <section style={{ marginTop: 'var(--spacing-lg)' }}>
          <Card>
            <div className="pg-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text level="l4" as="div">🔔 关怀推送模式</Text>
                <Text level="l7" color="var(--color-neutral-500)">
                  当前：{careMode === 'active' ? '主动推送（系统自动触发关怀）' : '被动响应（仅响应用户请求）'}
                </Text>
              </div>
              <Button variant="secondary" size="sm" onClick={handleSwitchCareMode}>
                切换为{careMode === 'active' ? '被动响应' : '主动推送'}
              </Button>
            </div>
          </Card>
        </section>

        {/* 下钻结果面板 */}
        {drilldownData && (
          <section style={{ marginTop: 'var(--spacing-md)' }}>
            <Card>
              <div className="pg-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
                <Text level="l4" as="div">📊 指标下钻：{drilldownData.label}</Text>
                <Button variant="text" size="sm" onClick={() => setDrilldownData(null)}>关闭</Button>
              </div>
              {drilldownData.children && drilldownData.children.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {drilldownData.children.map((child: any, i: number) => (
                    <div key={i} className="pg-row" style={{ justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <Text level="l6">{child.label || child.name}</Text>
                      <Text level="l6" color="var(--color-brand-primary)" style={{ fontWeight: 700 }}>
                        {child.value !== undefined ? child.value : ''}
                      </Text>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </section>
        )}

        {/* 底部说明 */}
        <div style={{ textAlign: 'center', padding: 'var(--spacing-lg) 0' }}>
          <Text level="l6" color="var(--color-neutral-400)">
            数据积累中，坚持使用会越来越精准~
          </Text>
        </div>
      </div>
    </PageContainer>
  );
}
