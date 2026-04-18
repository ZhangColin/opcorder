/**
 * Server-side file upload validation — two layers of defence.
 *
 * Layer 1 – Pre-upload gate (validateFileUpload):
 *   Called before issuing a presigned URL. Validates client-declared metadata
 *   (MIME type, file extension, size) against a whitelist. Stops clearly
 *   invalid requests early but cannot verify actual file bytes.
 *
 * Layer 2 – Post-upload verification (verifyUploadedFile):
 *   Called after the client PUT the file to the quarantine presigned URL.
 *   Uses TRUSTED, server-stored metadata from the upload session — NOT
 *   client-supplied values — to validate actual bytes, size, MIME type, and
 *   extension. Returns null on success; the caller is responsible for
 *   promoting (on success) or deleting (on failure) the quarantine object.
 *
 * ClamAV / macro scanning: requires an external AV service and is not
 * implemented here. The magic-byte check prevents the most common attack
 * (content-type spoofing and extension mismatch). Follow-up task #29 tracks
 * adding AV scanning.
 */

import { fileTypeFromBuffer } from "file-type";
import { File } from "@google-cloud/storage";

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

/** Bytes to sample for magic-number detection (file-type needs ≤ 4100). */
const MAGIC_BYTES_SAMPLE = 4100;

/**
 * Allowed MIME types mapped to their permitted lowercase extensions.
 *
 * Legacy binary Office formats (doc/xls/ppt) are intentionally excluded:
 * they are the primary carriers of macro-based malware and cannot be safely
 * screened without a dedicated AV service. docm/xlsm/pptm (macro-enabled
 * OOXML) are also excluded for the same reason.
 */
export const ALLOWED_MIME_TYPES: Record<string, readonly string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/gif": ["gif"],
  "image/webp": ["webp"],

  "application/pdf": ["pdf"],

  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx"],

  "text/plain": ["txt"],
  "application/zip": ["zip"],
};

const ALLOWED_EXTENSION_SET = new Set(Object.values(ALLOWED_MIME_TYPES).flat());

const OOXML_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export interface FileValidationError {
  code:
    | "SIZE_EXCEEDED"
    | "MIME_NOT_ALLOWED"
    | "EXTENSION_NOT_ALLOWED"
    | "EXTENSION_MIME_MISMATCH"
    | "MAGIC_MIME_MISMATCH"
    | "ACTUAL_SIZE_EXCEEDED"
    | "ACTUAL_MIME_UNDETECTABLE"
    | "OOXML_STRUCTURE_INVALID";
  message: string;
}

export interface FileValidationInput {
  name: string;
  size: number;
  contentType: string;
}

/** Extract lowercase extension without the dot. Returns "" if none. */
export function extractExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex === filename.length - 1) return "";
  return filename.slice(dotIndex + 1).toLowerCase();
}

/**
 * Layer 1 – Pre-upload gate.
 * Validates client-declared metadata before a presigned URL is issued.
 * Returns null on success, or a FileValidationError on failure.
 */
export function validateFileUpload(input: FileValidationInput): FileValidationError | null {
  const { name, size, contentType } = input;

  if (size > MAX_FILE_SIZE_BYTES) {
    return {
      code: "SIZE_EXCEEDED",
      message: `文件大小超出限制，最大允许 ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`,
    };
  }

  const allowedExtensions = ALLOWED_MIME_TYPES[contentType];
  if (!allowedExtensions) {
    return {
      code: "MIME_NOT_ALLOWED",
      message: `不支持的文件类型：${contentType}`,
    };
  }

  const ext = extractExtension(name);
  if (!ALLOWED_EXTENSION_SET.has(ext)) {
    return {
      code: "EXTENSION_NOT_ALLOWED",
      message: `不支持的文件扩展名：.${ext || "(无)"}`,
    };
  }

  if (!allowedExtensions.includes(ext)) {
    return {
      code: "EXTENSION_MIME_MISMATCH",
      message: `文件扩展名 .${ext} 与声明的文件类型 ${contentType} 不匹配`,
    };
  }

  return null;
}

