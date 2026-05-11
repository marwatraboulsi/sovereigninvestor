import type {
  UserProfile,
  PlaybookRule,
  RuleCategory,
  DecisionType,
  DecisionTrigger,
  MacroConviction,
} from '@/types';

type SeedRule = Omit<PlaybookRule, 'id' | 'userId' | 'createdAt' | 'overrideCount'>;

function rule(
  category: RuleCategory,
  title: string,
  body: string,
  decisionTypes: DecisionType[],
  triggerTags: DecisionTrigger[],
): SeedRule {
  return {
    category,
    title,
    body,
    decisionTypes,
    triggerTags,
    sourceTrigger: 'onboarding-seed',
    status: 'active',
  };
}

// ─── Universal rules (every user) ────────────────────────────────────────────

const UNIVERSAL_RULES: SeedRule[] = [
  rule(
    'emotional-discipline',
    'Recency Bias',
    'I do not treat recent price performance as a forecast. A stock that has risen sharply is not safer, and one that has fallen is not doomed.',
    ['buy', 'sell'],
    ['recent-performance'],
  ),
  rule(
    'emotional-discipline',
    'Social Comparison / FOMO',
    'I do not buy an asset because others around me are profiting from it. Their entry price, risk tolerance, and time horizon are not mine.',
    ['buy'],
    ['social-comparison', 'price-rise-fomo'],
  ),
  rule(
    'timing',
    'The Pause Rule',
    'Before executing any non-scheduled investment decision, I pause and check my playbook. Urgency is almost never real.',
    ['buy', 'sell', 'unsure'],
    ['price-rise-fomo', 'price-drop-fear', 'social-comparison', 'news-reaction', 'overconfidence', 'recent-performance', 'boredom'],
  ),
  rule(
    'information-discipline',
    'News Reaction',
    'I do not make portfolio decisions in direct response to news headlines. By the time a headline is public, the market has already priced it.',
    ['buy', 'sell'],
    ['news-reaction'],
  ),
];

// ─── Macro conviction rules ───────────────────────────────────────────────────

