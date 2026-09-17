/**
 * One-off: ensure the "resumes" storage bucket exists (it backs resumes,
 * offer letters, and placement screenshots). Safe to re-run.
 * Usage: node scripts/ensure-resumes-bucket.mjs
 * Requires: supabase CLI logged in + linked project.
 */
import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";

const PROJECT_REF = "pawxtwqwxvjrpyvyvppf";
const BUCKET_ID = "resumes";

function getServiceKey() {
  const raw = execSync(
    `npx supabase projects api-keys --project-ref ${PROJECT_REF} -o json`,
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end < 0) throw new Error("Could not parse api-keys JSON");
  const keys = JSON.parse(raw.slice(start, end + 1));
  const service =
    keys.find((k) => k.name === "service_role" || k.id === "service_role") ||
    keys.find((k) => String(k.name || "").includes("service"));
  if (!service?.api_key) throw new Error("service_role key not found");
  return service.api_key;
}

const url = `https://${PROJECT_REF}.supabase.co`;
const serviceKey = getServiceKey();
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const { data: buckets, error: listErr } = await admin.storage.listBuckets();
if (listErr) throw listErr;

const existing = buckets?.find((b) => b.id === BUCKET_ID);
if (existing) {
  console.log(`Bucket "${BUCKET_ID}" already exists. public=${existing.public}`);
} else {
  const { data, error } = await admin.storage.createBucket(BUCKET_ID, {
    public: true,
  });
  if (error) throw error;
  console.log(`Created bucket:`, data);
}

// Make sure it's public so getPublicUrl() links (used for resumes, offer
// letters, and placement screenshots) actually resolve without auth.
const { error: updateErr } = await admin.storage.updateBucket(BUCKET_ID, {
  public: true,
});
if (updateErr) throw updateErr;
console.log(`Bucket "${BUCKET_ID}" is now public.`);
