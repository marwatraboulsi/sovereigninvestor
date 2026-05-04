# Sovereign Investor

A personal investment intelligence app built for iOS. It combines an AI advisor (Nora), a suite of research tools, a behavioural decision coach (Intercept), a portfolio vault, and an investor profile system — all designed around long-term, disciplined investing.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 54 / React Native (Hermes) |
| Routing | Expo Router (file-based) |
| Backend & Auth | Supabase (Postgres + Edge Functions) |
| AI | Anthropic Claude (via Supabase Edge Function proxy) |
| Builds | EAS Build + EAS Submit |
| Language | TypeScript |

---

## Running Locally

```bash
# 1. Clone and install
git clone https://github.com/marwatraboulsi/sovereigninvestor.git
cd sovereigninvestor
npm install

# 2. Set up environment variables
cp .env.example .env
# Fill in the values in .env (see Environment Variables section below)

# 3. Start the dev server
npx expo start
```

Scan the QR code with the Expo Go app, or press `i` to open in the iOS simulator.

---

## Environment Variables

Create a `.env` file in the project root (never commit it — it is gitignored).

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_SERP_API_KEY=your_serp_api_key
```

**The Anthropic API key is not stored in the app.** It lives exclusively in the Supabase Edge Function secret vault and is never bundled into the iOS binary. See the Edge Function section below.

---

## Building for TestFlight

```bash
# Build the iOS IPA
eas build --platform ios --profile production --non-interactive

# Submit to App Store Connect (TestFlight)
eas submit --platform ios --profile production --latest --non-interactive
```

Apple processes the build within ~15 minutes of submission. A TestFlight notification email is sent automatically once it is ready.

---

## Edge Function — `claude-proxy`

All Anthropic API calls are proxied through a Supabase Edge Function so the API key never touches the client binary.

**Location:** `supabase/functions/claude-proxy/index.ts`

**Endpoint:** `https://your-project-ref.supabase.co/functions/v1/claude-proxy`

### Deploying or updating the function

The Supabase Deno runtime can be updated via the dashboard:

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → your project → **Edge Functions**
2. Open `claude-proxy` → **Code** tab
3. Paste the updated `index.ts` content
4. Click **Deploy updates**

### Setting the Anthropic API key (one-time)

```bash
supabase login
supabase link --project-ref your-project-ref
supabase secrets set ANTHROPIC_API_KEY=sk-ant-api03-...
```

---

## Project Structure

```
app/
  (tabs)/           # Main tab screens (chat, skills, intercept, vault, profile)
  skill/[id].tsx    # Individual research tool runner
  how-it-works.tsx  # Onboarding / feature explainer
  privacy.tsx       # Privacy policy
src/
  api/
    claudeClient.ts # All Anthropic API calls (routes through claude-proxy)
  components/       # Shared UI components (RuleCard, SkillProgress, etc.)
  hooks/            # useSkillSession, useVault, etc.
  types/            # Shared TypeScript interfaces
supabase/
  functions/
    claude-proxy/   # Edge Function proxy for Anthropic API
```

---

## Key Design Decisions

- **API key security** — `EXPO_PUBLIC_*` variables are embedded in the iOS binary and visible to anyone who inspects it. The Anthropic key is therefore kept exclusively in Supabase's secret vault and accessed only server-side via the Edge Function.
- **Streaming** — Claude responses stream via SSE. The Edge Function pipes `upstream.body` directly back to the client. The iOS side uses XHR `onprogress` (Hermes does not support the Fetch streaming API).
- **Session persistence** — Skill session messages are persisted to AsyncStorage so analyses survive app restarts.
- **Tab bar** — A custom absolute-positioned tab bar requires manual `paddingBottom` on all scrollable screens (`TAB_BAR_HEIGHT = 82`).
