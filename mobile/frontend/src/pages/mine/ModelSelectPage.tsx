/**
 * 更换模型 — 移动端
 * Route: /m/model-select
 * 对齐项目现有设计规范（mm-* BEM 类名）。
 *
 * 展示可用的 AI 模型列表，支持切换选择。
 * 选择后调用 PATCH /users/me/model 持久化到后端，
 * 后续对话会自动使用所选模型。
 * 供应商（自定义 API Key / 第三方模型）功能暂未上线。
 *
 * 使用 mm-* BEM 类名 + 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。无 emoji 字符。
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { apiGet, apiPatch } from '@/shared/api/api';
import './mine.css';

/* ── 可用模型（智谱AI GLM 系列）── */
interface ModelOption {
  id: string;
  name: string;
  provider: string;
  description: string;
  icon: string;
  color: string;
  tags: string[];
}

const MODELS: ModelOption[] = [
  {
    id: 'GLM-4.7',
    name: 'GLM-4.7',
    provider: '智谱AI',
    description: '均衡全能，200K上下文，日常复杂任务首选（默认）',
    icon: 'mingcute:star-line',
    color: '#C03A39',
    tags: ['推荐', '均衡'],
  },
  {
    id: 'GLM-5.1',
    name: 'GLM-5.1',
    provider: '智谱AI',
    description: '新一代旗舰，深度推理，全自治Agent级能力',
    icon: 'mingcute:crown-line',
    color: '#E8A94D',
    tags: ['最强', '深度推理'],
  },
  {
    id: 'GLM-5.2',
    name: 'GLM-5.2',
    provider: '智谱AI',
    description: '最新旗舰，1M超长上下文，最强推理能力',
    icon: 'mingcute:rocket-line',
    color: '#7B1FA2',
    tags: ['最新', '1M上下文'],
  },
];

export function ModelSelectPage() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // 初始化时从后端读取当前模型
  useEffect(() => {
    apiGet<{ model: string; is_custom: boolean }>('/users/me/model')
      .then((data) => {
        setSelectedId(data?.model || MODELS[0].id);
      })
      .catch(() => {
        setSelectedId(MODELS[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = useCallback(async (id: string) => {
    if (id === selectedId) return;
    setSaving(true);
    try {
      await apiPatch('/users/me/model', { model: id });
      setSelectedId(id);
    } catch {
      // 接口失败时仍允许本地切换
      setSelectedId(id);
    } finally {
      setSaving(false);
    }
  }, [selectedId]);

  const selectedModel = MODELS.find((m) => m.id === selectedId) || MODELS[0];

  return (
    <div className="mm-page">
      {/* ===== 顶部 Header ===== */}
      <header className="mm-page__header">
        <button className="mm-header-btn" onClick={() => navigate(-1)}>
          <Icon icon="mingcute:left-line" style={{ fontSize: '24px' }} />
        </button>
        <span className="mm-header-title">更换模型</span>
        <div className="mm-header-spacer" />
      </header>

      {/* ===== 主内容区 ===== */}
      <main className="mm-main-scroll">
        <div className="mm-main-padding">
          {/* 当前模型信息卡片 */}
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: '24px 20px',
              border: '1px solid #E8E0D6',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: `${selectedModel.color}15`,
                color: selectedModel.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
              }}
            >
              <Icon icon={selectedModel.icon} style={{ fontSize: '28px' }} />
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 12px',
                background: `${selectedModel.color}12`,
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 700,
                color: selectedModel.color,
                marginBottom: '12px',
              }}
            >
              <Icon icon="mingcute:check-circle-fill" style={{ fontSize: '13px' }} />
              当前使用
            </div>
            <p style={{ fontSize: '20px', fontWeight: 800, color: '#333', marginBottom: '6px' }}>
              {selectedModel.name}
            </p>
            <p style={{ fontSize: '13px', color: selectedModel.color, marginBottom: '4px' }}>
              {selectedModel.provider}
            </p>
            <p style={{ fontSize: '12px', color: '#999', lineHeight: 1.5 }}>
              {selectedModel.description}
            </p>
          </div>

          {/* 可用模型列表 */}
          <div>
            <h3 className="mm-section-title">可用模型</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                <Icon icon="mingcute:loading-line" style={{ fontSize: '24px' }} />
                <p style={{ fontSize: 12, marginTop: 8 }}>加载中...</p>
              </div>
            ) : (
              MODELS.map((model) => {
                const isActive = model.id === selectedId;
                return (
                  <div
                    key={model.id}
                    className="mm-plan-card"
                    style={{
                      cursor: isActive || saving ? 'default' : 'pointer',
                      borderColor: isActive ? model.color : '#E8E0D6',
                      background: isActive ? `${model.color}06` : '#fff',
                      opacity: saving ? 0.7 : 1,
                    }}
                    onClick={() => handleSelect(model.id)}
                  >
                    <div className="mm-plan-card__header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            background: `${model.color}12`,
                            color: model.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Icon icon={model.icon} style={{ fontSize: '20px' }} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '15px', fontWeight: 700, color: '#333' }}>
                              {model.name}
                            </span>
                            {model.tags.map((tag) => (
                              <span
                                key={tag}
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '8px',
                                  background:
                                    tag === '推荐' || tag === '最强'
                                      ? 'rgba(192,58,57,0.1)'
                                      : 'rgba(96,125,139,0.1)',
                                  color:
                                    tag === '推荐' || tag === '最强' ? '#C03A39' : '#607D8B',
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          <p style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                            {model.provider}
                          </p>
                        </div>
                      </div>
                      {isActive && (
                        <Icon
                          icon="mingcute:check-circle-fill"
                          style={{ fontSize: '22px', color: model.color, flexShrink: 0 }}
                        />
                      )}
                    </div>
                    <p className="mm-plan-card__desc" style={{ marginTop: '8px' }}>
                      {model.description}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* ===== 供应商 — 暂未上线 ===== */}
          <div>
            <h3 className="mm-section-title">供应商</h3>
          </div>
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: '24px 20px',
              border: '1px dashed #E8E0D6',
              textAlign: 'center',
              opacity: 0.7,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: '#F5F3EF',
                color: '#BCAAA4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
              }}
            >
              <Icon icon="mingcute:add-circle-line" style={{ fontSize: '28px' }} />
            </div>
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#999', marginBottom: '4px' }}>
              自定义供应商
            </p>
            <p style={{ fontSize: '12px', color: '#BCAAA4', lineHeight: 1.6 }}>
              支持接入第三方 API Key，选择你自己的模型提供商
              <br />
              如 DeepSeek、通义千问、OpenAI 等
            </p>
            <div
              style={{
                display: 'inline-block',
                marginTop: '12px',
                fontSize: '10px',
                fontWeight: 700,
                padding: '4px 14px',
                background: '#E8E0D6',
                color: '#999',
                borderRadius: '10px',
              }}
            >
              暂未上线，敬请期待
            </div>
          </div>

          {/* 底部提示 */}
          <div
            style={{
              textAlign: 'center',
              padding: '8px 0 16px',
              fontSize: '12px',
              color: '#999',
            }}
          >
            <Icon icon="mingcute:info-circle-line" style={{ fontSize: '14px', marginRight: 4, verticalAlign: -2 }} />
            切换模型后，新的对话将使用所选模型
          </div>
        </div>
      </main>
    </div>
  );
}
