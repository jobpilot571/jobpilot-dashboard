import { useEffect, useRef, useState, type TextareaHTMLAttributes } from "react";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useParseResumeProfile, useSaveStudentProfile } from "@/hooks/useStudentProfile";
import {
  bulletText,
  parseProfileJson,
  type ProfileEducation,
  type ProfileJob,
  type StudentProfileJson,
} from "@/lib/studentProfile";
import { cn } from "@/lib/utils";

function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-[88px] w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    />
  );
}

export function StudentProfileTab({
  studentId,
  studentName,
  studentEmail,
  profileJson,
  loading,
}: {
  studentId: string;
  studentName: string;
  studentEmail: string;
  profileJson: unknown;
  loading: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const save = useSaveStudentProfile(studentId);
  const parse = useParseResumeProfile(studentId);
  const [profile, setProfile] = useState<StudentProfileJson>(() =>
    parseProfileJson(profileJson, studentName, studentEmail),
  );
  const [skillDraft, setSkillDraft] = useState("");

  useEffect(() => {
    setProfile(parseProfileJson(profileJson, studentName, studentEmail));
  }, [profileJson, studentName, studentEmail]);

  const setField = <K extends keyof StudentProfileJson>(key: K, value: StudentProfileJson[K]) => {
    setProfile((p) => ({ ...p, [key]: value }));
  };

  const addJob = () => {
    const jobs = [...(profile.jobs ?? [])];
    jobs.push({ title: "", company: "", dates: "", bullets: [""] });
    setField("jobs", jobs);
  };

  const addEducation = () => {
    const education = [...(profile.education ?? [])];
    education.push({ degree: "", institution: "", dates: "" });
    setField("education", education);
  };

  if (loading) return <Skeleton className="h-64 w-full rounded-xl" />;

  return (
    <div className="space-y-5">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-base">Upload resume & auto-fill</CardTitle>
          <CardDescription>PDF or DOCX — parses into the sections below via parse-resume-profile</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) parse.mutate(file);
              e.target.value = "";
            }}
          />
          <Button type="button" disabled={parse.isPending} onClick={() => fileRef.current?.click()}>
            {parse.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {parse.isPending ? "Parsing…" : "Upload resume"}
          </Button>
          <Button type="button" variant="outline" disabled={save.isPending} onClick={() => save.mutate(profile)}>
            {save.isPending ? "Saving…" : "Save profile"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Personal</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" value={profile.name ?? ""} onChange={(v) => setField("name", v)} />
          <Field label="Role / title" value={profile.title ?? ""} onChange={(v) => setField("title", v)} />
          <Field label="Email" value={profile.email ?? ""} onChange={(v) => setField("email", v)} />
          <Field label="Phone" value={profile.phone ?? ""} onChange={(v) => setField("phone", v)} />
          <div className="sm:col-span-2">
            <Field label="LinkedIn" value={profile.linkedin ?? ""} onChange={(v) => setField("linkedin", v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Professional summary</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={profile.summary ?? ""}
            onChange={(e) => setField("summary", e.target.value)}
            placeholder="Short professional summary…"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Skills</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {(profile.skills ?? []).map((skill) => (
              <Badge key={skill} className="gap-1 border-border bg-muted text-muted-foreground">
                {skill}
                <button
                  type="button"
                  className="ml-1 text-xs hover:text-destructive"
                  onClick={() => setField("skills", (profile.skills ?? []).filter((s) => s !== skill))}
                >
                  ×
                </button>
              </Badge>
            ))}
            {(profile.skills ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No skills yet — upload a resume or add manually.</p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Add skill"
              value={skillDraft}
              onChange={(e) => setSkillDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const s = skillDraft.trim();
                  if (!s) return;
                  setField("skills", [...(profile.skills ?? []), s]);
                  setSkillDraft("");
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const s = skillDraft.trim();
                if (!s) return;
                setField("skills", [...(profile.skills ?? []), s]);
                setSkillDraft("");
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display text-base">Experience</CardTitle>
          <Button type="button" size="sm" variant="outline" onClick={addJob}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {(profile.jobs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No experience entries yet.</p>
          ) : (
            (profile.jobs ?? []).map((job, idx) => (
              <JobEditor
                key={idx}
                job={job}
                onChange={(next) => {
                  const jobs = [...(profile.jobs ?? [])];
                  jobs[idx] = next;
                  setField("jobs", jobs);
                }}
                onRemove={() => setField("jobs", (profile.jobs ?? []).filter((_, i) => i !== idx))}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display text-base">Education</CardTitle>
          <Button type="button" size="sm" variant="outline" onClick={addEducation}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {(profile.education ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No education entries yet.</p>
          ) : (
            (profile.education ?? []).map((edu, idx) => (
              <EduEditor
                key={idx}
                edu={edu}
                onChange={(next) => {
                  const education = [...(profile.education ?? [])];
                  education[idx] = next;
                  setField("education", education);
                }}
                onRemove={() =>
                  setField(
                    "education",
                    (profile.education ?? []).filter((_, i) => i !== idx),
                  )
                }
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function JobEditor({
  job,
  onChange,
  onRemove,
}: {
  job: ProfileJob;
  onChange: (j: ProfileJob) => void;
  onRemove: () => void;
}) {
  const bullets = (job.bullets ?? []).map(bulletText);
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <div className="flex justify-end">
        <Button type="button" size="icon" variant="ghost" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          placeholder="Company"
          value={job.company}
          onChange={(e) => onChange({ ...job, company: e.target.value })}
        />
        <Input
          placeholder="Title"
          value={job.title}
          onChange={(e) => onChange({ ...job, title: e.target.value })}
        />
        <Input
          className="sm:col-span-2"
          placeholder="Dates (e.g. 2020-07 → 2022-11)"
          value={job.dates ?? ""}
          onChange={(e) => onChange({ ...job, dates: e.target.value })}
        />
      </div>
      <Textarea
        placeholder="One bullet per line"
        value={bullets.join("\n")}
        onChange={(e) =>
          onChange({
            ...job,
            bullets: e.target.value.split("\n").map((text) => text),
          })
        }
      />
    </div>
  );
}

function EduEditor({
  edu,
  onChange,
  onRemove,
}: {
  edu: ProfileEducation;
  onChange: (e: ProfileEducation) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <div className="flex justify-end">
        <Button type="button" size="icon" variant="ghost" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          placeholder="Institution"
          value={edu.institution}
          onChange={(e) => onChange({ ...edu, institution: e.target.value })}
        />
        <Input
          placeholder="Degree"
          value={edu.degree}
          onChange={(e) => onChange({ ...edu, degree: e.target.value })}
        />
        <Input
          className="sm:col-span-2"
          placeholder="Dates"
          value={edu.dates ?? ""}
          onChange={(e) => onChange({ ...edu, dates: e.target.value })}
        />
      </div>
    </div>
  );
}
