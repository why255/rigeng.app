/**
 * M12-P4 待审核与设置页
 * 对齐 m12-p4.html：待审核列表、模块设置
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/AppShell';
import { Card, Text, Tag, Button } from '@rigeng/shared/components/primitives';
import { useToast } from '@rigeng/shared/components/primitives/toast';
import * as knowledgeApi from '@rigeng/shared/api/knowledge';
import type { PendingDocItem, KnowledgeSettings } from '@rigeng/shared/api/knowledge';
import '../pages.css';
import './knowledge.css';

export function KnowledgeAudit() {
  const navigate = useNavigate();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'audit' | 'settings'>('audit');
  const [pendingDocs, setPendingDocs] = useState<PendingDocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<KnowledgeSettings>({
    autoArchive: true,
    watermarkEnabled: true,
    storageAlertThreshold: 80,
  });
  const [settingsLoading, setSettingsLoading] = useState(true);

  // 加载待审核列表
  const loadPendingDocs = useCallback(async () => {
    setLoading(true);
    try {
      const docs = await knowledgeApi.fetchPendingDocs();
      setPendingDocs(docs);
    } catch {
      // fallback: empty list
      setPendingDocs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPendingDocs();
  }, [loadPendingDocs]);

  // 加载设置
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setSettingsLoading(true);
      try {
        const s = await knowledgeApi.fetchKnowledgeSettings();
        if (!cancelled) setSettings(s);
      } catch {
        // keep defaults
      } finally {
        if (!cancelled) setSettingsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await knowledgeApi.approveDoc(id);
      toast('已通过审核', 'success');
      setPendingDocs((prev) => prev.filter((d) => d.id !== id));
    } catch {
      toast('操作失败，请稍后重试', 'error');
    }
  };

  const handleReject = async (id: string, reason?: string) => {
    try {
      await knowledgeApi.rejectDoc(id, reason);
      toast('已驳回', 'warning');
      loadPendingDocs(); // reload
    } catch {
      toast('操作失败，请稍后重试', 'error');
    }
  };

  const handleBatchApprove = async () => {
    let count = 0;
    const pendingItems = pendingDocs.filter((d) => d.status === 'pending');
    for (const doc of pendingItems) {
      try {
        await knowledgeApi.approveDoc(doc.id);
        count++;
      } catch {
        // skip failed
      }
    }
    if (count > 0) {
      toast(`已批量通过 ${count} 条`, 'success');
      loadPendingDocs();
    }
  };

  const handleToggleSetting = async (key: keyof KnowledgeSettings, value: boolean | number) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    try {
      await knowledgeApi.updateKnowledgeSettings({ [key]: value });
    } catch {
      // revert on failure
      setSettings(settings);
      toast('设置保存失败', 'error');
    }
  };

  const pendingCount = pendingDocs.filter((d) => d.status === 'pending').length;

  return (
    <PageContainer width="dashboard">
      <div data-module="knowledge-base">
        {/* 品牌标语 */}
        <div style={{ textAlign: 'center', padding: 'var(--spacing-md) 0' }}>
          <Text level="l6" as="div" color="var(--color-neutral-500)">
            日耕朝夕，耕愈工作，耕暖生活
          </Text>
          <Text level="l3" as="div" color="var(--color-brand-primary)" style={{ marginTop: 4 }}>
            随手存结晶，终成你底气
          </Text>
        </div>

        {/* Tab 切换 */}
        <div className="kb-audit-tabs">
          <button
            className={`kb-audit-tab ${activeTab === 'audit' ? 'kb-audit-tab--active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            待审核列表
            {pendingCount > 0 && <span className="kb-audit-tab__badge">{pendingCount}</span>}
          </button>
          <button
            className={`kb-audit-tab ${activeTab === 'settings' ? 'kb-audit-tab--active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            模块设置
          </button>
        </div>

        {activeTab === 'audit' && (
          <Card>
            {/* 工具栏 */}
            {pendingCount > 0 && (
              <div className="kb-audit-toolbar">
                <Text level="l5">共 {pendingCount} 条待审核记录</Text>
                <Button size="sm" onClick={handleBatchApprove}>
                  ✅ 批量确认
                </Button>
              </div>
            )}

            {loading ? (
              <div className="kb-loading">
                <div className="kb-loading-spinner" />
                <Text level="l6" as="div" color="var(--color-neutral-500)" style={{ marginTop: 8 }}>
                  加载中…
                </Text>
              </div>
            ) : pendingDocs.length > 0 ? (
              <div>
                {pendingDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className={`kb-audit-item ${doc.status === 'rejected' ? 'kb-audit-item--rejected' : ''}`}
                  >
                    <div className="kb-audit-item__header">
                      <span className="kb-file-icon" style={{ fontSize: 24 }}>
                        {doc.fileType === 'pdf' ? '📄' : doc.fileType === 'docx' ? '📝' : '🖼️'}
                      </span>
                      <div className="kb-audit-item__info">
                        <Text level="l4" as="div">{doc.title}</Text>
                        <div className="kb-audit-item__meta">
                          {doc.status === 'pending' ? (
                            <Tag tone="warning">待审核</Tag>
                          ) : (
                            <Tag tone="error">不通过</Tag>
                          )}
                          <Text level="l7" color="var(--color-neutral-500)">
                            来源: {doc.source}
                          </Text>
                          <Text level="l7" color="var(--color-neutral-500)">
                            {doc.submittedAt}
                          </Text>
                        </div>
                      </div>
                    </div>

                    {/* 驳回理由 */}
                    {doc.status === 'rejected' && doc.rejectReason && (
                      <div className="kb-reject-reason">
                        {doc.rejectReason}
                      </div>
                    )}

                    {/* 操作按钮 */}
                    <div className="kb-audit-item__actions">
                      {doc.status === 'pending' ? (
                        <>
                          <Button variant="secondary" size="sm" onClick={() => handleReject(doc.id)}>
                            驳回
                          </Button>
                          <Button size="sm" onClick={() => handleApprove(doc.id)}>
                            通过
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="secondary" size="sm" onClick={() => handleApprove(doc.id)}>
                            重新审核
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => handleReject(doc.id, '永久删除')}>
                            🗑️ 永久删除
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="kb-empty-state">
                <Text level="l4" color="var(--color-neutral-400)">✅</Text>
                <Text level="l6" color="var(--color-neutral-500)">
                  暂无待审核文档
                </Text>
              </div>
            )}

            <div style={{ marginTop: 'var(--spacing-md)', textAlign: 'center' }}>
              <Button variant="secondary" size="sm" onClick={() => navigate('/m/knowledge-base')}>
                ← 返回智库首页
              </Button>
            </div>
          </Card>
        )}

        {activeTab === 'settings' && (
          <Card>
            <div className="pg-row" style={{ marginBottom: 'var(--spacing-md)' }}>
              <span style={{ fontSize: 20 }}>⚙️</span>
              <Text level="l3" as="div">公私智库模块设置</Text>
            </div>

            {settingsLoading ? (
              <div className="kb-loading">
                <div className="kb-loading-spinner" />
              </div>
            ) : (
              <>
                {/* 自动归档 */}
                <div className="kb-setting-row">
                  <div className="kb-setting-row__info">
                    <Text level="l5" as="div">自动归档</Text>
                    <Text level="l7" color="var(--color-neutral-500)">
                      朝有规划和暮有复盘的产出自动归档到知识库
                    </Text>
                  </div>
                  <button
                    className={`kb-toggle ${settings.autoArchive ? 'kb-toggle--on' : ''}`}
                    onClick={() => handleToggleSetting('autoArchive', !settings.autoArchive)}
                    aria-label={settings.autoArchive ? '关闭自动归档' : '开启自动归档'}
                  />
                </div>

                {/* 携君库水印 */}
                <div className="kb-setting-row">
                  <div className="kb-setting-row__info">
                    <Text level="l5" as="div">携君库水印保护</Text>
                    <Text level="l7" color="var(--color-neutral-500)">
                      携君库文档展示时显示水印，限制复制
                    </Text>
                  </div>
                  <button
                    className={`kb-toggle ${settings.watermarkEnabled ? 'kb-toggle--on' : ''}`}
                    onClick={() => handleToggleSetting('watermarkEnabled', !settings.watermarkEnabled)}
                    aria-label={settings.watermarkEnabled ? '关闭水印' : '开启水印'}
                  />
                </div>

                {/* 存储预警阈值 */}
                <div className="kb-setting-row">
                  <div className="kb-setting-row__info">
                    <Text level="l5" as="div">存储预警阈值</Text>
                    <Text level="l7" color="var(--color-neutral-500)">
                      当存储使用超过该百分比时发送提醒
                    </Text>
                  </div>
                  <div className="kb-threshold-slider">
                    <input
                      type="range"
                      min="50"
                      max="95"
                      step="5"
                      value={settings.storageAlertThreshold}
                      onChange={(e) => handleToggleSetting('storageAlertThreshold', parseInt(e.target.value))}
                    />
                    <Text level="l5">{settings.storageAlertThreshold}%</Text>
                  </div>
                </div>
              </>
            )}
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
