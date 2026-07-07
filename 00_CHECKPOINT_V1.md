# 日耕驾驶舱 · 项目 CHECKPOINT V1（2026-07-07 23:17）

> **用途**：项目里程碑快照 + 状态归档。今晚所有决策、文档、仓库、操作的完整记录。
> **保存位置**：项目根目录 + 同步到 GitHub main
> **下次更新**：Phase 0 交付时（CHECKPOINT V2）

---

## 一、项目基本信息

| 项目 | 日耕驾驶舱 |
|---|---|
| Slogan | 日耕朝夕，耕愈工作，耕暖生活 |
| 定位 | HR 个人品牌运营 · 单机 Win exe 安装包 |
| 形态 | SaaS → **Win exe**（纯本地起步，可选联网） |
| 模块数 | 8 大 → **6 大**（砍品牌定位 + 数据结算） |
| 仓库 | https://github.com/why255/rigeng.app |
| owner | why255 |
| 工作区 | I:\01《产品开发》\《日耕驾驶舱》 |
| 决策者 | **安老师**（唯一决策人） |
| Tech Lead | 王昊宇（无产品决策权） |
| 协调者 | Mavis（无产品决策权） |

---

## 二、三条铁律（不可篡改）

### 🔧 工具栈纪律
- 所有 PRD / 原型 / UI 设计 / 程序开发**统一 MiniMax Code**
- 禁用：Claude Code / Cursor / Kimi Code / Figma / 墨刀 / Sketch / Adobe XD / 任何 IDE 插件 / 任何第三方协作工具

### 👤 决策者纪律
- 产品决策者**只有安老师一人**
- 王昊宇（Tech Lead）无产品决策权
- Mavis / 4 个 reins 全部无产品决策权

### 🔴 业务链纪律
- 6 模块按业务价值链串行开发：**采撷 → 智造 → 分发 → 获客 → 私域 → 转化**
- 不得跳跃、不得并行开发

---

## 三、决策清单（17 条累计）

### 业务硬约束
1. ✅ 砍模块一：品牌定位舱（完全砍掉，连替代问卷都不要）
2. ✅ 砍模块八：数据结算舱（仅保留跳转入口 + CSV 导出）
3. ✅ 部署形态：SaaS → Win exe 安装包
4. ✅ 6 模块同步规划，串行开发验证
5. ✅ 业务链顺序不可篡改

### 工具栈纪律
6. ✅ 所有 PRD / 原型 / UI 设计 / 程序开发统一 MiniMax Code
7. ✅ 禁用第三方工具清单

### 决策者纪律
8. ✅ 产品决策者只有安老师一人
9. ✅ 王昊宇是 Tech Lead，无产品决策权
10. ✅ AI reins 全部无产品决策权

### 项目启动决策（21:45）
11. ✅ 决策文档归档位置：本工作区
12. ✅ 代码托管：GitHub
13. ✅ PRD 计划交付日期：本计划 V1 已交付

### GitHub 仓库（22:11）
14. ✅ owner: why255
15. ✅ 仓库名：rigeng.app
16. ✅ 仓库地址：https://github.com/why255/rigeng.app
17. ✅ 仓库可见性：private（建议）

### 红线模块（全开）
- ✅ 自动评论 / 关注 / 私信 / 微信群加好友 / 手机号加好友 / 朋友圈浏览点赞 / chat db 读取——全部全自动
- ✅ 数字人本期必须做（逐步推进）
- ✅ 商业模式：双轨制（基础功能买断 + AI 算力订阅）

---

## 四、文档清单

### 已交付（V1）
- ✅ 日耕驾驶舱_功能清单_V2终稿（决策版）.md
- ✅ 日耕驾驶舱_PRD撰写计划_V1.md
- ✅ 日耕驾驶舱_AI团队组建方案_V1.md
- ✅ 日耕驾驶舱_需求洞察_V1（砍模块+转exe版）.md
- ✅ 日耕驾驶舱_模块功能讨论清单_V1.md（已归档到过期版本文档）
- ✅ 日耕驾驶舱_最终需求框架V7.md（已归档到过期版本文档）

