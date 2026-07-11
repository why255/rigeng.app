import { type ReactNode, useEffect, useState, useCallback } from 'react'
import { Icon } from '@iconify/react'
import { TabBar } from './TabBar'
import { checkApkUpdate, type UpdateInfo } from '@/shared/api/versionApi'
import { Capacitor } from '@capacitor/core'

/**
 * 移动端 H5 全局外壳：
 * - APK 壳启动时自动检测版本更新（顶部横幅）
 * - H5 浏览器每 10 分钟检测一次有无新版本（无痛刷新）
 * - 底部 80px TabBar 常驻
 * - 无 Sidebar
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [showBanner, setShowBanner] = useState(false)

  // APK 更新检测（仅在 Capacitor 原生环境执行）
  const checkUpdate = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return

    try {
      // 当前 APK versionCode = 2 (build.gradle 中定义)
      const currentVersionCode = 2
      const result = await checkApkUpdate(currentVersionCode)
      if (result.needs_update && result.update) {
        setUpdateInfo(result.update)
        setShowBanner(true)
      }
    } catch {
      // 版本检测失败静默处理
    }
  }, [])

  // APK 壳：延迟检测更新
  useEffect(() => {
    const timer = setTimeout(checkUpdate, 2000)
    return () => clearTimeout(timer)
  }, [checkUpdate])

  // H5 浏览器：每 10 分钟检测一次版本更新（通过 version.json）
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return
    let cancelled = false

    async function pollVersion() {
      try {
        const resp = await fetch('/version.json', { cache: 'no-cache' })
        const data = await resp.json()
        const key = 'rg_h5_version'
        const stored = localStorage.getItem(key)
        if (stored && data.version !== stored) {
          // 有新版本 → 提示用户刷新
          if (!cancelled) {
            setUpdateInfo({
              current_version: stored,
              latest_version: data.version,
              download_url: '',
              release_notes: '页面已更新，请刷新获取最新版本',
              is_critical: false,
            })
            setShowBanner(true)
          }
        }
        localStorage.setItem(key, data.version)
      } catch { /* 静默 */ }
    }

    pollVersion() // 首次立即检查
    const interval = setInterval(pollVersion, 10 * 60 * 1000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // 下载更新（APK）
  const handleDownload = useCallback(() => {
    if (updateInfo?.download_url) {
      window.open(updateInfo.download_url, '_system')
    }
  }, [updateInfo])

  // H5 刷新
  const handleRefresh = useCallback(() => {
    window.location.reload()
  }, [])

  const isNative = Capacitor.isNativePlatform()

  return (
    <div className="rg-shell-mobile">
      <div className="rg-main">
        {/* 更新提示横幅 */}
        {showBanner && updateInfo && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 9999,
              background: updateInfo.is_critical
                ? 'linear-gradient(135deg, #ff6b6b, #ee5a24)'
                : 'linear-gradient(135deg, #667eea, #764ba2)',
              color: '#fff',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              animation: 'slideDown 0.3s ease-out',
            }}
          >
            <Icon
              icon={updateInfo.is_critical ? 'mingcute:warning-line' : isNative ? 'mingcute:cloud-download-line' : 'mingcute:refresh-line'}
              style={{ fontSize: '18px', flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>
                {updateInfo.is_critical ? '重要更新' : isNative ? '新版本可用' : '页面已更新'} v{updateInfo.latest_version}
              </div>
              <div style={{ fontSize: '11px', opacity: 0.9, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {updateInfo.release_notes}
              </div>
            </div>
            <button
              onClick={isNative ? handleDownload : handleRefresh}
              style={{
                background: 'rgba(255,255,255,0.25)',
                border: '1px solid rgba(255,255,255,0.4)',
                color: '#fff',
                padding: '4px 12px',
                borderRadius: '14px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {isNative ? '下载' : '刷新'}
            </button>
            {!updateInfo.is_critical && (
              <button
                onClick={() => setShowBanner(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255,255,255,0.6)',
                  padding: '4px',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <Icon icon="mingcute:close-line" style={{ fontSize: '16px' }} />
              </button>
            )}
          </div>
        )}
        <main className="rg-page" style={showBanner ? { paddingTop: '44px' } : undefined}>
          {children}
        </main>
        <TabBar />
      </div>

      {/* slideDown 动画 */}
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

/** 页面容器：移动端全宽布局 */
export function PageContainer({
  width = 'chat',
  children,
}: {
  width?: 'chat' | 'dashboard'
  children: ReactNode
}) {
  return (
    <div className={`content-area ${width === 'dashboard' ? 'content-area--dashboard' : ''}`}>
      {children}
    </div>
  )
}
