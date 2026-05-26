import { db, notificationsTable, demandInvitationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { Resend } from "resend";
import { logger } from "./logger";

const resend = new Resend(process.env.RESEND_API_KEY || "re_missing_placeholder");

const LEVEL_LABEL: Record<string, string> = { A: "专家", B: "进阶", C: "新手", any: "不限" };

function escape(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export function buildInvitationEmailHtml(opts: {
  nickname: string;
  demandTitle: string;
  catName: string;
  requiredTrackLevel: string;
  budget: number;
  deadline: Date | string | null;
  ctaUrl: string;
}): string {
  const dl = opts.deadline ? new Date(opts.deadline).toLocaleDateString("zh-CN") : "未指定";
  const levelLabel = LEVEL_LABEL[opts.requiredTrackLevel] ?? opts.requiredTrackLevel;
  return `<!doctype html>
<html><body style="font-family:-apple-system,Helvetica,Arial,sans-serif;background:#f5f6fa;padding:24px;color:#1a1c1e">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,50,125,.08)">
    <h2 style="color:#00327d;margin:0 0 16px">您有一条新的邀请报价</h2>
    <p style="margin:0 0 12px">您好，${escape(opts.nickname)}：</p>
    <p style="margin:0 0 16px;line-height:1.6">平台根据您的赛道认证，向您定向邀请报价以下需求：</p>
    <div style="background:#f7f9fc;border-left:4px solid #00327d;border-radius:8px;padding:16px 20px;margin:0 0 20px">
      <p style="margin:0 0 8px;font-weight:700;font-size:16px;color:#00327d">${escape(opts.demandTitle)}</p>
      <p style="margin:4px 0;font-size:13px;color:#555">所属赛道：${escape(opts.catName)}</p>
      <p style="margin:4px 0;font-size:13px;color:#555">要求认证等级：${escape(levelLabel)}</p>
      <p style="margin:4px 0;font-size:13px;color:#555">预算：¥${opts.budget.toLocaleString()}</p>
      <p style="margin:4px 0;font-size:13px;color:#555">交付截止：${dl}</p>
    </div>
    <p style="margin:0 0 20px;line-height:1.6">如有兴趣，请尽快前往平台提交报价。</p>
    <p style="text-align:center;margin:24px 0">
      <a href="${opts.ctaUrl}" style="display:inline-block;background:#00327d;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700">一键去报价</a>
    </p>
    <p style="font-size:12px;color:#999;border-top:1px solid #eee;padding-top:16px;margin-top:24px">
      此邮件由 接单吧 平台自动发送，请勿直接回复。
    </p>
  </div>
</body></html>`;
}

export function getWebOrigin(): string {
  const explicit = process.env.WEB_ORIGIN;
  if (explicit) return explicit.replace(/\/+$/, "");
  const replitDomain = process.env.REPLIT_DEV_DOMAIN;
  if (replitDomain) return `https://${replitDomain}`;
  return "http://localhost:5173";
}

/**
 * Send invitation in-app notifications synchronously (one per invited OPC).
 * Idempotent — caller is expected to invoke after insert.
 *
 * Notification content includes track, required level, budget range, deadline
 * and a one-click link to the demand detail page.
 */
export async function sendInvitationInAppNotifications(args: {
  demandId: number;
  demandTitle: string;
  catName?: string;
  requiredTrackLevel?: string;
  budget?: number | null;
  deadline?: Date | string | null;
  invitedOpcIds: number[];
}): Promise<void> {
  if (args.invitedOpcIds.length === 0) return;
  const levelLabel = args.requiredTrackLevel ? (LEVEL_LABEL[args.requiredTrackLevel] ?? args.requiredTrackLevel) : null;
  const dl = args.deadline ? new Date(args.deadline).toLocaleDateString("zh-CN") : null;
  const ctaUrl = `${getWebOrigin()}/demands/${args.demandId}`;
  const lines: string[] = [
    `平台根据您的赛道认证，邀请您对需求「${args.demandTitle}」进行报价。`,
  ];
  if (args.catName) lines.push(`所属赛道：${args.catName}`);
  if (levelLabel) lines.push(`要求认证等级：${levelLabel}`);
  if (typeof args.budget === "number") lines.push(`预算：¥${args.budget.toLocaleString()}`);
  if (dl) lines.push(`交付截止：${dl}`);
  lines.push(`一键去报价：${ctaUrl}`);
  const content = lines.join("\n");

  await db.insert(notificationsTable).values(
    args.invitedOpcIds.map(opcId => ({
      userId: opcId,
      type: "directed_invite" as const,
      title: "您收到一条邀请报价",
      content,
      relatedId: args.demandId,
      relatedType: "demand",
    })),
  );
}

/**
 * Send invitation emails asynchronously and sequentially with 1.1s gap between sends.
 * Non-blocking — schedules via setImmediate, returns immediately.
 * Each send updates demand_invitations.emailedAt on success.
 */
export function scheduleInvitationEmails(args: {
  demandId: number;
  demandTitle: string;
  catName: string;
  requiredTrackLevel: string;
  budget: number;
  deadline: Date | string | null;
  invitees: Array<{ userId: number; email: string | null; nickname: string }>;
}): void {
  const ctaUrl = `${getWebOrigin()}/demands/${args.demandId}`;
  const targets = args.invitees.filter(i => i.email && i.email.trim());
  if (targets.length === 0) return;

  setImmediate(async () => {
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      try {
        const html = buildInvitationEmailHtml({
          nickname: t.nickname,
          demandTitle: args.demandTitle,
          catName: args.catName,
          requiredTrackLevel: args.requiredTrackLevel,
          budget: args.budget,
          deadline: args.deadline,
          ctaUrl,
        });
        const { error } = await resend.emails.send({
          from: "接单吧 <jiedanba@opcorder.com>",
          to: t.email!,
          subject: `【接单吧】邀请您对「${args.demandTitle}」提交报价`,
          html,
        });
        if (error) {
          logger.warn({ err: error, opcId: t.userId, demandId: args.demandId }, "Invitation email send failed");
        } else {
          await db.update(demandInvitationsTable)
            .set({ emailedAt: new Date() })
            .where(and(
              eq(demandInvitationsTable.demandId, args.demandId),
              eq(demandInvitationsTable.opcId, t.userId),
            ));
        }
      } catch (err) {
        logger.warn({ err, opcId: t.userId, demandId: args.demandId }, "Invitation email send threw");
      }
      // 1.1s gap between sends (skip after last)
      if (i < targets.length - 1) {
        await new Promise(r => setTimeout(r, 1100));
      }
    }
  });
}

/**
 * SMS channel — reserved as no-op for V1.
 */
export function scheduleInvitationSms(_args: unknown): void {
  // Intentionally left as a no-op placeholder for future SMS integration.
}
