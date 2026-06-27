// 手机端模拟预览 — 用 iPhone 15 Pro 打开日耕前端
import { chromium, devices } from 'playwright';

const browser = await chromium.launch({ headless: false });
const iPhone = devices['iPhone 15 Pro'];
const context = await browser.newContext({
  ...iPhone,
  locale: 'zh-CN',
});
const page = await context.newPage();
await page.goto('http://localhost:5180');
console.log('✅ 已用 iPhone 15 Pro 模拟打开 http://localhost:5180');
console.log('📱 浏览器窗口保持打开，可手动操作登录。关闭窗口即退出。');
