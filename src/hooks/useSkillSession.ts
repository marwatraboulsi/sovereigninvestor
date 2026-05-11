import { useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Message, SkillId } from '@/types';
import { streamClaude, ClaudeAPIError, loadFundManagerContext } from '@/api/claudeClient';
import { archiveResearchSession } from '@/hooks/useResearchHistory';
import { getCachedEtfAnalysis, setCachedEtfAnalysis, extractTicker } from '@/cache/etfCache';
import {
  STOCK_RESEARCHER_FOLLOWUP_PROMPT,
  STOCK_RESEARCHER_PHASE_PROMPT_1,
  STOCK_RESEARCHER_PHASE_PROMPT_2,
  STOCK_RESEARCHER_PHASE_PROMPT_3,
  STOCK_RESEARCHER_PHASE_PROMPT_4,
  STOCK_RESEARCHER_PHASE_PROMPT_5,
  STOCK_RESEARCHER_PHASE_PROMPT_6,
  STOCK_RESEARCHER_PHASE_PROMPT_7,
  STOCK_RESEARCHER_PHASE_PROMPT_8,
  STOCK_COMPARISON_PHASE_PROMPT_1,
  STOCK_COMPARISON_PHASE_PROMPT_2,
  STOCK_COMPARISON_PHASE_PROMPT_3,
  STOCK_COMPARISON_PHASE_PROMPT_4,
  STOCK_COMPARISON_PHASE_PROMPT_5,
  STOCK_COMPARISON_PHASE_PROMPT_6,
  STOCK_COMPARISON_PHASE_PROMPT_7,
  STOCK_COMPARISON_PHASE_PROMPT_8,
  QUICK_SCAN_INSTRUCTION,
} from '@/skills/stockResearcher';

interface SessionState {
  messages: Message[];
  streamingText: string;
  isLoading: boolean;
  error: string | null;
  startedAt: number | null;
  phaseLabel: string | null;
}

