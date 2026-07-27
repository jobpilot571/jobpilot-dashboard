export type TrialStatus = "new" | "assigned" | "active" | "expired" | "converted";

export const TRIAL_STATUSES: { value: TrialStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "assigned", label: "Assigned" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "converted", label: "Converted" },
];

/** Soft follow-up labels stored in notes as a prefix line for v1 (no new column). */
export const FOLLOW_UP_STATUSES = [
  "none",
  "needed",
  "contacted",
  "scheduled",
  "no_response",
  "closed",
] as const;

export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export const FOLLOW_UP_PREFIX = "follow_up:";

export function parseFollowUp(notes: string | null | undefined): {
  followUp: FollowUpStatus;
  noteBody: string;
} {
  if (!notes) return { followUp: "none", noteBody: "" };
  const lines = notes.split("\n");
  const first = lines[0]?.trim() ?? "";
  if (first.toLowerCase().startsWith(FOLLOW_UP_PREFIX)) {
    const value = first.slice(FOLLOW_UP_PREFIX.length).trim().toLowerCase() as FollowUpStatus;
    const followUp = FOLLOW_UP_STATUSES.includes(value) ? value : "none";
    return { followUp, noteBody: lines.slice(1).join("\n").trim() };
  }
  return { followUp: "none", noteBody: notes };
}

export function composeNotes(followUp: FollowUpStatus, noteBody: string): string | null {
  const body = noteBody.trim();
  if (followUp === "none" && !body) return null;
  if (followUp === "none") return body;
  return body ? `${FOLLOW_UP_PREFIX}${followUp}\n${body}` : `${FOLLOW_UP_PREFIX}${followUp}`;
}

export function daysUntil(dateIso: string, todayIso: string): number {
  const a = new Date(`${todayIso}T12:00:00`);
  const b = new Date(`${dateIso.slice(0, 10)}T12:00:00`);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export const TRIAL_PAGE_SIZE = 10;
