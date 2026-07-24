import crypto from "crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  db, v2ContractsTable, v2ClientDemandsTable, v2OutsourceOrdersTable, usersTable,
  v2OutsourceDemandsTable,
} from "@workspace/db";
import { eq, and, desc, or, inArray } from "drizzle-orm";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/adminAuth";
import { notify, genContractNo } from "./utils";
import { logger } from "../../lib/logger";
import {
  getFileUploadUrl, uploadFileToEsign, createSignFlow, platformAutoSign,
  getSignUrl, getOrgSignUrl, getPlatformOrgId, type FlowSigner,
} from "../../lib/esign/index";
import { ensureEsignAccount } from "../../lib/esign/accounts";

const router: IRouter = Router();

router.get("/contracts", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const { channel, status, clientDemandId, outsourceOrderId } = req.query as Record<string, string>;

    const conditions: any[] = [];
    if (channel) conditions.push(eq(v2ContractsTable.channel, channel as any));
    if (status) conditions.push(eq(v2ContractsTable.status, status as any));
    if (clientDemandId) conditions.push(eq(v2ContractsTable.clientDemandId, parseInt(clientDemandId)));
    if (outsourceOrderId) conditions.push(eq(v2ContractsTable.outsourceOrderId, parseInt(outsourceOrderId)));

    if (role === "publisher") {
      const demandIds = await db
        .select({ id: v2ClientDemandsTable.id })
        .from(v2ClientDemandsTable)
        .where(eq(v2ClientDemandsTable.publisherId, userId));
      const ids = demandIds.map(d => d.id);
      if (ids.length === 0) return res.json([]);
      conditions.push(eq(v2ContractsTable.channel, "a"));
      conditions.push(inArray(v2ContractsTable.clientDemandId, ids));
    } else if (role === "opc") {
      conditions.push(eq(v2ContractsTable.channel, "b"));
    }

    const rows = await db
      .select({
        id: v2ContractsTable.id,
        contractNo: v2ContractsTable.contractNo,
        channel: v2ContractsTable.channel,
        clientDemandId: v2ContractsTable.clientDemandId,
        status: v2ContractsTable.status,
        content: v2ContractsTable.content,
        signedFileUrl: v2ContractsTable.signedFileUrl,
        opcConfirmedAt: v2ContractsTable.opcConfirmedAt,
        publisherConfirmedAt: v2ContractsTable.publisherConfirmedAt,
        publisherRejectedAt: v2ContractsTable.publisherRejectedAt,
        signedAt: v2ContractsTable.signedAt,
        createdAt: v2ContractsTable.createdAt,
        updatedAt: v2ContractsTable.updatedAt,
        demandTitle: v2ClientDemandsTable.title,
        invoiceType: v2ContractsTable.invoiceType,
        taxRate: v2ContractsTable.taxRate,
      })
      .from(v2ContractsTable)
      .leftJoin(v2ClientDemandsTable, eq(v2ContractsTable.clientDemandId, v2ClientDemandsTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(v2ContractsTable.createdAt));

    return res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /v2/contracts failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.get("/contracts/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const role = req.user!.role;

    const [row] = await db
      .select({
        id: v2ContractsTable.id,
        contractNo: v2ContractsTable.contractNo,
        channel: v2ContractsTable.channel,
        clientDemandId: v2ContractsTable.clientDemandId,
        outsourceOrderId: v2ContractsTable.outsourceOrderId,
        content: v2ContractsTable.content,
        status: v2ContractsTable.status,
        signedFileUrl: v2ContractsTable.signedFileUrl,
        signedAt: v2ContractsTable.signedAt,
        publisherConfirmedAt: v2ContractsTable.publisherConfirmedAt,
        publisherRejectedAt: v2ContractsTable.publisherRejectedAt,
        publisherRejectedReason: v2ContractsTable.publisherRejectedReason,
        createdAt: v2ContractsTable.createdAt,
        updatedAt: v2ContractsTable.updatedAt,
        demandTitle: v2ClientDemandsTable.title,
        invoiceType: v2ContractsTable.invoiceType,
        taxRate: v2ContractsTable.taxRate,
        esignFlowId: v2ContractsTable.esignFlowId,
        esignSignUrl: v2ContractsTable.esignSignUrl,
        esignSignedFileUrl: v2ContractsTable.esignSignedFileUrl,
      })
      .from(v2ContractsTable)
      .leftJoin(v2ClientDemandsTable, eq(v2ContractsTable.clientDemandId, v2ClientDemandsTable.id))
      .where(eq(v2ContractsTable.id, id))
      .limit(1);

    if (!row) return res.status(404).json({ error: "合同不存在" });

    if (role === "publisher") {
      if (row.channel !== "a") return res.status(403).json({ error: "无权查看此合同" });
      if (row.clientDemandId) {
        const [demand] = await db.select({ publisherId: v2ClientDemandsTable.publisherId })
          .from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, row.clientDemandId)).limit(1);
        if (demand?.publisherId !== userId) return res.status(403).json({ error: "无权查看此合同" });
      }
    } else if (role === "opc") {
      if (row.channel !== "b") return res.status(403).json({ error: "无权查看此合同" });
    }

    return res.json(row);
  } catch (err) {
    logger.error({ err }, "GET /v2/contracts/:id failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/contracts", requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { channel, clientDemandId, outsourceOrderId, content } = req.body as {
      channel: "a" | "b";
      clientDemandId?: number;
      outsourceOrderId?: number;
      content?: string;
    };
    if (!channel) return res.status(400).json({ error: "channel 必填 (a/b)" });
    if (channel === "a" && !clientDemandId) return res.status(400).json({ error: "A通道合同需要 clientDemandId" });
    if (channel === "b" && !outsourceOrderId) return res.status(400).json({ error: "B通道合同需要 outsourceOrderId" });

    const contractNo = await genContractNo(channel);
    const [created] = await db.insert(v2ContractsTable).values({
      contractNo,
      channel,
      clientDemandId,
      outsourceOrderId,
      content,
      status: "draft",
    }).returning();

    return res.status(201).json(created);
  } catch (err) {
    logger.error({ err }, "POST /v2/contracts failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.patch("/contracts/:id/invoice", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [contract] = await db.select().from(v2ContractsTable).where(eq(v2ContractsTable.id, id)).limit(1);
    if (!contract) return res.status(404).json({ error: "合同不存在" });
    const { invoiceType, taxRate } = req.body as { invoiceType?: string; taxRate?: number };
    if (!invoiceType) return res.status(400).json({ error: "发票类型必填" });
    if (taxRate === undefined || taxRate === null) return res.status(400).json({ error: "税率必填" });
    const [updated] = await db.update(v2ContractsTable)
      .set({ invoiceType, taxRate: String(taxRate), updatedAt: new Date() })
      .where(eq(v2ContractsTable.id, id))
      .returning();
    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "PATCH /v2/contracts/:id/invoice failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.patch("/contracts/:id/content", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [contract] = await db.select().from(v2ContractsTable).where(eq(v2ContractsTable.id, id)).limit(1);
    if (!contract) return res.status(404).json({ error: "合同不存在" });
    if (contract.outsourceOrderId) {
      const [ord] = await db.select({ status: v2OutsourceOrdersTable.status })
        .from(v2OutsourceOrdersTable).where(eq(v2OutsourceOrdersTable.id, contract.outsourceOrderId)).limit(1);
      if (ord && !["draft", "pending_contract"].includes(ord.status)) return res.status(400).json({ error: "订单已进入执行阶段，合同不可再编辑" });
    }
    const { content } = req.body as { content: string };
    if (content === undefined) return res.status(400).json({ error: "content 必填" });

    const [updated] = await db.update(v2ContractsTable)
      .set({ content, updatedAt: new Date() })
      .where(eq(v2ContractsTable.id, id))
      .returning();
    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "PATCH /v2/contracts/:id/content failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/contracts/:id/finalize", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const [contract] = await db.select().from(v2ContractsTable).where(eq(v2ContractsTable.id, id)).limit(1);
    if (!contract) return res.status(404).json({ error: "合同不存在" });
    if (!["draft", "publisher_rejected"].includes(contract.status)) {
      return res.status(400).json({ error: "当前状态不可定稿" });
    }

    const { content } = req.body as { content?: string };
    const updates: any = {
      status: "pending_publisher_confirm",
      finalizedBy: userId,
      finalizedAt: new Date(),
      updatedAt: new Date(),
    };
    if (content) updates.content = content;

    const [updated] = await db.update(v2ContractsTable).set(updates)
      .where(eq(v2ContractsTable.id, id)).returning();

    if (contract.channel === "a" && contract.clientDemandId) {
      const [demand] = await db.select({ publisherId: v2ClientDemandsTable.publisherId, title: v2ClientDemandsTable.title })
        .from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, contract.clientDemandId)).limit(1);
      if (demand) {
        await notify(demand.publisherId, "v2_contract_finalized", "合同待您确认",
          `运营方已完成合同「${contract.contractNo}」定稿，请查阅并确认合同内容。`, id, "v2_contract");
      }
    }

    if (contract.channel === "b" && contract.outsourceOrderId) {
      const [order] = await db.select({
        id: v2OutsourceOrdersTable.id,
        opcId: v2OutsourceOrdersTable.opcId,
        orderNo: v2OutsourceOrdersTable.orderNo,
        outsourceDemandId: v2OutsourceOrdersTable.outsourceDemandId,
        status: v2OutsourceOrdersTable.status,
      }).from(v2OutsourceOrdersTable)
        .where(eq(v2OutsourceOrdersTable.id, contract.outsourceOrderId))
        .limit(1);
      if (order && order.status === "draft") {
        await db.update(v2OutsourceOrdersTable)
          .set({ status: "pending_contract", updatedAt: new Date() })
          .where(eq(v2OutsourceOrdersTable.id, order.id));
        const [demand] = await db.select({ title: v2OutsourceDemandsTable.title })
          .from(v2OutsourceDemandsTable)
          .where(eq(v2OutsourceDemandsTable.id, order.outsourceDemandId))
          .limit(1);
        await notify(order.opcId, "v2_contract_finalized", "合同已定稿，请查阅并确认",
          `外包订单 ${order.orderNo}（「${demand?.title ?? ""}」）合同已运营定稿，请查阅合同内容并确认签约意向。`,
          contract.outsourceOrderId, "v2_outsource_order");
      }
    }

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "POST /v2/contracts/:id/finalize failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/contracts/:id/publisher-confirm", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const role = req.user!.role;
    if (role !== "publisher") return res.status(403).json({ error: "仅发单方可确认合同" });

    const [contract] = await db.select().from(v2ContractsTable).where(eq(v2ContractsTable.id, id)).limit(1);
    if (!contract) return res.status(404).json({ error: "合同不存在" });
    if (contract.channel !== "a") return res.status(403).json({ error: "仅A通道合同需发单方确认" });
    if (contract.clientDemandId) {
      const [demand] = await db.select({ publisherId: v2ClientDemandsTable.publisherId })
        .from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, contract.clientDemandId)).limit(1);
      if (demand?.publisherId !== userId) return res.status(403).json({ error: "无权操作此合同" });
    }
    if (contract.status !== "pending_publisher_confirm") return res.status(400).json({ error: "合同不在待确认状态" });

    const [updated] = await db.update(v2ContractsTable)
      .set({ status: "pending_sign", publisherConfirmedAt: new Date(), updatedAt: new Date() })
      .where(eq(v2ContractsTable.id, id))
      .returning();

    const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
    for (const admin of admins) {
      await notify(admin.id, "v2_contract_confirmed", "发单方已确认合同",
        `发单方已确认合同「${contract.contractNo}」，待签约完成后执行。`, id, "v2_contract");
    }

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "POST /v2/contracts/:id/publisher-confirm failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/contracts/:id/publisher-reject", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    if (req.user!.role !== "publisher") return res.status(403).json({ error: "仅发单方可退回合同" });

    const [contract] = await db.select().from(v2ContractsTable).where(eq(v2ContractsTable.id, id)).limit(1);
    if (!contract) return res.status(404).json({ error: "合同不存在" });
    if (contract.channel !== "a") return res.status(403).json({ error: "仅A通道合同可退回" });
    if (contract.clientDemandId) {
      const [demand] = await db.select({ publisherId: v2ClientDemandsTable.publisherId })
        .from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, contract.clientDemandId)).limit(1);
      if (demand?.publisherId !== userId) return res.status(403).json({ error: "无权操作此合同" });
    }
    if (contract.status !== "pending_publisher_confirm") return res.status(400).json({ error: "合同不在待确认状态" });

    const { reason } = req.body as { reason?: string };
    const [updated] = await db.update(v2ContractsTable)
      .set({
        status: "publisher_rejected",
        publisherRejectedAt: new Date(),
        publisherRejectedReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(v2ContractsTable.id, id))
      .returning();

    const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
    for (const admin of admins) {
      await notify(admin.id, "v2_contract_rejected", "发单方退回了合同",
        `发单方退回了合同「${contract.contractNo}」${reason ? `，理由：${reason}` : ""}，请修改后重新定稿。`, id, "v2_contract");
    }

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "POST /v2/contracts/:id/publisher-reject failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/contracts/:id/initiate-esign", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { pdfUrl, counterpartyIdNumber } = req.body as { pdfUrl?: string; counterpartyIdNumber?: string };
    if (!pdfUrl) return res.status(400).json({ error: "pdfUrl 必填（请上传 PDF 后传入地址）" });

    const [contract] = await db.select().from(v2ContractsTable).where(eq(v2ContractsTable.id, id)).limit(1);
    if (!contract) return res.status(404).json({ error: "合同不存在" });
    if (contract.status !== "pending_sign") return res.status(400).json({ error: "合同不在待签约状态" });

    // Determine counterparty user ID
    let counterpartyUserId: number;
    if (contract.channel === "a" && contract.clientDemandId) {
      const [demand] = await db.select({ publisherId: v2ClientDemandsTable.publisherId })
        .from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, contract.clientDemandId)).limit(1);
      if (!demand) return res.status(400).json({ error: "未找到关联需求" });
      counterpartyUserId = demand.publisherId;
    } else if (contract.channel === "b" && contract.outsourceOrderId) {
      const [order] = await db.select({ opcId: v2OutsourceOrdersTable.opcId })
        .from(v2OutsourceOrdersTable).where(eq(v2OutsourceOrdersTable.id, contract.outsourceOrderId)).limit(1);
      if (!order) return res.status(400).json({ error: "未找到关联订单" });
      counterpartyUserId = order.opcId;
    } else {
      return res.status(400).json({ error: "合同未关联需求或订单" });
    }

    // Ensure e签宝 account for counterparty
    const identity = await ensureEsignAccount(counterpartyUserId, counterpartyIdNumber);
    if (!identity.accountId && !identity.orgId) {
      return res.status(400).json({ error: identity.pendingReason ?? "对方签署账号未注册，请检查对方实名信息" });
    }

    // Download PDF from storage URL
    const pdfRes = await fetch(pdfUrl, { signal: AbortSignal.timeout(30_000) });
    if (!pdfRes.ok) return res.status(400).json({ error: `PDF 下载失败 (${pdfRes.status})` });
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    const contentMd5 = crypto.createHash("md5").update(pdfBuffer).digest("base64");

    // Upload PDF to e签宝
    const { fileId, uploadUrl } = await getFileUploadUrl({
      fileName: `合同_${contract.contractNo}.pdf`,
      fileSize: pdfBuffer.length,
      contentMd5,
      convert2Pdf: false,
    });
    await uploadFileToEsign(uploadUrl, pdfBuffer, "application/pdf");

    // Build counterparty signer (keyword positioning)
    const counterpartyKeyword = contract.channel === "a" ? "{{甲方签章}}" : "{{乙方签章}}";
    const platformKeyword   = contract.channel === "a" ? "{{乙方签章}}" : "{{甲方签章}}";
    let counterpartySigner: FlowSigner;
    if (identity.orgId) {
      counterpartySigner = {
        signerType: "ORG",
        orgId: identity.orgId,
        signOrder: 2,
        signBeans: [{ fileId, posType: "0", keyword: counterpartyKeyword }],
      };
    } else {
      counterpartySigner = {
        signerType: "PERSON",
        accountId: identity.accountId!,
        signOrder: 2,
        signBeans: [{ fileId, posType: "0", keyword: counterpartyKeyword }],
      };
    }

    // Build webhook notify URL
    const appBaseUrl = process.env["APP_BASE_URL"] ?? "";
    const notifyUrl = appBaseUrl ? `${appBaseUrl}/api/webhooks/esign` : undefined;

    // Create sign flow
    const flowId = await createSignFlow({
      businessScene: `合同签署_${contract.contractNo}`,
      fileId,
      platformSigner: { orgId: getPlatformOrgId(), keyword: platformKeyword },
      counterpartySigner,
      notifyUrl,
    });

    // Update DB: platform is signing
    await db.update(v2ContractsTable)
      .set({ status: "esign_platform_signed", esignFlowId: flowId, esignDocId: fileId, updatedAt: new Date() })
      .where(eq(v2ContractsTable.id, id));

    // Platform auto-seals
    await platformAutoSign(flowId);

    // Get counterparty sign URL (non-fatal if it fails)
    let signUrl = "";
    try {
      if (identity.orgId) {
        signUrl = await getOrgSignUrl(flowId, identity.orgId);
      } else if (identity.accountId) {
        signUrl = await getSignUrl(flowId, identity.accountId);
      }
    } catch (err: any) {
      logger.warn({ err, flowId }, "Failed to get counterparty sign URL (non-fatal)");
    }

    // Update DB: counterparty pending
    const [updated] = await db.update(v2ContractsTable)
      .set({ status: "esign_pending", esignSignUrl: signUrl || null, updatedAt: new Date() })
      .where(eq(v2ContractsTable.id, id))
      .returning();

    // Notify counterparty
    const linkSuffix = signUrl ? `\n签署链接：${signUrl}` : "";
    if (contract.channel === "a" && contract.clientDemandId) {
      const [demand] = await db.select({ publisherId: v2ClientDemandsTable.publisherId })
        .from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, contract.clientDemandId)).limit(1);
      if (demand) {
        await notify(demand.publisherId, "v2_contract_esign_pending", "合同已发起电子签署，请完成签署",
          `合同「${contract.contractNo}」已发起电子签署，请点击下方签署链接完成电子签名。${linkSuffix}`,
          id, "v2_contract");
      }
    } else if (contract.channel === "b" && contract.outsourceOrderId) {
      const [order] = await db.select({ opcId: v2OutsourceOrdersTable.opcId })
        .from(v2OutsourceOrdersTable).where(eq(v2OutsourceOrdersTable.id, contract.outsourceOrderId)).limit(1);
      if (order) {
        await notify(order.opcId, "v2_contract_esign_pending", "合同已发起电子签署，请完成签署",
          `合同「${contract.contractNo}」已发起电子签署，请点击下方签署链接完成电子签名。${linkSuffix}`,
          contract.outsourceOrderId, "v2_outsource_order");
      }
    }

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "POST /v2/contracts/:id/initiate-esign failed");
    return res.status(500).json({ error: String((err as any)?.message ?? "服务器错误") });
  }
});

