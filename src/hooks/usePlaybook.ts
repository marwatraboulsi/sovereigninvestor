/**
 * usePlaybook — full implementation (Phase 3A)
 *
 * Reads and writes to the `playbook_rules` Supabase table.
 * Exposes a reload() function so screens can refresh on focus
 * using the same useFocusEffect pattern as useAnalysisArchive.
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { PlaybookRule, DecisionType, DecisionTrigger, RuleStatus } from '@/types';

// ─── DB row → TypeScript ──────────────────────────────────────────────────────

function rowToRule(row: any): PlaybookRule {
  return {
    id:                   row.id,
    userId:               row.user_id,
    category:             row.category,
    title:                row.title,
    body:                 row.body,
    structuredConditions: row.structured_conditions ?? undefined,
    sourceTrigger:        row.source_trigger,
    createdAt:            row.created_at,
    status:               row.status,
    overrideCount:        row.override_count,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export function usePlaybook() {
  const [rules, setRules]   = useState<PlaybookRule[]>([]);
  const [loaded, setLoaded] = useState(false);

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const reload = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoaded(true); return; }

      const { data, error } = await supabase
        .from('playbook_rules')
        .select('*')
        .eq('user_id', user.id)
        .neq('status', 'removed')       // soft-deleted rules are never returned
        .order('created_at', { ascending: true });

      if (error) throw error;
      setRules((data ?? []).map(rowToRule));
    } catch {
      // fail silently — rules stay at last known state
    } finally {
      setLoaded(true);
    }
  }, []);

  // ─── Write ──────────────────────────────────────────────────────────────────

  const addRule = useCallback(async (
    rule: Omit<PlaybookRule, 'id' | 'userId' | 'createdAt' | 'overrideCount'>,
  ): Promise<void> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('playbook_rules')
        .insert({
          user_id:               user.id,
          category:              rule.category,
          title:                 rule.title,
          body:                  rule.body,
          structured_conditions: rule.structuredConditions ?? null,
          source_trigger:        rule.sourceTrigger,
          created_at:            Date.now(),
          status:                rule.status ?? 'active',
          override_count:        0,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setRules((prev) => [...prev, rowToRule(data)]);
      }
    } catch {
      // silently fail — UI stays consistent
    }
  }, []);

  const updateRule = useCallback(async (
    id: string,
    updates: Partial<PlaybookRule>,
  ): Promise<void> => {
    try {
      // Build DB-column update object from camelCase updates
      const dbUpdates: Record<string, unknown> = {};
      if (updates.category              !== undefined) dbUpdates.category              = updates.category;
      if (updates.title                 !== undefined) dbUpdates.title                 = updates.title;
      if (updates.body                  !== undefined) dbUpdates.body                  = updates.body;
      if (updates.structuredConditions  !== undefined) dbUpdates.structured_conditions  = updates.structuredConditions;
      if (updates.status                !== undefined) dbUpdates.status                = updates.status;
      if (updates.overrideCount         !== undefined) dbUpdates.override_count         = updates.overrideCount;

      const { error } = await supabase
        .from('playbook_rules')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;

      setRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updates } : r)),
      );
    } catch {
      // silently fail
    }
  }, []);

  /** Sets status → 'paused'. Paused rules are still visible but excluded from matching. */
  const pauseRule = useCallback(async (id: string): Promise<void> => {
    const rule = rules.find((r) => r.id === id);
    const nextStatus: RuleStatus = rule?.status === 'paused' ? 'active' : 'paused';
    await updateRule(id, { status: nextStatus });
  }, [rules, updateRule]);

  /** Soft-delete: sets status → 'removed'. Never hard-deletes. */
  const removeRule = useCallback(async (id: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('playbook_rules')
        .update({ status: 'removed' })
        .eq('id', id);

      if (error) throw error;
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // silently fail
    }
  }, []);

  /**
   * Returns active rules relevant to the given decision type and triggers.
   * Phase 3: returns all active rules (smart category/trigger matching in Phase 4).
   */
  const matchRules = useCallback((
    _decisionType: DecisionType,
    _triggers: DecisionTrigger[],
  ): PlaybookRule[] => {
    return rules.filter((r) => r.status === 'active');
  }, [rules]);

  return {
    rules,
    loaded,
    reload,
    addRule,
    updateRule,
    pauseRule,
    removeRule,
    matchRules,
  };
}
