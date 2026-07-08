/**
 * P3 成长手册页 — 展示已生成的成长记录列表，按日期排序，带标签分类。
 * Route: /m/mood-haven/growth
 * 严格对齐 m3p3-mobile.html 原型设计。
 *
 * 使用 mh-* BEM 类名（来自 mood-haven.css）+ 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。返回按钮使用 navigate(-1)。
 * 共享业务组件 GrowthEntry 从 @/shared/components/features/emotion 引用。
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import * as emotionsApi from '@/shared/api/emotions';
import type { GrowthRecord } from '@/shared/api/emotions';
import { GrowthEntry } from '@/shared/components/features/emotion';
import './mood-haven.css';

export function MoodHavenGrowth() {
  const navigate = useNavigate();
  const { isOnline } = useOnlineStatus();
  const [records, setRecords] = useState<GrowthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  const loadRecords = async () => {
    setLoading(true);
    try {
      if (isOnline) {
        const data = await emotionsApi.fetchGrowthRecords(10);
        setRecords(data);
        setHasMore(data.length >= 10);
      }
    } catch {
      // 加载失败显示空状态
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [isOnline]);

  return (
    <div data-module="mood-haven">
      <div className="mh-page">

        {/* ═══ 顶部导航 ═══ */}
        <header className="mh-page-header" style={{ marginBottom: 12 }}>
          <button className="mh-page-header__back" onClick={() => navigate(-1)}>
            <Icon icon="mingcute:left-line" width={20} />
          </button>
          <h1 className="mh-page-header__title">成长手册</h1>
          <button
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'none', border: 'none', color: '#C03A39',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon icon="mingcute:share-forward-line" width={20} />
          </button>
        </header>

        {/* ═══ 品牌语 ═══ */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ color: '#333', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
            日耕朝夕，耕愈工作，耕暖生活
          </div>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#333', margin: '4px 0' }}>
            心事有处说，烦恼变智慧
          </p>
          <p style={{ fontSize: 17, fontWeight: 700, color: '#333', margin: '4px 0' }}>
            情绪树洞
          </p>
        </div>

        {/* ═══ 成长记录列表 ═══ */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#999' }}>加载中…</div>
        ) : records.length === 0 ? (
          <div style={{
            background: '#fff', borderRadius: 16, padding: 40,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f3f4f6',
            textAlign: 'center',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%', background: '#f9fafb',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon icon="mingcute:book-2-line" width={40} color="#d1d5db" />
              </div>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#333', margin: '0 0 4px' }}>
                  还没有成长记录
                </p>
                <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>
                  每一次情绪对话后，小耕会帮你整理成长收获
                </p>
              </div>
              <button
                onClick={() => navigate('/m/mood-haven/chat')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 24px', background: '#C03A39', color: '#fff',
                  borderRadius: 8, border: 'none', fontSize: 14, cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontFamily: 'inherit',
                }}
              >
                <Icon icon="mingcute:chat-2-line" width={16} />
                去倾诉，开启第一次成长
              </button>
            </div>
          </div>
        ) : (
          <div>
            {records.map((record) => (
              <GrowthEntry key={record.id} record={record} />
            ))}

            {hasMore && (
              <div className="mh-load-more">
                <button className="mh-load-more__btn" onClick={loadRecords}>
                  加载更多记录...
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══ 底部轻提示 ═══ */}
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>
            — 每一次倾诉都是一次成长 —
          </p>
        </div>

      </div>
    </div>
  );
}
