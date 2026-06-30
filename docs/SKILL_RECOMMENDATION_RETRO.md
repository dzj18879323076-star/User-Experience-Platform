# Skill Recommendation Retro

## 1. 问题

此前用户问「已安装 skills 里，推荐 2-3 个适合优化该项目的 skill」时，我推荐了：

- `browser:control-in-app-browser`
- `lark-apps`
- `skill-creator`

这些不是错误技能，但不够准。它们偏通用执行能力，没有优先识别用户刚安装的 `mattpocock/skills` 中更适合当前问题的前端/设计/架构技能。

## 2. 根因

### 2.1 搜索范围不够

我主要依赖当前对话中显式列出的 skills 和 `tool_search`，没有直接扫描本机 `C:\Users\18879\.codex\skills` 下的新安装技能。

结果是：没有发现 `prototype`、`design-review`、`codebase-design`、`improve-codebase-architecture` 等更匹配的技能。

### 2.2 把问题理解成「优化项目交付链路」

我把「优化该项目」解释成：

- 验证当前网页
- 发布为应用
- 沉淀成 skill

但用户后续明确指出的问题是：

> 游戏化理解不够深入，看上去就是后台表单。

这其实是「产品交互模型探索」问题，而不是发布/自动化问题。

### 2.3 没有区分问题层级

技能推荐应该先判断当前瓶颈属于哪一类：

| 瓶颈 | 应优先推荐 |
|---|---|
| UI 应该长什么样 | `prototype` |
| 已有页面看起来不对 | `design-review` |
| 架构/模块边界混乱 | `codebase-design` / `improve-codebase-architecture` |
| 需要发布可访问版本 | `lark-apps` |
| 需要沉淀工作流 | `skill-creator` |

我前面的推荐跳过了这个分层。

## 3. 修正后的推荐

针对当前「游戏化不足」问题，推荐顺序应是：

1. `prototype`
   - 生成多个结构不同的 UI 原型。
   - 适合回答「这个闯关产品到底应该长什么样」。

2. `design-review`
   - 审查并修复已有页面的视觉、层级和交互问题。
   - 适合在选定原型方向后打磨正式 Demo。

3. `codebase-design`
   - 判断关卡、提交、评分、徽章、报告生成是否需要更清晰的模块接口。
   - 适合在 UI 方向确定后做代码结构升级。

## 4. 后续推荐流程

以后推荐 skills 前，先执行：

1. 扫描本机已安装 skills。
2. 按用户问题分类：设计探索 / 视觉审查 / 架构设计 / 发布 / 自动化 / 文档。
3. 优先推荐问题瓶颈对应的 skill。
4. 明确说明没有推荐某些看似相关 skill 的原因。

## 5. 本次改进

已按 `prototype` skill 产出一个 throwaway UI prototype：

- `web/prototype.html`
- `web/prototype.css`
- `web/prototype.js`

三个变体：

- A：地图闯关
- B：Game Master 控台
- C：证据调查板

这些原型用于判断产品交互方向，不应直接作为生产代码合并。
