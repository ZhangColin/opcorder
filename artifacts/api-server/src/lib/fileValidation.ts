/**
 * Server-side file upload validation — two layers of defence.
 *
 * Layer 1 – Pre-upload gate (validateFileUpload):
 *   Called before issuing a presigned URL. Validates client-declared metadata
 *   (MIME type, file extension, size) against a whitelist.
 *
 * Layer 2 – Post-upload verification (verifyUploadedFile):
 *   Called after the client PUT the file to the quarantine presigned URL.
 *   Uses TRUSTED, server-stored metadata from the upload session to verify
 *   actual file size and extension consistency.
 *   Magic-byte / content-type spoofing checks are intentionally omitted:
 *   they caused false positives on legitimate files (WPS/LibreOffice OOXML,
 *   text/html) and provide marginal value compared to the whitelist gate.
 *   AV scanning (task #29) is the right tool for deeper content inspection.
 */

import { File } from "@google-cloud/storage";

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
export const VIDEO_MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB (for screen videos)

const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm"]);

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

  "video/mp4":  ["mp4"],
  "video/webm": ["webm"],

  "application/pdf": ["pdf"],

  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx"],

  "text/plain": ["txt"],
  "text/markdown": ["md"],
  "text/html": ["html", "htm"],
  "application/zip": ["zip"],
  "application/x-zip-compressed": ["zip"],
  "application/x-zip": ["zip"],
  "application/x-rar-compressed": ["rar"],
  "application/vnd.rar": ["rar"],
  "application/x-7z-compressed": ["7z"],
};

const ALLOWED_EXTENSION_SET = new Set(Object.values(ALLOWED_MIME_TYPES).flat());

export interface FileValidationError {
  code:
    | "SIZE_EXCEEDED"
    | "MIME_NOT_ALLOWED"
    | "EXTENSION_NOT_ALLOWED"
    | "EXTENSION_MIME_MISMATCH"
    | "ACTUAL_SIZE_EXCEEDED";
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

  const maxBytes = VIDEO_MIME_TYPES.has(contentType) ? VIDEO_MAX_FILE_SIZE_BYTES : MAX_FILE_SIZE_BYTES;
  if (size > maxBytes) {
    return {
      code: "SIZE_EXCEEDED",
      message: `文件大小超出限制，最大允许 ${maxBytes / (1024 * 1024)} MB`,
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
 * Layer 2 – Post-upload verification.
 *
 * Checks actual file size from GCS object metadata and re-validates the
 * extension against the trusted server-stored MIME type.
 * No magic-byte or content inspection is performed.
 *
 * IMPORTANT: Both parameters MUST come from the server-side upload session —
 * never from client-supplied request fields.
 *
 * The caller is responsible for:
 *   - Deleting the quarantine object on failure
 *   - Promoting the quarantine object to the published path on success
 */
export async function verifyUploadedFile(
  quarantineFile: File,
  expectedContentType: string,
  expectedName: string
): Promise<FileValidationError | null> {
  // 1. Actual file size from GCS object metadata (not client-reported)
  const [metadata] = await quarantineFile.getMetadata();
  const actualSize = Number(metadata.size ?? 0);

  const maxBytes = VIDEO_MIME_TYPES.has(expectedContentType) ? VIDEO_MAX_FILE_SIZE_BYTES : MAX_FILE_SIZE_BYTES;
  if (actualSize > maxBytes) {
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

  return null;
}
