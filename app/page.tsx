"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  Level,
  Submission,
  cloneDefaultState,
  createSubmission,
  formatTime,
  getLevelFields,
  isComplete,
  levels,
  scoreSubmission,
  storageKey
} from "../lib/quest";

type SaveQuestResponse = {
  sessionId: string;
  submissionId: string;
  savedFieldCount: number;
  verified: boolean;
  savedAt: string;
};

type BackendSaveState = {
  status: "idle" | "checking" | "saving" | "verified" | "error";
  message: string;
  savedFieldCount?: number;
  savedAt?: string;
};

type QuestHealthResponse = {
  databaseConfigured: boolean;
  databaseUrlValid: boolean;
  message: string;
};

type CoachMode = "pre_submit_hint" | "field_followup" | "post_submit_review" | "final_report" | "guide_chat";

type CoachResponse = {
  roleName: string;
  messageMarkdown: string;
  followUpQuestions: string[];
  nextAction: string;
  reportMarkdown?: string;
  provider: "rules" | "openai" | "agnes";
  fallbackReason?: string;
};

type CoachState = CoachResponse & {
  status: "idle" | "loading" | "ready" | "error";
  mode: CoachMode;
};

type CoachMessage = {
  id: string;
  sender: "user" | "guide";
  text: string;
  provider?: CoachResponse["provider"];
  fallbackReason?: string;
};

type FieldEntry = {
  levelId: string;
  levelName: string;
  perspective: string;
  field: string;
  value: string;
};

const backendSessionStorageKey = "life_service_onboarding_quest_session_id_v1";

function loadStoredState(): AppState {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return cloneDefaultState();
    return JSON.parse(raw) as AppState;
  } catch {
    return cloneDefaultState();
  }
}

function loadStoredBackendSessionId() {
  try {
    return window.localStorage.getItem(backendSessionStorageKey) || "";
  } catch {
    return "";
  }
}

function getSubmission(state: AppState, levelId: string): Submission {
  return state.submissions[levelId] || createSubmission(levelId);
}

function getScoreLabel(score: number) {
  if (score >= 80) {
    return {
      label: "报告素材较成熟",
      hint: "可以进入下一关，但仍建议补充样本对比、路径截图或数据口径。"
    };
  }
  if (score >= 55) {
    return {
      label: "已有基础素材",
      hint: "继续补用户目标、真实路径、证据和产品归因。"
    };
  }
  return {
    label: "等待体验证据",
    hint: "先把真实看到的页面、动作和判断写给 Agnes。"
  };
}

function getRankLabel(score: number) {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 55) return "B";
  return "C";
}

function getProviderLabel(provider: CoachResponse["provider"]) {
  if (provider === "agnes") return "Agnes 知识库";
  if (provider === "openai") return "OpenAI";
  return "备用引导";
}

function getCoachActivityLabel(coachState: CoachState) {
  if (coachState.status === "loading") {
    if (coachState.mode === "final_report") return "生成体验报告";
    if (coachState.mode === "post_submit_review") return "沉淀阶段小结";
    if (coachState.mode === "guide_chat") return "追问体验证据";
    return "阅读关卡素材";
  }
  if (coachState.status === "error") return "需要人工检查";
  if (coachState.provider === "rules") return "备用模式";
  return "模型向导";
}

function getNextAction(score: number, hasReportCard: boolean, hasNextLevel: boolean) {
  if (score < 55) {
    return "继续用对话补齐真实体验证据。";
  }
  if (score < 80) {
    return "让 Agnes 追问缺失信息，再沉淀阶段小结。";
  }
  if (!hasReportCard) {
    return "生成阶段点评，把本关素材纳入报告骨架。";
  }
  return hasNextLevel ? "进入下一关，继续完成训练链路。" : "生成完整体验报告草稿。";
}

function getCurrentEntries(level: Level, submission: Submission): FieldEntry[] {
  return getLevelFields(level)
    .map((field) => ({
      levelId: level.id,
      levelName: level.name,
      perspective: level.perspective,
      field,
      value: (submission.values[field] || "").trim()
    }))
    .filter((entry) => entry.value);
}

