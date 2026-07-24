/**
 * e签宝 Webhook callback handler
 * Registered at POST /api/webhooks/esign
 *
 * e签宝 calls this URL when a signing flow reaches a terminal state.
 * We verify the request signature, match the contract by esign_flow_id,
 * then archive the final PDF and update contract + related demand status.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import {
  db, v2ContractsTable, v2ClientDemandsTable, v2OutsourceOrdersTable, usersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyWebhookSignature, getSignedFileUrl } from "../lib/esign/index";
import { notify } from "./v2/utils";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/webhooks/esign", async (req: Request, res: Response) => {
  try {
    // Use rawBody captured by express.json verify hook; fall back to re-stringify
    const rawBody: string = (req as any).rawBody ?? JSON.stringify(req.body);

    // Verify e签宝 signature (skip in dev if APP_SECRET not configured)
    const isDev = process.env["NODE_ENV"] !== "production";
    const isValid = verifyWebhookSignature(
      {
        "x-timstamp": req.headers["x-timstamp"] as string,
        "x-signature": req.headers["x-signature"] as string,
      },
      rawBody,
    );
    if (!isValid && !isDev) {
      logger.warn("e签宝 webhook signature invalid — rejected");
      return res.status(401).json({ error: "签名验证失败" });
    }

    const payload = req.body as {
      eventType?: string;
      flowId?: string;
      data?: { flowId?: string; result?: number; status?: string };
    };

    // Support both flat and nested payload shapes
    const flowId = payload.flowId ?? payload.data?.flowId;
    const eventType = (payload.eventType ?? "").toUpperCase();

    logger.info({ flowId, eventType }, "e签宝 webhook received");

    if (!flowId) {
      return res.status(200).json({ message: "ok (no flowId)" });
    }

    // Only act on flow-complete events
    const isComplete =
      eventType === "SIGN_FLOW_FINISH" ||
      eventType === "FLOW_FINISH" ||
      (payload.data?.result === 2) ||
      (payload.data?.status === "COMPLETE");

    if (!isComplete) {
      logger.info({ flowId, eventType }, "e签宝 webhook: ignoring non-complete event");
      return res.status(200).json({ message: "ok (ignored)" });
    }

    // Find the contract with this flow ID
    const [contract] = await db
      .select()
      .from(v2ContractsTable)
      .where(eq(v2ContractsTable.esignFlowId, flowId))
      .limit(1);

    if (!contract) {
      logger.warn({ flowId }, "e签宝 webhook: no contract found for flowId");
      return res.status(200).json({ message: "ok (contract not found)" });
    }

    if (contract.status === "signed") {
      logger.info({ flowId, contractId: contract.id }, "e签宝 webhook: contract already signed, skipping");
      return res.status(200).json({ message: "ok (already signed)" });
    }

    // Fetch final signed PDF URL from e签宝 — retry up to 3 times (signing PDF may still be processing)
    let esignSignedFileUrl: string | null = null;
    let pdfFetchError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        esignSignedFileUrl = await getSignedFileUrl(flowId);
        pdfFetchError = null;
        break;
      } catch (err: any) {
        pdfFetchError = err;
        logger.warn({ err, flowId, attempt }, `e签宝 signed PDF URL fetch attempt ${attempt}/3 failed`);
        if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 2000)); // 2s, 4s backoff
      }
    }

    if (!esignSignedFileUrl) {
      // Signing is legally complete but PDF archival failed; mark signed and alert admins
      logger.error({ flowId, contractId: contract.id, pdfFetchError }, "⚠️ e签宝 PDF archival failed after 3 retries — contract marked signed with null PDF URL; admin manual retrieval required");
    }

    // Update contract to signed (signature is legally final regardless of PDF URL)
    await db.update(v2ContractsTable)
      .set({
        status: "signed",
        esignSignedFileUrl: esignSignedFileUrl || null,
        signedFileUrl: esignSignedFileUrl || null,
        signedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(v2ContractsTable.id, contract.id));

    // Notify all parties + trigger downstream status changes
    const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));

    // Alert admins if PDF archival failed so they can retrieve it manually from e签宝 console
    if (!esignSignedFileUrl) {
      for (const admin of admins) {
        await notify(admin.id, "v2_contract_signed", "⚠️ 合同已签署但 PDF 归档失败，请手动处理",
          `合同「${contract.contractNo}」已完成电子签署（flowId: ${flowId}），但从 e签宝 获取签署 PDF 失败，请登录 e签宝 控制台手动下载并补录至系统。`,
          contract.id, "v2_contract");
      }
    }

    if (contract.channel === "a" && contract.clientDemandId) {
      // Channel A: update demand to executing
      await db.update(v2ClientDemandsTable)
        .set({ status: "executing", updatedAt: new Date() })
        .where(eq(v2ClientDemandsTable.id, contract.clientDemandId));

      const [demand] = await db.select({ publisherId: v2ClientDemandsTable.publisherId })
        .from(v2ClientDemandsTable).where(eq(v2ClientDemandsTable.id, contract.clientDemandId)).limit(1);

      if (demand) {
        await notify(demand.publisherId, "v2_contract_signed", "合同已签署，项目正式启动",
          `合同「${contract.contractNo}」双方已完成电子签署，项目进入执行阶段。`,
          contract.id, "v2_contract");
      }

      for (const admin of admins) {
        await notify(admin.id, "v2_contract_signed", "e签宝签署完成",
          `合同「${contract.contractNo}」已完成电子签署，需求状态已更新为执行中。`,
          contract.id, "v2_contract");
      }
    } else if (contract.channel === "b" && contract.outsourceOrderId) {
      const [order] = await db.select({ opcId: v2OutsourceOrdersTable.opcId })
        .from(v2OutsourceOrdersTable).where(eq(v2OutsourceOrdersTable.id, contract.outsourceOrderId)).limit(1);

      if (order) {
        await notify(order.opcId, "v2_contract_signed", "合同已签署",
          `合同「${contract.contractNo}」双方已完成电子签署。`,
          contract.outsourceOrderId!, "v2_outsource_order");
      }

      for (const admin of admins) {
        await notify(admin.id, "v2_contract_signed", "e签宝签署完成（B通道）",
          `合同「${contract.contractNo}」已完成电子签署。`,
          contract.outsourceOrderId!, "v2_outsource_order");
      }
    }

    logger.info({ contractId: contract.id, flowId }, "e签宝 signing flow completed — contract archived");
    return res.status(200).json({ message: "ok" });
  } catch (err) {
    logger.error({ err }, "POST /api/webhooks/esign failed");
    return res.status(500).json({ error: "服务器错误" });
  }
});

export default router;