const EMPTY_STATE: SessionState = {
  messages: [],
  streamingText: '',
  isLoading: false,
  error: null,
  startedAt: null,
  phaseLabel: null,
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

// ─── Setter registry ──────────────────────────────────────────────────────────
// Tracks the latest React setState for each skill so callbacks always reach
// the currently mounted component, even after navigation away and back.

const skillSetters = new Map<SkillId, (s: SessionState) => void>();

// ─── Completion emitter ───────────────────────────────────────────────────────

type CompletionListener = (skillId: SkillId) => void;
const completionListeners = new Set<CompletionListener>();

export function subscribeToSkillCompletion(listener: CompletionListener): () => void {
  completionListeners.add(listener);
  return () => completionListeners.delete(listener);
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

// ─── Research depth extraction ────────────────────────────────────────────────
// Reads the user's answer message (last user message in initialMsgs) for the
// "Research depth:" field set by the native questions form.

function extractResearchDepth(msgs: Message[]): 'quick' | 'standard' {
  const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
  if (!lastUser) return 'standard';
  const match = lastUser.content.match(/Research depth:\s*(.+)/i);
  if (!match) return 'standard';
  return match[1].trim().toLowerCase().includes('quick') ? 'quick' : 'standard';
}

// ─── Follow-up mode detection ─────────────────────────────────────────────────
// Returns true when the initial analysis is complete and the user is asking
// a follow-up question. In this state we swap in a conversational system prompt
// instead of the full structured-analysis prompt.

const FOLLOWUP_PROMPT_GENERIC = `You are a financial research assistant for Sovereign Investor. The initial analysis has been completed and the user is asking follow-up questions. Answer conversationally and educationally — clarifying findings, explaining concepts, or going deeper on specific points. Do not re-run the analysis framework; respond naturally as a knowledgeable analyst continuing the discussion.`;

function isFollowUpMode(msgs: Message[]): boolean {
  // Need at least one non-synthetic assistant message (i.e. a completed analysis)
  const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant');
  if (!lastAssistant) return false;
  return !lastAssistant.content.includes('<<PICK:') && lastAssistant.content.length > 200;
}

// ─── Stage 2 trigger detection ────────────────────────────────────────────────

function isStage2Trigger(skill: SkillId, msgs: Message[]): boolean {
  if (skill !== 'stock-researcher') return false;
  const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant');
  return (lastAssistant?.content.includes('<<PICK:') ?? false);
}

// ─────────────────────────────────────────────────────────────────────────────

export function useSkillSession(skill: SkillId) {
  const [state, setStateInternal] = useState<SessionState>(() => getSession(skill));

  // Always register the latest setter so module-level callbacks reach the current component
  skillSetters.set(skill, setStateInternal);

  const abortRef = useRef<(() => void) | null>(null);
  const phasedAbortedRef = useRef(false);

  const hasLoadedFromStorage = useRef(false);
  if (!hasLoadedFromStorage.current) {
    hasLoadedFromStorage.current = true;
    if (getSession(skill).messages.length === 0) {
      loadPersistedMessages(skill).then((msgs) => {
        if (msgs && msgs.length > 0 && getSession(skill).messages.length === 0) {
          const restored: SessionState = { ...EMPTY_STATE, messages: msgs };
          skillSessions.set(skill, restored);
          skillSetters.get(skill)?.(restored);
        }
      });
    }
  }

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
        phaseLabel: null,
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
                startedAt: null,
                phaseLabel: null,
              };
              skillSessions.set(skill, next);
              skillSetters.get(skill)?.(next);
              persistMessages(skill, next.messages);
              return;
            }
            startStream(updatedMessages, timeoutMs, ticker);
          });
          return;
        }
      }

      // Phased analysis for stock-researcher Stage 2
      if (isStage2Trigger(skill, updatedMessages)) {
        phasedAbortedRef.current = false;
        runPhasedAnalysis(updatedMessages, timeoutMs);
        return;
      }

      startStream(updatedMessages, timeoutMs, null);

      // ── Single-stream path ────────────────────────────────────────────────

      function startStream(msgs: Message[], timeout: number, etfTicker: string | null, retries = 0) {
        abortRef.current?.();

        const followUp = isFollowUpMode(msgs);
        const followUpPrompt = skill === 'stock-researcher'
          ? STOCK_RESEARCHER_FOLLOWUP_PROMPT
          : FOLLOWUP_PROMPT_GENERIC;

        const contextPromise =
          skill === 'portfolio-reviewer' && msgs.length === 1
            ? loadFundManagerContext()
            : Promise.resolve(undefined);

        contextPromise.then((fundManagerContext) => {
          const abort = streamClaude(
            {
              skill,
              messages: msgs,
              timeoutMs: timeout,
              fundManagerContext,
              ...(followUp ? { systemPromptOverride: followUpPrompt } : {}),
            },
            {
              onChunk: (text) => {
                const next = setSession(skill, (s) => ({ ...s, streamingText: s.streamingText + text }));
                skillSetters.get(skill)?.(next);
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
                  phaseLabel: null,
                }));
                skillSetters.get(skill)?.(next);
                persistMessages(skill, next.messages);
                completionListeners.forEach((l) => l(skill));
              },
              onError: (err) => {
                abortRef.current = null;

                const isNetworkError =
                  err instanceof Error && (
                    err.message.includes('Network error') ||
                    err.message.includes('Connection lost')
                  );

                const currentStreamingText = getSession(skill).streamingText;
                if (isNetworkError && currentStreamingText.length > 800) {
                  const next = setSession(skill, (s) => ({
                    messages: [...msgs, { role: 'assistant', content: s.streamingText }],
                    streamingText: '',
                    isLoading: false,
                    error: null,
                    startedAt: null,
                    phaseLabel: null,
                  }));
                  skillSetters.get(skill)?.(next);
                  persistMessages(skill, next.messages);
                  return;
                }

                if (isNetworkError && retries < 3) {
                  const delayMs = retries === 0 ? 2000 : 5000;
                  const next = setSession(skill, (s) => ({
                    ...s,
                    error: 'Connection interrupted. Retrying…',
                  }));
                  skillSetters.get(skill)?.(next);
                  setTimeout(() => startStream(msgs, timeout, etfTicker, retries + 1), delayMs);
                  return;
                }

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
                  startedAt: null,
                  phaseLabel: null,
                }));
                skillSetters.get(skill)?.(next);
              },
            },
          );

          abortRef.current = abort;
        });
      }

      // ── Phased analysis orchestrator (stock-researcher Stage 2) ─────────────

      function runPhasedAnalysis(initialMsgs: Message[], timeout: number) {
        const depth = extractResearchDepth(initialMsgs);
        const depthPrefix = depth === 'quick' ? QUICK_SCAN_INSTRUCTION + '\n\n' : '';
        const isComparison = initialMsgs[0]?.content.startsWith('Compare ') &&
          initialMsgs[0]?.content.includes(' vs ');

        // maxWebSearches per phase:
        //   quick    — 0 for all phases (no live data lookups, fast completion)
        //   standard — current baseline (comparison gets slightly more for the extra ticker)
        const maxSearches: Record<typeof depth, number[]> = {
          quick:    [0, 0, 0, 0, 0, 0, 0, 0],
          standard: isComparison ? [2, 1, 2, 2, 1, 1, 2, 0] : [1, 1, 1, 2, 1, 1, 2, 0],
        };

        const phasePrompts = isComparison
          ? [
              STOCK_COMPARISON_PHASE_PROMPT_1,
              STOCK_COMPARISON_PHASE_PROMPT_2,
              STOCK_COMPARISON_PHASE_PROMPT_3,
              STOCK_COMPARISON_PHASE_PROMPT_4,
              STOCK_COMPARISON_PHASE_PROMPT_5,
              STOCK_COMPARISON_PHASE_PROMPT_6,
              STOCK_COMPARISON_PHASE_PROMPT_7,
              STOCK_COMPARISON_PHASE_PROMPT_8,
            ]
          : [
              STOCK_RESEARCHER_PHASE_PROMPT_1,
              STOCK_RESEARCHER_PHASE_PROMPT_2,
              STOCK_RESEARCHER_PHASE_PROMPT_3,
              STOCK_RESEARCHER_PHASE_PROMPT_4,
              STOCK_RESEARCHER_PHASE_PROMPT_5,
              STOCK_RESEARCHER_PHASE_PROMPT_6,
              STOCK_RESEARCHER_PHASE_PROMPT_7,
              STOCK_RESEARCHER_PHASE_PROMPT_8,
            ];

        const phaseLabels = isComparison
          ? [
              'Phase 1 / 8 — Business Foundation',
              'Phase 2 / 8 — Industry & Competitive Landscape',
              'Phase 3 / 8 — Business Breakdown',
              'Phase 4 / 8 — Financial Quality',
              'Phase 5 / 8 — Governance & Management',
              'Phase 6 / 8 — Market Sentiment',
              'Phase 7 / 8 — Valuation & Moat',
              'Phase 8 / 8 — Final Synthesis',
            ]
          : [
              'Phase 1 / 8 — Business Foundation',
              'Phase 2 / 8 — Industry Analysis',
              'Phase 3 / 8 — Business Breakdown',
              'Phase 4 / 8 — Financial Quality',
              'Phase 5 / 8 — Governance & Management',
              'Phase 6 / 8 — Market Sentiment',
              'Phase 7 / 8 — Valuation & Moat',
              'Phase 8 / 8 — Final Synthesis',
            ];

        const continuationMsgs = [
          null,
          `Continue with phase 2: ${phaseLabels[1].split('— ')[1]}.`,
          `Continue with phase 3: ${phaseLabels[2].split('— ')[1]}.`,
          `Continue with phase 4: ${phaseLabels[3].split('— ')[1]}.`,
          `Continue with phase 5: ${phaseLabels[4].split('— ')[1]}.`,
          `Continue with phase 6: ${phaseLabels[5].split('— ')[1]}.`,
          `Continue with phase 7: ${phaseLabels[6].split('— ')[1]}.`,
          'Complete with phase 8: Final Synthesis and Learning Checkpoint.',
        ];

        const PHASE_CONFIGS = phasePrompts.map((prompt, i) => ({
          label: phaseLabels[i],
          systemPrompt: depthPrefix + prompt,
          continuationMsg: continuationMsgs[i] as string | null,
          maxWebSearches: maxSearches[depth][i],
        }));

        const phaseOutputs: string[] = [];
        let fullAccumulated = '';

        // onChunkCb: called for each streamed token (current phase only)
        // onResetCb: called when a retry clears the in-progress phase text
        function runPhaseWithRetry(
          msgs: Message[],
          systemPrompt: string,
          maxWebSearches: number,
          onChunkCb: (text: string) => void,
          onResetCb: () => void,
          retries = 0,
        ): Promise<string> {
          return new Promise<string>((resolve, reject) => {
            const abort = streamClaude(
              { skill, messages: msgs, timeoutMs: timeout, systemPromptOverride: systemPrompt, maxWebSearches },
              {
                onChunk: (text) => {
                  if (phasedAbortedRef.current) return;
                  onChunkCb(text);
                },
                onDone: (content) => {
                  abortRef.current = null;
                  resolve(content);
                },
                onError: (err) => {
                  abortRef.current = null;
                  if (phasedAbortedRef.current) { reject(new Error('Aborted')); return; }

                  const isNetworkError =
                    err instanceof Error && (
                      err.message.includes('Network error') ||
                      err.message.includes('Connection lost')
                    );

                  if (isNetworkError && retries < 3) {
                    const delayMs = retries === 0 ? 2000 : 5000;
                    onResetCb();
                    const next = setSession(skill, (s) => ({
                      ...s,
                      streamingText: '',
                      error: 'Connection interrupted. Retrying…',
                    }));
                    skillSetters.get(skill)?.(next);
                    setTimeout(() => {
                      runPhaseWithRetry(msgs, systemPrompt, maxWebSearches, onChunkCb, onResetCb, retries + 1)
                        .then(resolve)
                        .catch(reject);
                    }, delayMs);
                    return;
                  }

                  reject(err);
                },
              },
            );
            abortRef.current = abort;
          });
        }

        function handlePhasedError(err: unknown) {
          if (fullAccumulated.length > 800) {
            const next = setSession(skill, () => ({
              messages: [...initialMsgs, { role: 'assistant', content: fullAccumulated }],
              streamingText: '',
              isLoading: false,
              error: null,
              startedAt: null,
              phaseLabel: null,
            }));
            skillSetters.get(skill)?.(next);
            persistMessages(skill, next.messages);
          } else {
            let errorMessage = 'Something went wrong. Please try again.';
            if (err instanceof ClaudeAPIError) {
              if (err.isAuthError) errorMessage = 'API key issue. Please check your .env file.';
              else if (err.isRateLimit) errorMessage = 'Too many requests. Please wait a moment and try again.';
              else errorMessage = `Analysis failed (error ${(err as ClaudeAPIError).status}). Please try again.`;
            } else if (err instanceof Error) {
              errorMessage = err.message;
            }
            const next = setSession(skill, (s) => ({
              ...s,
              streamingText: '',
              isLoading: false,
              error: errorMessage,
              startedAt: null,
              phaseLabel: null,
            }));
            skillSetters.get(skill)?.(next);
          }
        }

        async function runAllPhases() {
          // currentPhaseText tracks only the current phase's streaming output.
          // We never put all accumulated phases into streamingText — that string
          // grows to 50KB+ by phase 6 and causes iOS to kill the app from
          // rendering pressure when updated on every chunk.
          let currentPhaseText = '';

          // Throttled render: update streamingText at most 10× per second.
          // Each update is just the current phase's text (~2–4 KB max), not
          // the full accumulated output from all previous phases.
          const renderInterval = setInterval(() => {
            if (phasedAbortedRef.current) { clearInterval(renderInterval); return; }
            const next = setSession(skill, (s) => ({ ...s, streamingText: currentPhaseText }));
            skillSetters.get(skill)?.(next);
          }, 100);

          try {
            for (let i = 0; i < PHASE_CONFIGS.length; i++) {
              if (phasedAbortedRef.current) return;

              const config = PHASE_CONFIGS[i];
              currentPhaseText = '';

              const labelNext = setSession(skill, (s) => ({
                ...s,
                phaseLabel: config.label,
                error: null,
                streamingText: '',
              }));
              skillSetters.get(skill)?.(labelNext);

              const phaseMessages: Message[] = [...initialMsgs];
              for (let j = 0; j < phaseOutputs.length; j++) {
                phaseMessages.push({ role: 'assistant', content: phaseOutputs[j] });
                phaseMessages.push({ role: 'user', content: PHASE_CONFIGS[j + 1].continuationMsg! });
              }

              let phaseText: string;
              try {
                phaseText = await runPhaseWithRetry(
                  phaseMessages,
                  config.systemPrompt,
                  config.maxWebSearches,
                  (text) => { currentPhaseText += text; },
                  () => { currentPhaseText = ''; },
                );
              } catch (err) {
                if (phasedAbortedRef.current) return;
                fullAccumulated = [...phaseOutputs, currentPhaseText].filter(Boolean).join('\n\n');
                handlePhasedError(err);
                return;
              }

              phaseOutputs.push(phaseText);
              fullAccumulated = phaseOutputs.join('\n\n');

              // After each completed phase (except the last), commit accumulated
              // content to messages so the user can scroll and read while the
              // next phase streams in.
              if (i < PHASE_CONFIGS.length - 1) {
                const interimNext = setSession(skill, (s) => ({
                  ...s,
                  messages: [...initialMsgs, { role: 'assistant', content: fullAccumulated }],
                  streamingText: '',
                }));
                skillSetters.get(skill)?.(interimNext);
              }
            }

            if (phasedAbortedRef.current) return;

            const finalContent = phaseOutputs.join('\n\n');
            const next = setSession(skill, () => ({
              messages: [...initialMsgs, { role: 'assistant', content: finalContent }],
              streamingText: '',
              isLoading: false,
              error: null,
              startedAt: null,
              phaseLabel: null,
            }));
            skillSetters.get(skill)?.(next);
            persistMessages(skill, next.messages);
            archiveResearchSession(next.messages, skill).catch(() => {});
            completionListeners.forEach((l) => l(skill));
          } finally {
            clearInterval(renderInterval);
          }
        }

        runAllPhases();
      }
    },
    [skill, setState],
  );

  // Pre-populate messages with a synthetic Stage 1 exchange so that
  // calling sendMessage(answers) immediately triggers Stage 2 (phased analysis),
  // skipping the Claude round-trip for clarifying questions.
  const initResearch = useCallback(
    (ticker: { ticker: string; name: string }, compareTicker?: { ticker: string; name: string }) => {
      if (skill !== 'stock-researcher') return;
      const isComparison = !!compareTicker;
      const syntheticAssistant = isComparison
        ? [
            `I'll compare ${ticker.name} against ${compareTicker!.name}. Here are your research parameters:`,
            '<<PICK:Investment style:Value|Growth|Turnaround|Dividend>>',
            '<<PICK:Holding period:Short-term (<6 months)|Medium-term (6–18 months)|Long-term (1–3+ years)>>',
            '<<PICK:Risk tolerance:Conservative|Balanced|Aggressive>>',
            '<<MULTIPICK:Focus areas (pick 2–3):Business quality|Financial health|Industry dynamics|Governance|Valuation|Catalysts>>',
            '<<PICK:Research depth:Quick scan|Standard due diligence>>',
            '<<FREETEXT:Any specific context or concerns about either company?>>',
          ].join('\n')
        : [
            `I can help you research ${ticker.name}. Here are your research parameters:`,
            '<<PICK:Investment style:Value|Growth|Turnaround|Dividend>>',
            '<<PICK:Holding period:Short-term (<6 months)|Medium-term (6–18 months)|Long-term (1–3+ years)>>',
            '<<PICK:Risk tolerance:Conservative|Balanced|Aggressive>>',
            '<<MULTIPICK:Focus areas (pick 2–3):Business quality|Financial health|Industry dynamics|Governance|Valuation|Catalysts>>',
            '<<PICK:Research depth:Quick scan|Standard due diligence>>',
            '<<FREETEXT:Any specific concerns or red flags you are already aware of?>>',
          ].join('\n');
      const userContent = isComparison
        ? `Compare ${ticker.ticker} (${ticker.name}) vs ${compareTicker!.ticker} (${compareTicker!.name})`
        : `Research ${ticker.ticker} (${ticker.name})`;
      const next: SessionState = {
        ...EMPTY_STATE,
        messages: [
          { role: 'user', content: userContent },
          { role: 'assistant', content: syntheticAssistant },
        ],
      };
      skillSessions.set(skill, next);
      skillSetters.get(skill)?.(next);
    },
    [skill],
  );

  const clearSession = useCallback(() => {
    const msgs = getSession(skill).messages;
    if (msgs.length > 2) archiveResearchSession(msgs, skill).catch(() => {});
    phasedAbortedRef.current = true;
    abortRef.current?.();
    abortRef.current = null;
    skillSessions.delete(skill);
    skillSetters.get(skill)?.({ ...EMPTY_STATE });
    clearPersistedMessages(skill);
    setTimeout(() => { phasedAbortedRef.current = false; }, 0);
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
    phaseLabel: state.phaseLabel,
    sendMessage,
    initResearch,
    clearSession,
    dismissError,
  };
}
