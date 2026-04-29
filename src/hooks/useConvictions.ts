/**
 * useConvictions — stub (Phase 1C)
 *
 * Full implementation arrives in Phase 8A.
 * This stub exports the correct function signatures for early type-checking.
 */

import type { Conviction } from '@/types';

export function useConvictions() {
  const convictions: Conviction[] = [];
  const loaded = false;

  /** Insert a new conviction record for the current user. */
  const addConviction = async (
    _conviction: Omit<Conviction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ): Promise<void> => {};

  /** Update belief, confidence, or note on an existing conviction. */
  const updateConviction = async (
    _id: string,
    _updates: Partial<Conviction>,
  ): Promise<void> => {};

  return { convictions, loaded, addConviction, updateConviction };
}
