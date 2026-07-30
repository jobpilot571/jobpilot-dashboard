# Migrate data: Lovable Supabase → JB_Dashboard

## Important: what we did “last time”
We did **not** copy rows. The rebuild used the **same** live Lovable DB (`yvhayaaghhthlgwtgveh`).  
Now **JB_Dashboard** (`pawxtwqwxvjrpyvyvppf`) is a **new empty** project, so a real migrate is required.

---

## Step 1 — Open the old Lovable Supabase project

1. Go to [lovable.dev](https://lovable.dev) → your JobPilot project  
2. Open **Settings / Cloud / Supabase** (wording varies) and note:
   - Project URL / Ref (old id may be `yvhayaaghhthlgwtgveh`)
   - Or click **Open in Supabase**
3. Confirm Table Editor still has `students`, `employees`, `job_applications`, etc.

Keep that tab as **SOURCE**.  
Keep **JB_Dashboard** as **TARGET** (already has fresh schema).

---

## Step 2 — Choose a migrate method

### Option A — Full DB dump (best if you have DB password)
On **SOURCE** project:

```bash
# Export (needs SOURCE database password + ref)
npx supabase db dump --project-ref SOURCE_REF -f lovable_data.sql --data-only
```

On **TARGET** (JB_Dashboard), prefer importing **data only** into existing tables  
(do **not** re-run schema wipe). Often safer: CSV path below for core tables.

Or use Supabase Dashboard → **Database → Backups** if available on a paid plan.

### Option B — CSV per table (practical on Free plan)
On **SOURCE** → Table Editor → each table → **Export to CSV**.

Import order on **TARGET** (JB_Dashboard):

1. `employees`
2. `students`
3. `trial_students` (optional)
4. `job_applications`
5. `placement_pipeline_events`
6. `email_logs` (optional)

**Skip for first pass:** `users` (auth-linked — see Step 3).

TARGET import: Table Editor → table → **Insert** / **Import data from CSV**  
(or SQL `COPY` if you use psql).

Match columns to the fresh schema. Extra Lovable-only columns can be dropped from the CSV.

---

## Step 3 — Auth logins (`auth.users` + `public.users`)

Passwords **cannot** be copied as plaintext.

Practical approach after data import:

1. Keep employee/student **rows** (emails intact).
2. For each person who needs login, use Admin UI **Create login** / reset password  
   (needs `manage-employee` already deployed on JB_Dashboard).
3. Or recreate your own admin (you already did this).

Do **not** blindly copy `auth.users` unless you know how to dump encrypted credentials with `pg_dump` of `auth` schema (advanced).

---

## Step 4 — Storage (resumes)
If Lovable stored files in a `resumes` bucket:

1. SOURCE → Storage → download files (or use a sync script)
2. TARGET → Storage → `resumes` bucket → upload  
3. Update `job_applications.resume_file_url` / pipeline `document_url` if URLs changed

Skip if you can re-upload resumes as needed.

---

## Step 5 — Verify on production
On https://jobpilotagent.online :

- [ ] Employees count matches
- [ ] Students list + assignments
- [ ] Apps / Placement numbers look right
- [ ] Spot-check 3 student profiles

---

## Tables that matter most
| Priority | Table |
|----------|--------|
| High | `employees`, `students`, `job_applications` |
| High | `placement_pipeline_events` |
| Medium | `trial_students` |
| Low | `email_logs`, app-detail tables |

---

## If SOURCE project id is still `yvhayaaghhthlgwtgveh`
Paste SOURCE ref + whether you can get the **database password**.  
We can then script a safer data-only copy into `pawxtwqwxvjrpyvyvppf`.
