import { CheckCircle2, Circle, FileText } from "lucide-react";
import { format } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import { NoStudentProfile } from "@/components/student/NoStudentProfile";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentStudent } from "@/hooks/useCurrentStudent";
import { useStudentDocuments } from "@/hooks/useStudentPortal";
import {
  DOCUMENT_TYPES,
  DOC_TYPE_LABELS,
  formatBytes,
} from "@/features/documents/constants";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

export default function StudentDocumentsPage() {
  const { user } = useAuth();
  const { data: student, isLoading: stuLoading } = useCurrentStudent();
  const { data: docs = [], isLoading, isError, error } = useStudentDocuments(student?.id);
  const appDetailsOn = isFeatureEnabled("appDetailsModule");

  if (!stuLoading && !student) {
    return <NoStudentProfile email={user?.email} />;
  }

  const docPct =
    student && student.documents_total > 0
      ? Math.round((student.documents_submitted / student.documents_total) * 100)
      : 0;

  const uploadedTypes = new Set(docs.map((d) => d.document_type));

  return (
    <AppShell role="student">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Required documents for your placement file.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">Completion</CardTitle>
            <CardDescription>
              {student
                ? `${student.documents_submitted} of ${student.documents_total} tracked`
                : "—"}
            </CardDescription>
          </CardHeader>
          <CardContent>{student ? <ProgressBar value={docPct} /> : <Skeleton className="h-4" />}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Checklist</CardTitle>
            <CardDescription>
              {appDetailsOn
                ? "Upload via Application Details when requested."
                : "Secure self-upload is deferred (application-details module off). Your coordinator can request documents."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {DOCUMENT_TYPES.filter((d) => d.key !== "other").map((dt) => {
                const done = uploadedTypes.has(dt.key);
                return (
                  <li
                    key={dt.key}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm",
                      done && "bg-emerald-50/50",
                    )}
                  >
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="flex-1 font-medium">{dt.label}</span>
                    <Badge
                      className={
                        done
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-border bg-muted text-muted-foreground"
                      }
                    >
                      {done ? "On file" : "Pending"}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <FileText className="h-4 w-4 text-primary" />
              Uploaded files
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isError ? (
              <p className="text-sm text-muted-foreground">
                Could not load documents
                {error instanceof Error ? `: ${error.message}` : "."}
              </p>
            ) : null}
            {isLoading || stuLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : docs.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No documents uploaded yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Type</th>
                      <th className="py-2 pr-3 font-medium">File</th>
                      <th className="py-2 pr-3 font-medium">Size</th>
                      <th className="py-2 font-medium">Uploaded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((d) => (
                      <tr key={d.id} className="border-b border-border/70 last:border-0">
                        <td className="py-2.5 pr-3">
                          {DOC_TYPE_LABELS[d.document_type] ?? d.document_type}
                        </td>
                        <td className="py-2.5 pr-3 font-medium">{d.file_name}</td>
                        <td className="py-2.5 pr-3 tabular-nums text-muted-foreground">
                          {formatBytes(d.file_size)}
                        </td>
                        <td className="py-2.5 text-muted-foreground">
                          {format(new Date(d.uploaded_at), "MMM d, yyyy")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
