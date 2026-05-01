/**
 * First-run orientation — 3 slides, Nora-voiced.
 *
 * Shown once: triggered from the chat tab on first open.
 * AsyncStorage key: 'orientation_seen'
 *
 * Design: full-screen editorial, each slide has one idea.
 * Nora identifier (gold rule + italic label) authors each thought.
 * No animations — one thought at a time, by design.
 */

import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  BG, BG_DEEP, S1, GOLD, W, G1, G2, G3,
  ON_PRIMARY, R_SM, SERIF, SERIF_BOLD, BODY,
} from '@/theme';

const ORIENTATION_KEY = 'orientation_seen';
const { width: W_SCREEN } = Dimensions.get('window');

// ─── Slide content ────────────────────────────────────────────────────────────

const SLIDES = [
  {
    eyebrow: 'Welcome',
    heading: 'Most tools give you more to look at.',
    subheading: 'This one gives you less to regret.',
    body: 'Sovereign Investor is a behavioral system, not a research platform. Most investing mistakes aren\'t caused by ignorance. They\'re caused by acting on feeling before thinking.\n\nThis app exists for the pause between impulse and action.',
  },
  {
    eyebrow: 'Your first move',
    heading: 'Your Playbook is the only authority here.',
    subheading: null,
    body: 'Before anything else works, you need at least one rule.\n\nGo to Profile → Playbook and write one rule that\'s true for how you invest. It doesn\'t need to be clever. It needs to exist.\n\nEvery Intercept, every logged decision, every conversation with me begins there.',
  },
  {
    eyebrow: 'The system',
    heading: 'When the impulse comes — run it through Intercept.',
    subheading: null,
    body: 'Before you buy or sell anything, open the Intercept tab. Your rules become the checkpoint. You\'ll see exactly which rule applies and why. Then you decide consciously.\n\nThat pause is the whole point.\n\nI\'ll be here when you need to think something through.',
  },
];

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function OrientationScreen() {
  const insets = useSafeAreaInsets();
  const [slide, setSlide] = useState(0);
  const isLast = slide === SLIDES.length - 1;
  const current = SLIDES[slide];

  async function markSeen() {
    await AsyncStorage.setItem(ORIENTATION_KEY, 'true');
  }

  async function handleNext() {
    if (isLast) {
      await markSeen();
      router.replace('/(tabs)/chat');
    } else {
      setSlide((s) => s + 1);
    }
  }

  async function handleSkip() {
    await markSeen();
    router.replace('/(tabs)/chat');
  }

  return (
    <View style={[s.bg, { paddingTop: insets.top }]}>

      {/* Skip — only on non-final slides */}
      <View style={s.skipRow}>
        {!isLast ? (
          <TouchableOpacity onPress={handleSkip} activeOpacity={0.6} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={s.skipText}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}

        {/* Dots */}
        <View style={s.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[s.dot, i === slide && s.dotActive]} />
          ))}
        </View>
      </View>

      {/* Slide content */}
      <View style={s.body}>

        {/* Eyebrow */}
        <Text style={s.eyebrow}>{current.eyebrow}</Text>

        {/* Nora identifier */}
        <View style={s.noraIdent}>
          <View style={s.noraRule} />
          <Text style={s.noraLabel}>Nora</Text>
        </View>

        {/* Heading */}
        <Text style={s.heading}>{current.heading}</Text>

        {/* Subheading */}
        {current.subheading ? (
          <Text style={s.subheading}>{current.subheading}</Text>
        ) : null}

        {/* Body */}
        <Text style={s.prose}>{current.body}</Text>

      </View>

      {/* Footer */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom + 12, 32) }]}>
        <TouchableOpacity
          style={s.btn}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={s.btnText}>
            {isLast ? 'Begin' : 'Continue'}
          </Text>
        </TouchableOpacity>

        {/* Slide counter — text below button */}
        <Text style={s.counter}>{slide + 1} of {SLIDES.length}</Text>
      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: BG,
  },

  skipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 8,
  },
  skipText: {
    fontSize: 13,
    color: G2,
    fontFamily: BODY,
  },

  dots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 1,
    backgroundColor: G3,
  },
  dotActive: {
    width: 18,
    backgroundColor: GOLD,
    borderRadius: 1,
  },

  // ── Slide body ──────────────────────────────────────────────────────────────
  body: {
    flex: 1,
    paddingHorizontal: 36,
    justifyContent: 'center',
    gap: 0,
  },

  eyebrow: {
    fontSize: 10,
    letterSpacing: 2.8,
    textTransform: 'uppercase',
    color: GOLD,
    fontFamily: BODY,
    marginBottom: 28,
  },

  noraIdent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  noraRule: {
    width: 14,
    height: 1,
    backgroundColor: GOLD,
  },
  noraLabel: {
    fontSize: 12,
    fontFamily: SERIF,
    fontStyle: 'italic',
    color: GOLD,
    letterSpacing: 0.3,
  },

  heading: {
    fontFamily: SERIF_BOLD,
    fontSize: 26,
    color: W,
    lineHeight: 34,
    letterSpacing: 0.2,
    marginBottom: 16,
  },

  subheading: {
    fontFamily: SERIF,
    fontStyle: 'italic',
    fontSize: 18,
    color: G1,
    lineHeight: 26,
    marginBottom: 20,
    marginTop: -6,
  },

  prose: {
    fontFamily: BODY,
    fontStyle: 'italic',
    fontSize: 15,
    color: G1,
    lineHeight: 26,
    marginTop: 4,
  },

  // ── Footer ──────────────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: 36,
    paddingTop: 12,
    gap: 14,
    alignItems: 'center',
  },

  btn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: R_SM,
    backgroundColor: GOLD,
    alignItems: 'center',
  },
  btnText: {
    fontFamily: SERIF_BOLD,
    fontSize: 15,
    color: ON_PRIMARY,
    letterSpacing: 0.3,
  },

  counter: {
    fontSize: 11,
    color: G3,
    fontFamily: BODY,
  },
});
