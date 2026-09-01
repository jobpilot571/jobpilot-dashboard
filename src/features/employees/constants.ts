export const JOB_ROLE_CATEGORIES = [
  "DevOps",
  "Data",
  "DevOps/Data",
  "Business Analyst",
  "QA",
  "Other",
] as const;

export type JobRoleCategory = (typeof JOB_ROLE_CATEGORIES)[number] | string;

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export type EmployeeStatusFilter = "all" | "active" | "inactive";
export type EmployeeSortKey =
  | "name"
  | "startDate"
  | "category"
  | "appsToday"
  | "progress"
  | "status"
  | "assigned";

export const PAGE_SIZE = 10;
