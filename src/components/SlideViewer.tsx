import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { AppLogo } from './AppLogo';
import type { AnalysisSlide, SkillId } from '@/types';

import { BG, S1, S2, W, G1, G2, G3, SERIF, BODY } from '@/theme';

const SKILL_ACCENT: Record<string, string> = {
  'etf-analyzer':           '#8B5CF6',
  'portfolio-reviewer':     '#3B82F6',
  'stock-researcher':       '#F59E0B',
  'market-catalyst-scanner':'#10B981',
};

interface Props {
  slides: AnalysisSlide[];
  skillId: SkillId;
}

export function SlideViewer({ slides, skillId }: Props) {
  const { width } = useWindowDimensions();
  const [page, setPage]   = useState(0);
  const scrollRef         = useRef<ScrollView>(null);
  const accent            = SKILL_ACCENT[skillId] ?? W;

  return (
    <View style={s.root}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        onMomentumScrollEnd={(e) => {
          const next = Math.round(e.nativeEvent.contentOffset.x / width);
          setPage(next);
        }}
        scrollEventThrottle={16}
      >
        {slides.map((slide, i) => (
          <SlideCard
            key={i}
            slide={slide}
            width={width}
            accent={accent}
            isFirst={i === 0}
            isLast={i === slides.length - 1}
            pageNum={i + 1}
            total={slides.length}
          />
        ))}
      </ScrollView>

      {/* Dot pagination */}
      <View style={s.dots}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={[
              s.dot,
              i === page
                ? [s.dotActive, { backgroundColor: accent }]
                : s.dotInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Individual slide card ────────────────────────────────────────────────────

interface CardProps {
  slide: AnalysisSlide;
  width: number;
  accent: string;
  isFirst: boolean;
  isLast: boolean;
  pageNum: number;
  total: number;
}

function SlideCard({ slide, width, accent, isFirst, isLast, pageNum, total }: CardProps) {
  const { type } = slide;

  return (
    <View style={[s.card, { width }]}>
      {/* Watermark logo - every slide */}
      <View style={s.watermark}>
        <AppLogo size={16} color={G3} />
      </View>

      {/* Page counter */}
      <Text style={s.counter}>{pageNum} / {total}</Text>

      {/* ── Cover ── */}
      {type === 'cover' && (
        <View style={s.coverContent}>
          <View style={[s.accentLine, { backgroundColor: accent }]} />
          <View style={s.logoLarge}>
            <AppLogo size={36} color={W} />
          </View>
          <Text style={s.coverTitle}>{slide.title}</Text>
          {slide.subtitle ? (
            <Text style={s.coverSubtitle}>{slide.subtitle}</Text>
          ) : null}
          {slide.badge ? (
            <View style={[s.badge, { borderColor: accent }]}>
              <Text style={[s.badgeText, { color: accent }]}>{slide.badge}</Text>
            </View>
          ) : null}
        </View>
      )}

      {/* ── Section ── */}
      {type === 'section' && (
        <View style={s.sectionContent}>
          {slide.badge ? (
            <Text style={[s.sectionBadge, { color: accent }]}>{slide.badge}</Text>
          ) : null}
          <View style={[s.sectionLine, { backgroundColor: accent }]} />
          <Text style={s.sectionTitle}>{slide.title}</Text>
          {slide.subtitle ? (
            <Text style={s.sectionSubtitle}>{slide.subtitle}</Text>
          ) : null}
        </View>
      )}

      {/* ── Bullets ── */}
      {type === 'bullets' && (
        <View style={s.bulletsContent}>
          {slide.badge ? (
            <Text style={[s.slideBadge, { color: accent }]}>{slide.badge}</Text>
          ) : null}
          <Text style={s.slideTitle}>{slide.title}</Text>
          <View style={[s.divider, { backgroundColor: accent }]} />
          <View style={s.bulletList}>
            {(slide.bullets ?? []).map((b, i) => (
              <View key={i} style={s.bulletRow}>
                <View style={[s.bulletDot, { backgroundColor: accent }]} />
                <Text style={s.bulletText}>{b}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Metrics ── */}
      {type === 'metrics' && (
        <View style={s.metricsContent}>
          {slide.badge ? (
            <Text style={[s.slideBadge, { color: accent }]}>{slide.badge}</Text>
          ) : null}
          <Text style={s.slideTitle}>{slide.title}</Text>
          <View style={[s.divider, { backgroundColor: accent }]} />
          <View style={s.metricsGrid}>
            {(slide.metrics ?? []).map((m, i) => (
              <View key={i} style={[s.metricCard, { borderColor: G3 }]}>
                <Text style={[s.metricValue, { color: accent }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.5}>
                  {m.value}
                </Text>
                <Text style={s.metricLabel}>{m.label}</Text>
                {m.note ? <Text style={s.metricNote}>{m.note}</Text> : null}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Summary ── */}
      {type === 'summary' && (
        <View style={s.summaryContent}>
          <View style={s.summaryHeader}>
            <AppLogo size={28} color={accent} />
            <Text style={[s.summaryTitle, { color: accent }]}>{slide.title}</Text>
          </View>
          <View style={[s.divider, { backgroundColor: accent }]} />
          <View style={s.bulletList}>
            {(slide.bullets ?? []).map((b, i) => (
              <View key={i} style={s.bulletRow}>
                <View style={[s.bulletDot, { backgroundColor: accent }]} />
                <Text style={s.bulletText}>{b}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  card: {
    flex: 1,
    backgroundColor: S1,
    paddingHorizontal: 28,
    paddingVertical: 40,
    justifyContent: 'center',
  },

  watermark: {
    position: 'absolute',
    bottom: 52,
    right: 20,
    opacity: 0.6,
  },
  counter: {
    position: 'absolute',
    top: 20,
    right: 24,
    fontSize: 11,
    color: G2,
    fontWeight: '500',
  },

  // Cover
  coverContent: { alignItems: 'flex-start', gap: 16 },
  accentLine:   { width: 40, height: 3, borderRadius: 2, marginBottom: 8 },
  logoLarge:    { marginBottom: 8 },
  coverTitle:   { fontSize: 34, fontWeight: '700', color: W, letterSpacing: -0.5, lineHeight: 40, fontFamily: SERIF },
  coverSubtitle:{ fontSize: 16, color: G1, lineHeight: 24, marginTop: 4, fontFamily: BODY },
  badge: {
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },

  // Section
  sectionContent: { gap: 12 },
  sectionBadge:   { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  sectionLine:    { width: 48, height: 3, borderRadius: 2 },
  sectionTitle:   { fontSize: 30, fontWeight: '700', color: W, letterSpacing: -0.3, lineHeight: 36, fontFamily: SERIF },
  sectionSubtitle:{ fontSize: 15, color: G1, lineHeight: 22, marginTop: 4, fontFamily: BODY },

  // Shared
  slideBadge: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 4 },
  slideTitle: { fontSize: 22, fontWeight: '700', color: W, letterSpacing: -0.2, lineHeight: 28 },
  divider:    { width: 36, height: 2, borderRadius: 1, marginVertical: 16 },

  // Bullets
  bulletsContent: {},
  bulletList:     { gap: 14, marginTop: 4 },
  bulletRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  bulletDot:      { width: 6, height: 6, borderRadius: 3, marginTop: 7, flexShrink: 0 },
  bulletText:     { fontSize: 15, color: G1, lineHeight: 22, flex: 1, fontFamily: BODY },

  // Metrics
  metricsContent: {},
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  metricCard: {
    flex: 1,
    minWidth: '44%',
    backgroundColor: S2,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 4,
  },
  metricValue: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  metricLabel: { fontSize: 12, color: G2, fontWeight: '500' },
  metricNote:  { fontSize: 11, color: G2, marginTop: 2 },

  // Summary
  summaryContent: { gap: 0 },
  summaryHeader:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 0 },
  summaryTitle:   { fontSize: 22, fontWeight: '700', letterSpacing: -0.2 },

  // Pagination
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 6,
    backgroundColor: S1,
  },
  dot:        { width: 6, height: 6, borderRadius: 3 },
  dotActive:  { width: 20, borderRadius: 3 },
  dotInactive:{ backgroundColor: G3 },
});
