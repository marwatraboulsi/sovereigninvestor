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
      decision_types:        s.decisionTypes ?? [],
      trigger_tags:          s.triggerTags ?? [],
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

/**
 * reseedPlaybook — called after redo-onboarding.
 *
 * Deletes all existing onboarding-seed rules, then inserts fresh seed rules
 * generated from the updated profile. Rules created manually or via
 * intercept-gap / learn-mode are preserved.
 */
export async function reseedPlaybook(profile: UserProfile): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Remove all existing onboarding-seed rules (soft-delete)
    const { error: deleteError } = await supabase
      .from('playbook_rules')
      .update({ status: 'removed' })
      .eq('user_id', user.id)
      .eq('source_trigger', 'onboarding-seed');

    if (deleteError) throw deleteError;

    // Insert new seed rules from updated profile
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
      decision_types:        s.decisionTypes ?? [],
      trigger_tags:          s.triggerTags ?? [],
    }));

    const { error: insertError } = await supabase
      .from('playbook_rules')
      .insert(rows);

    if (insertError) throw insertError;
    return true;
  } catch {
    return false;
  }
}
