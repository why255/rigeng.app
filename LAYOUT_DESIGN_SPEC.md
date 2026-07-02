# likeadmin 布局设计规格文档

> 版本: 1.9.4 | 技术栈: Vue 3.5 + Element Plus 2.9 + Tailwind CSS 3.4 + SCSS + Pinia + Vue Router 4

---

## 一、整体布局架构

### 1.1 布局模式

采用经典的 **左侧边栏 + 右侧主区域** 布局（Sidebar Layout），全视口高度，基于 Flexbox 实现。

```
┌──────────────────────────────────────────────────────┐
│  ┌──────────┐  ┌──────────────────────────────────┐ │
│  │          │  │  Header (navbar-height: 50px)     │ │
│  │          │  │  ┌──────────────────────────────┐ │ │
│  │ Sidebar  │  │  │  Tab Bar (40px, 可选)        │ │ │
│  │          │  │  ├──────────────────────────────┤ │ │
│  │ (200px)  │  │  │                              │ │ │
│  │          │  │  │  Content Area                 │ │ │
│  │          │  │  │  (el-scrollbar + p-4)        │ │ │
│  │          │  │  │                              │ │ │
│  └──────────┘  └──────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

**核心文件**: `admin/src/layout/default/index.vue` (22 行)

```html
<div class="layout-default flex h-screen w-full">
    <div class="app-aside">
        <layout-sidebar />
    </div>
    <div class="flex-1 flex flex-col min-w-0">
        <div class="app-header"><layout-header /></div>
        <div class="app-main flex-1 min-h-0"><layout-main /></div>
    </div>
</div>
```

### 1.2 布局尺寸规格

| 属性 | 值 | CSS 变量 | 说明 |
|------|-----|---------|------|
| 侧边栏宽度 | 200px（默认） | `--aside-width` | 可配置范围 180–250px |
| 顶部导航高度 | 50px | `--navbar-height` | 固定高度 |
| 标签栏高度 | 40px | (硬编码) | 仅 `openMultipleTabs=true` 时显示 |
| 内容区内边距 | 16px | `p-4` | Tailwind 间距 |
| 最小窗口宽度 | 375px | `min-w-[375px]` | 防止布局崩溃 |

### 1.3 响应式断点

| 断点 | 宽度 | 行为 |
|------|------|------|
| SM | ≤ 640px | 触发移动端模式：侧边栏强制折叠 |
| MD | ≤ 768px | 侧边栏强制折叠，隐藏全屏按钮、面包屑 |
| Default | > 768px | 桌面模式：侧边栏展开，显示完整头部 |

**核心文件**: `admin/src/App.vue:21-39` — 使用 `@vueuse/core` 的 `useWindowSize()` + `useThrottleFn()` 实时检测。

---

## 二、侧边栏设计

### 2.1 组件层级

```
SidebarIndex (index.vue)          ← 响应式分发层
  ├─ [移动端] el-drawer → Side   ← 左侧抽屉模式
  └─ [桌面端] Side (side.vue)    ← 直接渲染
       ├─ SideLogo (logo.vue)    ← LOGO + 标题
       └─ SideMenu (menu.vue)    ← el-menu + 递归菜单项
            └─ MenuItem (menu-item.vue, 递归)
```

**核心文件**:
- `admin/src/layout/default/components/sidebar/index.vue` — 移动端/桌面端分发
- `admin/src/layout/default/components/sidebar/side.vue` — 侧边栏主体
- `admin/src/layout/default/components/sidebar/logo.vue` — Logo 区域
- `admin/src/layout/default/components/sidebar/menu.vue` — 菜单容器
- `admin/src/layout/default/components/sidebar/menu-item.vue` — 递归菜单项

### 2.2 侧边栏容器样式

```scss
.side {
    position: relative;
    z-index: 999;
    @apply border-r border-br-light h-full flex flex-col;
    background-color: var(--side-dark-color, var(--el-bg-color));
}
```

- 层级 `z-index: 999`，确保高于内容区
- 右侧 1px 分割线 (`border-br-light` → `--el-border-color-light`)
- 背景色：浅色主题跟随 `--el-bg-color`（白色），深色主题使用 `--side-dark-color`（默认 `#1d2124`）

### 2.3 侧边栏主题系统

