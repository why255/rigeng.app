/**
 * 版本检查 API —— 检测 APK 更新。
 *
 * H5 页面 WebView 加载时自动获取最新代码（无需检测）。
 * APK 壳版本通过 /api/v1/version/check 比较 apk_version_code。
 */
import { apiGet } from './api';

export interface VersionInfo {
  apk_version: string;
  apk_version_code: number;
  apk_url: string;
  h5_version: string;
  h5_build_time: string;
  release_notes: string;
  min_apk_version_code: number;
}

export interface UpdateCheckResult {
  needs_update: boolean;
  update: {
    current_version: string;
    latest_version: string;
    download_url: string;
    release_notes: string;
    is_critical: boolean;
  } | null;
  server_version: VersionInfo;
}

/**
 * 检查 APK 是否需要更新。
 * @param apkVersionCode 当前 APK 版本号（0 表示浏览器环境）
 */
export async function checkApkUpdate(apkVersionCode: number = 0): Promise<UpdateCheckResult> {
  return apiGet<UpdateCheckResult>('/version/check', {
    apk_version_code: String(apkVersionCode),
    h5_version: __APP_VERSION__,
  });
}

/**
 * 获取最新版本信息（无需对比）。
 */
export async function getLatestVersion(): Promise<VersionInfo> {
  return apiGet<VersionInfo>('/version');
}
