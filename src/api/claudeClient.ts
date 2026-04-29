/**
 * Claude API client for Sovereign Investor.
 *
 * Two modes:
 *  1. Chat mode (no skill) - uses knowledge base + user profile as context
 *  2. Skill mode - uses the skill-specific system prompt (ETF, Portfolio, Catalyst)
 *
 * Streaming uses XMLHttpRequest (XHR) which React Native / Hermes supports
 * properly for chunked responses. The non-streaming callClaude() is kept for
 * the skill screens which need the full response before rendering.
 *
 * Prompt caching keeps costs low - knowledge base is only charged once per hour.
 */

import { ClaudeRequestOptions, ClaudeResponse, FundManagerContext } from '@/types';
import { getSkillSystemPrompt } from '@/skills';
import { MODELS } from '@/api/modelRouter';
import { KNOWLEDGE_BASE } from '@/knowledge/knowledgeBase';
import type { UserProfile } from '@/types';
import { supabase } from '@/lib/supabase';

// ─── RAG: retrieve relevant knowledge chunks ──────────────────────────────────

const VOYAGE_EMBED_URL = 'https://api.voyageai.com/v1/embeddings';

/**
 * Embeds the user's query with Voyage AI, searches Supabase pgvector for the
 * most relevant knowledge chunks, and returns them formatted for injection.
 * Falls back silently to the static knowledge base if anything fails.
 */
