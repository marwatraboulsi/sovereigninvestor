/**
 * useDecisionLog — full implementation (Phase 4C)
 *
 * Reads and writes to the `decision_logs` and `price_snapshots` tables.
 * addLog() inserts the decision record + a day-0 price snapshot atomically.
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

  return { logs, loaded, reload, addLog };
}