function getAllFilledEntries(state: AppState): FieldEntry[] {
  return levels.flatMap((level) => getCurrentEntries(level, getSubmission(state, level.id)));
}

function getCaptureTargetField(level: Level, submission: Submission) {
  const fields = getLevelFields(level);
  const firstMissing = fields.find((field) => !(submission.values[field] || "").trim());
  if (firstMissing) return firstMissing;

  return (
    fields.find((field) => /产品机会|评价缺口|问题|卡点|断点|决策/.test(field)) ||
    fields[fields.length - 1] ||
    "补充观察"
  );
}

function buildReportCard(level: Level, submission: Submission) {
  const score = scoreSubmission(level, submission);
  const fields = getLevelFields(level);
  const missing = fields.filter((field) => !(submission.values[field] || "").trim());
  const evidence = fields
    .filter((field) => (submission.values[field] || "").trim())
    .slice(0, 5)
    .map((field) => `- ${field}：${submission.values[field]}`)
    .join("\n");

  return `## ${level.id} ${level.name} 阶段小结

### 本关定位
以「${level.perspective}」视角完成「${level.goal}」。

### 当前证据
${evidence || "- 暂无有效证据。"}

### 初步产品判断
当前素材需要被继续归因到路径、信息、信任、内容质量、交易承接或分发机制中的一种，避免只停留在个人体感。

### 过程副产物
- 问题清单：从本关卡点、缺口、断点中继续提炼。
- 指标地图：从影响决策、转化、评价质量和分发价值的信号中继续补齐。

### 待补信息
${missing.length ? missing.slice(0, 8).map((field) => `- ${field}`).join("\n") : "- 暂无明显缺失字段。"}

规则草稿评分：${score}/100`;
}

function buildFullReport(state: AppState) {
  const sections = levels.map((level) => {
    const values = state.submissions[level.id]?.values || {};
    const lines = getLevelFields(level)
      .map((field) => `- ${field}：${values[field] || "待补充"}`)
      .join("\n");
    return `## ${level.id} ${level.name}\n\n训练视角：${level.perspective}\n\n${lines}\n`;
  });

  return `# 抖音生活服务评价体验报告草稿

## 1. 背景与体验范围

本报告来自「生活服务新人闯关训练」MVP，围绕消费者看评、评价生产、团购商品、创作者内容、商家经营和平台分发进行结构化体验。报告结论只基于当前已记录的真实体验材料，未记录的事实不做推断。

## 2. 核心体验材料

${sections.join("\n")}
## 3. 初步产品机会

- 将用户路径中的评价入口、评价缺口和交易转化节点串起来。
- 建立评价质量 rubric，区分决策有用、内容丰富、可信和适合分发。
- 为商家侧补充可行动的评价诊断信息。

## 4. 待验证问题

- 哪些评价信息最影响用户从 POI 到团购或到店的决策？
- 商品评价和地点评价分别承担什么决策角色？
- 哪些评价信号适合被更高权重分发？`;
}

function buildProblemArtifacts(entries: FieldEntry[]) {
  const problemEntries = entries.filter((entry) => /问题|缺口|卡点|机会|断点|无法|不足|影响|犹豫/.test(`${entry.field}${entry.value}`));

  if (!problemEntries.length) {
    return ["待沉淀：先通过对话补充真实路径、评价出现位置、决策卡点和机会点。"];
  }

  return problemEntries.slice(-6).map((entry) => `${entry.levelId} ${entry.levelName}｜${entry.field}：${entry.value}`);
}

function buildMetricArtifacts(entries: FieldEntry[]) {
  const text = entries.map((entry) => `${entry.field} ${entry.value}`).join("\n");
  const metrics = [
    /入口|路径|流失|转化|交易/.test(text) ? "路径转化：内容/搜索/POI/团购/评价入口点击与跳出" : "路径转化：待补入口与关键动作",
    /有用|无用|质量|可信|图文|样本|评价/.test(text) ? "评价质量：有用率、信息完整度、可信信号、图文覆盖" : "评价质量：待补有用/无用评价样本",
    /商家|经营|回复|诊断/.test(text) ? "商家经营：可行动反馈、回复效率、负向问题聚类" : "商家经营：待补商家可行动信息",
    /分发|推荐|高权重|低分|激励/.test(text) ? "平台分发：高价值评价识别、激励污染、分发权重" : "平台分发：待补可分发评价规则"
  ];

  return metrics;
}

