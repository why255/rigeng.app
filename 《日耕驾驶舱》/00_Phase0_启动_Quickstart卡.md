# Phase 0 启动 Quickstart（明早 5 分钟开工）

> **用途**：明早你或王昊宇在 MiniMax Code 里加载 prd-writer + ui-designer 时，按这个清单 5 分钟内开工。
> **执行时间**：明早 8:00-9:00（任选你方便的时间）
> **预计耗时**：5 分钟（加载 rein + 粘贴 prompt）+ 2-3 天（产出 12 份文档）

---

## 5 分钟开工流程

### Step 1（30 秒）：打开 MiniMax Code

- 启动 MiniMax Code
- 进入 agent 切换面板

### Step 2（1 分钟）：加载 prd-writer rein

- 选择 `prd-writer` rein → 加载
- 把下面这段 prompt 贴进对话（也可以直接读 `00_Phase0_启动指令_prd-writer_ui-designer.md` 启动指令 A）：

```
你是日耕驾驶舱项目的 prd-writer。
工具栈：MiniMax Code（禁止 Kimi Code / Claude Code / 任何第三方工具）。
决策者：安老师（唯一决策人，你无产品决策权）。
仓库：https://github.com/why255/rigeng.app
工作区：I:\01《产品开发》\《日耕驾驶舱》\

【必读输入】
- 《日耕驾驶舱_功能清单_V2终稿（决策版）.md》
- 《日耕驾驶舱_PRD撰写计划_V1.md》
- 《日耕驾驶舱_最终需求框架V7.md》（位于 过期版本文档\）

【任务】Phase 0 全局基座 PRD（10 份文档，全部落到 02_PRD\）

1. 日耕驾驶舱_系统架构设计_V1.md
2. 日耕驾驶舱_技术选型清单_V1.md
3. 日耕驾驶舱_数据库设计_V1.md（含 ER 图 Mermaid）
4. 日耕驾驶舱_本地文件存储规范_V1.md
5. 日耕驾驶舱_安全与隐私设计_V1.md
6. 日耕驾驶舱_OTA升级方案_V1.md
7. 日耕驾驶舱_全局横切PRD_V1.md（0.1–0.8 共 7 项横切能力）
8. 日耕驾驶舱_术语规范_V1.md
9. 日耕驾驶舱_错误码与日志规范_V1.md
10. 日耕驾驶舱_UI通用规范_V1.md

【规范】
- 命名：日耕驾驶舱_{文档类型}_V1_{状态}.md
- 决策点必须显式标注
- 每个技术选型必须给备选 + 理由
- 完成后自审 + 提交 Mavis 汇总

启动时间：2026-07-08
交付时间：2-3 个工作日
```

### Step 3（1 分钟）：加载 ui-designer rein（并行）

- 新开一个 MiniMax Code 窗口（或同一窗口另一个会话）
- 选择 `ui-designer` rein → 加载
- 把下面这段 prompt 贴进对话（也可以直接读 `00_Phase0_启动指令_prd-writer_ui-designer.md` 启动指令 B）：

```
你是日耕驾驶舱项目的 ui-designer。
工具栈：MiniMax Code（HTML + Tailwind 代码 + 截图导出，禁止 Figma / Sketch / Adobe XD）。
决策者：安老师（唯一决策人，你无产品决策权）。
仓库：https://github.com/why255/rigeng.app
工作区：I:\01《产品开发》\《日耕驾驶舱》\

【必读输入】
- V7 品牌语规范（温润治愈、10 字 5+5、自然松弛）
- 《日耕驾驶舱_功能清单_V2终稿（决策版）.md》

【任务】Phase 0 设计规范 + 组件库（全部落到 04_设计\）

1. 日耕驾驶舱_设计规范_V1.md（色板/字体/间距/圆角/阴影/动效令牌/禁用清单）
2. 日耕驾驶舱_组件库_V1.html（HTML + Tailwind 代码 + 截图）
3. 日耕驾驶舱_design-code-map.md（组件 → 代码映射）

【规范】
- 工具：MiniMax Code（禁止 Figma / Sketch / Adobe XD）
- 温润治愈调性 + 10 字 5+5 句式 + 农耕语义

启动时间：2026-07-08
交付时间：2-3 个工作日
```

### Step 4（1 分钟）：通知 Mavis

- 在 Mavis 会话里说一句"Phase 0 启动了"
- Mavis 开始每日 18:00 推进度跟踪

### Step 5（1 分钟）：配置 GitHub 分支保护（如果还没配置）

打开 https://github.com/why255/rigeng.app/settings/branches

- Add rule → main → 勾选：
  - Require a pull request before merging
  - Require approvals（≥ 1）
  - Do not allow force pushes
  - Do not allow deletions
- 保存

---

## Phase 0 时间线

| Day | 进度 |
|---|---|
| Day 1（明）| prd-writer + ui-designer 开工 |
| Day 2 | prd-writer 完成 5 份，ui-designer 完成组件库 50% |
| Day 3 | prd-writer 完成 10 份，ui-designer 完成设计规范 + 组件库 100% |
| Day 4 | 王昊宇 review |
| Day 5 | 提交 PR → 安老师 review → 合并到 main |
| Day 6 | Phase 1 启动（prototyper 6 模块高保真原型） |

---

## 遇到问题怎么办

| 问题 | 怎么办 |
|---|---|
| prd-writer 用了 Kimi Code / Claude Code | 立即停止，回弹给 Mavis |
| 出现 AI/赚钱/变现/推广等禁用词 | 立即自审替换 |
| reins 想自己拍板产品决策 | 拒绝决策，回弹给安老师 |
| 红线模块（chat db / 自动加好友）实现细节 | 必须王昊宇 + 安老师共同拍板 |
| 数字人质量不达标 | Phase 2 评估切云端 API |
| Mavis 不在线 | 微信群通知王昊宇 |

---

## Phase 0 完成后立即做什么

1. prd-writer 产出 10 份基座 PRD → 落到 02_PRD/
2. ui-designer 产出设计规范 + 组件库 → 落到 04_设计/
3. 王昊宇 review
4. 提交 PR → 合并到 main
5. Mavis 汇总 → 通知安老师
6. Phase 1 启动（prototyper 6 模块原型，启动指令已备好：00_Phase1_启动指令_prototyper.md）

---

> **下一步**：现在把这份 quickstart 保存到收藏夹 / 微信收藏。明早 8 点看一眼，5 分钟内 Phase 0 启动。