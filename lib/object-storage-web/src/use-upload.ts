import { useState, useCallback, useRef } from "react";
import type { UppyFile } from "@uppy/core";

interface UploadMetadata {
  name: string;
  size: number;
  contentType: string;
}

interface UploadResponse {
  uploadURL: string;
  objectPath: string;
  sessionToken: string;
  metadata: UploadMetadata;
}

interface UseUploadOptions {
  /** Base path where object storage routes are mounted (default: "/api/storage") */
  basePath?: string;
  onSuccess?: (response: UploadResponse) => void;
  onError?: (error: Error) => void;
}

/**
 * React hook for handling file uploads with presigned URLs.
 *
 * Implements a secure three-step upload flow:
 *  1. Request a presigned URL + session token from the backend
 *     (sends JSON metadata — NOT the file bytes)
 *  2. Upload the file directly to the quarantine presigned URL
 *  3. Present the session token to the backend for post-upload verification
 *     (server performs magic-byte MIME check + size check on actual bytes;
 *      on success, promotes the file from quarantine to the published path)
 *
 * Files uploaded to the quarantine path are inaccessible via /storage/objects/*
 * until verification succeeds — skipping step 3 leaves the file permanently
 * inaccessible, not exploitable.
 *
 * For Uppy-based uploads (via ObjectUploader), use `getUploadParameters` together
 * with `consumeSessionToken` to ensure verification is called after upload.
 *
 * @example — direct upload
 * ```tsx
 * const { uploadFile, isUploading, error } = useUpload({
 *   onSuccess: (response) => console.log("Uploaded:", response.objectPath),
 * });
 * await uploadFile(file);
 * ```
 *
 * @example — Uppy integration
 * ```tsx
 * const { getUploadParameters, consumeSessionToken } = useUpload();
 * <ObjectUploader
 *   onGetUploadParameters={getUploadParameters}
 *   consumeSessionToken={consumeSessionToken}
 * />
 * ```
 */
export function useUpload(options: UseUploadOptions = {}) {
  const basePath = options.basePath ?? "/api/storage";
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  /**
   * Internal Map: presigned upload URL → session token.
   * Populated by getUploadParameters, consumed by consumeSessionToken.
   * This bridges the gap between the Uppy getUploadParameters call (where we
   * get the token) and the post-upload verify call (where we need it).
   */
  const pendingTokens = useRef(new Map<string, string>());

  const requestUploadUrl = useCallback(
    async (file: File): Promise<UploadResponse> => {
      const response = await fetch(`${basePath}/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get upload URL");
      }

      return response.json();
    },
    [basePath]
  );

  const uploadToPresignedUrl = useCallback(
    async (file: File, uploadURL: string): Promise<void> => {
      const response = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });

      if (!response.ok) {
        throw new Error("Failed to upload file to storage");
      }
    },
    []
  );

  /**
   * Step 3: present the server-issued session token for post-upload verification.
   * The server uses its own stored metadata — the client sends only the token.
   */
  const verifyUpload = useCallback(
    async (sessionToken: string): Promise<void> => {
      const response = await fetch(`${basePath}/uploads/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Upload verification failed");
      }
    },
    [basePath]
  );

  /** Direct upload: request URL → upload → verify. */
  const uploadFile = useCallback(
    async (file: File): Promise<UploadResponse | null> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      try {
        setProgress(10);
        const uploadResponse = await requestUploadUrl(file);

        setProgress(40);
        await uploadToPresignedUrl(file, uploadResponse.uploadURL);

        setProgress(70);
        await verifyUpload(uploadResponse.sessionToken);

        setProgress(100);
        options.onSuccess?.(uploadResponse);
        return uploadResponse;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Upload failed");
        setError(error);
        options.onError?.(error);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [requestUploadUrl, uploadToPresignedUrl, verifyUpload, options]
  );

  /**
   * For Uppy integration: returns the presigned URL + headers Uppy needs,
   * and internally stores the session token in a Map keyed by upload URL
   * so ObjectUploader can retrieve it via `consumeSessionToken`.
   */
  const getUploadParameters = useCallback(
    async (
      file: UppyFile<Record<string, unknown>, Record<string, unknown>>
    ): Promise<{
      method: "PUT";
      url: string;
      headers?: Record<string, string>;
    }> => {
      const response = await fetch(`${basePath}/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get upload URL");
      }

      const data: UploadResponse = await response.json();

      // Store the session token so ObjectUploader can retrieve it after the PUT
      pendingTokens.current.set(data.uploadURL, data.sessionToken);

      return {
        method: "PUT",
        url: data.uploadURL,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      };
    },
    [basePath]
  );

  /**
   * Retrieve and remove the session token stored for a given upload URL.
   * Call this from the Uppy `onComplete` handler (via ObjectUploader's
   * `consumeSessionToken` prop) to get the token needed for /verify.
   * Returns undefined if the upload URL is unknown or already consumed.
   */
  const consumeSessionToken = useCallback((uploadUrl: string): string | undefined => {
    const token = pendingTokens.current.get(uploadUrl);
    pendingTokens.current.delete(uploadUrl);
    return token;
  }, []);

  return {
    uploadFile,
    getUploadParameters,
    consumeSessionToken,
    isUploading,
    error,
    progress,
  };
}
