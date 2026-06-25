import { type LLMTool } from "./llm";

export const DEMAND_TYPES = [
  { value: "education", label: "教育培训", description: "AI课程开发、政企培训、研学项目等教育类服务" },
  { value: "software", label: "软件开发", description: "AI工具定制、插件开发、系统集成等软件交付" },
  { value: "marketing", label: "营销", description: "AI赋能直播、短视频、新媒体及品牌营销推广" },
  { value: "content", label: "内容设计", description: "图文、视频、H5等内容创作与设计服务" },
  { value: "other", label: "其他", description: "不属于以上分类的其他AI相关服务需求" },
];

export interface ToolExecutionContext {
  categories?: Array<{ id: number; code: string; name: string; description: string | null }>;
  tags?: string[];
  /** DB-sourced doc templates per category code (e.g. "CG" → markdown text) */
  docTemplates?: Record<string, string>;
  /** Existing demand data injected for edit mode */
  existingDemand?: {
    title?: string;
    type?: string;
    description?: string;
    budgetMin?: number | null;
    budgetMax?: number | null;
    hopeDeliveryDate?: string | null;
  };
}

export const SKILL_TAGS = [
  "AI课程设计", "培训体系搭建", "Python编程", "大模型应用", "提示词工程",
  "数据分析", "机器学习", "深度学习", "计算机视觉", "自然语言处理",
  "AI工具开发", "RPA自动化", "知识图谱", "AI绘画", "AI视频",
  "直播运营", "短视频制作", "新媒体运营", "内容创作", "品牌营销",
  "研学策划", "活动执行", "项目管理", "党建工作", "政府采购",
  "企业培训", "讲师认证", "课件制作", "在线教育", "教学设计",
  "PPT设计", "视频剪辑", "图文设计", "H5开发", "海报设计",
  "Web开发", "小程序开发", "系统集成", "数据爬取", "自动化脚本",
];

export const OPC_LEVELS = [
  {
    level: "C",
    name: "C级OPC",
    description: "入门级OPC，适合小型基础任务",
    budgetCap: 3000,
    budgetCapNote: "预算上限 ¥3,000，超过此金额无法选择C级",
    qualifications: "具备基础AI知识，通过C级认证考核",
    suitableFor: ["基础AI体验活动", "简单内容制作", "小型培训执行"],
  },
  {
    level: "B",
    name: "B级OPC",
    description: "中级OPC，具备较强的AI应用和培训能力",
    budgetCap: 20000,
    budgetCapNote: "预算上限 ¥20,000，超过此金额无法选择B级",
    qualifications: "3年以上AI相关经验，通过B级认证考核",
    suitableFor: ["企业定制培训", "AI工具开发", "研学项目设计"],
  },
  {
    level: "A",
    name: "A级OPC",
    description: "高级OPC，可承接复杂大型AI项目",
    budgetCap: 200000,
    budgetCapNote: "预算上限 ¥200,000，超过此金额请使用不限级别",
    qualifications: "5年以上AI深度应用经验，通过A级认证考核",
    suitableFor: ["大型AI系统集成", "政企战略AI转型", "高端研究项目"],
  },
  {
    level: "any",
    name: "不限级别",
    description: "对OPC级别无要求，所有级别均可投标，预算上限同A级（¥200,000）",
    budgetCap: 200000,
    budgetCapNote: "预算上限 ¥200,000",
    qualifications: "无要求",
    suitableFor: ["各类规模项目"],
  },
];

