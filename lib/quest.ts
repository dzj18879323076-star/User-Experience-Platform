export type LevelSection = {
  title: string;
  fields: string[];
};

export type Level = {
  id: string;
  name: string;
  perspective: string;
  badge: string;
  estimatedMinutes: number;
  goal: string;
  mainTask: string;
  output: string[];
  passCriteria: string[];
  sections?: LevelSection[];
};

export type Submission = {
  levelId: string;
  values: Record<string, string>;
  updatedAt: string;
  score?: number;
};

export type AppState = {
  activeLevelId: string;
  submissions: Record<string, Submission>;
};

export const storageKey = "life_service_onboarding_quest_state_v1";

export const defaultState: AppState = {
  activeLevelId: "L1",
  submissions: {}
};

export const levels: Level[] = [
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
      "样本对象 1",
      "有用评价 1",
      "有用原因 1",
      "无用评价 1",
      "无用原因 1",
      "评价缺口 1",
      "样本对象 2",
      "有用评价 2",
      "有用原因 2",
      "无用评价 2",
      "无用原因 2",
      "评价缺口 2",
      "样本对象 3",
      "有用评价 3",
      "有用原因 3",
      "无用评价 3",
      "无用原因 3",
      "评价缺口 3",
      "评价质量规则",
      "决策影响"
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

const productWords = ["路径", "信息", "动机", "评价", "交易", "POI", "poi", "转化", "供给", "质量", "决策", "用户", "商家", "分发", "内容"];

export function getLevelFields(level: Level) {
  if (level.sections) {
    return level.sections.flatMap((section) => section.fields);
  }
  return level.output;
}

export function createSubmission(levelId: string): Submission {
  return {
    levelId,
    values: {},
    updatedAt: new Date().toISOString()
  };
}

export function isComplete(level: Level, submission?: Submission) {
  if (!submission) return false;
  const fields = getLevelFields(level);
  const filled = fields.filter((field) => (submission.values[field] || "").trim().length > 0);
  return filled.length >= Math.ceil(fields.length * 0.7);
}

export function scoreSubmission(level: Level, submission?: Submission) {
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

export function formatTime(value: string) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function cloneDefaultState(): AppState {
  return {
    activeLevelId: defaultState.activeLevelId,
    submissions: {}
  };
}
