import { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { SkillId } from '@/types';
import { GOLD, G1, S1, LINE } from '@/theme';

// Expected analysis durations in milliseconds (used for progress estimation)
const EXPECTED_DURATIONS: Record<SkillId, number> = {
  'stock-researcher':        280_000, // 8 phases: 6 × ~30s + phases 4 & 7 × ~45s + phase 8 ~20s
  'etf-analyzer':            40_000,
  'portfolio-reviewer':      35_000,
  'market-catalyst-scanner': 50_000,
};

// Time-based phase messages per skill.
// Each entry is [threshold_percent, label].
// The label shown is the last one whose threshold is <= current percent.
const TIME_PHASES: Record<SkillId, Array<[number, string]>> = {
  'etf-analyzer': [
    [0,  'Pulling live fund data from multiple sources…'],
    [25, 'Building your MACE scorecard…'],
    [50, 'Analysing cost, efficiency, and market exposure…'],
    [72, 'Running comparative analysis…'],
    [88, 'Compiling your final scorecard and verdict…'],
  ],
  'portfolio-reviewer': [
    [0,  'Loading your portfolio holdings…'],
    [25, 'Analysing allocation and diversification…'],
    [55, 'Evaluating risk profile and archetype fit…'],
    [78, 'Building your recommendations…'],
  ],
  'market-catalyst-scanner': [
    [0,  'Scanning live market data…'],
    [22, 'Identifying catalysts across our five-category framework…'],
    [50, 'Assessing impact, timing, and conviction levels…'],
    [75, 'Compiling your catalyst report…'],
  ],
  'stock-researcher': [
    [0,  'Researching company fundamentals…'],
    [14, 'Pulling financial filings and earnings data…'],
    [28, 'Analysing competitive position and moat…'],
    [42, 'Scanning recent news and analyst coverage…'],
    [58, 'Evaluating management quality and risk factors…'],
    [72, 'Modelling valuation scenarios…'],
    [86, 'Compiling your investment thesis…'],
  ],
};

interface Props {
  skillId: SkillId;
  streamingText: string;
  elapsedMs: number;
  /** Explicit phase label (from phased stock analysis). Overrides all other detection. */
  phaseLabel?: string | null;
}

/**
 * Shows a gold progress bar + percentage + current phase label while
 * Claude is streaming a skill analysis.
 *
 * Phase label priority:
 *  1. Explicit phaseLabel prop (from phased stock-researcher orchestration)
 *  2. A heading detected in the streaming text (`## ` or `**Phase`)
 *  3. A time-based label derived from elapsed % against expected duration
 */
export function SkillProgress({ skillId, streamingText, elapsedMs, phaseLabel: explicitPhaseLabel }: Props) {
  const expectedDuration = EXPECTED_DURATIONS[skillId];
  const rawPercent = (elapsedMs / expectedDuration) * 100;
  const percent = Math.min(95, rawPercent);

  // Phase label priority: explicit → streaming text heading → time-based
  const streamPhase = detectPhaseFromText(streamingText);
  const timePhase   = detectPhaseFromTime(skillId, percent);
  const phaseLabel  = explicitPhaseLabel ?? streamPhase ?? timePhase;

  // Animated progress bar width
  const animWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animWidth, {
      toValue: percent,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [percent, animWidth]);

  const barWidth = animWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.phaseLabel} numberOfLines={2}>
          {phaseLabel}
        </Text>
        <Text style={styles.percent}>{Math.round(percent)}%</Text>
      </View>

      {/* Progress bar track */}
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: barWidth }]} />
      </View>
    </View>
  );
}

/** Scan streaming text for the last `## ` or `**Phase` heading */
function detectPhaseFromText(text: string): string | null {
  if (!text) return null;
  const lines = text.split('\n');
  let lastPhase: string | null = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) {
      lastPhase = trimmed.replace(/^##\s*/, '');
    } else if (trimmed.startsWith('**Phase')) {
      lastPhase = trimmed.replace(/^\*\*/, '').replace(/\*\*$/, '');
    }
  }
  return lastPhase;
}

/** Return the time-based phase label for the current progress percentage */
function detectPhaseFromTime(skillId: SkillId, percent: number): string {
  const phases = TIME_PHASES[skillId];
  let label = phases[0][1];
  for (const [threshold, msg] of phases) {
    if (percent >= threshold) label = msg;
  }
  return label;
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  phaseLabel: {
    flex: 1,
    color: G1,
    fontSize: 13,
    lineHeight: 18,
  },
  percent: {
    color: GOLD,
    fontSize: 13,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
  },
  track: {
    height: 3,
    backgroundColor: S1,
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  fill: {
    height: '100%',
    backgroundColor: GOLD,
    borderRadius: 2,
  },
});