const REQUIREMENT_TEMPLATES: Record<string, {
  name: string;
  description: string;
  sections: Array<{ name: string; guide: string; required: boolean }>;
}> = {
  education: {
    name: "教育培训",
    description: "适用于AI课程开发、政企培训、研学活动、讲师输出等教育类需求",
    sections: [
      { name: "背景与目标", guide: "您为什么想做这次培训呀？主要是想解决什么问题，还是达成某个目标？（比如让员工学会用AI工具、推动政府部门了解AI之类的）", required: true },
      { name: "目标学员", guide: "参加培训的学员主要是哪类人？（企业员工/政府人员/在校学生等）大概有多少人？他们现在对AI了解多少呢？", required: true },
      { name: "课程内容与大纲", guide: "您希望培训涵盖哪些内容？大概分哪几个模块？每个模块您最希望学员学到什么？", required: true },
      { name: "交付形式", guide: "您打算线上还是线下？现场授课、录播课、还是直播课？或者线上线下都有？", required: true },
      { name: "时间安排", guide: "总共培训多长时间？分几天来完成？每天大概几个小时？有没有必须在某个时间点前完成的硬要求？", required: true },
      { name: "配套资料", guide: "培训时需要配套的PPT课件、学员手册、练习题或者案例库这类材料吗？", required: false },
      { name: "考核与认证", guide: "培训结束后需要考核吗？要不要给学员颁发结业证书或者认证？", required: false },
      { name: "场地与设备", guide: "如果是线下课，需要OPC帮忙安排场地和设备吗？有没有特殊要求，比如要有实操电脑、投影仪、或者特定的网络环境？", required: false },
      { name: "验收标准", guide: "您打算怎么衡量这次培训有没有达到预期效果呢？比如学员满意度评分、考核通过率，还是实操能力测评之类的？", required: true },
    ],
  },
  software: {
    name: "软件开发",
    description: "适用于AI工具定制、插件开发、系统集成、自动化流程等软件交付需求",
    sections: [
      { name: "背景与目标", guide: "您为什么想开发这个软件或工具呀？现在主要是遇到了什么困难或麻烦？目前是怎么解决这个问题的？", required: true },
      { name: "目标用户", guide: "这个软件主要是给谁用的？大概是什么样的用户群体？有多少人会用到它？", required: true },
      { name: "核心功能需求", guide: "您觉得最重要的功能有哪些？每个功能大概想实现什么效果？如果要排个优先级的话，您最想先做哪个？", required: true },
      { name: "运行环境与对接要求", guide: "这个软件需要在什么地方跑起来？（比如公司电脑、手机、网页浏览器这类）需要跟哪些现有的系统或平台打通？具体怎么实现由OPC来定就行。", required: false },
      { name: "数据与安全", guide: "这个软件会用到哪些数据，比如客户信息、财务数据之类的？有没有什么保密要求或行业规定需要遵守？", required: false },
      { name: "界面与使用体验", guide: "对界面外观有什么偏好吗？有没有喜欢的参考案例？是想要好看的界面，还是能用就行？", required: false },
      { name: "验收标准", guide: "软件做完之后，您打算怎么判断它算是达标了？比如所有功能都能正常用、日常操作流畅不卡顿这类？", required: true },
      { name: "交付后的使用与维护", guide: "软件交付后是放在公司自己的服务器上还是第三方平台？需不需要配套的操作手册，或者后续的维护支持？", required: false },
    ],
  },
  marketing: {
    name: "营销",
    description: "适用于AI赋能直播、短视频制作、新媒体运营、品牌推广等营销类需求",
    sections: [
      { name: "背景与目标", guide: "您这次是帮哪个品牌/产品/服务做推广呀？这次活动最主要想达成什么目标？（比如提升品牌知名度、吸引新用户、促成销售，或者做品牌公关等）", required: true },
      { name: "目标受众", guide: "您的目标客户大概是什么样的人？（年龄段、职业、兴趣爱好、消费习惯、地域这些方面说说？）", required: true },
      { name: "渠道与平台", guide: "您主要打算在哪些平台上推广？（微信公众号/视频号/抖音/小红书/B站/微博/私域社群等）", required: true },
      { name: "内容形式", guide: "需要做哪些形式的内容或活动？（短视频/图文推文/直播/KOL合作/活动策划/文案撰写等）", required: true },
      { name: "核心卖点与传播主题", guide: "您的产品或服务最打动客户的点是什么？这次宣传想主打什么主题或者广告语？", required: true },
      { name: "预期效果指标", guide: "您希望这次活动能带来什么具体效果呢？比如视频播放量、新增粉丝数、带动多少销售额，还是有多少人来咨询？", required: false },
      { name: "时间节点", guide: "活动或内容大概什么时候上线？要持续运营多久？有没有要配合的节假日或营销节点？", required: true },
      { name: "品牌调性与禁忌", guide: "您品牌的风格和调性是什么样的？（活泼/专业/高端/亲民等）有没有内容上的红线或者品牌禁忌？", required: false },
    ],
  },
  content: {
    name: "内容设计",
    description: "适用于PPT制作、视频剪辑、图文创作、H5、海报、品牌视觉等内容创作需求",
    sections: [
      { name: "背景与目标", guide: "这批内容主要用在什么场合？想达到什么效果？（比如对内汇报、对外宣传、社交媒体传播、活动现场展示这类）", required: true },
      { name: "内容类型与数量", guide: "您需要做哪种类型的内容？（PPT/短视频/长视频/海报/Banner/H5/图文等）大概需要多少份？有没有具体的规格或尺寸要求？", required: true },
      { name: "使用场景", guide: "这些内容打算在哪里展示或使用？给谁看？（公司内部/发给客户/投放社交媒体/线下大屏等）", required: true },
      { name: "风格要求", guide: "有没有喜欢的参考案例或设计风格偏好？对颜色有没有要求？想要简约风还是丰富一些？科技感还是温情感？", required: false },
      { name: "文字素材", guide: "文字内容（文案、数据、介绍文字等）是您这边提供，还是需要OPC帮忙撰写？", required: true },
      { name: "品牌规范", guide: "公司有没有品牌形象规范要求？（比如指定的Logo、字体、品牌主色、视觉规范手册等）有的话记得提供相关文件。", required: false },
      { name: "交付格式", guide: "需要交付什么格式的文件？（比如PPT、PDF、视频文件等）需不需要保留可以继续修改的原始文件？", required: true },
      { name: "修改与验收", guide: "修改次数怎么约定比较合适？您打算怎么判断最终成果达标了？", required: false },
    ],
  },
  other: {
    name: "其他",
    description: "不属于以上四类的AI相关需求",
    sections: [
      { name: "背景与目标", guide: "能跟我说说您这个需求是怎么来的吗？主要想解决什么问题，或者达成什么目标？", required: true },
      { name: "具体需求内容", guide: "具体需要做哪些事情？有哪些任务或工作内容？", required: true },
      { name: "目标受众或使用者", guide: "这个项目或成果最终是给谁用的？", required: false },
      { name: "交付物", guide: "您希望到时候拿到什么形式的交付成果？（比如报告、系统、课程、方案这类）", required: true },
      { name: "验收标准", guide: "您打算怎么判断项目做完了、达标了呢？有什么具体的衡量标准吗？", required: true },
    ],
  },
};

