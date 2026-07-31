# Welcome / login emails (Create login + Resend)

Emails are sent by the Supabase edge function `send-welcome-credentials` via **Resend**.

## Why they showed “Not sent”
The first deploy was a stub that only wrote `email_logs` with status `not_sent` and never called an email API.

## Setup (JB_Dashboard project `pawxtwqwxvjrpyvyvppf`)

### 1. Resend account
1. Create/login at https://resend.com
2. Add API key
3. Verify sending domain (recommended): `notify.jobpilotagent.online`  
   Or for quick tests use Resend’s onboarding sender (see secrets below).

### 2. Set function secrets

```bash
npx supabase link --project-ref pawxtwqwxvjrpyvyvppf

npx supabase secrets set RESEND_API_KEY=re_xxxxxxxx
npx supabase secrets set APP_URL=https://www.jobpilotagent.online
npx supabase secrets set WELCOME_FROM_EMAIL="JobPilot.ai <noreply@notify.jobpilotagent.online>"
```

For testing before domain verify:

```bash
npx supabase secrets set WELCOME_FROM_EMAIL="JobPilot.ai <onboarding@resend.dev>"
```

(Resend only delivers `onboarding@resend.dev` to your own Resend account email unless domain is verified.)

### 3. Deploy

```bash
npx supabase functions deploy send-welcome-credentials
```

Also ensure `manage-employee` is deployed (creates Auth user + temp password).

### 4. Test
Admin → Students → **Create login** or **Resend welcome email**  
Badge should move from **Not sent** → **Welcome email sent** / **Credentials resent**.

## Email contents
- Recipient email
- Temporary password
- Link to `{APP_URL}/login`