| 主题模式 | CSS 类 | 背景色 | 文字色 | 激活项样式 |
|---------|--------|--------|--------|-----------|
| `light`（默认） | `.theme-light` | `--el-bg-color` | 默认 | 浅色背景 `bg-primary-light-9` + 右侧 2px 主色边框 |
| `dark` | `.theme-dark` | `#1d2124` | `--el-color-white` | 主色实色背景 `bg-primary` + 主色边框 |

**Light 主题激活样式** (`menu.vue:81-93`):
```scss
.el-menu-item.is-active {
    @apply bg-primary-light-9 border-r-2 border-primary;
}
.el-menu-item:hover, .el-sub-menu__title:hover {
    color: var(--el-color-primary);
}
```

**Dark 主题激活样式** (`menu.vue:67-80`):
```scss
.el-menu-item.is-active {
    @apply bg-primary border-primary;
}
.el-menu--collapse .el-sub-menu.is-active .el-sub-menu__title {
    @apply bg-primary #{!important};
}
```

### 2.4 Logo 区域

**文件**: `admin/src/layout/default/components/sidebar/logo.vue`

- 高度: `var(--navbar-height)` = 50px
- 点击跳转到 `/`（首页）
- 图标尺寸: 34×34px（Image 组件）
- 标题文字: `text-xl`，绝对定位在图标右侧 16px 处
- 折叠动画: Vue `<transition name="title-width">`，使用 `cubic-bezier` 缓动，持续 0.3s
- 标题溢出处理: `<overflow-tooltip>` 组件，超长自动省略并显示 tooltip
- 可配置项: `settingStore.showLogo` 控制是否显示

### 2.5 菜单系统

**菜单容器** (`menu.vue`):
- 使用 `<el-scrollbar>` 包裹，支持内容溢出滚动
- `<el-menu mode="vertical">`
- `:unique-opened` 控制是否只展开一个一级菜单（默认 `false`）
- `:collapse="isCollapsed"` 控制折叠状态
- `default-active` 来自 `route.meta?.activeMenu || route.path`
- 未折叠时宽度: `var(--aside-width)` (200px)

**递归菜单项** (`menu-item.vue`):
- 隐藏项过滤: `route.meta?.hidden === true` 的项不渲染
- 叶子节点: `<app-link>` + `<el-menu-item>`（智能路由/外链）
- 父节点: `<el-sub-menu>` + 递归 `<menu-item>`
- 图标: `<icon :size="16">`，支持 Element Plus 图标 (`el-icon-*`) 和本地 SVG (`local-icon-*`)
- 菜单项高度: `--el-menu-item-height: 46px`
- 图标宽度: `--el-menu-icon-width: 18px`
- 图标右边距: 8px

### 2.6 移动端适配

移动端 (`isMobile = true`，窗口宽度 < 640px) 时：
- 侧边栏通过 `<el-drawer>` 左侧滑出展示
- 抽屉宽度 = `sideWidth + 1px`
- 抽屉无标题栏 (`:with-header="false"`)
- 菜单项选中后自动关闭抽屉
- 桌面端直接渲染 `<Side>`，无抽屉包装

---

## 三、头部布局

### 3.1 组件层级

```
HeaderIndex (header/index.vue)
  ├─ Navbar (50px 固定高度)
  │   ├─ [左] Fold        ← 折叠/展开切换
  │   ├─ [左] Refresh     ← 页面刷新
  │   ├─ [左] Breadcrumb  ← 面包屑导航（桌面端 + showCrumb=true）
  │   ├─ [右] FullScreen  ← 全屏切换（桌面端）
  │   ├─ [右] UserDropdown ← 用户头像下拉菜单
  │   └─ [右] Setting     ← 主题设置入口
  └─ MultipleTabs (40px, 条件渲染)
```

**核心文件**: `admin/src/layout/default/components/header/index.vue` (83 行)

### 3.2 导航栏样式

```scss
.navbar {
    height: var(--navbar-height);    // 50px
    @apply flex px-2 bg-body;       // Flex 布局，水平 padding 8px

    .navbar-item {
        @apply h-full flex justify-center items-center hover:bg-page;
        // 全高度，内容居中，hover 时背景色变为 page 色
    }
}
```

- 背景色: `bg-body` → `var(--el-bg-color)` (白色)
- 导航栏整体高度: 50px
- 左侧区域 `flex-1` 自动占满剩余空间
- 右侧区域自然排列

