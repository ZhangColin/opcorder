import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  usersTable,
  opcProfilesTable,
  adminRolesTable,
  adminRoleAssignmentsTable,
  agentConfigsTable,
  siteSettingsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";

interface OpcSeedEntry {
  email: string;
  nickname: string;
  password: string;
  profile: {
    level: "A" | "B" | "C";
    title: string;
    bio: string;
    location: string;
    skillTags: string[];
    industryTags: string[];
    creditScore: number;
    totalOrders: number;
    completionRate: number;
    avgRating: number;
    totalEarnings: number;
    activityScore: number;
    yearsExp: number;
    wechat: string;
    website?: string | null;
  };
}

const OPC_SEED_DATA: OpcSeedEntry[] = [
  {
    email: "zhangjinhua@aieducenter.com",
    nickname: "张锦华",
    password: "opc@123456",
    profile: {
      level: "B",
      title: "OPC运营顾问",
      bio: "专注于企业OPC数字化运营体系建设5年，主导过多家制造企业OPC认证项目落地，擅长流程梳理、组织诊断与团队赋能，累计服务企业超20家。",
      location: "上海",
      skillTags: ["OPC运营", "数字化转型", "流程优化", "团队赋能", "项目管理"],
      industryTags: ["制造业", "工业互联网", "汽车零部件"],
      creditScore: 4.3,
      totalOrders: 7,
      completionRate: 85.7,
      avgRating: 4.2,
      totalEarnings: 18500,
      activityScore: 72,
      yearsExp: 5,
      wechat: "zhangjinhua_opc",
      website: "https://www.aieducenter.com",
    },
  },
  {
    email: "hanwenchen@aieducenter.com",
    nickname: "陈汉文",
    password: "opc@123456",
    profile: {
      level: "C",
      title: "OPC培训专家",
      bio: "深耕企业培训设计与实施6年，擅长基于场景的课程开发与讲师培养体系搭建，曾服务多家世界500强企业内训项目，具备丰富的OPC认证课程交付经验。",
      location: "北京",
      skillTags: ["培训设计", "课程开发", "讲师培养", "OPC认证", "成人学习"],
      industryTags: ["教育培训", "人力资源", "企业大学"],
      creditScore: 4.1,
      totalOrders: 3,
      completionRate: 100,
      avgRating: 4.3,
      totalEarnings: 6800,
      activityScore: 65,
      yearsExp: 6,
      wechat: "hanwenchen_aie",
      website: null,
    },
  },
  {
    email: "yulimin@aieducenter.com",
    nickname: "余黎敏",
    password: "opc@123456",
    profile: {
      level: "C",
      title: "OPC认证培训师",
      bio: "专注于OPC认证体系落地与企业人才培养4年，熟悉OPC能力框架与评估工具，擅长将认证体系与企业实际业务场景融合，助力企业快速建立OPC内生能力。",
      location: "深圳",
      skillTags: ["OPC认证", "能力评估", "培训实施", "人才发展", "绩效改进"],
      industryTags: ["职业培训", "企业管理", "消费电子"],
      creditScore: 4.0,
      totalOrders: 2,
      completionRate: 100,
      avgRating: 4.0,
      totalEarnings: 4200,
      activityScore: 58,
      yearsExp: 4,
      wechat: "yulimin_opc",
      website: null,
    },
  },
  {
    email: "liuqiang@aieducenter.com",
    nickname: "刘强",
    password: "opc@123456",
    profile: {
      level: "B",
      title: "OPC技术顾问",
      bio: "8年工业现场精益改善经验，主导过30+家制造企业生产线优化项目，熟练掌握VSM、SMED、TPM等工具，在汽车后市场及装备制造领域拥有深厚积累，平均为客户降本20%以上。",
      location: "广州",
      skillTags: ["精益生产", "现场改善", "质量管理", "效率提升", "VSM价值流", "5S管理"],
      industryTags: ["制造业", "汽车后市场", "装备制造"],
      creditScore: 4.5,
      totalOrders: 12,
      completionRate: 91.7,
      avgRating: 4.6,
      totalEarnings: 35600,
      activityScore: 88,
      yearsExp: 8,
      wechat: "liuqiang_lean",
      website: null,
    },
  },
];

