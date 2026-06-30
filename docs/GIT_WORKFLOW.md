# Git Workflow：新人闯关项目版本管理

## 1. 为什么要补 Git 工作流

PDE 项目需要持续迭代：PRD、技术方案、网页 MVP、AI Game Master、飞书同步、部署都会不断变化。如果没有 Git 管理，项目很容易出现：

- 改坏后无法回退。
- 文档和代码状态不一致。
- 多个方向混在一起，难以判断哪个方案有效。
- 没有清晰里程碑，无法向 leader 展示推进过程。

Git 的核心不是命令，而是理解文件如何在几个区域之间流动。

## 2. 四区心智模型

参考 Git Interactive Tutorial 的教学方式，可以把 Git 理解为四个区域：

| 区域 | 含义 | 在本项目里的例子 |
|---|---|---|
| Working Directory | 工作区，正在编辑的文件 | 修改 `web/app.js`、`docs/PRD.md` |
| Staging Area / Index | 暂存区，准备进入下一次提交的改动 | 只暂存本次相关文件 |
| Local Repository | 本地仓库，已经形成提交历史 | 一个个可回退的里程碑 |
| Remote Repository | 远程仓库，用于备份和协作 | 后续 GitHub/GitLab 仓库 |

PDE 项目里，最重要的是不要把所有改动一次性塞进提交，而是让每个 commit 对应一个明确产品阶段。

## 3. 本项目推荐提交粒度

### 好的提交

```text
feat: add static onboarding quest MVP
docs: add PDE playbook
feat: support multi-sample review level
fix: preserve form data when switching levels
docs: define Git workflow
```

### 不好的提交

```text
update
改了一堆
final
各种调整
```

## 4. 推荐分支策略

当前项目还处于早期，可以保持简单：

```text
main
  ├─ feature/web-mvp
  ├─ feature/level-2-samples
  ├─ feature/ai-game-master
  ├─ feature/leader-review
  └─ feature/feishu-sync
```

规则：

- `main` 保持可展示状态。
- 每个大功能开独立分支。
- 小修可以直接在当前功能分支做。
- 不在一个分支里同时做多个大方向。

## 5. 本项目常用操作语义

| 操作 | 用途 | 使用场景 |
|---|---|---|
| `git status` | 看当前改动状态 | 每次动手前后都看 |
| `git diff` | 看工作区具体改了什么 | 提交前检查 |
| `git add` | 把相关改动放入暂存区 | 按功能选择文件 |
| `git commit` | 保存一个里程碑 | 一个完整小目标完成后 |
| `git branch` | 创建/查看分支 | 开新方向前 |
| `git switch` | 切换分支 | 在不同方向间切换 |
| `git restore` | 丢弃工作区改动 | 明确不要当前未提交改动时 |
| `git reset` | 移动提交指针或取消暂存 | 需要谨慎，避免误删成果 |
| `git revert` | 用新提交撤销旧提交 | 已推送或想保留历史时 |

## 6. 回滚原则

### 未提交的改动

先看：

```text
git status
git diff
```

确认不需要后，再考虑 restore。

### 已提交但未推送

可以用 reset 调整历史，但要谨慎。

### 已推送或要保留历史

优先用 revert。它会创建一个新的反向提交，保留完整历史。

## 7. PDE 阶段与 Git 里程碑

| 阶段 | Git 里程碑 |
|---|---|
| 项目定义 | `docs: add project brief and MVP PRD` |
| 技术方案 | `docs: add technical spec` |
| 静态网页 | `feat: add static web MVP` |
| 试跑反馈 | `docs: record trial 01 findings` |
| 交互优化 | `feat: improve level submission flow` |
| AI 接入 | `feat: add AI game master integration` |
| 部署 | `chore: add deployment config` |

## 8. 下一步建议

本项目应该尽快执行：

1. 初始化 Git 仓库或确认当前仓库范围。
2. 添加 `.gitignore`。
3. 将当前 `life_service_onboarding_quest/` 作为第一个里程碑提交。
4. 后续每次功能迭代都先开分支或至少形成清晰 commit。

## 9. 注意事项

- 不要为了回滚而随意使用破坏性命令。
- 不要把无关文件一起提交。
- 不要把飞书授权、密钥、token、个人隐私数据提交。
- 提交前先检查 diff。
- 一个 commit 只表达一个清晰动作。
