/**
 * P1 情绪树洞入口页 — 安全承诺语 + 今日情绪概览 + 成长手册入口 + 情绪历史入口 + CTA。
 * Route: /m/mood-haven
 * 严格对齐 m3p1-mobile.html 原型设计。
 *
 * 使用 mh-* BEM 类名（来自 mood-haven.css）+ 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。返回按钮使用 navigate(-1)。
 * 共享业务组件从 @/shared/components/features/emotion 引用。
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import * as emotionsApi from '@/shared/api/emotions';
import type { TodayEmotion, GrowthRecord } from '@/shared/api/emotions';
import {
  SafetyBubble,
  EmotionOverview,
  GrowthPreview,
} from '@/shared/components/features/emotion';
import './mood-haven.css';

export function MoodHavenEntry() {
  const navigate = useNavigate();
  const { isOnline } = useOnlineStatus();
  const [emotion, setEmotion] = useState<TodayEmotion | null>(null);
  const [recentRecords, setRecentRecords] = useState<GrowthRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        if (isOnline) {
          const [emo, records] = await Promise.all([
            emotionsApi.fetchTodayEmotion(),
            emotionsApi.fetchRecentGrowthRecords(3),
          ]);
          if (!cancelled) { setEmotion(emo); setRecentRecords(records); }
        }
      } catch {
        // 加载失败显示空状态
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [isOnline]);

  const recordCount = recentRecords.length;

  return (
    <div data-module="mood-haven">
      <div className="mh-page">

        {/* ═══ 顶部导航 ═══ */}
        <header className="mh-page-header" style={{ marginBottom: 12 }}>
          <button className="mh-page-header__back" onClick={() => navigate(-1)}>
            <Icon icon="mingcute:left-line" width={20} />
          </button>
          <h1 className="mh-page-header__title">情绪树洞</h1>
          <div className="mh-page-header__spacer" />
        </header>

        {/* ═══ 品牌语 ═══ */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: '#333', fontSize: 15, fontWeight: 700, lineHeight: 1.6 }}>
            日耕朝夕，耕愈工作，耕暖生活
          </div>
          <p style={{ fontSize: 26, fontWeight: 800, color: '#2C1810', lineHeight: 1.2, margin: '8px 0 0' }}>
            心事有处说，<br />烦恼变智慧
          </p>
        </div>

        {/* ═══ 安全承诺语气泡 ═══ */}
        <SafetyBubble>
          <strong style={{ color: '#333' }}>姐，您来了。</strong>{' '}
          这里只有您和我，您说的每一句话小耕都会保守秘密。想说什么就说吧，小耕在听。
        </SafetyBubble>

        {/* ═══ 今日情绪概览 ═══ */}
        <EmotionOverview emotion={emotion} loading={loading} />

        {/* ═══ 成长手册入口 ═══ */}
        <GrowthPreview
          count={recordCount}
          onClick={() => navigate('/m/mood-haven/growth')}
        />

        {/* ═══ 情绪历史入口 ═══ */}
        <button
          onClick={() => navigate('/m/mood-haven/history')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', background: '#fff', padding: 16, borderRadius: 16,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f3f4f6',
            marginBottom: 16, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, background: '#f9fafb',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af',
            }}>
              <Icon icon="mingcute:time-line" width={24} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#2C1810', margin: 0 }}>情绪历史</p>
              <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>回顾您的情绪曲线</p>
            </div>
          </div>
          <Icon icon="mingcute:right-line" width={20} color="#d1d5db" />
        </button>

        {/* ═══ 主CTA按钮 ═══ */}
        <div style={{ paddingTop: 8, paddingBottom: 4 }}>
          <button
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '16px 0', background: '#C03A39', color: '#fff',
              borderRadius: 16, border: 'none', fontWeight: 700, fontSize: 16,
              cursor: 'pointer', boxShadow: '0 4px 16px rgba(192,58,57,0.2)',
              fontFamily: 'inherit',
            }}
            onClick={() => navigate('/m/mood-haven/chat')}
          >
            <Icon icon="mingcute:edit-line" width={20} />
            我想说说
          </button>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            marginTop: 12, fontSize: 10, color: '#9ca3af',
          }}>
            <Icon icon="mingcute:info-circle-line" width={12} />
            <span>今天还没有倾诉，树洞安静地等着你</span>
          </div>
        </div>

        <div style={{ height: 4 }} />
      </div>
    </div>
  );
}