/**
 * Layer 2 – Post-upload content verification.
 *
 * Inspects actual bytes from the GCS quarantine object using magic-number
 * detection (file-type) and validates real file size from object metadata.
 *
 * IMPORTANT: Both parameters MUST come from the server-side upload session —
 * never from client-supplied request fields. This prevents metadata-swapping.
 *
 * The caller is responsible for:
 *   - Deleting the quarantine object on failure
 *   - Promoting the quarantine object to the published path on success
 *
 * @param quarantineFile - GCS File in the quarantine area to inspect
 * @param expectedContentType - MIME type stored in the server-side session
 * @param expectedName - filename stored in the server-side session
 * @returns null on success; FileValidationError describing the failure otherwise
 */
export async function verifyUploadedFile(
  quarantineFile: File,
  expectedContentType: string,
  expectedName: string
): Promise<FileValidationError | null> {
  // 1. Actual file size from GCS object metadata (not client-reported)
  const [metadata] = await quarantineFile.getMetadata();
  const actualSize = Number(metadata.size ?? 0);

  if (actualSize > MAX_FILE_SIZE_BYTES) {
    return {
      code: "ACTUAL_SIZE_EXCEEDED",
      message: `文件实际大小（${(actualSize / (1024 * 1024)).toFixed(1)} MB）超出服务端限制`,
    };
  }

  // 2. Re-validate extension from the TRUSTED server-stored filename
  const ext = extractExtension(expectedName);
  const allowedExtensions = ALLOWED_MIME_TYPES[expectedContentType];
  if (!allowedExtensions || !allowedExtensions.includes(ext)) {
    return {
      code: "EXTENSION_MIME_MISMATCH",
      message: `服务端校验：扩展名 .${ext} 与预期类型 ${expectedContentType} 不匹配`,
    };
  }

  // 3. Download magic bytes for MIME detection
  const sampleSize = Math.min(actualSize || MAGIC_BYTES_SAMPLE, MAGIC_BYTES_SAMPLE);
  const buffer = await downloadPartialBuffer(quarantineFile, sampleSize);
  const detected = await fileTypeFromBuffer(buffer);

  // 4. text/plain has no magic number — allow through
  if (!detected) {
    if (expectedContentType === "text/plain") {
      return null;
    }
    return {
      code: "ACTUAL_MIME_UNDETECTABLE",
      message: "无法检测文件实际类型，上传被拒绝",
    };
  }

  const detectedMime = detected.mime;

  // 5. OOXML formats (.docx/.xlsx/.pptx) are ZIP containers.
  //    file-type reports them as application/zip. Accept only if the ZIP
  //    actually contains the OOXML structure marker [Content_Types].xml.
  if (OOXML_MIME_TYPES.has(expectedContentType) && detectedMime === "application/zip") {
    if (!isOoxmlStructurePresent(buffer)) {
      return {
        code: "OOXML_STRUCTURE_INVALID",
        message: "文件声明为 Office 文档，但未找到有效的 OOXML 结构标记",
      };
    }
    return null;
  }

  // 6. For all other types, detected MIME must be allowed and match expected
  if (!ALLOWED_MIME_TYPES[detectedMime]) {
    return {
      code: "MAGIC_MIME_MISMATCH",
      message: `文件实际类型（${detectedMime}）不在允许范围内`,
    };
  }

  if (detectedMime !== expectedContentType) {
    return {
      code: "MAGIC_MIME_MISMATCH",
      message: `文件实际类型（${detectedMime}）与预期类型（${expectedContentType}）不匹配`,
    };
  }

  return null;
}

/**
 * Check whether a buffer (from a ZIP file) contains the OOXML structure
 * marker "[Content_Types].xml". All valid OOXML containers include this as
 * their first local-file entry, so it appears within the first ~256 bytes.
 */
function isOoxmlStructurePresent(buffer: Buffer): boolean {
  const marker = Buffer.from("[Content_Types].xml");
  for (let i = 0; i <= Math.min(buffer.length - marker.length, 512); i++) {
    if (buffer.subarray(i, i + marker.length).equals(marker)) {
      return true;
    }
  }
  return false;
}

/** Download the first `byteCount` bytes of an object from GCS. */
async function downloadPartialBuffer(file: File, byteCount: number): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = file.createReadStream({ start: 0, end: byteCount - 1 });
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}
