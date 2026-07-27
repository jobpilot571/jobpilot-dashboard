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
  offer: ["Received", "Accepted", "Rejected", "Negotiation"],
};

export const STAGE_META = PLACEMENT_STAGES.map((s) => ({
  ...s,
  short:
    s.key === "assessment"
      ? "Assess"
      : s.key === "screening"
        ? "Screen"
        : s.key === "technical"
          ? "Tech"
          : s.key === "panel"
            ? "Panel"
            : "Offer",
}));

/** Stages shown after selecting Forwarded on a job application. */
export const FORWARD_STAGES = [
  { key: "assessment" as const, label: "Assessment" },
  { key: "screening" as const, label: "Screening" },
  { key: "technical" as const, label: "Technical" },
  { key: "panel" as const, label: "Panel" },
];

export type ForwardStageKey = (typeof FORWARD_STAGES)[number]["key"];

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

/** Later interview rounds a user can add from the current stage (keeps current row). */
export function nextForwardRounds(current: ForwardStageKey): ForwardStageKey[] {
  const order: ForwardStageKey[] = ["assessment", "screening", "technical", "panel"];
  const idx = order.indexOf(current);
  if (idx < 0) return ["screening", "technical", "panel"];
  return order.slice(idx + 1);
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
