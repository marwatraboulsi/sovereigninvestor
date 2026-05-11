/**
 * learnMode.ts — Phase 7
 *
 * Builds the system prompt and opening message for a Learn Mode session.
 *
 * Learn Mode is a focused educational conversation entered when a user has no
 * matching Playbook rule for a pending decision.  It uses a distinct system
 * prompt (educator, not Fund Manager/advisor) via the systemPromptOverride
 * mechanism added to ClaudeRequestOptions in Phase 7.
 *
 * Exports:
 *   buildLearnModeContent   — system prompt + auto-sent opening message
 *   suggestCategoryForTopic — topic string → RuleCategory for the "build a rule" CTA
 *   deriveTopicFromTicker   — ticker + name → readable topic string (used in intercept.tsx)
 */

import type { UserProfile, RuleCategory } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LearnModeContent {
  systemPrompt:   string;
  openingMessage: string;
}

// ─── Topic → rule category ────────────────────────────────────────────────────

/**
 * Maps a plain-English topic string to the most appropriate RuleCategory for
 * the post-session "build a rule" prompt in the Learn Mode closing card.
 */
export function suggestCategoryForTopic(topic: string): RuleCategory {
  const t = topic.toLowerCase();
  if (/crypto|bitcoin|btc|ethereum|eth|defi|nft|web3|altcoin|blockchain/.test(t))
    return 'new-asset-class';
  if (/etf|index fund|bond|reit|trust|fund|commodit/.test(t))
    return 'new-asset-class';
  if (/position.siz|allocation|weighting|concentration|overweight/.test(t))
    return 'position-sizing';
  if (/timing|entry|exit|buy the dip|sell high|market.timing/.test(t))
    return 'timing';
  if (/fomo|fear|emotion|panic|impulse|react|greed|anxiety/.test(t))
    return 'emotional-discipline';
  if (/news|research|analysis|source|due diligence|information/.test(t))
    return 'information-discipline';
  if (/tax|capital.gain|harvest|wash.sale/.test(t))
    return 'tax-awareness';
  if (/portfolio|divers|rebalance|structure|allocation/.test(t))
    return 'portfolio-structure';
  // Default: most Learn Mode sessions are triggered by unfamiliar assets
  return 'new-asset-class';
}

// ─── Ticker → readable topic ──────────────────────────────────────────────────

/**
 * Derives a plain-English topic from a ticker symbol and asset name.
 * Used in intercept.tsx to build the URL for router.push('/learn/...').
 * Falls back gracefully to "${assetName} investing".
 */