### 项目基础设施
- ✅ README.md
- ✅ CHANGELOG.md
- ✅ .gitignore
- ✅ 00_项目初始化_GitHub同步脚本.md
- ✅ 00_Phase0_启动指令_prd-writer_ui-designer.md
- ✅ 00_Phase0_启动_Quickstart卡.md
- ✅ 00_Phase1_启动指令_prototyper.md
- ✅ 00_Phase2_启动指令_backend-coder.md

### 4 个 reins 的 agent 定义（已同步更新工具栈）
- ✅ .harness/reins/prd-writer/agent.md（MiniMax Code）
- ✅ .harness/reins/prototyper/agent.md（MiniMax Code）
- ✅ .harness/reins/ui-designer/agent.md（MiniMax Code）
- ✅ .harness/reins/backend-coder/agent.md（MiniMax Code）

---

## 五、GitHub 状态

| 指标 | 状态 |
|---|---|
| 仓库创建 | ✅ 2026-07-07 22:08 |
| 本地首次 commit | ✅ 3093f2f（17 个文件，5241 行） |
| push 到 main | ✅ 2026-07-07 22:54 |
| main 分支保护 | ✅ 2026-07-07 23:17（Require PR + Required approvals=1 + Block force pushes + Restrict deletions） |

### Commit 记录
```
3093f2f feat: 项目初始化 - 决策文档 + 目录结构 + 启动指令
```

### 文件统计（本次 commit）
- 17 个文件
- 5241 行新增
- 0 行删除

---

## 六、目录结构

```
I:\01《产品开发》\《日耕驾驶舱》\
├── 00_项目初始化_GitHub同步脚本.md      ← 本次新增
├── 00_Phase0_启动指令_prd-writer_ui-designer.md  ← 本次新增
├── 00_Phase0_启动_Quickstart卡.md     ← 本次新增
├── 00_Phase1_启动指令_prototyper.md   ← 本次新增
├── 00_Phase2_启动指令_backend-coder.md  ← 本次新增
├── 00_Phase2_启动指令_backend-coder.md  ← 待生成
├── 00_Phase3_启动指令_backend-coder.md  ← 待生成
├── 00_Phase4_启动指令_backend-coder.md  ← 待生成
├── 00_Phase5_启动指令_backend-coder.md  ← 待生成
├── 00_Phase6_启动指令_backend-coder.md  ← 待生成
├── 00_Phase7_启动指令_backend-coder.md  ← 待生成
├── 00_Phase8_启动指令_集成测试.md      ← 待生成
├── 00_CHECKPOINT_V1.md                 ← 本文件
├── README.md
├── .gitignore
├── 01_需求决策\                        ← 用户上传的原始文档目录
├── 02_PRD\                              ← Phase 0 产出
├── 03_原型\                              ← Phase 1 产出
├── 04_设计\                              ← Phase 0 产出
├── 05_开发\
│   ├── phase_0_基座\                     ← Phase 0 代码
│   ├── phase_2_内容采撷舱\               ← Phase 2 代码
│   ├── phase_3_内容智造舱\               ← Phase 3 代码
│   ├── phase_4_全网分发舱\               ← Phase 4 代码
│   ├── phase_5_精准获客舱\               ← Phase 5 代码
│   ├── phase_6_私域耕耘舱\               ← Phase 6 代码
│   └── phase_7_成交转化舱\               ← Phase 7 代码
├── 06_测试\
├── 99_变更记录\
│   └── CHANGELOG.md
└── 过期版本文档\                         ← V1~V7 历史档案
```

---

## 七、Phase 状态

