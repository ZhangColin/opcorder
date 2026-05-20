import { Storage, File } from "@google-cloud/storage";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  async downloadObject(file: File, cacheTtlSec: number = 3600): Promise<Response> {
    const [metadata] = await file.getMetadata();
    const aclPolicy = await getObjectAclPolicy(file);
    const isPublic = aclPolicy?.visibility === "public";

    const nodeStream = file.createReadStream();
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": (metadata.contentType as string) || "application/octet-stream",
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    };
    if (metadata.size) {
      headers["Content-Length"] = String(metadata.size);
    }

    return new Response(webStream, { headers });
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    return signObjectURL({ bucketName, objectName, method: "PUT", ttlSec: 900 });
  }

  /**
   * Issue a presigned PUT URL targeting a quarantine path that is NOT
   * accessible via /storage/objects/*. The file must be promoted (via
   * promoteFromQuarantine) before it can be served.
   *
   * Returns the upload URL, the quarantine GCS path (used for magic-byte
   * inspection and deletion on failure), and the final published objectPath
   * (used as the stable reference returned to the client).
   */
  /**
   * Accept a Node.js Readable stream and write it directly to a GCS quarantine
   * path (server-side upload). Avoids browser→GCS direct PUT / CORS issues.
   * The caller must verify and promote the file after this returns.
   */
  async streamToQuarantine(
    contentType: string,
    readable: Readable
  ): Promise<{ quarantineGCSPath: string; publishedGCSPath: string; publishedObjectPath: string }> {
    const privateObjectDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    const quarantineGCSPath = `${privateObjectDir}/pending/${objectId}`;
    const publishedGCSPath  = `${privateObjectDir}/uploads/${objectId}`;
    const publishedObjectPath = `/objects/uploads/${objectId}`;

    const { bucketName, objectName } = parseObjectPath(quarantineGCSPath);
    const file = objectStorageClient.bucket(bucketName).file(objectName);

    await new Promise<void>((resolve, reject) => {
      const writeStream = file.createWriteStream({ contentType, resumable: false });
      readable.pipe(writeStream);
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
      readable.on("error", reject);
    });

    return { quarantineGCSPath, publishedGCSPath, publishedObjectPath };
  }

  async getObjectEntityQuarantineUploadURL(): Promise<{
    uploadURL: string;
    quarantineGCSPath: string;
    publishedGCSPath: string;
    publishedObjectPath: string;
  }> {
    const privateObjectDir = this.getPrivateObjectDir();
    const objectId = randomUUID();

    const quarantineGCSPath = `${privateObjectDir}/pending/${objectId}`;
    const publishedGCSPath = `${privateObjectDir}/uploads/${objectId}`;

    const { bucketName, objectName } = parseObjectPath(quarantineGCSPath);
    const uploadURL = await signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });

    const publishedObjectPath = `/objects/uploads/${objectId}`;
    return { uploadURL, quarantineGCSPath, publishedGCSPath, publishedObjectPath };
  }

  /**
   * Retrieve a GCS File object directly from a raw GCS path string.
   * Used to access quarantine objects (which are not accessible via /objects/*).
   */
  getFileFromGCSPath(gcsPath: string): File {
    const { bucketName, objectName } = parseObjectPath(gcsPath);
    return objectStorageClient.bucket(bucketName).file(objectName);
  }

  /**
   * Copy a file from the quarantine path to the published path, then delete
   * the quarantine copy. Call this only after successful verification.
   */
  async promoteFromQuarantine(quarantineGCSPath: string, publishedGCSPath: string): Promise<void> {
    const { bucketName: fromBucket, objectName: fromObject } = parseObjectPath(quarantineGCSPath);
    const { bucketName: toBucket, objectName: toObject } = parseObjectPath(publishedGCSPath);

    const sourceFile = objectStorageClient.bucket(fromBucket).file(fromObject);
    const destFile = objectStorageClient.bucket(toBucket).file(toObject);

    await sourceFile.copy(destFile);
    await sourceFile.delete();
  }

  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");

    // Block access to quarantine-area objects (path segment "pending").
    // Files in the quarantine area must be promoted via /verify before they
    // are accessible. This prevents bypassing the verification step.
    if (entityId.startsWith("pending/") || entityId === "pending") {
      throw new ObjectNotFoundError();
    }

    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }

    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;

    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }

    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }

    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(30_000),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`
    );
  }

  const { signed_url: signedURL } = await response.json() as { signed_url: string };
  return signedURL;
}
