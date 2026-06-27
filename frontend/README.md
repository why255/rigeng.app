# 日耕（RiGeng）前端

> 依据《日耕品牌统一标准锁定书 V1.1》+ 步骤4《前端组件库规划》+ 步骤5《全局信息架构设计》搭建。
> 技术栈：**React 18 + Vite + TypeScript**，响应式（移动优先）。

## 启动

```bash
cd frontend
npm install
npm run dev      # 默认 http://localhost:5180
npm run build    # tsc 类型检查 + 生产构建
```

## 本期交付（设计系统 + 全局框架 + 代表页）

### 1. 设计令牌系统 `src/styles/`
- `tokens.css`：100% 照搬《CSS变量定义表 V1.2》——颜色/字体 L0–L7/间距/圆角/阴影/动效/z-index/组件尺寸；
  `[data-theme="dark"]`（情绪树洞暗色）；13 个 `[data-module="…"]` 专属色；勇气值变量。
- `reset.css` / `global.css`：字体栈、`.content-area` 居中聚拢（680/960px）、字体层级工具类、动效关键帧。

### 2. 组件库 `src/components/`
- `primitives/`：Text(L0–L7)、Card(色条)、Button(主/次/文字)、Input/Textarea、ProgressBar、Tag、Avatar(小耕IP)、Lock、Toast。
- `chat/`：ChatBubble、ThinkingDots(25c)、VoiceButton(04)、VoicePlayIcon(06)、Waveform(12)。
- `business/`：DualLibTabs(14)、StepFlow(23)、MoodScore(25g)、CourageBar(25h)、RolePanel(18)、RichTextStub(15)；
  `charts.tsx` 数据图表包(16)：LineChart/BarChart/RadarChart（轻量内联 SVG，可平替 ECharts）。
- `layout/`：AppShell + Sidebar(24a 240px) + TabBar(24b 80px) + TopBar(24d) + PageContainer(24c)，`useMediaQuery` 768px 断点切换。

### 3. 页面 `src/pages/`
| 路由 | 页面 | 验证页型 |
|---|---|---|
| `/` | 首页（品牌门面 + 13 模块入口） | 导航 + 品牌语三层体系 |
| `/m/:slug` | 通用模块入口模板（M*-P1） | 入口页型复用 |
| `/b/:board` | 移动端板块卡片网格 | 移动端 Tab 导航 |
| `/m/morning-plan/chat` | 朝有规划·对话主页（M1-P2） | 亮色对话 680px |
| `/m/mood-haven/chat` | 情绪树洞·倾诉页（M3-P2） | 暗色 + 安全承诺/计时器/情绪评分/危机弹窗 |
| `/m/smart-office/work` | 智能办公·双库页（M6-P2） | 仪表盘+编辑器 960px 双栏 |
| `/m/career-mentor/steps` | 高维求职·五步法（M7-P2） | 长流程 + 军师蓝 + 雷达图 |
| `/m/data-analytics/insight` | 数据分析·数据洞察（M13-P2） | 多图表仪表盘 |

## 品牌合规
- 用户可见处 0「AI」字样（用「智能/小耕」）；板块名「升值涨薪」「品牌打造中心」；无禁用词。
- 主 Slogan 唯一全站可见；模块品牌语 100% 引用锁定书第二章固定资产（见 `src/data/modules.ts`）。

## 不在本期范围
- 54 页全量（其余模块走通用入口模板）；真实 FastAPI 接口（用 `src/data/mock.ts`）；富文本/甘特/图表完整交互（轻量占位，已预留替换点）。
