export const APPLICATION_SOURCES = [
  { value: "career_sites", label: "Career sites" },
  { value: "jobright", label: "Jobright.ai" },
  { value: "dice", label: "Dice" },
  { value: "linkedin", label: "LinkedIn" },
] as const;

export type ApplicationSource = (typeof APPLICATION_SOURCES)[number]["value"];

export const DEFAULT_APPLICATION_SOURCE: ApplicationSource = "career_sites";

export function isApplicationSource(value: string | null | undefined): value is ApplicationSource {
  return APPLICATION_SOURCES.some((s) => s.value === value);
}

export function applicationSourceLabel(value: string | null | undefined): string {
  const found = APPLICATION_SOURCES.find((s) => s.value === value);
  return found?.label ?? "Career sites";
}

/** Best-effort detect board from a job URL; falls back to current section. */
export function detectApplicationSource(
  url: string,
  fallback: ApplicationSource = DEFAULT_APPLICATION_SOURCE,
): ApplicationSource {
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    if (host.includes("linkedin.")) return "linkedin";
    if (host.includes("dice.")) return "dice";
    if (host.includes("jobright.")) return "jobright";
    return fallback;
  } catch {
    return fallback;
  }
}
