import "server-only";

import { AppState, Level, getLevelFields, levels } from "../quest";

export type QuestCoachMode = "pre_submit_hint" | "field_followup" | "post_submit_review" | "final_report" | "guide_chat";

export type QuestCoachProvider = "rules" | "openai" | "agnes";

export type QuestCoachRequest = {
  sessionId?: string;
  activeLevelId: string;
  levelId: string;
  values: Record<string, string>;
  score: number;
  mode: QuestCoachMode;
  userQuestion?: string;
  submissions?: AppState["submissions"];
};

export type QuestCoachResponse = {
  roleName: string;
  messageMarkdown: string;
  followUpQuestions: string[];
  nextAction: string;
  reportMarkdown?: string;
  provider: QuestCoachProvider;
  fallbackReason?: string;
};

type ResponsesApiResponse = {
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type ModelProviderConfig = {
  provider: Exclude<QuestCoachProvider, "rules">;
  apiKey?: string;
  baseUrl: string;
  model: string;
  endpoint: "responses" | "chat_completions";
};

const roleName = "阿引";
const modelTimeoutMs = 20_000;
const productOpportunityFields = ["产品机会", "评价缺口", "经营诊断机会", "二者缺口", "信任断点", "最大卡点"];

const evaluationKnowledgeBase = `
【评价评分业务知识库】
1. 评价是用户到店、消费、履约后的事实记录；评分是把海量评价压缩成可比较、可决策、可治理的信号。
2. 抖音生活服务不是单一搜索场景，而是兴趣分发、内容种草、POI/团购承接、到店履约、评价反馈共同构成的闭环。
3. 体验报告要同时看到四类角色：消费者如何决策，作者/达人如何影响信任，商家能否获得可行动反馈，平台如何识别高质量评价并参与分发。
4. 常见问题分桶：供给缺口、分发错配、消费决策信息不足、评价公信力不足、商家经营反馈不可行动、竞品差距。
5. 指标意识：不要只写“感觉不好”，要追问入口点击、评价曝光、看评停留、团购转化、评价发布率、评价有用率、图文覆盖、低质/激励污染、商家回复和问题聚类等可验证信号。
6. 报告原则：最终主交付是产品体验报告；问题清单、证据台账、指标地图、阶段小结只是过程副产物。不要把个体样本包装成平台级结论，不编造用户没有提供的事实。
`;

const stagedGuideRules = `
【对话式闯关规则】
- 保留 L1-L6 关卡顺序，用关卡作为后台状态机：L1 找店路径，L2 看评质量，L3 商品/地点评价差异，L4 内容到交易，L5 商家经营价值，L6 平台分发规则。
- 前台交互以对话为主：每轮最多给 1 个关键追问 + 1 个下一步动作，避免让新人面对复杂表单。
- 用户给出素材后，先归档事实，再追问证据，再做业务归因，最后才进入报告表达。
- 如果素材不足，明确缺什么：场景、入口、路径节点、评价样本、决策影响、竞品对比、数据口径。
- 如果生成报告，结构必须服务当前素材，不能机械套固定模板；可以动态组织“背景、核心结论、关键观察、业务归因、产品机会、待验证问题”。
`;

function findLevel(levelId: string): Level {
  return levels.find((level) => level.id === levelId) || levels[0];
}

function getFilledEntries(level: Level, values: Record<string, string>) {
  return getLevelFields(level)
    .map((field) => ({ field, value: (values[field] || "").trim() }))
    .filter((entry) => entry.value);
}

function getMissingFields(level: Level, values: Record<string, string>) {
  return getLevelFields(level).filter((field) => !(values[field] || "").trim());
}

function getOpportunity(values: Record<string, string>) {
  for (const field of productOpportunityFields) {
    const value = (values[field] || "").trim();
    if (value) return value;
  }

  return "";
}

function buildFollowUpQuestions(level: Level, values: Record<string, string>, score: number) {
  const missing = getMissingFields(level, values);
  const questions: string[] = [];

  if (missing.length) {
    questions.push(`先补「${missing[0]}」：请用一句话说明真实场景、入口和发生在哪个页面/动作。`);
  }

  if (!getOpportunity(values)) {
    questions.push("把观察翻译成产品问题：它更像供给、分发、消费决策、评价信任、商家经营还是平台治理问题？");
  }

  if (score < 80) {
    questions.push("如果这条观察要进入体验报告，还缺哪类证据：评价样本、路径截图、竞品对比，还是指标口径？");
  } else {
    questions.push("这关最值得写进报告核心结论的判断是什么？请压缩成一句话，并标注证据来源。");
  }

  return questions.slice(0, 3);
}

function buildEvidenceMarkdown(level: Level, values: Record<string, string>) {
  const evidence = getFilledEntries(level, values)
    .slice(0, 6)
    .map((entry) => `- ${entry.field}：${entry.value}`)
    .join("\n");

  return evidence || "- 暂无有效证据。先写下一个真实场景或页面节点。";
}

function getNextAction(level: Level, score: number, mode: QuestCoachMode) {
  const currentIndex = levels.findIndex((item) => item.id === level.id);
  const nextLevel = levels[currentIndex + 1];

  if (mode === "final_report") {
    return "检查报告里的事实依据，补齐无法被当前体验记录支撑的结论。";
  }

  if (score < 55) {
    return "先补齐关键体验记录，再请求导师点评。";
  }

  if (score < 80) {
    return "继续补证据和产品归因，暂不建议直接进入下一关。";
  }

  return nextLevel ? `可以进入 ${nextLevel.id}「${nextLevel.name}」。` : "全部关卡已完成，可以生成最终体验报告草稿。";
}

function buildPostSubmitReport(level: Level, values: Record<string, string>, score: number) {
  const missing = getMissingFields(level, values);
  const opportunity = getOpportunity(values) || "待补充一个可验证的产品机会点。";

  return `## ${level.id} ${level.name} 导师点评

### 过关判断
${score >= 80 ? "本关已经达到初轮过关标准，可以进入下一关。" : "本关已有基础观察，但证据和产品归因还需要继续补强。"}

### 当前证据
${buildEvidenceMarkdown(level, values)}

### 产品机会
${opportunity}

### 需要补齐
${missing.length ? missing.slice(0, 5).map((field) => `- ${field}`).join("\n") : "- 暂无明显缺失字段。"}

### 下一步
${getNextAction(level, score, "post_submit_review")}
`;
}

function buildChatReply(level: Level, values: Record<string, string>, score: number, userQuestion?: string) {
  const filled = getFilledEntries(level, values);
  const missing = getMissingFields(level, values);
  const question = userQuestion?.trim();
  const evidence = filled.length ? buildEvidenceMarkdown(level, values) : "你还没有写下有效体验记录。";
  const firstMissing = missing[0];

  if (!question) {
    return `你可以直接把真实体验过程写给我：你想完成什么、从哪里进入、看到了哪些评价、哪里影响了决策。\n\n当前在 ${level.id}「${level.name}」：${score >= 80 ? "素材已经比较完整，可以生成阶段小结或进入下一关。" : firstMissing ? `建议先补「${firstMissing}」。` : "建议把已有观察压缩成一个产品问题。"}`;
  }

  return `收到，你写的是：「${question}」\n\n我会先把它当作 ${level.id}「${level.name}」的体验素材，而不是直接写成结论。下一步请补一个最关键证据：${firstMissing ? `「${firstMissing}」` : "这条观察对应的页面/评价样本/决策影响"}。\n\n归因时优先判断它属于哪类问题：供给缺口、分发错配、消费决策信息不足、评价信任、商家经营反馈，还是平台治理。\n\n当前已沉淀证据：\n${evidence}`;
}

function buildFinalReport(submissions: AppState["submissions"] | undefined) {
  const sections = levels.map((level) => {
    const submission = submissions?.[level.id];
    const values = submission?.values || {};
    const fields = getLevelFields(level)
      .map((field) => `- ${field}：${values[field] || "待补充"}`)
      .join("\n");

    return `## ${level.id} ${level.name}

训练视角：${level.perspective}

${fields}`;
  });

  return `# 生活服务评价体验报告草稿

## 背景与体验范围

本报告基于「生活服务新人闯关训练」中的真实体验记录，围绕看评消费、评价质量、商品/地点评价、创作者链路、商家价值和平台分发进行整理。当前草稿只使用已记录材料，缺失部分保留为待验证问题。

## 核心结论草稿

- 评价内容不只是消费后的文本资产，而是连接消费决策、交易承接、商家经营反馈和平台分发治理的信号。
- 新人体验报告需要从真实路径出发，把“看到了什么”进一步翻译成“影响了谁的什么决策”。
- 问题清单和指标地图是报告生成过程中的副产物，最终仍需要回到一份可被 leader/mentor 讨论的体验报告。

${sections.join("\n\n")}

## 问题清单与指标地图

- 消费决策：评价入口曝光、看评停留、团购转化、收藏/规划动作。
- 评价质量：有用率、信息完整度、可信信号、图文覆盖、低质/激励污染。
- 商家经营：可行动反馈、商家回复、问题聚类、经营诊断。
- 平台分发：高价值评价识别、评价分发权重、内容到交易承接效率。

## 待验证问题

- 哪些评价信息最影响用户从 POI 到团购或到店的决策？
- 商品评价和地点评价各自承担什么角色？
- 哪些评价信号适合被更高权重分发？`;
}

function ruleCoach(request: QuestCoachRequest): QuestCoachResponse {
  const level = findLevel(request.levelId);
  const filled = getFilledEntries(level, request.values);
  const missing = getMissingFields(level, request.values);
  const followUpQuestions = buildFollowUpQuestions(level, request.values, request.score);
  const nextAction = getNextAction(level, request.score, request.mode);

  if (request.mode === "final_report") {
    const reportMarkdown = buildFinalReport(request.submissions);

    return {
      roleName,
      messageMarkdown: "我已经把你的闯关记录整理成报告草稿。下一步不要急着润色，先检查每个结论是否都有体验证据支撑。",
      followUpQuestions: [
        "哪一关的结论最像真实产品机会，而不是个人体感？",
        "哪些观察还缺样本对比或数据验证？",
        "最终给 leader 看时，你最希望推动哪一个问题进入讨论？"
      ],
      nextAction,
      reportMarkdown,
      provider: "rules"
    };
  }

  if (request.mode === "post_submit_review") {
    const reportMarkdown = buildPostSubmitReport(level, request.values, request.score);

    return {
      roleName,
      messageMarkdown: `本关导师点评已生成。规则评分 ${request.score}/100。${request.score >= 80 ? "你可以进入下一关，但建议保留关键截图或样本。" : "建议先补齐证据，再把它作为阶段结论。"}`,
      followUpQuestions,
      nextAction,
      reportMarkdown,
      provider: "rules"
    };
  }

  if (request.mode === "guide_chat") {
    return {
      roleName,
      messageMarkdown: buildChatReply(level, request.values, request.score, request.userQuestion),
      followUpQuestions,
      nextAction,
      provider: "rules"
    };
  }

  if (request.mode === "pre_submit_hint" || filled.length === 0) {
    const priorityFields = missing.slice(0, 3).join("、");

    return {
      roleName,
      messageMarkdown: `我是你的任务向导「${roleName}」。这一关你要以「${level.perspective}」视角完成「${level.name}」。先别写结论，先记录真实路径。\n\n优先填写：${priorityFields || "当前关卡关键字段"}。\n\n本关目标：${level.goal}`,
      followUpQuestions,
      nextAction: "先完成 2-3 个真实字段，再请求导师点评。",
      provider: "rules"
    };
  }

  if (request.mode === "field_followup") {
    return {
      roleName,
      messageMarkdown: `我看到了 ${filled.length} 条有效记录。现在最重要的不是写得更多，而是把观察落到可验证的页面、动作和产品归因上。\n\n当前证据：\n${buildEvidenceMarkdown(level, request.values)}`,
      followUpQuestions,
      nextAction,
      provider: "rules"
    };
  }

  return {
    roleName,
    messageMarkdown: "我已经读到当前关卡记录。先补齐真实路径、关键证据和一个产品机会点，再继续推进。",
    followUpQuestions,
    nextAction,
    provider: "rules"
  };
}

function buildModelPrompt(request: QuestCoachRequest) {
  const level = findLevel(request.levelId);
  const fallback = ruleCoach(request);

  return `你是生活服务新人体验报告平台的 Agnes 业务教练，中文名叫阿引。你的目标不是陪用户玩复杂游戏，而是在保留闯关节奏的前提下，用对话帮助新人把真实体验材料沉淀成高质量产品体验报告。

${evaluationKnowledgeBase}
${stagedGuideRules}

输出必须是 JSON，不要包裹 markdown code fence。JSON schema:
{
  "roleName": "阿引",
  "messageMarkdown": "string",
  "followUpQuestions": ["string", "string", "string"],
  "nextAction": "string",
  "reportMarkdown": "string 或省略"
}

硬性要求：
- 不编造用户没有提供的事实、竞品表现或数据。
- 如果用户素材不足，明确指出缺失证据，不要强行生成确定性结论。
- followUpQuestions 最多 3 条，优先追问真实路径、评价样本、决策影响、业务归因和指标口径。
- messageMarkdown 要短、具体、可执行；每轮最多给一个关键下一步。
- post_submit_review 的 reportMarkdown 是阶段小结，必须服务最终体验报告。
- final_report 的 reportMarkdown 是完整体验报告草稿，问题清单和指标地图只能作为过程副产物/附录，不要喧宾夺主。
- guide_chat 要像对话教练：先回应用户，再追问一个关键问题，并说明本轮素材会沉淀到哪类报告材料。

当前模式：${request.mode}
用户问题/本轮素材：${request.userQuestion || "无"}
当前关卡：${level.id} ${level.name}
当前视角：${level.perspective}
关卡目标：${level.goal}
主线任务：${level.mainTask}
通过标准：${level.passCriteria.join("；")}
当前报告成熟度评分：${request.score}/100
本地规则兜底建议：${fallback.nextAction}
当前关卡已沉淀字段：
${JSON.stringify(request.values, null, 2)}

全部关卡 submissions：
${JSON.stringify(request.submissions || {}, null, 2)}`;
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function buildProviderConfig(): ModelProviderConfig | undefined {
  const provider = process.env.QUEST_AGENT_PROVIDER;

  if (provider === "agnes") {
    return {
      provider,
      apiKey: process.env.AGNES_API_KEY,
      baseUrl: process.env.AGNES_BASE_URL || "",
      model: process.env.AGNES_MODEL || "",
      endpoint: "chat_completions"
    };
  }

  if (provider === "openai") {
    return {
      provider,
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: "https://api.openai.com/v1",
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      endpoint: "responses"
    };
  }

  return undefined;
}

function extractResponseText(response: ResponsesApiResponse) {
  return (
    response.output
      ?.flatMap((item) => item.content || [])
      .map((content) => content.text || "")
      .filter(Boolean)
      .join("\n")
      .trim() || ""
  );
}

function extractChatCompletionText(response: ChatCompletionResponse) {
  return response.choices?.[0]?.message?.content?.trim() || "";
}

function stripJsonFence(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function parseModelResponse(text: string, provider: QuestCoachProvider): QuestCoachResponse {
  const parsed = JSON.parse(stripJsonFence(text)) as Partial<QuestCoachResponse>;

  if (
    typeof parsed.roleName !== "string" ||
    typeof parsed.messageMarkdown !== "string" ||
    !Array.isArray(parsed.followUpQuestions) ||
    typeof parsed.nextAction !== "string"
  ) {
    throw new Error("模型返回格式不符合 Game Master 协议。");
  }

  return {
    roleName: parsed.roleName,
    messageMarkdown: parsed.messageMarkdown,
    followUpQuestions: parsed.followUpQuestions.map(String).slice(0, 3),
    nextAction: parsed.nextAction,
    reportMarkdown: typeof parsed.reportMarkdown === "string" ? parsed.reportMarkdown : undefined,
    provider
  };
}

function getProviderUrl(config: ModelProviderConfig) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  if (!baseUrl) {
    throw new Error(`${config.provider} base URL 未配置。`);
  }

  if (baseUrl.endsWith("/chat/completions") || baseUrl.endsWith("/responses")) {
    return baseUrl;
  }

  return `${baseUrl}/${config.endpoint === "responses" ? "responses" : "chat/completions"}`;
}

async function callModelProvider(request: QuestCoachRequest, config: ModelProviderConfig): Promise<QuestCoachResponse> {
  if (!config.apiKey) {
    throw new Error(`${config.provider} API key 未配置。`);
  }

  if (!config.model) {
    throw new Error(`${config.provider} model 未配置。`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), modelTimeoutMs);
  const prompt = buildModelPrompt(request);

  try {
    const response = await fetch(getProviderUrl(config), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(
        config.endpoint === "responses"
          ? {
              model: config.model,
              input: prompt
            }
          : {
              model: config.model,
              messages: [
                {
                  role: "system",
                  content: "你只输出符合约定 schema 的 JSON，不要输出 markdown code fence。"
                },
                {
                  role: "user",
                  content: prompt
                }
              ],
              temperature: 0.4
            }
      ),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`${config.provider} 请求失败，HTTP ${response.status}。`);
    }

    const payload = await response.json();
    const text =
      config.endpoint === "responses"
        ? extractResponseText(payload as ResponsesApiResponse)
        : extractChatCompletionText(payload as ChatCompletionResponse);

    if (!text) {
      throw new Error(`${config.provider} 返回内容为空。`);
    }

    return parseModelResponse(text, config.provider);
  } finally {
    clearTimeout(timeout);
  }
}

function toFallbackReason(error: unknown, provider: QuestCoachProvider) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return `${provider} 响应超时，已切换规则引导。`;
  }

  if (error instanceof Error) {
    return `${error.message} 已切换规则引导。`;
  }

  return `${provider} 调用失败，已切换规则引导。`;
}

export async function runQuestCoach(request: QuestCoachRequest): Promise<QuestCoachResponse> {
  const config = buildProviderConfig();

  if (!config) {
    return ruleCoach(request);
  }

  try {
    return await callModelProvider(request, config);
  } catch (error) {
    return {
      ...ruleCoach(request),
      fallbackReason: toFallbackReason(error, config.provider)
    };
  }
}
