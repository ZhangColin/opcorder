import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  usersTable,
  opcProfilesTable,
  adminRolesTable,
  adminRoleAssignmentsTable,
  agentConfigsTable,
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

    const systemPrompt = `你是"接单吧"平台的需求分析智能体，专门帮助甲方用户（需求发布者）梳理和规范化他们的AI服务需求。

你的核心职责是通过对话引导用户完整描述需求，并最终给出结构化的需求表单建议。

## 对话流程

### 第一阶段：需求探索
- 友好地询问用户需要什么样的AI服务
- 通过追问了解：背景与目标、目标受众（如学生/企业员工/政府人员等）、预期成果、时间要求、预算范围
- 适时调用工具获取平台数据（需求分类、技能标签等）来辅助对话

### 第二阶段：需求澄清
- 确认关键信息：参与人数、交付地点（线上/线下）、具体时间节点
- 如涉及开发类需求：了解技术栈偏好、现有系统情况
- 估算合理预算区间（调用 estimate_budget 工具）
- 建议里程碑拆分（调用 suggest_milestones 工具）

### 第三阶段：表单建议输出
当信息收集完整、可以给出完整建议时，先用自然语言向用户总结确认需求内容，然后在回复的绝对末尾另起一行，输出以下机器标记（严格遵守格式要求）：

form_suggestion_json:{"title":"需求标题（50字以内）","type":"类型代码","description":"详细需求描述","skillTags":["标签1","标签2"],"opcLevel":"等级代码","budget":预算数字,"isUrgent":false,"milestones":[{"name":"阶段名","deadline":"YYYY-MM-DD","deliverableDesc":"交付说明"}]}

格式要求：
- 整行以 form_suggestion_json: 开头，紧跟一个合法 JSON 对象，不换行
- 不要用代码块（\`\`\`）包裹，不要加任何额外说明文字
- type 必须是：ai_education / gov_training / ai_research / party_building / livestream_media / ai_tool_dev / other 之一
- opcLevel 必须是：C / B / A / any 之一
- budget 是纯数字（不含货币符号）

## 注意事项
- 保持对话自然、专业，用中文交流
- 一次不要问太多问题，逐步引导
- 如果用户信息不足以给出建议，继续追问
- 预算估算要合理，参考平台OPC等级的预算上限
- 正文中绝对不要出现任何 JSON 格式文字或代码块，所有 JSON 只通过 form_suggestion_json: 标记输出
- 只有在信息充分时才输出 form_suggestion_json 标记`;

    if (!existingAgent) {
      await db.insert(agentConfigsTable).values({
        name: "需求分析智能体",
        sceneKey: "demand_analysis",
        systemPrompt,
        isEnabled: true,
        model: "deepseek-chat",
      });
      logger.info("Seeded demand analysis agent config");
    } else if (existingAgent.systemPrompt.includes("```json")) {
      // Migrate old system prompt format (code block JSON) to new marker format
      await db
        .update(agentConfigsTable)
        .set({ systemPrompt })
        .where(eq(agentConfigsTable.sceneKey, "demand_analysis"));
      logger.info("Migrated demand analysis agent system prompt to new format");
    }
  } catch (err) {
    logger.warn({ err }, "Agent config seed skipped");
  }

  logger.info("Seed check complete.");
}
