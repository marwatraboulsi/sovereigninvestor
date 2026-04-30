export type SkillId = 'etf-analyzer' | 'portfolio-reviewer' | 'market-catalyst-scanner' | 'stock-researcher';

export type KnowledgeLevel = 'beginner' | 'intermediate' | 'advanced';
export type InvestmentStatus = 'currently-invested' | 'planning-to-start' | 'just-exploring';
export type PrimaryGoal = 'understand-market' | 'build-portfolio' | 'learn-strategies';
export type ResponseStyle = 'conversational' | 'balanced' | 'comprehensive';
export type AgeRange = '18-25' | '26-35' | '36-45' | '46-55' | '55+';
export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive';
export type InvestmentWorldview = 'long-term-growth' | 'income-stability' | 'values-driven' | 'no-preference';

export type MacroConviction =
  | 'dollar-debasement'
  | 'us-decline'
  | 'ai-transformation'
  | 'climate-transition'
  | 'deglobalization'
  | 'inflation-permanence'
  | 'crypto-future'
  | 'hard-assets'
  | 'emerging-markets'
  | 'debt-reckoning'
  | 'tech-supremacy'
  | 'status-quo';

export interface UserProfile {
  knowledgeLevel: KnowledgeLevel;
  investmentStatus: InvestmentStatus;
  primaryGoal: PrimaryGoal;
  responseStyle: ResponseStyle;
  ageRange?: AgeRange;
  riskTolerance?: RiskTolerance;
  worldview?: InvestmentWorldview;
  macroConvictions?: MacroConviction[];
  worldviewNote?: string;
  onboardingComplete: boolean;
  enoughStatement?: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[]; // only on assistant messages
}

export type ModelTier = 'full-analysis' | 'simple-qa';

export interface FundManagerContext {
  vaultSummary?: string;      // formatted vault holdings
  recentAnalyses?: string;    // last 2-3 saved analysis titles + skill
  knowledgeChunks?: string;   // RAG-retrieved knowledge relevant to the current query
}

export interface ClaudeRequestOptions {
  skill?: SkillId;
  messages: Message[];
  modelOverride?: string;
  userProfile?: UserProfile;
  fundManagerContext?: FundManagerContext;
  timeoutMs?: number;
  /** Bypasses buildChatSystemPrompt / skill prompt. Used by Learn Mode. */
  systemPromptOverride?: string;
}

export interface ClaudeResponse {
  content: string;
  suggestions: string[];
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}

export interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttlMs: number;
}

// ─── Slides & Archive ─────────────────────────────────────────────────────────

export type SlideType = 'cover' | 'section' | 'bullets' | 'metrics' | 'summary';

export interface SlideMetric {
  label: string;
  value: string;
  note?: string;
}

export interface AnalysisSlide {
  type: SlideType;
  title: string;
  subtitle?: string;
  badge?: string;
  bullets?: string[];
  metrics?: SlideMetric[];
}

export interface SavedAnalysis {
  id: string;
  skillId: SkillId;
  skillName: string;
  title: string;
  createdAt: number;
  expiresAt: number;
  slideCount: number;
  slides: AnalysisSlide[];
}

// ─── Playbook ─────────────────────────────────────────────────────────────────

export type RuleCategory =
  | 'timing'
  | 'position-sizing'
  | 'emotional-discipline'
  | 'new-asset-class'
  | 'life-events'
  | 'tax-awareness'
  | 'portfolio-structure'
  | 'information-discipline'
  | 'monitoring';

export type RuleStatus = 'active' | 'paused' | 'removed';

export type RuleSourceTrigger =
  | 'onboarding-seed'
  | 'intercept-gap'
  | 'learn-mode'
  | 'manual';

export interface PlaybookRule {
  id: string;
  userId: string;
  category: RuleCategory;
  title: string;                    // short label, e.g. "Social Comparison / FOMO"
  body: string;                     // plain English rule text shown to user
  structuredConditions?: object;    // machine-readable conditions (JSON), optional
  sourceTrigger: RuleSourceTrigger;
  createdAt: number;                // unix timestamp
  status: RuleStatus;
  overrideCount: number;            // how many times Conscious Proceed bypassed this rule
}

// ─── Decision Log ─────────────────────────────────────────────────────────────

export type DecisionType = 'hold' | 'sell' | 'buy' | 'wait' | 'unsure';

export type VerdictType = 'follow-playbook' | 'conscious-proceed' | 'no-rules-matched';

export type DecisionTrigger =
  | 'price-drop-fear'
  | 'price-rise-fomo'
  | 'social-comparison'
  | 'recent-performance'
  | 'news-reaction'
  | 'overconfidence'
  | 'regret-avoidance'
  | 'boredom'
  | 'unsure';

export interface DecisionLog {
  id: string;
  userId: string;
  ticker: string;
  assetName: string;
  decisionType: DecisionType;
  emotionalTriggers: DecisionTrigger[];
  rulesMatched: string[];           // array of PlaybookRule IDs
  verdict: VerdictType;
  overrideReason?: string;          // populated if conscious-proceed
  tradeExecuted?: boolean;          // did they actually make the trade? (conscious-proceed only)
  priceAtDecision: number;
  currency: string;
  createdAt: number;
  notes?: string;
}

// ─── Price Snapshots (Outcome Tracker) ────────────────────────────────────────

export interface PriceSnapshot {
  id: string;
  decisionLogId: string;
  ticker: string;
  price: number;
  currency: string;
  snapshotAt: number;               // unix timestamp
  daysFromDecision: number;         // 0 = at decision, 7, 30, 60, 90
}

// ─── Convictions ──────────────────────────────────────────────────────────────

// ConvictionTheme matches MacroConviction exactly (including 'status-quo') so
// that the Phase 8 migration can map every existing macroConvictions[] value
// to a Conviction record without loss.
export type ConvictionTheme =
  | 'dollar-debasement'
  | 'us-decline'
  | 'ai-transformation'
  | 'climate-transition'
  | 'deglobalization'
  | 'inflation-permanence'
  | 'crypto-future'
  | 'hard-assets'
  | 'emerging-markets'
  | 'debt-reckoning'
  | 'tech-supremacy'
  | 'status-quo';

export type ConvictionBelief = 'yes' | 'no' | 'still-forming';
export type ConvictionConfidence = 'low' | 'medium' | 'high';

export interface Conviction {
  id: string;
  userId: string;
  theme: ConvictionTheme;
  belief: ConvictionBelief;
  confidence: ConvictionConfidence;
  note?: string;                    // user's own words about this conviction
  createdAt: number;
  updatedAt: number;
  sourceTrigger: string;            // e.g. "catalyst-scanner", "learn-mode", "manual", "migrated"
}

// ─── Intercept Session (in-progress wizard state) ─────────────────────────────

export interface InterceptSession {
  ticker: string;
  assetName: string;
  decisionType: DecisionType | null;
  emotionalTriggers: DecisionTrigger[];
  rulesMatched: PlaybookRule[];
  playbookGapDetected: boolean;
  currentStep: 1 | 2 | 3 | 4;
}
