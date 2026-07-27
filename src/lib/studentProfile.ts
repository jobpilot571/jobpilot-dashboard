export interface ProfileJob {
  index?: number;
  title: string;
  company: string;
  dates?: string;
  bullets?: Array<{ index?: number; text: string } | string>;
}

export interface ProfileEducation {
  degree: string;
  institution: string;
  dates?: string;
  location?: string;
}

export interface StudentProfileJson {
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  summary?: string;
  skills?: string[];
  jobs?: ProfileJob[];
  education?: ProfileEducation[];
  certifications?: unknown[];
}

export function emptyProfile(name = "", email = ""): StudentProfileJson {
  return {
    name,
    email,
    title: "",
    phone: "",
    linkedin: "",
    summary: "",
    skills: [],
    jobs: [],
    education: [],
  };
}

export function parseProfileJson(raw: unknown, fallbackName = "", fallbackEmail = ""): StudentProfileJson {
  if (!raw || typeof raw !== "object") return emptyProfile(fallbackName, fallbackEmail);
  const p = raw as StudentProfileJson;
  return {
    ...emptyProfile(fallbackName, fallbackEmail),
    ...p,
    skills: Array.isArray(p.skills) ? p.skills : [],
    jobs: Array.isArray(p.jobs) ? p.jobs : [],
    education: Array.isArray(p.education) ? p.education : [],
  };
}

export function bulletText(b: { text: string } | string): string {
  return typeof b === "string" ? b : b.text;
}
