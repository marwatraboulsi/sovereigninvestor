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
              <Text style={s.metaValue}>
                {sourceLabel}
                <Text style={s.metaDate}> · {dateLabel}</Text>
              </Text>
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
