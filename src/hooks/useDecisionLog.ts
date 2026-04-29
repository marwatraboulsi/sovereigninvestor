/**
 * useDecisionLog — stub (Phase 1C)
 *
 * Full implementation arrives in Phase 4C (addLog + price snapshot on log)
 * and Phase 5A (full list + outcome calculation).
 * This stub exports the correct function signatures for early type-checking.
 */

import type { DecisionLog } from '@/types';

export function useDecisionLog() {
  const logs: DecisionLog[] = [];
  const loaded = false;

  /** Insert a new decision log entry and a day-0 price snapshot. */
  const addLog = async (
    _log: Omit<DecisionLog, 'id'>,
  ): Promise<void> => {};

  /** Re-fetch all logs from Supabase. */
  const reload = async (): Promise<void> => {};

  return { logs, loaded, addLog, reload };
}
