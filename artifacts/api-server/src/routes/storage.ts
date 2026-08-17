import express, { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
  VerifyUploadBody,
  VerifyUploadResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { ObjectPermission } from "../lib/objectAcl";
import { validateFileUpload, verifyUploadedFile } from "../lib/fileValidation";
import { createUploadSession, consumeUploadSession } from "../lib/uploadSessions";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Step 1 of the secure upload flow.
 *
 * 1. Validates client-declared metadata (MIME type, extension, size) against
 *    the server-side whitelist. Returns 422 on failure.
 * 2. Issues a presigned PUT URL pointing to a QUARANTINE path in GCS.
 *    The quarantine path is NOT accessible via /storage/objects/* — files
 *    remain inaccessible until /verify promotes them to the published path.
 * 3. Creates a server-side upload session that binds the quarantine path,
 *    published path, and trusted metadata together under an opaque token.
 * 4. Returns the presigned upload URL, the (future) published objectPath,
 *    and the session token. The session token is required for /verify.
 */
router.post("/storage/uploads/request-url", requireAuth, async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;

    // Pre-upload gate: MIME type whitelist, extension whitelist, declared size limit
    const validationError = validateFileUpload({ name, size, contentType });
    if (validationError) {
      req.log.warn(
        { validationError, name, size, contentType },
        "Upload request rejected by pre-upload gate"
      );
      res.status(422).json({ error: validationError.message, code: validationError.code });
      return;
    }

    // Issue presigned URL to quarantine path; get the future published path
    const { uploadURL, quarantineGCSPath, publishedGCSPath, publishedObjectPath } =
      await objectStorageService.getObjectEntityQuarantineUploadURL();

    // Store trusted metadata server-side — clients cannot substitute values at verify time
    const sessionToken = createUploadSession({
      quarantineGCSPath,
      publishedGCSPath,
      publishedObjectPath,
      expectedContentType: contentType,
      expectedName: name,
    });

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath: publishedObjectPath,
        sessionToken,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * POST /storage/uploads/verify
 *
 * Step 3 of the secure upload flow (after the client PUT to the presigned URL).
 *
 * Security properties:
 * - Accepts ONLY the server-issued session token; all metadata comes from the
 *   server-side session store, never from client-provided fields.
 * - Session is consumed on first call (one-time, prevents replay).
 * - Downloads magic bytes from the quarantine GCS path bound to this session.
 * - On FAILURE: deletes the quarantine object from GCS (no lingering bad files).
 * - On SUCCESS: promotes the quarantine object to the published path, making it
 *   accessible via /storage/objects/*.
 *
 * Because files start in the quarantine path (blocked by /storage/objects/*),
 * skipping /verify leaves the file permanently inaccessible, not exploitable.
 */
router.post("/storage/uploads/verify", requireAuth, async (req: Request, res: Response) => {
  const parsed = VerifyUploadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  const { sessionToken } = parsed.data;

  // Consume session — one-time use, immediately invalidated
  const session = consumeUploadSession(sessionToken);
  if (!session) {
    res.status(401).json({ error: "无效或已过期的上传会话" });
    return;
  }

  const { quarantineGCSPath, publishedGCSPath, publishedObjectPath,
          expectedContentType, expectedName } = session;

  try {
    // Get File object for the quarantine path (bypasses /objects/* access control)
    const quarantineFile = objectStorageService.getFileFromGCSPath(quarantineGCSPath);

    // Validate actual bytes, size, MIME type, and extension using TRUSTED session metadata
    const verificationError = await verifyUploadedFile(
      quarantineFile,
      expectedContentType,
      expectedName
    );

    if (verificationError) {
      // Delete the quarantine object to avoid lingering malicious files
      await quarantineFile.delete().catch((err: unknown) => {
        req.log.warn({ err, quarantineGCSPath }, "Failed to delete quarantine object after failed verification");
      });
      req.log.warn(
        { verificationError, quarantineGCSPath, expectedContentType, expectedName },
        "Post-upload verification failed; quarantine object deleted"
      );
      res.status(422).json({ error: verificationError.message, code: verificationError.code });
      return;
    }

    // Promote: copy quarantine → published path, delete quarantine
    await objectStorageService.promoteFromQuarantine(quarantineGCSPath, publishedGCSPath);

    req.log.info({ publishedObjectPath }, "Upload verified and promoted to published path");
    res.json(VerifyUploadResponse.parse({ objectPath: publishedObjectPath, verified: true }));
  } catch (error) {
    req.log.error({ err: error }, "Error verifying upload");
    res.status(500).json({ error: "Failed to verify upload" });
  }
});

/**
 * POST /storage/uploads/direct
 *
 * Single-step server-side upload. The file body is streamed directly from the
 * client to GCS via the server — no browser→GCS presigned PUT needed, which
 * avoids CORS / connectivity issues in proxied environments.
 *
 * Query params: name (filename), contentType (MIME type)
 * Body: raw file bytes (Content-Type must match the contentType param)
 */
router.post(
  "/storage/uploads/direct",
  requireAuth,
  express.raw({ type: "*/*", limit: "55mb" }),
  async (req: Request, res: Response) => {
    const name = typeof req.query.name === "string" ? req.query.name.trim() : "";
    const contentType = typeof req.query.contentType === "string" ? req.query.contentType.trim() : "";
    const size = (req.body as Buffer).length;

    if (!name || !contentType) {
      res.status(400).json({ error: "缺少 name 或 contentType 参数" });
      return;
    }

    const validationError = validateFileUpload({ name, size, contentType });
    if (validationError) {
      res.status(422).json({ error: validationError.message, code: validationError.code });
      return;
    }

    try {
      const readable = Readable.from(req.body as Buffer);
      const { quarantineGCSPath, publishedGCSPath, publishedObjectPath } =
        await objectStorageService.streamToQuarantine(contentType, readable);

      const quarantineFile = objectStorageService.getFileFromGCSPath(quarantineGCSPath);
      const verificationError = await verifyUploadedFile(quarantineFile, contentType, name);
      if (verificationError) {
        await quarantineFile.delete().catch((err: unknown) => {
          req.log.warn({ err, quarantineGCSPath }, "Failed to delete quarantine object after failed verification");
        });
        res.status(422).json({ error: verificationError.message, code: verificationError.code });
        return;
      }

      await objectStorageService.promoteFromQuarantine(quarantineGCSPath, publishedGCSPath);
      req.log.info({ publishedObjectPath }, "Direct upload verified and promoted");
      res.json({ objectPath: publishedObjectPath });
    } catch (error) {
      req.log.error({ err: error }, "Error in direct upload");
      res.status(500).json({ error: "上传失败，请重试" });
    }
  }
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 *
 * Note: quarantine-area paths (containing /pending/) are blocked at the
 * getObjectEntityFile layer in ObjectStorageService.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    // --- Protected route example (uncomment when using replit-auth) ---
    // if (!req.isAuthenticated()) {
    //   res.status(401).json({ error: "Unauthorized" });
    //   return;
    // }
    // const canAccess = await objectStorageService.canAccessObjectEntity({
    //   userId: req.user.id,
    //   objectFile,
    //   requestedPermission: ObjectPermission.READ,
    // });
    // if (!canAccess) {
    //   res.status(403).json({ error: "Forbidden" });
    //   return;
    // }

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    const fileName = typeof req.query.name === "string" && req.query.name.trim()
      ? req.query.name.trim()
      : null;
    if (fileName) {
      const safe = fileName.replace(/[^\w\u4e00-\u9fa5.\-_ ()]/g, "_");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`
      );
    }

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
