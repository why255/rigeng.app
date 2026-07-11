import { type ReactNode, useEffect, useState, useCallback } from 'react'
import { Icon } from '@iconify/react'
import { TabBar } from './TabBar'
import { checkApkUpdate } from '@/shared/api/versionApi'
import { Capacitor } from '@capacitor/core'

/** 版本更新信息 */
interface UpdateInfo {
  download_url: string
  release_notes: string
  is_critical: boolean
  latest_version: string
}

/**
 * 移动端 H5 全局外壳：
 * - 无顶部栏（页面直接从子模块标题开始）
 * - 底部 80px TabBar 常驻
 * - 无 Sidebar
 * - APK 壳启动时自动检测更新
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [showBanner, setShowBanner] = useState(false)

  // APK 更新检测（仅在 Capacitor 原生环境执行）
  const checkUpdate = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return

    try {
      // 从 Capacitor 获取当前 APK 版本号
      // 使用 build.gradle 中定义的 versionCode (当前为 1)
      const currentVersionCode = 1 // TODO: 后续通过 @capacitor/app 插件动态获取

      const result = await checkApkUpdate(currentVersionCode)
      if (result.needs_update && result.update) {
        setUpdateInfo({
          download_url: result.update.download_url,
          release_notes: result.update.release_notes,
          is_critical: result.update.is_critical,
          latest_version: result.update.latest_version,
        })
        setShowBanner(true)
      }
    } catch {
      // 版本检测失败静默处理，不影响正常使用
    }
  }, [])

  useEffect(() => {
    // 延迟 2 秒检测，优先渲染主页面
    const timer = setTimeout(checkUpdate, 2000)
    return () => clearTimeout(timer)
  }, [checkUpdate])

  // 下载更新
  const handleDownload = useCallback(() => {
    if (updateInfo?.download_url) {
      // 在系统浏览器中打开下载链接
      window.open(updateInfo.download_url, '_system')
    }
  }, [updateInfo])

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
              icon={updateInfo.is_critical ? 'mingcute:warning-line' : 'mingcute:cloud-download-line'}
              style={{ fontSize: '18px', flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>
                {updateInfo.is_critical ? '重要更新' : '新版本可用'} v{updateInfo.latest_version}
              </div>
              <div style={{ fontSize: '11px', opacity: 0.9, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {updateInfo.release_notes}
              </div>
            </div>
            <button
              onClick={handleDownload}
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
              下载
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
