const levels = [
  {
    id: "L1",
    name: "找店迷宫",
    perspective: "消费者",
    badge: "消费决策侦探",
    estimatedMinutes: 30,
    goal: "代入真实消费需求，体验从需求产生到选择商户的完整链路。",
    mainTask: "选择一个真实消费需求，从抖音内自然搜索或刷到内容，记录完整决策路径。",
    output: ["消费需求", "入口", "完整路径", "关键决策节点", "评价出现位置", "最大卡点", "产品机会"],
    passCriteria: ["路径不少于 4 个节点", "至少记录 2 个决策点", "至少提出 1 个评价相关问题"]
  },
  {
    id: "L2",
    name: "看评裁判所",
    perspective: "看评用户",
    badge: "评价质量鉴定师",
    estimatedMinutes: 40,
    goal: "判断什么样的评价真正帮助消费决策。",
    mainTask: "选择 3 个商户或商品页面，每个页面分析 2 条有用评价和 2 条无用评价。",
    sections: [
      {
        title: "样本对象 1",
        fields: ["样本对象 1", "有用评价 1", "有用原因 1", "无用评价 1", "无用原因 1", "评价缺口 1"]
      },
      {
        title: "样本对象 2",
        fields: ["样本对象 2", "有用评价 2", "有用原因 2", "无用评价 2", "无用原因 2", "评价缺口 2"]
      },
      {
        title: "样本对象 3",
        fields: ["样本对象 3", "有用评价 3", "有用原因 3", "无用评价 3", "无用原因 3", "评价缺口 3"]
      },
      {
        title: "归纳",
        fields: ["评价质量规则", "决策影响"]
      }
    ],
    output: [
      "样本对象 1", "有用评价 1", "有用原因 1", "无用评价 1", "无用原因 1", "评价缺口 1",
      "样本对象 2", "有用评价 2", "有用原因 2", "无用评价 2", "无用原因 2", "评价缺口 2",
      "样本对象 3", "有用评价 3", "有用原因 3", "无用评价 3", "无用原因 3", "评价缺口 3",
      "评价质量规则", "决策影响"
    ],
    passCriteria: ["至少分析 6 条评价", "能区分内容丰富和决策有用", "形成 1 条评价质量判断规则"]
  },
  {
    id: "L3",
    name: "团购商品实验室",
    perspective: "商品/交易用户",
    badge: "商品评价拆解师",
    estimatedMinutes: 30,
    goal: "理解商品评价和地点评价的差异。",
    mainTask: "找一个团购商品或套餐，对比商品页评价和门店/POI 评价。",
    output: ["商品/套餐", "对应地点", "商品评价关注点", "地点评价关注点", "二者重叠点", "二者缺口", "产品机会"],
    passCriteria: ["明确商品评价和地点评价至少 3 个差异", "提出 1 个商品评价结构化机会"]
  },
  {
    id: "L4",
    name: "创作者通道",
    perspective: "创作者/达人",
    badge: "创作者路径观察员",
    estimatedMinutes: 30,
    goal: "理解达人内容、普通评价和交易转化之间的关系。",
    mainTask: "从一条生活服务短视频或直播入口出发，观察内容如何把你带到商品或商户。",
    output: ["内容入口", "内容类型", "交易入口", "评价入口", "达人内容的作用", "普通评价的作用", "信任断点", "产品机会"],
    passCriteria: ["画出从内容到交易的路径", "明确达人内容和普通评价的角色差异"]
  },
  {
    id: "L5",
    name: "商家镜像",
    perspective: "商家",
    badge: "商家经营翻译官",
    estimatedMinutes: 30,
    goal: "从商家视角反推评价的经营价值。",
    mainTask: "选择一个商户页面，假设你是商家，判断哪些评价信息会影响经营动作。",
    output: ["商户类型", "评价主要反馈", "商家可行动信息", "商家无法判断的信息", "商家回复体验", "经营诊断机会"],
    passCriteria: ["至少提出 3 类商家可行动信息", "区分展示给用户的评价和给商家的经营反馈"]
  },
  {
    id: "L6",
    name: "平台分发台",
    perspective: "平台",
    badge: "平台分发裁判",
    estimatedMinutes: 40,
    goal: "建立一套评价质量和分发价值的初版 rubric。",
    mainTask: "挑选 10 条评价，按可信度、相关性、信息量、可读性、图文辅助和决策帮助打分。",
    output: ["评价样本数量", "高分评价共同点", "低分评价共同点", "可能被激励污染的信号", "适合分发的评价标准", "不适合分发的评价标准"],
    passCriteria: ["输出不少于 5 条评价质量规则", "能解释为什么某些评价不应高权重分发"]
  }
];

