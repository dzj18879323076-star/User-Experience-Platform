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
const productOpportunityFields = ["产品机会", "评价缺口", "经营诊断机会", "二者缺口", "信任断点"];

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
    questions.push(`先补「${missing[0]}」：这条记录对应哪个真实页面、动作或用户判断？`);
  }

  if (!getOpportunity(values)) {
    questions.push("把观察翻译成一个产品机会：是路径、信息、信任、内容质量、交易承接还是分发机制的问题？");
  }

  if (score < 80) {
    questions.push("如果要说服 leader，这个问题还需要哪类证据：截图、路径节点、样本对比，还是数据口径？");
  } else {
    questions.push("这关最值得带到下一关验证的结论是什么？请压缩成一句话。");
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
    return `你可以直接问我：这一关怎么做、现在缺什么、这条观察怎么变成产品机会。\n\n当前我先看 ${level.id}「${level.name}」：${score >= 80 ? "记录已经比较完整，可以准备阶段点评。" : firstMissing ? `建议先补「${firstMissing}」。` : "建议把已有观察压缩成一个产品机会点。"}`;
  }

  return `收到，你问的是：「${question}」\n\n基于当前关卡，我建议先抓住三点：\n1. 只写你真实看到或操作过的页面、路径和判断。\n2. 把观察落到一个产品问题：路径、信息、信任、内容质量、交易承接或分发机制。\n3. 下一步先补${firstMissing ? `「${firstMissing}」` : "一个可验证的证据或机会点"}，再生成本关点评。\n\n当前证据：\n${evidence}`;
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

## 背景

本报告基于「生活服务新人闯关训练」中的真实体验记录，围绕看评消费、评价质量、商品/地点评价、创作者链路、商家价值和平台分发进行整理。

${sections.join("\n\n")}

## 关键发现

- 评价内容需要同时服务消费决策、交易承接和平台分发。
- 高价值评价应当能解释用户为什么选择、为什么放弃，以及还缺什么信息。
- 报告中的结论需要继续用更多样本、路径截图或数据口径验证。

## 产品机会

- 将用户路径中的评价入口、评价缺口和交易转化节点串起来。
- 建立评价质量 rubric，区分决策有用、内容丰富和分发可信。
- 为商家侧补充可行动的评价诊断信息。

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

  return `你是生活服务新人闯关训练平台的 NPC 教练，名字叫阿引。请基于用户真实填写内容给出克制、具体、可执行的反馈，不要编造用户没有填写的事实。

输出必须是 JSON，不要包裹 markdown code fence。JSON schema:
{
  "roleName": "阿引",
  "messageMarkdown": "string",
  "followUpQuestions": ["string", "string", "string"],
  "nextAction": "string",
  "reportMarkdown": "string 或省略"
}

模式：${request.mode}
用户问题：${request.userQuestion || "无"}
关卡：${level.id} ${level.name}
视角：${level.perspective}
目标：${level.goal}
主线任务：${level.mainTask}
评分：${request.score}/100
本地规则兜底建议：${fallback.nextAction}
用户填写：
${JSON.stringify(request.values, null, 2)}

如果模式是 post_submit_review，请生成可保存为阶段汇报卡的 reportMarkdown。
如果模式是 final_report，请基于 submissions 生成完整体验报告草稿 reportMarkdown。
如果模式是 guide_chat，请像一个问答向导一样直接回答用户问题；回答要短，优先给下一步动作，不要重复完整报告。
全部 submissions:
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