const CONVICTION_RULES: Partial<Record<MacroConviction, SeedRule>> = {
  'dollar-debasement': rule(
    'information-discipline',
    'Dollar Debasement Consistency',
    'I believe the dollar loses purchasing power over time. Before this decision, I ask: does this trade protect or grow real value, or does it increase my exposure to the very thing I believe is declining?',
    ['buy', 'sell'],
    ['news-reaction', 'price-drop-fear'],
  ),
  'us-decline': rule(
    'portfolio-structure',
    'US Decline Consistency',
    'I believe US dominance is structurally declining. I check whether this trade increases or reduces my US-centric exposure, and whether that is consistent with where I believe the world is heading.',
    ['buy', 'sell'],
    ['news-reaction', 'price-drop-fear'],
  ),
  'ai-transformation': rule(
    'information-discipline',
    'AI Conviction Consistency',
    'I believe AI is a defining force of this decade. Before acting, I ask whether this trade reflects that belief or contradicts it — and whether I am chasing the trend or investing in the thesis.',
    ['buy', 'sell'],
    ['social-comparison', 'recent-performance', 'price-rise-fomo'],
  ),
  'climate-transition': rule(
    'information-discipline',
    'Climate Transition Consistency',
    'I believe the energy transition is a generational shift. I check whether this trade is consistent with being positioned for that change, or whether it is driven by short-term noise in the sector.',
    ['buy', 'sell'],
    ['news-reaction', 'recent-performance'],
  ),
  'deglobalization': rule(
    'information-discipline',
    'Deglobalization Consistency',
    'I believe supply chains are regionalizing and global trade is structurally shifting. I ask whether this trade reflects that structural change or is a reaction to near-term headlines.',
    ['buy', 'sell'],
    ['news-reaction', 'recent-performance'],
  ),
  'inflation-permanence': rule(
    'portfolio-structure',
    'Inflation Consistency',
    'I believe inflation is structurally elevated. I check whether this trade is consistent with holding real assets and reducing long-duration nominal exposure — or whether it quietly contradicts that conviction.',
    ['buy', 'sell'],
    ['news-reaction', 'price-drop-fear'],
  ),
  'crypto-future': rule(
    'emotional-discipline',
    'Crypto Conviction Consistency',
    'I believe in the long-term role of crypto. Before acting, I ask whether this trade is driven by my conviction in that future, or by short-term price movement pulling me in or out at the wrong moment.',
    ['buy', 'sell'],
    ['price-drop-fear', 'price-rise-fomo', 'recent-performance'],
  ),
  'hard-assets': rule(
    'portfolio-structure',
    'Hard Assets Consistency',
    'I believe hard assets preserve real value. Before reducing exposure to real assets, I ask whether my long-term view has changed — or whether I am reacting to short-term price pressure.',
    ['sell'],
    ['price-drop-fear', 'news-reaction'],
  ),
  'emerging-markets': rule(
    'information-discipline',
    'Emerging Markets Consistency',
    'I believe in the long-term growth potential of emerging markets. I check whether this trade is consistent with that thesis, or whether near-term volatility is causing me to act against my own conviction.',
    ['buy', 'sell'],
    ['recent-performance', 'news-reaction'],
  ),
  'debt-reckoning': rule(
    'portfolio-structure',
    'Debt Reckoning Consistency',
    'I believe a sovereign debt reckoning is coming. I ask whether this trade reflects that conviction — does it position me away from fiscal risk, or does it quietly increase my exposure to it?',
    ['buy', 'sell'],
    ['news-reaction', 'price-drop-fear'],
  ),
  'tech-supremacy': rule(
    'information-discipline',
    'Tech Supremacy Consistency',
    'I believe technology companies will continue to dominate global value creation. Before selling a tech position or buying outside tech, I ask whether this is a strategic reallocation or a reaction to short-term sentiment.',
    ['buy', 'sell'],
    ['recent-performance', 'social-comparison'],
  ),
  // 'status-quo' intentionally omitted — no conviction rule needed
};

// ─── Conditional rules (profile-driven) ──────────────────────────────────────

