import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rigeng.app',
  appName: '日耕',
  webDir: '../dist/mobile',
  // ⚠️ 生产 APK 不设置 server.url，WebView 从本地 bundle 加载 → origin 为 localhost（安全上下文）
  // getUserMedia() 录音仅安全上下文可用。开发时如需热更新可临时取消注释 url
  server: {
    // url: 'http://47.103.197.189',  // 开发用，发布 APK 前注释掉
    androidScheme: 'http',
    cleartext: true,
  },
};

export default config;
