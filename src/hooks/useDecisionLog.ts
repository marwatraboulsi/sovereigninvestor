/**
 * useDecisionLog — full implementation (Phase 4C / 5A)
 *
 * Reads and writes to the `decision_logs` and `price_snapshots` tables.
 * addLog()      — inserts the decision record + a day-0 price snapshot.
 * getOutcome()  — queries stored snapshots for the best available P&L data.
 *                 Returns null when only the day-0 snapshot exists (no outcome
 *                 yet), since comparing day-0 to itself is meaningless.
 *                 The detail screen supplements this with a live price fetch.
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { DecisionLog } from '@/types';

// ─── DB row → TypeScript ──────────────────────────────────────────────────────

function rowToLog(row: any): DecisionLog {
  return {
    id:               row.id,
    userId:           row.user_id,
    ticker:           row.ticker,
    assetName:        row.asset_name,
    decisionType:     row.decision_type,
    emotionalTriggers: row.emotional_triggers ?? [],
    rulesMatched:     row.rules_matched ?? [],
    verdict:          row.verdict,
    overrideReason:   row.override_reason ?? undefined,
    tradeExecuted:    row.trade_executed  ?? undefined,
    priceAtDecision:  Number(row.price_at_decision),
    currency:         row.currency,
    createdAt:        row.created_at,
    notes:            row.notes ?? undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export function useDecisionLog() {
  const [logs,   setLogs]   = useState<DecisionLog[]>([]);
  const [loaded, setLoaded] = useState(false);

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const reload = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoaded(true); return; }

      const { data, error } = await supabase
        .from('decision_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLogs((data ?? []).map(rowToLog));
    } catch {
      // fail silently — logs stay at last known state
    } finally {
      setLoaded(true);
    }
  }, []);

  // ─── Write ──────────────────────────────────────────────────────────────────

  /**
   * Inserts a DecisionLog and a day-0 PriceSnapshot.
   * Returns the new log's UUID, or null on failure.
   * Callers do not need to supply userId or createdAt.
   */
  const addLog = useCallback(async (
    log: Omit<DecisionLog, 'id' | 'userId' | 'createdAt'>,
  ): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const createdAt = Date.now();

      const { data: logData, error: logError } = await supabase
        .from('decision_logs')
        .insert({
          user_id:           user.id,
          ticker:            log.ticker,
          asset_name:        log.assetName,
          decision_type:     log.decisionType,
          emotional_triggers: log.emotionalTriggers,
          rules_matched:     log.rulesMatched,
          verdict:           log.verdict,
          override_reason:   log.overrideReason   ?? null,
          trade_executed:    log.tradeExecuted     ?? null,
          price_at_decision: log.priceAtDecision,
          currency:          log.currency,
          created_at:        createdAt,
          notes:             log.notes            ?? null,
        })
        .select()
        .single();

      if (logError) throw logError;
      if (!logData) return null;

      const newLog = rowToLog(logData);
      setLogs((prev) => [newLog, ...prev]);

      // Insert day-0 price snapshot (best-effort — don't fail the whole log if this errors)
      if (log.priceAtDecision > 0) {
        await supabase.from('price_snapshots').insert({
          decision_log_id:   logData.id,
          ticker:            log.ticker,
          price:             log.priceAtDecision,
          currency:          log.currency,
          snapshot_at:       createdAt,
          days_from_decision: 0,
        });
      }

      return logData.id as string;
    } catch {
      return null;
    }
  }, []);

  // ─── Outcome ─────────────────────────────────────────────────────────────────

  /**
   * Fetches the most recent stored price snapshot with days_from_decision > 0
   * for a given log. Returns structured P&L data, or null if no post-decision
   * snapshot exists yet (only the day-0 record is present).
   */
  const getOutcome = useCallback(async (
    logId: string,
    priceAtDecision: number,
  ): Promise<{
    priceAtDecision: number;
    currentPrice:    number;
    pnl:             number;
    pnlPct:          number;
    daysFromDecision:number;
  } | null> => {
    try {
      const { data, error } = await supabase
        .from('price_snapshots')
        .select('price, days_from_decision')
        .eq('decision_log_id', logId)
        .gt('days_from_decision', 0)          // exclude the day-0 baseline
        .order('days_from_decision', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return null;

      const currentPrice    = Number(data.price);
      const pnl             = currentPrice - priceAtDecision;
      const pnlPct          = priceAtDecision > 0 ? (pnl / priceAtDecision) * 100 : 0;

      return {
        priceAtDecision,
        currentPrice,
        pnl,
        pnlPct,
        daysFromDecision: data.days_from_decision,
      };
    } catch {
      return null;
    }
  }, []);

  // ─── Playbook validation ─────────────────────────────────────────────────────

  /**
   * For all supplied logs, queries 30-day price snapshots and determines:
   *   · with30d    — how many logs have a 30-day snapshot stored
   *   · validatedCount — among follow-playbook buy/sell decisions with a 30-day
   *                      snapshot, how many were directionally correct:
   *                        buy  → correct if 30d price < priceAtDecision (didn't buy, price fell)
   *                        sell → correct if 30d price > priceAtDecision (held, price rose)
   *
   * Used by the Decisions summary strip to show the "Playbook validated" metric.
   */
  const getPlaybookValidated = useCallback(async (
    currentLogs: DecisionLog[],
  ): Promise<{ validatedCount: number; with30d: number }> => {
    try {
      if (currentLogs.length === 0) return { validatedCount: 0, with30d: 0 };

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { validatedCount: 0, with30d: 0 };

      const { data: snaps } = await supabase
        .from('price_snapshots')
        .select('decision_log_id, price')
        .in('decision_log_id', currentLogs.map((l) => l.id))
        .eq('days_from_decision', 30);

      if (!snaps) return { validatedCount: 0, with30d: 0 };

      const with30d = snaps.length;

      const snap30dMap: Record<string, number> = {};
      for (const snap of snaps as any[]) {
        snap30dMap[snap.decision_log_id] = Number(snap.price);
      }

      let validatedCount = 0;
      const fpLogs = currentLogs.filter((l) =>
        l.verdict === 'follow-playbook' &&
        (l.decisionType === 'buy' || l.decisionType === 'sell') &&
        l.priceAtDecision > 0,
      );

      for (const log of fpLogs) {
        const snap30 = snap30dMap[log.id];
        if (snap30 === undefined) continue;
        if (log.decisionType === 'buy'  && snap30 < log.priceAtDecision) validatedCount++;
        if (log.decisionType === 'sell' && snap30 > log.priceAtDecision) validatedCount++;
      }

      return { validatedCount, with30d };
    } catch {
      return { validatedCount: 0, with30d: 0 };
    }
  }, []);

  return { logs, loaded, reload, addLog, getOutcome, getPlaybookValidated };
}
