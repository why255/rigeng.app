// iPhone 15 Pro 模拟打开日耕移动端 - 数据分析模块
import { chromium, devices } from 'playwright';

const browser = await chromium.launch({ headless: false });
const iPhone = devices['iPhone 15 Pro'];
const context = await browser.newContext({
  ...iPhone,
  locale: 'zh-CN',
});
const page = await context.newPage();

// 先打开首页
await page.goto('http://localhost:5182/');
console.log('✅ 日耕移动端首页已加载');
console.log('');

// 再导航到数据分析首页
await page.goto('http://localhost:5182/m/data-analytics');
console.log('📊 数据分析首页: http://localhost:5182/m/data-analytics');
console.log('🔍 数据洞察页: http://localhost:5182/m/data-analytics/insight');
console.log('');
console.log('📱 iPhone 15 Pro 模拟中 — 可手动操作浏览。关闭窗口即退出。');
