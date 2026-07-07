# 日耕驾驶舱 · 项目初始化脚本（PowerShell）

> **用途**：在本地工作区初始化 git 仓库，并关联 GitHub 远程仓库。
> **执行人**：王昊宇（或安老师）—— AI 不直接 push main。
> **执行时机**：GitHub 仓库创建完成后。

---

## 前置准备

1. ✅ GitHub 仓库已创建：`https://github.com/why255/rigeng.app`
2. ✅ 本地 Git 已安装（PowerShell 执行 `git --version` 验证）
3. ✅ GitHub 账号认证已配置（SSH Key 或 Personal Access Token）

---

## 一、本地初始化 + 首次提交

打开 PowerShell，**进入本工作区目录**后执行：

```powershell
# 进入项目根目录
Set-Location "I:\01《产品开发》\《日耕驾驶舱》"

# 初始化 git 仓库（如果还没有）
git init

# 配置用户信息（仅本仓库生效）
git config user.name "why255"
git config user.email "<your-github-email>"

# 添加远程仓库（rigeng.app 是最终仓库名，安老师 2026-07-07 22:11 拍板）
git remote add origin https://github.com/why255/rigeng.app.git

# 确认 remote 配置正确
git remote -v

# 添加 .gitignore 排除的文件之外的全部内容
git add .

# 查看暂存区状态
git status

# 首次提交
git commit -m "feat: 项目初始化 - 三份决策文档 + 目录结构 + 基础文件

- 决策文档：功能清单 V2 终稿 / PRD 撰写计划 V1 / AI 团队组建方案 V1
- 目录结构：02_PRD / 03_原型 / 04_设计 / 05_开发 / 06_测试 / 99_变更记录
- 基础文件：README.md / CHANGELOG.md / .gitignore
- 决策者：安老师（唯一决策人）
- 工具栈：MiniMax Code（统一）

Co-authored-by: Mavis <noreply@example.com>"

# 推送 main 分支到远程
git push -u origin main
```

---

## 二、保护 main 分支（GitHub 端操作）

在 GitHub 仓库网页端：

1. 进入 `https://github.com/why255/rigeng.app/settings/branches`
2. 点 "Add rule" 添加分支保护规则
3. Branch name pattern：`main`
4. 勾选：
   - ✅ Require a pull request before merging
   - ✅ Require approvals（至少 1 人，王昊宇 review）
   - ✅ Require linear history
   - ✅ Do not allow force pushes
   - ✅ Do not allow deletions
5. 保存

---

## 三、后续日常同步（开发过程中）

```powershell
# 拉取最新
git pull

# 创建功能分支（命名规范：feature/{phase}-{module}-{feature}-{date}）
git checkout -b feature/phase-0-system-arch-20260708

# 写完代码 / 文档
git add .
git commit -m "feat(phase-0): 系统架构设计 V1"
git push origin feature/phase-0-system-arch-20260708

# 在 GitHub 网页端创建 PR
# 等王昊宇 review 通过
# 合并到 main
```

---

## 四、Phase 0 期间同步基座 PRD

```powershell
# Phase 0 prd-writer 产出的基座 PRD
git checkout -b feature/phase-0-base-prds-20260708
git add 02_PRD/
git commit -m "feat(phase-0): prd-writer 产出 10 份基座 PRD

- 系统架构设计 V1
- 技术选型清单 V1
- 数据库设计 V1（含 ER 图）
- 本地文件存储规范 V1
- 安全与隐私设计 V1
- OTA 升级方案 V1
- 全局横切 PRD V1
- 术语规范 V1
- 错误码与日志规范 V1
- UI 通用规范 V1"
git push origin feature/phase-0-base-prds-20260708
# 创建 PR → 等 review → 合并
```

---

## 五、回滚 / 应急

```powershell
# 查看提交历史
git log --oneline -20

# 回退到上一个版本（保留变更在工作区）
git reset --soft HEAD~1

# 撤销本地未提交的修改
git checkout -- <file>

# 紧急回滚 main（需要 force push，慎用）
# git reset --hard <commit-hash>
# git push origin main --force
```

---

## 注意事项

- ⚠️ **AI reins 不直接 push main** —— 所有变更走 PR + 王昊宇 review
- ⚠️ **本工作区 .harness/ 目录已被 .gitignore 屏蔽**（reins 内部配置不进 GitHub）
- ⚠️ **本工作区 node_modules/、本地数据库等已被屏蔽**（详见 .gitignore）
- ⚠️ **提交前务必检查** `git status` + `git diff --staged`

---

> **执行人**：王昊宇（或安老师）
> **执行时机**：GitHub 仓库 `https://github.com/why255/rigeng.app` 创建完成后