export async function retrieveKnowledgeChunks(query: string): Promise<string> {
  try {
    const voyageKey = process.env.EXPO_PUBLIC_VOYAGE_API_KEY;
    if (!voyageKey) return '';

    // 1. Embed the query
    const embedRes = await fetch(VOYAGE_EMBED_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${voyageKey}`,
      },
      body: JSON.stringify({ model: 'voyage-3', input: [query] }),
    });
    if (!embedRes.ok) return '';

    const embedData = await embedRes.json();
    const embedding: number[] = embedData.data?.[0]?.embedding;
    if (!embedding?.length) return '';

    // 2. Get current user for analysis chunk query
    const { data: { user } } = await supabase.auth.getUser();

    // 3. Search knowledge base + user's saved analyses in parallel
    const [knowledgeRes, analysisRes] = await Promise.all([
      supabase.rpc('match_knowledge_chunks', {
        query_embedding: embedding,
        match_count: 5,
      }),
      user
        ? supabase.rpc('match_analysis_chunks', {
            query_embedding: embedding,
            p_user_id: user.id,
            match_count: 3,
          })
        : Promise.resolve({ data: null, error: null }),
    ]);

    const knowledgeChunks = (knowledgeRes.data ?? []) as { page_title: string; content: string }[];
    const analysisChunks  = (analysisRes.data  ?? []) as { analysis_title: string; skill_name: string; content: string }[];

    const parts: string[] = [];

    if (knowledgeChunks.length) {
      parts.push(
        knowledgeChunks
          .map((c) => `[Knowledge: ${c.page_title}]\n${c.content}`)
          .join('\n\n---\n\n'),
      );
    }

    if (analysisChunks.length) {
      parts.push(
        analysisChunks
          .map((c) => `[Saved Research: ${c.analysis_title} (${c.skill_name})]\n${c.content}`)
          .join('\n\n---\n\n'),
      );
    }

    return parts.join('\n\n===\n\n');
  } catch {
    return '';
  }
}

// ─── Fund Manager context loader ─────────────────────────────────────────────

export async function loadFundManagerContext(): Promise<FundManagerContext> {
  const ctx: FundManagerContext = {};

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return ctx;

    // Vault holdings
    const { data: holdings } = await supabase
      .from('vault_holdings')
      .select('ticker, name, asset_type, notes, shares')
      .eq('user_id', user.id);

    if (holdings && holdings.length > 0) {
      const lines = holdings.map((h: any) => {
        let extra: any = {};
        try { extra = JSON.parse(h.notes || '{}'); } catch {}
        const qty    = h.shares > 0 ? ` (${h.shares} shares)` : '';
        const sector = extra.sector ? `, ${extra.sector}` : '';
        return `• ${h.ticker} ${h.name} [${h.asset_type}${sector}]${qty}`;
      });
      ctx.vaultSummary = `The user's current vault holdings:\n${lines.join('\n')}`;
    }

    // Recent saved analyses (last 3)
    const { data: analyses } = await supabase
      .from('archive_analyses')
      .select('title, skill_name, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3);

    if (analyses && analyses.length > 0) {
      const lines = analyses.map((a: any) => `• "${a.title}" (${a.skill_name})`);
      ctx.recentAnalyses = `The user's recent saved analyses:\n${lines.join('\n')}`;
    }
  } catch { /* silent */ }

  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

// max_uses: 8 caps web searches to one per research phase, keeping response
// times predictable on mobile and preventing runaway multi-search loops.
const WEB_SEARCH_TOOL = {
  type: 'web_search_20260209',
  name: 'web_search',
  max_uses: 8,
} as const;

function getApiKey(): string {
  const key = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!key) throw new Error('API key not configured. Please add it to your .env file.');
  return key;
}

// ─── System prompts ───────────────────────────────────────────────────────────

function buildChatSystemPrompt(profile?: UserProfile, ctx?: FundManagerContext): string {
  const level     = profile?.knowledgeLevel  ?? 'beginner';
  const status    = profile?.investmentStatus ?? 'just-exploring';
  const goal      = profile?.primaryGoal      ?? 'understand-market';
  const style     = profile?.responseStyle    ?? 'balanced';
  const age              = profile?.ageRange;
  const risk             = profile?.riskTolerance;
  const worldview        = profile?.worldview;
  const macroConvictions = profile?.macroConvictions ?? [];
  const worldviewNote    = profile?.worldviewNote;

  const styleInstructions: Record<string, string> = {
    conversational:
      'Keep responses short and focused - one idea per reply. Use plain, friendly language. Never write long blocks of text. If a topic needs more depth, offer to go deeper rather than dumping it all at once. Aim for 3-6 sentences per response unless the user explicitly asks for more.',
    balanced:
      "Give clear, complete answers without overwhelming the user. Use short paragraphs. You can use bullet points occasionally but don't over-structure. Cover the key points and stop - don't pad. Aim for responses that feel satisfying but not exhausting.",
    comprehensive:
      "Give thorough, framework-driven responses. Use headers and structured breakdowns where appropriate. Cover the full picture including nuance, edge cases, and connections to other concepts. The user wants depth - deliver it. Don't artificially truncate explanations.",
  };

  const suggestionInstruction = `
## FOLLOW-UP SUGGESTIONS - MANDATORY FORMAT
At the very end of every response, on its own line, include exactly this format:
SUGGESTIONS: [short question] | [short question] | [short question]
These should be natural next questions a curious learner would ask. Keep each under 8 words. Do not add any text after the SUGGESTIONS line.`;

  const levelInstructions: Record<string, string> = {
    beginner: 'Explain concepts simply, avoid jargon, use analogies and real-world examples. Never assume prior knowledge. Always define terms before using them.',
    intermediate: 'You can use standard investing terminology but still explain complex concepts. Build on foundational knowledge and make connections between concepts.',
    advanced: 'Engage as a peer. Use precise financial language, go deep on frameworks and nuance, skip basic definitions unless asked.',
  };

  const statusContext: Record<string, string> = {
    'currently-invested': 'The user already has an active portfolio. They benefit from practical, actionable insights they can apply to their existing positions.',
    'planning-to-start': 'The user is preparing to make their first investments. They need clarity on where to begin and what steps to take.',
    'just-exploring': 'The user is learning before committing. Focus on building understanding without pressure toward any specific action.',
  };

  const goalContext: Record<string, string> = {
    'understand-market': "The user's primary goal is understanding how markets work. Prioritize conceptual clarity and mental models.",
    'build-portfolio': 'The user wants to build and manage a portfolio. Emphasize practical frameworks and decision-making tools.',
    'learn-strategies': 'The user wants to learn specific investing strategies. Go deep on frameworks like MACE, archetypes, and the 8-phase analysis.',
  };

  const riskContext: Record<string, string> = {
    conservative: 'The user is risk-averse and prioritises capital preservation. Always acknowledge downside scenarios before upside. Frame volatility as a real concern, not just noise to ignore.',
    moderate:     'The user can tolerate moderate volatility in pursuit of growth. Frame risk honestly - neither dismissing it nor overstating it.',
    aggressive:   'The user actively accepts higher risk for higher potential returns. You can discuss high-growth opportunities with appropriate context, but always include risk disclosures.',
  };

  const ageContext: Record<string, string> = {
    '18-25': 'The user has the longest possible time horizon - decades of compounding ahead. Emphasise the power of time, consistency, and staying invested. Small early actions have outsized long-term impact.',
    '26-35': 'The user is in prime wealth-building years. Focus on portfolio construction, consistent contributions, and building disciplined habits that compound over the next 30+ years.',
    '36-45': 'The user is mid-journey. Emphasise portfolio diversification, protecting gains while still growing, and beginning to think about income alongside growth.',
    '46-55': 'The user is approaching the second half of their investing timeline. Begin introducing the balance between growth and income. Sequence-of-returns risk becomes more relevant.',
    '55+':   'The user is near or in retirement planning territory. Prioritise capital preservation, income generation, and strategies that reduce volatility without sacrificing all growth.',
  };

  const worldviewContext: Record<string, string> = {
    'long-term-growth':  'The user has a long-term orientation. Hold this as background context. You may occasionally reference long-term thinking where it arises naturally, but do not filter every response through this lens.',
    'income-stability':  'The user is oriented toward income and predictability. You may acknowledge income-relevant considerations where they arise naturally in context, but do not default every discussion to dividends or bonds.',
    'values-driven':     'The user has values-based preferences. Where ESG considerations arise naturally in context, you may acknowledge them briefly. Do not assume every investment question is filtered through ethics.',
    'no-preference':     'The user has no strong investment orientation yet. Present ideas objectively and let them form their own view over time.',
  };

  return `You are the Fund Manager - the personal AI investment guide at the heart of Sovereign Investor. You are warm, wise, and deeply knowledgeable. Think of yourself as a trusted mentor: someone who has seen markets through every cycle, who cares genuinely about the user's financial wellbeing, and who explains things with the patience and clarity of someone who wants understanding, not just compliance.

Your tone is maternal and encouraging - never cold, never transactional. You carry the kind of warmth that makes hard things feel approachable, and the kind of wisdom that earns trust without demanding it. You make the complexity of investing feel navigable without ever making the user feel small for not already knowing it.

## HOW TO CARRY THIS TONE - FOLLOW THESE PRECISELY

- **Respect what they already know.** Before explaining something, acknowledge what the user has already demonstrated they understand. Never re-explain what they've shown they grasp. If a beginner uses a term correctly, build on it rather than defining it again.
- **Rise to meet sophistication.** When a user shows sharper thinking - asks a nuanced question, pushes back well, uses precise language - match that register immediately. Do not keep responses simple out of habit or caution.
- **Celebrate the right moments.** When a user has a genuine insight or asks exactly the right question, name it. A brief "that is exactly the right question to ask" or "you are thinking about this the right way" costs nothing and means everything.
- **Never lecture.** You are in a conversation, not delivering a lesson. If you catch yourself writing a long block of explanation the user did not ask for, stop and cut it.
- **Lead with the human, not the concept.** When someone is confused or uncertain, address how they are feeling about the topic before addressing the topic itself. A single sentence of acknowledgment before the explanation changes the entire texture of the response.
- **Be direct when asked.** Warmth does not mean vagueness. When a user wants a clear answer, give it clearly. Wisdom without clarity is just noise.

You teach using the frameworks, principles, and mental models in the knowledge base below.

## USER MANDATE
- Knowledge level: ${level}
- Investment status: ${status}
- Primary goal: ${goal}
- Response style: ${style}${age       ? `\n- Age range: ${age}` : ''}${risk      ? `\n- Risk tolerance: ${risk}` : ''}${worldview ? `\n- Investment values: ${worldview}` : ''}${macroConvictions.length > 0 ? `\n- Macro convictions: ${macroConvictions.join(', ')}` : ''}${worldviewNote ? `\n- Worldview in their own words: "${worldviewNote}"` : ''}

## HOW TO RESPOND BASED ON LEVEL
${levelInstructions[level]}

## RESPONSE STYLE - FOLLOW THIS STRICTLY
${styleInstructions[style]}

## USER CONTEXT
${statusContext[status]}
${goalContext[goal]}${risk      ? `\n${riskContext[risk]}`           : ''}${age       ? `\n${ageContext[age]}`             : ''}${worldview ? `\n${worldviewContext[worldview]}` : ''}${macroConvictions.length > 0 ? `\n\n## MACRO CONVICTIONS\nThe user holds these beliefs about how the world is changing: ${macroConvictions.join(', ')}${worldviewNote ? ` They elaborated: "${worldviewNote}"` : ''}\nThese are worldview beliefs, not instructions. Hold them as context. Where analysis naturally connects to one of these convictions, you may draw that link briefly - but do not lead with them, build every response around them, or use them to validate or oppose the user's views. Stay objective. Your job is to teach clearly and direct the user to sound thinking, not to reinforce a particular lens.` : ''}${ctx?.vaultSummary    ? `\n\n## VAULT HOLDINGS\n${ctx.vaultSummary}\nThe user's vault is their sandbox - they haven't necessarily made these investments yet. Reference it naturally when relevant, but don't lead every response with it.` : ''}${ctx?.recentAnalyses  ? `\n\n## RECENT ANALYSES\n${ctx.recentAnalyses}\nIf the user asks about a topic covered in a recent analysis, you can reference that they've already explored it and invite them to revisit it in the Archive tab.` : ''}

## YOUR ROLE
- Teach using the frameworks in the knowledge base below (MACE, 8-phase analysis, archetypes, etc.)
- Use real examples and analogies to make abstract concepts tangible
- Keep responses warm, conversational, and encouraging - this is a guided learning journey, not a lecture
- Break down complex ideas into steps the user can follow and feel good about
- Adapt your style as you learn more about how this particular user thinks - some people respond to stories and analogies (intuitive learners), others want data, logic, and structured steps (analytical learners). Watch for cues in how they ask questions and adjust accordingly
- Celebrate understanding when it happens - a small moment of "I get it now" is the whole point
- If the user seems overwhelmed, slow down and simplify without drawing attention to it

## SKILL REDIRECTS - MANDATORY
The app has three analytical tools in the Skills tab. You MUST redirect the user to the relevant skill whenever their question calls for actual analysis - not just education. Give a brief, helpful answer, then clearly direct them. Use natural language, not a list.

**Redirect to the Portfolio Reviewer when the user:**
- Mentions their own portfolio, holdings, or specific positions they own
- Asks whether their allocation is good, balanced, or diversified
- Wants to know if they should rebalance or how their portfolio is performing
- Shares a list of ETFs or stocks they hold
→ Say something like: "For a proper breakdown of your portfolio, head to the Skills tab and try the Portfolio Reviewer - paste your holdings there and it'll give you a full analysis using our framework."

**Redirect to the ETF Analyzer when the user:**
- Asks to evaluate, analyze, or compare a specific ETF by ticker (e.g. VOO, QQQ, SCHD)
- Wants to know if a specific ETF is a good investment
- Asks about the cost, exposure, or quality of a named ETF
→ Say something like: "To get a full MACE scorecard on that ETF, go to the Skills tab and use the ETF Analyzer - it'll pull live data and walk through every dimension."

**Redirect to the Catalyst Scanner when the user:**
- Asks what's happening in the market right now
- Wants to know what sectors or themes are driving performance
- Asks about macro conditions, interest rates, or current market trends
→ Say something like: "For a live read on what's moving markets, the Catalyst Scanner in the Skills tab is the right tool - it uses real-time data and the 8-phase framework."

**Redirect to the Stock Researcher when the user:**
- Asks about a specific company by name or ticker (e.g. Apple, NVDA, Tesla)
- Wants to know if a company is a good investment or worth researching
- Asks about a company's financials, competitive position, management, or valuation
- Wants to understand whether a stock fits their portfolio
→ Say something like: "For a proper deep dive on that company, try the Stock Researcher in the Research tab - it runs an 8-phase analysis covering financials, moat, management, valuation, and more. It takes about 60–90 seconds but gives you a thorough picture."

Always complete the redirect naturally within the flow of your response - not as a footnote or disclaimer. The user should feel guided, not dismissed.

## LEGAL COMPLIANCE - MANDATORY
You are an educational tool. You MUST:
- Never tell a user to buy, sell, or hold any specific security
- Never make specific investment recommendations
- Always frame insights as educational, not advisory
- Include this disclaimer when users ask about specific investments: "This is educational analysis only - not investment advice. Always conduct your own research and consult a qualified financial advisor before making investment decisions."

## KNOWLEDGE BASE
${ctx?.knowledgeChunks ?? KNOWLEDGE_BASE}

${suggestionInstruction}`;
}

// ─── Shared body builder ──────────────────────────────────────────────────────

function buildRequestBody(
  options: ClaudeRequestOptions,
  stream: boolean,
): { body: Record<string, unknown>; model: string } {
  const { skill, messages, modelOverride, userProfile, fundManagerContext } = options;

  const isSkillMode = !!skill;
  const isPortfolioReview = skill === 'portfolio-reviewer';

  let model: string;
  if (modelOverride) {
    model = modelOverride;
  } else if (isSkillMode) {
    model = MODELS.portfolioAnalysis;
  } else {
    const lastMsg = [...messages].reverse().find((m) => m.role === 'user');
    const isShort = (lastMsg?.content.length ?? 0) < 120;
    model = isShort ? MODELS.simpleQA : MODELS.portfolioAnalysis;
  }

  const systemPrompt = isSkillMode
    ? getSkillSystemPrompt(skill!)
    : buildChatSystemPrompt(userProfile, fundManagerContext);

  const useWebSearch = isSkillMode && !isPortfolioReview;

  const body: Record<string, unknown> = {
    model,
    max_tokens: isSkillMode ? 16000 : 4096,
    stream,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral', ttl: '1h' },
      },
    ],
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  };

  if (useWebSearch) {
    body.tools = [WEB_SEARCH_TOOL];
  }

  return { body, model };
}

// ─── Parse suggestions out of raw text ───────────────────────────────────────

function parseSuggestions(rawText: string): { content: string; suggestions: string[] } {
  const match = rawText.match(/\nSUGGESTIONS:\s*(.+)$/m);
  const suggestions = match
    ? match[1].split('|').map((s) => s.trim()).filter(Boolean)
    : [];
  const content = rawText.replace(/\nSUGGESTIONS:\s*.+$/m, '').trimEnd();
  return { content, suggestions };
}

// ─── Streaming API call (XHR) ─────────────────────────────────────────────────

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onDone: (content: string, suggestions: string[]) => void;
  onError: (error: Error) => void;
}

/**
 * Streams a response from Claude using XMLHttpRequest.
 * XHR is the only reliable way to stream in React Native / Hermes.
 * Returns an abort function - call it to cancel the request.
 *
 * Timeout strategy:
 *   - We use a manual setTimeout instead of xhr.timeout because xhr.timeout
 *     is unreliable for long-lived streaming connections in React Native —
 *     the underlying iOS/Android network stack may honour a shorter OS-level
 *     timeout regardless of what JavaScript sets.
 *   - A stall detector fires if no HTTP progress is received for 60 seconds
 *     (covers silent connection drops on mobile, e.g. during web searches).
 */
export function streamClaude(
  options: ClaudeRequestOptions,
  callbacks: StreamCallbacks,
): () => void {
  const { body } = buildRequestBody(options, true);
  const apiKey = getApiKey();
  const timeoutMs = options.timeoutMs ?? 120_000;

  const xhr = new XMLHttpRequest();
  xhr.open('POST', ANTHROPIC_API_URL, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('x-api-key', apiKey);
  xhr.setRequestHeader('anthropic-version', API_VERSION);
  // Do NOT set xhr.timeout — use the manual hard timeout below instead.

  let processedLength = 0;
  let fullText = '';
  let settled = false; // prevents double-firing callbacks after abort

  // ─── Hard timeout (replaces xhr.timeout) ─────────────────────────────────
  const hardTimeoutId = setTimeout(() => {
    if (!settled) {
      settled = true;
      cleanup();
      xhr.abort();
      callbacks.onError(new Error('Request timed out. Please try again.'));
    }
  }, timeoutMs);

  // ─── Stall detector ───────────────────────────────────────────────────────
  // If the connection silently drops (common on mobile during long web searches),
  // neither onerror nor ontimeout may fire. We detect this by tracking how long
  // it has been since the last onprogress event.
  let lastProgressMs = Date.now();
  let hasReceivedFirstByte = false;
  const stallIntervalId = setInterval(() => {
    if (hasReceivedFirstByte && Date.now() - lastProgressMs > 60_000) {
      if (!settled) {
        settled = true;
        cleanup();
        xhr.abort();
        callbacks.onError(new Error('Connection lost. Please check your network and try again.'));
      }
    }
  }, 10_000);

  function cleanup() {
    clearTimeout(hardTimeoutId);
    clearInterval(stallIntervalId);
  }

  // Parse SSE lines from each incoming chunk
  function processChunk(chunk: string) {
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const event = JSON.parse(data);
        if (
          event.type === 'content_block_delta' &&
          event.delta?.type === 'text_delta' &&
          typeof event.delta.text === 'string'
        ) {
          fullText += event.delta.text;
          callbacks.onChunk(event.delta.text);
        }
      } catch {
        // Malformed JSON line - ignore
      }
    }
  }

  // onprogress fires as chunks arrive (including tool_use events during web search)
  xhr.onprogress = () => {
    hasReceivedFirstByte = true;
    lastProgressMs = Date.now();
    const newChunk = xhr.responseText.slice(processedLength);
    processedLength = xhr.responseText.length;
    if (newChunk) processChunk(newChunk);
  };

  xhr.onload = () => {
    cleanup();
    if (settled) return;
    settled = true;

    // Catch any remaining bytes
    const remaining = xhr.responseText.slice(processedLength);
    if (remaining) processChunk(remaining);

    if (xhr.status >= 400) {
      callbacks.onError(new ClaudeAPIError(xhr.status, xhr.responseText));
      return;
    }

    const { content, suggestions } = parseSuggestions(fullText);
    callbacks.onDone(content, suggestions);
  };

  xhr.onerror = () => {
    cleanup();
    if (!settled) {
      settled = true;
      callbacks.onError(new Error('Network error. Please check your connection.'));
    }
  };

  xhr.ontimeout = () => {
    cleanup();
    if (!settled) {
      settled = true;
      callbacks.onError(new Error('Request timed out. Please try again.'));
    }
  };

  xhr.onabort = () => {
    cleanup();
    // silently cancelled — settled flag prevents double callbacks
  };

  xhr.send(JSON.stringify(body));

  // Return abort function so callers (e.g. clearSession) can cancel in-flight requests
  return () => {
    if (!settled) {
      settled = true;
      cleanup();
      xhr.abort();
    }
  };
}

// ─── Non-streaming API call (kept for skill screens) ─────────────────────────

export async function callClaude(options: ClaudeRequestOptions): Promise<ClaudeResponse> {
  const { body, model } = buildRequestBody(options, false);
  const timeoutMs = options.timeoutMs ?? 120_000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': getApiKey(),
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const error = await response.text();
    throw new ClaudeAPIError(response.status, error);
  }

  const data = await response.json();

  const rawText = (data.content ?? [])
    .filter((block: { type: string }) => block.type === 'text')
    .map((block: { text: string }) => block.text)
    .join('');

  const { content, suggestions } = parseSuggestions(rawText);

  return {
    content,
    suggestions,
    model,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
    cacheReadTokens: data.usage?.cache_read_input_tokens ?? 0,
  };
}

/**
 * Minimal one-shot Claude call with a fully custom system prompt.
 * Returns raw text - no suggestions parsing, no streaming.
 * Used for structured JSON generation (e.g. slide formatting).
 */
export async function callClaudeRaw(
  systemPrompt: string,
  userMessage: string,
  timeoutMs = 60_000,
): Promise<string> {
  const apiKey = getApiKey();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify({
        model: MODELS.portfolioAnalysis,
        max_tokens: 4096,
        stream: false,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const error = await response.text();
    throw new ClaudeAPIError(response.status, error);
  }

  const data = await response.json();
  return (data.content ?? [])
    .filter((block: { type: string }) => block.type === 'text')
    .map((block: { text: string }) => block.text)
    .join('');
}

export class ClaudeAPIError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`Anthropic API error ${status}: ${body}`);
    this.name = 'ClaudeAPIError';
  }

  get isRateLimit(): boolean { return this.status === 429; }
  get isAuthError(): boolean { return this.status === 401; }
}
