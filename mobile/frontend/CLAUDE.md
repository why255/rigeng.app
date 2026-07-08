# 移动端 H5 开发规范

> **适用范围**：`frontend/mobile/` 目录下所有代码。每次操作移动端文件前，CLI 会注入此文件到上下文。

---

## 0. 设计铁律：原型文件是唯一真理

根目录下的 `m3p1-mobile.html` ~ `m3p5-mobile.html` 是**唯一设计权威**。每个移动端组件的 `m3p*-mobile.html` 就是该组件的 SPEC。

实现组件时**必须**：

1. **先读完对应的 m3p*-mobile.html 文件**，逐行理解每个元素、每个 CSS 属性、每个事件处理
2. **逐元素对照实现**：HTML 里的每个 `<div>`、每个 `<button>`、每个 `<input>` 都要在 React 组件中有对应
3. **CSS 精确匹配**：颜色值、`border-radius`、`padding`、`font-size`、`position` 必须完全一致
4. **交互行为一致**：事件处理逻辑（touch/mouse/click）、状态切换、动画时序必须匹配原型
5. **禁止自由发挥**：原型没有的元素不添加；原型有的元素不能省略；不自创交互方式

**检查清单**（实现完成后对照）：
- [ ] 每个 HTML 元素都有对应的 React 元素
- [ ] 颜色值完全相同（精确到 hex）
- [ ] 布局结构相同（flex 方向、对齐方式、层级关系）
- [ ] 动画相同（keyframes、duration、easing）
- [ ] 事件处理相同（touchstart/touchend/click/mousedown/mouseup）
- [ ] 没有多余元素（原型里不存在的 UI 不添加）

---

## 1. 样式规则

### 硬性禁止
- **禁止 Tailwind CSS** — 任何 `tailwindcss`、`tw-` 前缀、`@apply` 指令均不允许
- **禁止 `<iconify-icon>` web component** — 使用 `@iconify/react` 的 `<Icon>` 组件
- **禁止 emoji 字符** — 所有图标使用 `<Icon icon="..." />`，表情使用 Iconify 图标替代
- **禁止全局 CSS 变量** — 颜色、尺寸等硬编码到 BEM 类或内联 style 中（原型文件用的就是硬编码值）

### 正确做法
- **BEM 类名**：`mh-*`（情绪树洞）、`mp-*`（朝有规划）、`er-*`（暮有复盘）、`sq-*`（智能问答）等
- **内联 style**：适合一次性、组件特定的样式
- **模块 CSS 文件**：`mood-haven.css`、`morning-plan.css`、`smart-qa.css` 等

### 设计规范
- **暗色主题**（情绪树洞）：底色 `#1a1a1a`，卡片 `#2d2d44`，输入区 `#2a2a3a`，强调色 `#FFCC80`，文字 `#E0E0E0`
- **亮色主题**：底色 `#F5F3EF`，卡片 `#FFFFFF`，边框 `#E8E0D6`，品牌色 `#C03A39`

---

## 2. 目录隔离

### 禁止
- **禁止引用 `frontend/pc/` 目录下的任何文件** — PC 端和移动端完全独立
- **禁止引用 `frontend/src/` 目录** — 那是旧框架目录，不应使用
- **禁止在移动端组件中使用 PC 端 CSS 类名**（如 `pc-*` 前缀）

### 允许
- **`@/shared`**：共享类型、API、hooks、工具函数、UI 组件（内置于 `src/shared/`）
- **`@/` 别名**：指向 `frontend/mobile/src/`
- **`@iconify/react`**：图标组件

---

## 3. 组件规范

### 文件组织
- `src/pages/board1/` — 板卡1（日耕：朝有规划、暮有复盘、情绪树洞）
- `src/pages/board2/` — 板卡2（涨薪：智能记录、智能问答、智能办公、职业导师）
- `src/pages/board3/` — 板卡3（升级：品牌、客户、产品、交付）
- `src/pages/board4/` — 板卡4（智库：知识库、数据分析）
- `src/pages/morning-plan/` — 朝有规划子模块
- `src/pages/evening-review/` — 暮有复盘子模块
- `src/components/` — 复用组件

### 组件模板
```tsx
/**
 * [页面名称] — [简短描述]
 * Route: /m/[slug]
 * 对齐 [原型文件名] 设计规范。
 *
 * 使用 mh-* BEM 类名 + 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。返回按钮使用 navigate(-1)。
 */
```

### 路由约定
- `/b/:board` — Tab 导航板卡网格
- `/m/:slug` — 模块首页
- `/m/:slug/subpage` — 模块子页面
- 返回按钮统一使用 `navigate(-1)`

---

## 4. 开发流程

### 启动命令
```bash
cd frontend/mobile && npm run dev    # 端口 5182，热更新
```

### 类型检查
```bash
cd frontend/mobile && npx tsc --noEmit
```

### 页面访问
- 首页：`http://127.0.0.1:5182/`
- 情绪树洞：`http://127.0.0.1:5182/m/mood-haven/chat`
- 朝有规划：`http://127.0.0.1:5182/m/morning-plan/chat`

### API 代理
Vite 自动将 `/api/*` 代理到 `http://127.0.0.1:8000`，无需额外配置。

---

## 5. 代码规则

### TypeScript
- 所有 `.tsx` 文件严格类型化
- 使用 `@/shared` 导出的类型（如 `ChatMessage`、`TodayEmotion`）
- 避免 `any`，如果确实需要加注释说明原因

### localStorage
- 模块隔离前缀：`mh_*`（情绪树洞）、`mp_*`（朝有规划）、`er_*`（暮有复盘）
- 禁止跨模块共用 key

### 依赖
- 图标：`@iconify/react` 的 `<Icon>` 组件
- 路由：`react-router-dom` v6（`useNavigate`、`Link`、`useParams`）
- 状态：React `useState`/`useRef`/`useEffect`/`useCallback`，不引入额外状态库
- 图表：`echarts-for-react`（仅在数据分析页面使用）

---

## 6. 上下文自检

完成任何移动端改动后，CLI 应自问：
1. 原型文件读了吗？改动的每个像素都能在原型中找到对应吗？
2. 有用 Tailwind 吗？（grep `tailwind\|tw-\|\.tw\b` 确认）
3. 有用 emoji 吗？（grep `[\u{1F000}-\u{1FFFF}]` 确认）
4. 引用了 `pc/` 或 `src/` 吗？（检查 import 语句）
5. 组件有对应 `m3p*-mobile.html` 吗？（没有原型 = 不应该做）
6. `.css` 文件用 `mh-*`/`mp-*` 等模块前缀了吗？
7. localStorage key 用了正确的模块前缀吗？