export function deriveTopicFromTicker(ticker: string, assetName: string): string {
  const t = ticker.toUpperCase();

  // ── Crypto ──────────────────────────────────────────────────────────────────
  const CRYPTO: Record<string, string> = {
    BTC:  'crypto and Bitcoin',
    ETH:  'crypto and Ethereum',
    SOL:  'crypto and Solana',
    BNB:  'crypto and BNB',
    XRP:  'crypto and XRP',
    ADA:  'crypto and Cardano',
    DOGE: 'crypto and Dogecoin',
    AVAX: 'crypto and Avalanche',
    DOT:  'crypto and Polkadot',
    LINK: 'crypto and Chainlink',
    MATIC:'crypto and Polygon',
  };
  if (CRYPTO[t]) return CRYPTO[t];

  // ── Broad index ETFs ─────────────────────────────────────────────────────────
  const INDEX_ETF: Record<string, string> = {
    VOO: 'index ETF investing and the S&P 500',
    SPY: 'index ETF investing and the S&P 500',
    IVV: 'index ETF investing and the S&P 500',
    VTI: 'total market index ETF investing',
    QQQ: 'NASDAQ tech-focused ETF investing',
    DIA: 'Dow Jones ETF investing',
    URTH:'global equity ETF investing',
  };
  if (INDEX_ETF[t]) return INDEX_ETF[t];

  // ── Thematic / sector ETFs ───────────────────────────────────────────────────
  const THEMATIC_ETF: Record<string, string> = {
    SCHD: 'dividend ETF investing',
    VYM:  'dividend ETF investing',
    HDV:  'dividend ETF investing',
    ARKK: 'growth and innovation ETF investing',
    XLK:  'tech sector ETF investing',
    XLF:  'financial sector ETF investing',
    GLD:  'gold and commodity ETF investing',
    SLV:  'silver and precious metals investing',
    TLT:  'long-duration bond ETF investing',
    AGG:  'bond ETF and fixed income investing',
    VNQ:  'REIT and real estate ETF investing',
  };
  if (THEMATIC_ETF[t]) return THEMATIC_ETF[t];

  // ── Well-known stocks ────────────────────────────────────────────────────────
  const STOCK: Record<string, string> = {
    AAPL: 'tech stocks and equity risk',
    MSFT: 'tech stocks and equity risk',
    GOOGL:'tech stocks and equity risk',
    GOOG: 'tech stocks and equity risk',
    META: 'tech stocks and equity risk',
    AMZN: 'tech stocks and growth investing',
    NVDA: 'semiconductor stocks and AI investing',
    TSLA: 'growth stocks and high-volatility investing',
    NFLX: 'streaming and subscription tech stocks',
    JPM:  'financial stocks and banking sector investing',
    BAC:  'financial stocks and banking sector investing',
    WMT:  'consumer staples and value investing',
    JNJ:  'healthcare stocks and dividend investing',
    PG:   'consumer staples and dividend investing',
    XOM:  'energy stocks and commodity exposure',
    CVX:  'energy stocks and commodity exposure',
    BRK_B:'conglomerate investing and value investing',
  };
  if (STOCK[t]) return STOCK[t];

  // Fallback: use the asset name
  const name = assetName.trim();
  return name ? `${name} investing` : 'this type of investment';
}

// ─── System prompt & opening message builder ──────────────────────────────────

