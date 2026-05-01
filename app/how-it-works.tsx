/**
 * How It Works — behavioral architecture in plain language.
 *
 * Tab order mirrors the app's tab bar: Nora → Research → Intercept → Vault → Profile.
 * Each section is a step-by-step guide to that part of the system, written
 * as if Nora is explaining it.
 *
 * Deep-linkable via ?tab=nora|research|intercept|vault|profile
 */

import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import Svg, { Path } from 'react-native-svg';
import {
  BG, BG_DEEP, S1,
  GOLD, W, G1, G2, G3,
  TAB_BAR_HEIGHT, R, R_SM,
  SERIF, SERIF_BOLD, SERIF_SEMI, BODY,
} from '@/theme';

// ─── Section tabs — mirrors tab bar order ─────────────────────────────────────

const TABS = [
  { id: 'nora',      label: 'Nora'      },
  { id: 'research',  label: 'Research'  },
  { id: 'intercept', label: 'Intercept' },
  { id: 'vault',     label: 'Vault'     },
  { id: 'profile',   label: 'Profile'   },
] as const;

type TabId = typeof TABS[number]['id'];

// ─── Back icon ────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={G1} strokeWidth={1.6}>
      <Path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Building blocks ──────────────────────────────────────────────────────────

function Para({ children }: { children: string }) {
  return <Text style={s.para}>{children}</Text>;
}

function Subheading({ children }: { children: string }) {
  return <Text style={s.subheading}>{children}</Text>;
}

function Step({ number, title, children }: { number: string; title: string; children: string }) {
  return (
    <View style={s.step}>
      <View style={s.stepLeft}>
        <Text style={s.stepNumber}>{number}</Text>
        <View style={s.stepLine} />
      </View>
      <View style={s.stepRight}>
        <Text style={s.stepTitle}>{title}</Text>
        <Text style={s.stepBody}>{children}</Text>
      </View>
    </View>
  );
}

function Divider() {
  return <View style={s.divider} />;
}

// ─── Tab content ──────────────────────────────────────────────────────────────

function NoraContent() {
  return (
    <View style={s.tabContent}>
      <Text style={s.tabHeading}>Nora is not your fund manager.</Text>
      <Para>
        {"Nora is a thinking partner. She doesn't manage your money, generate trade signals, or tell you what to buy. What she does is more useful than that: she helps you think more clearly about what you already believe — and catch yourself when emotion is doing the thinking instead of you."}
      </Para>
      <Para>
        {"She knows your Playbook. She knows your Vault. She knows your stated convictions and your risk profile. She uses all of that to give you responses that are specific to your situation, not generic financial content."}
      </Para>

      <Divider />
      <Subheading>What Nora knows about you</Subheading>
      <Step number="01" title="Your Playbook">
        {"The rules you've committed to follow when you're calm. Nora references these when you're working through a decision, and flags when your reasoning might be contradicting one."}
      </Step>
      <Step number="02" title="Your Vault">
        {"The assets you hold and your cash position. This lets Nora give portfolio-aware responses — she knows what you already own when you ask about adding something new."}
      </Step>
      <Step number="03" title="Your mandate">
        {"Your knowledge level, risk tolerance, investment goals, and response style preference. These calibrate how Nora communicates — depth, terminology, tone, and framing all adjust to fit you."}
      </Step>
      <Step number="04" title="Your convictions">
        {"The macro theses you hold about the world — dollar debasement, AI transformation, geopolitical shifts. Nora holds these as context, not instructions. She may draw connections, but she stays objective."}
      </Step>

      <Divider />
      <Subheading>What to ask Nora</Subheading>
      <Step number="01" title="Think through a decision">
        {"If you're wrestling with a trade or a market view, talk it through. Nora will push back when your reasoning looks like bias wearing a rational costume."}
      </Step>
      <Step number="02" title="Understand something">
        {"Ask her to explain any concept, instrument, or strategy. She adjusts depth to your knowledge level automatically — no need to pre-qualify the question."}
      </Step>
      <Step number="03" title="Review your thinking">
        {"Ask Nora to stress-test a position, find contradictions in your playbook, or review your conviction against recent data. She reads your history to give you pattern-aware feedback."}
      </Step>
    </View>
  );
}

