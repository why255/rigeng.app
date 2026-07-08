/**
 * P1 入口页 — 安全承诺语 + 今日情绪概览 + 成长手册预览。
 * Route: /m/mood-haven
 * 对齐 m3-p1.html 设计。
 * 共享业务组件 SafetyBubble, EmotionOverview, GrowthPreview 从 @/shared/components/features/emotion 引用。
 */
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
        } else {
          if (!cancelled) {
            setEmotion({
              mood: '平静', mood_emoji: '😊', score: 0,
              courage_value: 0, has_today_chat: false,
            });
            setRecentRecords([]);
          }
        }
      } catch {
        if (!cancelled) {
          setEmotion({
            mood: '平静', mood_emoji: '😊', score: 5,
            courage_value: 80, has_today_chat: false,
          });
          setRecentRecords([]);
        }
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
      {/* 离线横幅 */}
      {!isOnline && (
        <div style={{
          background: '#FFF3E0', color: '#E65100', textAlign: 'center',
          padding: '8px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Icon icon="mingcute:warning-line" width={16} color="#E65100" />
          <span>当前离线，部分功能暂不可用</span>
        </div>
      )}

      <div className="mh-page">
        {/* 品牌标语区 */}
        <section className="mh-hero">
          <div className="mh-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</div>
          <div className="mh-hero__divider" />
          <h2 className="mh-hero__title">心事有处说，烦恼变智慧</h2>
        </section>

        {/* 安全承诺语气泡 */}
        <SafetyBubble avatarIcon="mingcute:leaf-line">
          <strong style={{ color: '#333' }}>姐，您来了。</strong>{' '}
          这里只有您和我，您说的每一句话小耕都会保守秘密。
          <br />
          想说什么就说吧，小耕在听。
        </SafetyBubble>

        {/* 今日情绪概览卡片 */}
        <EmotionOverview emotion={emotion} loading={loading} />

        {/* 成长手册预览卡片 */}
        <GrowthPreview
          count={recordCount}
          snippet={recentRecords[0]?.content?.slice(0, 30)}
          onClick={() => navigate('/m/mood-haven/growth')}
        />

        {/* 主CTA按钮 */}
        <div style={{ paddingTop: 16, textAlign: 'center' }}>
          <button
            className="mh-btn-primary"
            onClick={() => navigate('/m/mood-haven/chat')}
          >
            我想说说
          </button>
          <p className="mh-footer-note" style={{ paddingTop: 12 }}>
            <Icon icon="mingcute:lock-line" width={12} style={{ marginRight: 4 }} />
            倾诉功能在移动端体验更佳，所有对话均严格加密
          </p>

          <div className="mh-footer-links">
            <Link to="/m/mood-haven/history" className="mh-nav-link">
              <Icon icon="mingcute:time-line" width={14} /> 情绪历史
            </Link>
            <span className="mh-footer-links__divider">|</span>
            <Link to="/m/mood-haven/growth" className="mh-nav-link">
              <Icon icon="mingcute:book-2-line" width={14} /> 成长手册
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
