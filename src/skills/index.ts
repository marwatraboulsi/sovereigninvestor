import { SkillId } from '@/types';
import { ETF_ANALYZER_SYSTEM_PROMPT } from './etfAnalyzer';
import { PORTFOLIO_REVIEWER_SYSTEM_PROMPT } from './portfolioReviewer';
import { CATALYST_SCANNER_SYSTEM_PROMPT } from './catalystScanner';
import { STOCK_RESEARCHER_SYSTEM_PROMPT } from './stockResearcher';

export const SKILL_METADATA: Record<
  SkillId,
  {
    id: SkillId;
    name: string;
    description: string;
    placeholder: string;
    framework: string;
    loadingMessage: string;
  }
> = {
  'etf-analyzer': {
    id: 'etf-analyzer',
    name: 'ETF Analyzer',
    description: 'Evaluate any ETF using the MACE framework',
    placeholder: 'Try: "Analyze VOO" or "Compare VOO and QQQ"',
    framework: 'MACE (Mandate, Assets, Composition, Expense)',
    loadingMessage: "Pulling live fund data and building your MACE scorecard. We're searching across multiple sources to get you accurate, up to date numbers.",
  },
  'portfolio-reviewer': {
    id: 'portfolio-reviewer',
    name: 'Portfolio Reviewer',
    description: 'Review your portfolio for hidden risks and gaps',
    placeholder: 'Describe your portfolio or tap the button below to import from your Vault.',
    framework: 'Four-Dimension Review',
    loadingMessage: "Reviewing your portfolio across allocation, diversification, risk, and archetype fit. Give it a moment. Good analysis takes a little time.",
  },
  'market-catalyst-scanner': {
    id: 'market-catalyst-scanner',
    name: 'Market Catalyst Scanner',
    description: 'Classify market events by type and duration',
    placeholder: 'Try: "Analyze the impact of recent Fed rate decisions"',
    framework: 'Five-Category Catalyst Framework',
    loadingMessage: "Scanning live market data and mapping catalysts across our five-category framework. We're reading current sources to make sure this is relevant to right now.",
  },
  'stock-researcher': {
    id: 'stock-researcher',
    name: 'Stock Researcher',
    description: 'Deep due diligence on any publicly traded company',
    placeholder: 'Name a stock or company to begin',
    framework: '8 Phase Due Diligence · Deep Research',
    loadingMessage: "Running your 8 phase deep dive. This one takes a bit longer. We're searching filings, financials, news, and analyst data across every phase to build a thorough picture.",
  },
};

export function getSkillSystemPrompt(skillId: SkillId): string {
  switch (skillId) {
    case 'etf-analyzer':
      return ETF_ANALYZER_SYSTEM_PROMPT;
    case 'portfolio-reviewer':
      return PORTFOLIO_REVIEWER_SYSTEM_PROMPT;
    case 'market-catalyst-scanner':
      return CATALYST_SCANNER_SYSTEM_PROMPT;
    case 'stock-researcher':
      return STOCK_RESEARCHER_SYSTEM_PROMPT;
  }
}

export {
  ETF_ANALYZER_SYSTEM_PROMPT,
  PORTFOLIO_REVIEWER_SYSTEM_PROMPT,
  CATALYST_SCANNER_SYSTEM_PROMPT,
  STOCK_RESEARCHER_SYSTEM_PROMPT,
};