| Phase | 内容 | 状态 | 预计启动 |
|---|---|---|---|
| **Phase 0** | 全局基座（架构 + 横切 + 数据库 + 安全 + OTA） | ⏳ 待启动 | 2026-07-08 |
| **Phase 1** | 6 模块 PRD + prototyper 6 模块高保真原型 | ⏳ 待启动 | Phase 0 完成后 |
| **Phase 2** | 内容采撷舱开发（业务链起点） | ⏳ 待启动 | Phase 1 完成后 |
| **Phase 3** | 内容智造舱开发（创作内容） | ⏳ 待启动 | Phase 2 完成后 |
| **Phase 4** | 全网分发舱开发（发布内容） | ⏳ 待启动 | Phase 3 完成后 |
| **Phase 5** | 精准获客舱开发（获客） | ⏳ 待启动 | Phase 4 完成后 |
| **Phase 6** | 私域耕耘舱开发（激活客户） | ⏳ 待启动 | Phase 5 完成后 |
| **Phase 7** | 成交转化舱开发（成交客户） | ⏳ 待启动 | Phase 6 完成后 |
| **Phase 8** | 集成测试 + OTA 灰度发布 | ⏳ 待启动 | Phase 7 完成后 |

---

## 八、待办清单

### 今晚剩余
- [ ] 把新生成的 4 份启动指令 + quickstart + checkpoint 提交到 git
- [ ] push 到 main 分支

### 明早
- [ ] 在 MiniMax Code 加载 prd-writer rein → 启动 Phase 0 prd 任务
- [ ] 在 MiniMax Code 加载 ui-designer rein → 启动 Phase 0 设计任务
- [ ] 通知 Mavis 开始每日 18:00 进度跟踪

### 本周
- [ ] Phase 0 产出 10 份基座 PRD + 设计规范 + 组件库
- [ ] 王昊宇 review
- [ ] 提交 PR → 合并到 main

---

## 九、关键时间戳

| 时间 | 事件 |
|---|---|
| 2026-07-07 19:09 | 用户发来两份原始文档（V7 框架 + V1 模块功能清单） |
| 2026-07-07 19:54 | 10 个关键决策 + 红线模块全部拍板 |
| 2026-07-07 20:27 | 业务链顺序锁定 |
| 2026-07-07 20:48 | 工具栈纪律锁定（统一 MiniMax Code） |
| 2026-07-07 20:50 | 决策者纪律锁定（只有安老师一人） |
| 2026-07-07 21:45 | 启动决策就绪（本地归档 / GitHub / PRD 计划 OK） |
| 2026-07-07 22:08 | GitHub 仓库创建 |
| 2026-07-07 22:11 | 仓库名锁定（rigeng.app） |
| 2026-07-07 22:38 | C 方案确认（push 你来） |
| 2026-07-07 22:54 | GitHub push 完成 |
| 2026-07-07 23:17 | main 分支保护配置完成 |

---

## 十、关键人物与角色

| 角色 | 姓名 | 权限 |
|---|---|---|
| 产品决策者 | **安老师** | ✅ 唯一决策人 |
| Tech Lead | 王昊宇 | 技术决策 / 无产品决策权 |
| 协调者 | Mavis（我） | 协调 / 进度跟踪 / 风险预警 / 无产品决策权 |
| PRD 撰写 | prd-writer rein | 执行 / 无产品决策权 |
| 原型设计 | prototyper rein | 执行 / 无产品决策权 |
| UI 设计 | ui-designer rein | 执行 / 无产品决策权 |
| 后端编码 | backend-coder rein | 执行 / 无产品决策权 |

---

## 十一、备注

本 CHECKPOINT 文档作为 V1 完整状态快照。每次重大变更（Phase 交付、决策调整、仓库迁移）时生成新版本：
- CHECKPOINT_V1：2026-07-07（项目初始化 + GitHub 同步）
- CHECKPOINT_V2：Phase 0 交付后
- CHECKPOINT_V3：Phase 1 交付后
- CHECKPOINT_V4：Phase 2 交付后（首个功能模块上线）
- ...
- CHECKPOINT_V8：Phase 8 交付后（项目上线）