export type StudentStatusFilter = "all" | "active" | "pending" | "inactive";
export type StudentSortKey =
  | "name"
  | "startDate"
  | "program"
  | "assigned"
  | "apps"
  | "interviews"
  | "payment";

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