export default function QuestPage() {
  const [state, setState] = useState<AppState>(() => cloneDefaultState());
  const [isHydrated, setIsHydrated] = useState(false);
  const [autosaveText, setAutosaveText] = useState("未保存");
  const [reportCard, setReportCard] = useState("");
  const [reportCardStatus, setReportCardStatus] = useState("尚未生成");
  const [reportOutput, setReportOutput] = useState("");
  const [coachInput, setCoachInput] = useState("");
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const openedLevelRef = useRef<Record<string, boolean>>({});
  const [backendSessionId, setBackendSessionId] = useState("");
  const [databaseConfigured, setDatabaseConfigured] = useState<boolean | null>(null);
  const [databaseUrlValid, setDatabaseUrlValid] = useState<boolean | null>(null);
  const [backendSaveState, setBackendSaveState] = useState<BackendSaveState>({
    status: "checking",
    message: "正在检查后端数据库配置..."
  });
  const [coachState, setCoachState] = useState<CoachState>({
    status: "idle",
    mode: "pre_submit_hint",
    roleName: "阿引",
    messageMarkdown: "正在读取本关任务。先把真实体验过程写进对话框。",
    followUpQuestions: [],
    nextAction: "先写下 1 条真实体验路径。",
    provider: "rules"
  });

  useEffect(() => {
    const nextState = loadStoredState();
    const nextBackendSessionId = loadStoredBackendSessionId();
    setState(nextState);
    setBackendSessionId(nextBackendSessionId);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [isHydrated, state]);

  useEffect(() => {
    if (!isHydrated) return;

    async function checkBackendHealth() {
      try {
        const response = await fetch("/api/quest/health");
        const payload = (await response.json()) as Partial<QuestHealthResponse>;

        if (
          !response.ok ||
          typeof payload.databaseConfigured !== "boolean" ||
          typeof payload.databaseUrlValid !== "boolean" ||
          typeof payload.message !== "string"
        ) {
          throw new Error("无法确认后端数据库配置。");
        }

        setDatabaseConfigured(payload.databaseConfigured);
        setDatabaseUrlValid(payload.databaseUrlValid);
        setBackendSaveState((current) => {
          if (current.status !== "checking") return current;

          const ready = payload.databaseConfigured && payload.databaseUrlValid;

          return {
            status: ready ? "idle" : "error",
            message: ready ? "后端数据库连接串有效，尚未写入" : payload.message || "后端数据库配置无效"
          };
        });
      } catch {
        setDatabaseConfigured(null);
        setDatabaseUrlValid(null);
        setBackendSaveState((current) => {
          if (current.status !== "checking") return current;

          return {
            status: "error",
            message: "无法确认后端数据库配置"
          };
        });
      }
    }

    checkBackendHealth();
  }, [isHydrated]);

  const activeLevel = useMemo(
    () => levels.find((level) => level.id === state.activeLevelId) || levels[0],
    [state.activeLevelId]
  );
  const activeSubmission = getSubmission(state, activeLevel.id);
  const activeScore = scoreSubmission(activeLevel, activeSubmission);
  const scoreCopy = getScoreLabel(activeScore);
  const activeRank = getRankLabel(activeScore);
  const activeLevelIndex = levels.findIndex((level) => level.id === activeLevel.id);
  const nextLevel = levels[activeLevelIndex + 1];
  const canAdvance = activeScore >= 80;
  const completedCount = levels.filter((level) => isComplete(level, state.submissions[level.id])).length;
  const percent = Math.round((completedCount / levels.length) * 100);
  const nextAction = getNextAction(activeScore, Boolean(reportCard), Boolean(nextLevel));
  const coachProviderLabel = getProviderLabel(coachState.provider);
  const coachActivityLabel = getCoachActivityLabel(coachState);
  const currentEntries = useMemo(() => getCurrentEntries(activeLevel, activeSubmission), [activeLevel, activeSubmission]);
  const allEntries = useMemo(() => getAllFilledEntries(state), [state]);
  const problemArtifacts = useMemo(() => buildProblemArtifacts(allEntries), [allEntries]);
  const metricArtifacts = useMemo(() => buildMetricArtifacts(allEntries), [allEntries]);

  useEffect(() => {
    setAutosaveText(activeSubmission.updatedAt ? `已保存 ${formatTime(activeSubmission.updatedAt)}` : "未保存");
  }, [activeLevel.id, activeSubmission.updatedAt]);

  useEffect(() => {
    if (!isHydrated || openedLevelRef.current[activeLevel.id]) return;
    openedLevelRef.current[activeLevel.id] = true;
    void requestCoach("pre_submit_hint", {
      userQuestion: `请作为 Agnes 主动开启 ${activeLevel.id}「${activeLevel.name}」的第一轮对话：先简短说明本关目标，然后只问我一个最关键的问题，引导我开始描述真实体验。`
    });
  }, [isHydrated, activeLevel.id]);

  function updateState(updater: (current: AppState) => AppState) {
    setState((current) => updater(current));
  }

  function persistConversationObservation(text: string) {
    const field = getCaptureTargetField(activeLevel, activeSubmission);
    const existingValue = (activeSubmission.values[field] || "").trim();
    const nextValue = existingValue ? `${existingValue}\n\n${text}` : text;
    const nextSubmission: Submission = {
      ...activeSubmission,
      values: {
        ...activeSubmission.values,
        [field]: nextValue
      },
      updatedAt: new Date().toISOString()
    };
    nextSubmission.score = scoreSubmission(activeLevel, nextSubmission);
    const nextSubmissions = {
      ...state.submissions,
      [activeLevel.id]: nextSubmission
    };

    setState((current) => ({
      ...current,
      submissions: {
        ...current.submissions,
        [activeLevel.id]: nextSubmission
      }
    }));
    setAutosaveText(`已沉淀到「${field}」`);

    return {
      values: nextSubmission.values,
      score: nextSubmission.score || 0,
      submissions: nextSubmissions
    };
  }

  function switchLevel(levelId: string) {
    updateState((current) => ({
      ...current,
      activeLevelId: levelId
    }));
    setReportCard("");
    setReportCardStatus("尚未生成");
  }

  function saveProgress() {
    updateState((current) => {
      const submission = getSubmission(current, activeLevel.id);
      const nextSubmission: Submission = {
        ...submission,
        updatedAt: new Date().toISOString()
      };
      nextSubmission.score = scoreSubmission(activeLevel, nextSubmission);
      return {
        ...current,
        submissions: {
          ...current.submissions,
          [activeLevel.id]: nextSubmission
        }
      };
    });
    setAutosaveText("已保存");
  }

  async function requestCoach(
    mode: CoachMode,
    options?: {
      sessionId?: string;
      userQuestion?: string;
      activeLevelId?: string;
      values?: Record<string, string>;
      score?: number;
      submissions?: AppState["submissions"];
    }
  ) {
    setCoachState((current) => ({
      ...current,
      status: "loading",
      mode,
      reportMarkdown: undefined,
      fallbackReason: undefined,
      messageMarkdown:
        mode === "final_report"
          ? "Agnes 正在整理完整体验报告..."
          : mode === "post_submit_review"
            ? "Agnes 正在沉淀本关阶段小结..."
            : mode === "guide_chat"
              ? "Agnes 正在追问和归档你的体验素材..."
              : "Agnes 正在阅读当前关卡..."
    }));

    try {
      const response = await fetch("/api/quest/coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId: options?.sessionId || backendSessionId || undefined,
          activeLevelId: options?.activeLevelId || state.activeLevelId,
          levelId: activeLevel.id,
          values: options?.values || activeSubmission.values,
          score: options?.score ?? activeScore,
          mode,
          userQuestion: options?.userQuestion,
          submissions: options?.submissions || state.submissions
        })
      });
      const payload = (await response.json()) as Partial<CoachResponse> & { error?: string };

      if (
        !response.ok ||
        typeof payload.roleName !== "string" ||
        typeof payload.messageMarkdown !== "string" ||
        !Array.isArray(payload.followUpQuestions) ||
        typeof payload.nextAction !== "string" ||
        (payload.provider !== "rules" && payload.provider !== "openai" && payload.provider !== "agnes")
      ) {
        throw new Error(payload.error || "导师点评生成失败。");
      }

      const nextCoachState: CoachState = {
        status: "ready",
        mode,
        roleName: payload.roleName,
        messageMarkdown: payload.messageMarkdown,
        followUpQuestions: payload.followUpQuestions.map(String).slice(0, 3),
        nextAction: payload.nextAction,
        reportMarkdown: typeof payload.reportMarkdown === "string" ? payload.reportMarkdown : undefined,
        provider: payload.provider,
        fallbackReason: typeof payload.fallbackReason === "string" ? payload.fallbackReason : undefined
      };

      setCoachState(nextCoachState);
      setCoachMessages((current) => [
        ...current,
        {
          id: `guide-${Date.now()}`,
          sender: "guide",
          text: nextCoachState.messageMarkdown,
          provider: nextCoachState.provider
        }
      ]);

      if (mode === "post_submit_review" && nextCoachState.reportMarkdown) {
        setReportCard(nextCoachState.reportMarkdown);
        setReportCardStatus(
          nextCoachState.fallbackReason
            ? "阶段小结已生成"
            : `阶段小结已生成（${getProviderLabel(nextCoachState.provider)}）`
        );
      }

      if (mode === "final_report" && nextCoachState.reportMarkdown) {
        setReportOutput(nextCoachState.reportMarkdown);
        setAutosaveText("报告草稿已生成");
      }

      return nextCoachState;
    } catch (error) {
      const message = error instanceof Error ? error.message : "导师点评生成失败。";

      setCoachState((current) => ({
        ...current,
        status: "error",
        messageMarkdown: "Agnes 暂时没有返回有效结果，请稍后重试。",
        followUpQuestions: ["先继续记录真实体验素材。", "稍后再让 Agnes 追问或生成报告。"],
        nextAction: "素材会先保存在本地，不影响继续闯关。"
      }));

      throw error;
    }
  }

  async function submitGuideQuestion(question: string, shouldCapture = true) {
    const normalizedQuestion = question.trim();
    if (!normalizedQuestion || coachState.status === "loading") return;

    const captured = shouldCapture ? persistConversationObservation(normalizedQuestion) : undefined;

    setCoachMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        sender: "user",
        text: normalizedQuestion
      }
    ]);

    try {
      await requestCoach("guide_chat", {
        userQuestion: normalizedQuestion,
        values: captured?.values,
        score: captured?.score,
        submissions: captured?.submissions
      });
    } catch {
      // requestCoach 已经把错误写入对话，不再重复打断用户。
    }
  }

  async function askGuide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = coachInput.trim();
    if (!question || coachState.status === "loading") return;

    setCoachInput("");
    await submitGuideQuestion(question, true);
  }

  async function generateFullReport() {
    try {
      const result = await requestCoach("final_report");
      const report = result.reportMarkdown || buildFullReport(state);
      setReportOutput(report);
      return report;
    } catch {
      const report = buildFullReport(state);
      setReportOutput(report);
      return report;
    }
  }

  async function copyReportCard() {
    let nextReportCard = reportCard.trim();

    if (!nextReportCard) {
      try {
        nextReportCard = (await requestCoach("post_submit_review")).reportMarkdown || "";
      } catch {
        nextReportCard = "";
      }
    }

    const text = nextReportCard.trim() ? nextReportCard : buildReportCard(activeLevel, activeSubmission);
    await navigator.clipboard.writeText(text.trim());
    setReportCardStatus("已复制到剪贴板");
    setAutosaveText("阶段小结已复制");
  }

  async function copyReport() {
    const text = reportOutput.trim() ? reportOutput : await generateFullReport();
    await navigator.clipboard.writeText(text);
    setAutosaveText("报告已复制");
  }

  async function saveToBackend() {
    if (databaseConfigured === false || databaseUrlValid === false) {
      setBackendSaveState({
        status: "error",
        message:
          databaseConfigured === false
            ? "后端数据库未配置，请先设置 DATABASE_URL"
            : "DATABASE_URL 不是有效的 Supabase Session Pooler 连接串"
      });
      return;
    }

    setBackendSaveState({
      status: "saving",
      message: "正在写入后端数据库..."
    });

    try {
      const response = await fetch("/api/quest/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId: backendSessionId || undefined,
          activeLevelId: state.activeLevelId,
          levelId: activeLevel.id,
          values: activeSubmission.values,
          score: activeScore,
          reportCard: reportCard.trim() || undefined,
          finalReport: reportOutput.trim() || undefined
        })
      });
      const payload = (await response.json()) as Partial<SaveQuestResponse> & { error?: string };

      if (!response.ok || !payload.sessionId || !payload.submissionId) {
        throw new Error(payload.error || "保存失败，后端没有返回有效写入结果。");
      }

      window.localStorage.setItem(backendSessionStorageKey, payload.sessionId);
      setBackendSessionId(payload.sessionId);
      setBackendSaveState({
        status: payload.verified ? "verified" : "error",
        message: payload.verified ? "已验证入库" : "已写入，但字段数量校验未通过",
        savedFieldCount: payload.savedFieldCount,
        savedAt: payload.savedAt
      });
      setAutosaveText("后端已验证入库");

      if (payload.verified) {
        await requestCoach("post_submit_review", { sessionId: payload.sessionId });
      }
    } catch (error) {
      setBackendSaveState({
        status: "error",
        message: error instanceof Error ? error.message : "保存失败"
      });
    }
  }

  function goToNextLevel() {
    if (!nextLevel || !canAdvance) return;
    switchLevel(nextLevel.id);
  }

  return (
    <div className="app-shell conversation-shell">
      <header className="topbar conversation-topbar">
        <div>
          <div className="eyebrow">Agnes Guided Quest / 体验报告工坊</div>
          <h1>用对话完成闯关，用证据生成体验报告</h1>
          <p>保留 6 关循序渐进的训练逻辑，主交互收敛为 Agnes 对话；问题清单和指标地图作为过程副产物沉淀。</p>
        </div>
        <div className="hero-stats" aria-label="当前闯关状态">
          <div>
            <span>当前关卡</span>
            <strong>{activeLevel.id}</strong>
          </div>
          <div>
            <span>报告成熟度</span>
            <strong>{activeScore}/100</strong>
          </div>
          <div>
            <span>闯关进度</span>
            <strong>{percent}%</strong>
          </div>
        </div>
      </header>

      <section className="status-band conversation-status-band">
        <div>
          <span className="status-label">主线任务</span>
          <strong>抖音生活服务评价生产与看评消费体验</strong>
        </div>
        <div>
          <span className="status-label">当前阶段</span>
          <strong>{activeLevel.name}</strong>
        </div>
        <div>
          <span className="status-label">报告状态</span>
          <strong>{scoreCopy.label}</strong>
        </div>
        <div>
          <span className="status-label">下一步</span>
          <strong>{nextAction}</strong>
        </div>
        <div className="progress-cell">
          <span className="status-label">完成 {completedCount}/{levels.length}</span>
          <div className="progress-track" aria-label="完成进度">
            <div style={{ width: `${percent}%` }} />
          </div>
        </div>
      </section>

      <main className="conversation-workspace">
        <nav className="level-map quest-map-panel" aria-label="体验闯关地图">
          <div className="map-heading">
            <div>
              <span className="map-kicker">Quest Map</span>
              <h2>体验地图</h2>
            </div>
            <span>{completedCount}/{levels.length} CLEAR</span>
          </div>

          <div className="map-stage" aria-label="生活服务评价体验地图">
            <div className="map-compass" aria-hidden="true">N</div>
            <div className="map-river" aria-hidden="true" />
            <div className="map-road road-a" aria-hidden="true" />
            <div className="map-road road-b" aria-hidden="true" />
            <div className="map-road road-c" aria-hidden="true" />
            <div className="map-road road-d" aria-hidden="true" />
            <div className="map-road road-e" aria-hidden="true" />
            <div className="map-district district-a" aria-hidden="true" />
            <div className="map-district district-b" aria-hidden="true" />
            <div className="map-district district-c" aria-hidden="true" />

            {levels.map((level, index) => {
              const completed = isComplete(level, state.submissions[level.id]);
              const active = level.id === state.activeLevelId;
              const submission = getSubmission(state, level.id);
              const filledCount = getLevelFields(level).filter((field) => (submission.values[field] || "").trim()).length;
              const totalCount = getLevelFields(level).length;

              return (
                <button
                  className={`map-landmark landmark-${index + 1} ${active ? "active" : ""} ${completed ? "completed" : ""}`}
                  type="button"
                  key={level.id}
                  onClick={() => switchLevel(level.id)}
                  aria-current={active ? "step" : undefined}
                  aria-label={`前往 ${level.id} ${level.name}`}
                >
                  <span className="landmark-pin">
                    <span className="landmark-symbol">{index + 1}</span>
                  </span>
                  <span className="landmark-card">
                    <strong>{level.id} · {level.name}</strong>
                    <small>{level.badge}</small>
                    <em>{completed ? "CLEAR" : active ? "NOW" : `${filledCount}/${totalCount}`}</em>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="map-legend">
            <span><i className="legend-dot active" /> 当前关卡</span>
            <span><i className="legend-dot completed" /> 已沉淀素材</span>
          </div>
        </nav>

        <section className="conversation-panel" aria-label="Agnes 对话式闯关区">
          <div className="mission-brief-card">
            <span className="pill">MISSION {activeLevel.id} · {activeLevel.perspective} · {activeLevel.estimatedMinutes} 分钟</span>
            <div className="mission-brief-grid">
              <div>
                <h2>{activeLevel.name}</h2>
                <p>{activeLevel.goal}</p>
              </div>
              <div>
                <span className="status-label">本关主线</span>
                <strong>{activeLevel.mainTask}</strong>
              </div>
            </div>
          </div>

          <section className="agnes-console">
            <div className="agnes-console-header">
              <div>
                <span className="guide-kicker">Agnes 业务教练</span>
                <h2>{coachState.roleName}</h2>
                <p>{scoreCopy.hint}</p>
              </div>
              <div className="guide-meta">
                <span className={`provider-badge ${coachState.provider}`}>{coachProviderLabel}</span>
                <span>RANK {activeRank}</span>
                <span>{coachActivityLabel}</span>
              </div>
            </div>

            <div className={`guide-chat main-guide-chat ${coachState.status}`}>
              <div className="guide-messages" aria-live="polite">
                {coachMessages.slice(-8).map((message) => (
                  <div className={`guide-message ${message.sender}`} key={message.id}>
                    <span>{message.sender === "user" ? "你" : coachState.roleName}</span>
                    <p>{message.text}</p>
                  </div>
                ))}
                {coachState.status === "loading" ? (
                  <div className="guide-message guide thinking" key="agnes-thinking">
                    <span>{coachState.roleName}</span>
                    <p>
                      <span className="typing-dots" aria-hidden="true"><i /> <i /> <i /></span>
                      Agnes 正在阅读你的体验素材，并整理下一句追问…
                    </p>
                  </div>
                ) : null}
                {!coachMessages.length && coachState.status !== "loading" ? (
                  <div className="guide-message guide">
                    <span>{coachState.roleName}</span>
                    <p>Agnes 正在准备第一轮问题，请稍等片刻。</p>
                  </div>
                ) : null}
              </div>

              <form className="conversation-input-row" onSubmit={askGuide}>
                <textarea
                  value={coachInput}
                  onChange={(event) => setCoachInput(event.target.value)}
                  placeholder="把体验过程直接写给 Agnes：我从哪里进入、想完成什么、看到了哪些评价、哪里让我犹豫或决定下单……"
                  disabled={coachState.status === "loading"}
                />
                <button className="primary-button" type="submit" disabled={!coachInput.trim() || coachState.status === "loading"}>
                  发送并沉淀
                </button>
              </form>
            </div>

            <div className="conversation-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => void submitGuideQuestion("请基于当前素材指出缺失证据，并把下一步体验动作说清楚。", false)}
                disabled={coachState.status === "loading"}
              >
                追问缺失证据
              </button>
              <button className="ghost-button" type="button" onClick={() => void requestCoach("post_submit_review")} disabled={coachState.status === "loading"}>
                生成阶段小结
              </button>
              <button className="primary-button" type="button" onClick={() => void generateFullReport()} disabled={coachState.status === "loading"}>
                生成体验报告
              </button>
            </div>
          </section>
        </section>

        <aside className="side-artifacts" aria-label="报告过程副产物">
          <section className="artifact-card command-card">
            <div className="panel-heading">
              <h2>交付控制台</h2>
              <span>{autosaveText}</span>
            </div>
            <p>最终主交付是体验报告；问题清单、指标地图和阶段小结只作为生成报告的过程素材。</p>
            <div className="artifact-actions">
              <button className="ghost-button" type="button" onClick={saveProgress}>
                保存本地
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={saveToBackend}
                disabled={backendSaveState.status === "saving" || backendSaveState.status === "checking"}
              >
                {backendSaveState.status === "saving" ? "写入中..." : "保存入库"}
              </button>
              <button className="primary-button" type="button" onClick={goToNextLevel} disabled={!nextLevel || !canAdvance}>
                {nextLevel ? `进入 ${nextLevel.id}` : "已完成"}
              </button>
            </div>
            <small>{backendSaveState.message}</small>
          </section>

          <section className="artifact-card">
            <div className="panel-heading compact">
              <h2>已沉淀观察</h2>
              <span>{currentEntries.length}/{getLevelFields(activeLevel).length}</span>
            </div>
            <div className="artifact-list">
              {currentEntries.length ? (
                currentEntries.slice(-6).map((entry) => (
                  <article key={`${entry.field}-${entry.value.slice(0, 12)}`}>
                    <strong>{entry.field}</strong>
                    <p>{entry.value}</p>
                  </article>
                ))
              ) : (
                <p className="empty-copy">还没有本关素材。先在对话框写一条真实体验。</p>
              )}
            </div>
          </section>

          <section className="artifact-card">
            <div className="panel-heading compact">
              <h2>问题清单</h2>
              <span>过程副产物</span>
            </div>
            <ul className="artifact-bullets">
              {problemArtifacts.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="artifact-card">
            <div className="panel-heading compact">
              <h2>指标地图</h2>
              <span>过程副产物</span>
            </div>
            <ul className="artifact-bullets">
              {metricArtifacts.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="artifact-card report-artifact-card">
            <div className="panel-heading compact">
              <h2>报告产物</h2>
              <div className="inline-actions">
                <button className="text-button" type="button" onClick={copyReportCard}>
                  复制小结
                </button>
                <button className="text-button" type="button" onClick={copyReport}>
                  复制报告
                </button>
              </div>
            </div>
            <div className={`report-status ${coachState.status === "ready" || reportCard || reportOutput ? "ready" : ""}`}>
              {coachState.status === "loading" ? "Agnes 正在处理" : reportCardStatus}
            </div>
            {reportCard || reportOutput ? (
              <details className="guide-artifacts" open>
                <summary>查看草稿</summary>
                {reportCard ? (
                  <section>
                    <strong>阶段小结</strong>
                    <pre>{reportCard}</pre>
                  </section>
                ) : null}
                {reportOutput ? (
                  <section>
                    <strong>体验报告</strong>
                    <pre>{reportOutput}</pre>
                  </section>
                ) : null}
              </details>
            ) : (
              <p className="empty-copy">完成几轮对话后，可生成阶段小结或最终体验报告。</p>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}
