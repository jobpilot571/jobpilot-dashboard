export interface DocTypeDef {
  key: string;
  label: string;
  multiple?: boolean;
}

export const DOCUMENT_TYPES: DocTypeDef[] = [
  { key: "driver_license", label: "Driver License / State ID" },
  { key: "visa_copy", label: "Visa Copy" },
  { key: "i20", label: "I-20" },
  { key: "ead_card", label: "EAD Card" },
  { key: "passport", label: "Passport" },
  { key: "ssn_proof", label: "SSN Proof (last 4 verification)" },
  { key: "resume", label: "Resume" },
  { key: "other", label: "Other Document", multiple: true },
];

export const DOC_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  DOCUMENT_TYPES.map((d) => [d.key, d.label]),
);

export function formatBytes(n?: number | null): string {
  if (!n || n <= 0) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}
