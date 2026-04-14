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
