/**
 * Placement pipeline stages.
 * `technical` stays the DB key for Interview (existing rows).
 * Legacy `ai_screening` is normalized to `screening` in the UI.
 */
export const PLACEMENT_STAGES = [
  { key: "assessment", label: "Assessment" },
  { key: "screening", label: "Screening" },
  { key: "technical", label: "Interview" },
  { key: "panel", label: "Panel round" },
  { key: "hr", label: "HR Round" },
  { key: "offer", label: "Offer letter" },
  { key: "rejected", label: "Rejected" },
] as const;

export type PlacementStageKey = (typeof PLACEMENT_STAGES)[number]["key"];

export function placementStageLabel(key: string): string {
  if (key === "ai_screening") return "Screening";
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
