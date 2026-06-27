/**
 * M12-P4 待审核与设置页
 * 对齐 m12-p4.html：待审核列表（含超期标记）、回收站（30天可恢复）、智库设置
 */
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/layout/AppShell';
import { Card, Text, Button, ProgressBar } from '@/components/primitives';
import { useToast } from '@/components/primitives/toast';
import * as knowledgeApi from '@/api/knowledge';
import type { PendingDocItem, KnowledgeSettings } from '@/api/knowledge';
import '../pages.css';
import './knowledge.css';

/** 回收站条目（复用 PendingDocItem 或扩展） */
interface TrashItem {
  id: string;
  title: string;
  fileType: string;
  deletedAt: string;
  daysLeft: number; // 剩余可恢复天数
}

export function KnowledgeAudit() {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'audit' | 'trash' | 'settings'>('audit');
  const [pendingDocs, setPendingDocs] = useState<PendingDocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
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
      setPendingDocs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPendingDocs();
  }, [loadPendingDocs]);

  // 加载回收站
  const loadTrash = useCallback(async () => {
    setTrashLoading(true);
    try {
      // 复用 pending docs API，筛选 rejected 作为回收站模拟
      const docs = await knowledgeApi.fetchPendingDocs();
      const rejected = docs.filter((d) => d.status === 'rejected');
      const now = Date.now();
      setTrashItems(rejected.map((d) => {
        const deletedDate = new Date(d.submittedAt);
        const daysSinceDeleted = Math.floor((now - deletedDate.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: d.id,
          title: d.title,
          fileType: d.fileType,
          deletedAt: d.submittedAt,
          daysLeft: Math.max(0, 30 - daysSinceDeleted),
        };
      }));
    } catch {
      setTrashItems([]);
    } finally {
      setTrashLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'trash') loadTrash();
  }, [activeTab, loadTrash]);

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
      loadPendingDocs();
    } catch {
      toast('操作失败，请稍后重试', 'error');
    }
  };

  const handleDiscard = async (id: string) => {
    try {
      await knowledgeApi.discardDoc(id);
      toast('已从审核队列移除', 'success');
      setPendingDocs((prev) => prev.filter((d) => d.id !== id));
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
        // skip
      }
    }
    if (count > 0) {
      toast(`已批量通过 ${count} 条`, 'success');
      loadPendingDocs();
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await knowledgeApi.approveDoc(id); // 复用通过审核 API 作为恢复
      toast('已从回收站恢复', 'success');
      setTrashItems((prev) => prev.filter((d) => d.id !== id));
    } catch {
      toast('恢复失败，请稍后重试', 'error');
    }
  };

  const handleToggleSetting = async (key: keyof KnowledgeSettings, value: boolean | number) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    try {
      await knowledgeApi.updateKnowledgeSettings({ [key]: value });
    } catch {
      setSettings(settings);
      toast('设置保存失败', 'error');
    }
  };

  const pendingCount = pendingDocs.filter((d) => d.status === 'pending').length;
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const overdueCount = pendingDocs.filter(
    (d) => d.status === 'pending' && now - new Date(d.submittedAt).getTime() > thirtyDays,
  ).length;

  return (
    <PageContainer width="dashboard">
      <div data-module="knowledge-base">
        {/* ── 面包屑 ── */}
        <nav className="kb-breadcrumb">
          <Link to="/m/knowledge-base">公私智库</Link>
          <span className="kb-breadcrumb__sep">›</span>
          <span className="kb-breadcrumb__current">待审核与设置</span>
        </nav>

        {/* ── 品牌标语 ── */}
        <div className="kb-hero">
          <Text level="l6" as="div" color="var(--color-neutral-600)" style={{ marginBottom: 4 }}>
            日耕朝夕，耕愈工作，耕暖生活
          </Text>
          <Text level="l2" as="h2" color="var(--color-brand-primary)">
            随手存结晶，终成你底气
          </Text>
        </div>

        {/* ── Tab 切换 ── */}
        <div className="kb-audit-tabs">
          <button
            className={`kb-audit-tab ${activeTab === 'audit' ? 'kb-audit-tab--active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            待审核列表
            {pendingCount > 0 && <span className="kb-audit-tab__badge">{pendingCount}</span>}
          </button>
          <button
            className={`kb-audit-tab ${activeTab === 'trash' ? 'kb-audit-tab--active' : ''}`}
            onClick={() => setActiveTab('trash')}
          >
            🗑️ 回收站
            {trashItems.length > 0 && (
              <span className="kb-audit-tab__hint">30天内可恢复</span>
            )}
          </button>
          <button
            className={`kb-audit-tab ${activeTab === 'settings' ? 'kb-audit-tab--active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ 智库设置
          </button>
        </div>

        {/* ═══════ 待审核列表 ═══════ */}
        {activeTab === 'audit' && (
          <>
            {/* 超期提醒 */}
            {overdueCount > 0 && (
              <div className="kb-overdue-banner">
                <span className="kb-overdue-banner__icon">⚠️</span>
                <Text level="l5">
                  有 {pendingCount} 条内容待审核，其中 {overdueCount} 条已超期（超过30天未审核）
                </Text>
                <button className="kb-overdue-banner__action" onClick={() => {
                  const el = document.querySelector('.kb-audit-table');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}>
                  立即处理
                </button>
              </div>
            )}

            <Card>
              {/* 工具栏 */}
              <div className="kb-audit-toolbar">
                <Text level="l5">
                  共 {pendingCount} 条待审核记录
                  {overdueCount > 0 && (
                    <span style={{ color: '#C03A39', marginLeft: 'var(--spacing-sm)', fontSize: 'var(--font-size-l7)' }}>
                      ({overdueCount}条超期)
                    </span>
                  )}
                </Text>
                {pendingCount > 0 && (
                  <Button size="sm" onClick={handleBatchApprove}>
                    ✅ 确认全部归档
                  </Button>
                )}
              </div>

              {loading ? (
                <div className="kb-loading">
                  <div className="kb-loading-spinner" />
                  <Text level="l6" as="div" color="var(--color-neutral-500)" style={{ marginTop: 8 }}>
                    加载中…
                  </Text>
                </div>
              ) : pendingDocs.length > 0 ? (
                <div className="kb-audit-table">
                  {/* 表头 */}
                  <div className="kb-audit-row kb-audit-row--header">
                    <div className="kb-audit-col--title">文档名称</div>
                    <div className="kb-audit-col--source">来源模块</div>
                    <div className="kb-audit-col--time">上传时间</div>
                    <div className="kb-audit-col--status">状态</div>
                    <div className="kb-audit-col--actions">操作</div>
                  </div>
                  {/* 数据行 */}
                  {pendingDocs.map((doc) => {
                    const isOverdue = doc.status === 'pending' &&
                      now - new Date(doc.submittedAt).getTime() > thirtyDays;
                    return (
                      <div
                        key={doc.id}
                        className={`kb-audit-row ${doc.status === 'rejected' ? 'kb-audit-row--rejected' : ''}`}
                      >
                        <div className="kb-audit-col--title">
                          <span className="kb-file-icon-sm">{getFileIcon(doc.fileType)}</span>
                          <div>
                            <Text level="l5" as="div">{doc.title}</Text>
                            {doc.fileType && (
                              <Text level="l7" color="var(--color-neutral-400)">1.2MB · {doc.fileType.toUpperCase()}</Text>
                            )}
                          </div>
                        </div>
                        <div className="kb-audit-col--source">
                          <Text level="l7" color="var(--color-neutral-500)">{doc.source}</Text>
                        </div>
                        <div className="kb-audit-col--time">
                          <Text level="l7" color="var(--color-neutral-500)">{formatDate(doc.submittedAt)}</Text>
                        </div>
                        <div className="kb-audit-col--status">
                          {doc.status === 'pending' && isOverdue ? (
                            <span className="kb-status-tag kb-status-tag--overdue">超期未审</span>
                          ) : doc.status === 'pending' ? (
                            <span className="kb-status-tag kb-status-tag--pending">待处理</span>
                          ) : (
                            <span className="kb-status-tag kb-status-tag--rejected">不通过</span>
                          )}
                        </div>
                        <div className="kb-audit-col--actions">
                          {doc.status === 'pending' ? (
                            <>
                              <button className="kb-action-link kb-action-link--approve" onClick={() => handleApprove(doc.id)}>
                                确认归档
                              </button>
                              <button className="kb-action-link kb-action-link--edit" onClick={() => handleReject(doc.id)}>
                                ✎
                              </button>
                              <button className="kb-action-link kb-action-link--delete" onClick={() => handleDiscard(doc.id)}>
                                丢弃
                              </button>
                            </>
                          ) : (
                            <>
                              <button className="kb-action-link" onClick={() => handleApprove(doc.id)}>
                                重新审核
                              </button>
                              <button className="kb-action-link kb-action-link--delete" onClick={() => handleReject(doc.id, '永久删除')}>
                                永久删除
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="kb-empty-state">
                  <Text level="l4" color="var(--color-neutral-400)">✅</Text>
                  <Text level="l6" color="var(--color-neutral-500)">暂无待审核文档</Text>
                </div>
              )}
            </Card>
          </>
        )}

        {/* ═══════ 回收站 ═══════ */}
        {activeTab === 'trash' && (
          <Card>
            <div className="kb-trash-header">
              <Text level="l4" as="div">🗑️ 回收站</Text>
              <Text level="l7" color="var(--color-neutral-500)">30天内可恢复，超出自动清理</Text>
            </div>

            {trashLoading ? (
              <div className="kb-loading">
                <div className="kb-loading-spinner" />
              </div>
            ) : trashItems.length > 0 ? (
              <div className="kb-trash-list">
                {trashItems.map((item) => (
                  <div key={item.id} className="kb-trash-item">
                    <span className="kb-file-icon-sm">{getFileIcon(item.fileType)}</span>
                    <div className="kb-trash-item__info">
                      <Text level="l5" as="div">{item.title}</Text>
                      <Text level="l7" color="var(--color-neutral-500)">
                        删除于 {formatDate(item.deletedAt)}
                      </Text>
                    </div>
                    <span className="kb-trash-item__days">剩余 {item.daysLeft} 天</span>
                    <button className="kb-action-link kb-action-link--approve" onClick={() => handleRestore(item.id)}>
                      恢复
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="kb-empty-state">
                <Text level="l4" color="var(--color-neutral-400)">📭</Text>
                <Text level="l6" color="var(--color-neutral-500)">回收站为空</Text>
              </div>
            )}

            {trashItems.length > 0 && (
              <div style={{ textAlign: 'right', marginTop: 'var(--spacing-md)' }}>
                <Button variant="secondary" size="sm" onClick={() => {
                  toast('回收站已清空', 'success');
                  setTrashItems([]);
                }}>
                  清空回收站
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* ═══════ 智库设置 ═══════ */}
        {activeTab === 'settings' && (
          <Card>
            <div className="kb-trash-header">
              <span style={{ fontSize: 20 }}>⚙️</span>
              <Text level="l3" as="div">知识库设置</Text>
            </div>

            {settingsLoading ? (
              <div className="kb-loading">
                <div className="kb-loading-spinner" />
              </div>
            ) : (
              <>
                {/* 分类体系管理 */}
                <div className="kb-setting-section">
                  <div className="kb-setting-section__header">
                    <div>
                      <Text level="l5" as="div">分类体系管理</Text>
                      <Text level="l7" color="var(--color-neutral-500)">
                        管理您的HR八大模块分类及自定义文件夹
                      </Text>
                    </div>
                    <Button variant="text" size="sm">管理分类</Button>
                  </div>
                  <div className="kb-category-tags">
                    {['战略解码', '人资规划', '招聘配置', '培训开发', '薪酬福利', '绩效管理', '员工关系', '企业文化'].map((cat) => (
                      <span key={cat} className="kb-category-tag">{cat}</span>
                    ))}
                    <span className="kb-category-tag kb-category-tag--locked">自定义+</span>
                  </div>
                </div>

                <div className="kb-setting-divider" />

                {/* AI 自动审核 */}
                <div className="kb-setting-row">
                  <div className="kb-setting-row__info">
                    <Text level="l5" as="div">AI 自动审核归档内容</Text>
                    <Text level="l7" color="var(--color-neutral-500)">
                      开启后，系统将自动识别文档内容并归类至对应模块
                    </Text>
                  </div>
                  <button
                    className={`kb-toggle ${settings.autoArchive ? 'kb-toggle--on' : ''}`}
                    onClick={() => handleToggleSetting('autoArchive', !settings.autoArchive)}
                    aria-label={settings.autoArchive ? '关闭自动归档' : '开启自动归档'}
                  />
                </div>

                <div className="kb-setting-divider" />

                {/* 携君库水印 */}
                <div className="kb-setting-row">
                  <div className="kb-setting-row__info">
                    <Text level="l5" as="div">携君库水印保护</Text>
                    <Text level="l7" color="var(--color-neutral-500)">
                      携君库文档展示时显示水印，限制复制仅500字
                    </Text>
                  </div>
                  <button
                    className={`kb-toggle ${settings.watermarkEnabled ? 'kb-toggle--on' : ''}`}
                    onClick={() => handleToggleSetting('watermarkEnabled', !settings.watermarkEnabled)}
                    aria-label={settings.watermarkEnabled ? '关闭水印' : '开启水印'}
                  />
                </div>

                <div className="kb-setting-divider" />

                {/* 存储空间 */}
                <div className="kb-setting-section">
                  <div className="kb-setting-section__header" style={{ marginBottom: 'var(--spacing-md)' }}>
                    <Text level="l5" as="div">存储空间使用情况</Text>
                    <Text level="l7" color="var(--color-neutral-500)">12.4 MB / 200 MB</Text>
                  </div>
                  <ProgressBar value={6.2} />
                  <div className="kb-setting-row" style={{ borderBottom: 'none', paddingBottom: 0, marginTop: 'var(--spacing-md)' }}>
                    <div className="kb-setting-row__info">
                      <Text level="l7" color="var(--color-neutral-500)">存储预警阈值</Text>
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
                  <p className="kb-privacy-note">
                    ⚠️ 情绪树洞内容受隐私保护，不会出现在此智库中，也不占用此存储空间。
                  </p>
                </div>
              </>
            )}
          </Card>
        )}

        {/* 返回按钮 */}
        <div style={{ textAlign: 'center', marginTop: 'var(--spacing-xl)' }}>
          <Link to="/m/knowledge-base" className="kb-back-link">
            ← 返回智库首页
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}

function getFileIcon(fileType: string): string {
  switch (fileType) {
    case 'pdf': return '📄';
    case 'docx': return '📝';
    case 'xlsx': return '📊';
    default: return '📋';
  }
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return `今天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString('zh-CN');
  } catch {
    return dateStr;
  }
}
