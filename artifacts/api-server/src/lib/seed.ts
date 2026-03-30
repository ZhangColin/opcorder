import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  usersTable,
  opcProfilesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
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

export async function runSeed(): Promise<void> {
  logger.info("Running startup seed check...");

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

  logger.info("Seed check complete.");
}
