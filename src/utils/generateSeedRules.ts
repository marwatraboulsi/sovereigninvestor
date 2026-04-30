/**
 * generateSeedRules — Phase 3B
 *
 * Takes a UserProfile and returns an array of PlaybookRule objects ready for
 * insertion (without id / userId / createdAt / overrideCount — those are
 * supplied by usePlaybook.addRule at insert time).
 */

import type { UserProfile, PlaybookRule, RuleCategory } from '@/types';

type SeedRule = Omit<PlaybookRule, 'id' | 'userId' | 'createdAt' | 'overrideCount'>;

function rule(
  category: RuleCategory,
  title: string,
  body: string,
): SeedRule {
  return {
    category,
    title,
    body,
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
  ),
  rule(
    'emotional-discipline',
    'Social Comparison / FOMO',
    'I do not buy an asset because others around me are profiting from it. Their entry price, risk tolerance, and time horizon are not mine.',
  ),
  rule(
    'timing',
    'The Pause Rule',
    'Before executing any non-scheduled investment decision, I pause and check my playbook. Urgency is almost never real.',
  ),
  rule(
    'information-discipline',
    'News Reaction',
    'I do not make portfolio decisions in direct response to news headlines. By the time a headline is public, the market has already priced it.',
  ),
];

// ─── Conditional rules (based on profile) ────────────────────────────────────

function conditionalRules(profile: UserProfile): SeedRule[] {
  const extra: SeedRule[] = [];

  if (profile.riskTolerance === 'conservative') {
    extra.push(rule(
      'position-sizing',
      'Concentration Limit',
      'I do not allocate more than 10% of my portfolio to any single position. Concentration amplifies both gains and losses — I prioritise protecting what I have.',
    ));
  }

  if (profile.riskTolerance === 'aggressive') {
    extra.push(rule(
      'emotional-discipline',
      'Conviction vs Overconfidence',
      'Before sizing up aggressively, I ask: is this high conviction backed by analysis, or overconfidence riding a recent win? The feeling is identical. The outcome rarely is.',
    ));
  }

  if (profile.investmentStatus === 'currently-invested') {
    extra.push(rule(
      'monitoring',
      'Price-Checking Frequency',
      'I do not check individual stock prices more than once per week. Frequent checking increases anxiety and the temptation to act on noise.',
    ));
  }

  if (profile.primaryGoal === 'build-portfolio') {
    extra.push(rule(
      'portfolio-structure',
      'Core vs Satellite Allocation',
      'Before adding a new position, I confirm where it fits: core holdings (stable, long-term) or satellite (higher-risk, tactical). I do not blur this distinction.',
    ));
  }

  return extra;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function generateSeedRules(profile: UserProfile): SeedRule[] {
  return [...UNIVERSAL_RULES, ...conditionalRules(profile)];
}