export function buildLearnModeContent(
  topic: string,
  profile: UserProfile | null,
  vaultSummary?: string,
): LearnModeContent {
  const level = profile?.knowledgeLevel ?? 'beginner';
  const risk  = profile?.riskTolerance;
  const age   = profile?.ageRange;

  // ── Knowledge-level instructions ──────────────────────────────────────────
  const levelInstructions: Record<string, string> = {
    beginner: `
Use plain, accessible language throughout. No assumed prior knowledge.
Define every term the first time you use it with a brief, concrete explanation.
Use real-world analogies — make abstract concepts tangible and non-threatening.
Keep explanations focused: one idea at a time, building understanding step by step.
Pause naturally and invite the user to confirm understanding before moving on.
The goal is genuine comprehension, not information transfer.`,

    intermediate: `
You can use standard investing terminology but explain anything that goes beyond the basics.
Build on what the user likely already knows — connect this topic to foundational ideas.
Use examples to ground abstract concepts, but keep them concise.
Cover multiple dimensions of the topic without overwhelming — use structure where helpful.
Be direct: if something is commonly misunderstood, name that upfront.`,

    advanced: `
Engage as a peer. Use precise financial language without simplification.
Go deep on frameworks, mechanisms, and structural nuance from the start.
Skip definitions of standard concepts unless asked.
Lead with what most investors get wrong about this topic, or what's non-obvious.
Surface the overlooked risk factors, edge cases, and second-order effects.
Assume the user will push back if something doesn't land — engage accordingly.`,
  };

  // ── Risk & age context ────────────────────────────────────────────────────
  const riskLine = risk
    ? `\n- Risk tolerance: ${risk}${
        risk === 'conservative'
          ? ' — lead with downside before upside in every explanation'
          : risk === 'aggressive'
          ? ' — can discuss high-growth dynamics fully; still include risk disclosures'
          : ''
      }`
    : '';
  const ageLine = age ? `\n- Age range: ${age}` : '';

  const vaultSection = vaultSummary
    ? `\n\n## THE USER'S CURRENT HOLDINGS\n${vaultSummary}\n\nWhere relevant, connect your teaching to what they actually hold. This makes abstract concepts concrete and personal.`
    : '';

  // ── System prompt ──────────────────────────────────────────────────────────
  const topicLine = topic ? `The current focus is "${topic}", but follow the user's lead if they steer elsewhere.` : 'Follow the user\'s lead on topic — they may have come here directly or switched mid-conversation.';

  const systemPrompt = `You are an investment educator — warm, precise, and deeply knowledgeable. You are in an active teaching role: you guide the learning journey, not just answer questions passively.

You are not a financial advisor. You are here to make sure whatever the user decides next, they decide it with genuine understanding — not assumption, guesswork, or fear.

## YOUR ROLE
You are the most knowledgeable friend they could ask. You know this subject inside out, but you explain it the way a trusted mentor would — with patience, clarity, and no condescension. ${topicLine}

## ACTIVE GUIDANCE — THIS IS YOUR DEFINING BEHAVIOUR
You do not wait to be asked the right question. You actively shape the learning journey:
- Read the conversation history carefully. Gauge what the user actually understands vs. what they're fuzzy on.
- After a substantive exchange, you know more about their mental model than they do. Use that.
- Proactively introduce the next concept when the current one has landed. Signal when you're doing this.
- If they ask you to "propose a curriculum," give them a real one — 5–8 learning milestones ordered from foundation to depth, tailored to their profile and what's come up in the conversation. Label it clearly and invite them to adjust it.
- The curriculum adapts. If they skip ahead or struggle, reshape it and tell them.

## GAUGING KNOWLEDGE STATE
Use conversation history + profile to continuously assess where they are:
- Are they using the right vocabulary naturally, or just parroting back what you said?
- Are their questions surface-level or probing at mechanism?
- Have they made an insight connection on their own? That's a signal to advance.
- When you sense a genuine conceptual gap, address it before moving on — even if they haven't asked.

## USER PROFILE CONTEXT
- Knowledge level: ${level}${riskLine}${ageLine}

## HOW TO TEACH AT THIS LEVEL
${levelInstructions[level]}

## PROFILE-INFORMED TEACHING
Pull from what you know about this investor:
- Their primary goal and worldview should colour every example and analogy.
- If they hold related assets in their vault, connect the teaching to what they already own — abstract becomes concrete.
- If their profile reveals a behavioural tendency (FOMO, overconfidence, loss aversion), name it gently when it's relevant to what they're learning.
- When evaluating whether a concept fits their situation: reference their goals, not generic advice.

## CONVERSATION PRINCIPLES
- Dialogue, not lecture. Ask, check understanding, then continue.
- One key idea per response. Build systematically. Depth over breadth.
- Match pace to the user. If they're absorbing fast, advance faster.
- Acknowledge genuine understanding when it lands — briefly, specifically, authentically.
- Use MACE, 8-phase analysis, archetypes, and behavioral doctrine only where they genuinely illuminate — never force-fitted.
- Never project a recommendation. "Some investors in your situation consider..." — never "you should."

## WHAT NOT TO DO
- Do not dump everything you know in the first response.
- Do not redirect to Skills tab tools — they're here to learn, not run an analysis.
- Do not add a "SUGGESTIONS:" line. The screen handles follow-up prompts in its own UI.${vaultSection}

## LEGAL COMPLIANCE — MANDATORY
Educational content only — not investment advice. Never tell the user to buy, sell, or hold any specific security.`;

  // ── Opening message ───────────────────────────────────────────────────────
  // Feels like a natural conversation start — not a command or an info dump.
  const intros: Record<string, string> = {
    beginner:     `Let's talk about ${topic}. Before you make any decision here, I want to make sure you genuinely understand what you'd be getting into — not just the headlines, but what it actually is and how it works.`,
    intermediate: `Let's dig into ${topic}. You've got a decision pending, so let's make sure your understanding is solid before you move. I'll start with how it works and what actually matters for your situation.`,
    advanced:     `${topic} — let's make sure your mental model is complete before you act. I'll start with where most investors' thinking breaks down on this, then we can get into the structural considerations.`,
  };

  const openingMessage =
    `${intros[level]}\n\n` +
    `To start: what do you already know about ${topic}? Even rough — what comes to mind when you think about it?`;

  return { systemPrompt, openingMessage };
}