router.post("/contracts/:id/upload-signed", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const [contract] = await db.select().from(v2ContractsTable).where(eq(v2ContractsTable.id, id)).limit(1);
    if (!contract) return res.status(404).json({ error: "合同不存在" });
    if (contract.status !== "pending_sign") return res.status(400).json({ error: "合同不在待签约状态" });

    const { signedFileUrl } = req.body as { signedFileUrl: string };
    if (!signedFileUrl) return res.status(400).json({ error: "signedFileUrl 必填" });

    const [updated] = await db.update(v2ContractsTable)
      .set({ status: "signed", signedFileUrl, signedBy: userId, signedAt: new Date(), updatedAt: new Date() })
      .where(eq(v2ContractsTable.id, id))
      .returning();

    if (contract.channel === "a" && contract.clientDemandId) {
      const [demand] = await db.select({ publisherId: v2ClientDemandsTable.publisherId, title: v2ClientDemandsTable.title })
        .from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, contract.clientDemandId)).limit(1);
      if (demand) {
        await db.update(v2ClientDemandsTable)
          .set({ status: "executing", updatedAt: new Date() })
          .where(eq(v2ClientDemandsTable.id, contract.clientDemandId));
        await notify(demand.publisherId, "v2_contract_signed", "合同已签署，项目启动",
          `合同「${contract.contractNo}」已完成签署，项目正式进入执行阶段。`, id, "v2_contract");
      }
    }

    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "POST /v2/contracts/:id/upload-signed failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

export default router;
