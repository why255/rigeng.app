/**
 * P1 仪表盘 — PC端核心入口（/m/evening-review 的 index）。
 *
 * 对齐 m2-p1.html 设计：
 *   - 空状态：显示今日复盘卡片（零值）+ 开始复盘按钮 + 昨日摘要
 *   - 有数据：完整信息中枢（今日状态 + 本周甘特图 + SOP列表 + 行动项）
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import * as reviewsApi from '@/shared/api/reviews';
import type { ReviewStats, YesterdayReviewSummary, WeeklyProgress, ReviewHistoryItem, SopDetail } from '@/shared/api/reviews';
import {
  ReviewBrandHero,
  ReviewStatsCard,
  YesterdaySummaryCard,
  WeeklyProgress as WeeklyProgressDisplay,
} from '@/shared/components/features/evening-review';
import './evening-review.css';

interface ActionItem {
  id: string;
  text: string;
  completed: boolean;
  synced_to_morning_plan: boolean;
}

function getLocalActionItems(): ActionItem[] {
  try {
    const key = `er_action_items_${new Date().toISOString().slice(0, 10)}`;
    return JSON.parse(localStorage.getItem(key) ?? '[]');
  } catch { return []; }
}

function saveLocalActionItems(items: ActionItem[]) {
  const key = `er_action_items_${new Date().toISOString().slice(0, 10)}`;
  localStorage.setItem(key, JSON.stringify(items));
}

export function EveningReviewDashboard() {
  const navigate = useNavigate();
  const { isOnline } = useOnlineStatus();
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [yesterday, setYesterday] = useState<YesterdayReviewSummary | null>(null);
  const [weekly, setWeekly] = useState<WeeklyProgress | null>(null);
  const [history, setHistory] = useState<ReviewHistoryItem[]>([]);
  const [sops, setSops] = useState<SopDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasTodayRecord, setHasTodayRecord] = useState(false);
  const [actionItems, setActionItems] = useState<ActionItem[]>(getLocalActionItems());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (isOnline) {
          const [s, y, w, h] = await Promise.all([
            reviewsApi.fetchTodayReviewStats(),
            reviewsApi.fetchYesterdayReviewSummary(),
            reviewsApi.fetchWeeklyProgress(),
            reviewsApi.fetchReviewHistory(),
          ]);
          if (!cancelled) {
            setStats(s);
            setYesterday(y);
            setWeekly(w);
            setHistory(h);
            setHasTodayRecord(s.total_tasks > 0);
          }
          try {
            const sop = await reviewsApi.fetchTodaySop();
            if (!cancelled && sop) setSops([sop]);
          } catch { /* 无SOP */ }
        } else {
          if (!cancelled) {
            setStats({ total_tasks: 0, completed_tasks: 0, completion_rate: 0, sop_count: 0, courage_value: 0 });
            setYesterday(null);
          }
        }
      } catch {
        if (!cancelled) setError('加载失败，请稍后重试');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [isOnline]);

  const handleAddActionItem = () => {
    const text = prompt('输入新的行动项：');
    if (!text?.trim()) return;
    const newItems = [...actionItems, { id: Date.now().toString(), text: text.trim(), completed: false, synced_to_morning_plan: false }];
    setActionItems(newItems);
    saveLocalActionItems(newItems);
  };

  const toggleActionItem = (idx: number) => {
    const newItems = actionItems.map((item, i) => i === idx ? { ...item, completed: !item.completed } : item);
    setActionItems(newItems);
    saveLocalActionItems(newItems);
  };

  const deleteActionItem = (idx: number) => {
    const newItems = actionItems.filter((_, i) => i !== idx);
    setActionItems(newItems);
    saveLocalActionItems(newItems);
  };

  if (loading) {
    return (
      <div data-module="evening-review">
        <div className="er-page" style={{ textAlign: 'center', paddingTop: 80 }}>
          <div style={{ color: '#999' }}>加载中…</div>
        </div>
      </div>
    );
  }

  // ── 空状态：仅显示基础卡片 ──
  if (!hasTodayRecord) {
    return (
      <div data-module="evening-review">
        <div className="er-page">
          <ReviewBrandHero />
          <ReviewStatsCard stats={stats} loading={loading} />
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <button className="er-btn-primary" onClick={() => navigate('chat')} style={{ width: 'auto', padding: '14px 40px' }}>
              开始复盘
            </button>
          </div>
          <YesterdaySummaryCard yesterday={yesterday} loading={loading} />
        </div>
      </div>
    );
  }

  // ── 有数据：完整信息中枢 ──
  return (
    <div data-module="evening-review">
      <div className="er-page">
        <ReviewBrandHero />

        <ReviewStatsCard stats={stats} loading={loading} />

        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <button className="er-btn-primary" onClick={() => navigate('chat')} style={{ width: 'auto', padding: '14px 40px' }}>
            继续复盘
          </button>
        </div>

        <YesterdaySummaryCard yesterday={yesterday} loading={loading} />

        {/* 本周进度（甘特图） */}
        <WeeklyProgressDisplay weekly={weekly} loading={loading} compact={false} />

        {/* SOP 列表 */}
        <div className="er-card" style={{ marginBottom: 20 }}>
          <div className="er-card__header">
            <span className="er-card__header-icon">📝</span>
            <h2 className="er-card__header-title">待萃取 SOP</h2>
            <button className="er-btn-outline" style={{ marginLeft: 'auto', padding: '6px 16px', fontSize: 13 }}
              onClick={() => navigate('chat')}>+ 手动新建</button>
          </div>
          {sops.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 16, color: '#999', fontSize: 13 }}>对话完成后，AI 将自动萃取 SOP</div>
          ) : (
            sops.map(sop => (
              <div key={sop.id} style={{ marginBottom: 12, padding: '12px 16px', background: '#FAFAFA', borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{sop.title}</span>
                    <span style={{ fontSize: 12, color: '#999', marginLeft: 12 }}>· {sop.steps.length} 步骤</span>
                    {sop.quality_score && (
                      <span style={{ fontSize: 12, color: '#FFB74D', marginLeft: 8 }}>{'★'.repeat(sop.quality_score)}</span>
                    )}
                  </div>
                  <button className="er-btn-outline" style={{ padding: '4px 12px', fontSize: 12 }}
                    onClick={() => navigate('chat')}>{sop.quality_score ? '查看' : '编辑'}</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 改进行动项 */}
        <div className="er-card" style={{ marginBottom: 20 }}>
          <div className="er-card__header">
            <span className="er-card__header-icon">🔧</span>
            <h2 className="er-card__header-title">改进行动项</h2>
            <button className="er-btn-outline" style={{ marginLeft: 'auto', padding: '6px 16px', fontSize: 13 }}
              onClick={handleAddActionItem}>+ 添加</button>
          </div>
          {actionItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 16, color: '#999', fontSize: 13 }}>完成诊断后，改进行动项将自动生成</div>
          ) : (
            actionItems.map((item, i) => (
              <div key={item.id} className="er-action-item">
                <input type="checkbox" checked={item.completed} onChange={() => toggleActionItem(i)}
                  style={{ accentColor: '#C03A39', width: 18, height: 18 }} />
                <span className={item.completed ? 'er-action-item__text--completed' : 'er-action-item__text'}>{item.text}</span>
                {item.synced_to_morning_plan && <span className="er-action-item__badge">已同步朝有规划</span>}
                <button onClick={() => deleteActionItem(i)}
                  style={{ color: '#999', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
              </div>
            ))
          )}
        </div>

        {/* 快捷导航 */}
        <div className="er-actions" style={{ marginBottom: 32 }}>
          <button className="er-btn-secondary" onClick={() => navigate('report')}>填写诊断</button>
          <button className="er-btn-secondary" onClick={() => navigate('history')}>查看历史</button>
        </div>
      </div>
    </div>
  );
}
