import { Router, type IRouter, type Request, type Response } from "express";
import {
  db, v2ContractsTable, v2ClientDemandsTable, v2OutsourceOrdersTable, usersTable,
} from "@workspace/db";
import { eq, and, desc, or, inArray } from "drizzle-orm";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/adminAuth";
import { notify, genContractNo } from "./utils";
import { logger } from "../../lib/logger";

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
      .select()
      .from(v2ContractsTable)
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

    const [contract] = await db.select().from(v2ContractsTable).where(eq(v2ContractsTable.id, id)).limit(1);
    if (!contract) return res.status(404).json({ error: "合同不存在" });

    if (role === "publisher") {
      if (contract.channel !== "a") return res.status(403).json({ error: "无权查看此合同" });
      if (contract.clientDemandId) {
        const [demand] = await db.select({ publisherId: v2ClientDemandsTable.publisherId })
          .from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, contract.clientDemandId)).limit(1);
        if (demand?.publisherId !== userId) return res.status(403).json({ error: "无权查看此合同" });
      }
    } else if (role === "opc") {
      if (contract.channel !== "b") return res.status(403).json({ error: "无权查看此合同" });
    }

    return res.json(contract);
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
    if (contract.status !== "pending_publisher_confirm") return res.status(400).json({ error: "合同不在待确认状态" });
    if (contract.channel !== "a") return res.status(400).json({ error: "仅A通道合同需发单方确认" });

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
