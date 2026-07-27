/**
 * Deterministic job-link autofill (no LLM).
 * Extracts company + role from common ATS URLs; never invents fake titles.
 * UKG / opportunityId links usually have NO role in the URL — leave role empty
 * and let page enrichment fill it.
 */

const ATS_HOST_HINTS: Array<{ match: RegExp; companyFrom?: "subdomain" | "path0" | "query" | "ukg" }> = [
  { match: /greenhouse\.io$/i, companyFrom: "subdomain" },
  { match: /boards\.greenhouse\.io$/i, companyFrom: "path0" },
  { match: /lever\.co$/i, companyFrom: "subdomain" },
  { match: /jobs\.lever\.co$/i, companyFrom: "path0" },
  { match: /myworkdayjobs\.com$/i, companyFrom: "subdomain" },
  { match: /wd\d*\.myworkdayjobs\.com$/i, companyFrom: "path0" },
  { match: /icims\.com$/i, companyFrom: "subdomain" },
  { match: /successfactors\.com$/i },
  { match: /taleo\.net$/i },
  { match: /jobvite\.com$/i },
  { match: /smartrecruiters\.com$/i, companyFrom: "path0" },
  { match: /ashbyhq\.com$/i, companyFrom: "path0" },
  { match: /apply\.workable\.com$/i, companyFrom: "path0" },
  { match: /oraclecloud\.com$/i },
  { match: /ukg\.net$/i, companyFrom: "ukg" },
  { match: /ultipro\.com$/i, companyFrom: "ukg" },
];

const NOISE_HOST_PARTS = new Set([
  "www",
  "jobs",
  "careers",
  "career",
  "apply",
  "application",
  "boards",
  "job",
  "recruiting",
  "talent",
  "wd1",
  "wd2",
  "wd3",
  "wd5",
  "my",
  "app",
  "apps",
  "fa",
  "saasfaprod1",
  "euyk",
  "rec",
  "pro",
  "ukg",
  "ultipro",
]);

const NOISE_PATH_SEGMENTS = new Set([
  "job",
  "jobs",
  "career",
  "careers",
  "apply",
  "application",
  "applications",
  "en-us",
  "en",
  "us",
  "position",
  "positions",
  "requisition",
  "details",
  "view",
  "posting",
  "postings",
  "listing",
  "opportunity",
  "opportunities",
  "opportunityapply",
  "opportunitydetail",
  "opportunitydetails",
  "jobboard",
  "job-board",
  "cx",
  "x",
  "s",
  "hcm",
]);

const BAD_ROLE_WORDS = new Set([
  "my profile",
  "profile",
  "confirmation",
  "application",
  "apply",
  "opportunity apply",
  "opportunityapply",
  "success",
  "thank you",
  "home",
  "login",
  "sign in",
  "dashboard",
  "job board",
  "jobboard",
]);

