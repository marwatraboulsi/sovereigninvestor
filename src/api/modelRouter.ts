/**
 * Model routing for Sovereign Investor.
 *
 * Strategy (from PRD §4.3):
 *   - Simple educational Q&A → Haiku (fast, cheap)
 *   - Full structured analysis → Opus (maximum quality)
 *
 * Routing is determined by the last user message. If it looks like a short
 * clarifying question (no ticker/portfolio data, no analytical keywords),
 * route to Haiku. Otherwise, use Opus for the full skill analysis.
 */

import { Message } from '@/types';

export const MODELS = {
  fullAnalysis: 'claude-sonnet-4-6',   // Sonnet: fast enough for mobile + web search
  portfolioAnalysis: 'claude-sonnet-4-6',
  simpleQA: 'claude-haiku-4-5',
} as const;

// Keywords that signal a full structured analysis is needed
const ANALYSIS_SIGNALS = [
  // ETF / MACE signals
  'analyze', 'analysis', 'evaluate', 'compare', 'vs', 'versus',
  'expense ratio', 'aum', 'holdings', 'mandate', 'composition',
  // Portfolio signals
  'portfolio', 'overlap', 'allocation', 'concentration', 'diversif',
  'holdings', 'rebalance', 'exposure',
  // Catalyst signals
  'catalyst', 'institutional', 'macro', 'policy', 'regulatory',
  'disruption', 'market event', 'news',
  // Ticker pattern - uppercase 1-5 letter sequences e.g. VOO, QQQ, ARKK
];

const TICKER_PATTERN = /\b[A-Z]{1,5}\b/;

// Short messages that are clearly follow-up questions, not new analyses
const SIMPLE_QA_PATTERN = /^(what (is|does|are)|how (does|do)|explain|define|tell me about|what's|why (is|does))\b/i;

/**
 * Returns the model ID to use for a given conversation.
 * Examines only the most recent user message.
 */
export function routeModel(messages: Message[]): string {
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUserMessage) return MODELS.fullAnalysis;

  const text = lastUserMessage.content.toLowerCase();
  const rawText = lastUserMessage.content;

  // Short clarifying question with no ticker or analysis keywords → Haiku
  const isShortQuestion = lastUserMessage.content.length < 200 && SIMPLE_QA_PATTERN.test(rawText);
  const hasTicker = TICKER_PATTERN.test(rawText);
  const hasAnalysisKeyword = ANALYSIS_SIGNALS.some((kw) => text.includes(kw));

  if (isShortQuestion && !hasTicker && !hasAnalysisKeyword) {
    return MODELS.simpleQA;
  }

  return MODELS.fullAnalysis;
}

/**
 * Human-readable description of why a model was selected.
 * Used for debug logging.
 */
export function describeRouting(model: string): string {
  if (model === MODELS.simpleQA) return 'Haiku (simple Q&A)';
  return 'Opus (full analysis)';
}
