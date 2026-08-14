/**
 * 演示智能体 + 使用记录种子（迁移 064 调用,开发与生产各执行一次）。
 *
 * 为主演示账号张锦华创建「生图」「编程」两个智能体（会议纪要智能体不存在时补建）,
 * 并为三者灌入真实感的使用历史,供演示/录屏使用。
 * 时间遵循北京时间裸存储约定(北京墙上时间按 UTC 存)。
 */
import { db } from "@workspace/db";
import { usersTable, toolAgentsTable, toolAgentConversationsTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const bj = (s: string) => new Date(s.replace(" ", "T") + ":00Z");
const at = (s: string) => bj(s).toISOString();

type Msg = { role: "user" | "assistant"; content: string; at: string };

export async function seedDemoAgentUsage(db: Tx): Promise<void> {
  const [zjhRow] = await db.select({ id: usersTable.id }).from(usersTable)
    .where(inArray(usersTable.email, ["zhangjinhua@aieducenter.com"]));
  if (!zjhRow) throw new Error("Demo agent seed prerequisites missing: zhangjinhua account not found");
  const zjh = zjhRow.id;

  async function ensureAgent(v: {
    name: string; appType: string; description: string; category: string;
    tags: string[]; publishedAt: Date; createdAt: Date;
  }): Promise<number> {
    const [existing] = await db.select({ id: toolAgentsTable.id }).from(toolAgentsTable)
      .where(and(eq(toolAgentsTable.ownerId, zjh), eq(toolAgentsTable.name, v.name)));
    if (existing) return existing.id;
    const [created] = await db.insert(toolAgentsTable).values({
      ownerId: zjh, name: v.name, appType: v.appType, description: v.description,
      category: v.category, tags: v.tags, shareStatus: "published",
      priceFenPerMonth: 0, publishedAt: v.publishedAt, createdAt: v.createdAt, updatedAt: v.publishedAt,
    }).returning({ id: toolAgentsTable.id });
    return created.id;
  }

  const drawId = await ensureAgent({
    name: "AI 生图助手",
    appType: "agent",
    description: "根据一句话需求生成专业级 AI 绘画方案:输出中英文提示词(Prompt)、负向提示词、构图与光影建议、推荐出图参数(模型/比例/步数),覆盖电商海报、插画、Logo、产品渲染等场景。",
    category: "创意绘画",
    tags: ["生图", "提示词", "海报设计"],
    publishedAt: bj("2026-08-08 10:00"), createdAt: bj("2026-08-08 09:30"),
  });

  const codeId = await ensureAgent({
    name: "编程助手 CodeMate",
    appType: "agent",
    description: "面向开发者的编程专家:定位与修复 Bug、代码审查与重构建议、SQL 优化、编写单元测试。粘贴代码与报错信息,直接给出可运行的修复代码与逐行解释,支持 JS/TS、Python、Java、SQL。",
    category: "商务办公",
    tags: ["编程", "调试", "代码审查"],
    publishedAt: bj("2026-08-08 10:05"), createdAt: bj("2026-08-08 09:40"),
  });

  const meetingId = await ensureAgent({
    name: "会议纪要整理模板",
    appType: "agent",
    description: "把口语化的会议录音转写文本一键整理成结构化会议纪要:自动提炼议题、结论、待办事项(责任人+截止时间),支持周例会、项目评审、客户沟通等场景。",
    category: "商务办公",
    tags: ["会议纪要", "待办提取", "效率办公"],
    publishedAt: bj("2026-08-05 14:00"), createdAt: bj("2026-08-05 13:30"),
  });

  const convos: { agentId: number; title: string; messages: Msg[]; createdAt: Date; updatedAt: Date }[] = [
    // ── AI 生图助手 ──
    {
      agentId: drawId,
      title: "帮我做一张 828 大促的电商海报图",
      createdAt: bj("2026-08-11 10:12"), updatedAt: bj("2026-08-11 10:15"),
      messages: [
        { role: "user", at: at("2026-08-11 10:12"), content: "帮我做一张 828 大促的电商海报图，卖的是无线吸尘器，主色调橙色，要有科技感" },
        { role: "assistant", at: at("2026-08-11 10:13"), content: "已为你生成 828 大促海报的完整生图方案：\n\n## 一、正向提示词（英文，直接可用）\n```\nE-commerce promotional poster, cordless vacuum cleaner as hero product, floating in center with dynamic dust particles being absorbed, vibrant orange (#FF6A00) gradient background, futuristic tech style, glowing neon light trails, bold Chinese sale typography area reserved at top, studio lighting, ultra detailed product rendering, 8k, commercial photography\n```\n\n## 二、负向提示词\n```\nblurry, low quality, watermark, text artifacts, deformed product, cluttered background, dull colors\n```\n\n## 三、构图与光影建议\n| 要素 | 建议 |\n|---|---|\n| 构图 | 中心构图,产品悬浮 15° 倾斜,顶部预留 1/4 放「828 狂欢购」大字 |\n| 光影 | 主光左上 45° 冷白光突出金属质感,背景橙色渐变由深到浅 |\n| 点缀 | 吸入的粒子光轨从右下汇入吸尘器,强化「吸力」卖点 |\n\n## 四、推荐出图参数\n- 比例：3:4（主图）/ 16:9（首页 banner）\n- 采样步数：30-35，CFG 7\n\n> 下一步：告诉我海报上要放的促销文案与价格,我可以帮你调整文字排版区域的构图。" },
        { role: "user", at: at("2026-08-11 10:14"), content: "文案是「828狂欢购 直降600元」，帮我把文案融进方案" },
        { role: "assistant", at: at("2026-08-11 10:15"), content: "已更新方案（文字区域强化版）：\n\n## 排版建议\n1. **主标题**「828狂欢购」— 顶部居中,超粗黑体,白色描橙边,占画面宽度 70%\n2. **副标题**「直降600元」— 主标题正下方,做成橙底白字的爆炸贴纸样式,旋转 -8°\n3. 产品下方加一条细光带,放次要信息（如「限时3天」）\n\n## 提示词追加片段\n```\n..., large bold Chinese title \"828狂欢购\" at top center with orange outline, explosive price tag sticker \"直降600元\" below title, promotional badge style\n```\n\n注意：生图模型对中文字渲染不稳定,建议**出图后用设计工具叠加文字**,提示词中仅预留排版空间即可。需要我再出一版 16:9 首页 banner 的构图方案吗？" },
        { role: "user", at: at("2026-08-11 10:16"), content: "不用了，直接按这个方案帮我出图" },
        { role: "assistant", at: at("2026-08-11 10:17"), content: "已按方案完成出图（3:4 主图,顶部已预留标题排版区）：\n\n![828大促吸尘器海报](/demo/agent-draw-vacuum-poster.jpg)\n\n**出图说明**\n- 产品居中悬浮 15°,粒子光轨从右下汇入,突出吸力卖点\n- 橙色渐变背景 + 冷白主光,金属质感与科技感兼顾\n- 顶部留白区域可直接叠加「828狂欢购 直降600元」文案\n\n如需调整（换角度/改配色/出 16:9 banner 版）,直接告诉我。" },
      ],
    },
    {
      agentId: drawId,
      title: "公司年会邀请函背景图，国风一点",
      createdAt: bj("2026-08-13 16:40"), updatedAt: bj("2026-08-13 16:45"),
      messages: [
        { role: "user", at: at("2026-08-13 16:40"), content: "公司年会邀请函背景图，国风一点，红金配色" },
        { role: "assistant", at: at("2026-08-13 16:42"), content: "国风年会邀请函背景生图方案：\n\n## 正向提示词\n```\nChinese new year gala invitation background, traditional Chinese style, deep red and gold color scheme, golden clouds pattern (祥云), subtle mountain silhouette in gold line art, elegant empty center area for text, ornate golden border frame, silk texture, festive and luxurious, flat illustration, 8k\n```\n\n## 负向提示词\n```\nphoto realistic, people, busy composition, western elements, low contrast\n```\n\n## 设计要点\n- **留白**：画面中央 60% 留纯色暗红区域,方便叠加「XX公司2026年会」字样\n- **点缀**：四角金色祥云 + 底部金线远山,顶部可加一枚烫金印章元素\n- **比例**：9:16（手机邀请函）为主,建议同时出 3:4 用于打印\n\n> 若要更隆重,可在提示词中加 `golden lantern elements, subtle firework particles`。需要我出配套的内页版式方案吗？" },
        { role: "user", at: at("2026-08-13 16:43"), content: "就按这个出一张 9:16 的" },
        { role: "assistant", at: at("2026-08-13 16:45"), content: "已完成出图（9:16 竖版,中央留白可直接排版文字）：\n\n![国风年会邀请函背景](/demo/agent-draw-gala-invitation.jpg)\n\n**出图说明**\n- 红金配色,四角祥云 + 底部金线远山,金色细边框收边\n- 中央 60% 暗红留白区,叠加「XX公司2026年会」等文字即可\n- 丝绸质感底纹,打印与手机端都适用\n\n需要打印用的 3:4 版本或配套内页版式,随时说。" },
      ],
    },
    // ── 编程助手 CodeMate ──
    {
      agentId: codeId,
      title: "这段 JS 为什么 map 里的 async 不生效",
      createdAt: bj("2026-08-12 09:20"), updatedAt: bj("2026-08-12 09:24"),
      messages: [
        { role: "user", at: at("2026-08-12 09:20"), content: "这段 JS 为什么 map 里的 async 不生效？结果全是 Promise：\n\nconst results = urls.map(async (u) => {\n  const r = await fetch(u);\n  return r.json();\n});\nconsole.log(results);" },
        { role: "assistant", at: at("2026-08-12 09:21"), content: "## 问题定位\n`Array.prototype.map` 不会等待 async 回调，`async` 函数**始终返回 Promise**，所以 `results` 是 `Promise[]` 数组——这是预期行为，不是 bug。\n\n## 修复代码\n```js\n// 并发请求：用 Promise.all 等待全部完成\nconst results = await Promise.all(\n  urls.map(async (u) => {\n    const r = await fetch(u);\n    if (!r.ok) throw new Error(`请求失败 ${r.status}: ${u}`);\n    return r.json();\n  })\n);\nconsole.log(results); // 真正的数据数组\n```\n\n## 两个注意点\n1. **失败处理**：`Promise.all` 一个失败全部 reject。若希望部分失败不影响其他，用 `Promise.allSettled`。\n2. **并发控制**：URL 很多时建议分批（如每批 5 个），避免瞬时打爆服务端。\n\n需要我给一版带并发上限的实现吗？" },
        { role: "user", at: at("2026-08-12 09:23"), content: "要，给个并发上限5的版本" },
        { role: "assistant", at: at("2026-08-12 09:24"), content: "带并发上限的实现（无第三方依赖）：\n\n```js\nasync function fetchAllLimited(urls, limit = 5) {\n  const results = new Array(urls.length);\n  let next = 0;\n\n  async function worker() {\n    while (next < urls.length) {\n      const i = next++;           // 领取任务下标\n      const r = await fetch(urls[i]);\n      if (!r.ok) throw new Error(`请求失败 ${r.status}: ${urls[i]}`);\n      results[i] = await r.json(); // 按原顺序落位\n    }\n  }\n\n  // 启动 limit 个 worker 并发消费任务队列\n  await Promise.all(Array.from({ length: Math.min(limit, urls.length) }, worker));\n  return results;\n}\n\nconst results = await fetchAllLimited(urls, 5);\n```\n\n**原理**：固定 5 个 worker 循环领取任务，天然限流；`results[i]` 按下标写入，返回顺序与入参一致。若要失败重试，可在 worker 里包一层 `for (let attempt = 0; attempt < 3; attempt++)`。" },
      ],
    },
    {
      agentId: codeId,
      title: "帮我优化一条慢 SQL",
      createdAt: bj("2026-08-14 11:05"), updatedAt: bj("2026-08-14 11:07"),
      messages: [
        { role: "user", at: at("2026-08-14 11:05"), content: "这条 SQL 在 200 万行的订单表上要跑 8 秒，帮我优化：\nSELECT * FROM orders WHERE DATE(created_at) = '2026-08-13' AND status != 'cancelled' ORDER BY created_at DESC;" },
        { role: "assistant", at: at("2026-08-14 11:07"), content: "## 问题诊断\n1. **`DATE(created_at)` 对列包函数** → 索引失效，全表扫描（主要瓶颈）\n2. **`SELECT *`** → 回表取全部列，放大 IO\n3. **`!=` 条件**选择性差，但影响次要\n\n## 优化后 SQL\n```sql\nSELECT id, order_no, user_id, amount, status, created_at\nFROM orders\nWHERE created_at >= '2026-08-13 00:00:00'\n  AND created_at <  '2026-08-14 00:00:00'   -- 范围条件可走索引\n  AND status <> 'cancelled'\nORDER BY created_at DESC;\n```\n\n## 配套索引\n```sql\nCREATE INDEX idx_orders_created_status ON orders (created_at DESC, status);\n```\n\n| 优化点 | 效果 |\n|---|---|\n| 函数条件 → 范围条件 | 走索引范围扫描，预计 8s → 50ms 级 |\n| 明确列名 | 减少回表数据量 |\n| 复合索引含 status | 过滤下推，减少回表次数 |\n\n> 建议执行 `EXPLAIN ANALYZE` 对比前后计划确认。把执行计划贴给我，我可以进一步判断是否需要覆盖索引。" },
      ],
    },
    // ── 会议纪要整理模板 ──
    {
      agentId: meetingId,
      title: "整理一下今天产品周会的记录",
      createdAt: bj("2026-08-10 18:30"), updatedAt: bj("2026-08-10 18:33"),
      messages: [
        { role: "user", at: at("2026-08-10 18:30"), content: "整理一下今天产品周会的记录：\n\n老王说上周注册转化率掉了2个点，可能跟新改的注册页有关，小李你查一下埋点数据周三前给结论。然后小张提了客户反馈导出功能太慢，超过1万条就转圈，技术这边评估下，下周五前出方案。对了市场部要的828活动页，设计稿周四必须定稿，小陈跟进。预算的事下次再议。" },
        { role: "assistant", at: at("2026-08-10 18:33"), content: "# 产品周会会议纪要\n\n**会议时间**：2026-08-10\n**记录整理**：AI 自动生成\n\n## 一、议题与结论\n\n| # | 议题 | 讨论要点 | 结论 |\n|---|------|---------|------|\n| 1 | 注册转化率下降 | 上周下降 2 个百分点，疑与新版注册页相关 | 先查埋点数据定位原因 |\n| 2 | 导出功能性能问题 | 客户反馈超 1 万条数据导出卡顿 | 技术侧评估并出优化方案 |\n| 3 | 828 活动页设计 | 市场部需求，时间紧 | 本周四前完成设计定稿 |\n| 4 | 预算事项 | — | **延期**至下次会议讨论 |\n\n## 二、待办事项\n\n| 待办 | 责任人 | 截止时间 |\n|------|-------|---------|\n| 排查注册页埋点数据，给出转化率下降结论 | 小李 | 08-12（周三） |\n| 导出功能性能优化方案 | 技术团队 | 08-14（周五） |\n| 828 活动页设计稿定稿 | 小陈 | 08-13（周四） |\n\n## 三、遗留问题\n- 预算讨论（下次会议优先议题）\n\n> 提示：如需发给参会人，告诉我抄送对象与语气要求，我可以生成邮件版本。" },
      ],
    },
    {
      agentId: meetingId,
      title: "客户沟通电话的要点帮我整理成纪要",
      createdAt: bj("2026-08-13 15:10"), updatedAt: bj("2026-08-13 15:12"),
      messages: [
        { role: "user", at: at("2026-08-13 15:10"), content: "刚跟华远科技的采购总监打了40分钟电话，要点：他们对我们报价基本认可但希望总价降5%，付款愿意从verify 30天改成15天来换；另外要求9月15号前必须交付第一期；他们下周三内部上会，会前要我们出一版正式报价函和交付计划。" },
        { role: "assistant", at: at("2026-08-13 15:12"), content: "# 客户沟通纪要 — 华远科技\n\n**沟通方式**：电话（约 40 分钟）\n**日期**：2026-08-13\n**对方**：采购总监\n\n## 一、客户诉求与让步条件\n\n| 事项 | 客户立场 | 性质 |\n|------|---------|------|\n| 价格 | 认可报价，要求总价**下调 5%** | 诉求 |\n| 付款账期 | 愿意由 30 天缩短至 **15 天** | 让步（换取降价） |\n| 交付时间 | 第一期 **9 月 15 日前**必须交付 | 硬性要求 |\n\n## 二、关键时间节点\n- **下周三**（08-19）：客户内部上会\n- **上会前**：需提交正式报价函 + 交付计划\n\n## 三、待办事项\n\n| 待办 | 建议截止 |\n|------|---------|\n| 测算降价 5% + 账期缩至 15 天的综合毛利影响 | 08-15 |\n| 出具正式报价函 | 08-17 |\n| 制定第一期交付计划（倒排至 09-15） | 08-17 |\n\n## 四、风险提示\n- 9/15 交付为硬约束，报价函中建议明确**依赖客户配合的前置条件**（如需求确认时间），避免延期责任模糊。\n\n> 提示：可以把贵司标准报价函模板发我，我直接按本次条件生成初稿。" },
      ],
    },
  ];

  for (const c of convos) {
    // 按 (用户, 智能体, 标题) 去重,允许用户已有的真实会话共存
    const [dup] = await db.select({ id: toolAgentConversationsTable.id })
      .from(toolAgentConversationsTable)
      .where(and(
        eq(toolAgentConversationsTable.userId, zjh),
        eq(toolAgentConversationsTable.agentId, c.agentId),
        eq(toolAgentConversationsTable.title, c.title),
      ));
    if (dup) continue;
    await db.insert(toolAgentConversationsTable).values({
      userId: zjh, agentId: c.agentId, title: c.title,
      messages: c.messages, createdAt: c.createdAt, updatedAt: c.updatedAt,
    });
  }
}
