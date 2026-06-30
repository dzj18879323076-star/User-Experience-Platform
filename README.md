# Life Service Onboarding Quest

生活服务新人闯关训练项目。

本项目把 leader 给新人的「第一周产品体验报告」任务，产品化为一套可复用的闯关机制。目标不是让新人机械打卡，而是通过游戏化任务，训练新人从用户视角、创作者视角、商家视角和平台视角理解抖音生活服务生态，最终沉淀一份高质量产品体验报告。

## 当前定位

- 项目类型：PDE / 新人训练产品
- 首个主题：抖音生活服务评价生产与看评消费体验
- 首批用户：评价生产相关产品/运营新人
- 首个交付：新人产品体验报告 + 关卡记录 + leader 评阅材料

## 目录

- `00_project_brief.md`：项目定义、目标、边界
- `01_mvp_prd.md`：MVP 产品需求文档
- `02_level_design.md`：首版关卡设计
- `03_ai_game_master.md`：AI Game Master 角色、提示词和输出规范
- `04_trial_plan.md`：你作为第一个用户的试跑计划
- `app/`：Next.js App Router 主应用
- `lib/quest.ts`：关卡数据、评分和报告生成的核心类型/逻辑
- `config/levels.yaml`：结构化关卡配置草案
- `templates/experience_report_outline.md`：最终体验报告模板

## 使用方式

1. 安装依赖：`npm install`。
2. 启动本地开发服务：`npm run dev:local`。
3. 打开 [http://127.0.0.1:3000](http://127.0.0.1:3000)，进入闯关训练产品。
4. 先读 `00_project_brief.md` 和 `01_mvp_prd.md`，确认项目目标与第一版范围。
5. 按 `02_level_design.md` 完成 6 个关卡，期间让 AI Game Master 追问和整理。
6. 用 `templates/experience_report_outline.md` 生成第一版体验报告。
7. 根据 `04_trial_plan.md` 做一次自测复盘，决定是否扩展为团队工具。

## 项目原则

- 轻量：每关 20-40 分钟，不把新人训练做成额外负担。
- 可复用：关卡、评分、报告模板都可配置。
- 产品化：把一次性作业抽象为可运营、可评估、可迭代的机制。
- 岗位贴合：围绕评价生产、看评消费、内容质量和分发应用展开。
- 不替代真实体验：AI 只做引导、追问、评分和整理，不编造体验结论。
