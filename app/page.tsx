"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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

type CityBuilding = {
  levelId: string;
  name: string;
  district: string;
  className: string;
  x: number;
  y: number;
};

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

const backendSessionStorageKey = "life_service_onboarding_quest_session_id_v1";

type CoachMessage = {
  id: string;
  sender: "user" | "guide";
  text: string;
  provider?: CoachResponse["provider"];
  fallbackReason?: string;
};

const cityBuildings: CityBuilding[] = [
  { levelId: "L1", name: "城门街区", district: "找店迷宫", className: "gate", x: 13, y: 63 },
  { levelId: "L2", name: "评审殿", district: "看评裁判所", className: "court", x: 32, y: 36 },
  { levelId: "L3", name: "交易工坊", district: "团购商品实验室", className: "workshop", x: 53, y: 61 },
  { levelId: "L4", name: "影像塔", district: "创作者通道", className: "tower", x: 70, y: 30 },
  { levelId: "L5", name: "商会", district: "商家镜像", className: "guild", x: 78, y: 67 },
  { levelId: "L6", name: "分发灯塔", district: "平台分发台", className: "lighthouse", x: 47, y: 18 }
];

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
      label: "可进入下一关",
      hint: "观察完整度较好，建议补充页面样本或截图证据。"
    };
  }
  if (score >= 55) {
    return {
      label: "需要补证据",
      hint: "已有基本观察，继续补用户目标、路径和产品归因。"
    };
  }
  return {
    label: "等待提交",
    hint: "先填写关键字段，再生成阶段汇报卡。"
  };
}

function getRankLabel(score: number) {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 55) return "B";
  return "C";
}

function getProviderLabel(provider: CoachResponse["provider"]) {
  if (provider === "agnes") return "Agnes";
  if (provider === "openai") return "OpenAI";
  return "规则引导";
}

function getCoachActivityLabel(coachState: CoachState) {
  if (coachState.fallbackReason) return "规则兜底中";
  if (coachState.status === "loading") {
    if (coachState.mode === "final_report") return "整理报告中";
    if (coachState.mode === "post_submit_review") return "复盘提交中";
    if (coachState.mode === "guide_chat") return "回答问题中";
    return "阅读记录中";
  }
  if (coachState.status === "error") return "需要人工检查";
  if (coachState.provider === "rules") return "本地向导";
  return "模型向导";
}

function getBuilding(levelId: string) {
  return cityBuildings.find((building) => building.levelId === levelId) || cityBuildings[0];
}

function getNextAction(score: number, hasReportCard: boolean, hasNextLevel: boolean) {
  if (score < 55) {
    return "继续填写体验记录，先补齐关键观察。";
  }
  if (score < 80) {
    return "补充路径、证据和产品归因，再生成汇报卡。";
  }
  if (!hasReportCard) {
    return "生成阶段汇报卡，沉淀本关结论。";
  }
  return hasNextLevel ? "进入下一关，继续完成训练链路。" : "生成完整报告草稿，准备复盘输出。";
}

function buildReportCard(level: Level, submission: Submission) {
  const score = scoreSubmission(level, submission);
  const fields = getLevelFields(level);
  const missing = fields.filter((field) => !(submission.values[field] || "").trim());
  const evidence = fields
    .filter((field) => (submission.values[field] || "").trim())
    .slice(0, 4)
    .map((field) => `- ${field}：${submission.values[field]}`)
    .join("\n");

  return `关卡：${level.name}
完成状态：${score >= 80 ? "已完成初轮体验，可以进入下一关。" : "已提交部分观察，建议补充后再进入下一关。"}

核心观察：
围绕「${level.goal}」已经形成初步体验记录。当前材料最适合继续提炼用户路径、决策信息和产品机会。

证据材料：
${evidence || "- 暂无有效证据。"}

产品问题：
请继续把体感问题归因到路径、信息、动机、内容质量、交易承接或分发机制中的一种。

机会点：
${submission.values["产品机会"] || submission.values["评价缺口"] || submission.values["经营诊断机会"] || "待补充一个可验证的产品机会点。"}

待验证问题：
- 这个观察是否只来自个体体验，还是可能存在规模问题？
- 最大流失点发生在哪个页面或动作？
- 哪些数据可以验证这个问题的影响规模？

规则草稿评分：${score}/100
缺失字段：${missing.length ? missing.join("、") : "无"}

下一关建议：
${level.passCriteria.map((item) => `- ${item}`).join("\n")}`;
}

