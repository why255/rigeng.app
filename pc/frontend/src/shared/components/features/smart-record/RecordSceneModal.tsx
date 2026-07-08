/**
 * 智能记录 · 录音场景选择弹窗。
 * 移动端和 PC 端共用。
 */
import { Icon } from '@iconify/react'
import { SCENES } from './record-constants'

interface RecordSceneModalProps {
  selectedScene: string;
  onSelectScene: (scene: string) => void;
  onStart: () => void;
  onClose: () => void;
  compact?: boolean;
}

export function RecordSceneModal({
  selectedScene, onSelectScene, onStart, onClose, compact = false,
}: RecordSceneModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF',
          borderRadius: 12,
          padding: compact ? 16 : 20,
          maxWidth: compact ? 320 : 400,
          width: '100%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
      >
        <h3 style={{
          fontSize: compact ? 16 : 18, fontWeight: 700,
          color: '#333', marginBottom: compact ? 12 : 16,
        }}>
          选择录音场景
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          marginBottom: 12,
        }}>
          {SCENES.map((s) => (
            <div
              key={s.key}
              onClick={() => onSelectScene(s.key)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                padding: compact ? 10 : 12,
                borderRadius: 8,
                border: `2px solid ${selectedScene === s.key ? '#C03A39' : '#E8E0D6'}`,
                cursor: 'pointer',
                background: '#FFFFFF',
              }}
            >
              <Icon icon={s.icon} style={{ fontSize: compact ? 18 : 20, color: s.color }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: '#333' }}>{s.key}</span>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={onStart}
            style={{
              background: '#C03A39',
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 700,
              padding: '10px 32px',
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            开始录音
          </button>
        </div>
      </div>
    </div>
  );
}
