import { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { SkillId } from '@/types';
import { SKILL_METADATA } from '@/skills';
import { GOLD, G1, G2, S1, LINE } from '@/theme';

// Expected analysis durations in milliseconds (used for progress estimation)
const EXPECTED_DURATIONS: Record<SkillId, number> = {
  'stock-researcher':        90_000,
  'etf-analyzer':            40_000,
  'portfolio-reviewer':      35_000,
  'market-catalyst-scanner': 50_000,
};

interface Props {
  skillId: SkillId;
  streamingText: string;
  elapsedMs: number;
}

/**
 * Shows a gold progress bar + percentage + current phase label while
 * Claude is streaming a skill analysis. The percentage is derived from
 * elapsed time against the expected duration (capped at 95% until done).
 * The phase label is extracted from `## ` or `**Phase` headings in the
 * streaming text so the user sees what Claude is working on.
 */
export function SkillProgress({ skillId, streamingText, elapsedMs }: Props) {
  const expectedDuration = EXPECTED_DURATIONS[skillId];
  const rawPercent = (elapsedMs / expectedDuration) * 100;
  const percent = Math.min(95, rawPercent);

  // Detect current phase from streaming text
  const currentPhase = detectPhase(streamingText);
  const fallbackLabel = SKILL_METADATA[skillId].loadingMessage;

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
          {currentPhase ?? fallbackLabel}
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
function detectPhase(text: string): string | null {
  if (!text) return null;
  const lines = text.split('\n');
  let lastPhase: string | null = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) {
      lastPhase = trimmed.replace(/^##\s*/, '');
    } else if (trimmed.startsWith('**Phase')) {
      // e.g. **Phase 3: Competitive Moat**
      lastPhase = trimmed.replace(/^\*\*/, '').replace(/\*\*$/, '');
    }
  }
  return lastPhase;
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