### 3.3 导航栏功能按钮

| 组件 | 文件 | 说明 |
|------|------|------|
| **Fold** | `fold.vue` | 切换 `appStore.isCollapsed`，图标在 `local-icon-collapse`/`local-icon-expand` 间切换，带 tooltip |
| **Refresh** | `refresh.vue` | 触发 `appStore.refreshView()`，通过 `v-if` 切换强制 `<router-view>` 重渲染 |
| **Breadcrumb** | `breadcrumb.vue` | `<el-breadcrumb>`，从 `route.matched` 中提取含 `meta.title` 的路由，桌面端 + `showCrumb=true` 时显示 |
| **FullScreen** | `full-screen.vue` | `@vueuse/core` 的 `useFullscreen()`，桌面端显示，图标在 `local-icon-fullscreen`/`local-icon-fullscreen-exit` 间切换 |
| **UserDropdown** | `user-drop-down.vue` | `<el-dropdown>`，显示用户头像+名称+箭头，菜单项：个人设置→`/user/setting`、清理缓存→API+reload、退出登录→确认框 |
| **Setting** | `setting/index.vue` | 齿轮图标，点击打开主题设置抽屉 |

### 3.4 多标签页栏

**文件**: `admin/src/layout/default/components/header/multiple-tabs.vue` (123 行)

- 使用 `<el-tabs>` 渲染
- 标签来源: `tabsStore.tabLists`（Pinia）
- 关闭按钮: 仅当标签数 > 1 时显示 (`:closable="tabsLists.length > 1"`)
- 标签切换: 调用 `router.push(getRouteParams(tabItem))` 恢复完整路由参数
- 右侧下拉菜单: 关闭当前 / 关闭其他 / 关闭全部

**激活标签样式**:
```scss
.is-active {
    background-color: var(--el-color-primary-light-9);
    &::before {
        // 6px 主色圆点指示器
        content: '';
        width: 6px; height: 6px;
        background-color: var(--el-color-primary);
        margin-right: 6px;
        border-radius: 50%;
    }
    &::after {
        // 2px 顶部主色横条
        content: '';
        position: absolute; top: 0;
        height: 2px; width: 100%;
        background-color: var(--el-color-primary);
    }
}
```

**关闭按钮 hover 效果**: 变为红色背景白色图标 (`--el-color-danger`)

**默认可配置项**: `openMultipleTabs: true`

---

## 四、内容区域

### 4.1 主内容区

**文件**: `admin/src/layout/default/components/main.vue` (27 行)

```html
<main class="main-wrap h-full bg-page">
    <el-scrollbar>
        <div class="p-4">
            <router-view v-if="isRouteShow" v-slot="{ Component, route }">
                <keep-alive :include="includeList" :max="20">
                    <component :is="Component" :key="route.fullPath" />
                </keep-alive>
            </router-view>
        </div>
    </el-scrollbar>
</main>
```

| 属性 | 说明 |
|------|------|
| 背景色 | `bg-page` → `var(--el-bg-color-page)` = `#f6f6f6` |
| 滚动 | `<el-scrollbar>` 提供统一滚动条样式 |
| 内边距 | `p-4` = 16px |
| 缓存 | `<keep-alive :max="20">`，`includeList` 由 tabsStore 管理 |
| 刷新 | `v-if="isRouteShow"` 切换可强制重建 `<router-view>` |
| key | `:key="route.fullPath"` 确保路由变化时组件重新创建 |

### 4.2 Keep-Alive 策略

- 开启多标签时 (`openMultipleTabs=true`): `includeList` = `tabsStore.getCacheTabList`，已打开的页面标签被缓存
- 关闭多标签时: `includeList = []`，无缓存
- 最大缓存数: 20 个组件实例

---

## 五、主题系统

### 5.1 设计令牌 (Design Tokens)

**CSS 变量定义**: `admin/src/styles/var.css` (48 行)
**Tailwind 映射**: `admin/tailwind.config.js` (159 行)

#### 5.1.1 颜色系统