function ResearchContent() {
  return (
    <View style={s.tabContent}>
      <Text style={s.tabHeading}>Structured analysis. Not noise.</Text>
      <Para>
        {"The Research tab is where you go when you need depth, not a headline. Each tool runs a structured analytical framework using live web data — not a summary, a full session. They take a few minutes to complete properly."}
      </Para>
      <Para>
        {"Every completed analysis can be saved to your Archive as a slide deck. When you're making a real decision, open it. The research was done when you were calm — that matters."}
      </Para>

      <Divider />
      <Subheading>The four tools</Subheading>
      <Step number="01" title="Portfolio Reviewer">
        {"Reads your Vault holdings directly and gives you a structured review: allocation balance, diversification gaps, archetype fit, and rebalancing suggestions. No data entry — it knows what you hold."}
      </Step>
      <Step number="02" title="Catalyst Scanner">
        {"Identifies and classifies market-moving events using the Five-Category framework: Institutional Flow, Consumer Behaviour Shift, Technology Disruption, Policy & Regulatory Shift, Macro Regime Shift. Useful for understanding what's actually driving a move before reacting to it."}
      </Step>
      <Step number="03" title="ETF Analyzer">
        {"Evaluates any ETF using the MACE framework: Mandate (does it do what it says?), Assets (what does it actually hold?), Composition (how concentrated or diversified?), and Expense (what is the true cost?). Returns a full scorecard."}
      </Step>
      <Step number="04" title="Stock Researcher">
        {"Eight-phase due diligence: Business Model, Financial Health, Competitive Moat, Management & Governance, Growth Catalysts, Risk Assessment, Valuation, and Investment Thesis. This is the full picture, not a snapshot."}
      </Step>
    </View>
  );
}

function InterceptContent() {
  return (
    <View style={s.tabContent}>
      <Text style={s.tabHeading}>The pause before the action.</Text>
      <Para>
        {"Most investing mistakes don't come from a lack of knowledge. They come from acting on feelings that have been mistaken for analysis. Fear during a drawdown feels like prudence. FOMO feels like conviction. Overconfidence feels like edge."}
      </Para>
      <Para>
        {"The Intercept doesn't try to stop you from acting. It never blocks you. What it does is create a moment of friction — enough to make the decision conscious rather than reactive. Conscious override is categorically different from impulsive action."}
      </Para>

      <Divider />
      <Subheading>The psychology behind it</Subheading>
      <Para>
        {"Behavioral finance research consistently shows that investors underperform their own funds — meaning the timing of their buy and sell decisions destroys value, even when the underlying funds perform well. The gap between fund returns and investor returns is the cost of emotion."}
      </Para>
      <Para>
        {"The Intercept is built on one insight: if you wrote your rules when you were calm, you should at least see them before you act when you're not. You still get to override them. But conscious override is a different mental act."}
      </Para>

      <Divider />
      <Subheading>How it works, step by step</Subheading>
      <Step number="01" title="Declare the trade">
        {"Name what you're thinking of buying or selling, and roughly how much. Forcing yourself to articulate it is itself a useful pause — vague impulses resist being named precisely."}
      </Step>
      <Step number="02" title="Name the trigger">
        {"Choose what's driving it: FOMO, a news reaction, a plan, a conviction, a life event. Naming the emotional source of a decision is the most important step. You can't examine what you haven't identified."}
      </Step>
      <Step number="03" title="See your rules">
        {"Nora checks your Playbook against what you've declared. If a rule applies, you see it — in full, with the bias it was designed to protect against. No lecturing. Just a mirror."}
      </Step>
      <Step number="04" title="Decide consciously">
        {"Follow the rule. Or consciously override it and proceed. Either outcome is logged. Over time, you'll see which triggers move you most, which rules you override under pressure, and whether those overrides tend to be right."}
      </Step>
    </View>
  );
}

function VaultContent() {
  return (
    <View style={s.tabContent}>
      <Text style={s.tabHeading}>Your portfolio, in context.</Text>
      <Para>
        {"The Vault is not a brokerage connection. It's a reference layer — a place to log what you hold so that the rest of the app is aware of your actual positions. The point isn't the Vault itself. The point is what it enables everywhere else."}
      </Para>

      <Divider />
      <Subheading>What it does</Subheading>
      <Step number="01" title="Holdings">
        {"Add any asset — stocks, ETFs, crypto, commodities, alternatives, property. Log the amount you hold. The Vault builds a picture of your full portfolio structure."}
      </Step>
      <Step number="02" title="Cash position">
        {"Log your available cash separately from your invested holdings. This gives Portfolio Reviewer an accurate read of your investable position — not just what's already deployed."}
      </Step>
      <Step number="03" title="Feeds Portfolio Reviewer">
        {"When you run Portfolio Reviewer in Research, it reads directly from your Vault. No re-entry. The analysis reflects your actual portfolio, not a hypothetical one."}
      </Step>
      <Step number="04" title="Context for Nora">
        {"When you ask Nora about a new position, she knows what you already hold. She can tell you how it would affect your concentration, your sector exposure, your overall structure — because the Vault tells her what's already there."}
      </Step>
    </View>
  );
}

