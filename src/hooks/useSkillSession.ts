import { useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Message, SkillId } from '@/types';
import { streamClaude, ClaudeAPIError, loadFundManagerContext } from '@/api/claudeClient';
import { getCachedEtfAnalysis, setCachedEtfAnalysis, extractTicker } from '@/cache/etfCache';

interface SessionState {
  messages: Message[];
  streamingText: string;
  isLoading: boolean;
  error: string | null;
  startedAt: number | null; // timestamp when the current analysis began
}

const EMPTY_STATE: SessionState = {
  messages: [],
  streamingText: '',
  isLoading: false,
  error: null,
  startedAt: null,
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

// ─── AsyncStorage persistence ─────────────────────────────────────────────────

function storageKey(skill: SkillId): string {
  return `SKILL_SESSION_${skill.toUpperCase()}`;
}

async function persistMessages(skill: SkillId, messages: Message[]): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(skill), JSON.stringify(messages));
  } catch { /* silent */ }
}

async function loadPersistedMessages(skill: SkillId): Promise<Message[] | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(skill));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Message[];
    return null;
  } catch {
    return null;
  }
}

async function clearPersistedMessages(skill: SkillId): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey(skill));
  } catch { /* silent */ }
}

// ─────────────────────────────────────────────────────────────────────────────

export function useSkillSession(skill: SkillId) {
  // Initialise from module store so navigating back restores the session
  const [state, setStateInternal] = useState<SessionState>(() => getSession(skill));

  // Holds the abort function for any in-flight XHR so we can cancel it cleanly
  const abortRef = useRef<(() => void) | null>(null);

  // On mount, if the module store has no messages, try to restore from AsyncStorage
  const hasLoadedFromStorage = useRef(false);
  if (!hasLoadedFromStorage.current) {
    hasLoadedFromStorage.current = true;
    if (getSession(skill).messages.length === 0) {
      // Load async — don't block the initial render
      loadPersistedMessages(skill).then((msgs) => {
        if (msgs && msgs.length > 0 && getSession(skill).messages.length === 0) {
          const restored: SessionState = { ...EMPTY_STATE, messages: msgs };
          skillSessions.set(skill, restored);
          setStateInternal(restored);
        }
      });
    }
  }

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
        startedAt: Date.now(),
      }));

      const timeoutMs = skill === 'stock-researcher' ? 600_000 : 300_000;

      // Check ETF cache first
      if (skill === 'etf-analyzer') {
        const ticker = extractTicker(userText);
        if (ticker) {
          getCachedEtfAnalysis(ticker).then((cached) => {
            if (cached) {
              const next: SessionState = {
                messages: [...updatedMessages, { role: 'assistant', content: cached }],
                streamingText: '',
                isLoading: false,
                error: null,
              };
              skillSessions.set(skill, next);
              setStateInternal(next);
              persistMessages(skill, next.messages);
              return;
            }
            startStream(updatedMessages, timeoutMs, ticker);
          });
          return;
        }
      }

      startStream(updatedMessages, timeoutMs, null);

      function startStream(msgs: Message[], timeout: number, etfTicker: string | null, retries = 0) {
        // Cancel any previous in-flight request before starting a new one
        abortRef.current?.();

        // For portfolio-reviewer on the first message, load profile context
        const contextPromise =
          skill === 'portfolio-reviewer' && msgs.length === 1
            ? loadFundManagerContext()
            : Promise.resolve(undefined);

        contextPromise.then((fundManagerContext) => {
          const abort = streamClaude(
            { skill, messages: msgs, timeoutMs: timeout, fundManagerContext },
            {
              onChunk: (text) => {
                // Write directly to module store (works even when component is unmounted)
                const next = setSession(skill, (s) => ({ ...s, streamingText: s.streamingText + text }));
                setStateInternal(next);
              },
              onDone: (content) => {
                abortRef.current = null;
                if (etfTicker && content.length > 100) {
                  setCachedEtfAnalysis(etfTicker, content).catch(() => {});
                }
                const next = setSession(skill, () => ({
                  messages: [...msgs, { role: 'assistant', content }],
                  streamingText: '',
                  isLoading: false,
                  error: null,
                  startedAt: null,
                }));
                setStateInternal(next);
                // Persist messages after a successful response
                persistMessages(skill, next.messages);
              },
              onError: (err) => {
                abortRef.current = null;

                // ── Retry logic for network errors ────────────────────────
                const isNetworkError =
                  err instanceof Error && (
                    err.message.includes('Network error') ||
                    err.message.includes('Connection lost')
                  );

                if (isNetworkError && retries < 2) {
                  // Show a retrying message and try again after 2 seconds
                  const next = setSession(skill, (s) => ({
                    ...s,
                    error: 'Connection interrupted. Retrying…',
                  }));
                  setStateInternal(next);
                  setTimeout(() => {
                    startStream(msgs, timeout, etfTicker, retries + 1);
                  }, 2000);
                  return;
                }

                // Final error after all retries exhausted (or non-retryable error)
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

          abortRef.current = abort;
        });
      }
    },
    [skill, setState],
  );

  const clearSession = useCallback(() => {
    // Cancel any in-flight request so stale callbacks don't overwrite the cleared state
    abortRef.current?.();
    abortRef.current = null;
    skillSessions.delete(skill);
    setStateInternal(EMPTY_STATE);
    clearPersistedMessages(skill);
  }, [skill]);

  const dismissError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, [setState]);

  return {
    messages: state.messages,
    streamingText: state.streamingText,
    isLoading: state.isLoading,
    error: state.error,
    startedAt: state.startedAt,
    sendMessage,
    clearSession,
    dismissError,
  };
}
