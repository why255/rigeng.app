/**
 * M13-P1 数据分析首页
 * 对齐 m13-p1.html：KPI 卡片（可点击跳转洞察页）、趋势图、各模块SOP分布
 * 品牌色: #C03A39  背景: #F5F3EF
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/AppShell';
import { Card, Text, ProgressBar } from '@/components/primitives';
import { LineChart, BarChart } from '@/components/business/charts';
import * as knowledgeApi from '@/api/knowledge';
import * as analyticsApi from '@/api/analytics';
import type { KpiData, TrendPoint, DistributionItem, DiagnosisData } from '@/api/knowledge';
import type { FullDashboard, EmotionIndex, PushLogResult } from '@/api/analytics';
import '../pages.css';
import './knowledge.css';

export function AnalyticsHome() {
  const navigate = useNavigate();
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [distribution, setDistribution] = useState<DistributionItem[]>([]);
  const [diagnosis, setDiagnosis] = useState<DiagnosisData | null>(null);
  const [fullDashboard, setFullDashboard] = useState<FullDashboard | null>(null);
  const [emotionIndex, setEmotionIndex] = useState<EmotionIndex | null>(null);
  const [pushLog, setPushLog] = useState<PushLogResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [trendView, setTrendView] = useState<'week' | 'month'>('week');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [k, t, d, diag, dashboard, emotion, plog] = await Promise.all([
          knowledgeApi.fetchKpi().catch(() => null),
          knowledgeApi.fetchTrend(trendView === 'week' ? 7 : 30, trendView === 'week' ? 'day' : 'week').catch(() => []),
          knowledgeApi.fetchDistribution().catch(() => []),
          knowledgeApi.fetchDiagnosis().catch(() => null),
          analyticsApi.getFullDashboard().catch(() => null),
          analyticsApi.getEmotionIndex().catch(() => null),
          analyticsApi.getPushLog().catch(() => null),
        ]);
        if (!cancelled) {
          setKpi(k);
          setTrend(t);
          setDistribution(d);
          setDiagnosis(diag);
          setFullDashboard(dashboard);
          setEmotionIndex(emotion);
          setPushLog(plog);
        }
      } catch {
        if (!cancelled) {
          setKpi({ completionRate: 87.5, completionRateChange: 5.2, sopCount: 24, sopCountChange: 3, streakDays: 0 });
          setTrend(getFallbackTrend());
          setDistribution(getFallbackDistribution());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [trendView]);

  const trendValues = trend.length > 0 ? trend.map((p) => p.value) : getFallbackTrend().map((p) => p.value);
  const trendLabels = trend.length > 0 ? trend.map((p) => p.label) : getFallbackTrend().map((p) => p.label);

  const distData = distribution.length > 0
    ? distribution.map((d) => d.value)
    : getFallbackDistribution().map((d) => d.value);
  const distLabels = distribution.length > 0
    ? distribution.map((d) => d.name)
    : getFallbackDistribution().map((d) => d.name);

  return (
    <PageContainer width="dashboard">
      <div data-module="data-analytics">
        {/* 品牌标语 */}
        <section className="kb-hero">
          <Text level="l6" as="div" color="var(--color-neutral-600)" style={{ marginBottom: 4 }}>
            日耕朝夕，耕愈工作，耕暖生活
          </Text>
          <Text level="l0" as="h2" color="var(--color-brand-primary)">
            数据照一照，看到好自己
          </Text>
        </section>

        {/* 核心指标卡片 — 2 cards, both clickable */}
        <section className="pg-section">
          <div className="pg-grid-2">
            {/* 计划完成率 */}
            <Card
              barColor="#C03A39"
              clickable
              onClick={() => navigate('/m/data-analytics/insight')}
              style={{ cursor: 'pointer' }}
            >
              <div className="pg-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
                <Text level="l6" color="var(--color-neutral-500)">计划完成率</Text>
                <span style={{ fontSize: 20, opacity: 0.3 }}>🎯</span>
              </div>
              {loading ? (
                <Text level="l0" as="div" color="var(--color-neutral-400)">--</Text>
              ) : (
                <>
                  <div className="pg-row" style={{ alignItems: 'baseline', gap: 6, marginBottom: 'var(--spacing-md)' }}>
                    <Text level="l0" color="#C03A39" style={{ fontSize: 32, fontWeight: 900 }}>
                      {kpi?.completionRate ?? 0}%
                    </Text>
                    {(kpi?.completionRateChange ?? 0) > 0 && (
                      <span style={{ fontSize: 12, color: '#27AE60', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}>
                        ↑ {(kpi?.completionRateChange ?? 0).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <ProgressBar value={kpi?.completionRate ?? 0} />
                  <Text level="l7" as="p" color="var(--color-neutral-400)" style={{ marginTop: 'var(--spacing-sm)' }}>
                    较上周同期增长，表现优异
                  </Text>
                </>
              )}
            </Card>

            {/* SOP 沉淀量 */}
            <Card
              barColor="#D4A574"
              clickable
              onClick={() => navigate('/m/data-analytics/insight')}
              style={{ cursor: 'pointer' }}
            >
              <div className="pg-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
                <Text level="l6" color="var(--color-neutral-500)">SOP 沉淀量</Text>
                <span style={{ fontSize: 20, opacity: 0.3 }}>📄</span>
              </div>
              {loading ? (
                <Text level="l0" as="div" color="var(--color-neutral-400)">--</Text>
              ) : (
                <>
                  <div className="pg-row" style={{ alignItems: 'baseline', gap: 6, marginBottom: 'var(--spacing-md)' }}>
                    <Text level="l0" color="#8B6914" style={{ fontSize: 32, fontWeight: 900 }}>
                      {kpi?.sopCount ?? 0}
                    </Text>
                    <Text level="l6" color="var(--color-neutral-500)">篇</Text>
                    {(kpi?.sopCountChange ?? 0) > 0 && (
                      <Text level="l7" color="var(--color-neutral-500)">
                        本月新增 {kpi?.sopCountChange} 篇
                      </Text>
                    )}
                  </div>
                  {/* 进度指示条 */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        style={{
                          height: 4,
                          flex: 1,
                          borderRadius: 999,
                          backgroundColor: i <= 2 ? '#C03A39' : '#E8E0D6',
                        }}
                      />
                    ))}
                  </div>
                  <Text level="l7" as="p" color="var(--color-neutral-400)" style={{ marginTop: 'var(--spacing-sm)' }}>
                    距离本月目标还差 6 篇
                  </Text>
                </>
              )}
            </Card>
          </div>
        </section>

        {/* 双向诊断（步骤13核心） */}
        {diagnosis && !loading && (
          <section className="pg-section">
            <div
              style={{
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--spacing-lg)',
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
                gap: 'var(--spacing-md)',
              }}
            >
              {/* 诊断表情 */}
              <div
                style={{
                  fontSize: 36,
                  flexShrink: 0,
                  lineHeight: 1,
                  animation: diagnosis.type === 'positive' ? 'kb-fadeIn 0.5s ease-out' : undefined,
                }}
              >
                {diagnosis.emoji}
              </div>
              <div style={{ flex: 1 }}>
                <Text
                  level="l4"
                  as="div"
                  color={
                    diagnosis.type === 'positive'
                      ? '#2E7D32'
                      : diagnosis.type === 'encouraging'
                        ? '#E65100'
                        : '#1565C0'
                  }
                  style={{ lineHeight: 1.6, fontWeight: 600 }}
                >
                  {diagnosis.message}
                </Text>
                {diagnosis.suggestion && (
                  <Text
                    level="l7"
                    as="p"
                    color="var(--color-neutral-500)"
                    style={{ marginTop: 'var(--spacing-sm)' }}
                  >
                    💡 {diagnosis.suggestion}
                  </Text>
                )}
              </div>
            </div>
          </section>
        )}

        {/* 情绪指数卡片（来自 analytics API） */}
        {emotionIndex && !loading && (
          <section className="pg-section">
            <Card>
              <div className="pg-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
                <Text level="l3" as="div">😊 今日情绪指数</Text>
                <Text level="l7" color="var(--color-neutral-400)">{emotionIndex.date}</Text>
              </div>
              <div style={{ textAlign: 'center', padding: 'var(--spacing-md) 0' }}>
                <Text
                  level="l0"
                  color={emotionIndex.score > 0 ? '#27AE60' : emotionIndex.score < 0 ? '#E57373' : '#6B8FBF'}
                  style={{ fontSize: 48, fontWeight: 900 }}
                >
                  {emotionIndex.score > 0 ? '+' : ''}{emotionIndex.score}
                </Text>
                <Text level="l7" as="div" color="var(--color-neutral-400)" style={{ marginTop: 4 }}>
                  趋势：{emotionIndex.trend}
                </Text>
              </div>
            </Card>
          </section>
        )}

        {/* 模块指标概览（来自 analytics fullDashboard） */}
        {fullDashboard && fullDashboard.modules.length > 0 && !loading && (
          <section className="pg-section">
            <Text level="l3" as="div" style={{ marginBottom: 'var(--spacing-sm)' }}>
              📊 各模块指标
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              {fullDashboard.modules.slice(0, 4).map((mod) => (
                <Card key={mod.key}>
                  <div className="pg-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
                    <Text level="l4">{mod.name}</Text>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                    {mod.metrics.map((m) => (
                      <div key={m.name} style={{ minWidth: 80 }}>
                        <Text level="l7" color="var(--color-neutral-400)">{m.name}</Text>
                        <Text level="l5" color={m.color} style={{ fontWeight: 700 }}>
                          {m.value}{m.unit}
                        </Text>
                        <Text level="l7" color="var(--color-neutral-400)">{m.trend}</Text>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* 关怀推送日志摘要 */}
        {pushLog && !loading && (
          <section className="pg-section">
            <Card>
              <div className="pg-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
                <Text level="l3" as="div">📨 关怀推送</Text>
                <Text level="l7" color="var(--color-neutral-400)">
                  额度：{pushLog.quota.used}/{pushLog.quota.limit}（剩余 {pushLog.quota.remaining}）
                </Text>
              </div>
              {pushLog.logs.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {pushLog.logs.slice(0, 3).map((log) => (
                    <div key={log.id} className="pg-row" style={{ gap: 8, fontSize: 12 }}>
                      <Text level="l7" color="var(--color-neutral-500)">{log.type === 'positive' ? '🟢' : '🔵'}</Text>
                      <Text level="l7" color="var(--color-neutral-600)" style={{ flex: 1 }}>{log.message}</Text>
                      <Text level="l7" color="var(--color-neutral-400)">{new Date(log.sent_at).toLocaleDateString('zh-CN')}</Text>
                    </div>
                  ))}
                </div>
              ) : (
                <Text level="l7" color="var(--color-neutral-400)">暂无推送记录</Text>
              )}
            </Card>
          </section>
        )}

        {/* 图表区 */}
        <section className="pg-section">
          <div className="pg-split--5050">
            {/* 趋势图 */}
            <Card>
              <div className="pg-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
                <Text level="l3" as="div">📈 计划完成趋势</Text>
                <div style={{ display: 'flex', gap: 2 }}>
                  <button
                    className="kb-hot-tag"
                    style={{
                      background: trendView === 'week' ? '#C03A39' : undefined,
                      color: trendView === 'week' ? 'white' : undefined,
                      borderColor: trendView === 'week' ? '#C03A39' : undefined,
                    }}
                    onClick={() => setTrendView('week')}
                  >
                    周
                  </button>
                  <button
                    className="kb-hot-tag"
                    style={{
                      background: trendView === 'month' ? '#C03A39' : undefined,
                      color: trendView === 'month' ? 'white' : undefined,
                      borderColor: trendView === 'month' ? '#C03A39' : undefined,
                    }}
                    onClick={() => setTrendView('month')}
                  >
                    月
                  </button>
                </div>
              </div>
              {trendValues.length > 0 ? (
                <LineChart data={trendValues} labels={trendLabels} />
              ) : (
                <div className="kb-empty-state" style={{ height: 180 }}>
                  <Text level="l6" color="var(--color-neutral-400)">暂无趋势数据</Text>
                </div>
              )}
              {/* 图例 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#C03A39' }} />
                <span style={{ fontSize: 11, color: '#999' }}>完成率</span>
              </div>
            </Card>

            {/* 各模块SOP分布 */}
            <Card>
              <Text level="l3" as="div" style={{ marginBottom: 'var(--spacing-sm)' }}>
                📊 各模块SOP分布
              </Text>
              {distData.length > 0 ? (
                <BarChart data={distData} labels={distLabels} />
              ) : (
                <div className="kb-empty-state" style={{ height: 180 }}>
                  <Text level="l6" color="var(--color-neutral-400)">暂无分布数据</Text>
                </div>
              )}
            </Card>
          </div>
        </section>

        {/* 底部提示 */}
        <div style={{
          marginTop: 'var(--spacing-md)',
          paddingTop: 'var(--spacing-md)',
          borderTop: '1px solid #F5F3EF',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-sm)',
        }}>
          <div className="pg-row" style={{ gap: 6 }}>
            <span style={{ fontSize: 14 }}>ℹ️</span>
            <Text level="l7" color="var(--color-neutral-400)">还没有SOP，做完复盘就有了~</Text>
          </div>
          <div className="pg-row" style={{ gap: 6 }}>
            <span style={{ fontSize: 14 }}>⏱️</span>
            <Text level="l7" color="var(--color-neutral-400)">数据积累中，坚持使用会越来越精准~</Text>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function getFallbackTrend(): TrendPoint[] {
  const labels = ['W1', 'W2', 'W3', 'W4'];
  const values = [62, 71, 78, 87.5];
  return labels.map((label, i) => ({ label, value: values[i] }));
}

function getFallbackDistribution(): DistributionItem[] {
  return [
    { name: '朝有规划', value: 8 },
    { name: '暮有复盘', value: 6 },
    { name: '智能记录', value: 4 },
    { name: '智能问答', value: 3 },
    { name: '智能办公', value: 3 },
  ];
}
