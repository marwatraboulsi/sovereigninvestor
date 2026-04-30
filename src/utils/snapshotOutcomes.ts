/**
 * snapshotOutcomes.ts — Phase 9A
 *
 * Standalone utility (not a hook) that keeps milestone price snapshots
 * up-to-date for all of a user's decision logs.
 *
 * Milestones: 7, 30, 60, 90 days after the original decision.
 *
 * Algorithm:
 *   1. Fetch all existing non-day-0 snapshots for the supplied log IDs.
 *   2. For each (log, milestone) pair that is due and not yet stored,
 *      schedule a live-price fetch.
 *   3. Batch-fetch live prices for distinct tickers (Finnhub → Yahoo → Stooq).
 *   4. Insert new price_snapshots rows in bulk.
 *
 * Designed to run fire-and-forget in the background — no return value,
 * all errors swallowed.
 */

import { supabase } from '@/lib/supabase';
import type { DecisionLog } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const MILESTONES = [7, 30, 60, 90] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysSince(ts: number): number {
  return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
}

// ─── Minimal price fetchers ───────────────────────────────────────────────────
// These mirror the logic in useLivePrices.ts but are self-contained so the
// utility doesn't depend on a React hook.

async function fetchYahooPrice(symbol: string): Promise<number> {
  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    for (const range of ['1d', '5d']) {
      try {
        const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const json = await res.json();
        const meta = json?.chart?.result?.[0]?.meta;
        if (!meta) continue;

        let price =
          (typeof meta.regularMarketPrice === 'number' && meta.regularMarketPrice > 0
            ? meta.regularMarketPrice : 0) ||
          (typeof meta.previousClose === 'number' && meta.previousClose > 0
            ? meta.previousClose : 0);

        // Normalise GBp → GBP
        if ((meta.currency === 'GBp' || meta.currency === 'GBX') && price > 0) {
          price /= 100;
        }

        if (price > 0) return price;
      } catch {}
    }
  }
  return 0;
}

const STOOQ_SUFFIX_MAP: Record<string, string> = {
  '.PA': '.fr', '.L': '.uk', '.AS': '.nl',
  '.MI': '.it', '.SW': '.ch', '.BR': '.be',
};

async function fetchStooqPrice(symbol: string): Promise<number> {
  const upper = symbol.toUpperCase();
  const matchedSuffix = Object.keys(STOOQ_SUFFIX_MAP).find((s) => upper.endsWith(s));
  const candidates: string[] = matchedSuffix
    ? [symbol.slice(0, -matchedSuffix.length) + STOOQ_SUFFIX_MAP[matchedSuffix], symbol]
    : symbol.includes('.') ? [symbol] : [symbol + '.US'];

  for (const candidate of candidates) {
    try {
      const s = candidate.toLowerCase();
      const res = await fetch(
        `https://stooq.com/q/l/?s=${encodeURIComponent(s)}&f=sd2t2ohlcv&h&e=csv`,
      );
      if (!res.ok) continue;
      const lines = (await res.text()).replace(/\r/g, '').trim().split('\n');
      if (lines.length < 2) continue;
      const close = parseFloat(lines[1].split(',')[6] ?? '');
      if (!isNaN(close) && close > 0) return close;
    } catch {}
  }
  return 0;
}

/**
 * Fetches a live price for `ticker`, trying Finnhub → Yahoo Finance → Stooq.
 * Returns 0 if all sources fail or return no data.
 */
async function fetchLivePrice(ticker: string): Promise<number> {
  const apiKey = process.env.EXPO_PUBLIC_FINNHUB_API_KEY;

  // 1. Finnhub /quote — real-time for US, delayed for other exchanges
  if (apiKey) {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`,
      );
      if (res.ok) {
        const json = await res.json();
        const c  = typeof json.c  === 'number' ? json.c  : 0;
        const pc = typeof json.pc === 'number' ? json.pc : 0;
        if (c  > 0) return c;
        if (pc > 0) return pc;
      }
    } catch {}
  }

  // 2. Yahoo Finance
  const yahoo = await fetchYahooPrice(ticker);
  if (yahoo > 0) return yahoo;

  // 3. Stooq — reliable for EU ETFs
  return fetchStooqPrice(ticker);
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Checks which milestone snapshots (7 / 30 / 60 / 90 days) are due for the
 * supplied logs, fetches live prices where needed, and inserts new rows into
 * the `price_snapshots` table.
 *
 * Safe to call on every focus event — fully idempotent (checks existing rows
 * before inserting). Runs silently; never throws.
 */
export async function snapshotOutcomes(logs: DecisionLog[]): Promise<void> {
  try {
    if (logs.length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const logIds = logs.map((l) => l.id);

    // ── 1. Fetch all non-day-0 snapshots already stored ───────────────────────
    const { data: existing } = await supabase
      .from('price_snapshots')
      .select('decision_log_id, days_from_decision')
      .in('decision_log_id', logIds)
      .gt('days_from_decision', 0);

    // Build a Set of "logId:milestone" keys that already exist
    const done = new Set<string>(
      (existing ?? []).map(
        (r: any) => `${r.decision_log_id}:${r.days_from_decision}`,
      ),
    );

    // ── 2. Determine which (log, milestone) pairs are due ─────────────────────
    type Job = { log: DecisionLog; milestone: number };
    const jobs: Job[] = [];

    for (const log of logs) {
      if (log.priceAtDecision <= 0) continue;      // no price recorded — skip
      const age = daysSince(log.createdAt);
      for (const milestone of MILESTONES) {
        if (age >= milestone && !done.has(`${log.id}:${milestone}`)) {
          jobs.push({ log, milestone });
        }
      }
    }

    if (jobs.length === 0) return;

    // ── 3. Batch-fetch live prices for distinct tickers ───────────────────────
    const distinctTickers = [...new Set(jobs.map((j) => j.log.ticker))];
    const priceMap: Record<string, number> = {};

    await Promise.all(
      distinctTickers.map(async (ticker) => {
        const price = await fetchLivePrice(ticker);
        if (price > 0) priceMap[ticker] = price;
      }),
    );

    // ── 4. Insert new snapshot rows ───────────────────────────────────────────
    const now = Date.now();
    const rows = jobs
      .filter((j) => (priceMap[j.log.ticker] ?? 0) > 0)
      .map((j) => ({
        decision_log_id:    j.log.id,
        ticker:             j.log.ticker,
        price:              priceMap[j.log.ticker],
        currency:           j.log.currency,
        snapshot_at:        now,
        days_from_decision: j.milestone,
      }));

    if (rows.length > 0) {
      await supabase.from('price_snapshots').insert(rows);
    }
  } catch {
    // silent
  }
}