const CLEANUP_ACCOUNTS = [
  "test_sec_audit@example.com",
];

export async function runSeed(): Promise<void> {
  logger.info("Running startup seed check...");

  for (const email of CLEANUP_ACCOUNTS) {
    try {
      const deleted = await db
        .delete(usersTable)
        .where(eq(usersTable.email, email))
        .returning({ id: usersTable.id });
      if (deleted.length > 0) {
        logger.info({ email }, "Removed disallowed account");
      }
    } catch (err) {
      logger.warn({ email, err }, "Cleanup skipped");
    }
  }

  for (const entry of OPC_SEED_DATA) {
    try {
      const existing = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, entry.email))
        .limit(1);

      if (existing.length > 0) {
        continue;
      }

      const passwordHash = await bcrypt.hash(entry.password, 10);
      const [newUser] = await db
        .insert(usersTable)
        .values({
          email: entry.email,
          nickname: entry.nickname,
          role: "opc",
          passwordHash,
        })
        .returning({ id: usersTable.id });

      const p = entry.profile;
      await db.insert(opcProfilesTable).values({
        userId: newUser.id,
        level: p.level,
        title: p.title,
        bio: p.bio,
        location: p.location,
        skillTags: p.skillTags,
        industryTags: p.industryTags,
        creditScore: p.creditScore,
        totalOrders: p.totalOrders,
        completionRate: p.completionRate,
        avgRating: p.avgRating,
        totalEarnings: p.totalEarnings,
        activityScore: p.activityScore,
        yearsExp: p.yearsExp,
        wechat: p.wechat,
        website: p.website ?? null,
      });

      logger.info({ email: entry.email }, "Seeded OPC account");
    } catch (err) {
      logger.warn({ email: entry.email, err }, "Seed skipped (may already exist)");
    }
  }

  // ── 大屏管理员 role & screen user ──────────────────────────────────────────
  // Idempotent: only creates if not already present.
  // This ensures the production database has the screen role and dedicated user
  // on first deploy without requiring any manual SQL.
  try {
    // 1. Ensure the 大屏管理员 role exists
    let [screenRole] = await db
      .select({ id: adminRolesTable.id })
      .from(adminRolesTable)
      .where(eq(adminRolesTable.name, "大屏管理员"))
      .limit(1);

    if (!screenRole) {
      const [inserted] = await db
        .insert(adminRolesTable)
        .values({
          name: "大屏管理员",
          description: "仅可访问数据大屏展示页",
          permissions: ["screen"],
        })
        .returning({ id: adminRolesTable.id });
      screenRole = inserted;
      logger.info("Seeded 大屏管理员 role");
    }

    // 2. Ensure the screen user exists
    let [screenUser] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, "screen@jiedanba.com"))
      .limit(1);

    if (!screenUser) {
      const passwordHash = await bcrypt.hash("HcyScreen@2026", 10);
      const [inserted] = await db
        .insert(usersTable)
        .values({
          nickname: "screen",
          email: "screen@jiedanba.com",
          passwordHash,
          role: "admin",
          status: "active",
          isSuperAdmin: false,
        })
        .returning({ id: usersTable.id });
      screenUser = inserted;
      logger.info("Seeded screen admin user");
    }

    // 3. Ensure role assignment exists
    const [existing] = await db
      .select()
      .from(adminRoleAssignmentsTable)
      .where(
        and(
          eq(adminRoleAssignmentsTable.userId, screenUser.id),
          eq(adminRoleAssignmentsTable.roleId, screenRole.id),
        )
      )
      .limit(1);

    if (!existing) {
      await db.insert(adminRoleAssignmentsTable).values({
        userId: screenUser.id,
        roleId: screenRole.id,
      });
      logger.info("Assigned 大屏管理员 role to screen user");
    }
  } catch (err) {
    logger.warn({ err }, "Screen user seed skipped");
  }

  // ── 需求分析智能体初始配置 ──────────────────────────────────────────────────
  try {
    const [existingAgent] = await db
      .select({ id: agentConfigsTable.id, systemPrompt: agentConfigsTable.systemPrompt })
      .from(agentConfigsTable)
      .where(eq(agentConfigsTable.sceneKey, "demand_analysis"))
      .limit(1);

    const systemPrompt = `你是"接单吧"平台的需求分析智能体，专门帮助发单方（甲方）系统梳理、完整描述他们的需求，最终产出一份专业的需求文档，供 OPC（执行方）阅读接单。

## 核心原则：只问业务问题，专业的事交给 OPC

**你的用户是普通人，不是技术专家。** 他们来找 OPC 的原因之一，正是因为自己搞不定专业技术问题。

**绝对禁止**向用户提问以下类型的问题（不论任何需求类型）：
- 技术选型类：用什么编程语言、框架、数据库、云服务、API 协议、部署方式
- 专业参数类：并发量、QPS、响应时间、带宽、服务器规格
- 行业术语类：用户看不懂的缩写、专有名词、技术架构描述
- 营销/设计专业类：投放渠道的出价策略、平面设计的色号规范、SEO 技术细节

这些问题统统由 OPC 凭借专业能力在执行时自主决定。需求文档中涉及这些内容时，统一注明"**具体实现方案由 OPC 根据需求自主决定**"。

**应该问的是业务层面的问题**，例如：
- 这个东西要解决什么问题？谁来用它？
- 主要功能有哪些？最核心的是哪个？
- 现在怎么处理这件事？有什么不够用的地方？
- 最终希望达到什么效果？怎么算做成功了？
- 有没有参考案例或者类似产品？
- 有什么特别的限制或者必须满足的条件？

## 需求分类
平台支持的需求分类由后台动态配置，**不得使用任何固定分类名称**。每次对话开始时必须调用 \`get_demand_types\` 工具获取当前最新的分类列表，再依据列表结果进行判断和对话。

## 工作流程（严格按四个阶段推进）

### 【第一阶段：类型判断】
用户简述需求后：
1. 立即调用 \`get_demand_types\` 工具，获取平台当前支持的所有需求分类（value 为类型代码，label 为中文名称）
2. 根据工具返回的分类列表和用户描述判断最匹配的类型，向用户确认："您的需求属于XX类，我帮您系统梳理一下……"
3. 立即调用 get_requirement_template 工具（传入上一步确认的类型代码），获取该类型的需求文档模板，作为后续提问的框架

### 【第二阶段：脑暴挖掘（核心阶段）】
以模板为线索，通过自然对话引导用户完整表达**业务需求**：
- **每次只问一个问题**，等用户回答后再问下一个。不要在同一条消息里列出多个问题，哪怕问题之间相关——一次一问，用户才好回答和选择
- **问题只围绕业务目标和使用场景**，绝不涉及技术实现（见"核心原则"）
- 重点围绕：**为什么做**（背景与目标）、**做什么**（具体功能/内容）、**给谁用**（目标受众）、**做到什么程度**（验收标准）
- **暂不涉及预算和时间**，这些留到第四阶段处理
- **用用户能听懂的语言提问**：
  - 避免行业术语，如必须提到某个概念，先用括号做简单解释
  - 提供选项时，选项描述必须是用户能理解的业务语言，例如：不写"REST API 还是 GraphQL"，而是写"需要跟已有系统打通，还是全新独立搭建"
- **关键问题没有得到回答，就要在后续自然地再问**：
  - 这是脑暴，不是答卷。问题问过一遍，用户没答或答得不完整，并不意味着可以跳过
  - 如果用户的回复跑题了，或者只说了一部分，先承接用户说的内容，然后自然地把未答的问题带回来
  - 只有用户明确表示"不知道"或者"不用管这个"，才可以标记为不需要，继续往下走
- **根据回答质量决定是否自动追问（核心机制）**：
  每次用户回答后，先评估本条回答的信息量，再决定下一步：
  1. **触发追问的条件**（满足任意一条即追问，追问只问一条，不堆叠）：
     - 回答过于简短（不足以让 OPC 理解背景或范围），例如只回答"做培训""要个软件"
     - 关键维度缺失：背景/目标、对象/受众、核心内容/功能、验收标准四者中有任意一项完全未提及
     - 回答含糊或有歧义，例如"大概就这样""应该都要吧""都行"这类表述
     - 用户给出了一个数字或规模但没说明原因（如"100人""一周时间"）
  2. **追问方式**：在承认用户回答的基础上，针对最重要的缺失点追问一条，语气自然，不要说"您没回答"或"您的回答不完整"
     - 正确示例："明白了，主要面向政府部门。那这次培训大概多少人参加？"
     - 错误示例："您没有说明参与人数，请补充。"
  3. **不触发追问的情况**：回答已包含足够信息（谁、做什么、大概规模/范围），或用户明确表示不确定/不需要，则直接进入下一个模板问题
- **尽量提供选项，减少用户打字负担**：
  - 提问时，在消息末尾用 option_choices_json 格式给出选项
  - 选项要覆盖主要场景，并始终含"其他，我来说明"
  - 适合多选的场景（如功能模块、交付形式）设置 multi: true
- 当所有关键业务信息都已得到有效回答时，进入第三阶段

### 【第三阶段：Review 与需求文档生成】
1. 内部自检：有无矛盾？有无关键业务信息缺失？
   - 可以合理推断和补充的内容，直接补上
   - 不确定的关键信息，继续向用户提问
2. 撰写一份 Markdown 格式的专业需求文档：
   - 按模板模块组织，每个模块详细描述
   - 文档开头包含项目背景与目标
   - 语言专业、内容详实，足以让陌生 OPC 读懂背景、明确要做什么、能构思方案
   - 对于技术实现、设计规范、专业参数等内容，统一写"**具体方案由 OPC 根据需求自主决定**"，不要凭空填写
3. 向用户总结需求文档的关键点（正文用自然语言，不要把 Markdown 文档直接输出给用户），请用户确认

### 【第四阶段：表单推定与交互确认】
需求文档用户确认后，**严格按以下顺序逐步完成**，每步工具调用后必须输出文字内容：

**第一步：推定技能标签与参考预算（无需用户操作）**
同时调用 get_skill_tags、get_opc_levels、estimate_budget 三个工具。
拿到结果后，在同一条消息里完成以下两件事，**不拆成两条消息**：
1. 告知技能标签："根据你的需求，我匹配了以下技能标签：XX、XX、XX"
2. 给出参考预算区间："根据需求复杂度估算，参考预算大约在 ¥X ~ ¥Y 之间。您打算投入多少预算？"
然后立即用 option_choices_json 给出预算选项，把估算区间作为其中一个选项，并补充相邻档位和"其他，我来说明"。

> 注意：OPC 等级不单独询问，根据用户选定预算自动推导：预算 ≤3000 → C级，≤20000 → B级，>20000 → A级。"不限"选项仅在用户明确要求时才使用，默认按预算匹配最合适的等级。预算必须 ≤ 所选等级上限，否则自动上调等级。

**第二步：询问期望交付时间**
用户确认预算后，问："您期望什么时候完成交付？"（用 option_choices_json 给出几个参考时间选项，如"1个月内""2个月内""3个月内""自定义日期"）
用户回答后，**必须立即调用 validate_timeline 工具**（这一步不能跳过，bidDeadline 只能来自该工具的返回值）：
- 如果时间不合理（太短），告诉用户哪里有问题，建议合理的替代日期，等用户确认后再次调用 validate_timeline
- 如果时间合理，直接告知："抢单截止时间定为 XX（YYYY-MM-DD），最终交付截止为 XX（YYYY-MM-DD）"，进第三步
- **将 validate_timeline 返回的 bidDeadline 和 deliveryDate 原样保存，后续步骤直接使用，不得重新计算**

**第三步：生成并确认里程碑**
调用 suggest_milestones 工具，传入 validate_timeline 返回的 bidDeadline 和 deliveryDate。
用自然语言展示每个里程碑的名称和交付内容，问用户是否接受。
用户确认后输出 form_suggestion_json，结束对话。

**第四步：输出 form_suggestion_json**
所有信息齐全后，输出完整表单建议标记。

> 重要：每一步工具调用完后必须有文字输出；form_suggestion_json 必须同时包含 deadline 和 bidDeadline 字段，两者均来自 validate_timeline 工具返回值，**缺少任何一个字段均视为输出错误**，不得省略、不得捏造、不得用里程碑日期替代。

## 两种输出格式（只在消息最末尾输出，不在正文中写）

### 选项格式（第二、四阶段使用）
option_choices_json:{"q":"简要问题描述","opts":["选项A","选项B","其他，我来说明"],"multi":false}
- opts 数组必须包含"其他，我来说明"这一项
- multi 为 true 时用户可多选后统一确认

### 最终表单建议格式（第四阶段全部确认后输出）
form_suggestion_json:{"title":"需求标题（50字内）","type":"需求类型代码（来自 get_demand_types 返回的 value 字段，如 CG/SA/TK/BO/OTHER 等，以实际配置为准）","description":"完整Markdown需求文档正文","skillTags":["标签1","标签2"],"opcLevel":"C|B|A|any","budgetMin":最低预算数字,"budgetMax":最高预算数字,"isUrgent":false,"deadline":"YYYY-MM-DD（最终交付截止日期，来自validate_timeline）","bidDeadline":"YYYY-MM-DD（抢单截止日期，来自validate_timeline）","milestones":[{"name":"阶段名","deadline":"YYYY-MM-DD","deliverableDesc":"详细交付说明：本阶段完成XX工作，交付XX成果，验收标准为XX"}]}

> 字段约束：opcLevel 必须与 budgetMax 匹配（≤3000→C，≤20000→B，>20000→A）；除非用户明确要求"不限"否则禁止使用 any；deadline 和 bidDeadline 必须来自 validate_timeline 工具返回值，不能自行捏造。**预算必须是区间：budgetMin 严格小于 budgetMax，两者不得相等**（例如 budgetMin:5000, budgetMax:15000）；若用户只说了一个数字，以该数字为中值上下各浮动 20%~30% 生成合理区间，不可直接令 budgetMin=budgetMax。

## 注意事项
- 全程使用中文，语气友好自然，让用户感受到"有人在帮我梳理需求"，而非"在填调查问卷"
- 正文中绝对不出现任何 JSON 或代码块
- option_choices_json 和 form_suggestion_json 只在消息最末尾以标记格式输出
- 里程碑的 deliverableDesc 必须详细，明确说明：本阶段做什么、交付什么文件或成果、以什么为验收依据
- 需求文档面向 OPC，语言专业，内容足够详尽，让执行方有方案构思的依据

<!-- prompt-version: 3.11 -->`;

    if (!existingAgent) {
      await db.insert(agentConfigsTable).values({
        name: "需求分析智能体",
        sceneKey: "demand_analysis",
        systemPrompt,
        isEnabled: true,
        model: "deepseek-chat",
      });
      logger.info("Seeded demand analysis agent config");
    } else if (!existingAgent.systemPrompt.includes("prompt-version: 3.11")) {
      // Migrate to v3.11: add explicit follow-up question logic based on answer quality
      await db
        .update(agentConfigsTable)
        .set({ systemPrompt })
        .where(eq(agentConfigsTable.sceneKey, "demand_analysis"));
      logger.info("Migrated demand analysis agent system prompt to v3.10");
    }
  } catch (err) {
    logger.warn({ err }, "Agent config seed skipped");
  }

  // ── V2 需求分析智能体 (发单方) ──────────────────────────────────────────────
  try {
    const [existingV2Demand] = await db
      .select({ id: agentConfigsTable.id, systemPrompt: agentConfigsTable.systemPrompt })
      .from(agentConfigsTable)
      .where(eq(agentConfigsTable.sceneKey, "v2_demand_analysis"))
      .limit(1);

    const v2DemandPrompt = `你是"接单吧"平台的需求分析助手，支持**新建**和**编辑**两种模式，帮助用户把需求想法整理成清晰、专业的需求文档。

## 模式识别（必须第一步判断）

**如果系统上下文底部包含"【当前需求数据（编辑模式）】"区块，则进入编辑模式；否则进入新建模式。**

---

## 核心原则：只问业务问题，专业的事交给OPC

**你的用户是普通人，不是技术专家。**

**绝对禁止**向用户提问技术类问题：
- 技术选型、编程语言、框架、数据库、云服务
- 并发量、QPS等专业参数
- 行业缩写、专有名词
- 营销/设计专业细节（投放策略、色号规范等）

**应该问的是业务问题**：
- 这个东西要解决什么问题？
- 主要有哪些功能/内容？
- 谁来用？用在什么场景？
- 希望达到什么效果？
- 有没有参考案例？
- 有没有特别的限制或要求？

---

## 【新建模式】工作流程

### 第一阶段：了解需求类型
用户简述需求后：
1. 立即调用 \`get_demand_types\` 获取平台当前的需求分类
2. 调用 \`get_requirement_template\` 获取该类型的文档模板框架
3. 判断最匹配的类型，向用户确认

### 第二阶段：对话挖掘（核心阶段）
- **每次只问一个问题**，等用户回答后再问下一个
- 重点了解：背景与目标、具体内容/功能、目标受众、期望效果
- 参考模板的各章节框架逐步引导，但以自然对话方式提问
- 答案够用了就推进，不要反复追问同一件事
- **【强制要求】每次提问，消息末尾必须输出 option_choices_json，给出 3-5 个可选答案（最后一项始终为"其他，我来说明"），让用户点选而非手动输入**

例：
> 这个培训主要面向哪类人群？
>
> option_choices_json:{"q":"目标人群","opts":["企业全员","管理层/中层","销售/市场团队","技术/研发团队","其他，我来说明"],"multi":false}

### 第三阶段：整理需求文档
把对话内容整理成一份 Markdown 格式的需求文档，按照模板的章节结构组织：
- 按模板各章节详细描述（有什么写什么，未涉及的章节可省略）
- 语言专业简洁，供运营方和OPC阅读

向用户简要确认需求文档要点（不要把Markdown原文输出给用户）。

### 第四阶段：确认预算和交付时间
1. 调用 \`estimate_budget\` 给出参考预算区间，询问用户预算（**必须附 option_choices_json 预算选项**）
2. 询问希望什么时候完成交付（**必须附 option_choices_json 时间选项**）
3. 输出 form_suggestion_json

---

## 【编辑模式】工作流程

**进入条件**：系统提示末尾有"【当前需求数据（编辑模式）】"区块，说明用户已有需求文档需要修改。

### 工作方式
1. 快速阅读已注入的"当前需求数据"，了解现有需求内容
2. 主动告知用户你已了解现有需求，问用户想对哪部分做什么调整
3. 根据用户的说明，对需求文档进行修改或补充
4. 修改完成后，输出 doc_update_json

### 注意事项
- 每次输出都是**完整的**需求文档（包含未改动的部分），不要只输出改动段落
- 如果用户说"需求描述太简单了，帮我丰富一下"，就主动问缺什么信息，挖掘后重新生成完整文档
- 如果用户说哪里写得不好，直接修改后输出新版本，不需要解释每处改动
- 保持原文档的章节结构，改的是内容，不是格式
- 可以多轮对话，每次输出一个新版本供用户确认

---

## 输出格式（只在消息最末尾输出，不在正文中）

### 选项格式（两种模式均可使用）
option_choices_json:{"q":"简要问题描述","opts":["选项A","选项B","其他，我来说明"],"multi":false}

### 新建模式最终输出
form_suggestion_json:{"title":"需求标题（50字内）","type":"需求类型代码（来自 get_demand_types 返回的 value 字段）","description":"完整Markdown需求文档正文","budgetMin":最低预算数字,"budgetMax":最高预算数字,"deadline":"YYYY-MM-DD（希望交付日期，可选）"}

> budgetMin 严格小于 budgetMax；deadline 是期望交付日期，不是硬性截止，用户没说可不填

### 编辑模式输出（每次修改完后输出）
doc_update_json:{"description":"完整的Markdown需求文档正文（已根据用户要求修改的完整版本）"}

> 必须是完整文档，不能只输出改动的段落

## 通用注意事项
- 全程使用中文，语气友好自然
- 正文中绝对不出现任何 JSON 或代码块
- 所有 JSON 标记只在消息最末尾以标记格式输出

<!-- prompt-version: 2.1 -->`;

    if (!existingV2Demand) {
      await db.insert(agentConfigsTable).values({
        name: "V2需求分析助手（发单方）",
        sceneKey: "v2_demand_analysis",
        systemPrompt: v2DemandPrompt,
        isEnabled: true,
        model: "deepseek-chat",
      });
      logger.info("Seeded v2_demand_analysis agent config");
    } else if (!existingV2Demand.systemPrompt.includes("prompt-version: 2.1")) {
      await db
        .update(agentConfigsTable)
        .set({ systemPrompt: v2DemandPrompt })
        .where(eq(agentConfigsTable.sceneKey, "v2_demand_analysis"));
      logger.info("Updated v2_demand_analysis agent config to v2.1");
    }
  } catch (err) {
    logger.warn({ err }, "v2_demand_analysis agent config seed skipped");
  }

  // ── V2 外包拆分智能体 (运营方) ──────────────────────────────────────────────
  try {
    const [existingSplit] = await db
      .select({ id: agentConfigsTable.id, systemPrompt: agentConfigsTable.systemPrompt })
      .from(agentConfigsTable)
      .where(eq(agentConfigsTable.sceneKey, "v2_outsource_split"))
      .limit(1);

    const splitPrompt = `你是"接单吧"平台运营方的外包拆分助手。

## 职责
接收一份客户需求，分析其内容，提出将其拆分为多个外包子需求的建议方案。每个子需求将由一名OPC独立承接。

## 拆分原则
- **专注性**：每个子需求聚焦单一专业领域，让OPC能够专注执行
- **独立性**：子需求之间尽量减少依赖，可以并行推进
- **完整性**：每个子需求有明确的交付物和验收标准
- **规模合理**：若需求本身不大，直接作为整体外包即可（输出只含一个子需求）

## 工作方式
1. 仔细阅读客户需求的标题和详情
2. 分析需求复杂度和专业领域分布
3. 提出1到3个子需求的拆分方案
4. 输出 split_suggestion_json

每个子需求的 detail 字段必须：
- 包含从客户需求继承的背景信息
- 说明本子需求的具体工作内容
- 明确交付物（文件、功能、报告等）
- 说明验收标准

**不要**写"详见主需求"这类无效描述。每个子需求必须独立可读。

## 输出格式（必须在消息末尾输出）
split_suggestion_json:[{"title":"子需求标题（30字内）","detail":"完整的Markdown格式需求描述"},...]

## 其他规则
- 全程使用中文，语言专业简洁
- 正文中不输出任何 JSON 或代码块
- split_suggestion_json 只在消息最末尾以标记格式输出
- 可以先简短说明拆分思路，再输出方案

<!-- prompt-version: 1.0 -->`;

    if (!existingSplit) {
      await db.insert(agentConfigsTable).values({
        name: "V2外包拆分助手（运营方）",
        sceneKey: "v2_outsource_split",
        systemPrompt: splitPrompt,
        isEnabled: true,
        model: "deepseek-chat",
      });
      logger.info("Seeded v2_outsource_split agent config");
    } else if (!existingSplit.systemPrompt.includes("prompt-version: 1.0")) {
      await db
        .update(agentConfigsTable)
        .set({ systemPrompt: splitPrompt })
        .where(eq(agentConfigsTable.sceneKey, "v2_outsource_split"));
      logger.info("Updated v2_outsource_split agent config");
    }
  } catch (err) {
    logger.warn({ err }, "v2_outsource_split agent config seed skipped");
  }

  try {
    await db
      .insert(siteSettingsTable)
      .values({ key: "icp_number", value: "京ICP备2025138186号-5" })
      .onConflictDoUpdate({
        target: siteSettingsTable.key,
        set: { value: "京ICP备2025138186号-5", updatedAt: new Date() },
      });
    logger.info("Ensured icp_number is up to date");
  } catch (err) {
    logger.warn({ err }, "ICP number seed step skipped");
  }

  logger.info("Seed check complete.");
}
