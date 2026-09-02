import { PlacementBoard } from "@/components/placement/PlacementBoard";

export function StudentForwardedTab({
  studentId,
  employeeId,
}: {
  studentId: string;
  employeeId?: string | null;
  /** @deprecated Delete is admin-only; kept so existing call sites still type-check. */
  canDelete?: boolean;
  canAdd?: boolean;
}) {
  return <PlacementBoard studentId={studentId} employeeId={employeeId} />;
}