| Token | CSS 变量 | 默认值（浅色） | 用途 |
|-------|---------|---------------|------|
| `primary` | `--el-color-primary` | `#4A5DFF`（可配置） | 主题色 |
| `body` | `--el-bg-color` | `#FFFFFF` | 组件/导航背景 |
| `page` | `--el-bg-color-page` | `#F6F6F6` | 页面/内容区背景 |
| `tx-primary` | `--el-text-color-primary` | `#333333` | 主要文字 |
| `tx-regular` | `--el-text-color-regular` | `#666666` | 常规文字 |
| `tx-secondary` | `--el-text-color-secondary` | `#999999` | 次要文字 |
| `tx-placeholder` | `--el-text-color-placeholder` | `#A8ABB2` | 占位文字 |
| `tx-disabled` | `--el-text-color-disabled` | `#C0C4CC` | 禁用文字 |
| `br` | `--el-border-color` | `#DCDEE6` | 边框色 |
| `br-light` | `--el-border-color-light` | `#E4E7ED` | 浅边框 |

#### 5.1.2 Element Plus 颜色梯度

通过 Tailwind 拓展色阶提供 9 级色彩深浅变化：
- `primary-light-3` 到 `primary-light-9`（浅色变体）
- `primary-dark-2`（深色变体）
- 同样适用于 `success`、`warning`、`danger`、`error`、`info`

#### 5.1.3 排版

| 层级 | CSS 变量 | 值 |
|------|---------|-----|
| 特大 | `--el-font-size-extra-large` | 18px |
| 大 | `--el-font-size-large` | 16px |
| 中 | `--el-font-size-medium` | 15px |
| 基础 | `--el-font-size-base` | 14px |
| 小 | `--el-font-size-small` | 13px |
| 特小 | `--el-font-size-extra-small` | 12px |

字体栈: `PingFang SC, Arial, Hiragino Sans GB, Microsoft YaHei, sans-serif`

#### 5.1.4 阴影层级

| Token | 用途 |
|-------|------|
| `--el-box-shadow` (default) | 通用阴影，大卡片 |
| `--el-box-shadow-light` | 轻阴影，小面板 |
| `--el-box-shadow-lighter` | 极轻阴影 |
| `--el-box-shadow-dark` | 深阴影，大型浮层 |

### 5.2 深色模式

**文件**: `admin/src/styles/dark.css` (49 行)

触发方式: `:root.dark` 类名 → 覆盖全部 CSS 变量

| 属性 | 浅色值 | 深色值 |
|------|--------|--------|
| 页面背景 | `#F6F6F6` | `#0A0A0A` |
| 组件背景 | `#FFFFFF` | `#1D2124` |
| 浮层背景 | `#FFFFFF` | `#1D1E1F` |
| 主要文字 | `#333333` | `#E5EAF3` |
| 常规文字 | `#666666` | `#CFD3DC` |
| 遮罩 | `rgba(255,255,255,0.9)` | `rgba(0,0,0,0.8)` |

同时覆盖 wangEditor 富文本编辑器的深色变量。

### 5.3 主题配置抽屉

**文件**: `admin/src/layout/default/components/setting/drawer.vue` (231 行)

右侧 `<el-drawer>` 宽度 250px，可配置项：

| 配置项 | 组件 | 默认值 | 说明 |
|--------|------|--------|------|
| 风格设置 | 图片选择 | `light` | light / dark 侧边栏主题，带预览图 |
| 主题颜色 | `<el-color-picker>` | `#4A5DFF` | 6 种预设色 + 自定义 |
| 黑暗模式 | `<el-switch>` | `false` | 全局暗色模式切换 |
| 多页签栏 | `<el-switch>` | `true` | 开启/关闭标签页 |
| 唯一展开菜单 | `<el-switch>` | `false` | 只展开一个一级菜单 |
| 菜单栏宽度 | `<el-input-number>` | `200` | 180–250px |
| 显示 LOGO | `<el-switch>` | `true` | 侧边栏 LOGO 显隐 |
| 显示面包屑 | `<el-switch>` | `true` | 面包屑显隐 |
| 重置主题 | `<el-button>` | — | 恢复全部默认值 |

所有设置通过 `settingStore.setSetting()` 持久化到 `localStorage`。

---

## 六、Element Plus 组件风格覆盖

**文件**: `admin/src/styles/element.scss` (192 行)

### 6.1 对话框 (Dialog)

