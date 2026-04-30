/**
 * seedPlaybookOnFirstLogin — Phase 3C
 *
 * Call this once from the Profile screen after the user's profile is loaded.
 * It checks whether the user already has any playbook rules; if not, it
 * generates and inserts the seed rules from their profile.
 *
 * Returns true if seeds were inserted, false if the user already had rules
 * or if seeding was skipped for any other reason.
 */

import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types';
import { generateSeedRules } from './generateSeedRules';

export async function seedPlaybookOnFirstLogin(
  profile: UserProfile,
): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Check existing rule count (any status — we don't re-seed if they've
    // previously removed all rules)
    const { count, error: countError } = await supabase
      .from('playbook_rules')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) throw countError;
    if ((count ?? 0) > 0) return false;   // already seeded

    const seeds = generateSeedRules(profile);
    const now   = Date.now();

    const rows = seeds.map((s) => ({
      user_id:               user.id,
      category:              s.category,
      title:                 s.title,
      body:                  s.body,
      structured_conditions: s.structuredConditions ?? null,
      source_trigger:        s.sourceTrigger,
      created_at:            now,
      status:                s.status,
      override_count:        0,
    }));

    const { error: insertError } = await supabase
      .from('playbook_rules')
      .insert(rows);

    if (insertError) throw insertError;
    return true;
  } catch {
    // Fail silently — the user can add rules manually
    return false;
  }
}
