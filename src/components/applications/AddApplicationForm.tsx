import { useState, type FormEvent } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/dialog";
import { APP_STATUSES, useAddJobApplication } from "@/hooks/useJobApplications";
import { autofillFromJobLink, JOB_LINK_GUIDANCE } from "@/lib/jobLinkAutofill";
import { enrichJobLinkWithAi } from "@/lib/parseJobLinkAi";
import { getNowCST } from "@/lib/timezone";

export function AddApplicationForm({
  studentId,
  employeeId,
  onSaved,
}: {
  studentId: string;
  employeeId: string;
  onSaved?: () => void;
}) {
  const add = useAddJobApplication(studentId);
  const now = getNowCST();
  const [applied_link, setLink] = useState("");
  const [job_role, setRole] = useState("");
  const [company_name, setCompany] = useState("");
  const [status, setStatus] = useState("applied");
  const [autofilling, setAutofilling] = useState(false);

  const runAutofill = async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setAutofilling(true);
    try {
      const local = autofillFromJobLink(trimmed);
      if (local.company) setCompany(local.company);
      if (local.jobRole) setRole(local.jobRole);
      const ai = await enrichJobLinkWithAi(trimmed);
      if (ai?.company) setCompany(ai.company);
      if (ai?.jobRole) setRole(ai.jobRole);
    } finally {
      setAutofilling(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!applied_link.trim()) return;
    if (status === "applied" && !job_role.trim()) return;

    add.mutate(
      {
        applied_link: applied_link.trim(),
        job_role: job_role.trim(),
        company_name: company_name.trim(),
        status,
        created_by_employee_id: employeeId,
        applied_date: now.date,
        applied_time: now.time,
      },
      {
        onSuccess: () => {
          setLink("");
          setRole("");
          setCompany("");
          setStatus("applied");
          onSaved?.();
        },
      },
    );
  };

  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="app-link">Applied link</Label>
        <div className="flex gap-2">
          <Input
            id="app-link"
            type="url"
            placeholder="https://… (job posting URL)"
            value={applied_link}
            onChange={(e) => setLink(e.target.value)}
            onBlur={() => void runAutofill(applied_link)}
            required
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={autofilling || !applied_link.trim()}
            title="Autofill"
            onClick={() => void runAutofill(applied_link)}
          >
            {autofilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">{JOB_LINK_GUIDANCE}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="app-role">Job role</Label>
        <Input id="app-role" value={job_role} onChange={(e) => setRole(e.target.value)} required={status === "applied"} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="app-company">Company</Label>
        <Input id="app-company" value={company_name} onChange={(e) => setCompany(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="app-status">Status</Label>
        <Select id="app-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          {APP_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={add.isPending} className="w-full sm:w-auto">
          {add.isPending ? "Saving…" : "Save application"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-2">
        Timestamped in America/Chicago as {now.date} · {now.time}
      </p>
    </form>
  );
}
