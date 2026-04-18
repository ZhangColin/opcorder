import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import type { UppyFile, UploadResult } from "@uppy/core";
import DashboardModal from "@uppy/react/dashboard-modal";
import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";
import AwsS3 from "@uppy/aws-s3";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  /**
   * Base path where object storage routes are mounted (default: "/api/storage").
   * Used to call /uploads/verify after each successful upload.
   */
  basePath?: string;
  /**
   * Function to get upload parameters for each file.
   * IMPORTANT: Use the version from useUpload() — it internally stores the
   * session token keyed by upload URL so that verification can be called
   * after the upload completes.
   */
  onGetUploadParameters: (
    file: UppyFile<Record<string, unknown>, Record<string, unknown>>
  ) => Promise<{
    method: "PUT";
    url: string;
    headers?: Record<string, string>;
  }>;
  /**
   * Optional function to retrieve and consume the session token for a given
   * upload URL. Provide the `consumeSessionToken` value from useUpload().
   * When provided, ObjectUploader automatically calls POST /uploads/verify
   * after each successful upload to promote files from quarantine to published.
   */
  consumeSessionToken?: (uploadUrl: string) => string | undefined;
  onComplete?: (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>
  ) => void;
  buttonClassName?: string;
  children: ReactNode;
}

/**
 * A file upload component that renders as a button and provides a modal interface
 * for file management.
 *
 * Features:
 * - Renders as a customizable button that opens a file upload modal
 * - Provides a modal interface for file selection, preview, and progress tracking
 * - When used with `consumeSessionToken` from useUpload(), automatically calls
 *   POST /uploads/verify after each successful upload so files are promoted from
 *   the quarantine path to the published path and become accessible.
 *
 * Usage:
 * ```tsx
 * const { getUploadParameters, consumeSessionToken } = useUpload();
 *
 * <ObjectUploader
 *   onGetUploadParameters={getUploadParameters}
 *   consumeSessionToken={consumeSessionToken}
 *   onComplete={(result) => { ... }}
 * >
 *   Upload File
 * </ObjectUploader>
 * ```
 *
 * @param props.maxNumberOfFiles - Maximum number of files (default: 1)
 * @param props.maxFileSize - Maximum file size in bytes (default: 10MB)
 * @param props.basePath - Base path for object storage API routes (default: "/api/storage")
 * @param props.onGetUploadParameters - From useUpload().getUploadParameters
 * @param props.consumeSessionToken - From useUpload().consumeSessionToken
 * @param props.onComplete - Called when uploads complete
 * @param props.buttonClassName - Optional CSS class name for the button
 * @param props.children - Content rendered inside the button
 */
export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760, // 10MB default
  basePath = "/api/storage",
  onGetUploadParameters,
  consumeSessionToken,
  onComplete,
  buttonClassName,
  children,
}: ObjectUploaderProps) {
  const onCompleteRef = useRef(onComplete);
  const onGetUploadParametersRef = useRef(onGetUploadParameters);
  const consumeSessionTokenRef = useRef(consumeSessionToken);
  const basePathRef = useRef(basePath);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { onGetUploadParametersRef.current = onGetUploadParameters; }, [onGetUploadParameters]);
  useEffect(() => { consumeSessionTokenRef.current = consumeSessionToken; }, [consumeSessionToken]);
  useEffect(() => { basePathRef.current = basePath; }, [basePath]);

  const [showModal, setShowModal] = useState(false);
  const [uppy] = useState(() =>
    new Uppy({
      restrictions: {
        maxNumberOfFiles,
        maxFileSize,
      },
      autoProceed: false,
    })
      .use(AwsS3, {
        shouldUseMultipart: false,
        getUploadParameters: (file) => onGetUploadParametersRef.current(file),
      })
      .on("complete", async (result) => {
        // After Uppy completes PUT uploads, call /verify for each successful file
        // using the session token stored by useUpload().getUploadParameters
        const consume = consumeSessionTokenRef.current;
        if (consume) {
          const verifyBase = basePathRef.current;
          for (const file of result.successful ?? []) {
            const uploadUrl = (file as unknown as { uploadURL?: string }).uploadURL;
            if (!uploadUrl) continue;
            const token = consume(uploadUrl);
            if (!token) continue;
            try {
              await fetch(`${verifyBase}/uploads/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionToken: token }),
              });
            } catch {
              // Verification failure is handled server-side (quarantine object retained
              // for logging, file stays inaccessible). Errors here are non-fatal for UI.
            }
          }
        }
        onCompleteRef.current?.(result);
      })
  );

  return (
    <div>
      <button onClick={() => setShowModal(true)} className={buttonClassName}>
        {children}
      </button>

      <DashboardModal
        uppy={uppy}
        open={showModal}
        onRequestClose={() => setShowModal(false)}
        proudlyDisplayPoweredByUppy={false}
      />
    </div>
  );
}
