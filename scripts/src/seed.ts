import { db, pool } from "@workspace/db";
import {
  usersTable, opcProfilesTable, demandsTable, bidsTable,
  ordersTable, deliverablesTable, portfoliosTable, notificationsTable
} from "@workspace/db/schema";

async function seed() {
  console.log("Seeding database...");

  await db.delete(notificationsTable);
  await db.delete(deliverablesTable);
  await db.delete(ordersTable);
  await db.delete(bidsTable);
  await db.delete(demandsTable);
  await db.delete(portfoliosTable);
  await db.delete(opcProfilesTable);
  await db.delete(usersTable);

  const users = await db.insert(usersTable).values([
    { nickname: "海创元运营团队", phone: "13800138001", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=HCY", role: "publisher" },
    { nickname: "张明远", phone: "13800138002", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=ZMY", role: "opc" },
    { nickname: "李思齐", phone: "13800138003", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=LSQ", role: "opc" },
    { nickname: "王雅琴", phone: "13800138004", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=WYQ", role: "opc" },
    { nickname: "陈志豪", phone: "13800138005", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=CZH", role: "opc" },
    { nickname: "刘芳华", phone: "13800138006", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=LFH", role: "opc" },
    { nickname: "赵文博", phone: "13800138007", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=ZWB", role: "opc" },
    { nickname: "孙海燕", phone: "13800138008", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=SHY", role: "opc" },
    { nickname: "平台管理员", phone: "13800138000", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=ADM", role: "admin" },
  ]).returning();

  const opcUsers = users.filter(u => u.role === "opc");
  await db.insert(opcProfilesTable).values([
    {
      userId: opcUsers[0].id, level: "A",
      bio: "全栈AI应用开发专家，擅长Vibe Coding与企业级AI工具开发，5年政企项目经验",
      skillTags: ["AI应用开发", "Web开发", "提示词工程", "Vibe Coding"],
      industryTags: ["AI教育", "政务", "企业培训"],
      creditScore: 4.8, totalOrders: 28, completionRate: 96.4, avgRating: 4.9, totalEarnings: 385000, activityScore: 99,
    },
    {
      userId: opcUsers[1].id, level: "B",
      bio: "资深PPT设计师，课件制作与培训材料设计专家",
      skillTags: ["PPT设计", "课件制作", "文案撰写", "教案设计"],
      industryTags: ["AI教育", "企业培训", "研学"],
      creditScore: 4.5, totalOrders: 19, completionRate: 94.7, avgRating: 4.7, totalEarnings: 156000, activityScore: 98,
    },
    {
      userId: opcUsers[2].id, level: "A",
      bio: "短视频与直播运营达人，服务过30+品牌的新媒体运营",
      skillTags: ["短视频制作", "直播运营", "视频剪辑", "文案撰写"],
      industryTags: ["新媒体", "营销", "企业培训"],
      creditScore: 4.7, totalOrders: 35, completionRate: 97.1, avgRating: 4.8, totalEarnings: 290000, activityScore: 96,
    },
    {
      userId: opcUsers[3].id, level: "B",
      bio: "数据分析与AI工具开发，Python/JS全栈能力",
      skillTags: ["AI应用开发", "数据处理", "Web开发", "小程序开发"],
      industryTags: ["AI教育", "政务"],
      creditScore: 4.3, totalOrders: 12, completionRate: 91.7, avgRating: 4.4, totalEarnings: 98000, activityScore: 88,
    },
    {
      userId: opcUsers[4].id, level: "C",
      bio: "新人OPC，热爱AI教育，正在快速成长中",
      skillTags: ["PPT设计", "文案撰写", "数据处理"],
      industryTags: ["AI教育"],
      creditScore: 4.0, totalOrders: 3, completionRate: 100, avgRating: 4.2, totalEarnings: 8500, activityScore: 75,
    },
    {
      userId: opcUsers[5].id, level: "B",
      bio: "党建数字化项目专家，有丰富的政企合作经验",
      skillTags: ["AI应用开发", "Web开发", "教案设计", "小程序开发"],
      industryTags: ["党建", "政务", "企业培训"],
      creditScore: 4.6, totalOrders: 22, completionRate: 95.5, avgRating: 4.6, totalEarnings: 210000, activityScore: 92,
    },
  ]);

  const publisher = users.find(u => u.role === "publisher")!;

  const demands = await db.insert(demandsTable).values([
    {
      demandNo: "JDB-202603-0001", title: "AI教育课程体系开发",
      type: "ai_education", description: "为某市教育局开发K12阶段AI教育课程体系，包含教学大纲、课件、实践案例，共6个模块。需要有AI教育行业经验，熟悉课程设计方法论。",
      skillTags: ["课件制作", "教案设计", "AI应用开发", "PPT设计"],
      opcLevel: "A", budgetMin: 50000, budgetMax: 80000,
      deadline: "2026-05-15",
      milestones: [
        { name: "课程大纲设计", deadline: "2026-04-10", deliverableDesc: "完成6模块课程大纲" },
        { name: "课件制作", deadline: "2026-04-30", deliverableDesc: "完成全部课件PPT" },
        { name: "实践案例开发", deadline: "2026-05-15", deliverableDesc: "完成配套实践案例" },
      ],
      mode: "open", status: "published", isUrgent: false,
      bidDeadline: new Date("2026-04-05T18:00:00Z"),
      publisherId: publisher.id,
    },
    {
      demandNo: "JDB-202603-0002", title: "政企AI培训方案设计与授课",
      type: "gov_training", description: "为某区政府部门设计AI应用培训方案，包含理论课程和实操环节。培训对象为政府工作人员，需通俗易懂。共2天培训，含课件+现场授课。",
      skillTags: ["教案设计", "PPT设计", "AI应用开发", "提示词工程"],
      opcLevel: "B", budgetMin: 15000, budgetMax: 25000,
      deadline: "2026-04-20",
      milestones: [
        { name: "培训方案设计", deadline: "2026-04-08", deliverableDesc: "完成培训大纲和日程安排" },
        { name: "课件交付", deadline: "2026-04-15", deliverableDesc: "完成全部培训课件" },
      ],
      mode: "open", status: "published", isUrgent: true,
      bidDeadline: new Date("2026-04-01T18:00:00Z"),
      publisherId: publisher.id,
    },
    {
      demandNo: "JDB-202603-0003", title: "AI研学基地宣传视频制作",
      type: "ai_research", description: "为原点AI研学基地制作3分钟宣传视频，包含基地介绍、课程亮点、学员体验等内容。需要前期策划脚本+拍摄+后期剪辑。",
      skillTags: ["视频剪辑", "短视频制作", "文案撰写"],
      opcLevel: "B", budgetMin: 8000, budgetMax: 15000,
      deadline: "2026-04-25",
      milestones: [
        { name: "脚本策划", deadline: "2026-04-10", deliverableDesc: "完成视频脚本和分镜" },
        { name: "成片交付", deadline: "2026-04-25", deliverableDesc: "完成最终成片" },
      ],
      mode: "open", status: "published", isUrgent: false,
      bidDeadline: new Date("2026-04-08T18:00:00Z"),
      publisherId: publisher.id,
    },
    {
      demandNo: "JDB-202603-0004", title: "党建AI应用小程序开发",
      type: "party_building", description: "开发一款党建学习AI助手小程序，支持知识问答、学习计划推荐、在线测试等功能。需要有小程序开发经验和AI集成能力。",
      skillTags: ["小程序开发", "AI应用开发", "Web开发"],
      opcLevel: "A", budgetMin: 80000, budgetMax: 120000,
      deadline: "2026-06-30",
      milestones: [
        { name: "需求分析与原型", deadline: "2026-04-30", deliverableDesc: "完成需求文档和原型设计" },
        { name: "核心功能开发", deadline: "2026-05-31", deliverableDesc: "完成核心功能开发" },
        { name: "测试与上线", deadline: "2026-06-30", deliverableDesc: "完成测试并上线" },
      ],
      mode: "directed", status: "published", isUrgent: false,
      bidDeadline: new Date("2026-04-15T18:00:00Z"),
      publisherId: publisher.id,
    },
    {
      demandNo: "JDB-202603-0005", title: "企业直播带货方案策划",
      type: "livestream_media", description: "为某电商企业策划AI赋能的直播带货方案，包含直播脚本、话术设计、AI工具配置方案。需了解直播行业和AI工具应用。",
      skillTags: ["直播运营", "文案撰写", "AI应用开发", "短视频制作"],
      opcLevel: "B", budgetMin: 10000, budgetMax: 20000,
      deadline: "2026-04-18",
      milestones: [
        { name: "方案策划", deadline: "2026-04-10", deliverableDesc: "完成直播方案全案" },
        { name: "话术与脚本", deadline: "2026-04-18", deliverableDesc: "完成直播话术和脚本模板" },
      ],
      mode: "open", status: "published", isUrgent: true,
      bidDeadline: new Date("2026-04-05T18:00:00Z"),
      publisherId: publisher.id,
    },
    {
      demandNo: "JDB-202603-0006", title: "AI智能客服系统定制开发",
      type: "ai_tool_dev", description: "为企业客户定制AI智能客服系统，支持多轮对话、知识库管理、工单生成。需要LLM集成经验和Web开发能力。",
      skillTags: ["AI应用开发", "Web开发", "提示词工程", "数据处理"],
      opcLevel: "A", budgetMin: 60000, budgetMax: 100000,
      deadline: "2026-06-15",
      milestones: [
        { name: "系统设计", deadline: "2026-04-20", deliverableDesc: "完成系统架构设计和技术方案" },
        { name: "核心开发", deadline: "2026-05-20", deliverableDesc: "完成核心对话引擎开发" },
        { name: "集成测试", deadline: "2026-06-15", deliverableDesc: "完成系统集成和测试" },
      ],
      mode: "open", status: "published", isUrgent: false,
      bidDeadline: new Date("2026-04-10T18:00:00Z"),
      publisherId: publisher.id,
    },
    {
      demandNo: "JDB-202603-0007", title: "社区运营数据分析报告",
      type: "other", description: "对OPC社区过去6个月的运营数据进行分析，产出数据分析报告，包含用户活跃度、订单转化率、收入趋势等分析维度。",
      skillTags: ["数据处理", "PPT设计", "文案撰写"],
      opcLevel: "C", budgetMin: 3000, budgetMax: 5000,
      deadline: "2026-04-12",
      milestones: [],
      mode: "open", status: "published", isUrgent: false,
      bidDeadline: new Date("2026-04-08T18:00:00Z"),
      publisherId: publisher.id,
    },
    {
      demandNo: "JDB-202603-0008", title: "AI提示词工程培训课件开发",
      type: "ai_education", description: "开发一套AI提示词工程培训课件（8学时），面向OPC社区成员。内容需涵盖提示词基础、高级技巧、实际应用案例。",
      skillTags: ["课件制作", "提示词工程", "教案设计", "PPT设计"],
      opcLevel: "B", budgetMin: 12000, budgetMax: 18000,
      deadline: "2026-04-28",
      milestones: [
        { name: "课程大纲", deadline: "2026-04-15", deliverableDesc: "完成课程大纲和教学目标" },
        { name: "课件成品", deadline: "2026-04-28", deliverableDesc: "完成全部PPT课件和教案" },
      ],
      mode: "open", status: "published", isUrgent: false,
      bidDeadline: new Date("2026-04-12T18:00:00Z"),
      publisherId: publisher.id,
    },
  ]).returning();

  const orders = await db.insert(ordersTable).values([
    {
      orderNo: "ORD-202603-0001",
      demandId: demands[0].id, opcId: opcUsers[0].id, publisherId: publisher.id,
      amount: 75000, opcShare: 45000, publisherShare: 22500, platformFee: 7500,
      status: "in_progress",
      milestones: demands[0].milestones,
      deadline: "2026-05-15",
    },
    {
      orderNo: "ORD-202602-0001",
      demandId: demands[1].id, opcId: opcUsers[1].id, publisherId: publisher.id,
      amount: 20000, opcShare: 12000, publisherShare: 6000, platformFee: 2000,
      status: "pending_acceptance",
      milestones: demands[1].milestones,
      deadline: "2026-04-20",
    },
    {
      orderNo: "ORD-202602-0002",
      demandId: demands[2].id, opcId: opcUsers[2].id, publisherId: publisher.id,
      amount: 12000, opcShare: 7200, publisherShare: 3600, platformFee: 1200,
      status: "completed", rating: 4.8, reviewComment: "视频制作质量很高，完美呈现了基地的亮点！",
      milestones: demands[2].milestones,
      deadline: "2026-04-25",
    },
  ]).returning();

  await db.insert(deliverablesTable).values([
    {
      orderId: orders[1].id, milestoneId: 1, title: "培训方案设计文档",
      description: "完成2天培训方案设计，包含课程安排、实操环节设计", status: "approved",
    },
    {
      orderId: orders[1].id, milestoneId: 2, title: "培训课件PPT",
      description: "完成全部8个章节的培训课件PPT", status: "submitted",
    },
  ]);

  await db.insert(portfoliosTable).values([
    {
      userId: opcUsers[0].id, title: "智慧城市AI管理平台",
      type: "AI工具开发", description: "为某市打造的智慧城市AI管理平台，集成多个AI服务模块",
      rating: 4.9, clientFeedback: "技术实力过硬，交付质量优秀",
    },
    {
      userId: opcUsers[0].id, title: "企业培训AI课程系统",
      type: "AI教育", description: "面向大型企业的AI培训课程管理系统，支持个性化学习路径推荐",
      rating: 4.8, clientFeedback: "系统设计合理，用户体验好",
    },
    {
      userId: opcUsers[1].id, title: "AI教育系列课件",
      type: "课件设计", description: "为教育机构设计的系列AI教育课件，覆盖小学到高中各年级",
      rating: 4.7, clientFeedback: "课件设计精美，内容丰富",
    },
    {
      userId: opcUsers[2].id, title: "科技园区宣传片",
      type: "视频制作", description: "某国家级科技园区宣传片制作，3分钟精品短视频",
      rating: 4.9, clientFeedback: "画面精美，故事性强",
    },
  ]);

  await db.insert(notificationsTable).values([
    {
      userId: opcUsers[0].id, type: "order_created", title: "新订单已生成",
      content: "您已成功接单「AI教育课程体系开发」，请按时交付", isRead: false,
      relatedId: orders[0].id, relatedType: "order",
    },
    {
      userId: opcUsers[0].id, type: "system", title: "欢迎加入接单吧",
      content: "恭喜您成为接单吧平台A级OPC，您可以接受定向派单和高价值项目", isRead: true,
    },
    {
      userId: opcUsers[0].id, type: "bid_accepted", title: "抢单申请已通过",
      content: "您对「AI教育课程体系开发」的抢单申请已被发单方确认", isRead: true,
      relatedId: demands[0].id, relatedType: "demand",
    },
    {
      userId: opcUsers[1].id, type: "delivery_submitted", title: "交付物已提交",
      content: "您的交付物「培训课件PPT」已成功提交，等待发单方审核", isRead: false,
      relatedId: orders[1].id, relatedType: "order",
    },
    {
      userId: opcUsers[0].id, type: "directed_invite", title: "收到定向派单邀约",
      content: "海创元运营团队邀请您承接「党建AI应用小程序开发」项目", isRead: false,
      relatedId: demands[3].id, relatedType: "demand",
    },
  ]);

  console.log("Seed completed successfully!");
  console.log(`Created ${users.length} users, ${demands.length} demands, ${orders.length} orders`);
  await pool.end();
}

seed().catch(console.error);
