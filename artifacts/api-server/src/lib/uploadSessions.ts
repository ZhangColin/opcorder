/**
 * In-memory upload session store.
 *
 * When the client requests a presigned upload URL, the server stores:
 *   - quarantineGCSPath: the GCS path the client is allowed to PUT to (quarantine area)
 *   - publishedGCSPath: the GCS path the file is moved to after successful verification
 *   - publishedObjectPath: the stable /objects/... path returned to callers
 *   - expectedContentType + expectedName: trusted metadata for verification
 *
 * The session is keyed by an opaque, unpredictable 64-hex-char token returned
 * to the client. The token must be presented to /verify. It is consumed (one-time
 * use) on the first valid call, preventing replay.
 *
 * TTL matches the presigned URL lifetime (900 seconds / 15 minutes). Expired
 * sessions are purged lazily on each read/write.
 */

import { randomBytes } from "crypto";

export interface UploadSession {
  quarantineGCSPath: string;
  publishedGCSPath: string;
  publishedObjectPath: string;
  expectedContentType: string;
  expectedName: string;
  createdAt: number;
}

const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes
const sessions = new Map<string, UploadSession>();

/** Create a new upload session and return an opaque 64-hex-char token. */
export function createUploadSession(
  session: Omit<UploadSession, "createdAt">
): string {
  purgeExpiredSessions();
  const token = randomBytes(32).toString("hex");
  sessions.set(token, { ...session, createdAt: Date.now() });
  return token;
}

/**
 * Consume an upload session by token (one-time use; invalidated immediately).
 * Returns null if the token is unknown or has expired.
 */
export function consumeUploadSession(token: string): UploadSession | null {
  purgeExpiredSessions();
  const session = sessions.get(token);
  if (!session) return null;
  sessions.delete(token); // invalidate regardless of outcome
  if (Date.now() - session.createdAt > SESSION_TTL_MS) return null;
  return session;
}

function purgeExpiredSessions(): void {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(token);
    }
  }
}
