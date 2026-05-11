/**
 * RuleCard — shared expandable rule card.
 *
 * Collapsed:  category tag · title · body preview
 * Expanded:   full body + three metadata rows:
 *               ORIGIN        (sourceTrigger → human label + creation date)
 *               GUARDS AGAINST (category → bias name)
 *               OVERRIDE COUNT (how many times conscious-proceeded)
 *
 * Usage:
 *   <RuleCard rule={rule} />                  — manages its own expand state
 *   <RuleCard rule={rule} expanded={false} />  — controlled
 */

import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { PlaybookRule, RuleCategory, RuleSourceTrigger } from '@/types';
import {
  BG_DEEP, S1, S_HIGH, S_HIGHEST, LINE,
  GOLD, W, G1, G2, G3,
  R, R_SM, SERIF, SERIF_SEMI, SERIF_BOLD, BODY,
} from '@/theme';

// ─── Derivation maps ──────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<RuleCategory, string> = {
  'timing':                 'Timing',
  'position-sizing':        'Position sizing',
  'emotional-discipline':   'Emotional discipline',
  'new-asset-class':        'New asset class',
  'life-events':            'Life events',
  'tax-awareness':          'Tax awareness',
  'portfolio-structure':    'Portfolio structure',
  'information-discipline': 'Information discipline',
  'monitoring':             'Monitoring',
};

const BIAS_LABEL: Record<RuleCategory, string> = {
  'timing':                 'Action bias · Impatience',
  'position-sizing':        'Overconfidence · Gambler\'s fallacy',
  'emotional-discipline':   'Loss aversion · FOMO · Recency bias',
  'new-asset-class':        'Novelty bias · Shiny object syndrome',
  'life-events':            'Emotional decision-making',
  'tax-awareness':          'Mental accounting',
  'portfolio-structure':    'Home bias · Concentration risk',
  'information-discipline': 'Confirmation bias · Narrative fallacy',
  'monitoring':             'Anxiety · Hypervigilance · Over-trading',
};

const SOURCE_LABEL: Record<RuleSourceTrigger, string> = {
  'manual':          'Written by you',
  'onboarding-seed': 'Added at setup',
  'intercept-gap':   'Created after an Intercept session',
  'learn-mode':      'Created after a Learn session',
};

