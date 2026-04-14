/**
 * useConversation
 *
 * Manages persistent chat history via Supabase.
 * - Loads the most recent (or a specific) conversation on mount
 * - Saves each message as it happens
 * - Auto-titles each conversation from the first user message
 * - Exposes standalone helpers for listing and deleting conversations
 */

import { useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Message } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConversationSummary {
  id: string;
  title: string | null;
  updatedAt: string;
}

// ─── Module-level: cross-component conversation switching ─────────────────────

let _pendingConversationId: string | null = null;

export function requestConversationLoad(id: string): void {
  _pendingConversationId = id;
}

export function consumePendingConversation(): string | null {
  const id = _pendingConversationId;
  _pendingConversationId = null;
  return id;
}

// ─── Standalone helpers ───────────────────────────────────────────────────────

export async function listConversations(): Promise<ConversationSummary[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data } = await supabase
      .from('conversations')
      .select('id, title, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(100);

    return (data ?? []).map((r) => ({
      id:        r.id,
      title:     r.title ?? null,
      updatedAt: r.updated_at,
    }));
  } catch {
    return [];
  }
}

export async function deleteConversation(id: string): Promise<void> {
  try {
    // Messages cascade automatically via FK ON DELETE CASCADE
    await supabase.from('conversations').delete().eq('id', id);
  } catch { /* silent */ }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useConversation() {
  const convIdRef = useRef<string | null>(null);

  // ── Load the most recent conversation (or create one) ──────────────────────

  async function loadConversation(): Promise<Message[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: convs } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      let convId: string;

      if (convs && convs.length > 0) {
        convId = convs[0].id;
      } else {
        const { data: newConv, error } = await supabase
          .from('conversations')
          .insert({ user_id: user.id })
          .select('id')
          .single();
        if (error || !newConv) return [];
        convId = newConv.id;
      }

      convIdRef.current = convId;
      return await fetchMessages(convId);
    } catch {
      return [];
    }
  }

  // ── Load a specific conversation by ID ─────────────────────────────────────

  async function loadConversationById(id: string): Promise<Message[]> {
    try {
      convIdRef.current = id;
      // Touch updated_at so it sorts to top next time
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', id);
      return await fetchMessages(id);
    } catch {
      return [];
    }
  }

  // ── Start a fresh conversation ─────────────────────────────────────────────

  async function startNewConversation(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('conversations')
        .insert({ user_id: user.id })
        .select('id')
        .single();

      if (!error && data) {
        convIdRef.current = data.id;
      }
    } catch { /* silent */ }
  }

  // ── Save a single message ──────────────────────────────────────────────────

  async function saveMessage(message: Message): Promise<void> {
    const convId = convIdRef.current;
    if (!convId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Insert message + bump updated_at in parallel
      const ops: Promise<any>[] = [
        supabase.from('messages').insert({
          conversation_id: convId,
          user_id:         user.id,
          role:            message.role,
          content:         message.content,
          suggestions:     message.suggestions ?? null,
        }),
        supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', convId),
      ];

      // Auto-title: set from first user message if title is still null
      if (message.role === 'user') {
        const truncated = message.content.slice(0, 60) + (message.content.length > 60 ? '…' : '');
        ops.push(
          supabase
            .from('conversations')
            .update({ title: truncated })
            .eq('id', convId)
            .is('title', null),
        );
      }

      await Promise.all(ops);
    } catch { /* silent */ }
  }

  return { loadConversation, loadConversationById, startNewConversation, saveMessage };
}

// ─── Internal helper ──────────────────────────────────────────────────────────

async function fetchMessages(convId: string): Promise<Message[]> {
  const { data } = await supabase
    .from('messages')
    .select('role, content, suggestions')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: true })
    .limit(200);

  return (data ?? []).map((r) => ({
    role:        r.role as 'user' | 'assistant',
    content:     r.content,
    suggestions: r.suggestions ?? undefined,
  }));
}
