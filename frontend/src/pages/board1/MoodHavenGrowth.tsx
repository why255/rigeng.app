/**
 * P3 成长手册页 — 展示已生成的成长记录列表，按日期排序，带标签分类。
 * Route: /m/mood-haven/growth
 * 对齐 m3-p3.html 设计
 */
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import * as emotionsApi from '@/api/emotions';
import type { GrowthRecord } from '@/api/emotions';
import './mood-haven.css';

const CATEGORY_CONFIG: Record<string, { cls: string; tagCls: string; borderCls: string }> = {
  '自我成长': { cls: 'mh-growth-entry--growth', tagCls: 'mh-growth-entry__tag--growth', borderCls: '#FFCC80' },
  '情绪调节': { cls: 'mh-growth-entry--emotion', tagCls: 'mh-growth-entry__tag--emotion', borderCls: '#C03A39' },
  '认知转化': { cls: 'mh-growth-entry--cognition', tagCls: 'mh-growth-entry__tag--cognition', borderCls: '#9E9E9E' },
};

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

  const getCategoryConfig = (category: string) => {
    return CATEGORY_CONFIG[category] ?? {
      cls: 'mh-growth-entry--cognition',
      tagCls: 'mh-growth-entry__tag--cognition',
      borderCls: '#9E9E9E',
    };
  };

  return (
    <div data-module="mood-haven">
      <div className="mh-page">
        {/* 品牌标语区 */}
        <section className="mh-hero" style={{ marginBottom: 24 }}>
          <div className="mh-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</div>
          <div className="mh-hero__divider" />
          <p className="mh-hero__title--small" style={{ marginTop: 8 }}>情绪树洞</p>
          <h2 className="mh-hero__title" style={{ fontSize: 28 }}>成长手册</h2>
          <p className="mh-hero__subtitle">心事有处说，烦恼变智慧</p>
        </section>

        {/* 顶部操作栏 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 24,
        }}>
          <button
            className="mh-nav-link"
            onClick={() => navigate('/m/mood-haven')}
          >
            ← 返回树洞
          </button>
          <button className="mh-btn-secondary">
            📤 分享到品牌打造中心
          </button>
        </div>

        {/* 成长记录列表 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#999' }}>加载中…</div>
        ) : records.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#999' }}>
            <p style={{ fontSize: 48, marginBottom: 16 }}>📖</p>
            <p>还没有成长记录</p>
            <p style={{ fontSize: 13, marginTop: 8 }}>
              去<Link to="/m/mood-haven/chat" style={{ color: '#C03A39' }}>情绪树洞</Link>倾诉，小耕帮您把烦恼变成智慧
            </p>
          </div>
        ) : (
          <div>
            {records.map((record) => {
              const catConfig = getCategoryConfig(record.category);
              return (
                <div key={record.id} className={`mh-growth-entry ${catConfig.cls}`}>
                  <div className="mh-growth-entry__header">
                    <div className="mh-growth-entry__date">
                      📅 {record.date}
                    </div>
                    <span className={`mh-growth-entry__tag ${catConfig.tagCls}`}>
                      {record.category}
                    </span>
                  </div>
                  <p className="mh-growth-entry__content">
                    {record.content}
                  </p>
                  {record.tags && record.tags.length > 0 && (
                    <div className="mh-growth-entry__meta">
                      {record.tags.map((tag, idx) => (
                        <span key={idx} className="mh-growth-entry__meta-item">
                          {tag.includes('勇气') ? '💪' : tag.includes('小耕') ? '💬' : '✨'}
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {hasMore && (
              <div className="mh-load-more">
                <button className="mh-load-more__btn" onClick={loadRecords}>
                  加载更多记录...
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