function titleCase(raw: string): string {
  return raw
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => {
      if (/^[A-Z0-9]{2,6}$/.test(w)) return w.toUpperCase(); // PSI, GEICO-style
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

/** PSI1500PSIL → PSI ; ACME → ACME */
function companyFromTenantCode(raw: string): string {
  const m = raw.trim().match(/^([A-Za-z]{2,12})(?=\d|_|$)/);
  if (!m?.[1]) return "";
  const code = m[1]!.toUpperCase();
  if (NOISE_HOST_PARTS.has(code.toLowerCase())) return "";
  return code;
}

function cleanCompanyToken(raw: string): string {
  let t = raw.replace(/\.(com|io|co|net|org|jobs)$/i, "").replace(/[-_]+/g, " ").trim();
  if (!t || NOISE_HOST_PARTS.has(t.toLowerCase())) return "";
  if (/saasfaprod|faprod|oraclecloud|myworkday/i.test(t)) return "";
  if (/^wd\d+$/i.test(t)) return "";
  // psionline → PSI
  if (/online$/i.test(t) && t.length > 6) {
    const base = t.replace(/online$/i, "");
    if (base.length >= 2 && base.length <= 8) return base.toUpperCase();
  }
  if (t.length < 2) return "";
  return titleCase(t);
}

function roleFromSlug(slug: string): string {
  const cleaned = decodeURIComponent(slug)
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\d{5,}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 3) return "";
  const tc = titleCase(cleaned);
  const lower = tc.toLowerCase().replace(/\s+/g, "");
  if (BAD_ROLE_WORDS.has(tc.toLowerCase())) return "";
  if (NOISE_PATH_SEGMENTS.has(lower)) return "";
  if (/opportunity/i.test(tc)) return "";
  if (!/[a-z]/i.test(tc)) return "";
  // Compound glued words like OpportunityApply
  if (/^[A-Z][a-z]+[A-Z]/.test(slug) && /apply|confirm|success|profile/i.test(slug)) return "";
  return tc;
}

export type JobLinkAutofill = {
  company: string;
  jobRole: string;
  confidence: "high" | "medium" | "low";
  source: "url";
  warnings: string[];
  needsPageFetch: boolean;
};

function parseUkg(url: URL, path: string[]): Partial<JobLinkAutofill> {
  const warnings: string[] = [];
  let company = "";

  // /PSI1500PSIL/JobBoard/...
  if (path[0]) {
    company = companyFromTenantCode(path[0]) || cleanCompanyToken(path[0]);
  }
  if (!company) {
    const sub = url.hostname.split(".")[0] || "";
    company = cleanCompanyToken(sub);
  }

  const hasOpportunityId = url.searchParams.has("opportunityId") || /OpportunityApply/i.test(url.pathname);
  if (hasOpportunityId) {
    warnings.push(
      "UKG apply links are login-gated — company can be filled from the URL, but job role must be entered manually.",
    );
  }

  return {
    company,
    jobRole: "", // never use OpportunityApply
    confidence: company ? "medium" : "low",
    warnings,
    // Page fetch usually hits Auth0 login — still try, but don't promise a title
    needsPageFetch: true,
  };
}

export function autofillFromJobLink(rawUrl: string): JobLinkAutofill {
  const warnings: string[] = [];
  let company = "";
  let jobRole = "";
  let confidence: JobLinkAutofill["confidence"] = "low";
  let needsPageFetch = false;

  let url: URL;
  try {
    url = new URL(rawUrl.trim().startsWith("http") ? rawUrl.trim() : `https://${rawUrl.trim()}`);
  } catch {
    return {
      company: "",
      jobRole: "",
      confidence: "low",
      source: "url",
      warnings: ["Invalid URL"],
      needsPageFetch: false,
    };
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const parts = host.split(".");
  const path = url.pathname.split("/").filter(Boolean);
  const params = url.searchParams;

  const isUkg = /ukg\.net$/i.test(host) || /ultipro\.com$/i.test(host);
  if (isUkg) {
    const ukg = parseUkg(url, path);
    return {
      company: ukg.company || "",
      jobRole: "",
      confidence: ukg.confidence || "low",
      source: "url",
      warnings: ukg.warnings || [],
      needsPageFetch: true,
    };
  }

  for (const key of ["title", "job_title", "jobTitle", "position", "req_title"]) {
    const v = params.get(key);
    if (v && !BAD_ROLE_WORDS.has(v.trim().toLowerCase())) {
      jobRole = v.trim();
      confidence = "high";
      break;
    }
  }

  for (const key of ["company", "company_name", "org"]) {
    const v = params.get(key);
    if (v) {
      company = titleCase(v.trim());
      break;
    }
  }

  const ats = ATS_HOST_HINTS.find((h) => h.match.test(host));

  if (!company) {
    if (ats?.companyFrom === "subdomain" && parts.length >= 3) {
      company = cleanCompanyToken(parts[0]!);
    } else if (ats?.companyFrom === "path0" && path[0]) {
      company = cleanCompanyToken(path[0]!) || companyFromTenantCode(path[0]!);
    }
  }

  if (!company) {
    if (!ats && parts.length >= 2) {
      const brand = cleanCompanyToken(parts[0]!);
      if (brand) company = brand;
    } else if (parts.length >= 3) {
      const candidate = cleanCompanyToken(parts[0]!);
      if (candidate) company = candidate;
    }
  }

  if (!jobRole) {
    for (let i = path.length - 1; i >= 0; i--) {
      const seg = path[i]!;
      if (NOISE_PATH_SEGMENTS.has(seg.toLowerCase())) continue;
      if (/^[0-9a-f-]{8,}$/i.test(seg)) continue;
      if (/^\d+$/.test(seg)) continue;
      const role = roleFromSlug(seg);
      if (role) {
        jobRole = role;
        confidence = confidence === "high" ? "high" : company ? "medium" : "low";
        break;
      }
    }
  }

  // UUID-only job ids → must fetch page for title
  if (!jobRole && (params.has("opportunityId") || params.has("jobId") || /\/[0-9a-f-]{36}/i.test(url.pathname))) {
    needsPageFetch = true;
    warnings.push("Job title is not in the URL — reading the posting page…");
  }

  if (!company) warnings.push("Could not detect company from URL — enter manually.");
  if (!jobRole && !needsPageFetch) {
    warnings.push("Could not detect job role from URL — enter manually.");
  }
  if (/thank|confirm|success|applied/i.test(url.pathname + url.search)) {
    warnings.push("This looks like a confirmation/thank-you page — prefer the original job posting URL.");
    confidence = "low";
  }

  if (company && jobRole && confidence === "low") confidence = "medium";

  return { company, jobRole, confidence, source: "url", warnings, needsPageFetch };
}

/** Prefer the posting URL over thank-you / confirmation pages for logging. */
export const JOB_LINK_GUIDANCE =
  "Paste the original job posting URL (the Apply page), not a thank-you email link or confirmation page.";