const storageKey = "life_service_onboarding_quest_state_v1";
const productWords = ["路径", "信息", "动机", "评价", "交易", "POI", "poi", "转化", "供给", "质量", "决策", "用户", "商家", "分发", "内容"];

let state = loadState();

const nodes = {
  levelList: document.querySelector("#levelList"),
  progressText: document.querySelector("#progressText"),
  progressBar: document.querySelector("#progressBar"),
  badgeText: document.querySelector("#badgeText"),
  levelMeta: document.querySelector("#levelMeta"),
  levelTitle: document.querySelector("#levelTitle"),
  levelGoal: document.querySelector("#levelGoal"),
  levelMainTask: document.querySelector("#levelMainTask"),
  submissionForm: document.querySelector("#submissionForm"),
  criteriaList: document.querySelector("#criteriaList"),
  saveBtn: document.querySelector("#saveBtn"),
  autosaveText: document.querySelector("#autosaveText"),
  generateCardBtn: document.querySelector("#generateCardBtn"),
  reportCard: document.querySelector("#reportCard"),
  scoreRing: document.querySelector("#scoreRing"),
  scoreText: document.querySelector("#scoreText"),
  scoreLabel: document.querySelector("#scoreLabel"),
  scoreHint: document.querySelector("#scoreHint"),
  generateReportBtn: document.querySelector("#generateReportBtn"),
  reportOutput: document.querySelector("#reportOutput"),
  copyCardBtn: document.querySelector("#copyCardBtn"),
  importDemoBtn: document.querySelector("#importDemoBtn"),
  copyReportBtn: document.querySelector("#copyReportBtn"),
  exportJsonBtn: document.querySelector("#exportJsonBtn"),
  resetBtn: document.querySelector("#resetBtn")
};