function conditionalRules(profile: UserProfile): SeedRule[] {
  const extra: SeedRule[] = [];

  // ── Risk tolerance ──────────────────────────────────────────────────────────
  if (profile.riskTolerance === 'conservative') {
    extra.push(rule(
      'position-sizing',
      'Concentration Limit',
      'I do not allocate more than 10% of my portfolio to any single position. Concentration amplifies both gains and losses — I prioritise protecting what I have.',
      ['buy'],
      ['price-rise-fomo', 'social-comparison', 'overconfidence'],
    ));
  }

  if (profile.riskTolerance === 'aggressive') {
    extra.push(
      rule(
        'emotional-discipline',
        'Conviction vs Overconfidence',
        'Before sizing up aggressively, I ask: is this high conviction backed by analysis, or overconfidence riding a recent win? The feeling is identical. The outcome rarely is.',
        ['buy'],
        ['overconfidence', 'price-rise-fomo'],
      ),
      rule(
        'timing',
        'Entry Criteria Check',
        'Before executing any trade, I confirm my entry criteria are met. I define what "ready to enter" means before I am in an emotional state. Feeling bullish is not a criterion.',
        ['buy'],
        ['overconfidence', 'price-rise-fomo', 'boredom'],
      ),
      rule(
        'timing',
        'Exit Plan First',
        'I do not enter a trade without knowing my exit condition — a price target, a time horizon, or a stop-loss level. Entry without an exit is not a strategy.',
        ['buy'],
        ['price-rise-fomo', 'overconfidence', 'social-comparison'],
      ),
    );
  }

  // ── Investment status ───────────────────────────────────────────────────────
  if (profile.investmentStatus === 'currently-invested') {
    extra.push(rule(
      'monitoring',
      'Price-Checking Frequency',
      'I do not check individual stock prices more than once per week. Frequent checking increases anxiety and the temptation to act on noise.',
      ['sell'],
      ['price-drop-fear', 'recent-performance'],
    ));
  }

  // ── Primary goal ────────────────────────────────────────────────────────────
  if (profile.primaryGoal === 'build-portfolio') {
    extra.push(rule(
      'portfolio-structure',
      'Core vs Satellite Allocation',
      'Before adding a new position, I confirm where it fits: core holdings (stable, long-term) or satellite (higher-risk, tactical). I do not blur this distinction.',
      ['buy'],
      ['social-comparison', 'price-rise-fomo', 'overconfidence'],
    ));
  }

  // ── Knowledge level ─────────────────────────────────────────────────────────
  if (profile.knowledgeLevel === 'beginner') {
    extra.push(rule(
      'information-discipline',
      'Research Before You React',
      'Before acting on any investment idea, I find at least one source beyond the place where I first heard it. Excitement is not research.',
      ['buy', 'sell'],
      ['social-comparison', 'price-rise-fomo', 'news-reaction', 'recent-performance'],
    ));
  }

  // ── Age range ───────────────────────────────────────────────────────────────
  if (profile.ageRange === '18-25') {
    extra.push(rule(
      'emotional-discipline',
      'Long Horizon Discipline',
      'At my stage, time is my greatest asset. I do not let short-term volatility drive me out of positions I chose for the right reasons. Selling in fear forfeits the most valuable thing I have — time.',
      ['sell'],
      ['price-drop-fear', 'recent-performance'],
    ));
  }

  if (profile.ageRange === '46-55') {
    extra.push(rule(
      'portfolio-structure',
      'Transition Awareness',
      'I am approaching a transition in my financial life. I consider whether each new decision supports or complicates that transition. Growth that introduces risk I cannot afford to carry is not growth.',
      ['buy'],
      ['price-rise-fomo', 'overconfidence'],
    ));
  }

  if (profile.ageRange === '55+') {
    extra.push(rule(
      'position-sizing',
      'Capital Preservation Gate',
      'At this stage, I apply a preservation filter to every new position. The question is not only what I could gain, but what I cannot afford to lose. If the answer to the second question is uncomfortable, I do not proceed.',
      ['buy'],
      ['price-rise-fomo', 'social-comparison', 'overconfidence'],
    ));
  }

  // ── Worldview ───────────────────────────────────────────────────────────────
  if (profile.worldview === 'long-term-growth') {
    extra.push(rule(
      'emotional-discipline',
      'Time Horizon Test',
      'I ask whether this decision serves my long-term growth objective or is a distraction from it. Short-term moves made within a long-term portfolio are usually noise. I treat them as such.',
      ['buy', 'sell'],
      ['recent-performance', 'price-drop-fear', 'price-rise-fomo'],
    ));
  }

  if (profile.worldview === 'income-stability') {
    extra.push(rule(
      'portfolio-structure',
      'Yield Test',
      'Before adding a new position, I ask whether it contributes to my income goals. Growth without yield is only part of the picture. I do not let price appreciation distract me from my primary objective.',
      ['buy'],
      ['price-rise-fomo', 'social-comparison', 'recent-performance'],
    ));
  }

  if (profile.worldview === 'values-driven') {
    extra.push(rule(
      'new-asset-class',
      'Values Alignment',
      "Before investing, I confirm this company's practices align with the values I have committed to. Returns I am not comfortable with are not returns at all.",
      ['buy'],
      ['price-rise-fomo', 'social-comparison'],
    ));
  }

  // ── Macro convictions ───────────────────────────────────────────────────────
  for (const conviction of profile.macroConvictions ?? []) {
    const convictionRule = CONVICTION_RULES[conviction];
    if (convictionRule) extra.push(convictionRule);
  }

  return extra;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function generateSeedRules(profile: UserProfile): SeedRule[] {
  return [...UNIVERSAL_RULES, ...conditionalRules(profile)];
}
