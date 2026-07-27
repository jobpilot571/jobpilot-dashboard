export type StudentStatusFilter = "all" | "active" | "pending" | "inactive";
export type StudentSortKey =
  | "name"
  | "program"
  | "assigned"
  | "apps"
  | "interviews"
  | "payment"
  | "status";

export const STUDENT_PAGE_SIZE = 10;

export const PROGRAM_SUGGESTIONS = [
  "DevOps",
  "Data",
  "Data Analyst",
  "Business Analyst",
  "QA",
  "Full Stack",
  "Other",
] as const;
