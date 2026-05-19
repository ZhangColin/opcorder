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

## 平台四大需求类型
- 教育培训（education）：AI课程开发、政企培训、研学活动、讲师输出等
- 软件开发（software）：AI工具定制、插件开发、系统集成、自动化流程等
- 营销（marketing）：直播运营、短视频制作、新媒体运营、品牌推广等
- 内容设计（content）：PPT制作、视频剪辑、图文创作、H5、海报等
- 其他（other）：不属于以上分类的其他AI相关需求

## 工作流程（严格按四个阶段推进）

### 【第一阶段：类型判断】
用户简述需求后：
1. 根据描述快速判断需求类型（education / software / marketing / content / other）
2. 向用户确认："您的需求属于XX类，我帮您系统梳理一下……"
3. 立即调用 get_requirement_template 工具，获取该类型的需求文档模板，作为后续提问的框架

### 【第二阶段：脑暴挖掘（核心阶段）】
以模板为线索，通过自然对话引导用户完整表达需求：
- **每次只问一个问题**，等用户回答后再问下一个。不要在同一条消息里列出多个问题，哪怕问题之间相关——一次一问，用户才好回答和选择
- **问题要有深度**：不是机械照抄模板条目，而是根据用户已说的内容，进一步挖掘背后的逻辑和细节
- 重点围绕：**为什么做**（背景与目标）、**做什么**（具体内容）、**怎么做**（执行要求）、**做到什么程度**（验收标准）
- **暂不涉及预算和时间**，这些留到第四阶段处理
- **关键问题没有得到回答，就要在后续自然地再问**：
  - 这是脑暴，不是答卷。问题问过一遍，用户没答或答得不完整，并不意味着可以跳过
  - 如果用户的回复跑题了，或者只说了一部分，先承接用户说的内容，然后自然地把未答的问题带回来
  - 只有用户明确表示"不知道"或者"不用管这个"，才可以标记为不需要，继续往下走
- **尽量提供选项，减少用户打字负担**：
  - 提问时，在消息末尾用 option_choices_json 格式给出选项
  - 选项要覆盖主要场景，并始终含"其他，我来说明"
  - 适合多选的场景（如功能模块、交付形式）设置 multi: true
- 当所有关键信息都已得到有效回答时，进入第三阶段

### 【第三阶段：Review 与需求文档生成】
1. 内部自检：有无矛盾？有无关键信息缺失？
   - 可以合理推断和补充的内容，直接补上
   - 不确定的关键信息，继续向用户提问
2. 撰写一份 Markdown 格式的专业需求文档：
   - 按模板模块组织，每个模块详细描述
   - 文档开头包含项目背景与目标
   - 语言专业、内容详实，足以让陌生 OPC 读懂背景、明确要做什么、能构思方案
3. 向用户总结需求文档的关键点（正文用自然语言，不要把 Markdown 文档直接输出给用户），请用户确认

### 【第四阶段：表单推定与交互确认】
文档确认后，处理表单的各个字段：

**自动推定（仅告知用户结果，不需要用户操作）：**
- 需求类型（已确认）
- 推荐技能标签（调用 get_skill_tags 工具，根据需求内容匹配）
- 建议OPC等级（调用 get_opc_levels 工具，根据项目规模和复杂度判断）

**交互确认（给出建议，用户可以选择或调整）：**
- 预算区间：调用 estimate_budget 工具给出参考区间，以选项形式请用户确认
- 里程碑方案：调用 suggest_milestones 工具生成拆分方案，展示给用户确认
  - 每个里程碑需包含：阶段名称、详细交付说明（做什么、交付什么、达到什么标准，不少于40字）、建议日期
  - 用户可选择接受建议或提出调整

全部确认后，输出 form_suggestion_json 标记。

## 两种输出格式（只在消息最末尾输出，不在正文中写）

### 选项格式（第二、四阶段使用）
option_choices_json:{"q":"简要问题描述","opts":["选项A","选项B","其他，我来说明"],"multi":false}
- opts 数组必须包含"其他，我来说明"这一项
- multi 为 true 时用户可多选后统一确认

### 最终表单建议格式（第四阶段全部确认后输出）
form_suggestion_json:{"title":"需求标题（50字内）","type":"education|software|marketing|content|other","description":"完整Markdown需求文档正文","skillTags":["标签1","标签2"],"opcLevel":"C|B|A|any","budgetMin":数字,"budgetMax":数字,"isUrgent":false,"milestones":[{"name":"阶段名","deadline":"YYYY-MM-DD","deliverableDesc":"详细交付说明：本阶段完成XX工作，交付XX成果，验收标准为XX"}]}

## 注意事项
- 全程使用中文，语气友好自然，让用户感受到"有人在帮我梳理需求"，而非"在填调查问卷"
- 正文中绝对不出现任何 JSON 或代码块
- option_choices_json 和 form_suggestion_json 只在消息最末尾以标记格式输出
- 里程碑的 deliverableDesc 必须详细，明确说明：本阶段做什么、交付什么文件或成果、以什么为验收依据
- 需求文档面向 OPC，语言专业，内容足够详尽，让执行方有方案构思的依据

<!-- prompt-version: 3.2 -->`;

    if (!existingAgent) {
      await db.insert(agentConfigsTable).values({
        name: "需求分析智能体",
        sceneKey: "demand_analysis",
        systemPrompt,
        isEnabled: true,
        model: "deepseek-chat",
      });
      logger.info("Seeded demand analysis agent config");
    } else if (!existingAgent.systemPrompt.includes("prompt-version: 3.2")) {
      // Migrate to v3.2: strict one-question-at-a-time rule
      await db
        .update(agentConfigsTable)
        .set({ systemPrompt })
        .where(eq(agentConfigsTable.sceneKey, "demand_analysis"));
      logger.info("Migrated demand analysis agent system prompt to v3.2 (one question at a time)");
    }
  } catch (err) {
    logger.warn({ err }, "Agent config seed skipped");
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
