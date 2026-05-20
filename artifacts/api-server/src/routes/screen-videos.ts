import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin, requirePermission } from "../middleware/adminAuth";
import { ObjectStorageService } from "../lib/objectStorage";
import { validateFileUpload, verifyUploadedFile } from "../lib/fileValidation";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /admin/screen-videos/upload
 *
 * Server-side video upload: the browser streams the file body directly to
 * this endpoint (Content-Type: video/mp4 or video/webm). The server writes
 * it to the GCS quarantine path, verifies magic bytes, then promotes it.
 * This avoids the browser→GCS direct PUT which is blocked by CORS for video
 * MIME types on Replit's managed storage.
 *
 * Query params:
 *   name  — original filename (used for extension validation)
 */
router.post("/admin/screen-videos/upload", requireAdmin, requirePermission("screen"), async (req: Request, res: Response) => {
  const name = typeof req.query.name === "string" && req.query.name.trim()
    ? req.query.name.trim()
    : "video.mp4";
  const contentType = (req.headers["content-type"] ?? "").split(";")[0].trim() || "video/mp4";
  const declaredSize = parseInt(req.headers["content-length"] ?? "0", 10);

  const validationError = validateFileUpload({ name, size: declaredSize, contentType });
  if (validationError) {
    res.status(422).json({ error: validationError.message, code: validationError.code });
    return;
  }

  try {
    const { quarantineGCSPath, publishedGCSPath, publishedObjectPath } =
      await objectStorageService.streamToQuarantine(contentType, req);

    const quarantineFile = objectStorageService.getFileFromGCSPath(quarantineGCSPath);
    const verificationError = await verifyUploadedFile(quarantineFile, contentType, name);

    if (verificationError) {
      await quarantineFile.delete().catch(() => {});
      req.log.warn({ verificationError, contentType, name }, "Screen video verification failed");
      res.status(422).json({ error: verificationError.message, code: verificationError.code });
      return;
    }

    await objectStorageService.promoteFromQuarantine(quarantineGCSPath, publishedGCSPath);
    req.log.info({ publishedObjectPath }, "Screen video uploaded and promoted");
    res.json({ objectPath: publishedObjectPath });
  } catch (err) {
    req.log.error({ err }, "Failed to upload screen video");
    res.status(500).json({ error: "上传失败，请重试" });
  }
});

router.get("/screen/videos", async (req: Request, res: Response) => {
  try {
    const { rows } = await db.execute(sql`
      SELECT id, title, object_path AS "objectPath", sort_order AS "sortOrder"
      FROM screen_videos
      ORDER BY sort_order ASC, id ASC
    `);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list screen videos");
    res.status(500).json({ error: "Failed to list videos" });
  }
});

router.get("/admin/screen-videos", requireAdmin, requirePermission("screen"), async (req: Request, res: Response) => {
  try {
    const { rows } = await db.execute(sql`
      SELECT id, title, object_path AS "objectPath", sort_order AS "sortOrder",
             created_at AS "createdAt"
      FROM screen_videos
      ORDER BY sort_order ASC, id ASC
    `);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list admin screen videos");
    res.status(500).json({ error: "Failed to list videos" });
  }
});

router.post("/admin/screen-videos", requireAdmin, requirePermission("screen"), async (req: Request, res: Response) => {
  const { title = "", objectPath, sortOrder = 0 } = req.body ?? {};
  if (!objectPath) {
    res.status(400).json({ error: "objectPath is required" });
    return;
  }
  try {
    const { rows } = await db.execute(sql`
      INSERT INTO screen_videos (title, object_path, sort_order)
      VALUES (${title}, ${objectPath}, ${Number(sortOrder)})
      RETURNING id, title, object_path AS "objectPath", sort_order AS "sortOrder",
                created_at AS "createdAt"
    `);
    res.json(rows[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to create screen video");
    res.status(500).json({ error: "Failed to create video" });
  }
});

router.patch("/admin/screen-videos/:id", requireAdmin, requirePermission("screen"), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const { title, sortOrder } = req.body ?? {};
  try {
    await db.execute(sql`
      UPDATE screen_videos
      SET title      = COALESCE(${title      ?? null}, title),
          sort_order = COALESCE(${sortOrder != null ? Number(sortOrder) : null}, sort_order)
      WHERE id = ${id}
    `);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update screen video");
    res.status(500).json({ error: "Failed to update video" });
  }
});

router.delete("/admin/screen-videos/:id", requireAdmin, requirePermission("screen"), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  try {
    await db.execute(sql`DELETE FROM screen_videos WHERE id = ${id}`);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete screen video");
    res.status(500).json({ error: "Failed to delete video" });
  }
});

export default router;
