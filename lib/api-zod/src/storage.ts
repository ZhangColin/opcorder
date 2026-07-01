import * as zod from "zod";

export const SubmitOrderPaymentBody = zod.object({
  method: zod.string(),
  receiptUrl: zod.string().nullable().optional(),
  paymentNote: zod.string().nullable().optional(),
});

export const CloseOrderBody = zod.object({
  reason: zod.string().nullable().optional(),
});

export const CreateQuoteDimensionBody = zod.object({
  category: zod.string().nullable().optional(),
  layer: zod.string(),
  code: zod.string(),
  label: zod.string(),
  description: zod.string().nullable().optional(),
  sortOrder: zod.number().int().optional(),
  catCategoryId: zod.number().int().nullable().optional(),
});

export const UpdateQuoteDimensionBody = zod.object({
  label: zod.string().optional(),
  description: zod.string().nullable().optional(),
  sortOrder: zod.number().int().optional(),
  isActive: zod.boolean().optional(),
});

export const CreateQuoteTierBody = zod.object({
  dimensionId: zod.number().int(),
  tier: zod.string(),
  tierLabel: zod.string(),
  basePrice: zod.number().nullable().optional(),
  coefficient: zod.number().nullable().optional(),
  description: zod.string().nullable().optional(),
  sortOrder: zod.number().int().optional(),
});

export const UpdateQuoteTierBody = zod.object({
  tierLabel: zod.string().optional(),
  basePrice: zod.number().nullable().optional(),
  coefficient: zod.number().nullable().optional(),
  description: zod.string().nullable().optional(),
  sortOrder: zod.number().int().optional(),
});

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
