import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types';

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        setProfile({
          knowledgeLevel:   data.knowledge_level,
          investmentStatus: data.investment_status,
          primaryGoal:      data.primary_goal,
          responseStyle:    data.response_style,
          ageRange:         data.age_range       ?? undefined,
          riskTolerance:    data.risk_tolerance   ?? undefined,
          worldview:        data.worldview        ?? undefined,
          macroConvictions: data.macro_convictions ?? [],
          worldviewNote:    data.worldview_note   ?? undefined,
          onboardingComplete: data.onboarding_complete ?? false,
        });
      }
    } catch {
      // treat as no profile
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile(newProfile: UserProfile) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('profiles').upsert({
        id:                  user.id,
        knowledge_level:     newProfile.knowledgeLevel,
        investment_status:   newProfile.investmentStatus,
        primary_goal:        newProfile.primaryGoal,
        response_style:      newProfile.responseStyle,
        age_range:           newProfile.ageRange       ?? null,
        risk_tolerance:      newProfile.riskTolerance  ?? null,
        worldview:           newProfile.worldview      ?? null,
        macro_convictions:   newProfile.macroConvictions ?? [],
        worldview_note:      newProfile.worldviewNote  ?? null,
        onboarding_complete: newProfile.onboardingComplete,
      });

      setProfile(newProfile);
    } catch {
      // silently fail
    }
  }

  async function clearProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('profiles').delete().eq('id', user.id);
      setProfile(null);
    } catch {}
  }

  return { profile, loading, saveProfile, clearProfile };
}
