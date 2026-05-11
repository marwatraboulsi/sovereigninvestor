import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Message, SkillId } from '@/types';

const STORAGE_KEY = 'RESEARCH_HISTORY_V1';
const MAX_ENTRIES = 50;

export interface ResearchHistoryEntry {
  id: string;
  skillId: SkillId;
  title: string;
  subtitle: string;
  isComparison: boolean;
  depth: 'quick' | 'standard';
  date: number;
  messages: Message[];
}

// ─── Title extraction ─────────────────────────────────────────────────────────

export function extractHistoryTitle(
  messages: Message[],
  skillId: SkillId,
): { title: string; subtitle: string; isComparison: boolean } {
  const first = messages[0]?.content ?? '';

  // Stock researcher — comparison
  const compareMatch = first.match(/^Compare (\w+)\s*\(([^)]+)\)\s*vs\s*(\w+)\s*\(([^)]+)\)/i);
  if (compareMatch) {
    return {
      title: `${compareMatch[1]} vs ${compareMatch[3]}`,
      subtitle: `${compareMatch[2]} vs ${compareMatch[4]}`,
      isComparison: true,
    };
  }

  // Stock researcher — individual
  const researchMatch = first.match(/^Research (\w+)\s*\(([^)]+)\)/i);
  if (researchMatch) {
    return { title: researchMatch[1], subtitle: researchMatch[2], isComparison: false };
  }

  // ETF analyzer — try to pull a ticker from the message
  if (skillId === 'etf-analyzer') {
    const tickerMatch = first.match(/\b([A-Z]{2,5})\b/);
    const ticker = tickerMatch?.[1];
    return {
      title: ticker ?? (first.slice(0, 30).trim() || 'ETF Analysis'),
      subtitle: ticker ? first.slice(0, 60).trim() : '',
      isComparison: false,
    };
  }

  // Portfolio reviewer — message is a large portfolio dump; use a fixed label
  if (skillId === 'portfolio-reviewer') {
    return { title: 'Portfolio Review', subtitle: '', isComparison: false };
  }

  // Market catalyst scanner — use the first line of the query
  const firstLine = first.split('\n')[0].trim();
  const truncated = firstLine.length > 50 ? firstLine.slice(0, 50) + '…' : firstLine;
  return { title: truncated || 'Session', subtitle: '', isComparison: false };
}

function extractDepth(messages: Message[]): 'quick' | 'standard' {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUser) return 'standard';
  const match = lastUser.content.match(/Research depth:\s*(.+)/i);
  if (!match) return 'standard';
  return match[1].trim().toLowerCase().includes('quick') ? 'quick' : 'standard';
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

async function loadAll(): Promise<ResearchHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveAll(entries: ResearchHistoryEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch { /* silent */ }
}

// ─── Public archive function (called from useSkillSession) ────────────────────

export async function archiveResearchSession(messages: Message[], skillId: SkillId): Promise<void> {
  if (messages.length < 3) return;

  const { title, subtitle, isComparison } = extractHistoryTitle(messages, skillId);
  const depth = extractDepth(messages);

  const entry: ResearchHistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    skillId,
    title,
    subtitle,
    isComparison,
    depth,
    date: Date.now(),
    messages,
  };

  const existing = await loadAll();
  const recent = existing[0];
  if (recent && recent.title === title && recent.skillId === skillId && Date.now() - recent.date < 60_000) return;

  const updated = [entry, ...existing].slice(0, MAX_ENTRIES);
  await saveAll(updated);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useResearchHistory(filterSkillId?: SkillId) {
  const [entries, setEntries] = useState<ResearchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const all = await loadAll();
    setEntries(filterSkillId ? all.filter((e) => e.skillId === filterSkillId) : all);
    setLoading(false);
  }, [filterSkillId]);

  useEffect(() => { refresh(); }, [refresh]);

  const deleteEntry = useCallback(async (id: string) => {
    const all = await loadAll();
    const updated = all.filter((e) => e.id !== id);
    await saveAll(updated);
    setEntries(filterSkillId ? updated.filter((e) => e.skillId === filterSkillId) : updated);
  }, [filterSkillId]);

  const clearAll = useCallback(async () => {
    if (filterSkillId) {
      const all = await loadAll();
      const updated = all.filter((e) => e.skillId !== filterSkillId);
      await saveAll(updated);
      setEntries([]);
    } else {
      await saveAll([]);
      setEntries([]);
    }
  }, [filterSkillId]);

  return { entries, loading, refresh, deleteEntry, clearAll };
}
