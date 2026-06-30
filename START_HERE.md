# START HERE：项目启动入口

## 当前阶段

项目已经从「文档试跑」升级为 PDE 项目，当前具备三类交付物：

- PRD：`docs/PRD.md`
- 技术方案：`docs/TECH_SPEC.md`
- 架构评估：`docs/ARCHITECTURE_REVIEW.md`
- PDE 执行手册：`docs/PDE_PLAYBOOK.md`
- Git 工作流：`docs/GIT_WORKFLOW.md`
- 工作指南：`docs/WORKING_GUIDE.md`
- Next.js Web MVP：`app/page.tsx`

## 你现在要做哪一步？

### A. 先对齐项目方向

读：

- `00_project_brief.md`
- `01_mvp_prd.md`
- `docs/PDE_PLAYBOOK.md`

适合在和 leader 或同事沟通前使用。

### B. 启动网页 MVP

运行：

- `npm install`
- `npm run dev`

当前 Next.js 应用支持关卡切换、体验记录、本地保存、阶段汇报卡草稿、报告草稿和 JSON 导出。

### C. 继续完善闯关内容

读：

- `02_level_design.md`
- `04_trial_plan.md`

建议先做第 1 次试跑：关卡 1「找店迷宫」+ 关卡 2「看评裁判所」。

### D. 让 AI 陪跑

读：

- `03_ai_game_master.md`

使用方式：把当前关卡、你的观察提交给 AI，让它按「追问教练 Prompt」追问，再按「评分 Prompt」给反馈。

### E. 准备产出报告

读：

- `templates/experience_report_outline.md`

当 6 个关卡都有阶段汇报卡后，再生成最终报告。

## 第一次试跑建议

### 时间

60-90 分钟。

### 任务

1. 代入一个真实消费需求，完成关卡 1。
2. 选择 3 个商户或商品页面，完成关卡 2。
3. 让 AI Game Master 生成两张阶段汇报卡。

### 最小产出

```text
消费决策路径图：
有用评价样本：
无用评价样本：
看评体验问题：
产品机会点：
```

## 对 leader 的同步口径

可以这样说：

> 我准备把第一周体验任务做成一套新人闯关机制。第一步我会自己作为种子用户跑一轮，输出体验报告；同时验证这套机制是否能复用给后续新人。第一版会轻量处理，不做复杂系统，先用关卡文档、AI 追问和报告模板跑通。

## 下一次迭代方向

- 把关卡提交模板做成表格或飞书多维表。
- 设计 leader 评阅页。
- 把 AI Game Master 接入飞书机器人。
- 沉淀优秀样本库和反例库。
