# Sovereign Investor

A personal investment intelligence app for iOS. It combines an AI advisor (Nora), structured research tools, a behavioural decision coach (the Intercept), a portfolio vault, and an investor profile system — all designed around long-term, disciplined investing.

Available on the [App Store](https://apps.apple.com/app/sovereign-investor/id6762229830).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 54 / React Native (Hermes engine) |
| Routing | Expo Router v4 (file-based) |
| Backend & Auth | Supabase (Postgres, Edge Functions, pgvector) |
| AI | Anthropic Claude via `dynamic-service` Edge Function proxy |
| RAG | Voyage AI embeddings + Supabase pgvector (`match_knowledge_chunks`) |
| Builds & Delivery | EAS Build + EAS Submit (OTA updates via expo-updates) |
| Language | TypeScript (strict) |

---

## Running Locally

```bash
# 1. Clone and install
git clone https://github.com/marwatraboulsi/sovereigninvestor.git
cd sovereigninvestor
npm install

# 2. Configure environment variables
cp .env.example .env
# Fill in values — see Environment Variables section below

# 3. Start the dev server
npx expo start
```

Scan the QR code with Expo Go, or press `i` to open the iOS simulator.

---

## Environment Variables

Create a `.env` file in the project root (gitignored — never commit it).

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_SERP_API_KEY=your_serp_api_key
EXPO_PUBLIC_VOYAGE_API_KEY=your_voyage_api_key
```

`EXPO_PUBLIC_*` variables are embedded in the iOS binary and visible to anyone who inspects it. The Anthropic API key is therefore kept exclusively in Supabase's secret vault and never bundled into the client — all Claude calls go through the `dynamic-service` Edge Function.

---

## Production Builds

```bash
# Build and submit to App Store Connect in one step
eas build --platform ios --profile production --auto-submit
```

The `production` profile in `eas.json` auto-increments the build number. EAS submits to App Store Connect automatically after a successful build. Apple processing typically takes 10–20 minutes.

---

## Edge Function — `dynamic-service`

All Anthropic API calls are proxied through a Supabase Edge Function so the API key never touches the client binary.

**Location:** `supabase/functions/dynamic-service/index.ts`

**Endpoint:** `POST https://your-project-ref.supabase.co/functions/v1/dynamic-service`

The function forwards the request body to the Anthropic Messages API and streams the response back via SSE. It injects SSE comment heartbeats every 25 seconds to prevent iOS from dropping the TCP connection during silent periods (which occur when Claude executes server-side web searches).

### Deploying updates

```bash
supabase login
supabase link --project-ref your-project-ref
supabase functions deploy dynamic-service
```

### Setting secrets (one-time)

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

> `supabase/functions/claude-proxy/` is a legacy function kept for reference. It is not called by the current client.

---

## Architecture

### RAG — Retrieval-Augmented Generation

`claudeClient.ts` runs a RAG pipeline before each Nora message:

1. Embeds the user query with Voyage AI's `voyage-3` model
2. Queries `match_knowledge_chunks` (a pgvector RPC on Supabase) for the most semantically relevant knowledge chunks
3. Injects retrieved chunks into the Claude system prompt alongside the user's profile

This avoids injecting the full knowledge base on every request while still surfacing relevant content when needed. It falls back silently to a static `knowledgeBase.ts` if the Voyage key is absent or the RPC fails.

### Model Routing

`src/api/modelRouter.ts` routes each request between two Claude models:

- **Claude Haiku** — short clarifying questions (under 200 characters, no ticker symbol, no analytical keywords)
- **Claude Sonnet** — everything else: structured research, portfolio analysis, streaming skill sessions

Routing inspects the last user message against a keyword list and a ticker pattern (`/\b[A-Z]{1,5}\b/`).

### Streaming

Claude responses stream via SSE. The client uses `XMLHttpRequest` (`onprogress`) rather than the Fetch streaming API — Hermes does not reliably support `ReadableStream` from `fetch()`. Each `onprogress` event is parsed for `data:` SSE lines and accumulated into message state.

---

## Project Structure

```
app/
  (tabs)/
    chat.tsx              # Nora — AI counsel (Chat Mode + Learn Mode)
    intercept.tsx         # Intercept — pre-trade decision coach
    skills.tsx            # Research tool picker
    vault.tsx             # Portfolio holdings tracker
    profile.tsx           # Investor mandate, Playbook, Worldview
  skill/[id].tsx          # Research tool runner (streamed, multi-phase)
  learn/[topic].tsx       # Learn Mode session screen
  research-history.tsx    # Past research session archive
  saved-research.tsx      # Bookmarked research outputs
  onboarding.tsx          # Profile setup flow
  extended-profile.tsx    # Extended profile questions
  orientation.tsx         # App orientation / feature intro
  how-it-works.tsx        # Plain-language system explainer

src/
  api/
    claudeClient.ts       # Streaming + non-streaming Claude calls, RAG pipeline
    modelRouter.ts        # Haiku vs Sonnet routing logic
  components/             # RuleCard, SkillProgress, SlideViewer, MessageBubble, etc.
  hooks/
    useSkillSession.ts    # Research session state + multi-phase prompt orchestration
    useResearchHistory.ts # Archive and retrieval of past sessions
    usePlaybook.ts        # Playbook CRUD
  skills/                 # System prompts + phase definitions per research tool
  knowledge/
    knowledgeBase.ts      # Static fallback knowledge base
  types/                  # Shared TypeScript interfaces
  utils/
    generateSeedRules.ts  # Generates initial Playbook rules from onboarding profile
    seedPlaybookOnFirstLogin.ts

supabase/
  functions/
    dynamic-service/      # Active Edge Function proxy (SSE + heartbeat)
    claude-proxy/         # Legacy proxy (not in use)
  migrations/
    001_intercept_schema.sql
    002_fixes_and_missing_schema.sql
    003_playbook_rule_metadata.sql

cloudflare/
  worker.js               # Cloudflare Worker proxy (evaluated, not in production use)
  wrangler.toml
```

---

## Key Design Decisions

**API key security** — The Anthropic key lives exclusively in Supabase's secret vault. `EXPO_PUBLIC_*` variables are compiled into the iOS binary and extractable via static analysis; anything sensitive stored there should be treated as public.

**Streaming via XHR** — Hermes does not support the WHATWG Streams API from `fetch()`. `XMLHttpRequest.onprogress` fires reliably on each chunk on both the simulator and physical devices.

**Heartbeat SSE comments** — When Claude performs a server-side web search (used by the research skills), the upstream connection can be silent for 10–30 seconds. iOS drops TCP connections that carry no data. The Edge Function injects `": heartbeat"` SSE comments every 25 seconds to keep the connection alive without affecting the parsed event stream on the client.

**Prompt caching** — The knowledge base system prompt block is marked `cache_control: { type: "ephemeral" }`. Anthropic caches it for ~5 minutes, so repeat turns within a session are only charged for the delta rather than the full knowledge base on every request.

**Tab bar** — A custom absolute-positioned tab bar (`TAB_BAR_HEIGHT = 82`) replaces the default Expo Router tab bar. All scrollable screens add equivalent `paddingBottom` to avoid content being obscured.

**Playbook seed rules** — Initial Playbook rules are generated client-side from the user's onboarding profile answers (`generateSeedRules.ts`) and written to Supabase on first login. Generation is deterministic and idempotent — re-running it for the same profile produces the same rules.
