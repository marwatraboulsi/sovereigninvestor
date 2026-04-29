/**
 * usePlaybook — stub (Phase 1C)
 *
 * Full implementation arrives in Phase 3A.
 * This stub exports the correct function signatures so that any screen or
 * component that imports usePlaybook can be written and type-checked now
 * without waiting for the real Supabase integration.
 */

import type { PlaybookRule, DecisionType, DecisionTrigger, RuleStatus } from '@/types';

export function usePlaybook() {
  const rules: PlaybookRule[] = [];
  const loaded = false;

  /** Insert a new rule for the current user. */
  const addRule = async (
    _rule: Omit<PlaybookRule, 'id' | 'userId' | 'createdAt' | 'overrideCount'>,
  ): Promise<void> => {};

  /** Update one or more fields on an existing rule. */
  const updateRule = async (
    _id: string,
    _updates: Partial<PlaybookRule>,
  ): Promise<void> => {};

  /** Soft-pause a rule (sets status → 'paused'). */
  const pauseRule = async (_id: string): Promise<void> => {};

  /** Soft-remove a rule (sets status → 'removed'). Never hard-deletes. */
  const removeRule = async (_id: string): Promise<void> => {};

  /**
   * Return active rules relevant to the given decision type and triggers.
   * Phase 3 implements smart matching; for now returns all active rules.
   */
  const matchRules = (
    _decisionType: DecisionType,
    _triggers: DecisionTrigger[],
  ): PlaybookRule[] => [];

  return { rules, loaded, addRule, updateRule, pauseRule, removeRule, matchRules };
}
