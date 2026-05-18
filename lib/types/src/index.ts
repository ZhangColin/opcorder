/**
 * Shared TypeScript types for the JieDanBa platform.
 * These types are kept in sync with the database schema and API contract.
 */

/** One dimension + tier combination in the quote card pricing config. */
export interface QuoteCardConfigItem {
  id: number;
  dimensionCode: string;
  dimensionLabel: string;
  tier: "S" | "M" | "L" | "XL";
  tierLabel: string;
  basePrice: number;
  coefficient?: number | null;
  description?: string | null;
  updatedAt: string;
}

/**
 * Structured quote card data submitted by an OPC.
 * Maps dimension code (e.g. "D1") → selected tier code (e.g. "M").
 */
export type QuoteCardData = Record<string, string>;

/** Summary of a demand for list views. */
export interface DemandSummary {
  id: number;
  demandNo: string;
  title: string;
  type: string;
  typeLabel?: string;
  description: string;
  skillTags: string[];
  opcLevel: string;
  /** @deprecated Use budgetMin / budgetMax */
  budget: number;
  budgetMin: number;
  budgetMax: number;
  deadline: string;
  mode: "open" | "directed";
  status: DemandStatus;
  isUrgent: boolean;
  bidDeadline?: string | null;
  publisherId: number;
  publisherName?: string;
  bidCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type DemandStatus =
  | "draft"
  | "pending_review"
  | "pending_payment"
  | "published"
  | "matched"
  | "in_progress"
  | "pending_acceptance"
  | "completed"
  | "closed"
  | "refund_pending"
  | "refunding"
  | "refunded";

/** Bid submitted by an OPC against a demand. */
export interface BidItem {
  id: number;
  demandId: number;
  opcId: number;
  proposal: string;
  estimatedDays: number;
  portfolioLinks?: string[];
  quoteCardData: QuoteCardData;
  quotedPrice?: number | null;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
  createdAt: string;
}

export type OrderStatus =
  | "pending_payment"
  | "in_progress"
  | "pending_acceptance"
  | "completed"
  | "closed"
  | "disputed";

/** Order created when a bid is accepted. */
export interface OrderItem {
  id: number;
  orderNo: string;
  demandId: number;
  opcId: number;
  publisherId: number;
  amount: number;
  opcShare: number;
  publisherShare: number;
  platformFee: number;
  status: OrderStatus;
  paymentMethod?: string | null;
  paymentReceiptUrl?: string | null;
  paymentOrderNo?: string | null;
  paidAt?: string | null;
  deadline?: string | null;
  createdAt: string;
  updatedAt: string;
}