- 弹窗居中: `display: flex; align-items: center; justify-content: center`
- 最大宽度: `calc(100vw - 30px)`
- 圆角: `5px`
- 内容字体: `--el-font-size-base` (14px)
- 头部字体: `--el-font-size-large` (16px)
- 内容区内边距: `15px 20px`

### 6.2 抽屉 (Drawer)

- 内边距: `16px`
- 头部: `13px 16px`，底部 1px 分割线
- 标题颜色: `--el-text-color-primary`

### 6.3 表格 (Table)

- 表头文字: `--el-text-color-primary`
- 表头背景: `--table-header-bg-color` (`#F8F8F8` 浅色 / `--el-bg-color` 深色)
- 字体大小: `--el-font-size-base`
- 表头字重: `400`（非加粗）

### 6.4 输入框 (Input / Select / Textarea)

- Focus 状态: `box-shadow: 0 0 0 2px` + 主题色阴影（`shadow-primary-light-8`）
- 过渡: `box-shadow ease 0.1s`
- 错误状态: 阴影颜色切换为 `shadow-danger-light-8`

### 6.5 单选框 / 复选框

- Active 状态: 同样 `box-shadow: 0 0 0 2px` 聚焦环效果
- 字体大小: `--el-font-size-base`

### 6.6 按钮 (Button)

- 显式覆盖 Tailwind 默认背景色：`background-color: var(--el-button-bg-color, var(--el-color-white))`
- 保留 Element Plus 的 hover/focus 样式体系
- `:focus` 状态不产生额外轮廓

### 6.7 菜单弹出层 (Menu Popup)

- Light 主题: `.is-active` 项 `bg-primary-light-9` + 右侧主色边框
- Dark 主题: `.is-active` 项 `bg-primary`
- Hover 文字变为主题色

---

## 七、状态管理架构

### 7.1 布局相关 Store

| Store | 文件 | 管理内容 |
|-------|------|---------|
| `useAppStore` | `stores/modules/app.ts` | `isCollapsed`（侧边栏折叠）、`isMobile`（移动端标志）、`isRouteShow`（页面刷新）、`config`（站点配置） |
| `useSettingStore` | `stores/modules/setting.ts` | 侧边栏主题/宽度、主题色、多标签/面包屑/Logo 显隐、唯一展开菜单 |
| `useTabsStore` | `stores/modules/multipleTabs.ts` | 标签页列表、缓存列表、标签增删操作 |
| `useUserStore` | `stores/modules/user.ts` | 用户信息、Token、权限、路由菜单树 |

### 7.2 关键状态流

```
窗口大小变化
  → App.vue watch(width)
    → appStore.setMobile() / appStore.toggleCollapsed()
      → 侧边栏折叠
      → 头部组件响应式显示/隐藏

主题设置变更
  → settingStore.setSetting()
    → 写入 localStorage
    → 侧边栏/头部/全局样式实时响应

菜单数据
  → userStore.getUserInfo() 获取
    → userStore.routes (过滤后)
      → SideMenu 渲染
```

---

## 八、路由与权限

### 8.1 菜单类型

| 类型 | 枚举值 | 渲染方式 |
|------|--------|---------|
| 目录 (Catalogue) | `'M'` | 一级使用 Layout 包装，子级 `<router-view>` |
| 菜单 (Menu) | `'C'` | 动态加载对应 `.vue` 视图组件 |
| 按钮 (Button) | `'A'` | 不渲染为路由，仅用于权限控制 |

### 8.2 路由守卫流程

```
beforeEach:
  1. NProgress.start() + document.title
  2. 白名单 (/login, /403) → 放行
  3. 无 Token → 重定向 /login?redirect=...
  4. 无用户信息 → userStore.getUserInfo() 获取菜单路由
  5. 动态添加 INDEX_ROUTE + 菜单路由
  6. 未匹配 → /403

afterEach:
  NProgress.done()
```

**文件**: `admin/src/permission.ts` (112 行)

---

## 九、文件索引

### 布局核心

| 文件路径 | 行数 | 职责 |
|---------|------|------|
| `admin/src/layout/default/index.vue` | 22 | 默认布局外壳 |
| `admin/src/layout/default/components/main.vue` | 27 | 主内容区 |
| `admin/src/layout/components/footer.vue` | 22 | 页脚组件（共享） |

### 侧边栏

