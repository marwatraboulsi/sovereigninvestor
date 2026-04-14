import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { embedAndStoreAnalysis, deleteAnalysisChunks } from '@/lib/embedAnalysis';
import type { SavedAnalysis, SkillId, AnalysisSlide } from '@/types';

const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;

function rowToAnalysis(row: any): SavedAnalysis {
  const createdAt = new Date(row.created_at).getTime();
  return {
    id:         row.id,
    skillId:    row.skill_id,
    skillName:  row.skill_name,
    title:      row.title,
    createdAt,
    expiresAt:  createdAt + THREE_MONTHS_MS,
    slideCount: Array.isArray(row.slides) ? row.slides.length : 0,
    slides:     row.slides ?? [],
  };
}

export async function saveAnalysisToArchive(payload: {
  skillId: SkillId;
  skillName: string;
  title: string;
  slides: AnalysisSlide[];
}): Promise<SavedAnalysis | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('archive_analyses')
    .insert({
      user_id:    user.id,
      skill_id:   payload.skillId,
      skill_name: payload.skillName,
      title:      payload.title,
      slides:     payload.slides,
    })
    .select()
    .single();

  if (error || !data) return null;
  const analysis = rowToAnalysis(data);

  // Embed in the background — never blocks the save
  embedAndStoreAnalysis(analysis);

  return analysis;
}

export async function getAnalysisById(id: string): Promise<SavedAnalysis | null> {
  const { data, error } = await supabase
    .from('archive_analyses')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return rowToAnalysis(data);
}

export function useAnalysisArchive() {
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [loaded, setLoaded]     = useState(false);

  const reload = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoaded(true); return; }

    const cutoff = new Date(Date.now() - THREE_MONTHS_MS).toISOString();

    // Find expired analyses so we can clean up their chunks too
    const { data: expired } = await supabase
      .from('archive_analyses')
      .select('id')
      .eq('user_id', user.id)
      .lt('created_at', cutoff);

    if (expired?.length) {
      const expiredIds = expired.map((r: any) => r.id);
      await Promise.all([
        supabase.from('archive_analyses').delete().in('id', expiredIds),
        supabase.from('analysis_chunks').delete().in('analysis_id', expiredIds),
      ]);
    }

    // Now load what remains
    const { data } = await supabase
      .from('archive_analyses')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false });

    setAnalyses((data ?? []).map(rowToAnalysis));
    setLoaded(true);
  }, []);

  const remove = useCallback(async (id: string) => {
    setAnalyses((prev) => prev.filter((a) => a.id !== id));
    await Promise.all([
      supabase.from('archive_analyses').delete().eq('id', id),
      deleteAnalysisChunks(id),
    ]);
  }, []);

  return { analyses, loaded, reload, remove };
}
