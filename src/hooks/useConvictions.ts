/**
 * useConvictions — Phase 8A + 8B
 *
 * Full CRUD hook for the convictions table.
 * Replaces the Phase 1C stub.
 *
 * API:
 *   convictions[]         — current user's conviction records
 *   loaded                — true once the first fetch completes
 *   reload(profile?)      — fetch from DB; triggers migration if table is empty
 *                           and profile.macroConvictions is non-empty (Phase 8B)
 *   setConviction(...)    — upsert by (user_id, theme)
 *   removeConviction(id)  — hard delete
 *
 * Migration (Phase 8B):
 *   On first reload with a non-empty profile.macroConvictions, each value in
 *   that array is inserted as a Conviction with belief='yes', confidence='medium',
 *   sourceTrigger='migrated'. Subsequent reloads find the table populated and
 *   skip the migration — fully idempotent.
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  Conviction,
  ConvictionTheme,
  ConvictionBelief,
  ConvictionConfidence,
  UserProfile,
} from '@/types';

// ─── Row mapper ───────────────────────────────────────────────────────────────

function rowToConviction(row: any): Conviction {
  return {
    id:            row.id,
    userId:        row.user_id,
    theme:         row.theme         as ConvictionTheme,
    belief:        row.belief        as ConvictionBelief,
    confidence:    row.confidence    as ConvictionConfidence,
    note:          row.note          ?? undefined,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
    sourceTrigger: row.source_trigger,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useConvictions() {
  const [convictions, setConvictions] = useState<Conviction[]>([]);
  const [loaded,      setLoaded]      = useState(false);

  // ── Fetch + migrate ───────────────────────────────────────────────────────

  /**
   * Fetches convictions for the current user.
   * Pass `migrationProfile` to trigger one-time migration from the legacy
   * `profiles.macro_convictions` field when the convictions table is empty.
   */
  const reload = useCallback(async (migrationProfile?: UserProfile | null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoaded(true); return; }

      const { data, error } = await supabase
        .from('convictions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      const mapped = (data ?? []).map(rowToConviction);
      setConvictions(mapped);

      // ── Phase 8B: one-time migration ─────────────────────────────────────
      // If the convictions table is empty but the profile has legacy
      // macroConvictions[], seed the table from those values.
      if (mapped.length === 0 && (migrationProfile?.macroConvictions?.length ?? 0) > 0) {
        const now = Date.now();
        const rows = (migrationProfile!.macroConvictions ?? []).map((theme) => ({
          user_id:        user.id,
          theme,
          belief:         'yes',
          confidence:     'medium',
          note:           null,
          source_trigger: 'migrated',
          created_at:     now,
          updated_at:     now,
        }));

        const { data: inserted, error: insertError } = await supabase
          .from('convictions')
          .insert(rows)
          .select();

        if (!insertError && inserted) {
          setConvictions(inserted.map(rowToConviction));
        }
      }
    } catch {
      // fail silently — convictions stay at last known state
    } finally {
      setLoaded(true);
    }
  }, []);

  // ── Upsert ────────────────────────────────────────────────────────────────

  /**
   * Creates or updates a conviction for a given theme.
   * The unique constraint is (user_id, theme) — updating the same theme
   * overwrites the previous belief, confidence, and note.
   */
  const setConviction = useCallback(async (
    theme:         ConvictionTheme,
    belief:        ConvictionBelief,
    confidence:    ConvictionConfidence,
    note?:         string,
    sourceTrigger = 'manual',
  ): Promise<void> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = Date.now();
      const { data, error } = await supabase
        .from('convictions')
        .upsert(
          {
            user_id:        user.id,
            theme,
            belief,
            confidence,
            note:           note ?? null,
            source_trigger: sourceTrigger,
            created_at:     now,   // ignored on conflict (server preserves original)
            updated_at:     now,
          },
          { onConflict: 'user_id,theme' },
        )
        .select()
        .single();

      if (error) throw error;
      if (!data) return;

      const updated = rowToConviction(data);
      setConvictions((prev) => {
        const idx = prev.findIndex((c) => c.theme === theme);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updated;
          return next;
        }
        return [...prev, updated];
      });
    } catch {
      // silent fail
    }
  }, []);

  // ── Hard delete ───────────────────────────────────────────────────────────

  /**
   * Permanently removes a conviction record.
   * Convictions are user-owned beliefs, not audit logs — hard delete is correct.
   */
  const removeConviction = useCallback(async (id: string): Promise<void> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('convictions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id); // row-level safety

      if (error) throw error;
      setConvictions((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // silent fail
    }
  }, []);

  return { convictions, loaded, reload, setConviction, removeConviction };
}
