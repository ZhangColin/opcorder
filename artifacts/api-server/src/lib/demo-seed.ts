/**
 * 算力中心 / 工具平台 演示数据种子（迁移 062 调用,开发与生产各执行一次）。
 *
 * 数据按业务流程构造并互相勾稽:
 *  - 算力侧:开发环境→训练任务→推理服务的完整链路;每笔资源开通有对应订单,已支付订单有对应账单支出,另有充值入账。
 *  - 工具侧:创作者发布智能体(免费/付费/模板),订阅者付费订阅→支付流水→创作者收益一一对应。
 * 时间遵循北京时间裸存储约定(北京墙上时间按 UTC 存)。
 */
import { db } from "@workspace/db";
import {
  usersTable,
  computeNotebooksTable, computeTrainingJobsTable, computeInferenceServicesTable,
  computeStoragesTable, computeResourcesTable, computeTokenResourcesTable,
  computeApiKeysTable, computeImagesTable, computeOrdersTable, computeBillsTable,
  computeRepoItemsTable, computeFavoritesTable,
  toolAgentsTable, toolKnowledgeBasesTable, toolCustomToolsTable,
  toolAgentFavoritesTable, toolSubscriptionsTable, toolSubscriptionPaymentsTable,
  toolEarningsTable, toolPluginsTable, toolPluginInstallsTable,
} from "@workspace/db";
import { inArray } from "drizzle-orm";
import { logger } from "./logger";
import crypto from "crypto";
import bcrypt from "bcryptjs";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// 北京墙上时间 → 裸存储
const bj = (s: string) => new Date(s.replace(" ", "T") + ":00Z");

/**
 * 在调用方事务内执行(与迁移标记同事务提交,保证全有或全无)。
 * 种子账号缺失时抛错 → 标记不落库,下次启动重试。
 */
