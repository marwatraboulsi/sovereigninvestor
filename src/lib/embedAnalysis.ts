/**
 * embedAnalysis
 *
 * Converts a saved analysis into text chunks, embeds them with Voyage AI,
 * and stores them in Supabase so the Guide can retrieve them via RAG.
 * Called automatically whenever a user saves an analysis.
 */

import { supabase } from '@/lib/supabase';
import type { SavedAnalysis, AnalysisSlide } from '@/types';

const VOYAGE_EMBED_URL = 'https://api.voyageai.com/v1/embeddings';
const CHUNK_WORDS      = 150;
const OVERLAP_WORDS    = 20;

// ─── Slide → plain text ───────────────────────────────────────────────────────

function slideToText(slide: AnalysisSlide): string {
  const lines: string[] = [];

  if (slide.title) lines.push(slide.title);
  if (slide.subtitle) lines.push(slide.subtitle);
  if (slide.badge) lines.push(slide.badge);

  if (slide.bullets?.length) {
    lines.push(...slide.bullets.map((b) => `• ${b}`));
  }

  if (slide.metrics?.length) {
    lines.push(
      ...slide.metrics.map((m) =>
        m.note ? `${m.label}: ${m.value} (${m.note})` : `${m.label}: ${m.value}`,
      ),
    );
  }

  return lines.join('\n');
}

function analysisToText(analysis: SavedAnalysis): string {
  return analysis.slides
    .map(slideToText)
    .filter(Boolean)
    .join('\n\n');
}

// ─── Word-based chunker ───────────────────────────────────────────────────────

function chunkText(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let i = 0;

  while (i < words.length) {
    const slice = words.slice(i, i + CHUNK_WORDS).join(' ');
    if (slice.trim().length > 40) chunks.push(slice);
    if (i + CHUNK_WORDS >= words.length) break;
    i += CHUNK_WORDS - OVERLAP_WORDS;
  }

  return chunks;
}

// ─── Voyage AI embed ──────────────────────────────────────────────────────────

async function embedTexts(texts: string[]): Promise<number[][]> {
  const voyageKey = process.env.EXPO_PUBLIC_VOYAGE_API_KEY;
  if (!voyageKey) return [];

  const res = await fetch(VOYAGE_EMBED_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${voyageKey}`,
    },
    body: JSON.stringify({ model: 'voyage-3', input: texts }),
  });

  if (!res.ok) return [];
  const data = await res.json();
  return data.data.map((d: { embedding: number[] }) => d.embedding);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Embeds and stores an analysis. Called after saveAnalysisToArchive succeeds.
 * Fails silently — never blocks the save flow.
 */
export async function embedAndStoreAnalysis(analysis: SavedAnalysis): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const fullText = analysisToText(analysis);
    if (!fullText.trim()) return;

    const chunks = chunkText(fullText);
    if (!chunks.length) return;

    const embeddings = await embedTexts(chunks);
    if (!embeddings.length) return;

    // Clear any previous chunks for this analysis (in case of re-save)
    await supabase
      .from('analysis_chunks')
      .delete()
      .eq('analysis_id', analysis.id)
      .eq('user_id', user.id);

    const rows = chunks.map((content, i) => ({
      user_id:        user.id,
      analysis_id:    analysis.id,
      analysis_title: analysis.title,
      skill_name:     analysis.skillName,
      chunk_index:    i,
      content,
      embedding:      embeddings[i],
    }));

    await supabase.from('analysis_chunks').insert(rows);
  } catch { /* silent */ }
}

/**
 * Deletes all stored chunks for an analysis. Called when the user removes it.
 */
export async function deleteAnalysisChunks(analysisId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('analysis_chunks')
      .delete()
      .eq('analysis_id', analysisId)
      .eq('user_id', user.id);
  } catch { /* silent */ }
}
