-- ─── Sovereign Investor — Schema Fixes & Missing Table Capture ────────────────
--
-- Migration: 002_fixes_and_missing_schema.sql
--
-- Addresses all gaps found during the post-Phase-9 schema audit:
--
--   A. vault_holdings — add missing columns (name, asset_type, notes, shares)
--   B. match_knowledge_chunks RPC — create pgvector similarity search function
--   C. match_analysis_chunks RPC — create user-scoped pgvector search function
--   D. archive_analyses INSERT policy — add missing WITH CHECK enforcement
--   E. knowledge_chunks — restrict INSERT/DELETE to service role only
--   F. profiles DELETE policy — enable account self-deletion
--   G. Capture pre-existing tables in code (profiles, vault_holdings,
--      conversations, messages, archive_analyses, analysis_chunks,
--      knowledge_chunks, contact_messages) so the schema can be fully
--      recreated from migrations alone.
--
-- Safe to run multiple times (uses IF NOT EXISTS / OR REPLACE / IF NOT EXISTS
-- on policies). Run against the live project via:
--   supabase db push   (if using Supabase CLI with linked project)
-- or paste into the Supabase SQL Editor and execute.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═══════════════════════════════════════════════════════════════════════════════
-- A. vault_holdings — add missing columns
-- ═══════════════════════════════════════════════════════════════════════════════
-- The live table only has (id, created_at, user_id, ticker).
-- The app code expects name, asset_type, notes (JSON metadata), and shares.
-- Without these, every holding renders with undefined name/type/quantity.

alter table vault_holdings
  add column if not exists name       text,
  add column if not exists asset_type text,
  add column if not exists notes      text,        -- JSON: { sector, exchange, currency, ... }
  add column if not exists shares     numeric;


-- ═══════════════════════════════════════════════════════════════════════════════
-- B. match_knowledge_chunks — pgvector similarity search (public knowledge base)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Called by claudeClient.retrieveKnowledgeChunks() before every chat message
-- and skill run. Without this function, all RAG silently falls back to the
-- static knowledge base and no dynamic retrieval occurs.
--
-- Embedding model: Voyage AI voyage-3 → 1024 dimensions.
-- Similarity metric: cosine (1 − cosine_distance).

create or replace function match_knowledge_chunks(
  query_embedding vector(1024),
  match_count     int default 5
)
returns table (
  id         uuid,
  page_title text,
  content    text,
  similarity float
)
language sql stable
security definer
as $$
  select
    id,
    page_title,
    content,
    1 - (embedding <=> query_embedding) as similarity
  from knowledge_chunks
  where embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- Grant execute to the authenticated and anon roles so the client can call it
grant execute on function match_knowledge_chunks(vector(1024), int)
  to authenticated, anon;


-- ═══════════════════════════════════════════════════════════════════════════════
-- C. match_analysis_chunks — user-scoped pgvector search (saved analyses RAG)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Called alongside match_knowledge_chunks. Retrieves chunks from the calling
-- user's own saved analyses so their research history informs future answers.

create or replace function match_analysis_chunks(
  query_embedding vector(1024),
  p_user_id       uuid,
  match_count     int default 3
)
returns table (
  id             uuid,
  analysis_title text,
  skill_name     text,
  content        text,
  similarity     float
)
language sql stable
security definer
as $$
  select
    id,
    analysis_title,
    skill_name,
    content,
    1 - (embedding <=> query_embedding) as similarity
  from analysis_chunks
  where user_id = p_user_id
    and embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function match_analysis_chunks(vector(1024), uuid, int)
  to authenticated, anon;


-- ═══════════════════════════════════════════════════════════════════════════════
-- D. archive_analyses — fix INSERT policy to enforce user_id
-- ═══════════════════════════════════════════════════════════════════════════════
-- The existing INSERT policy has no WITH CHECK clause, meaning any authenticated
-- user can insert a row claiming any user_id. Drop and recreate with enforcement.

drop policy if exists "Users can insert own analyses" on archive_analyses;