function buildFullReport(state: AppState) {
  const sections = levels.map((level) => {
    const values = state.submissions[level.id]?.values || {};
    const lines = getLevelFields(level)
      .map((field) => `- ${field}：${values[field] || "待补充"}`)
      .join("\n");
    return `## ${level.name}\n\n训练视角：${level.perspective}\n\n${lines}\n`;
  });

  return `# 抖音生活服务评价体验报告：从看评消费到评价生产

## 背景与体验范围

本报告来自「生活服务新人闯关训练」MVP，围绕消费者看评、评价生产、创作者路径、商家价值和平台分发进行结构化体验。

${sections.join("\n")}
## 产品机会点汇总

- 提升内容到 POI、评价、团购和收藏/规划的转化效率。
- 补充活动型 POI 和周末目的地供给。
- 建立评价质量 rubric，区分决策有用和内容丰富。

## 后续待验证问题

- 用户从内容页进入 POI/团购/评价的最大流失点在哪里？
- 商品评价和地点评价分别承担什么决策角色？
- 哪些评价适合被高权重分发？
`;
}

export default function QuestPage() {
  const [state, setState] = useState<AppState>(() => cloneDefaultState());
  const [isHydrated, setIsHydrated] = useState(false);
  const [autosaveText, setAutosaveText] = useState("未保存");
  const [reportCard, setReportCard] = useState("");
  const [reportCardStatus, setReportCardStatus] = useState("尚未生成");
  const [reportOutput, setReportOutput] = useState("");
  const [coachInput, setCoachInput] = useState("");
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([
    {
      id: "guide-welcome",
      sender: "guide",
      text: "我是阿引。你可以直接问我这一关怎么做、现在缺什么，或者让帮你把观察整理成产品机会。",
      provider: "rules"
    }
  ]);
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
    messageMarkdown: "正在读取本关任务。先查看任务目标，再填写真实体验记录。",
    followUpQuestions: [],
    nextAction: "先完成 2-3 个关键字段。",
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
  const activeBuilding = getBuilding(activeLevel.id);
  const canAdvance = activeScore >= 80;
  const completedCount = levels.filter((level) => isComplete(level, state.submissions[level.id])).length;
  const percent = Math.round((completedCount / levels.length) * 100);
  const nextAction = getNextAction(activeScore, Boolean(reportCard), Boolean(nextLevel));
  const coachProviderLabel = getProviderLabel(coachState.provider);
  const coachActivityLabel = getCoachActivityLabel(coachState);

  useEffect(() => {
    setAutosaveText(activeSubmission.updatedAt ? `已保存 ${formatTime(activeSubmission.updatedAt)}` : "未保存");
  }, [activeLevel.id, activeSubmission.updatedAt]);

  useEffect(() => {
    if (!isHydrated) return;
    void requestCoach("pre_submit_hint");
  }, [isHydrated, activeLevel.id]);

  function updateState(updater: (current: AppState) => AppState) {
    setState((current) => updater(current));
  }

  function persistField(field: string, value: string) {
    updateState((current) => {
      const submission = getSubmission(current, activeLevel.id);
      const nextSubmission: Submission = {
        ...submission,
        values: {
          ...submission.values,
          [field]: value.trim()
        },
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
    setAutosaveText("已自动保存");
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

  async function requestCoach(mode: CoachMode, options?: { sessionId?: string; userQuestion?: string }) {
    setCoachState((current) => ({
      ...current,
      status: "loading",
      mode,
      reportMarkdown: undefined,
      fallbackReason: undefined,
      messageMarkdown:
        mode === "final_report"
          ? "阿引正在整理完整体验报告..."
          : mode === "post_submit_review"
            ? "阿引正在复盘本关提交..."
            : mode === "guide_chat"
              ? "阿引正在回答你的问题..."
            : "阿引正在阅读你的体验记录..."
    }));

    try {
      const response = await fetch("/api/quest/coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId: options?.sessionId || backendSessionId || undefined,
          activeLevelId: state.activeLevelId,
          levelId: activeLevel.id,
          values: activeSubmission.values,
          score: activeScore,
          mode,
          userQuestion: options?.userQuestion,
          submissions: state.submissions
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
          provider: nextCoachState.provider,
          fallbackReason: nextCoachState.fallbackReason
        }
      ]);

      if (mode === "post_submit_review" && nextCoachState.reportMarkdown) {
        setReportCard(nextCoachState.reportMarkdown);
        setReportCardStatus(
          nextCoachState.fallbackReason
            ? "导师点评已生成并入库（规则兜底）"
            : `导师点评已生成并入库（${getProviderLabel(nextCoachState.provider)}）`
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
        messageMarkdown: message,
        followUpQuestions: ["先确认本地 dev server 正在运行。", "如果启用了模型 provider，请检查后端环境变量。"],
        nextAction: "可以继续填写体验记录；本地保存不会受影响。"
      }));
      setCoachMessages((current) => [
        ...current,
        {
          id: `guide-error-${Date.now()}`,
          sender: "guide",
          text: message,
          provider: "rules"
        }
      ]);

      throw error;
    }
  }

  async function askGuide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = coachInput.trim();
    if (!question || coachState.status === "loading") return;

    setCoachInput("");
    setCoachMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        sender: "user",
        text: question
      }
    ]);
    await requestCoach("guide_chat", { userQuestion: question });
  }

  async function generateFullReport() {
    const result = await requestCoach("final_report");
    const report = result.reportMarkdown || buildFullReport(state);
    setReportOutput(report);
    return report;
  }

  async function copyReportCard() {
    const nextReportCard = reportCard.trim() ? reportCard : (await requestCoach("post_submit_review")).reportMarkdown || "";
    const text = nextReportCard.trim() ? nextReportCard : buildReportCard(activeLevel, activeSubmission);
    await navigator.clipboard.writeText(text.trim());
    setReportCardStatus("已复制到剪贴板");
    setAutosaveText("汇报卡已复制");
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
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Quest Board / 新人训练副本</div>
          <h1>生活服务新人闯关训练</h1>
        </div>
        <div className="hero-stats" aria-label="当前闯关状态">
          <div>
            <span>当前等级</span>
            <strong>{activeLevel.id}</strong>
          </div>
          <div>
            <span>训练 XP</span>
            <strong>{activeScore}/100</strong>
          </div>
          <div>
            <span>完成进度</span>
            <strong>{percent}%</strong>
          </div>
        </div>
      </header>

      <section className="status-band">
        <div>
          <span className="status-label">主线任务</span>
          <strong>抖音生活服务评价生产与看评消费体验</strong>
        </div>
        <div>
          <span className="status-label">通关</span>
          <strong>{completedCount}/{levels.length}</strong>
        </div>
        <div>
          <span className="status-label">徽章</span>
          <strong>{activeLevel.badge}</strong>
        </div>
        <div>
          <span className="status-label">下一步指令</span>
          <strong>{nextAction}</strong>
        </div>
        <div>
          <span className="status-label">后端数据库</span>
          <strong>
            {databaseConfigured === null || databaseUrlValid === null
              ? "检查中"
              : databaseConfigured && databaseUrlValid
                ? "已配置"
                : "需修正"}
          </strong>
        </div>
        <div className="progress-cell">
          <span className="status-label">副本进度</span>
          <div className="progress-track" aria-label="完成进度">
            <div style={{ width: `${percent}%` }} />
          </div>
        </div>
      </section>

      <main className="workspace">
        <nav className="level-map" aria-label="关卡地图">
          <div className="panel-heading">
            <h2>闯关地图</h2>
            <span>6 个任务点</span>
          </div>
          <div className="level-list">
            {levels.map((level, index) => {
              const completed = isComplete(level, state.submissions[level.id]);
              const active = level.id === state.activeLevelId;
              return (
                <button
                  className={`level-item ${active ? "active" : ""} ${completed ? "completed" : ""}`}
                  type="button"
                  key={level.id}
                  onClick={() => switchLevel(level.id)}
                  aria-current={active ? "step" : undefined}
                >
                  <span className="level-index">LV{index + 1}</span>
                  <span>
                    <strong>{level.name}</strong>
                    <small>{level.perspective} · {level.estimatedMinutes} 分钟</small>
                  </span>
                  <span className="level-state">{completed ? "CLEAR" : active ? "ACTIVE" : "OPEN"}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <section className="task-panel">
          <section className="city-stage" aria-label="生活服务城场景地图">
            <div className="city-header">
              <div>
                <span className="scene-kicker">Life Service City</span>
                <h2>生活服务城</h2>
              </div>
              <div className="scene-status">
                <span>{activeBuilding.name}</span>
                <strong>{activeLevel.name}</strong>
              </div>
            </div>
            <div className="city-map">
              <div className="city-ground" />
              <div className="city-road road-main" />
              <div className="city-road road-cross" />
              <div className="city-road road-diagonal-one" />
              <div className="city-road road-diagonal-two" />
              <div className="city-plaza" />
              {cityBuildings.map((building) => {
                const level = levels.find((item) => item.id === building.levelId) || levels[0];
                const completed = isComplete(level, state.submissions[level.id]);
                const active = building.levelId === activeLevel.id;
                return (
                  <button
                    className={`city-building ${building.className} ${active ? "active" : ""} ${completed ? "completed" : ""}`}
                    key={building.levelId}
                    style={{ left: `${building.x}%`, top: `${building.y}%` }}
                    type="button"
                    onClick={() => switchLevel(building.levelId)}
                    aria-label={`${building.name}：${level.name}`}
                  >
                    <span className="building-level">{building.levelId}</span>
                    <span className="building-art" aria-hidden="true">
                      <span className="building-roof" />
                      <span className="building-body">
                        <span className="building-door" />
                      </span>
                    </span>
                    <span className="building-label">
                      <strong>{building.name}</strong>
                      <small>{completed ? "CLEAR" : active ? "ACTIVE" : "OPEN"}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="task-header">
            <div>
              <span className="pill">MISSION {activeLevel.id} · {activeLevel.perspective} · {activeLevel.estimatedMinutes} 分钟</span>
              <h2>{activeLevel.name}</h2>
            </div>
            <div className="task-actions">
              <button className="ghost-button" type="button" onClick={saveProgress}>
                保存本地
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={saveToBackend}
                disabled={backendSaveState.status === "saving" || backendSaveState.status === "checking"}
              >
                {backendSaveState.status === "saving" ? "写入中..." : "保存并验证入库"}
              </button>
            </div>
          </div>

          <div className={`backend-status ${backendSaveState.status}`}>
            <div>
              <strong>{backendSaveState.message}</strong>
              <span>当前关卡：{activeLevel.id}</span>
            </div>
            <dl>
              <div>
                <dt>Session</dt>
                <dd>{backendSessionId || "尚未创建"}</dd>
              </div>
              <div>
                <dt>字段数</dt>
                <dd>{backendSaveState.savedFieldCount ?? Object.keys(activeSubmission.values).length}</dd>
              </div>
              <div>
                <dt>保存时间</dt>
                <dd>{backendSaveState.savedAt ? new Date(backendSaveState.savedAt).toLocaleString() : "尚未保存"}</dd>
              </div>
            </dl>
          </div>

          <div className="task-card">
            <h3>任务目标</h3>
            <p>{activeLevel.goal}</p>
            <h3>主线任务</h3>
            <p>{activeLevel.mainTask}</p>
          </div>

          <div className="task-card">
            <div className="section-title">
              <h3>体验记录</h3>
              <span>{autosaveText}</span>
            </div>
            <form className="submission-form">
              {activeLevel.sections
                ? activeLevel.sections.map((section) => (
                    <fieldset className="field-group" key={section.title}>
                      <legend>{section.title}</legend>
                      {section.fields.map((field) => (
                        <Field
                          key={field}
                          field={field}
                          value={activeSubmission.values[field] || ""}
                          onChange={(value) => persistField(field, value)}
                        />
                      ))}
                    </fieldset>
                  ))
                : getLevelFields(activeLevel).map((field) => (
                    <Field
                      key={field}
                      field={field}
                      value={activeSubmission.values[field] || ""}
                      onChange={(value) => persistField(field, value)}
                    />
                  ))}
            </form>
          </div>

          <div className="task-card">
            <h3>通过标准</h3>
            <ul className="criteria-list">
              {activeLevel.passCriteria.map((criterion) => (
                <li key={criterion}>{criterion}</li>
              ))}
            </ul>
          </div>
        </section>

        <aside className="coach-panel">
          <div className="panel-heading">
            <h2>Game Master / NPC 教练</h2>
            <span>RANK {activeRank}</span>
          </div>
          <div className={`guide-card ${coachState.status}`}>
            <div className="guide-avatar-frame">
              <img src="/characters/ayin-guide.webp" alt="阿引，生活服务新人闯关训练的 Game Master 向导" />
            </div>
            <div className="guide-profile">
              <span className="guide-kicker">虚拟向导</span>
              <strong>{coachState.roleName}</strong>
              <p>陪你把真实体验记录沉淀成产品判断。</p>
              <div className="guide-meta">
                <span className={`provider-badge ${coachState.provider}`}>{coachProviderLabel}</span>
                <span>{coachActivityLabel}</span>
              </div>
            </div>
          </div>
          <div className="guide-context">
            <span>{activeBuilding.name} · {activeBuilding.district}</span>
            <strong>{scoreCopy.label}</strong>
            <p>{scoreCopy.hint}</p>
          </div>

          <div className={`guide-chat ${coachState.status}`}>
            <div className="guide-messages" aria-live="polite">
              {coachMessages.slice(-6).map((message) => (
                <div className={`guide-message ${message.sender}`} key={message.id}>
                  <span>{message.sender === "user" ? "你" : coachState.roleName}</span>
                  <p>{message.text}</p>
                  {message.fallbackReason ? <small>{message.fallbackReason}</small> : null}
                </div>
              ))}
            </div>

            <form className="guide-input-row" onSubmit={askGuide}>
              <input
                value={coachInput}
                onChange={(event) => setCoachInput(event.target.value)}
                placeholder="直接问阿引：这一关怎么做？现在缺什么？"
                disabled={coachState.status === "loading"}
              />
              <button className="primary-button" type="submit" disabled={!coachInput.trim() || coachState.status === "loading"}>
                发送
              </button>
            </form>
          </div>

          <div className="guide-quick-actions">
            <button className="secondary-button" type="button" onClick={() => void requestCoach("post_submit_review")} disabled={coachState.status === "loading"}>
              点评本关
            </button>
            <button className="ghost-button" type="button" onClick={() => void generateFullReport()} disabled={coachState.status === "loading"}>
              生成报告
            </button>
            <button className="primary-button" type="button" onClick={goToNextLevel} disabled={!nextLevel || !canAdvance}>
              {nextLevel ? "下一关" : "已完成"}
            </button>
          </div>

          <div className={`report-status ${coachState.status === "ready" || reportCard ? "ready" : ""}`}>
            {coachState.status === "loading" ? "阿引正在处理" : reportCardStatus}
          </div>

          {reportCard || reportOutput ? (
            <details className="guide-artifacts">
              <summary>查看可复制产物</summary>
              {reportCard ? (
                <section>
                  <div className="artifact-heading">
                    <strong>阶段点评</strong>
                    <button className="text-button" type="button" onClick={copyReportCard}>
                      复制
                    </button>
                  </div>
                  <pre>{reportCard}</pre>
                </section>
              ) : null}
              {reportOutput ? (
                <section>
                  <div className="artifact-heading">
                    <strong>报告草稿</strong>
                    <button className="text-button" type="button" onClick={copyReport}>
                      复制
                    </button>
                  </div>
                  <pre>{reportOutput}</pre>
                </section>
              ) : null}
            </details>
          ) : null}
        </aside>
      </main>
    </div>
  );
}

function Field({
  field,
  value,
  onChange
}: {
  field: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `field-${field}`;
  return (
    <div className="field">
      <label htmlFor={id}>{field}</label>
      <textarea
        id={id}
        data-field={field}
        value={value}
        placeholder="填写你的真实体验观察"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
