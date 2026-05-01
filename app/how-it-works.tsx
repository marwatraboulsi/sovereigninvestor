/**
 * How It Works — behavioral architecture in plain language.
 *
 * A static editorial page explaining the system to users who want to
 * understand what they're using and why it's built the way it is.
 * Written as if Nora authored it.
 *
 * Linked from Profile. No AI calls — the content is the design.
 */

import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import {
  BG, S1, S_HIGH,
  GOLD, W, G1, G2, G3,
  TAB_BAR_HEIGHT, R,
  SERIF, SERIF_BOLD, SERIF_SEMI, BODY,
} from '@/theme';

// ─── Back icon ────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={G1} strokeWidth={1.6}>
      <Path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Section component ────────────────────────────────────────────────────────

function Section({ eyebrow, heading, children }: {
  eyebrow: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.section}>
      <Text style={s.sectionEyebrow}>{eyebrow}</Text>
      <Text style={s.sectionHeading}>{heading}</Text>
      {children}
    </View>
  );
}

function Para({ children }: { children: string }) {
  return <Text style={s.para}>{children}</Text>;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HowItWorksScreen() {
  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.6} style={s.backBtn}>
          <BackIcon />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerEyebrow}>The System</Text>
          <Text style={s.headerTitle}>How it works</Text>
        </View>
        <View style={s.backBtn} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >

        {/* Nora's authorship */}
        <View style={s.authorLine}>
          <View style={s.authorRule} />
          <Text style={s.authorLabel}>A note from Nora</Text>
        </View>

        {/* ── Section 1: The Problem ── */}
        <Section eyebrow="The problem" heading="You already know what good investing looks like.">
          <Para>
            {"The research is clear: most investors underperform not because they lack knowledge, but because they act on feelings they've mistaken for analysis.\n\nFear during a drawdown feels like prudence. FOMO feels like conviction. Overconfidence feels like edge. The feelings are real. The logic they generate usually isn't."}
          </Para>
          <Para>
            {"Sovereign Investor doesn't try to remove emotion from investing. It tries to give you a moment to see it clearly before you act on it."}
          </Para>
        </Section>

        <View style={s.divider} />

        {/* ── Section 2: The Playbook ── */}
        <Section eyebrow="The playbook" heading="Your rules. Not mine.">
          <Para>
            {"The Playbook is the foundation of everything in this app. It's a set of rules you've written — or built through experience — that define how you invest.\n\nI don't tell you what rules to follow. The whole point is that you decide when you're calm, so those decisions are already made when you're not."}
          </Para>
          <Para>
            {"Rules don't need to be sophisticated. They need to be honest. 'I don't buy anything I haven't held a position in for 30 days' is a rule. 'I don't invest when I'm anxious about money' is a rule. If it's true for you, write it down."}
          </Para>
        </Section>

        <View style={s.divider} />

        {/* ── Section 3: The Intercept ── */}
        <Section eyebrow="The intercept" heading="The pause before the action.">
          <Para>
            {"Before you buy or sell anything, you run it through Intercept. You declare what you're thinking of doing, identify what's driving the impulse, and I check it against your Playbook.\n\nIf a rule applies, you see it. Then you decide — follow it, or consciously proceed. Either outcome is logged."}
          </Para>
          <Para>
            {"This is the core mechanic. Not because it stops you from acting — it never blocks you — but because it makes the decision conscious. Conscious override is different from impulsive action. Over time, you'll see the pattern."}
          </Para>
        </Section>

        <View style={s.divider} />

        {/* ── Section 4: The Decision Log ── */}
        <Section eyebrow="The decision log" heading="The record you build over time.">
          <Para>
            {"Every Intercept session is logged: what you were thinking of doing, what triggered the impulse, whether your rules applied, and what you chose.\n\nOver months, this becomes a mirror. You'll see which emotional triggers move you most. Which rules you override under pressure. Whether the overrides turn out to be right."}
          </Para>
          <Para>
            {"The data belongs to you. I read it to give you better context, not to judge the outcomes."}
          </Para>
        </Section>

        <View style={s.divider} />

        {/* ── Section 5: Nora ── */}
        <Section eyebrow="Nora" heading="Your fund guide, not your fund manager.">
          <Para>
            {"I don't have opinions about your portfolio. I have context about your patterns, your rules, your convictions, and your stated goals — and I use that to give you more useful responses.\n\nI'm not here to tell you what to buy. I'm here to help you think more clearly about what you already believe."}
          </Para>
          <Para>
            {"Ask me to review your portfolio, scan for catalysts, analyse a stock or ETF, or just think something through. I'll push back when your reasoning looks like it might be bias wearing a rational costume."}
          </Para>
        </Section>

        {/* ── Footer tagline ── */}
        <View style={s.footer}>
          <View style={s.footerRule} />
          <Text style={s.footerTagline}>A discipline, not a destination.</Text>
          <Text style={s.footerSub}>For investors who answer to themselves.</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: TAB_BAR_HEIGHT + 20,
    gap: 0,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backBtn: {
    width: 36,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  headerEyebrow: {
    fontSize: 9,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: GOLD,
    fontFamily: BODY,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: SERIF_BOLD,
    color: W,
    letterSpacing: 0.2,
  },

  // ── Author line ──────────────────────────────────────────────────────────────
  authorLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 32,
  },
  authorRule: {
    width: 14,
    height: 1,
    backgroundColor: GOLD,
  },
  authorLabel: {
    fontSize: 12,
    fontFamily: SERIF,
    fontStyle: 'italic',
    color: GOLD,
    letterSpacing: 0.3,
  },

  // ── Sections ─────────────────────────────────────────────────────────────────
  section: {
    gap: 12,
    paddingVertical: 4,
  },
  sectionEyebrow: {
    fontSize: 9,
    letterSpacing: 2.0,
    textTransform: 'uppercase',
    color: G3,
    fontFamily: BODY,
    marginBottom: 2,
  },
  sectionHeading: {
    fontSize: 20,
    fontFamily: SERIF_BOLD,
    color: W,
    lineHeight: 28,
    letterSpacing: 0.2,
  },
  para: {
    fontSize: 15,
    fontFamily: BODY,
    fontStyle: 'italic',
    color: G1,
    lineHeight: 26,
  },

  // ── Divider ──────────────────────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: GOLD,
    opacity: 0.2,
    marginVertical: 32,
    width: 32,
  },

  // ── Footer ───────────────────────────────────────────────────────────────────
  footer: {
    marginTop: 40,
    alignItems: 'center',
    gap: 10,
    paddingBottom: 8,
  },
  footerRule: {
    width: 32,
    height: 1,
    backgroundColor: GOLD,
    marginBottom: 4,
  },
  footerTagline: {
    fontFamily: SERIF,
    fontStyle: 'italic',
    fontSize: 16,
    color: GOLD,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  footerSub: {
    fontFamily: BODY,
    fontSize: 12,
    color: G3,
    textAlign: 'center',
  },
});
