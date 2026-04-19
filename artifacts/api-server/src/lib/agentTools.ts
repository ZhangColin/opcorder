import { type LLMTool } from "./llm";

export const DEMAND_TYPES = [
  { value: "ai_education", label: "AI教育课程开发", description: "面向学校、教育机构的AI课程内容开发与交付" },
  { value: "gov_training", label: "政企AI培训", description: "面向政府机关、国有企业的AI技能培训项目" },
  { value: "ai_research", label: "AI研学项目", description: "AI主题研学营、体验课、科技参观等活动策划与执行" },
  { value: "party_building", label: "党建AI应用", description: "党建活动与AI技术结合的应用场景开发" },
  { value: "livestream_media", label: "直播与新媒体", description: "AI赋能直播带货、短视频内容生产、新媒体运营" },
  { value: "ai_tool_dev", label: "AI工具开发定制", description: "面向企业的AI工具、插件、系统定制开发" },
  { value: "other", label: "其他", description: "不属于以上分类的其他AI相关服务需求" },
];

export const SKILL_TAGS = [
  "AI课程设计", "培训体系搭建", "Python编程", "大模型应用", "提示词工程",
  "数据分析", "机器学习", "深度学习", "计算机视觉", "自然语言处理",
  "AI工具开发", "RPA自动化", "知识图谱", "AI绘画", "AI视频",
  "直播运营", "短视频制作", "新媒体运营", "内容创作", "品牌营销",
  "研学策划", "活动执行", "项目管理", "党建工作", "政府采购",
  "企业培训", "讲师认证", "课件制作", "在线教育", "教学设计",
];

export const OPC_LEVELS = [
  {
    level: "C",
    name: "C级OPC",
    description: "入门级OPC，适合基础AI教育和培训任务",
    budgetCap: 50000,
    qualifications: "具备基础AI知识，通过C级认证考核",
    suitableFor: ["基础AI课程讲授", "简单培训执行", "AI体验活动"],
  },
  {
    level: "B",
    name: "B级OPC",
    description: "中级OPC，具备较强的AI应用和培训能力",
    budgetCap: 200000,
    qualifications: "3年以上AI相关经验，通过B级认证考核",
    suitableFor: ["企业定制培训", "AI工具开发", "研学项目设计"],
  },
  {
    level: "A",
    name: "A级OPC",
    description: "高级OPC，可承接复杂大型AI项目",
    budgetCap: 1000000,
    qualifications: "5年以上AI深度应用经验，通过A级认证考核",
    suitableFor: ["大型AI系统集成", "政企战略AI转型", "高端研究项目"],
  },
  {
    level: "any",
    name: "不限级别",
    description: "对OPC级别无要求，所有级别均可投标",
    budgetCap: null,
    qualifications: "无要求",
    suitableFor: ["简单任务", "快速交付项目"],
  },
];