function ProfileContent() {
  return (
    <View style={s.tabContent}>
      <Text style={s.tabHeading}>Your mandate, your record, your rules.</Text>
      <Para>
        {"The Profile tab holds the three things that make Nora useful: your Playbook (what you've committed to), your Convictions (what you believe), and your Mandate (who you are as an investor). The Decision Log is here too — the behavioral record that makes this a system, not just an app."}
      </Para>

      <Divider />
      <Subheading>The Playbook</Subheading>
      <Para>
        {"Your Playbook is a set of rules you've written — or built through the Intercept — that define how you invest. They are not suggestions. They are decisions you made when you were calm, so that those decisions are already made when you're not."}
      </Para>
      <Step number="01" title="Tap to expand">
        {"Tap any rule to see its origin (how it was created), the bias it was designed to guard against, and how many times you've consciously overridden it. This context is what turns a rule from a constraint into a tool."}
      </Step>
      <Step number="02" title="Long-press to edit">
        {"Long-press any rule to edit its wording, pause it temporarily, or remove it. Rules should evolve as your understanding evolves — a static playbook is a dead one."}
      </Step>

      <Divider />
      <Subheading>The Decision Log</Subheading>
      <Para>
        {"Every Intercept session is recorded: what you were thinking of doing, what was driving it, whether a rule applied, and what you chose. Over months, this becomes a mirror."}
      </Para>
      <Para>
        {"You'll see which emotional triggers move you most. Which rules you override under pressure. Whether those overrides tend to be right or wrong. The data belongs to you — Nora reads it to give you better context, not to judge the outcomes."}
      </Para>

      <Divider />
      <Subheading>Convictions & Mandate</Subheading>
      <Step number="01" title="Convictions">
        {"The macro theses you hold — built through Research, the Intercept, and your own reading. Tap any conviction to edit your belief or confidence level as your view evolves."}
      </Step>
      <Step number="02" title="Your Mandate">
        {"Knowledge level, risk tolerance, investment goals, and response style. These calibrate how Nora communicates. Update them if your circumstances or preferences change."}
      </Step>
    </View>
  );
}

const TAB_CONTENT: Record<TabId, React.ReactNode> = {
  nora:      <NoraContent />,
  research:  <ResearchContent />,
  intercept: <InterceptContent />,
  vault:     <VaultContent />,
  profile:   <ProfileContent />,
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HowItWorksScreen() {
  const { tab: initialTab } = useLocalSearchParams<{ tab?: string }>();
  const validInitial = TABS.some((t) => t.id === initialTab) ? (initialTab as TabId) : 'nora';
  const [activeTab, setActiveTab] = useState<TabId>(validInitial);

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

      {/* Nora authorship line */}
      <View style={s.authorLine}>
        <View style={s.authorRule} />
        <Text style={s.authorLabel}>A note from Nora</Text>
      </View>

      {/* Tab selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabBar}
        contentContainerStyle={s.tabBarContent}
      >
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            activeOpacity={0.7}
            style={[s.tabPill, activeTab === tab.id && s.tabPillActive]}
          >
            <Text style={[s.tabPillLabel, activeTab === tab.id && s.tabPillLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content — key forces remount + scroll-to-top on tab change */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        key={activeTab}
      >
        {TAB_CONTENT[activeTab]}

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
  },

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

  authorLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    marginBottom: 16,
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

  tabBar: { flexGrow: 0, marginBottom: 4 },
  tabBarContent: {
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: 'row',
    paddingBottom: 12,
  },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: R_SM,
    backgroundColor: S1,
  },
  tabPillActive: { backgroundColor: GOLD },
  tabPillLabel: {
    fontSize: 13,
    fontFamily: SERIF_SEMI,
    color: G2,
    letterSpacing: 0.2,
  },
  tabPillLabelActive: { color: BG },

  tabContent: { gap: 16 },
  tabHeading: {
    fontSize: 22,
    fontFamily: SERIF_BOLD,
    color: W,
    lineHeight: 30,
    letterSpacing: 0.2,
  },
  subheading: {
    fontSize: 11,
    fontFamily: BODY,
    color: G3,
    textTransform: 'uppercase',
    letterSpacing: 1.8,
    marginBottom: -4,
  },
  para: {
    fontSize: 15,
    fontFamily: BODY,
    fontStyle: 'italic',
    color: G1,
    lineHeight: 26,
  },

  step: { flexDirection: 'row', gap: 14 },
  stepLeft: { alignItems: 'center', gap: 4, width: 22 },
  stepNumber: {
    fontSize: 10,
    fontFamily: BODY,
    fontWeight: '700',
    color: GOLD,
    letterSpacing: 0.5,
  },
  stepLine: {
    flex: 1,
    width: 1,
    backgroundColor: GOLD,
    opacity: 0.2,
    minHeight: 16,
  },
  stepRight: { flex: 1, gap: 4, paddingBottom: 16 },
  stepTitle: { fontSize: 15, fontFamily: SERIF_SEMI, color: W },
  stepBody:  { fontSize: 14, fontFamily: BODY, color: G2, lineHeight: 21 },

  divider: {
    height: 1,
    backgroundColor: GOLD,
    opacity: 0.2,
    width: 32,
  },

  footer: {
    marginTop: 32,
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