/** Build the full agent tool list, dynamically injecting category codes when context is available. */
export function buildAgentTools(context?: ToolExecutionContext): LLMTool[] {
  // Derive demandType enum from live categories (new codes) + legacy codes for fallback
  const dynamicCodes = context?.categories?.map(c => c.code);
  const legacyCodes = ["education", "software", "marketing", "content", "other"];
  const demandTypeCodes = dynamicCodes && dynamicCodes.length > 0
    ? [...dynamicCodes, ...legacyCodes]   // new codes first, legacy as fallback
    : legacyCodes;

  return [
  {
    type: "function",
    function: {
      name: "get_requirement_template",
      description: "根据需求类型获取需求文档模板。在第一阶段确认需求类型后立即调用，获取该类型需要收集的信息模块清单，作为第二阶段脑暴提问的框架依据。",
      parameters: {
        type: "object",
        properties: {
          demandType: {
            type: "string",
            enum: demandTypeCodes,
            description: "需求类型代码（优先使用平台当前分类代码，如 CG/SA/TK/BO/OTHER；也兼容旧代码 education/software 等）",
          },
        },
        required: ["demandType"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_demand_types",
      description: "获取平台支持的所有需求分类列表，包括分类标识、名称和描述。当需要确认需求分类时使用。",
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
      description: "获取平台支持的所有技能标签列表。在第四阶段根据需求内容推荐合适的技能标签时使用。",
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
      description: "获取OPC等级说明、适用范围和预算上限。在第四阶段根据需求复杂度和规模推荐合适的OPC等级时使用。",
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
      name: "validate_timeline",
      description: "验证用户期望的交付时间是否合理，并倒推出抢单截止日期和各里程碑节点日期。在第四阶段用户提供期望交付时间后立即调用，用于校验合理性并生成时间框架。",
      parameters: {
        type: "object",
        properties: {
          expectedDeliveryDate: {
            type: "string",
            description: "用户期望的交付日期，格式 YYYY-MM-DD",
          },
          demandType: {
            type: "string",
            description: "需求类型，如 education、software、marketing、content、other",
          },
          complexity: {
            type: "string",
            enum: ["simple", "medium", "complex"],
            description: "项目复杂度：simple=简单，medium=中等，complex=复杂",
          },
        },
        required: ["expectedDeliveryDate", "demandType"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_milestones",
      description: "根据需求类型、抢单截止日期和交付截止日期，建议详细的里程碑拆分方案。每个里程碑包含阶段名称、交付物详细说明、支付比例建议。应在 validate_timeline 返回合理时间后调用，使用工具返回的 bidDeadline 和 deliveryDate。",
      parameters: {
        type: "object",
        properties: {
          demandType: {
            type: "string",
            description: "需求类型，如 education、software、marketing、content、other",
          },
          bidDeadline: {
            type: "string",
            description: "抢单截止日期，格式 YYYY-MM-DD，由 validate_timeline 工具返回",
          },
          deliveryDate: {
            type: "string",
            description: "最终交付截止日期，格式 YYYY-MM-DD，由 validate_timeline 工具返回",
          },
          budget: {
            type: "number",
            description: "项目总预算（元）",
          },
        },
        required: ["demandType", "deliveryDate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "estimate_budget",
      description: "根据需求类型、复杂度和工期，估算参考预算区间（元）。在第四阶段给用户预算参考时使用。",
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
}

/** Static fallback list (for callers that don't have context yet). */
export const AGENT_TOOLS: LLMTool[] = buildAgentTools();

// Mapping from new category codes to legacy template keys
const CAT_CODE_TO_TEMPLATE: Record<string, string> = {
  CG: "content",
  SA: "software",
  TK: "education",
  BO: "marketing",
  OTHER: "other",
};

type ToolResult = unknown;

export function executeTool(name: string, args: Record<string, unknown>, context?: ToolExecutionContext): ToolResult {
  switch (name) {
    case "get_requirement_template": {
      const rawType = (args.demandType as string) || "other";
      // Accept both new category codes (CG/SA/TK/BO/OTHER) and legacy keys
      const demandType = CAT_CODE_TO_TEMPLATE[rawType.toUpperCase()] ?? rawType;

      // Prefer DB-sourced template (from cat_categories.doc_template)
      if (context?.docTemplates) {
        const upperCode = rawType.toUpperCase();
        const dbTemplate = context.docTemplates[upperCode] ?? context.docTemplates[rawType] ?? context.docTemplates[demandType];
        if (dbTemplate) {
          return {
            demandType,
            templateSource: "db",
            template: dbTemplate,
            usage: "以上模板即为该需求类型的完整文档框架，按照模板各章节引导用户逐步回答，最终生成完整的需求文档",
          };
        }
      }

      const template = REQUIREMENT_TEMPLATES[demandType] ?? REQUIREMENT_TEMPLATES.other;
      return {
        demandType,
        templateName: template.name,
        description: template.description,
        sections: template.sections,
        usage: "按照 sections 中的模块逐步引导用户，每次提问1-2个相关问题，重点了解背景目标、具体内容、执行要求和验收标准",
      };
    }

    case "get_demand_types":
      if (context?.categories?.length) {
        return context.categories.map(c => ({
          value: c.code,
          label: c.name,
          description: c.description ?? "",
        }));
      }
      return DEMAND_TYPES;

    case "get_skill_tags":
      return context?.tags?.length ? context.tags : SKILL_TAGS;

    case "get_opc_levels":
      return OPC_LEVELS;

    case "validate_timeline": {
      let expectedDeliveryDate = args.expectedDeliveryDate as string;
      const demandType = args.demandType as string;
      const complexity = (args.complexity as string) || "medium";

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split("T")[0];

      // Parse relative Chinese time expressions into absolute dates
      const relativeMatch = expectedDeliveryDate.match(/^(\d+)\s*个?月/);
      const weekMatch = expectedDeliveryDate.match(/^(\d+)\s*周/);
      const dayMatch = expectedDeliveryDate.match(/^(\d+)\s*[天日]/);
      if (relativeMatch) {
        const months = parseInt(relativeMatch[1]);
        const d = new Date(today);
        d.setMonth(d.getMonth() + months);
        expectedDeliveryDate = d.toISOString().split("T")[0];
      } else if (weekMatch) {
        const weeks = parseInt(weekMatch[1]);
        const d = new Date(today);
        d.setDate(d.getDate() + weeks * 7);
        expectedDeliveryDate = d.toISOString().split("T")[0];
      } else if (dayMatch) {
        const days = parseInt(dayMatch[1]);
        const d = new Date(today);
        d.setDate(d.getDate() + days);
        expectedDeliveryDate = d.toISOString().split("T")[0];
      }

      const delivery = new Date(expectedDeliveryDate);
      delivery.setHours(0, 0, 0, 0);
      const totalDays = isNaN(delivery.getTime())
        ? -1
        : Math.round((delivery.getTime() - today.getTime()) / 86400000);

      const minDays: Record<string, number> = {
        simple: 7, medium: 14, complex: 21,
      };
      const minRequired = minDays[complexity] ?? 14;

      const addDays = (d: Date, n: number) => {
        const r = new Date(d);
        r.setDate(r.getDate() + n);
        return r.toISOString().split("T")[0];
      };

      if (totalDays <= 0) {
        return {
          isReasonable: false,
          todayDate: todayStr,
          parsedDeliveryDate: expectedDeliveryDate,
          issues: [totalDays === -1
            ? `无法识别日期格式"${args.expectedDeliveryDate}"，请使用 YYYY-MM-DD 格式或"N个月内""N周内"等表达。今天是 ${todayStr}。`
            : "交付日期不能是过去或今天，请选择未来的日期。"],
          suggestedDeliveryDate: addDays(today, minRequired + 7),
          totalDays: 0,
        };
      }

      if (totalDays < minRequired) {
        const typeLabel: Record<string, string> = {
          education: "教育培训", software: "软件开发",
          marketing: "营销", content: "内容设计", other: "项目",
        };
        return {
          isReasonable: false,
          issues: [
            `${typeLabel[demandType] ?? "该类型"}项目（${complexity === "simple" ? "简单" : complexity === "complex" ? "复杂" : "中等"}复杂度）至少需要 ${minRequired} 天，当前只有 ${totalDays} 天，时间明显不够。`,
            "建议：留出足够时间让 OPC 竞标和准备（至少 3 天），以及完整的执行周期。",
          ],
          suggestedDeliveryDate: addDays(today, minRequired + 7),
          totalDays,
        };
      }

      // Bid deadline: 3~14 days from today, at most 30% of total time
      const bidDays = Math.min(Math.max(3, Math.round(totalDays * 0.15)), 14);
      const bidDeadline = addDays(today, bidDays);
      const deliveryDate = expectedDeliveryDate;
      const workDays = totalDays - bidDays;

      return {
        isReasonable: true,
        todayDate: todayStr,
        parsedDeliveryDate: expectedDeliveryDate,
        totalDays,
        bidDeadline,
        deliveryDate,
        workDays,
        notes: [
          `今天（${todayStr}）到抢单截止：${bidDays} 天（${bidDeadline}）`,
          `抢单截止到最终交付：${workDays} 天（${deliveryDate}）`,
          "请将 bidDeadline 和 deliveryDate 原样填入 form_suggestion_json，不得改动。",
        ],
      };
    }

    case "suggest_milestones": {
      const demandType = args.demandType as string;
      const deliveryDate = args.deliveryDate as string;
      const bidDeadline = (args.bidDeadline as string) || new Date().toISOString().split("T")[0];
      const budget = (args.budget as number) || 0;

      const start = new Date(bidDeadline);
      const end = new Date(deliveryDate);
      const workDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));

      const milestones = generateMilestones(demandType, workDays, budget, bidDeadline);
      return { milestones, bidDeadline, deliveryDate };
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
  _budget: number,
  startDateStr?: string,
): Array<{ name: string; deadline: string; description: string; paymentRatio: number }> {
  const today = startDateStr ? new Date(startDateStr) : new Date();

  const addDays = (d: Date, days: number) => {
    const result = new Date(d);
    result.setDate(result.getDate() + days);
    return result.toISOString().split("T")[0];
  };

  if (demandType === "education") {
    const p1 = Math.round(deliveryDays * 0.25);
    const p2 = Math.round(deliveryDays * 0.65);
    return [
      {
        name: "课程方案设计与确认",
        deadline: addDays(today, p1),
        description: `完成课程大纲设计、教学内容规划及授课PPT初稿（不少于80%的内容），提交甲方审阅并完成修改确认。交付物：课程大纲文档、PPT初稿文件。验收标准：甲方书面确认课程方向和内容框架符合预期。`,
        paymentRatio: 30,
      },
      {
        name: "培训实施交付",
        deadline: addDays(today, p2),
        description: `按计划完成全部培训课时的现场或线上授课，全程配合甲方做好学员服务。交付物：培训签到表（含学员签名）、课堂照片或录屏记录、每日培训简报。验收标准：培训按约定时间和内容完成，学员出席率达标。`,
        paymentRatio: 50,
      },
      {
        name: "项目结项与总结验收",
        deadline: addDays(today, deliveryDays),
        description: `完成培训效果评估并提交项目总结报告。交付物：学员满意度调查汇总、培训效果评估报告（含考核成绩/通过率）、完整培训材料包（PPT终稿、学员手册等）。验收标准：甲方完成验收确认，所有约定材料齐全交付。`,
        paymentRatio: 20,
      },
    ];
  }

  if (demandType === "software") {
    const p1 = Math.round(deliveryDays * 0.15);
    const p2 = Math.round(deliveryDays * 0.55);
    const p3 = Math.round(deliveryDays * 0.85);
    return [
      {
        name: "需求确认与原型设计",
        deadline: addDays(today, p1),
        description: `深入理解业务需求，完成详细需求文档和交互原型设计。交付物：详细需求规格说明书（含功能清单和优先级）、UI交互原型（Figma或Axure文件）、技术架构设计文档。验收标准：甲方书面确认需求文档和原型，作为后续开发基准。`,
        paymentRatio: 20,
      },
      {
        name: "核心功能开发完成",
        deadline: addDays(today, p2),
        description: `完成所有核心功能模块的开发，提供可测试的版本。交付物：部署在测试环境的完整可运行系统、功能测试报告（含已知缺陷清单）、接口文档（如有API对接需求）。验收标准：核心功能按需求文档实现，甲方可在测试环境完整体验主要流程。`,
        paymentRatio: 40,
      },
      {
        name: "测试优化与修复",
        deadline: addDays(today, p3),
        description: `根据甲方测试反馈完成Bug修复和功能优化，确保系统稳定性。交付物：更新后的测试版本、修复记录文档、性能测试报告（如有性能指标要求）。验收标准：甲方反馈的全部P0/P1级缺陷均已修复，系统功能符合验收标准。`,
        paymentRatio: 30,
      },
      {
        name: "正式上线与交付",
        deadline: addDays(today, deliveryDays),
        description: `完成生产环境部署和上线，交付全部项目成果。交付物：生产环境正式运行的系统、完整源代码（含注释）、部署文档和运维手册、用户操作手册。验收标准：系统在生产环境稳定运行，甲方签署项目验收单。`,
        paymentRatio: 10,
      },
    ];
  }

  if (demandType === "marketing") {
    const p1 = Math.round(deliveryDays * 0.2);
    const p2 = Math.round(deliveryDays * 0.6);
    return [
      {
        name: "策略方案设计与确认",
        deadline: addDays(today, p1),
        description: `完成营销策略制定和内容创作方案。交付物：营销策略方案（含受众分析、渠道规划、内容方向、排期计划）、示例内容样稿（如首批内容脚本/图文样稿）。验收标准：甲方书面确认整体方案方向，作为后续执行依据。`,
        paymentRatio: 30,
      },
      {
        name: "内容执行与投放",
        deadline: addDays(today, p2),
        description: `按计划完成内容创作和平台投放执行。交付物：所有约定内容的成品文件（视频/图文/直播回放等）、各平台投放截图和数据记录、阶段性数据报告（含曝光量、互动率等核心指标）。验收标准：内容按约定数量和时间节点发布，核心数据指标达到阶段目标。`,
        paymentRatio: 50,
      },
      {
        name: "项目总结与收尾",
        deadline: addDays(today, deliveryDays),
        description: `完成最终数据汇总和项目复盘。交付物：完整营销数据报告（含所有渠道核心指标汇总）、内容素材资产包（所有创作的成品源文件）、项目复盘总结（经验沉淀与建议）。验收标准：甲方确认数据报告，所有承诺交付物齐全。`,
        paymentRatio: 20,
      },
    ];
  }

  if (demandType === "content") {
    const p1 = Math.round(deliveryDays * 0.3);
    const p2 = Math.round(deliveryDays * 0.75);
    return [
      {
        name: "方案沟通与初稿设计",
        deadline: addDays(today, p1),
        description: `深入理解内容需求，完成创作方向确认和初稿设计。交付物：创意方向提案（含风格参考、色彩方案）、初稿文件（完成约60%的内容）。验收标准：甲方确认整体风格方向和初稿方案，作为深化设计的基准。`,
        paymentRatio: 30,
      },
      {
        name: "内容深化与修改确认",
        deadline: addDays(today, p2),
        description: `根据初稿反馈完成内容深化，进行约定次数内的修改优化。交付物：修改后的完整内容文件（达到约定修改轮次）、各内容模块的完成稿。验收标准：甲方对内容质量和完成度满意，确认进入最终交付环节。`,
        paymentRatio: 50,
      },
      {
        name: "最终交付",
        deadline: addDays(today, deliveryDays),
        description: `完成所有内容的最终整理和格式输出，交付完整成果包。交付物：约定格式的所有成品文件（如PDF/MP4/PNG等）、源文件（如PSD/AE/PPTX等，如有约定）、文件整理说明文档。验收标准：甲方签署验收确认，所有文件完整可用。`,
        paymentRatio: 20,
      },
    ];
  }

  const mid = Math.round(deliveryDays * 0.5);
  return [
    {
      name: "方案设计与确认",
      deadline: addDays(today, mid),
      description: `完成项目方案设计并获得甲方确认。交付物：详细项目方案文档（含工作计划、交付清单、执行方法说明）、阶段性成果样稿（如适用）。验收标准：甲方书面确认方案方向和内容，作为后续执行依据。`,
      paymentRatio: 40,
    },
    {
      name: "项目交付与验收",
      deadline: addDays(today, deliveryDays),
      description: `按方案完成全部工作，交付所有约定成果。交付物：项目全部交付物（按方案约定）、工作记录和过程文档、项目总结说明。验收标准：甲方确认所有交付物符合约定要求，签署项目验收单。`,
      paymentRatio: 60,
    },
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

  if (demandType === "education") {
    const perPersonBase = complexity === "simple" ? 200 : complexity === "complex" ? 800 : 400;
    const count = participantCount > 0 ? participantCount : 30;
    base = perPersonBase * count + deliveryDays * 500;
    basis = `按 ${count} 人规模、${deliveryDays} 天工期估算`;
  } else if (demandType === "software") {
    const dayRate = complexity === "simple" ? 1500 : complexity === "complex" ? 4000 : 2500;
    base = dayRate * deliveryDays;
    basis = `按 ${deliveryDays} 天工期、日均开发费用估算`;
  } else if (demandType === "marketing") {
    base = 8000 * complexityMultiplier * Math.max(1, deliveryDays / 15);
    basis = `按 ${deliveryDays} 天运营周期、项目规模估算`;
  } else if (demandType === "content") {
    const dayRate = complexity === "simple" ? 800 : complexity === "complex" ? 2500 : 1500;
    base = dayRate * deliveryDays;
    basis = `按 ${deliveryDays} 天工期、内容类型和复杂度估算`;
  } else {
    base = 10000 * complexityMultiplier * Math.max(1, deliveryDays / 10);
    basis = "综合项目规模和工期估算";
  }

  const minBudget = Math.round((base * 0.8) / 1000) * 1000;
  const maxBudget = Math.round((base * 1.3) / 1000) * 1000;

  return { minBudget, maxBudget, basis };
}
