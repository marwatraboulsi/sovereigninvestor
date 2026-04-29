-- ─── Sovereign Investor — Intercept Redesign Schema ──────────────────────────
--
-- Migration: 001_intercept_schema.sql
-- Adds four new tables for the Playbook, Decision Log, Price Snapshots,
-- and Convictions systems. Also extends the existing profiles table with
-- the enough_statement column.
--
-- Safe to run multiple times (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- All tables use row-level security so users can only access their own data.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── 1. playbook_rules ────────────────────────────────────────────────────────
-- Each row is one behavioral rule belonging to a user.
-- status: 'active' | 'paused' | 'removed'  (soft delete — never hard-delete)
-- source_trigger: where the rule originated ('onboarding-seed' | 'intercept-gap'
--                 | 'learn-mode' | 'manual')
-- structured_conditions: optional JSON for machine-readable rule matching
-- override_count: incremented each time the user taps "Conscious Proceed"
--                 while this rule was matched

create table if not exists playbook_rules (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references auth.users(id) on delete cascade not null,
  category              text not null,
  title                 text not null,
  body                  text not null,
  structured_conditions jsonb,
  source_trigger        text not null default 'manual',
  created_at            bigint not null,
  status                text not null default 'active',
  override_count        integer not null default 0
);

alter table playbook_rules enable row level security;

create policy "Users manage own rules"
  on playbook_rules
  for all
  using (auth.uid() = user_id);


-- ─── 2. decision_logs ─────────────────────────────────────────────────────────
-- Each row is one completed Intercept session.
-- emotional_triggers: array of trigger codes identified in Step 2
-- rules_matched: array of playbook_rule UUIDs that fired in Step 3
-- verdict: 'follow-playbook' | 'conscious-proceed' | 'no-rules-matched'
-- trade_executed: only meaningful when verdict = 'conscious-proceed'
-- price_at_decision: live price fetched at the moment of logging (from Finnhub)

create table if not exists decision_logs (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references auth.users(id) on delete cascade not null,
  ticker             text not null,
  asset_name         text not null,
  decision_type      text not null,
  emotional_triggers text[] not null default '{}',
  rules_matched      text[] not null default '{}',
  verdict            text not null,
  override_reason    text,
  trade_executed     boolean,
  price_at_decision  numeric not null,
  currency           text not null default 'USD',
  created_at         bigint not null,
  notes              text
);

alter table decision_logs enable row level security;

create policy "Users manage own decisions"
  on decision_logs
  for all
  using (auth.uid() = user_id);


-- ─── 3. price_snapshots ───────────────────────────────────────────────────────
-- Milestone price recordings for outcome tracking.
-- days_from_decision: 0 (at decision), 7, 30, 60, 90
-- RLS is enforced via the parent decision_logs row — users can only see
-- snapshots that belong to their own decisions.

create table if not exists price_snapshots (
  id                uuid primary key default gen_random_uuid(),
  decision_log_id   uuid references decision_logs(id) on delete cascade not null,
  ticker            text not null,
  price             numeric not null,
  currency          text not null default 'USD',
  snapshot_at       bigint not null,
  days_from_decision integer not null default 0
);

alter table price_snapshots enable row level security;

create policy "Users view own snapshots"
  on price_snapshots
  for select
  using (
    exists (
      select 1 from decision_logs
      where decision_logs.id = price_snapshots.decision_log_id
        and decision_logs.user_id = auth.uid()
    )
  );


-- ─── 4. convictions ───────────────────────────────────────────────────────────
-- One row per (user, theme) — enforced by unique constraint.
-- belief: 'yes' | 'no' | 'still-forming'
-- confidence: 'low' | 'medium' | 'high'
-- source_trigger: how this conviction was created
--   ('catalyst-scanner' | 'learn-mode' | 'manual' | 'migrated')
--   'migrated' is used in Phase 8 when converting the existing
--   macroConvictions[] string array from the profiles table.

create table if not exists convictions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  theme          text not null,
  belief         text not null,
  confidence     text not null default 'low',
  note           text,
  created_at     bigint not null,
  updated_at     bigint not null,
  source_trigger text not null default 'manual',
  unique(user_id, theme)
);

alter table convictions enable row level security;

create policy "Users manage own convictions"
  on convictions
  for all
  using (auth.uid() = user_id);


-- ─── 5. Extend profiles table ─────────────────────────────────────────────────
-- enough_statement: the user's personal "I have enough when..." statement.
-- Used in Phase 3+ to give the playbook an anchor for goal-aligned rules.

alter table profiles add column if not exists enough_statement text;