export async function seedComputeToolsDemoData(db: Tx): Promise<void> {
  // 主演示账号(算力使用者 + 订阅者),必须已由 OPC 种子创建
  const [zjhRow] = await db.select({ id: usersTable.id }).from(usersTable)
    .where(inArray(usersTable.email, ["zhangjinhua@aieducenter.com"]));
  if (!zjhRow) throw new Error("Demo seed prerequisites missing: zhangjinhua account not found");
  const zjh = zjhRow.id;

  // 三个虚构创作者账号,不存在则创建
  const CREATORS = [
    { email: "lujiaming@aieducenter.com", nickname: "陆嘉铭" },
    { email: "suwanqing@aieducenter.com", nickname: "苏婉晴" },
    { email: "chengyifan@aieducenter.com", nickname: "程一帆" },
  ];
  const creatorIds: Record<string, number> = {};
  for (const c of CREATORS) {
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(inArray(usersTable.email, [c.email]));
    if (existing) { creatorIds[c.nickname] = existing.id; continue; }
    const [created] = await db.insert(usersTable).values({
      email: c.email, nickname: c.nickname, role: "opc",
      passwordHash: await bcrypt.hash("opc@123456", 10),
    }).returning({ id: usersTable.id });
    creatorIds[c.nickname] = created.id;
  }
  const hwc = creatorIds["陆嘉铭"], ylm = creatorIds["苏婉晴"], lq = creatorIds["程一帆"];

  // ── 算力中心（张锦华为主,程一帆少量） ─────────────────────────────────────

  // 镜像(先于开发/训练引用)
  await db.insert(computeImagesTable).values([
    { userId: zjh, name: "llama-factory", tag: "v0.9.2-cuda12.1", region: "华北-北京", sizeMb: 18432, source: "custom", description: "LLaMA-Factory 微调环境,预装 deepspeed/flash-attn", createdAt: bj("2026-07-02 10:15"), updatedAt: bj("2026-07-02 10:15") },
    { userId: zjh, name: "vllm-serving", tag: "0.8.4-py310", region: "华北-北京", sizeMb: 14336, source: "custom", description: "vLLM 推理服务镜像,支持 OpenAI 兼容接口", createdAt: bj("2026-07-18 16:40"), updatedAt: bj("2026-07-18 16:40") },
    { userId: zjh, name: "pytorch", tag: "2.5.1-cuda12.1-cudnn9", region: "华北-北京", sizeMb: 9216, source: "platform", description: "平台官方 PyTorch 基础镜像", createdAt: bj("2026-06-28 09:00"), updatedAt: bj("2026-06-28 09:00") },
  ]);

  // 存储
  await db.insert(computeStoragesTable).values([
    { userId: zjh, name: "训练数据集存储", storageType: "file", region: "华北-北京", capacityGb: 1024, usedGb: 682, status: "running", createdAt: bj("2026-06-28 09:12"), updatedAt: bj("2026-08-12 21:00") },
    { userId: zjh, name: "模型产出归档", storageType: "object", region: "华北-北京", capacityGb: 2048, usedGb: 917, status: "running", createdAt: bj("2026-07-05 14:30"), updatedAt: bj("2026-08-13 08:20") },
    { userId: lq, name: "课件语料库", storageType: "file", region: "华东-上海", capacityGb: 512, usedGb: 133, status: "running", createdAt: bj("2026-07-22 11:05"), updatedAt: bj("2026-08-10 17:45") },
  ]);

  // 计算资源
  await db.insert(computeResourcesTable).values([
    { userId: zjh, name: "A800 训练专属节点", gpuModel: "NVIDIA A800 80GB", gpuCount: 8, cpuCores: 128, memoryGb: 1024, region: "华北-北京", status: "running", expiresAt: bj("2026-11-30 23:59"), createdAt: bj("2026-07-01 10:00"), updatedAt: bj("2026-07-01 10:00") },
    { userId: zjh, name: "4090 调试节点", gpuModel: "NVIDIA RTX 4090 24GB", gpuCount: 2, cpuCores: 32, memoryGb: 128, region: "华北-北京", status: "stopped", expiresAt: bj("2026-09-30 23:59"), createdAt: bj("2026-06-28 09:30"), updatedAt: bj("2026-08-09 19:12") },
  ]);

  // 开发环境
  await db.insert(computeNotebooksTable).values([
    { userId: zjh, name: "Qwen2.5-14B 指令微调实验", status: "running", envType: "JupyterLab", image: "llama-factory:v0.9.2-cuda12.1", resourceSpec: "A800 80GB ×2 / 32C / 256G", sshEnabled: true, description: "面向 OPC 客服场景的指令数据配比实验", startedAt: bj("2026-08-13 09:05"), totalRuntimeSeconds: 379_500, createdAt: bj("2026-07-08 10:20"), updatedAt: bj("2026-08-13 09:05") },
    { userId: zjh, name: "数据清洗与去重流水线", status: "stopped", envType: "VSCode Server", image: "pytorch:2.5.1-cuda12.1-cudnn9", resourceSpec: "CPU 16C / 64G", sshEnabled: false, description: "MinHash 去重 + 质量打分,产出 SFT 训练集", startedAt: bj("2026-08-11 14:00"), stoppedAt: bj("2026-08-11 20:32"), totalRuntimeSeconds: 168_900, createdAt: bj("2026-07-15 09:40"), updatedAt: bj("2026-08-11 20:32") },
    { userId: lq, name: "教学助手提示词调优", status: "stopped", envType: "JupyterLab", image: "pytorch:2.5.1-cuda12.1-cudnn9", resourceSpec: "RTX 4090 ×1 / 16C / 64G", sshEnabled: false, startedAt: bj("2026-08-06 10:00"), stoppedAt: bj("2026-08-06 18:15"), totalRuntimeSeconds: 29_700, createdAt: bj("2026-08-02 15:10"), updatedAt: bj("2026-08-06 18:15") },
  ]);

  // 训练任务
  await db.insert(computeTrainingJobsTable).values([
    { userId: zjh, name: "qwen2.5-14b-opc-sft-v3", status: "completed", mode: "custom", image: "llama-factory:v0.9.2-cuda12.1", resourceSpec: "A800 80GB ×8 / 128C / 1024G", command: "llamafactory-cli train configs/opc_sft_v3.yaml", datasetPath: "/mnt/datasets/opc-sft-v3", outputPath: "/mnt/output/qwen2.5-14b-opc-sft-v3", description: "客服场景 SFT 第三轮,加入 1.2 万条真实工单改写数据", startedAt: bj("2026-08-05 22:00"), finishedAt: bj("2026-08-07 06:42"), totalRuntimeSeconds: 117_720, createdAt: bj("2026-08-05 21:45"), updatedAt: bj("2026-08-07 06:42") },
    { userId: zjh, name: "qwen2.5-14b-opc-dpo-v1", status: "running", mode: "custom", image: "llama-factory:v0.9.2-cuda12.1", resourceSpec: "A800 80GB ×8 / 128C / 1024G", command: "llamafactory-cli train configs/opc_dpo_v1.yaml", datasetPath: "/mnt/datasets/opc-preference-pairs", outputPath: "/mnt/output/qwen2.5-14b-opc-dpo-v1", description: "基于 sft-v3 的偏好对齐,2.6 万组偏好对", startedAt: bj("2026-08-13 20:30"), plannedDurationSeconds: 172_800, totalRuntimeSeconds: 48_600, createdAt: bj("2026-08-13 20:10"), updatedAt: bj("2026-08-14 10:00") },
    { userId: zjh, name: "embedding-bge-m3-领域增量", status: "failed", mode: "custom", image: "pytorch:2.5.1-cuda12.1-cudnn9", resourceSpec: "RTX 4090 ×2 / 32C / 128G", command: "torchrun --nproc_per_node=2 train_embedding.py", datasetPath: "/mnt/datasets/opc-pairs-neg", outputPath: "/mnt/output/bge-m3-opc", description: "负例采样比例过高导致 loss 发散,待调参重跑", startedAt: bj("2026-08-09 11:20"), finishedAt: bj("2026-08-09 13:05"), totalRuntimeSeconds: 6_300, createdAt: bj("2026-08-09 11:00"), updatedAt: bj("2026-08-09 13:05") },
  ]);

  // 推理服务
  await db.insert(computeInferenceServicesTable).values([
    { userId: zjh, name: "opc-chat-14b 线上服务", serviceType: "llm", status: "running", modelSource: "模型仓库/qwen2.5-14b-opc-sft-v3", image: "vllm-serving:0.8.4-py310", resourceSpec: "A800 80GB ×2 / 32C / 256G", replicas: 2, runningReplicas: 2, endpointUrl: "https://api.opcorder.com/v1/inference/opc-chat-14b", description: "OPC 客服问答主力模型,日均 4.1 万次调用", startedAt: bj("2026-08-07 15:00"), totalRuntimeSeconds: 588_600, createdAt: bj("2026-08-07 14:30"), updatedAt: bj("2026-08-14 10:00") },
    { userId: zjh, name: "opc-embedding 检索服务", serviceType: "embedding", status: "running", modelSource: "模型仓库/bge-m3", image: "vllm-serving:0.8.4-py310", resourceSpec: "RTX 4090 ×1 / 16C / 64G", replicas: 1, runningReplicas: 1, endpointUrl: "https://api.opcorder.com/v1/inference/opc-embedding", description: "知识库向量化与召回", startedAt: bj("2026-07-20 10:00"), totalRuntimeSeconds: 2_147_400, createdAt: bj("2026-07-20 09:40"), updatedAt: bj("2026-08-14 10:00") },
  ]);

  // Token 资源包
  await db.insert(computeTokenResourcesTable).values([
    { userId: zjh, name: "DeepSeek-V3 千万 Token 包", modelName: "deepseek-chat", totalTokens: 10_000_000, usedTokens: 6_384_000, status: "running", expiresAt: bj("2026-12-31 23:59"), createdAt: bj("2026-07-03 11:20"), updatedAt: bj("2026-08-13 22:10") },
    { userId: zjh, name: "Qwen-Max 五百万 Token 包", modelName: "qwen-max", totalTokens: 5_000_000, usedTokens: 4_997_200, status: "exhausted", expiresAt: bj("2026-10-31 23:59"), createdAt: bj("2026-06-30 09:50"), updatedAt: bj("2026-08-08 16:33") },
    { userId: lq, name: "DeepSeek-V3 百万 Token 包", modelName: "deepseek-chat", totalTokens: 1_000_000, usedTokens: 212_400, status: "running", expiresAt: bj("2026-11-30 23:59"), createdAt: bj("2026-08-01 10:05"), updatedAt: bj("2026-08-12 09:41") },
  ]);

  // API Keys（哈希为随机演示值,不对应任何真实密钥）
  const fakeHash = () => crypto.createHash("sha256").update(crypto.randomBytes(24)).digest("hex");
  await db.insert(computeApiKeysTable).values([
    { userId: zjh, name: "生产环境-客服系统", keyPrefix: "sk-opc-a3f8", keyHash: fakeHash(), lastUsedAt: bj("2026-08-14 09:47"), createdAt: bj("2026-07-07 15:20"), updatedAt: bj("2026-08-14 09:47") },
    { userId: zjh, name: "测试环境-联调", keyPrefix: "sk-opc-9k2m", keyHash: fakeHash(), lastUsedAt: bj("2026-08-12 14:03"), createdAt: bj("2026-07-25 10:00"), updatedAt: bj("2026-08-12 14:03") },
    { userId: lq, name: "教学助手接入", keyPrefix: "sk-opc-t7wq", keyHash: fakeHash(), lastUsedAt: bj("2026-08-11 19:28"), createdAt: bj("2026-08-01 10:12"), updatedAt: bj("2026-08-11 19:28") },
  ]);

  // 订单（与开通的资源一一对应）+ 账单（已支付订单→支出;另有充值入账）
  await db.insert(computeOrdersTable).values([
    { userId: zjh, orderNo: "CO20260628093001", itemType: "storage", itemName: "训练数据集存储 1TB×3月", amountFen: 358_800, status: "paid", createdAt: bj("2026-06-28 09:30"), updatedAt: bj("2026-06-28 09:31") },
    { userId: zjh, orderNo: "CO20260701100502", itemType: "resource", itemName: "A800 训练专属节点 8卡×5月", amountFen: 13_440_000, status: "paid", createdAt: bj("2026-07-01 10:05"), updatedAt: bj("2026-07-01 10:07") },
    { userId: zjh, orderNo: "CO20260703112103", itemType: "token", itemName: "DeepSeek-V3 千万 Token 包", amountFen: 80_000, status: "paid", createdAt: bj("2026-07-03 11:21"), updatedAt: bj("2026-07-03 11:22") },
    { userId: zjh, orderNo: "CO20260705143204", itemType: "storage", itemName: "模型产出归档 2TB×3月", amountFen: 645_600, status: "paid", createdAt: bj("2026-07-05 14:32"), updatedAt: bj("2026-07-05 14:33") },
    { userId: zjh, orderNo: "CO20260813201105", itemType: "training", itemName: "qwen2.5-14b-opc-dpo-v1 预估费用", amountFen: 384_000, status: "pending", createdAt: bj("2026-08-13 20:11"), updatedAt: bj("2026-08-13 20:11") },
    { userId: lq, orderNo: "CO20260801100706", itemType: "token", itemName: "DeepSeek-V3 百万 Token 包", amountFen: 9_900, status: "paid", createdAt: bj("2026-08-01 10:07"), updatedAt: bj("2026-08-01 10:08") },
  ]);
  await db.insert(computeBillsTable).values([
    { userId: zjh, billNo: "CB20260627180001", itemType: "recharge", amountFen: 20_000_000, direction: "income", billedAt: bj("2026-06-27 18:00"), createdAt: bj("2026-06-27 18:00"), updatedAt: bj("2026-06-27 18:00") },
    { userId: zjh, billNo: "CB20260628093101", itemType: "storage", amountFen: 358_800, direction: "expense", billedAt: bj("2026-06-28 09:31"), createdAt: bj("2026-06-28 09:31"), updatedAt: bj("2026-06-28 09:31") },
    { userId: zjh, billNo: "CB20260701100702", itemType: "resource", amountFen: 13_440_000, direction: "expense", billedAt: bj("2026-07-01 10:07"), createdAt: bj("2026-07-01 10:07"), updatedAt: bj("2026-07-01 10:07") },
    { userId: zjh, billNo: "CB20260703112203", itemType: "token", amountFen: 80_000, direction: "expense", billedAt: bj("2026-07-03 11:22"), createdAt: bj("2026-07-03 11:22"), updatedAt: bj("2026-07-03 11:22") },
    { userId: zjh, billNo: "CB20260705143304", itemType: "storage", amountFen: 645_600, direction: "expense", billedAt: bj("2026-07-05 14:33"), createdAt: bj("2026-07-05 14:33"), updatedAt: bj("2026-07-05 14:33") },
    { userId: zjh, billNo: "CB20260731235905", itemType: "notebook", amountFen: 96_400, direction: "expense", billedAt: bj("2026-07-31 23:59"), createdAt: bj("2026-07-31 23:59"), updatedAt: bj("2026-07-31 23:59") },
    { userId: zjh, billNo: "CB20260807064206", itemType: "training", amountFen: 261_600, direction: "expense", billedAt: bj("2026-08-07 06:42"), createdAt: bj("2026-08-07 06:42"), updatedAt: bj("2026-08-07 06:42") },
    { userId: lq, billNo: "CB20260801095001", itemType: "recharge", amountFen: 50_000, direction: "income", billedAt: bj("2026-08-01 09:50"), createdAt: bj("2026-08-01 09:50"), updatedAt: bj("2026-08-01 09:50") },
    { userId: lq, billNo: "CB20260801100802", itemType: "token", amountFen: 9_900, direction: "expense", billedAt: bj("2026-08-01 10:08"), createdAt: bj("2026-08-01 10:08"), updatedAt: bj("2026-08-01 10:08") },
  ]);

  // 仓库（模型/数据集/镜像）+ 收藏
  const repoRows = await db.insert(computeRepoItemsTable).values([
    { ownerId: zjh, repoType: "model", name: "qwen2.5-14b-opc-sft-v3", description: "OPC 客服场景微调模型,内部评测采纳率 87.4%", visibility: "public", sizeMb: 28_672, downloads: 46, tags: ["Qwen2.5", "SFT", "客服"], createdAt: bj("2026-08-07 09:10"), updatedAt: bj("2026-08-07 09:10") },
    { ownerId: hwc, repoType: "model", name: "bge-m3-opc-retrieval", description: "面向撮合交易文书的检索向量模型", visibility: "public", sizeMb: 2_304, downloads: 121, tags: ["Embedding", "检索"], createdAt: bj("2026-07-12 16:20"), updatedAt: bj("2026-07-12 16:20") },
    { ownerId: zjh, repoType: "dataset", name: "opc-sft-v3 指令数据集", description: "8.6 万条客服指令数据,含 1.2 万条真实工单改写", visibility: "private", sizeMb: 412, downloads: 3, tags: ["SFT", "指令数据"], createdAt: bj("2026-08-04 11:30"), updatedAt: bj("2026-08-04 11:30") },
    { ownerId: ylm, repoType: "dataset", name: "合同条款抽取标注集", description: "1.8 万份合同的条款级标注,BIO 格式", visibility: "public", sizeMb: 268, downloads: 74, tags: ["NER", "合同"], createdAt: bj("2026-07-19 10:40"), updatedAt: bj("2026-07-19 10:40") },
    { ownerId: zjh, repoType: "image", name: "llama-factory", description: "微调环境镜像,预装 deepspeed/flash-attn", visibility: "public", sizeMb: 18_432, downloads: 33, tags: ["训练", "CUDA12.1"], createdAt: bj("2026-07-02 10:30"), updatedAt: bj("2026-07-02 10:30") },
  ]).returning({ id: computeRepoItemsTable.id, name: computeRepoItemsTable.name });
  const repoId = (n: string) => repoRows.find(r => r.name === n)!.id;
  await db.insert(computeFavoritesTable).values([
    { userId: zjh, targetType: "repo_item", targetId: repoId("bge-m3-opc-retrieval"), createdAt: bj("2026-07-13 09:02"), updatedAt: bj("2026-07-13 09:02") },
    { userId: zjh, targetType: "repo_item", targetId: repoId("合同条款抽取标注集"), createdAt: bj("2026-07-20 15:44"), updatedAt: bj("2026-07-20 15:44") },
    { userId: lq, targetType: "repo_item", targetId: repoId("qwen2.5-14b-opc-sft-v3"), createdAt: bj("2026-08-08 10:21"), updatedAt: bj("2026-08-08 10:21") },
  ]);

  // ── 工具平台 ─────────────────────────────────────────────────────────────

  const agents = await db.insert(toolAgentsTable).values([
    // 市场付费/免费智能体（创作者发布）
    { ownerId: hwc, name: "合同风险审查助手", appType: "agent", description: "上传合同自动识别高风险条款,输出逐条修改建议与风险等级,覆盖买卖/服务/劳务三类合同。", tags: ["合同", "法务", "风控"], category: "法务合规", shareStatus: "published", priceFenPerMonth: 19_900, publishedAt: bj("2026-07-10 14:00"), createdAt: bj("2026-07-06 09:30"), updatedAt: bj("2026-07-10 14:00") },
    { ownerId: hwc, name: "投标书智能撰写", appType: "workflow", description: "根据招标文件要点自动生成技术标框架与商务应答初稿,支持行业模板套用。", tags: ["投标", "文书"], category: "商务办公", shareStatus: "published", priceFenPerMonth: 29_900, publishedAt: bj("2026-07-22 10:30"), createdAt: bj("2026-07-18 11:00"), updatedAt: bj("2026-07-22 10:30") },
    { ownerId: ylm, name: "财务对账机器人", appType: "workflow", description: "自动比对银行流水与应收应付台账,生成差异清单与对账报告,支持 Excel 批量导入。", tags: ["财务", "对账", "自动化"], category: "财税管理", shareStatus: "published", priceFenPerMonth: 9_900, publishedAt: bj("2026-07-15 16:20"), createdAt: bj("2026-07-11 13:40"), updatedAt: bj("2026-07-15 16:20") },
    { ownerId: ylm, name: "周报速写", appType: "agent", description: "输入本周关键事项,一键生成结构化周报,支持按团队模板输出。", tags: ["办公", "写作"], category: "商务办公", shareStatus: "published", priceFenPerMonth: 0, publishedAt: bj("2026-07-08 09:00"), createdAt: bj("2026-07-05 17:20"), updatedAt: bj("2026-07-08 09:00") },
    { ownerId: lq, name: "简历筛选与人才画像", appType: "agent", description: "批量解析简历,按岗位要求打分排序并生成候选人画像摘要。", tags: ["招聘", "HR"], category: "人力资源", shareStatus: "published", priceFenPerMonth: 14_900, publishedAt: bj("2026-08-01 11:00"), createdAt: bj("2026-07-28 15:10"), updatedAt: bj("2026-08-01 11:00") },
    // 模板市场
    { ownerId: hwc, name: "客户跟进 SOP 模板", appType: "workflow", description: "从线索分配到成交回款的九步跟进流程模板,可直接加入工作区二次编辑。", tags: ["销售", "SOP"], category: "销售管理", shareStatus: "template", priceFenPerMonth: 0, publishedAt: bj("2026-07-25 10:00"), createdAt: bj("2026-07-24 09:30"), updatedAt: bj("2026-07-25 10:00") },
    { ownerId: ylm, name: "会议纪要整理模板", appType: "agent", description: "录音转写文本一键整理为「决议/待办/责任人」三段式纪要。", tags: ["办公", "会议"], category: "商务办公", shareStatus: "template", priceFenPerMonth: 0, publishedAt: bj("2026-08-03 14:30"), createdAt: bj("2026-08-02 16:00"), updatedAt: bj("2026-08-03 14:30") },
    // 张锦华工作区私有智能体
    { ownerId: zjh, name: "OPC 需求初审助手", appType: "agent", description: "对入驻需求单做完整性检查与预算合理性初审,输出补充材料清单。", tags: ["内部", "审核"], category: "平台运营", shareStatus: "private", priceFenPerMonth: 0, createdAt: bj("2026-08-06 10:20"), updatedAt: bj("2026-08-11 09:15") },
  ]).returning({ id: toolAgentsTable.id, name: toolAgentsTable.name });
  const agentId = (n: string) => agents.find(a => a.name === n)!.id;

  // 知识库
  await db.insert(toolKnowledgeBasesTable).values([
    { ownerId: zjh, name: "OPC 平台运营手册", description: "入驻审核标准、里程碑验收规范、争议处理流程等 46 篇内部文档", tags: ["运营", "内部"], sizeMb: 86, docCount: 46, createdAt: bj("2026-08-06 10:40"), updatedAt: bj("2026-08-12 18:30") },
    { ownerId: hwc, name: "合同审查判例库", description: "近三年 1200+ 份合同纠纷判例摘要与风险条款对照", tags: ["法务", "判例"], sizeMb: 340, docCount: 1237, createdAt: bj("2026-07-06 10:00"), updatedAt: bj("2026-08-09 11:20") },
    { ownerId: ylm, name: "财税政策速查", description: "增值税/企业所得税最新政策原文与解读,按月更新", tags: ["财税", "政策"], sizeMb: 128, docCount: 312, createdAt: bj("2026-07-11 14:00"), updatedAt: bj("2026-08-05 09:10") },
  ]);

  // 自定义工具
  await db.insert(toolCustomToolsTable).values([
    { ownerId: zjh, name: "企业工商信息查询", kind: "custom", config: { endpoint: "https://api.opcorder.com/internal/company-info", method: "GET", auth: "api_key" }, enabled: true, refCount: 2, createdAt: bj("2026-08-06 11:00"), updatedAt: bj("2026-08-06 11:00") },
    { ownerId: hwc, name: "裁判文书检索", kind: "mcp", config: { server: "mcp-judgment-search", transport: "sse" }, enabled: true, refCount: 1, createdAt: bj("2026-07-07 09:20"), updatedAt: bj("2026-07-07 09:20") },
    { ownerId: ylm, name: "银行流水解析", kind: "custom", config: { endpoint: "https://api.opcorder.com/internal/bank-statement-parse", method: "POST", format: "xlsx" }, enabled: true, refCount: 1, createdAt: bj("2026-07-12 10:30"), updatedAt: bj("2026-07-12 10:30") },
  ]);

  // 收藏
  await db.insert(toolAgentFavoritesTable).values([
    { userId: zjh, agentId: agentId("合同风险审查助手"), createdAt: bj("2026-07-11 09:30"), updatedAt: bj("2026-07-11 09:30") },
    { userId: zjh, agentId: agentId("财务对账机器人"), createdAt: bj("2026-07-16 14:05"), updatedAt: bj("2026-07-16 14:05") },
    { userId: lq, agentId: agentId("合同风险审查助手"), createdAt: bj("2026-07-20 16:40"), updatedAt: bj("2026-07-20 16:40") },
    { userId: hwc, agentId: agentId("简历筛选与人才画像"), createdAt: bj("2026-08-02 10:10"), updatedAt: bj("2026-08-02 10:10") },
  ]);

  // 订阅 → 支付流水 → 创作者收益（金额/时间一一勾稽;订单号符合业务格式）
  const subs = await db.insert(toolSubscriptionsTable).values([
    // 张锦华付费订阅陆嘉铭的合同审查(已续费一次,当前有效)
    { userId: zjh, agentId: agentId("合同风险审查助手"), amountFen: 19_900, status: "active", businessOrderNo: "TOOLSUB-DEMO-1001", paymentOrderNo: "PAY20260811093012001", paidAt: bj("2026-08-11 09:30"), startsAt: bj("2026-08-11 09:30"), expiresAt: bj("2026-09-10 09:30"), createdAt: bj("2026-07-11 10:02"), updatedAt: bj("2026-08-11 09:30") },
    // 张锦华免费订阅周报速写
    { userId: zjh, agentId: agentId("周报速写"), amountFen: 0, status: "active", startsAt: bj("2026-07-16 08:50"), createdAt: bj("2026-07-16 08:50"), updatedAt: bj("2026-07-16 08:50") },
    // 程一帆付费订阅财务对账,已到期未续
    { userId: lq, agentId: agentId("财务对账机器人"), amountFen: 9_900, status: "expired", businessOrderNo: "TOOLSUB-DEMO-1003", paymentOrderNo: "PAY20260712110412003", paidAt: bj("2026-07-12 11:04"), startsAt: bj("2026-07-12 11:04"), expiresAt: bj("2026-08-11 11:04"), createdAt: bj("2026-07-12 11:00"), updatedAt: bj("2026-08-11 11:05") },
    // 陆嘉铭付费订阅程一帆的简历筛选,当前有效
    { userId: hwc, agentId: agentId("简历筛选与人才画像"), amountFen: 14_900, status: "active", businessOrderNo: "TOOLSUB-DEMO-1004", paymentOrderNo: "PAY20260802101512004", paidAt: bj("2026-08-02 10:15"), startsAt: bj("2026-08-02 10:15"), expiresAt: bj("2026-09-01 10:15"), createdAt: bj("2026-08-02 10:12"), updatedAt: bj("2026-08-02 10:15") },
  ]).returning({ id: toolSubscriptionsTable.id, userId: toolSubscriptionsTable.userId, agentId: toolSubscriptionsTable.agentId });
  const subId = (u: number, a: number) => subs.find(s => s.userId === u && s.agentId === a)!.id;

  await db.insert(toolSubscriptionPaymentsTable).values([
    // 合同审查:首月 + 续费,两笔流水
    { subscriptionId: subId(zjh, agentId("合同风险审查助手")), userId: zjh, agentId: agentId("合同风险审查助手"), amountFen: 19_900, businessOrderNo: "TOOLSUB-DEMO-1001A", paymentOrderNo: "PAY20260711100512001", paidAt: bj("2026-07-11 10:05"), createdAt: bj("2026-07-11 10:05") },
    { subscriptionId: subId(zjh, agentId("合同风险审查助手")), userId: zjh, agentId: agentId("合同风险审查助手"), amountFen: 19_900, businessOrderNo: "TOOLSUB-DEMO-1001", paymentOrderNo: "PAY20260811093012001", paidAt: bj("2026-08-11 09:30"), createdAt: bj("2026-08-11 09:30") },
    { subscriptionId: subId(lq, agentId("财务对账机器人")), userId: lq, agentId: agentId("财务对账机器人"), amountFen: 9_900, businessOrderNo: "TOOLSUB-DEMO-1003", paymentOrderNo: "PAY20260712110412003", paidAt: bj("2026-07-12 11:04"), createdAt: bj("2026-07-12 11:04") },
    { subscriptionId: subId(hwc, agentId("简历筛选与人才画像")), userId: hwc, agentId: agentId("简历筛选与人才画像"), amountFen: 14_900, businessOrderNo: "TOOLSUB-DEMO-1004", paymentOrderNo: "PAY20260802101512004", paidAt: bj("2026-08-02 10:15"), createdAt: bj("2026-08-02 10:15") },
  ]);

  await db.insert(toolEarningsTable).values([
    { ownerId: hwc, agentId: agentId("合同风险审查助手"), subscriberId: zjh, amountFen: 19_900, createdAt: bj("2026-07-11 10:05"), updatedAt: bj("2026-07-11 10:05") },
    { ownerId: hwc, agentId: agentId("合同风险审查助手"), subscriberId: zjh, amountFen: 19_900, createdAt: bj("2026-08-11 09:30"), updatedAt: bj("2026-08-11 09:30") },
    { ownerId: ylm, agentId: agentId("财务对账机器人"), subscriberId: lq, amountFen: 9_900, createdAt: bj("2026-07-12 11:04"), updatedAt: bj("2026-07-12 11:04") },
    { ownerId: lq, agentId: agentId("简历筛选与人才画像"), subscriberId: hwc, amountFen: 14_900, createdAt: bj("2026-08-02 10:15"), updatedAt: bj("2026-08-02 10:15") },
  ]);

  // 工具市场插件 + 安装记录
  const plugins = await db.insert(toolPluginsTable).values([
    { name: "网页内容抓取", author: "接单吧官方", description: "输入 URL 抓取正文并转为 Markdown,支持登录态站点", installCount: 2, createdAt: bj("2026-07-01 09:00"), updatedAt: bj("2026-07-01 09:00") },
    { name: "Excel 批量处理", author: "接单吧官方", description: "读写 xlsx,支持多 Sheet 合并、透视与公式回填", installCount: 2, createdAt: bj("2026-07-01 09:00"), updatedAt: bj("2026-07-01 09:00") },
    { name: "OCR 文字识别", author: "陆嘉铭", description: "扫描件/照片转文字,支持表格结构还原,合同审查常用前置工具", installCount: 1, createdAt: bj("2026-07-09 15:30"), updatedAt: bj("2026-07-09 15:30") },
    { name: "邮件发送", author: "接单吧官方", description: "对接企业邮箱发送通知邮件,支持模板变量与附件", installCount: 1, createdAt: bj("2026-07-01 09:00"), updatedAt: bj("2026-07-01 09:00") },
    { name: "电子签章调用", author: "苏婉晴", description: "对接 e 签宝发起签署流程,回传签署状态", installCount: 0, createdAt: bj("2026-07-28 11:20"), updatedAt: bj("2026-07-28 11:20") },
  ]).returning({ id: toolPluginsTable.id, name: toolPluginsTable.name });
  const pluginId = (n: string) => plugins.find(p => p.name === n)!.id;
  await db.insert(toolPluginInstallsTable).values([
    { userId: zjh, pluginId: pluginId("网页内容抓取"), createdAt: bj("2026-07-05 10:10"), updatedAt: bj("2026-07-05 10:10") },
    { userId: zjh, pluginId: pluginId("Excel 批量处理"), createdAt: bj("2026-07-05 10:11"), updatedAt: bj("2026-07-05 10:11") },
    { userId: hwc, pluginId: pluginId("OCR 文字识别"), createdAt: bj("2026-07-10 09:00"), updatedAt: bj("2026-07-10 09:00") },
    { userId: ylm, pluginId: pluginId("Excel 批量处理"), createdAt: bj("2026-07-13 14:25"), updatedAt: bj("2026-07-13 14:25") },
    { userId: lq, pluginId: pluginId("网页内容抓取"), createdAt: bj("2026-08-01 10:30"), updatedAt: bj("2026-08-01 10:30") },
    { userId: lq, pluginId: pluginId("邮件发送"), createdAt: bj("2026-08-01 10:32"), updatedAt: bj("2026-08-01 10:32") },
  ]);

  logger.info("Compute/Tools demo data seeded");
}
