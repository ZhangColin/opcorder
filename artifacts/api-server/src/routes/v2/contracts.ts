import crypto from "crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  db, v2ContractsTable, v2ClientDemandsTable, v2OutsourceOrdersTable, usersTable,
  v2OutsourceDemandsTable, contractTemplatesTable,
  publisherProfilesTable, settlementAccountsTable, contractPlaceholderDefsTable,
  platformInfoTable, platformContractConfigTable,
} from "@workspace/db";
import { eq, and, desc, or, inArray } from "drizzle-orm";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/adminAuth";
import { notify, genContractNo } from "./utils";
import { logger } from "../../lib/logger";
import {
  getFileUploadUrl, uploadFileToEsign, createSignFlow, createFileFromTemplate,
  getSignUrl, getKeywordPositions, extractFirstPosition,
  type V3Signer, type KeywordPositionResult,
} from "../../lib/esign/index";

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
      // Scope to B-channel contracts owned by this OPC (via the linked outsource order)
      const ownedOrders = await db
        .select({ id: v2OutsourceOrdersTable.id })
        .from(v2OutsourceOrdersTable)
        .where(eq(v2OutsourceOrdersTable.opcId, userId));
      const ownedOrderIds = ownedOrders.map(o => o.id);
      if (ownedOrderIds.length === 0) return res.json([]);
      conditions.push(eq(v2ContractsTable.channel, "b"));
      conditions.push(inArray(v2ContractsTable.outsourceOrderId, ownedOrderIds));
    }

    const rows = await db
      .select({
        id: v2ContractsTable.id,
        contractNo: v2ContractsTable.contractNo,
        channel: v2ContractsTable.channel,
        clientDemandId: v2ContractsTable.clientDemandId,
        outsourceOrderId: v2ContractsTable.outsourceOrderId,
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
        outsourceOrderNo: v2OutsourceOrdersTable.orderNo,
        invoiceType: v2ContractsTable.invoiceType,
        taxRate: v2ContractsTable.taxRate,
        esignSignUrl: v2ContractsTable.esignSignUrl,
        esignSignedFileUrl: v2ContractsTable.esignSignedFileUrl,
      })
      .from(v2ContractsTable)
      .leftJoin(v2ClientDemandsTable, eq(v2ContractsTable.clientDemandId, v2ClientDemandsTable.id))
      .leftJoin(v2OutsourceOrdersTable, eq(v2ContractsTable.outsourceOrderId, v2OutsourceOrdersTable.id))
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
      // Ownership check: the linked outsource order must belong to this OPC
      if (row.outsourceOrderId) {
        const [ord] = await db.select({ opcId: v2OutsourceOrdersTable.opcId })
          .from(v2OutsourceOrdersTable).where(eq(v2OutsourceOrdersTable.id, row.outsourceOrderId)).limit(1);
        if (ord?.opcId !== userId) return res.status(403).json({ error: "无权查看此合同" });
      } else {
        return res.status(403).json({ error: "无权查看此合同" });
      }
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
    const { channel, clientDemandId, outsourceOrderId, content, templateId } = req.body as {
      channel: "a" | "b";
      clientDemandId?: number;
      outsourceOrderId?: number;
      content?: string;
      templateId?: number;
    };
    if (!channel) return res.status(400).json({ error: "channel 必填 (a/b)" });
    if (channel === "a" && !clientDemandId) return res.status(400).json({ error: "A通道合同需要 clientDemandId" });
    if (channel === "b" && !outsourceOrderId) return res.status(400).json({ error: "B通道合同需要 outsourceOrderId" });

    const contractNo = await genContractNo(channel);
    const cfgParty = channel === "a" ? "publisher" : "opc";
    const [cfg] = await db.select().from(platformContractConfigTable).where(eq(platformContractConfigTable.partyType, cfgParty)).limit(1);
    const [created] = await db.insert(v2ContractsTable).values({
      contractNo,
      channel,
      clientDemandId,
      outsourceOrderId,
      content,
      templateId,
      status: "draft",
      invoiceType: cfg?.invoiceType ?? "普通发票",
      taxRate: cfg?.taxRate ?? "0",
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
    const { pdfUrl, counterpartyIdNumber, templateId: bodyTemplateId } = req.body as {
      pdfUrl?: string;
      counterpartyIdNumber?: string;
      templateId?: number;
    };

    const [contract] = await db.select().from(v2ContractsTable).where(eq(v2ContractsTable.id, id)).limit(1);
    if (!contract) return res.status(404).json({ error: "合同不存在" });
    if (contract.status !== "pending_sign") return res.status(400).json({ error: "合同不在待签约状态" });

    // Determine counterparty user ID and collect runtime demand/order data for variable resolution
    let counterpartyUserId: number;
    let runtimeDemand: { demandNo: string; title: string; budgetMax: number | null } | null = null;
    let runtimeOrder: { orderNo: string } | null = null;

    if (contract.channel === "a" && contract.clientDemandId) {
      const [demand] = await db.select({
        publisherId: v2ClientDemandsTable.publisherId,
        demandNo: v2ClientDemandsTable.demandNo,
        title: v2ClientDemandsTable.title,
        budgetMax: v2ClientDemandsTable.budgetMax,
      }).from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, contract.clientDemandId)).limit(1);
      if (!demand) return res.status(400).json({ error: "未找到关联需求" });
      counterpartyUserId = demand.publisherId;
      runtimeDemand = { demandNo: demand.demandNo, title: demand.title, budgetMax: demand.budgetMax };
    } else if (contract.channel === "b" && contract.outsourceOrderId) {
      const [order] = await db.select({
        opcId: v2OutsourceOrdersTable.opcId,
        orderNo: v2OutsourceOrdersTable.orderNo,
      }).from(v2OutsourceOrdersTable).where(eq(v2OutsourceOrdersTable.id, contract.outsourceOrderId)).limit(1);
      if (!order) return res.status(400).json({ error: "未找到关联订单" });
      counterpartyUserId = order.opcId;
      runtimeOrder = { orderNo: order.orderNo };
    } else {
      return res.status(400).json({ error: "合同未关联需求或订单" });
    }

    // Get counterparty contact info + supplementary data (parallel)
    const [counterparty] = await db
      .select({ nickname: usersTable.nickname, phone: usersTable.phone })
      .from(usersTable)
      .where(eq(usersTable.id, counterpartyUserId))
      .limit(1);
    if (!counterparty) return res.status(400).json({ error: "对方用户不存在" });
    if (!counterparty.phone) return res.status(400).json({ error: "对方手机号未填写，无法发起电子签署" });

    // Fetch platform info, counterparty settlement account, and (for channel A) publisher profile in parallel.
    // Settlement account enables enterprise (org) signing when the counterparty has a verified company identity.
    // In V3, signer info is embedded per-flow at creation time so there is no pre-registration step —
    // any change to user profile / company details is automatically picked up on the next sign flow.
    const [platformInfo, counterpartySettlement, publisherProfile] = await Promise.all([
      db.select().from(platformInfoTable).limit(1).then(r => r[0] ?? null),
      db.select({
        companyName: settlementAccountsTable.companyName,
        creditCode: settlementAccountsTable.creditCode,
        contactPerson: settlementAccountsTable.contactPerson,
        contactPhone: settlementAccountsTable.contactPhone,
      })
        .from(settlementAccountsTable)
        .where(and(
          eq(settlementAccountsTable.userId, counterpartyUserId),
          eq(settlementAccountsTable.status, "verified"),
        ))
        .orderBy(desc(settlementAccountsTable.updatedAt))
        .limit(1)
        .then(r => r[0] ?? null),
      contract.channel === "a"
        ? db.select({ creditCode: publisherProfilesTable.creditCode, contactPerson: publisherProfilesTable.contactPerson })
            .from(publisherProfilesTable)
            .where(eq(publisherProfilesTable.userId, counterpartyUserId))
            .limit(1)
            .then(r => r[0] ?? null)
        : Promise.resolve(null),
    ]);

    // ── Obtain fileId for signing ─────────────────────────────────────────
    let fileId: string;

    if (pdfUrl) {
      // Non-standard path: admin provides a signed PDF to upload directly
      // Build the set of allowed PDF hosts: Replit preview domains + APP_BASE_URL host (production
      // app domain, e.g. www.opcorder.com) + any extra hosts from ALLOWED_PDF_HOSTS env var.
      // This ensures that files uploaded via the app's own storage API are always accepted.
      const extraHosts = (process.env.ALLOWED_PDF_HOSTS ?? "").split(",").map(h => h.trim()).filter(Boolean);
      const appBaseHost = (() => {
        try { return new URL(process.env.APP_BASE_URL ?? "").hostname; } catch { return ""; }
      })();
      const allowedHosts = [...extraHosts, ...(appBaseHost ? [appBaseHost] : [])];
      let pdfHostOk = false;
      try {
        const pdfParsed = new URL(pdfUrl);
        pdfHostOk = pdfParsed.protocol === "https:" && (
          pdfParsed.hostname.endsWith(".replit.app") ||
          pdfParsed.hostname.endsWith(".replit.dev") ||
          pdfParsed.hostname.endsWith(".replit.co") ||
          allowedHosts.some(h => pdfParsed.hostname === h || pdfParsed.hostname.endsWith("." + h))
        );
      } catch { /* invalid URL */ }
      if (!pdfHostOk) return res.status(400).json({ error: "pdfUrl 域名不在允许范围内" });
      const pdfRes = await fetch(pdfUrl, { signal: AbortSignal.timeout(30_000) });
      if (!pdfRes.ok) return res.status(400).json({ error: `PDF 下载失败 (${pdfRes.status})` });
      const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
      const contentMd5 = crypto.createHash("md5").update(pdfBuffer).digest("base64");
      const { fileId: uploadedFileId, uploadUrl } = await getFileUploadUrl({
        fileName: `合同_${contract.contractNo}.pdf`,
        fileSize: pdfBuffer.length,
        contentMd5,
        convertToPDF: false,
      });
      await uploadFileToEsign(uploadUrl, pdfBuffer, "application/pdf");
      fileId = uploadedFileId;
    } else {
      // Standard path: generate file from the contract's associated e签宝 doc-template
      // templateId may come from the request body (set at initiate time) or stored on the contract
      const effectiveTemplateId = bodyTemplateId ?? contract.templateId;
      if (!effectiveTemplateId) {
        return res.status(400).json({ error: "合同未关联模板，如需电子签署请上传合同PDF（非标准路径）或在发起时选择合同模板" });
      }
      // Persist the templateId on the contract if it was supplied in the request
      if (bodyTemplateId && bodyTemplateId !== contract.templateId) {
        await db.update(v2ContractsTable)
          .set({ templateId: bodyTemplateId, updatedAt: new Date() })
          .where(eq(v2ContractsTable.id, id));
      }
      const [template] = await db.select()
        .from(contractTemplatesTable)
        .where(eq(contractTemplatesTable.id, effectiveTemplateId))
        .limit(1);
      if (!template?.esignTemplateId) {
        return res.status(400).json({ error: "合同模板未配置 e签宝 模板ID，请联系管理员配置或上传合同PDF" });
      }
      // Resolve runtime values for template components using placeholder sourceField definitions.
      // The variableMapping stored on the template provides static fallback values; runtime
      // data (from demand, order, platform, counterparty) is preferred when a sourceField is known.
      const placeholderDefs = await db.select({ key: contractPlaceholderDefsTable.key, sourceField: contractPlaceholderDefsTable.sourceField })
        .from(contractPlaceholderDefsTable);
      const defByKey = new Map(placeholderDefs.map(d => [d.key, d.sourceField ?? ""]));

      // sourceField → resolved runtime value
      const today = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Shanghai" }).replace(/\//g, "-");
      const runtimeBySourceField: Record<string, string | null | undefined> = {
        "platform_info.company_name":    platformInfo?.companyName,
        "platform_info.credit_code":     platformInfo?.creditCode,
        "platform_info.contact_person":  platformInfo?.contactPerson,
        "platform_info.contact_phone":   platformInfo?.contactPhone,
        "platform_info.contact_address": platformInfo?.contactAddress,
        "client_demands.demand_no":      runtimeDemand?.demandNo,
        "client_demands.title":          runtimeDemand?.title,
        "client_demands.budget_max":     runtimeDemand?.budgetMax?.toFixed(2),
        "outsource_orders.order_no":     runtimeOrder?.orderNo,
        // For channel A: party A = publisher (counterparty); company name from settlement account or
        // publisher profile contact person. For channel B: party A = platform, handled by platform_info.
        "publisher_profiles.company_name":
          contract.channel === "a"
            ? (counterpartySettlement?.companyName ?? publisherProfile?.contactPerson ?? counterparty.nickname ?? null)
            : (platformInfo?.companyName ?? null),
        "publisher_profiles.credit_code":
          contract.channel === "a"
            ? (counterpartySettlement?.creditCode ?? publisherProfile?.creditCode ?? null)
            : (platformInfo?.creditCode ?? null),
        "users.name":  counterparty.nickname,
        "users.phone": counterparty.phone,
      };

      // Per-placeholder-key overrides for "computed" sourceField values
      const computedByKey: Record<string, string> = {
        "{{签署日期}}":   today,
        // party B name: channel A → platform name; channel B → OPC nickname or company
        "{{乙方名称}}":   contract.channel === "a"
          ? (platformInfo?.companyName ?? "接单吧平台")
          : (counterpartySettlement?.companyName ?? counterparty.nickname ?? ""),
        "{{乙方联系电话}}": contract.channel === "a"
          ? (platformInfo?.contactPhone ?? "")
          : (counterparty.phone ?? ""),
        "{{乙方身份证号}}": counterpartyIdNumber ?? "",
      };

      const variableMap = (template.variableMapping as Record<string, string>) ?? {};
      const components = Object.entries(variableMap).map(([key, staticValue]) => {
        if (computedByKey[key] != null) return { componentKey: key, componentValue: computedByKey[key] };
        const sourceField = defByKey.get(key) ?? "";
        if (sourceField && sourceField !== "computed") {
          const resolved = runtimeBySourceField[sourceField];
          if (resolved != null) return { componentKey: key, componentValue: resolved };
        }
        return { componentKey: key, componentValue: staticValue };
      });

      fileId = await createFileFromTemplate({
        docTemplateId: template.esignTemplateId,
        fileName: `合同_${contract.contractNo}.pdf`,
        components,
      });
    }

    // Channel A: counterparty=甲方(publisher), platform=乙方
    // Channel B: counterparty=乙方(OPC),       platform=甲方
    const counterpartyKeyword = contract.channel === "a" ? "{{甲方签章}}" : "{{乙方签章}}";
    const platformKeyword     = contract.channel === "a" ? "{{乙方签章}}" : "{{甲方签章}}";

    // Resolve keyword positions in the uploaded PDF for precise stamp placement
    let kwPositions: KeywordPositionResult[] = [];
    try {
      kwPositions = await getKeywordPositions(fileId, [platformKeyword, counterpartyKeyword]);
    } catch (err) {
      logger.warn({ err, fileId }, "e签宝 keyword position lookup failed; using fallback coordinates");
    }

    // Fallback coordinates (bottom corners of page 1) if keywords not found
    const FALLBACK_PLATFORM     = { page: 1, x: 420, y: 680 };
    const FALLBACK_COUNTERPARTY = { page: 1, x: 100, y: 680 };
    const platformPos     = extractFirstPosition(kwPositions, platformKeyword)     ?? FALLBACK_PLATFORM;
    const counterpartyPos = extractFirstPosition(kwPositions, counterpartyKeyword) ?? FALLBACK_COUNTERPARTY;

    const appBaseUrl = process.env["APP_BASE_URL"] ?? "";
    const notifyUrl  = appBaseUrl ? `${appBaseUrl}/api/webhooks/esign` : undefined;

    // Signer 1: platform (signerType=1, autoSign=true — seals automatically on flow start)
    const platformSigner: V3Signer = {
      signerType: 1,
      signConfig: { signOrder: 1 },
      signFields: [{
        customBizNum: `platform_${contract.contractNo}`,
        fileId,
        normalSignFieldConfig: {
          autoSign: true,
          signFieldPosition: {
            positionPage: String(platformPos.page),
            positionX: platformPos.x,
            positionY: platformPos.y,
          },
          signFieldStyle: 1,
        },
      }],
    };

    // Signer 2: counterparty — enterprise (org) signer when a verified settlement account with
    // company name + credit code exists; otherwise personal phone-based signer.
    // In V3, all signer info is embedded per-flow at creation time — no pre-registration is needed.
    // This naturally satisfies "auto-refresh after user info changes": each new sign flow fetches
    // the latest user/company data from the DB so changes to credit code, company name, or phone
    // are automatically reflected without any explicit re-registration call.
    const counterpartySignField = {
      customBizNum: `counterparty_${contract.contractNo}`,
      fileId,
      normalSignFieldConfig: {
        signFieldPosition: {
          positionPage: String(counterpartyPos.page),
          positionX: counterpartyPos.x,
          positionY: counterpartyPos.y,
        },
        signFieldStyle: 1,
      },
    };

    const useOrgSigner = !!(counterpartySettlement?.companyName && counterpartySettlement?.creditCode);
    const counterpartySigner: V3Signer = useOrgSigner
      ? {
          signerType: 1,
          orgSignerInfo: {
            orgName: counterpartySettlement!.companyName!,
            orgInfo: {
              orgIDCardNum: counterpartySettlement!.creditCode!,
              orgIDCardType: "CRED_ORG_USCC",
            },
            transactorInfo: {
              psnAccount: counterparty.phone,
              ...(counterparty.nickname ? { psnInfo: { psnName: counterparty.nickname } } : {}),
            },
          },
          signConfig: { signOrder: 2 },
          signFields: [counterpartySignField],
        }
      : {
          signerType: 0,
          psnSignerInfo: {
            psnAccount: counterparty.phone,
            psnInfo: {
              ...(counterparty.nickname ? { psnName: counterparty.nickname } : {}),
              ...(counterpartyIdNumber ? { psnIDCardNum: counterpartyIdNumber, psnIDCardType: "0" } : {}),
            },
          },
          signConfig: { signOrder: 2 },
          signFields: [counterpartySignField],
        };

    // Create sign flow (autoStart=true triggers platform auto-seal immediately)
    const signFlowId = await createSignFlow({
      title: `合同签署_${contract.contractNo}`,
      fileId,
      fileName: `合同_${contract.contractNo}.pdf`,
      signers: [platformSigner, counterpartySigner],
      notifyUrl,
    });

    // Platform auto-sealed — record intermediate state before waiting for counterparty
    await db.update(v2ContractsTable)
      .set({ status: "esign_platform_signed", esignFlowId: signFlowId, esignDocId: fileId, updatedAt: new Date() })
      .where(eq(v2ContractsTable.id, id));

    // Get counterparty sign URL — retry up to 2 times
    let signUrl = "";
    let signUrlError: Error | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        signUrl = await getSignUrl(signFlowId, counterparty.phone);
        signUrlError = null;
        break;
      } catch (err: any) {
        signUrlError = err;
        logger.warn({ err, signFlowId, attempt }, `Failed to get counterparty sign URL (attempt ${attempt}/2)`);
        if (attempt < 2) await new Promise(r => setTimeout(r, 1500));
      }
    }

    if (!signUrl) {
      logger.error({ signFlowId, contractId: id, signUrlError }, "Failed to obtain counterparty sign URL; contract stays esign_platform_signed");
      return res.status(502).json({
        error: "流程已创建（平台已自动盖章），但获取对方签署链接失败，请稍后在管理后台重试或从 e签宝 控制台获取链接",
        signFlowId,
        hint: "contract_status=esign_platform_signed",
      });
    }

    // Transition to esign_pending — counterparty link obtained, awaiting their signature
    const [updated] = await db.update(v2ContractsTable)
      .set({ status: "esign_pending", esignSignUrl: signUrl, updatedAt: new Date() })
      .where(eq(v2ContractsTable.id, id))
      .returning();

    // Notify counterparty with sign link
    const linkSuffix = `\n签署链接：${signUrl}`;
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
