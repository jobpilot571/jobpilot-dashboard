import { supabase } from "@/integrations/supabase/client";
import { autofillFromJobLink, type JobLinkAutofill } from "@/lib/jobLinkAutofill";

export type AiJobLinkResult = {
  company: string;
  jobRole: string;
  source: "ai" | "page" | "url";
};

const BAD_TITLES = /^(home|jobs|careers|apply|login|sign in|opportunity apply|job board|privacy|cookie)/i;

function looksLikeJobTitle(line: string): boolean {
  const t = line.trim();
  if (t.length < 4 || t.length > 90) return false;
  if (BAD_TITLES.test(t)) return false;
  if (/^https?:/i.test(t)) return false;
  if (/^[0-9a-f-]{36}$/i.test(t)) return false;
  // Prefer titles with a few words, analyst/engineer/manager patterns, etc.
  const words = t.split(/\s+/);
  if (words.length < 2) return false;
  if (!/[a-z]/i.test(t)) return false;
  return true;
}

/** Pull company + role from fetched page text (Jina markdown / HTML stripped). */
export function extractFromPageText(
  text: string,
  hints?: { company?: string },
): { company: string; jobRole: string } {
  let company = hints?.company?.trim() || "";
  let jobRole = "";

  const labeledRole = text.match(
    /(?:job\s*title|position\s*title|position|role|job\s*name)\s*[:\-–]\s*([^\n\r|]{4,90})/i,
  );
  if (labeledRole?.[1] && looksLikeJobTitle(labeledRole[1])) {
    jobRole = labeledRole[1].trim().replace(/\s+/g, " ");
  }

  if (!jobRole) {
    const headings = [...text.matchAll(/^#{1,3}\s+(.+)$/gm)].map((m) => m[1]!.trim());
    for (const h of headings) {
      if (looksLikeJobTitle(h)) {
        jobRole = h.replace(/\s+/g, " ");
        break;
      }
    }
  }

  if (!jobRole) {
    const titleMeta = text.match(/Title:\s*(.+)/i);
    if (titleMeta?.[1] && looksLikeJobTitle(titleMeta[1])) {
      jobRole = titleMeta[1].trim();
    }
  }

  if (!company) {
    const labeledCo = text.match(/(?:company|employer|organization)\s*[:\-–]\s*([^\n\r|]{2,60})/i);
    if (labeledCo?.[1]) company = labeledCo[1].trim().replace(/\s+/g, " ");
  }

  // Prefer short brand if page says "PSI" and hint was PSI
  if (hints?.company && company && company.toLowerCase().includes(hints.company.toLowerCase())) {
    company = hints.company;
  }

  return { company, jobRole };
}

async function fetchPageMarkdown(url: string): Promise<string> {
  const readerUrl = `https://r.jina.ai/${url}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(readerUrl, {
      signal: ctrl.signal,
      headers: { Accept: "text/plain" },
    });
    if (!res.ok) return "";
    const text = await res.text();
    return text.slice(0, 20000);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Enrich company + role:
 * 1) URL heuristics
 * 2) Page read (Jina) for titles not present in the URL (UKG, etc.)
 * 3) Optional Supabase `parse-job-link` LLM function
 */
export async function enrichJobLinkWithAi(url: string): Promise<AiJobLinkResult | null> {
  const local: JobLinkAutofill = autofillFromJobLink(url);
  let company = local.company;
  let jobRole = local.jobRole;
  let source: AiJobLinkResult["source"] = "url";

  if (local.needsPageFetch || !jobRole || local.confidence === "low") {
    const pageText = await fetchPageMarkdown(url);
    if (pageText) {
      const extracted = extractFromPageText(pageText, { company });
      if (extracted.jobRole) {
        jobRole = extracted.jobRole;
        source = "page";
      }
      if (extracted.company) {
        // Prefer short URL-derived brand (PSI) over long legal names unless URL had nothing
        if (!company || company.length > extracted.company.length) {
          company = company || extracted.company;
        }
        if (!company) company = extracted.company;
      }
    }
  }

  try {
    const { data, error } = await supabase.functions.invoke("parse-job-link", {
      body: { url },
    });
    if (!error && data && typeof data === "object") {
      const payload = data as {
        success?: boolean;
        company?: string;
        job_role?: string;
        jobRole?: string;
        title?: string;
      };
      const aiCompany = (payload.company || "").trim();
      const aiRole = (payload.job_role || payload.jobRole || payload.title || "").trim();
      if (aiRole && looksLikeJobTitle(aiRole)) {
        jobRole = aiRole;
        source = "ai";
      }
      if (aiCompany) {
        // Keep PSI-style short codes from URL when AI returns longer string containing it
        if (!company) company = aiCompany;
        else if (aiCompany.length <= company.length + 2) company = aiCompany;
      }
    }
  } catch {
    /* optional */
  }

  if (!company && !jobRole) return null;
  return { company, jobRole, source };
}
