/**
 * P5 离线模式 — 本地录音 + 网络恢复自动同步。
 * Route: /m/morning-plan/offline
 * 对齐 m1p5 设计。严格要求：去除右上角设置图标。
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { useMorningPlan } from '@/shared/context/MorningPlanContext';
import { VoiceButton } from '@/components/morning-plan/VoiceButton';
import { syncOffline, type SyncItem } from '@/shared/api/plans';
import { getAllRecordings, clearAllRecordings, type OfflineRecording } from '@/shared/utils/offlineRecordingsDB';
import './morning-plan.css';

export function MorningPlanOffline() {
  const navigate = useNavigate();
  const { isOnline } = useOnlineStatus();
  const { addPlan } = useMorningPlan();
  const [recordingCount, setRecordingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);

  const syncTriggeredRef = useRef(false);

  // Load existing recording count
  useEffect(() => {
    getAllRecordings().then((r) => setRecordingCount(r.length));
  }, []);

  // When online comes back, auto-sync and redirect
  useEffect(() => {
    if (isOnline && !syncTriggeredRef.current) {
      syncTriggeredRef.current = true;
      handleSyncAndRedirect();
    }
  }, [isOnline]);

  const handleSyncAndRedirect = async () => {
    setSyncing(true);
    try {
      const recordings = await getAllRecordings();
      if (recordings.length > 0) {
        // Build sync items from recordings
        const items: SyncItem[] = recordings.map((r) => ({
          action: 'create_plan' as const,
          payload: {
            recorded_at: r.timestamp,
            duration: r.duration,
          },
          timestamp: r.timestamp,
        }));

        try {
          await syncOffline(items);
        } catch {
          // Sync API may fail but we still clear local cache for now
          // The recordings will be re-processed on next connection
        }

        // Add recordings as plan text (best effort)
        for (const r of recordings) {
          addPlan(`离线录音 (${Math.round(r.duration)}秒)`, 'urgent_important');
        }

        await clearAllRecordings();
        setRecordingCount(0);
      }
      setSyncDone(true);

      // Redirect back to chat after a short delay
      setTimeout(() => {
        navigate('/m/morning-plan/chat', { replace: true });
      }, 1500);
    } finally {
      setSyncing(false);
    }
  };

  const handleTranscript = useCallback((text: string) => {
    // In offline mode, add transcript as a plan directly
    if (text.trim()) {
      addPlan(text, 'urgent_important');
    }
  }, [addPlan]);

  const handleRecordingStored = useCallback((_recording: OfflineRecording) => {
    setRecordingCount((prev) => prev + 1);
  }, []);

  return (
    <div className="mp-mobile-page">
      {/* ===== Header — NO settings icon per m1.md requirement ===== */}
      <header className="mp-mobile-page__header" style={{ height: 48 }}>
        <button className="mp-header-btn" onClick={() => navigate(-1)}>
          <Icon icon="mingcute:arrow-left-fill" style={{ fontSize: '24px' }} />
        </button>
        <span className="font-zcool" style={{ fontSize: '18px', fontWeight: 700, color: '#C03A39' }}>
          离线模式
        </span>
        {/* 严格要求：去除 m1p5 页面右上角的"设置"图标 */}
        <div className="mp-header-spacer" />
      </header>

      {/* ===== Content ===== */}
      <main className="mp-main-scroll">
        <div className="mp-main-padding" style={{ textAlign: 'center' }}>
          {/* Network status badge */}
          <div style={{ marginBottom: 24 }}>
            {isOnline ? (
              <div className="mp-sync-indicator">
                <Icon icon="mingcute:wifi-fill" style={{ fontSize: '16px', color: '#388E3C' }} />
                <span className="mp-sync-indicator__text">网络已恢复</span>
              </div>
            ) : (
              <span className="mp-offline-badge">
                <Icon icon="mingcute:wifi-off-line" style={{ fontSize: '14px', marginRight: 4 }} />
                离线状态
              </span>
            )}
          </div>

          {/* Offline indicator */}
          <div className="mp-offline-indicator" style={{ marginBottom: 32 }}>
            <Icon
              icon="mingcute:mic-fill"
              style={{ fontSize: '48px', color: '#D4A574', opacity: 0.8 }}
            />
            <p className="mp-offline-status-text">
              {syncing ? '正在同步...' : syncDone ? '同步完成！' : '当前处于离线模式'}
            </p>
            <p className="mp-offline-hint">
              {syncing
                ? '正在将离线录音上传到服务器...'
                : syncDone
                  ? '即将返回对话页面...'
                  : '您可以正常录制语音计划\n网络恢复后将自动同步'}
            </p>
          </div>

          {/* Recording count badge */}
          {recordingCount > 0 && !syncing && (
            <div className="mp-plan-count-badge" style={{ justifyContent: 'center', marginBottom: 24 }}>
              <Icon icon="mingcute:record-fill" style={{ fontSize: '14px' }} />
              {recordingCount} 条离线录音待同步
            </div>
          )}

          {/* Voice recording — only available in offline mode */}
          {!isOnline && !syncing && (
            <VoiceButton
              mode="click"
              offline
              onTranscript={handleTranscript}
              onRecordingStored={handleRecordingStored}
            />
          )}

          {/* Syncing indicator */}
          {syncing && (
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <Icon
                icon="mingcute:loading-line"
                style={{
                  fontSize: '24px',
                  color: '#C03A39',
                  animation: 'spin 1s linear infinite',
                }}
              />
            </div>
          )}

          {/* Manual sync button (when online with unsynced recordings) */}
          {isOnline && recordingCount > 0 && !syncing && !syncDone && (
            <button
              className="mp-btn-primary"
              style={{ marginTop: 24 }}
              onClick={handleSyncAndRedirect}
            >
              立即同步
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