function loadState() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return { activeLevelId: "L1", submissions: {} };
    }
    return JSON.parse(raw);
  } catch {
    return { activeLevelId: "L1", submissions: {} };
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function activeLevel() {
  return levels.find((level) => level.id === state.activeLevelId) || levels[0];
}

function submissionFor(levelId) {
  if (!state.submissions[levelId]) {
    state.submissions[levelId] = {
      levelId,
      values: {},
      updatedAt: new Date().toISOString()
    };
  }
  return state.submissions[levelId];
}

function render() {
  renderLevelList();
  renderProgress();
  renderActiveLevel();
  renderCoach();
}

function renderLevelList() {
  nodes.levelList.innerHTML = "";
  levels.forEach((level, index) => {
    const submission = state.submissions[level.id];
    const completed = isComplete(level, submission);
    const button = document.createElement("button");
    button.className = `level-item ${level.id === state.activeLevelId ? "active" : ""}`;
    button.type = "button";
    button.innerHTML = `
      <span class="level-index">${index + 1}</span>
      <span>
        <strong>${level.name}</strong>
        <small>${level.perspective} · ${level.estimatedMinutes} 分钟</small>
      </span>
      <span class="level-state">${completed ? "已完成" : "未完成"}</span>
    `;
    button.addEventListener("click", () => {
      persistForm();
      state.activeLevelId = level.id;
      saveState();
      render();
    });
    nodes.levelList.appendChild(button);
  });
}

function renderProgress() {
  const completedCount = levels.filter((level) => isComplete(level, state.submissions[level.id])).length;
  const percent = Math.round((completedCount / levels.length) * 100);
  nodes.progressText.textContent = `${completedCount}/${levels.length}`;
  nodes.progressBar.style.width = `${percent}%`;
  nodes.badgeText.textContent = activeLevel().badge;
}

function renderActiveLevel() {
  const level = activeLevel();
  const submission = submissionFor(level.id);
  nodes.levelMeta.textContent = `${level.id} · ${level.perspective} · ${level.estimatedMinutes} 分钟`;
  nodes.levelTitle.textContent = level.name;
  nodes.levelGoal.textContent = level.goal;
  nodes.levelMainTask.textContent = level.mainTask;

  nodes.submissionForm.innerHTML = "";
  if (level.sections) {
    level.sections.forEach((section) => {
      const fieldset = document.createElement("fieldset");
      fieldset.className = "field-group";
      const legend = document.createElement("legend");
      legend.textContent = section.title;
      fieldset.appendChild(legend);
      section.fields.forEach((field) => fieldset.appendChild(createField(field, submission.values[field] || "")));
      nodes.submissionForm.appendChild(fieldset);
    });
  } else {
    getLevelFields(level).forEach((field) => {
      nodes.submissionForm.appendChild(createField(field, submission.values[field] || ""));
    });
  }

  function createField(field, value) {
    const wrapper = document.createElement("div");
    wrapper.className = "field";
    const id = `field-${field}`;
    wrapper.innerHTML = `
      <label for="${id}">${field}</label>
      <textarea id="${id}" data-field="${field}" placeholder="填写你的真实体验观察"></textarea>
    `;
    const textarea = wrapper.querySelector("textarea");
    textarea.value = value;
    textarea.addEventListener("input", () => {
      persistForm();
      nodes.autosaveText.textContent = "已自动保存";
      renderCoach();
      renderProgress();
      renderLevelList();
    });
    return wrapper;
  }

  nodes.criteriaList.innerHTML = "";
  level.passCriteria.forEach((criterion) => {
    const li = document.createElement("li");
    li.textContent = criterion;
    nodes.criteriaList.appendChild(li);
  });
  nodes.autosaveText.textContent = submission.updatedAt ? `已保存 ${formatTime(submission.updatedAt)}` : "未保存";
}

function renderCoach() {
  const level = activeLevel();
  const submission = submissionFor(level.id);
  const score = scoreSubmission(level, submission);
  setScore(score);
}

function persistForm() {
  const level = activeLevel();
  const submission = submissionFor(level.id);
  nodes.submissionForm.querySelectorAll("textarea").forEach((textarea) => {
    submission.values[textarea.dataset.field] = textarea.value.trim();
  });
  submission.updatedAt = new Date().toISOString();
  submission.score = scoreSubmission(level, submission);
  saveState();
}

function isComplete(level, submission) {
  if (!submission) return false;
  const fields = getLevelFields(level);
  const filled = fields.filter((field) => (submission.values[field] || "").trim().length > 0);
  return filled.length >= Math.ceil(fields.length * 0.7);
}

function scoreSubmission(level, submission) {
  if (!submission) return 0;
  const fields = getLevelFields(level);
  const values = fields.map((field) => submission.values[field] || "");
  const filledRatio = values.filter(Boolean).length / fields.length;
  const text = values.join("\n");
  const lengthScore = Math.min(text.length / 700, 1);
  const keywordHits = productWords.filter((word) => text.includes(word)).length;
  const keywordScore = Math.min(keywordHits / 8, 1);
  const opportunityScore = /机会|优化|建议|产品|转化|补充|提升/.test(text) ? 1 : 0;
  return Math.round(filledRatio * 45 + lengthScore * 20 + keywordScore * 25 + opportunityScore * 10);
}

function getLevelFields(level) {
  if (level.sections) {
    return level.sections.flatMap((section) => section.fields);
  }
  return level.output;
}

function setScore(score) {
  nodes.scoreRing.textContent = score;
  nodes.scoreRing.style.background = `conic-gradient(var(--accent) ${score * 3.6}deg, #d9e2e8 0deg)`;
  nodes.scoreText.textContent = `${score} 分`;
  if (score >= 80) {
    nodes.scoreLabel.textContent = "可进入下一关";
    nodes.scoreHint.textContent = "观察完整度较好，建议补充页面样本或截图证据。";
  } else if (score >= 55) {
    nodes.scoreLabel.textContent = "需要补证据";
    nodes.scoreHint.textContent = "已有基本观察，继续补用户目标、路径和产品归因。";
  } else {
    nodes.scoreLabel.textContent = "等待提交";
    nodes.scoreHint.textContent = "先填写关键字段，再生成阶段汇报卡。";
  }
}

function generateReportCard() {
  persistForm();
  const level = activeLevel();
  const submission = submissionFor(level.id);
  const score = scoreSubmission(level, submission);
  const fields = getLevelFields(level);
  const missing = fields.filter((field) => !(submission.values[field] || "").trim());
  const evidence = fields
    .filter((field) => (submission.values[field] || "").trim())
    .slice(0, 4)
    .map((field) => `- ${field}：${submission.values[field]}`)
    .join("\n");
  const card = `关卡：${level.name}
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

AI 草稿评分：${score}/100
缺失字段：${missing.length ? missing.join("、") : "无"}

下一关建议：
${level.passCriteria.map((item) => `- ${item}`).join("\n")}`;
  nodes.reportCard.textContent = card;
}

function generateFullReport() {
  persistForm();
  const sections = levels.map((level) => {
    const submission = state.submissions[level.id];
    const values = submission?.values || {};
    const lines = getLevelFields(level)
      .map((field) => `- ${field}：${values[field] || "待补充"}`)
      .join("\n");
    return `## ${level.name}\n\n训练视角：${level.perspective}\n\n${lines}\n`;
  });
  const report = `# 抖音生活服务评价体验报告：从看评消费到评价生产

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
  nodes.reportOutput.value = report;
}

async function copyReportCard() {
  const text = nodes.reportCard.textContent.trim();
  if (!text || text === "阶段汇报卡会显示在这里。") {
    generateReportCard();
  }
  await navigator.clipboard.writeText(nodes.reportCard.textContent.trim());
  nodes.autosaveText.textContent = "汇报卡已复制";
}

function importTrialOneDemo() {
  state.activeLevelId = "L1";
  state.submissions.L1 = {
    levelId: "L1",
    updatedAt: new Date().toISOString(),
    values: {
      "消费需求": "周末和女朋友去哪儿吃喝玩乐",
      "入口": "小红书 App、大众点评 App、抖音 App",
      "完整路径": "先在小红书搜索上海周末去哪儿，寻找市集、快闪、公园、商场等周末去处；再打开大众点评和抖音搜索去处周边餐厅，比较餐厅方向、均价、评价和团购；最后到具体 POI 消费或体验，并对照线上信息是否符合预期。",
      "关键决策节点": "1. 被小红书种草周末去处；2. 在大众点评、抖音获取更具体的 POI 信息和评价，比对交易服务；3. 到现场验证线上信息是否准确。",
      "评价出现位置": "评价主要出现在大众点评和抖音的 POI 详情页。",
      "最大卡点": "抖音从种草内容到 POI、评价、团购和交易供给的连接弱。内容可能不挂 POI 锚点，用户需要记地点、二次搜索，甚至主动切到团购 tab。",
      "产品机会": "提升生活服务内容的 POI 锚点挂载率和准确率；补充周末活动/目的地供给；优化内容到 POI、评价、团购和收藏/规划的转化链路。"
    }
  };
  saveState();
  render();
  generateReportCard();
}

function exportJson() {
  persistForm();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  downloadBlob(blob, `onboarding-quest-${Date.now()}.json`);
}

async function copyReport() {
  if (!nodes.reportOutput.value.trim()) {
    generateFullReport();
  }
  await navigator.clipboard.writeText(nodes.reportOutput.value);
  nodes.autosaveText.textContent = "报告已复制";
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatTime(value) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

nodes.saveBtn.addEventListener("click", () => {
  persistForm();
  nodes.autosaveText.textContent = "已保存";
  render();
});

nodes.generateCardBtn.addEventListener("click", generateReportCard);
nodes.copyCardBtn.addEventListener("click", copyReportCard);
nodes.generateReportBtn.addEventListener("click", generateFullReport);
nodes.exportJsonBtn.addEventListener("click", exportJson);
nodes.copyReportBtn.addEventListener("click", copyReport);
nodes.importDemoBtn.addEventListener("click", importTrialOneDemo);
nodes.resetBtn.addEventListener("click", () => {
  if (!confirm("确认清空本地闯关数据？")) return;
  localStorage.removeItem(storageKey);
  state = { activeLevelId: "L1", submissions: {} };
  nodes.reportCard.innerHTML = '<p class="muted">阶段汇报卡会显示在这里。</p>';
  nodes.reportOutput.value = "";
  render();
});

render();
