const variants = [
  { key: "A", name: "地图闯关" },
  { key: "B", name: "Game Master 控台" },
  { key: "C", name: "证据调查板" },
  { key: "D", name: "可交互融合版" }
];

const levels = [
  {
    id: 1,
    code: "L1",
    title: "找店迷宫",
    status: "调查中",
    mission: "代入「周末和女朋友去哪儿吃喝玩乐」，从灵感发现走到消费决策，找出内容、POI、评价、团购之间的断点。",
    winText: "解释清楚：为什么内容种草后没有顺滑进入 POI / 评价 / 交易。",
    cards: [
      ["goal", "用户目标", "不是单点找餐厅，而是先获得周末灵感，再完成地点、评价、团购和履约判断。"],
      ["breakpoint", "路径断点", "内容被种草后，如果没有挂 POI，用户要记地点、二次搜索，甚至切到团购 tab。"],
      ["hypothesis", "产品归因", "发现好去处能力与内容消费路径割裂，POI 锚点挂载率和准确性决定转化效率。"],
      ["sample", "页面样本", "补充内容页、搜索页、团购 tab 的 2-3 个页面样本，确认最大流失点。"]
    ]
  },
  {
    id: 2,
    code: "L2",
    title: "看评裁判所",
    status: "待解锁",
    mission: "选择 3 个 POI 或团购商品，判断评价是否能帮助消费决策，并区分有用评价与噪音评价。",
    winText: "形成评价质量判断：哪些信息真正改变了用户决策。",
    cards: [
      ["goal", "决策问题", "用户在下单前最关心价格、距离、排队、口味稳定性、履约风险中的哪一类。"],
      ["breakpoint", "评价噪音", "高赞评价可能很情绪化，但不一定回答具体消费问题。"],
      ["hypothesis", "质量标准", "好评价需要包含场景、对象、细节、约束和结论。"],
      ["sample", "评价样本", "收集至少 1 条有用评价和 1 条无用评价，对比差异。"]
    ]
  },
  {
    id: 3,
    code: "L3",
    title: "团购实验室",
    status: "锁定",
    mission: "比较商品评价和地点评价在交易前后的作用差异。",
    winText: "说明评价如何影响团购转化和履约预期。",
    cards: []
  },
  {
    id: 4,
    code: "L4",
    title: "创作者通道",
    status: "锁定",
    mission: "观察达人内容如何被挂载、分发和转化。",
    winText: "说明创作者内容到交易链路的关键摩擦。",
    cards: []
  },
  {
    id: 5,
    code: "L5",
    title: "商家镜像",
    status: "锁定",
    mission: "从经营视角反推评价生产的价值与成本。",
    winText: "说明商家为什么愿意或不愿意推动评价生产。",
    cards: []
  },
  {
    id: 6,
    code: "BOSS",
    title: "体验报告",
    status: "最终关",
    mission: "把所有关卡的证据链压缩成新人第一周产品体验报告。",
    winText: "输出可给 leader 看的问题、证据、判断和建议。",
    cards: []
  }
];

const evidenceLabels = {
  goal: "用户目标",
  breakpoint: "路径断点",
  hypothesis: "产品归因",
  sample: "页面样本"
};

const root = document.querySelector("#prototypeRoot");
const label = document.querySelector("#variantLabel");

const questState = {
  selectedLevel: 1,
  unlockedLevel: 1,
  collected: {
    1: [],
    2: []
  },
  notes: "",
  submittedLevels: []
};

function currentVariant() {
  const query = new URLSearchParams(location.search);
  const key = (query.get("variant") || "A").toUpperCase();
  return variants.some((variant) => variant.key === key) ? key : "A";
}

function setVariant(key) {
  const query = new URLSearchParams(location.search);
  query.set("variant", key);
  history.replaceState(null, "", `${location.pathname}?${query.toString()}`);
  render();
}

function cycle(direction) {
  const current = currentVariant();
  const index = variants.findIndex((variant) => variant.key === current);
  const next = variants[(index + direction + variants.length) % variants.length];
  setVariant(next.key);
}

function renderHeader(title, description) {
  return `
    <header class="screen-header">
      <div>
        <div class="kicker">新人闯关训练 · Interactive Prototype</div>
        <h1>${title}</h1>
        <p>${description}</p>
      </div>
      <div class="status-stack">
        <div class="status-pill">当前关卡：L${questState.selectedLevel}</div>
        <div class="status-pill">已解锁：${questState.unlockedLevel} / 6</div>
        <div class="status-pill">目标：体验报告</div>
      </div>
    </header>
  `;
}