const SEED_RULE_REASON: Record<string, string> = {
  // Universal
  'Recency Bias':                   'Added for all investors — recent price movement is one of the most reliably misleading signals.',
  'Social Comparison / FOMO':       'Added for all investors — comparing returns with others is a leading cause of mistimed decisions.',
  'The Pause Rule':                 'Added for all investors — urgency in investing is almost always manufactured, not real.',
  'News Reaction':                  'Added for all investors — by the time a headline is public, markets have already priced it.',
  // Risk tolerance
  'Concentration Limit':            'Added because you identified as a conservative investor — concentration amplifies losses in ways that cut against capital preservation.',
  'Conviction vs Overconfidence':   'Added because you identified as an aggressive investor — high conviction and overconfidence feel identical in the moment.',
  'Entry Criteria Check':           'Added because you identified as an aggressive investor — defined criteria prevent emotional entries.',
  'Exit Plan First':                'Added because you identified as an aggressive investor — entering without an exit condition is not a strategy.',
  // Investment status
  'Price-Checking Frequency':       'Added because you are currently investing — frequent price checks increase anxiety and the urge to act on noise.',
  // Primary goal
  'Core vs Satellite Allocation':   'Added because your goal is to build and grow a portfolio — blurring core and satellite positions erodes structure.',
  // Knowledge level
  'Research Before You React':      'Added because you are building your investing knowledge — excitement about an idea is not the same as understanding it.',
  // Age
  'Long Horizon Discipline':        'Added because at your stage, time is your most valuable asset — volatility only matters if you sell into it.',
  'Transition Awareness':           'Added because you are approaching an important financial life transition — growth that introduces unaffordable risk is not growth.',
  'Capital Preservation Gate':      'Added because at your stage, protecting what you have built matters as much as growing it.',
  // Worldview
  'Time Horizon Test':              'Added because you identified as a long-term growth investor — short-term moves inside a long-term portfolio are usually noise.',
  'Yield Test':                     'Added because you identified as an income and stability investor — price appreciation without yield is only half the picture.',
  'Values Alignment':               'Added because you identified as a values-driven investor — returns you are not comfortable with are not returns at all.',
  // Conviction rules
  'Dollar Debasement Consistency':  'Added because of your conviction that the dollar loses purchasing power over time.',
  'US Decline Consistency':         'Added because of your conviction that US economic dominance is structurally declining.',
  'AI Conviction Consistency':      'Added because of your conviction that AI is a defining force of this decade.',
  'Climate Transition Consistency': 'Added because of your conviction that the energy transition is a generational shift.',
  'Deglobalization Consistency':    'Added because of your conviction that global supply chains are structurally shifting.',
  'Inflation Consistency':          'Added because of your conviction that inflation is structurally elevated.',
  'Crypto Conviction Consistency':  'Added because of your conviction in the long-term role of crypto.',
  'Hard Assets Consistency':        'Added because of your conviction that hard assets preserve real value.',
  'Emerging Markets Consistency':   'Added because of your conviction in the long-term growth potential of emerging markets.',
  'Debt Reckoning Consistency':     'Added because of your conviction that a sovereign debt reckoning is coming.',
  'Tech Supremacy Consistency':     'Added because of your conviction that technology companies will continue to dominate value creation.',
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ─── Chevron icon ──────────────────────────────────────────────────────────────

function Chevron({ open, color = G3 }: { open: boolean; color?: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path
        d={open ? 'M18 15 L12 9 L6 15' : 'M6 9 L12 15 L18 9'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface RuleCardProps {
  rule:         PlaybookRule;
  expanded?:    boolean;          // controlled; if undefined → self-managed
  onPress?:     () => void;       // optional external handler
  onLongPress?: () => void;       // long-press for contextual actions (edit/pause/delete)
  dimmed?:      boolean;          // paused/removed rules
}

export function RuleCard({ rule, expanded: controlledExpanded, onPress, onLongPress, dimmed = false }: RuleCardProps) {
  const [selfExpanded, setSelfExpanded] = useState(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : selfExpanded;

  function handlePress() {
    if (onPress) {
      onPress();
    } else {
      setSelfExpanded((v) => !v);
    }
  }

  const categoryLabel   = CATEGORY_LABEL[rule.category] ?? rule.category;
  const biasLabel       = BIAS_LABEL[rule.category]     ?? '—';
  const sourceLabel     = SOURCE_LABEL[rule.sourceTrigger] ?? 'Unknown origin';
  const dateLabel       = formatDate(rule.createdAt);
  const overrideCount   = rule.overrideCount ?? 0;

  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      style={[s.card, isExpanded && s.cardExpanded, dimmed && s.cardDimmed]}
    >
      {/* Gold left accent */}
      <View style={[s.accent, dimmed && s.accentDimmed]} />

      <View style={s.inner}>

        {/* ── Collapsed header (always visible) ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.categoryTag}>{categoryLabel}</Text>
            <Text style={[s.title, dimmed && s.titleDimmed]}>{rule.title}</Text>
          </View>
          <Chevron open={isExpanded} color={isExpanded ? GOLD : G3} />
        </View>

        {/* Body preview (collapsed) or full body (expanded) */}
        <Text
          style={[s.body, isExpanded && s.bodyExpanded, dimmed && s.bodyDimmed]}
          numberOfLines={isExpanded ? undefined : 2}
        >
          {rule.body}
        </Text>

        {/* ── Expanded metadata ── */}
        {isExpanded && (
          <View style={s.meta}>

            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Origin</Text>
              <View style={s.metaValueCol}>
                <Text style={s.metaValue}>
                  {rule.sourceTrigger === 'onboarding-seed' && SEED_RULE_REASON[rule.title]
                    ? SEED_RULE_REASON[rule.title]
                    : sourceLabel}
                  <Text style={s.metaDate}> · {dateLabel}</Text>
                </Text>
              </View>
            </View>

            <View style={s.metaDivider} />

            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Guards against</Text>
              <Text style={[s.metaValue, s.metaBias]}>{biasLabel}</Text>
            </View>

            {overrideCount > 0 && (
              <>
                <View style={s.metaDivider} />
                <View style={s.metaRow}>
                  <Text style={s.metaLabel}>Overridden</Text>
                  <Text style={[s.metaValue, s.metaOverride]}>
                    {overrideCount} time{overrideCount !== 1 ? 's' : ''}
                    <Text style={s.metaOverrideSub}> — consciously proceeded</Text>
                  </Text>
                </View>
              </>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: S1,
    borderRadius: R,
    overflow: 'hidden',
  },
  cardExpanded: {
    backgroundColor: S_HIGH,
  },
  cardDimmed: {
    opacity: 0.55,
  },

  accent: {
    width: 2,
    backgroundColor: GOLD,
  },
  accentDimmed: {
    backgroundColor: G3,
  },

  inner: {
    flex: 1,
    padding: 14,
    gap: 6,
  },

  // ── Header row ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerLeft: {
    flex: 1,
    gap: 3,
  },

  categoryTag: {
    fontSize: 10,
    fontFamily: BODY,
    color: GOLD,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  title: {
    fontSize: 15,
    fontFamily: SERIF_SEMI,
    color: W,
    lineHeight: 21,
  },
  titleDimmed: {
    color: G1,
  },

  // ── Body ────────────────────────────────────────────────────────────────────
  body: {
    fontSize: 13,
    fontFamily: BODY,
    color: G2,
    lineHeight: 19,
  },
  bodyExpanded: {
    color: G1,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 2,
  },
  bodyDimmed: {
    color: G3,
  },

  // ── Expanded metadata block ──────────────────────────────────────────────────
  meta: {
    marginTop: 12,
    backgroundColor: BG_DEEP,
    borderRadius: R_SM,
    padding: 12,
    gap: 0,
  },
  metaDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: LINE,
    marginVertical: 8,
  },
  metaRow: {
    gap: 3,
  },
  metaValueCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 9,
    fontFamily: BODY,
    color: G3,
    textTransform: 'uppercase',
    letterSpacing: 1.0,
  },
  metaValue: {
    fontSize: 13,
    fontFamily: BODY,
    color: G1,
    lineHeight: 18,
  },
  metaDate: {
    color: G3,
    fontSize: 12,
  },
  metaBias: {
    fontStyle: 'italic',
    color: GOLD,
    fontFamily: SERIF,
  },
  metaOverride: {
    color: W,
  },
  metaOverrideSub: {
    color: G2,
    fontSize: 12,
  },
});
