/**
 * 清除旧版 localStorage 键值。
 * 旧版 HTML (m1-p*.html) 使用的 key 与新 context 不同，
 * 在 App 初始化时调用以避免旧数据污染。
 */
export function clearLegacyMorningPlanStorage(): void {
  const keysToRemove = [
    'morning_plans',      // 旧版 HTML 计划数据
    'careMode',           // 旧版关怀模式
    'voiceMode',          // 旧版语音模式
    'offlineModeEnabled', // 旧版离线模式开关
  ];
  keysToRemove.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // localStorage 不可用时忽略
    }
  });
}