function simpleVariant(title, description) {
  return `
    <section class="screen">
      ${renderHeader(title, description)}
      <div class="placeholder-panel">
        <h2>这个方向保留作对照</h2>
        <p>当前重点已经转到 D：可交互融合版。A/B/C 用来对比设计方向，不再作为主体验。</p>
      </div>
    </section>
  `;
}

function variantA() {
  return simpleVariant("地图闯关", "只解决进度感，不解决证据收集和过关判定。");
}

function variantB() {
  return simpleVariant("Game Master 控台", "适合做 AI 追问层，但不适合作为第一屏主结构。");
}

function variantC() {
  return simpleVariant("证据调查板", "能训练产品推理，但缺少关卡推进和解锁反馈。");
}

function variantD() {
  const level = levels.find((item) => item.id === questState.selectedLevel);
  const collected = questState.collected[level.id] || [];
  const checks = getChecks(level.id);
  const score = getScore(checks);
  const canSubmit = checks.every((item) => item.done);
  const nextLevel = Math.min(level.id + 1, levels.length);

  return `
    <section class="screen interactive-screen">
      ${renderHeader("生活服务新人调查局", "玩法闭环：选关卡、接任务、点选证据、写战报、提交过关、解锁下一关。页面右下角会展示完整状态，方便判断交互逻辑是否成立。")}
      <div class="interactive-layout">
        <aside class="level-rail" aria-label="关卡地图">
          <div class="rail-title">
            <h2>闯关地图</h2>
            <span>${questState.submittedLevels.length} 关已完成</span>
          </div>
          <div class="rail-list">
            ${levels.map(renderLevelButton).join("")}
          </div>
        </aside>

        <main class="mission-stage">
          <div class="mission-banner">
            <div>
              <span>${level.code} · ${level.status}</span>
              <h2>${level.title}</h2>
              <p>${level.mission}</p>
            </div>
            <div class="score-ring">
              <strong>${score}</strong>
              <span>通关分</span>
            </div>
          </div>

          <section class="play-area">
            <div class="play-head">
              <h3>1. 点击卡片收集证据</h3>
              <p>每张证据会进入右侧证据袋，并影响过关条件。</p>
            </div>
            <div class="action-card-grid">
              ${level.cards.length ? level.cards.map((card) => renderActionCard(level.id, card, collected)).join("") : renderLockedHint(level)}
            </div>
          </section>

          <section class="battle-report">
            <div class="play-head">
              <h3>2. 写一段本关战报</h3>
              <p>原型里只要求写够 20 个字。写完后保存一次，右侧会刷新过关判定。</p>
            </div>
            <textarea id="reportNotes" placeholder="例如：我从抖音搜索上海周末去哪儿，被内容种草后发现 POI 承接弱，需要二次搜索或切团购 tab，说明内容到消费决策的链路存在断点。">${escapeHtml(questState.notes)}</textarea>
            <button class="secondary-action" type="button" data-save-report>保存战报并刷新判定</button>
          </section>
        </main>

        <aside class="case-sidebar">
          <section class="evidence-bag">
            <h2>证据袋</h2>
            ${collected.length ? collected.map((type) => `<div class="bag-item">${evidenceLabels[type]}</div>`).join("") : `<p class="empty-text">还没有证据。先点击中间的证据卡。</p>`}
          </section>

          <section class="unlock-rules">
            <h2>过关判定</h2>
            ${checks.map((item) => check(item.text, item.done)).join("")}
          </section>

          <section class="gm-panel">
            <h2>AI Game Master 追问</h2>
            <p>${getGameMasterPrompt(checks, level)}</p>
          </section>

          <button class="primary-action" data-submit-level="${level.id}" ${canSubmit ? "" : "disabled"}>
            ${canSubmit ? `提交战报，解锁 L${nextLevel}` : "证据不足，暂不能过关"}
          </button>
        </aside>
      </div>

      <section class="state-debug">
        <h2>当前状态</h2>
        <pre>${JSON.stringify(getPublicState(), null, 2)}</pre>
      </section>
    </section>
  `;
}

function renderLevelButton(level) {
  const locked = level.id > questState.unlockedLevel;
  const active = level.id === questState.selectedLevel;
  const completed = questState.submittedLevels.includes(level.id);
  const classes = ["rail-node"];
  if (active) classes.push("active");
  if (locked) classes.push("locked");
  if (completed) classes.push("completed");

  return `
    <button class="${classes.join(" ")}" type="button" data-select-level="${level.id}" ${locked ? "disabled" : ""}>
      <span>${level.code}</span>
      <strong>${level.title}</strong>
      <small>${completed ? "已通关" : locked ? "未解锁" : level.status}</small>
    </button>
  `;
}

