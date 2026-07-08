/**
 * P2 倾诉引导页 — PC端不可对话，引导用户到移动端体验。
 * Route: /m/mood-haven/chat
 * 对齐 m3p2.html 设计
 *
 * 使用 mh-* BEM 类名（来自 mood-haven.css）+ 内联 style。无 Tailwind CSS。
 */
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import './mood-haven.css';

export function MoodHavenChatRedirect() {
  const navigate = useNavigate();

  return (
    <div data-module="mood-haven">
      <div className="mh-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        {/* 品牌标语 */}
        <section className="mh-hero">
          <div className="mh-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</div>
          <div className="mh-hero__divider" />
          <h2 className="mh-hero__title--small">心事有处说，烦恼变智慧</h2>
        </section>

        {/* 手机大图标 */}
        <div style={{
          width: 96, height: 96, borderRadius: 24,
          background: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid rgba(0,0,0,0.04)', marginBottom: 24,
        }}>
          <Icon icon="mingcute:cellphone-line" width={48} color="#C03A39" />
        </div>

        {/* 引导文案 */}
        <h2 style={{ fontSize: 24, fontWeight: 700, color: '#2C1810', marginBottom: 12 }}>
          倾诉功能请在移动端体验
        </h2>
        <p style={{ fontSize: 14, color: '#999', maxWidth: 400, lineHeight: 1.7, marginBottom: 24 }}>
          为了保障您的隐私安全与更好的交互体验，情绪树洞的对话功能仅在移动端开放。小耕在手机里等您，随时听您倾诉。
        </p>

        {/* 安全承诺卡 */}
        <div className="mh-card" style={{ maxWidth: 420, width: '100%', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4CAF50' }} />
            <span style={{ fontSize: 14, fontWeight: 500, color: '#333' }}>安全承诺</span>
          </div>
          <p style={{ fontSize: 14, color: '#666', fontStyle: 'italic', lineHeight: 1.7 }}>
            "姐，您来了。这里只有您和我，您说的每一句话小耕都会保守秘密。"
          </p>
        </div>

        {/* 操作按钮 */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            className="mh-btn-primary"
            style={{ width: 'auto', padding: '12px 32px' }}
            onClick={() => navigate(-1)}
          >
            <Icon icon="mingcute:left-line" width={16} />
            返回入口
          </button>
        </div>

        {/* 底部提示 */}
        <p style={{ fontSize: 10, color: '#ccc', marginTop: 24, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon icon="mingcute:lock-line" width={14} />
          所有对话均严格加密
        </p>
      </div>
    </div>
  );
}
