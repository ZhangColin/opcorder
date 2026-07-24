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

    // Fetch final signed PDF URL from e签宝
    let esignSignedFileUrl: string | null = null;
    try {
      esignSignedFileUrl = await getSignedFileUrl(flowId);
    } catch (err: any) {
      logger.warn({ err, flowId }, "Failed to get signed PDF URL from e签宝 (non-fatal)");
    }

    // Update contract to signed
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
