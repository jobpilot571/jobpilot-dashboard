# JobPilot.ai Dashboard (rebuild)

Clean rebuild on the **live** Supabase project `yvhayaaghhthlgwtgveh` (full production data).

See `docs/PRODUCTION_DB.md` for Vercel env + Auth URLs.

## Quick start
1. `.env` — URL + legacy anon key for `yvhayaaghhthlgwtgveh`
2. `npm install`
3. `npm run dev` → http://localhost:5173

## Roles
| Role | Prefix |
|------|--------|
| Admin | `/admin` |
| Employee | `/app` |
| Student | `/me` |

## Mobile (Capacitor)

Single app with the same role-based access. See **`docs/MOBILE.md`**.

```bash
npm run mobile:build      # web build + sync native projects
npm run mobile:android    # open Android Studio
npm run mobile:ios        # open Xcode (macOS)
```
