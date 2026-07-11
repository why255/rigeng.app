/**
 * 版本检查 API —— APK 自主更新。
 *
 * APK 壳启动时调用 /version/check，对比 apk_version_code。
 * 若服务器版本更高，弹出下载横幅引导用户更新。
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

export interface UpdateInfo {
  current_version: string;
  latest_version: string;
  download_url: string;
  release_notes: string;
  is_critical: boolean;
}

export interface UpdateCheckResult {
  needs_update: boolean;
  update: UpdateInfo | null;
  server_version: VersionInfo;
}

/**
 * 检查 APK 是否需要更新。
 * @param apkVersionCode 当前 APK 版本号（即 build.gradle 中的 versionCode）
 */
export async function checkApkUpdate(apkVersionCode: number): Promise<UpdateCheckResult> {
  return apiGet<UpdateCheckResult>('/version/check', {
    apk_version_code: String(apkVersionCode),
  });
}