export const AGENT_TOOLS: LLMTool[] = [
  {
    type: "function",
    function: {
      name: "get_demand_types",
      description: "获取平台支持的所有需求分类列表，包括分类标识、名称和描述。当用户描述需求内容时，用此工具确认最合适的需求分类。",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_skill_tags",
      description: "获取平台支持的所有技能标签列表。根据用户需求内容推荐合适的技能标签。",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_opc_levels",
      description: "获取OPC等级说明、适用范围和预算上限。根据需求复杂度和预算帮助用户选择合适的OPC等级要求。",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_milestones",
      description: "根据需求类型和交付周期，建议合理的里程碑拆分方案。",
      parameters: {
        type: "object",
        properties: {
          demandType: {
            type: "string",
            description: "需求类型，如 ai_education、gov_training 等",
          },
          deliveryDays: {
            type: "integer",
            description: "项目总交付天数",
          },
          budget: {
            type: "number",
            description: "项目总预算（元）",
          },
        },
        required: ["demandType", "deliveryDays"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "estimate_budget",
      description: "根据需求类型、复杂度和工期，估算参考预算区间（元）。",
      parameters: {
        type: "object",
        properties: {
          demandType: {
            type: "string",
            description: "需求类型",
          },
          complexity: {
            type: "string",
            enum: ["simple", "medium", "complex"],
            description: "项目复杂度：simple=简单，medium=中等，complex=复杂",
          },
          deliveryDays: {
            type: "integer",
            description: "交付天数",
          },
          participantCount: {
            type: "integer",
            description: "参与人数（培训类需求）",
          },
        },
        required: ["demandType", "complexity"],
      },
    },
  },
];

type ToolResult = unknown;

export function executeTool(name: string, args: Record<string, unknown>): ToolResult {
  switch (name) {
    case "get_demand_types":
      return DEMAND_TYPES;

    case "get_skill_tags":
      return SKILL_TAGS;

    case "get_opc_levels":
      return OPC_LEVELS;

    case "suggest_milestones": {
      const demandType = args.demandType as string;
      const deliveryDays = (args.deliveryDays as number) || 30;
      const budget = (args.budget as number) || 0;

      const milestones = generateMilestones(demandType, deliveryDays, budget);
      return { milestones };
    }

    case "estimate_budget": {
      const demandType = args.demandType as string;
      const complexity = (args.complexity as string) || "medium";
      const deliveryDays = (args.deliveryDays as number) || 30;
      const participantCount = (args.participantCount as number) || 0;

      return estimateBudget(demandType, complexity, deliveryDays, participantCount);
    }

    default:
      return { error: `未知工具: ${name}` };
  }
}

function generateMilestones(
  demandType: string,
  deliveryDays: number,
  _budget: number
): Array<{ name: string; deadline: string; description: string; paymentRatio: number }> {
  const today = new Date();

  const addDays = (d: Date, days: number) => {
    const result = new Date(d);
    result.setDate(result.getDate() + days);
    return result.toISOString().split("T")[0];
  };

  if (demandType === "ai_education" || demandType === "gov_training") {
    const p1 = Math.round(deliveryDays * 0.3);
    const p2 = Math.round(deliveryDays * 0.7);
    return [
      { name: "课程方案设计", deadline: addDays(today, p1), description: "完成课程大纲、教学设计方案、PPT初稿", paymentRatio: 30 },
      { name: "培训实施交付", deadline: addDays(today, p2), description: "完成培训现场实施，提交签到表和现场照片", paymentRatio: 50 },
      { name: "项目结项验收", deadline: addDays(today, deliveryDays), description: "提交总结报告、学员反馈，完成验收", paymentRatio: 20 },
    ];
  }

  if (demandType === "ai_research") {
    const p1 = Math.round(deliveryDays * 0.25);
    const p2 = Math.round(deliveryDays * 0.75);
    return [
      { name: "研学方案设计", deadline: addDays(today, p1), description: "完成研学路线、活动方案、安全预案设计", paymentRatio: 30 },
      { name: "研学活动执行", deadline: addDays(today, p2), description: "完成研学活动现场执行，提交过程记录", paymentRatio: 50 },
      { name: "总结报告交付", deadline: addDays(today, deliveryDays), description: "提交研学总结报告和成果资料包", paymentRatio: 20 },
    ];
  }

  if (demandType === "ai_tool_dev") {
    const p1 = Math.round(deliveryDays * 0.2);
    const p2 = Math.round(deliveryDays * 0.6);
    const p3 = Math.round(deliveryDays * 0.9);
    return [
      { name: "需求确认与原型设计", deadline: addDays(today, p1), description: "完成详细需求文档和交互原型", paymentRatio: 20 },
      { name: "核心功能开发完成", deadline: addDays(today, p2), description: "核心功能开发完成，提交测试版本", paymentRatio: 40 },
      { name: "测试与优化", deadline: addDays(today, p3), description: "完成功能测试、性能优化", paymentRatio: 30 },
      { name: "正式交付上线", deadline: addDays(today, deliveryDays), description: "部署上线，交付源代码和文档", paymentRatio: 10 },
    ];
  }

  const mid = Math.round(deliveryDays * 0.6);
  return [
    { name: "方案设计与确认", deadline: addDays(today, mid), description: "完成方案设计和甲方确认", paymentRatio: 40 },
    { name: "项目交付验收", deadline: addDays(today, deliveryDays), description: "完成项目交付和验收", paymentRatio: 60 },
  ];
}

function estimateBudget(
  demandType: string,
  complexity: string,
  deliveryDays: number,
  participantCount: number
): { minBudget: number; maxBudget: number; basis: string } {
  const complexityMultiplier = complexity === "simple" ? 0.6 : complexity === "complex" ? 1.8 : 1.0;

  let base = 10000;
  let basis = "";

  if (demandType === "ai_education" || demandType === "gov_training") {
    const perPersonBase = complexity === "simple" ? 200 : complexity === "complex" ? 800 : 400;
    const count = participantCount > 0 ? participantCount : 30;
    base = perPersonBase * count + deliveryDays * 500;
    basis = `按 ${count} 人规模、${deliveryDays} 天工期估算`;
  } else if (demandType === "ai_research") {
    const perPersonBase = complexity === "simple" ? 300 : complexity === "complex" ? 1000 : 600;
    const count = participantCount > 0 ? participantCount : 30;
    base = perPersonBase * count + 5000;
    basis = `按 ${count} 人规模估算，含活动策划及执行`;
  } else if (demandType === "ai_tool_dev") {
    const dayRate = complexity === "simple" ? 1500 : complexity === "complex" ? 4000 : 2500;
    base = dayRate * deliveryDays;
    basis = `按 ${deliveryDays} 天工期、日均开发费用估算`;
  } else {
    base = 10000 * complexityMultiplier * Math.max(1, deliveryDays / 10);
    basis = "综合项目规模和工期估算";
  }

  const minBudget = Math.round((base * 0.8) / 1000) * 1000;
  const maxBudget = Math.round((base * 1.3) / 1000) * 1000;

  return { minBudget, maxBudget, basis };
}
