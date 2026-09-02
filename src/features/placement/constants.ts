import {
  PLACEMENT_STAGES,
  placementStageLabel,
  type PlacementStageKey,
} from "@/lib/constants";

export type PipelineStage = PlacementStageKey;

export const STAGE_STATUS_OPTIONS: Record<PipelineStage, string[]> = {
  assessment: ["Pending", "Passed", "Failed", "No Response"],
  screening: ["Scheduled", "Completed", "Cancelled", "No Show", "Waiting Feedback"],
  technical: ["Scheduled", "Completed", "Passed", "Failed", "Waiting Feedback"],
  panel: ["Scheduled", "Completed", "Passed", "Failed", "Waiting Feedback"],
  hr: ["Scheduled", "Completed", "Passed", "Failed", "Waiting Feedback"],
  offer: ["Received", "Accepted", "Rejected", "Negotiation"],
  rejected: ["Rejected", "No Response", "Withdrawn"],
};

export const STAGE_META = PLACEMENT_STAGES.map((s) => ({
  ...s,
  short:
    s.key === "assessment"
      ? "Assess"
      : s.key === "screening"
        ? "Screen"
        : s.key === "technical"
          ? "Interview"
          : s.key === "panel"
            ? "Panel"
            : s.key === "hr"
              ? "HR"
              : s.key === "offer"
                ? "Offer"
                : "Rejected",
}));

/** Stages shown on the board and in Forwarded → status. */
export const FORWARD_STAGES = PLACEMENT_STAGES.map((s) => ({
  key: s.key,
  label: s.label,
}));

export type ForwardStageKey = PlacementStageKey;

export const STAGE_ORDER: PlacementStageKey[] = PLACEMENT_STAGES.map((s) => s.key);

export const STAGE_TONE: Record<PlacementStageKey, string> = {
  assessment: "border-sky-200 bg-sky-50 text-sky-800",
  screening: "border-indigo-200 bg-indigo-50 text-indigo-900",
  technical: "border-amber-200 bg-amber-50 text-amber-900",
  panel: "border-emerald-200 bg-emerald-50 text-emerald-800",
  hr: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900",
  offer: "border-teal-200 bg-teal-50 text-teal-900",
  rejected: "border-rose-200 bg-rose-50 text-rose-800",
};

export const STAGE_COLUMN_TONE: Record<PlacementStageKey, string> = {
  assessment: "bg-sky-50/70 border-sky-200/80",
  screening: "bg-indigo-50/70 border-indigo-200/80",
  technical: "bg-amber-50/70 border-amber-200/80",
  panel: "bg-emerald-50/70 border-emerald-200/80",
  hr: "bg-fuchsia-50/70 border-fuchsia-200/80",
  offer: "bg-teal-50/70 border-teal-200/80",
  rejected: "bg-rose-50/70 border-rose-200/80",
};

const JD_MARKER = "---jd---";

export function appForwardNote(appId: string): string {
  return `from_app:${appId}`;
}

export function parseAppIdFromForwardNote(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const m = notes.match(/from_app:([0-9a-f-]{36})/i);
  return m?.[1] ?? null;
}

export function parseJdFromNotes(notes: string | null | undefined): string {
  if (!notes) return "";
  const idx = notes.indexOf(JD_MARKER);
  if (idx === -1) return "";
  return notes.slice(idx + JD_MARKER.length).replace(/^\s*\n?/, "").trimEnd();
}

export function buildForwardNotes(appId: string | null | undefined, jd: string): string {
  const parts: string[] = [];
  if (appId) parts.push(`from_app:${appId}`);
  const trimmed = jd.trim();
  if (trimmed) parts.push(`${JD_MARKER}\n${trimmed}`);
  return parts.join("\n\n");
}

export function normalizeStage(stage: string | null | undefined): PlacementStageKey {
  if (stage === "ai_screening") return "screening";
  if (STAGE_ORDER.includes(stage as PlacementStageKey)) return stage as PlacementStageKey;
  return "assessment";
}

export function stageRank(stage: string | null | undefined): number {
  return STAGE_ORDER.indexOf(normalizeStage(stage));
}

/** One live card per application (or per unlinked row). Latest update wins so a status change moves the card. */
export function liveCardsFromEvents<
  T extends { id: string; stage: string; notes: string | null; updated_at?: string; created_at?: string },
>(events: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const e of events) {
    const appId = parseAppIdFromForwardNote(e.notes);
    const key = appId ?? `row:${e.id}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, e);
      continue;
    }
    const existingTs = existing.updated_at || existing.created_at || "";
    const nextTs = e.updated_at || e.created_at || "";
    if (nextTs >= existingTs) byKey.set(key, e);
  }
  return Array.from(byKey.values());
}

/** Later rounds a user can jump to from the current stage. */
export function nextForwardRounds(current: ForwardStageKey): ForwardStageKey[] {
  const idx = STAGE_ORDER.indexOf(normalizeStage(current));
  if (idx < 0) return STAGE_ORDER.slice(1);
  return STAGE_ORDER.slice(idx + 1);
}

export function companyDomainFromLink(link: string | null | undefined): string | null {
  if (!link) return null;
  try {
    const host = new URL(link.startsWith("http") ? link : `https://${link}`).hostname;
    return host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function companyLogoUrl(company: string | null | undefined, link?: string | null): string {
  const domain = companyDomainFromLink(link);
  if (domain) return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
  const slug = (company || "company").toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(slug || "example")}.com&sz=64`;
}

export { placementStageLabel };

export function daysAgo(iso: string | null | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  return (Date.now() - then) / (1000 * 60 * 60 * 24);
}

export function healthFromActivity(input: {
  interviewOffer: string | null;
  earlyStage: string | null;
  any: string | null;
}): { color: string; label: string } {
  if (daysAgo(input.interviewOffer) <= 14) return { color: "bg-emerald-500", label: "Hot" };
  if (daysAgo(input.earlyStage) <= 14) return { color: "bg-sky-500", label: "Active" };
  if (daysAgo(input.any) > 21) return { color: "bg-destructive", label: "Cold" };
  return { color: "bg-amber-500", label: "Warm" };
}
