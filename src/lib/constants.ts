/**
 * Placement pipeline — DB stage keys must stay unchanged for v1.
 * Only display labels / UI order may change.
 */
export const PLACEMENT_STAGES = [
  { key: "assessment", label: "Active job search / Assessment" },
  { key: "ai_screening", label: "AI Screening" },
  { key: "screening", label: "Recruiter screening" },
  { key: "technical", label: "Interview scheduled / Technical" },
  { key: "panel", label: "Final round / Panel" },
  { key: "offer", label: "Offer received" },
] as const;

export type PlacementStageKey = (typeof PLACEMENT_STAGES)[number]["key"];

export function placementStageLabel(key: string): string {
  return PLACEMENT_STAGES.find((s) => s.key === key)?.label ?? key;
}

/** Student payment_status enum (DB text + check constraint planned). */
export const PAYMENT_STATUSES = ["unpaid", "partial", "paid", "waived", "n/a"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const DEFAULT_PAYMENT_STATUS: PaymentStatus = "unpaid";

export const PAYMENT_METHODS = [
  "Bank transfer",
  "Zelle",
  "Cash",
  "Card",
  "Check",
  "PayPal",
  "Venmo",
  "Other",
] as const;

/** Default daily application target when employee.daily_target is null (pre-migration). */
export const DEFAULT_DAILY_TARGET = 40;

export const ROLE_HOME = {
  admin: "/admin",
  employee: "/app",
  student: "/me",
} as const;

export type AppRole = keyof typeof ROLE_HOME;