function renderActionCard(levelId, card, collected) {
  const [type, title, body] = card;
  const active = collected.includes(type);
  return `
    <button class="action-card ${active ? "collected" : ""}" type="button" data-toggle-evidence="${type}" data-level-id="${levelId}">
      <span>${active ? "已收集" : "可收集"}</span>
      <h3>${title}</h3>
      <p>${body}</p>
    </button>
  `;
}

function renderLockedHint(level) {
  return `
    <div class="locked-hint">
      <h3>${level.title} 还未展开</h3>
      <p>先跑通 L1 和 L2 的核心交互，再扩展后续关卡内容。</p>
    </div>
  `;
}

function getChecks(levelId) {
  const collected = questState.collected[levelId] || [];
  return [
    { text: "明确用户目标", done: collected.includes("goal") },
    { text: "找到路径断点", done: collected.includes("breakpoint") },
    { text: "形成产品归因", done: collected.includes("hypothesis") },
    { text: "补充页面样本", done: collected.includes("sample") },
    { text: "写出本关战报", done: questState.notes.trim().length >= 20 }
  ];
}

function getScore(checks) {
  return Math.round((checks.filter((item) => item.done).length / checks.length) * 100);
}

function getGameMasterPrompt(checks, level) {
  const missing = checks.find((item) => !item.done);
  if (!missing) return `${level.title} 的证据链已经闭合。提交后进入下一关，继续验证评价是否真的帮助消费决策。`;
  if (missing.text === "补充页面样本") return "现在的问题判断已经成立，但还缺页面样本。请补一个内容页或搜索页样本，否则这个结论容易停留在感受层。";
  if (missing.text === "写出本关战报") return "证据已经收集得差不多了。请用一句话写清楚：用户在哪一步卡住，为什么这对生活服务转化重要。";
  return `先补齐「${missing.text}」。不要急着写建议，先让证据链闭合。`;
}

function check(text, done) {
  return `<div class="check-row ${done ? "done" : ""}"><span>${done ? "✓" : "!"}</span><p>${text}</p></div>`;
}

function getPublicState() {
  return {
    selectedLevel: questState.selectedLevel,
    unlockedLevel: questState.unlockedLevel,
    collected: questState.collected,
    notesLength: questState.notes.trim().length,
    submittedLevels: questState.submittedLevels
  };
}

function syncReportDraft() {
  const textarea = document.querySelector("#reportNotes");
  if (textarea) questState.notes = textarea.value;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function render() {
  const key = currentVariant();
  const meta = variants.find((variant) => variant.key === key);
  label.textContent = `${meta.key} — ${meta.name}`;
  if (key === "A") root.innerHTML = variantA();
  if (key === "B") root.innerHTML = variantB();
  if (key === "C") root.innerHTML = variantC();
  if (key === "D") root.innerHTML = variantD();
}

document.querySelector("#prevVariant").addEventListener("click", () => cycle(-1));
document.querySelector("#nextVariant").addEventListener("click", () => cycle(1));

document.addEventListener("click", (event) => {
  const levelButton = event.target.closest("[data-select-level]");
  if (levelButton) {
    syncReportDraft();
    questState.selectedLevel = Number(levelButton.dataset.selectLevel);
    render();
    return;
  }

  const evidenceButton = event.target.closest("[data-toggle-evidence]");
  if (evidenceButton) {
    syncReportDraft();
    const levelId = Number(evidenceButton.dataset.levelId);
    const type = evidenceButton.dataset.toggleEvidence;
    const current = questState.collected[levelId] || [];
    questState.collected[levelId] = current.includes(type)
      ? current.filter((item) => item !== type)
      : [...current, type];
    render();
    return;
  }

  const submitButton = event.target.closest("[data-submit-level]");
  if (submitButton && !submitButton.disabled) {
    syncReportDraft();
    const levelId = Number(submitButton.dataset.submitLevel);
    if (!questState.submittedLevels.includes(levelId)) {
      questState.submittedLevels.push(levelId);
    }
    questState.unlockedLevel = Math.max(questState.unlockedLevel, Math.min(levelId + 1, levels.length));
    questState.selectedLevel = Math.min(levelId + 1, levels.length);
    questState.notes = "";
    render();
    return;
  }

  const saveReportButton = event.target.closest("[data-save-report]");
  if (saveReportButton) {
    syncReportDraft();
    render();
  }
});

document.addEventListener("keydown", (event) => {
  const tag = document.activeElement?.tagName;
  const editing = tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable;
  if (editing) return;
  if (event.key === "ArrowLeft") cycle(-1);
  if (event.key === "ArrowRight") cycle(1);
});

render();
