/**
 * 暮有复盘 · SOP 预览卡片。
 * 移动端和 PC 端共用。
 */
import type { SopDetail } from '../../../api/reviews';
import { BRAND_COLOR, WARN_COLOR } from './review-constants';

interface SopPreviewCardProps {
  sop: SopDetail | null;
  loading?: boolean;
  /** PC 端：点击编辑的回调 */
  onEdit?: () => void;
  /** 是否显示编辑按钮（PC 端为 true） */
  showEdit?: boolean;
}

export function SopPreviewCard({
  sop,
  loading = false,
  onEdit,
  showEdit = false,
}: SopPreviewCardProps) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 20, marginBottom: 16,
      border: '1px solid #E8E0D6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
        paddingBottom: 12, borderBottom: '1px solid #F5F3EF',
      }}>
        <span style={{ fontSize: 24, color: BRAND_COLOR }}>📄</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#333' }}>萃取SOP</span>
        {showEdit && sop && onEdit && (
          <button
            onClick={onEdit}
            style={{
              marginLeft: 'auto', padding: '6px 16px', fontSize: 13, fontWeight: 500,
              color: BRAND_COLOR, background: 'transparent', border: `1px solid ${BRAND_COLOR}`,
              borderRadius: 8, cursor: 'pointer',
            }}
          >
            编辑
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#999', fontSize: 14 }}>
          加载SOP数据…
        </div>
      ) : sop ? (
        <>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#333', marginBottom: 16 }}>{sop.title}</h3>
          <div style={{ borderLeft: `4px solid ${WARN_COLOR}`, paddingLeft: 16 }}>
            {sop.steps.map((step) => (
              <div key={step.step_number} style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', background: WARN_COLOR,
                  color: '#fff', fontSize: 12, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 2,
                }}>
                  {step.step_number}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#333', marginBottom: 4 }}>
                    {step.title}
                  </div>
                  <div style={{ fontSize: 13, color: '#666', lineHeight: 1.5 }}>
                    {step.description}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 关键话术 & 注意事项 */}
          {(sop.key_phrases || sop.precautions) && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #F5F3EF' }}>
              {sop.key_phrases && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 13, color: '#666' }}>
                  <span style={{ fontSize: 16, flexShrink: 0, marginTop: 2, color: WARN_COLOR }}>🔑</span>
                  <span><strong>关键话术：</strong>{sop.key_phrases}</span>
                </div>
              )}
              {sop.precautions && (
                <div style={{ display: 'flex', gap: 8, fontSize: 13, color: '#666' }}>
                  <span style={{ fontSize: 16, flexShrink: 0, marginTop: 2, color: WARN_COLOR }}>⚠️</span>
                  <span><strong>注意事项：</strong>{sop.precautions}</span>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <span style={{ fontSize: 40, color: '#ccc', marginBottom: 12, display: 'block' }}>📋</span>
          <p style={{ fontSize: 14, color: '#999', margin: 0 }}>暂无萃取SOP</p>
          <p style={{ fontSize: 12, color: '#ccc', marginTop: 4 }}>完成复盘对话后自动生成</p>
        </div>
      )}
    </div>
  );
}