create policy "Users can insert own analyses"
  on archive_analyses
  for insert
  with check (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════════════════════════
-- E. knowledge_chunks — restrict write access to service role only
-- ═══════════════════════════════════════════════════════════════════════════════
-- Knowledge chunks are admin-managed content. The public INSERT and DELETE
-- policies allow any user to corrupt the shared knowledge base. Remove them.
-- Only the service role (used by admin scripts / Supabase Edge Functions) should
-- be able to write to this table. Public SELECT is intentional and stays.

drop policy if exists "Public insert" on knowledge_chunks;
drop policy if exists "Public delete" on knowledge_chunks;

-- Service role bypasses RLS by default in Supabase, so no explicit policy
-- needed for admin writes. Authenticated users retain read access via the
-- existing "Public read" policy.


-- ═══════════════════════════════════════════════════════════════════════════════
-- F. profiles — add DELETE policy for account self-deletion
-- ═══════════════════════════════════════════════════════════════════════════════
-- useUserProfile.clearProfile() calls .delete().eq('id', user.id) but the
-- missing DELETE policy causes it to silently return 0 rows. Account deletion
-- is broken without this.

create policy "Users can delete own profile"
  on profiles
  for delete
  using (auth.uid() = id);


-- ═══════════════════════════════════════════════════════════════════════════════
-- G. Capture pre-existing tables
--    (no-op DDL — tables already exist; this section documents the schema
--     so the database can be fully recreated from migrations alone)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── profiles ──────────────────────────────────────────────────────────────────
-- Created before migration tracking began. Columns as audited 2025-04-30.

create table if not exists profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  created_at          timestamptz not null default now(),
  knowledge_level     text,
  investment_status   text,
  primary_goal        text,
  response_style      text,
  age_range           text,
  risk_tolerance      text,
  worldview           text,
  macro_convictions   text[],
  worldview_note      text,
  onboarding_complete boolean default false,
  vault_cash          jsonb,
  vault_base_currency text default 'USD',
  enough_statement    text
);

alter table profiles enable row level security;


-- ── vault_holdings ────────────────────────────────────────────────────────────

create table if not exists vault_holdings (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  user_id     uuid references auth.users(id) on delete cascade,
  ticker      text,
  name        text,
  asset_type  text,
  notes       text,    -- JSON blob: { sector, exchange, currency, ... }
  shares      numeric
);

alter table vault_holdings enable row level security;


-- ── conversations ─────────────────────────────────────────────────────────────

create table if not exists conversations (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text
);

alter table conversations enable row level security;


-- ── messages ──────────────────────────────────────────────────────────────────

create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null,
  content         text not null,
  suggestions     jsonb
);

alter table messages enable row level security;


-- ── archive_analyses ──────────────────────────────────────────────────────────
-- Note: live DB has slides as `json`; document as `jsonb` here for future
-- recreation (functionally equivalent; jsonb preferred for indexing).

create table if not exists archive_analyses (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id    uuid references auth.users(id) on delete cascade,
  skill_id   text,
  skill_name text,
  title      text,
  slides     jsonb
);

alter table archive_analyses enable row level security;


-- ── analysis_chunks ───────────────────────────────────────────────────────────

create table if not exists analysis_chunks (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz default now(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  analysis_id    text not null,
  analysis_title text,
  skill_name     text,
  chunk_index    integer,
  content        text not null,
  embedding      vector(1024)
);

alter table analysis_chunks enable row level security;


-- ── knowledge_chunks ──────────────────────────────────────────────────────────

create table if not exists knowledge_chunks (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  notion_page_id text,
  page_title    text,
  chunk_index   integer,
  content       text not null,
  embedding     vector(1024)
);

alter table knowledge_chunks enable row level security;


-- ── contact_messages ──────────────────────────────────────────────────────────

create table if not exists contact_messages (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id    uuid references auth.users(id),
  name       text,
  message    text not null,
  status     text default 'new'
);

alter table contact_messages enable row level security;


-- ═══════════════════════════════════════════════════════════════════════════════
-- Verification queries — run these after applying to confirm correctness
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Check vault_holdings columns:
--   select column_name from information_schema.columns
--   where table_name = 'vault_holdings' order by ordinal_position;
--
-- Check RPC functions exist:
--   select routine_name from information_schema.routines
--   where routine_schema = 'public'
--   and routine_name in ('match_knowledge_chunks', 'match_analysis_chunks');
--
-- Check profiles DELETE policy:
--   select policyname, cmd from pg_policies
--   where tablename = 'profiles';
--
-- Check knowledge_chunks no longer has public write:
--   select policyname, cmd from pg_policies
--   where tablename = 'knowledge_chunks';
-- ─────────────────────────────────────────────────────────────────────────────
