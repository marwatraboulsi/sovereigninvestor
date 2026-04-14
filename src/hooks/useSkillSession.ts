import { useState, useCallback } from 'react';
import { Message, SkillId } from '@/types';
import { streamClaude, ClaudeAPIError } from '@/api/claudeClient';
import { getCachedEtfAnalysis, setCachedEtfAnalysis, extractTicker } from '@/cache/etfCache';

interface SessionState {
  messages: Message[];
  streamingText: string;
  isLoading: boolean;
  error: string | null;
}

const EMPTY_STATE: SessionState = {
  messages: [],
  streamingText: '',
  isLoading: false,
  error: null,
};

// ─── Module-level store ───────────────────────────────────────────────────────
// Lives outside React — survives component unmounts.
// The XHR keeps running after unmount, and callbacks write here.
// When the component remounts, useState initialises from here.

const skillSessions = new Map<SkillId, SessionState>();

function getSession(skill: SkillId): SessionState {
  return skillSessions.get(skill) ?? EMPTY_STATE;
}

function setSession(skill: SkillId, updater: (s: SessionState) => SessionState): SessionState {
  const next = updater(getSession(skill));
  skillSessions.set(skill, next);
  return next;
}

// ─────────────────────────────────────────────────────────────────────────────

export function useSkillSession(skill: SkillId) {
  // Initialise from module store so navigating back restores the session
  const [state, setStateInternal] = useState<SessionState>(() => getSession(skill));

  // Wrapper that syncs both React state and the module store
  const setState = useCallback(
    (updater: (s: SessionState) => SessionState) => {
      setStateInternal((current) => {
        const next = updater(current);
        skillSessions.set(skill, next);
        return next;
      });
    },
    [skill],
  );

  const sendMessage = useCallback(
    (userText: string) => {
      if (!userText.trim() || getSession(skill).isLoading) return;

      const userMessage: Message = { role: 'user', content: userText.trim() };
      const updatedMessages: Message[] = [...getSession(skill).messages, userMessage];

      setState(() => ({
        messages: updatedMessages,
        streamingText: '',
        isLoading: true,
        error: null,
      }));

      const timeoutMs = skill === 'stock-researcher' ? 600_000 : 300_000;

      // Check ETF cache first
      if (skill === 'etf-analyzer') {
        const ticker = extractTicker(userText);
        if (ticker) {
          getCachedEtfAnalysis(ticker).then((cached) => {
            if (cached) {
              setState(() => ({
                messages: [...updatedMessages, { role: 'assistant', content: cached }],
                streamingText: '',
                isLoading: false,
                error: null,
              }));
              return;
            }
            startStream(updatedMessages, timeoutMs, ticker);
          });
          return;
        }
      }

      startStream(updatedMessages, timeoutMs, null);

      function startStream(msgs: Message[], timeout: number, etfTicker: string | null) {
        streamClaude(
          { skill, messages: msgs, timeoutMs: timeout },
          {
            onChunk: (text) => {
              // Write directly to module store (works even when component is unmounted)
              const next = setSession(skill, (s) => ({ ...s, streamingText: s.streamingText + text }));
              setStateInternal(next);
            },
            onDone: (content) => {
              if (etfTicker && content.length > 100) {
                setCachedEtfAnalysis(etfTicker, content).catch(() => {});
              }
              const next = setSession(skill, () => ({
                messages: [...msgs, { role: 'assistant', content }],
                streamingText: '',
                isLoading: false,
                error: null,
              }));
              setStateInternal(next);
            },
            onError: (err) => {
              let errorMessage = 'Something went wrong. Please try again.';
              if (err instanceof ClaudeAPIError) {
                if (err.isAuthError) {
                  errorMessage = 'API key issue. Please check your .env file.';
                } else if (err.isRateLimit) {
                  errorMessage = 'Too many requests. Please wait a moment and try again.';
                } else {
                  errorMessage = `Analysis failed (error ${err.status}). Please try again.`;
                }
              } else if (err instanceof Error) {
                errorMessage = err.message;
              }
              const next = setSession(skill, (s) => ({
                ...s,
                streamingText: '',
                isLoading: false,
                error: errorMessage,
              }));
              setStateInternal(next);
            },
          },
        );
      }
    },
    [skill, setState],
  );

  const clearSession = useCallback(() => {
    skillSessions.delete(skill);
    setStateInternal(EMPTY_STATE);
  }, [skill]);

  const dismissError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, [setState]);

  return {
    messages: state.messages,
    streamingText: state.streamingText,
    isLoading: state.isLoading,
    error: state.error,
    sendMessage,
    clearSession,
    dismissError,
  };
}
