"use client";

import { CSSProperties, useEffect, useMemo, useState } from "react";
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

function loadStoredState(): AppState {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return cloneDefaultState();
    return JSON.parse(raw) as AppState;
  } catch {
    return cloneDefaultState();
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

  useEffect(() => {
    const nextState = loadStoredState();
    setState(nextState);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [isHydrated, state]);

  const activeLevel = useMemo(
    () => levels.find((level) => level.id === state.activeLevelId) || levels[0],
    [state.activeLevelId]
  );
  const activeSubmission = getSubmission(state, activeLevel.id);
  const activeScore = scoreSubmission(activeLevel, activeSubmission);
  const scoreCopy = getScoreLabel(activeScore);
  const activeLevelIndex = levels.findIndex((level) => level.id === activeLevel.id);
  const nextLevel = levels[activeLevelIndex + 1];
  const canAdvance = activeScore >= 80;
  const completedCount = levels.filter((level) => isComplete(level, state.submissions[level.id])).length;
  const percent = Math.round((completedCount / levels.length) * 100);
  const nextAction = getNextAction(activeScore, Boolean(reportCard), Boolean(nextLevel));

  useEffect(() => {
    setAutosaveText(activeSubmission.updatedAt ? `已保存 ${formatTime(activeSubmission.updatedAt)}` : "未保存");
  }, [activeLevel.id, activeSubmission.updatedAt]);

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

  function generateReportCard() {
    const card = buildReportCard(activeLevel, activeSubmission);
    setReportCard(card);
    setReportCardStatus(canAdvance ? "已生成，可复制或进入下一关" : "已生成，建议补充后再进入下一关");
    return card;
  }

  function generateFullReport() {
    const report = buildFullReport(state);
    setReportOutput(report);
    return report;
  }

  async function copyReportCard() {
    const text = reportCard.trim() ? reportCard : generateReportCard();
    await navigator.clipboard.writeText(text.trim());
    setReportCardStatus("已复制到剪贴板");
    setAutosaveText("汇报卡已复制");
  }

  async function copyReport() {
    const text = reportOutput.trim() ? reportOutput : generateFullReport();
    await navigator.clipboard.writeText(text);
    setAutosaveText("报告已复制");
  }

  function goToNextLevel() {
    if (!nextLevel || !canAdvance) return;
    switchLevel(nextLevel.id);
  }

  const scoreRingStyle: CSSProperties = {
    background: `conic-gradient(var(--accent) ${activeScore * 3.6}deg, #d9e2e8 0deg)`
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Life Service Onboarding Quest</div>
          <h1>生活服务新人闯关训练</h1>
        </div>
      </header>

      <section className="status-band">
        <div>
          <span className="status-label">主题</span>
          <strong>抖音生活服务评价生产与看评消费体验</strong>
        </div>
        <div>
          <span className="status-label">完成</span>
          <strong>{completedCount}/{levels.length}</strong>
        </div>
        <div>
          <span className="status-label">当前徽章</span>
          <strong>{activeLevel.badge}</strong>
        </div>
        <div>
          <span className="status-label">当前下一步</span>
          <strong>{nextAction}</strong>
        </div>
        <div className="progress-track" aria-label="完成进度">
          <div style={{ width: `${percent}%` }} />
        </div>
      </section>

      <main className="workspace">
        <nav className="level-map" aria-label="关卡地图">
          <div className="panel-heading">
            <h2>闯关地图</h2>
            <span>标准版</span>
          </div>
          <div className="level-list">
            {levels.map((level, index) => {
              const completed = isComplete(level, state.submissions[level.id]);
              return (
                <button
                  className={`level-item ${level.id === state.activeLevelId ? "active" : ""}`}
                  type="button"
                  key={level.id}
                  onClick={() => switchLevel(level.id)}
                >
                  <span className="level-index">{index + 1}</span>
                  <span>
                    <strong>{level.name}</strong>
                    <small>{level.perspective} · {level.estimatedMinutes} 分钟</small>
                  </span>
                  <span className="level-state">{completed ? "已完成" : "未完成"}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <section className="task-panel">
          <div className="task-header">
            <div>
              <span className="pill">{activeLevel.id} · {activeLevel.perspective} · {activeLevel.estimatedMinutes} 分钟</span>
              <h2>{activeLevel.name}</h2>
            </div>
            <button className="primary-button" type="button" onClick={saveProgress}>
              保存进度
            </button>
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
            <h2>教练面板</h2>
            <span>{activeScore} 分</span>
          </div>
          <div className="score-box">
            <div className="score-ring" style={scoreRingStyle}>{activeScore}</div>
            <div>
              <strong>{scoreCopy.label}</strong>
              <p>{scoreCopy.hint}</p>
            </div>
          </div>
          <div className="coach-actions">
            <button className="secondary-button" type="button" onClick={generateReportCard}>
              生成阶段汇报卡
            </button>
            <button className="ghost-button" type="button" onClick={copyReportCard}>
              复制汇报卡
            </button>
            <button
              className="primary-button next-button"
              type="button"
              onClick={goToNextLevel}
              disabled={!nextLevel || !canAdvance}
            >
              {nextLevel ? "进入下一关" : "已到最后一关"}
            </button>
          </div>
          <div className={`report-status ${reportCard ? "ready" : ""}`}>{reportCardStatus}</div>
          <div className="report-card">
            {reportCard ? reportCard : <p className="muted">阶段汇报卡会显示在这里。</p>}
          </div>

          <div className="report-panel">
            <div className="panel-heading compact">
              <div>
                <h2>最终报告草稿</h2>
                <span>完成多关后再生成</span>
              </div>
              <div className="inline-actions">
                <button className="text-button" type="button" onClick={generateFullReport}>
                  生成
                </button>
                <button className="text-button" type="button" onClick={copyReport}>
                  复制
                </button>
              </div>
            </div>
            <textarea readOnly value={reportOutput} placeholder="完成关卡后生成 Markdown 报告草稿" />
          </div>
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