| 文件路径 | 行数 | 职责 |
|---------|------|------|
| `admin/src/layout/default/components/sidebar/index.vue` | 45 | 侧边栏分发（移动端/桌面端） |
| `admin/src/layout/default/components/sidebar/side.vue` | 67 | 侧边栏主体 |
| `admin/src/layout/default/components/sidebar/logo.vue` | 69 | Logo 区域 |
| `admin/src/layout/default/components/sidebar/menu.vue` | 102 | 菜单容器 |
| `admin/src/layout/default/components/sidebar/menu-item.vue` | 89 | 递归菜单项 |

### 头部

| 文件路径 | 行数 | 职责 |
|---------|------|------|
| `admin/src/layout/default/components/header/index.vue` | 83 | 头部容器 |
| `admin/src/layout/default/components/header/fold.vue` | 16 | 折叠按钮 |
| `admin/src/layout/default/components/header/refresh.vue` | 15 | 刷新按钮 |
| `admin/src/layout/default/components/header/breadcrumb.vue` | 22 | 面包屑 |
| `admin/src/layout/default/components/header/user-drop-down.vue` | 43 | 用户下拉菜单 |
| `admin/src/layout/default/components/header/full-screen.vue` | 11 | 全屏切换 |
| `admin/src/layout/default/components/header/multiple-tabs.vue` | 123 | 多标签页栏 |

### 主题设置

| 文件路径 | 行数 | 职责 |
|---------|------|------|
| `admin/src/layout/default/components/setting/index.vue` | 21 | 设置入口按钮 |
| `admin/src/layout/default/components/setting/drawer.vue` | 231 | 设置抽屉面板 |

### 样式

| 文件路径 | 行数 | 职责 |
|---------|------|------|
| `admin/src/styles/var.css` | 48 | CSS 设计令牌定义 |
| `admin/src/styles/dark.css` | 49 | 深色模式变量覆盖 |
| `admin/src/styles/element.scss` | 192 | Element Plus 组件覆盖 |
| `admin/src/styles/public.scss` | 18 | 全局样式、NProgress |
| `admin/src/styles/tailwind.css` | 3 | Tailwind 指令入口 |
| `admin/tailwind.config.js` | 158 | Tailwind 设计令牌映射 |

### 配置 & 枚举

| 文件路径 | 行数 | 职责 |
|---------|------|------|
| `admin/src/config/setting.ts` | 16 | 默认布局设置 |
| `admin/src/config/index.ts` | 10 | 应用配置 |
| `admin/src/enums/appEnums.ts` | 41 | 主题/菜单/屏幕/客户端枚举 |

### 状态管理

| 文件路径 | 行数 | 职责 |
|---------|------|------|
| `admin/src/stores/modules/app.ts` | 53 | 布局状态 |
| `admin/src/stores/modules/setting.ts` | 57 | 主题设置状态 |
| `admin/src/stores/modules/multipleTabs.ts` | 169 | 标签页状态 |
| `admin/src/stores/modules/user.ts` | 84 | 用户/权限/路由状态 |

### 路由

| 文件路径 | 行数 | 职责 |
|---------|------|------|
| `admin/src/router/index.ts` | 113 | 动态路由创建 |
| `admin/src/router/routes.ts` | 91 | 静态路由定义 |
| `admin/src/permission.ts` | 112 | 路由守卫 |

---

## 十、总结

likeadmin 采用经典的 **左侧导航 + 顶部工具栏 + 内容区** 三段式管理后台布局。核心技术特征：

1. **Flex 全视口布局** — `h-screen + flex` 保证始终占满窗口高度
2. **Element Plus 深度定制** — 全局覆盖对话框、表格、菜单等 10+ 组件样式，统一视觉风格
3. **CSS 变量设计令牌** — 42 个 CSS 变量驱动颜色、阴影、间距，实现无缝浅色/深色切换
4. **Tailwind + SCSS 混合** — Tailwind 处理布局和间距，SCSS 处理组件深度覆盖和主题变体
5. **Pinia 响应式状态** — 布局折叠、主题设置、标签管理全部通过 Store 驱动
6. **移动端适配** — 640px 断点自动切换抽屉式菜单，768px 断点隐藏非核心功能
7. **开箱即用** — 主题配置抽屉支持 8 项可视化设置，变更实时生效并持久化
