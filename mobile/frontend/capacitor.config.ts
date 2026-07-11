import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rigeng.app',
  appName: '日耕',
  webDir: '../dist/mobile',
  server: {
    androidScheme: 'http',
    cleartext: true,  // 允许 HTTP 访问服务器 47.103.197.189
  },
};

export default config;
