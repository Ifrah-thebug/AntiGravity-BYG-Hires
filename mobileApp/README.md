# BYG Hires — Talent mobile app (React Native CLI)

Talent-only mobile version of the BYG Hires web app. It uses **the same backend APIs and the same
Supabase project** as the web frontend. Nothing in `backend/` or the web `src/` needs to change.

## Screens (web page → mobile screen)

| Web route | Mobile screen |
|---|---|
| `/login` | `LoginScreen` |
| `/talent/signup` | `SignupScreen` (CV + photo + agreement → Gemini CV parse) |
| `/forgot-password`, `/reset-password` | `ForgotPasswordScreen`, `ResetPasswordScreen` |
| `/talent/activate` | `ActivateScreen` (invited talent) |
| `/talent/setup` | `SetupScreen` (review AI-parsed profile → submit for review) |
| `/portal` | `PortalScreen` (profile, skills, guide, portfolio requests, sharing, chapters, intro slots) |
| `/assessment` | `AssessmentScreen` |
| `/interview` | `VoiceInterviewScreen` |
| `/talent/:id/portfolio` | `PortfolioScreen` (storybook + chapter studio, preview as visitor) |
| BGuides chat | `TalentChatLauncher` (floating button on talent screens) |

Client, admin and ambassador accounts get a "use the website" screen (`NotTalentScreen`).

## Folder structure

```
src/
  app/                 App root, navigation (single stack, like the web router), deep links
  core/                Framework-level code: env config, Supabase client, HTTP helpers, file storage
  shared/              Reusable UI kit (Button, TextField, BottomSheet…), theme, pure helpers
  features/            One folder per feature — each has api/ components/ screens/ (hooks/, utils/)
    auth/ onboarding/ profile/ portal/ assessment/ interview/ portfolio/ intro/ guide/ chat/
  assets/images/
__tests__/             Unit tests for the shared business rules
```

Rules of thumb:
- Screens only compose components and call feature `api/` functions — no raw `fetch` in screens.
- Business rules (`profileContentPolicy`, `formatDisplayName`, departments, verification) are 1:1 ports
  of the web `src/lib` files, so validation behaves the same on both platforms.
- Import with the `@/` alias (`@/features/...`, `@/shared/...`).

## Setup

1. `cd mobileApp && npm install`
2. Copy `.env.example` to `.env` and fill it in. Use the same values as the web `VITE_*` variables:
   - `BACKEND_URL`: defaults to the live API `https://byghires.com`. For a local backend use `http://10.0.2.2:5001` (emulator) or `http://<PC LAN IP>:5001` (phone).
   - `WEB_APP_URL`: the public website (used for portfolio share links).
3. Only when testing against a local backend: start it with `cd backend && npm run dev`.
4. Run the app:
   - `npm start` (Metro)
   - `npm run android` (needs the Android SDK and an emulator or device)
   - iOS (macOS only): `cd ios && bundle install && bundle exec pod install && cd .. && npm run ios`

After changing `.env`, restart Metro with `npm start -- --reset-cache`.

## Platform notes

- **CV parsing** calls Gemini directly from the app (same as the web signup page). This means
  `GEMINI_API_KEY` ships inside the app bundle, just as `VITE_GEMINI_API_KEY` ships in the web bundle.
- **Profile photo** uses the backend `/api/profile/enhance-photo` (Leonardo). If that fails, the
  picked photo is used as-is.
- **AI voice interview** runs the official `@vapi-ai/web` SDK inside a hidden WebView
  (`features/interview/vapi/VapiBridge.js`). The UI is native. The microphone permission is requested at start.
- **Cal.com connect** opens in the phone's browser. When you return to the app, the portal refreshes.
- **Email links** (reset password, invite activation) point to the website. To open them directly in the
  app, set up Android App Links / iOS Universal Links for `WEB_APP_URL`. The app already handles
  `byghires://reset-password?token=…` and `byghires://talent/activate?token=…`.
- **Fonts**: the web uses Montserrat. Add the TTFs to `src/assets/fonts` and link them to match it exactly.
  Until then the system font is used.
- The storybook background music from the web portfolio page is not included.

## Scripts

- `npm test`: unit tests
- `npm run lint`: ESLint
