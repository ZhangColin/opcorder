import * as zod from "zod";

export const RequestUploadUrlBody = zod.object({
  name: zod.string().min(1).max(255),
  size: zod.number().int().positive(),
  contentType: zod.string().min(1).max(255),
});

export const RequestUploadUrlResponse = zod.object({
  uploadURL: zod.string(),
  objectPath: zod.string(),
  sessionToken: zod.string(),
  metadata: zod.object({
    name: zod.string(),
    size: zod.number(),
    contentType: zod.string(),
  }),
});

/**
 * The verify endpoint only accepts a server-issued session token.
 * All other metadata is retrieved from the server-side session store.
 */
export const VerifyUploadBody = zod.object({
  sessionToken: zod.string().min(1),
});

export const VerifyUploadResponse = zod.object({
  objectPath: zod.string(),
  verified: zod.boolean(),
});
