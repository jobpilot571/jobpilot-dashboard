# JobPilot.ai mobile app (Capacitor)

One native app for **admin**, **employee**, and **student**. Role-based access is the same as the web app: login → `users.role` → `/admin`, `/app`, or `/me`.

## Prerequisites

| Platform | Need |
|----------|------|
| **Android** | [Android Studio](https://developer.android.com/studio) + JDK 21 |
| **iOS** | macOS + [Xcode](https://developer.apple.com/xcode/) (build/submit only on Mac) |
| **Both stores** | Apple Developer ($99/yr) + Google Play ($25 one-time) |

## Commands

```bash
# Build web assets + sync into android/ and ios/
npm run mobile:build

# Open native IDE after sync
npm run mobile:android   # Android Studio
npm run mobile:ios       # Xcode (macOS only)
```

After UI changes: `npm run mobile:build`, then run from Android Studio / Xcode.

## How it works

- **Wrapper:** Capacitor loads the Vite `dist/` SPA inside a native WebView.
- **Auth:** Supabase email/password; sessions use Capacitor Preferences on device.
- **RBAC:** Unchanged — `ProtectedRoute` + Supabase RLS.
- **Deep links:** Custom scheme `ai.jobpilot.dashboard://` (password reset / auth redirects).

## Supabase Auth URLs

In Supabase → Authentication → URL Configuration, add:

- `ai.jobpilot.dashboard://reset-password`
- `ai.jobpilot.dashboard://login`
- Your existing web URLs (keep them)

For password-reset emails opened on mobile, set redirect to the custom scheme when appropriate.

## First Android run (Windows)

1. Install Android Studio and create an emulator (or plug in a phone with USB debugging).
2. From the project root:
   ```bash
   npm run mobile:android
   ```
3. In Android Studio: **Run** ▸ app.

## First iOS run (Mac)

1. `npm run mobile:ios`
2. In Xcode: select a simulator or device → Run.
3. Set your Team under Signing & Capabilities before device installs.

## App identity

| Field | Value |
|-------|--------|
| App ID | `ai.jobpilot.dashboard` |
| Display name | JobPilot.ai |
| Web dir | `dist` |

## Icons & splash

Default Capacitor icons ship in `android/` and `ios/`. Replace with JobPilot branding before store submit:

- Android: `android/app/src/main/res/mipmap-*`
- iOS: `ios/App/App/Assets.xcassets/AppIcon.appiconset`

## Notes

- Dense **admin** tables are usable but work best on tablet / landscape.
- Web deploy on Vercel is unchanged (`npm run build` / `npm run dev`).
- Do not commit secrets; `.env` stays local. Native builds embed `VITE_*` at **web build** time — run `npm run mobile:build` with the correct `.env` before shipping.
