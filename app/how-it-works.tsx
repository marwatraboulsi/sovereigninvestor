/**
 * How It Works — behavioral architecture in plain language.
 *
 * Tab-based section navigator: each tab explains one part of the system.
 * Users can jump directly to the section relevant to their current context.
 * Written as if Nora authored it.
 *
 * Linked from Profile (and the ? icon in each tab header).
 */

import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import Svg, { Path } from 'react-native-svg';
import {
  BG, BG_DEEP, S1, S_HIGH,
  GOLD, W, G1, G2, G3,
  TAB_BAR_HEIGHT, R, R_SM,
  SERIF, SERIF_BOLD, SERIF_SEMI, BODY,
} from '@/theme';

// ─── Section tabs ─────────────────────────────────────────────────────────────

const TABS = [
  { id: 'playbook',  label: 'Playbook'  },
  { id: 'intercept', label: 'Intercept' },
  { id: 'chat',      label: 'Nora'      },
  { id: 'research',  label: 'Research'  },
  { id: 'vault',     label: 'Vault'     },
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

// ─── Components ───────────────────────────────────────────────────────────────

function Para({ children }: { children: string }) {
  return <Text style={s.para}>{children}</Text>;
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

// ─── Tab content ──────────────────────────────────────────────────────────────

function PlaybookContent() {
  return (
    <View style={s.tabContent}>
      <Text style={s.tabHeading}>Your rules. Not mine.</Text>
      <Para>
        {'The Playbook is the foundation of everything. It\'s a set of rules you\'ve written — or built through experience — that define how you invest.'}
      </Para>
      <Para>
        {'I don\'t tell you what rules to follow. The whole point is that you decide when you\'re calm, so those decisions are already made when you\'re not.'}
      </Para>

      <View style={s.divider} />

      <Text style={s.subheading}>How rules get created</Text>
      <Step number="01" title="Written by you">
        {'Tap + Add Rule in your Profile to write a rule from scratch. Use your own language — the simpler, the better.'}
      </Step>
      <Step number="02" title="Added at setup">
        {'When you first joined, your answers seeded a starting playbook based on your profile. These are a foundation, not a prescription.'}
      </Step>
      <Step number="03" title="Created after an Intercept">
        {'When you override a rule or the Intercept spots a gap, you\'re offered the chance to write a new rule on the spot. This is how your playbook earns its credibility.'}
      </Step>

      <View style={s.divider} />

      <Para>
        {'Rules don\'t need to be sophisticated. They need to be honest. "I don\'t buy anything I haven\'t held a position in for 30 days" is a rule. Tap any rule in your Profile to expand it and see the bias it guards against.'}
      </Para>
    </View>
  );
}

function InterceptContent() {
  return (
    <View style={s.tabContent}>
      <Text style={s.tabHeading}>The pause before the action.</Text>
      <Para>
        {'Before you buy or sell anything, run it through Intercept. You declare what you\'re thinking of doing, identify what\'s driving the impulse, and I check it against your Playbook.'}
      </Para>

      <View style={s.divider} />

      <Text style={s.subheading}>How it works</Text>
      <Step number="01" title="Declare the trade">
        {'Say what you\'re thinking of buying or selling, and roughly how much. You\'re forcing yourself to articulate it — which is itself a useful pause.'}
      </Step>
      <Step number="02" title="Name the trigger">
        {'Select what\'s driving it: FOMO, a news event, a feeling, a conviction, a plan. Naming the trigger is the most important moment in the process.'}
      </Step>
      <Step number="03" title="See your rules">
        {'I check your Playbook against what you\'ve declared. If a rule applies, you see it. You then decide: follow it, or consciously proceed.'}
      </Step>
      <Step number="04" title="Log the decision">
        {'Either way, the decision is logged. Conscious override is different from impulsive action. Over time, you\'ll see the pattern.'}
      </Step>

      <View style={s.divider} />

      <Para>
        {'This is the core mechanic. Not because it stops you from acting — it never blocks you — but because it makes the decision conscious.'}
      </Para>
    </View>
  );
}

function ChatContent() {
  return (
    <View style={s.tabContent}>
      <Text style={s.tabHeading}>Your fund guide, not your fund manager.</Text>
      <Para>
        {'I don\'t have opinions about your portfolio. I have context about your patterns, your rules, your convictions, and your stated goals — and I use that to give you more useful responses.'}
      </Para>

      <View style={s.divider} />

      <Text style={s.subheading}>What you can ask me</Text>
      <Step number="01" title="Think something through">
        {'If you\'re wrestling with a decision or a market view, talk it through with me. I\'ll push back when your reasoning looks like bias wearing a rational costume.'}
      </Step>
      <Step number="02" title="Understand a concept">
        {'Ask me to explain anything — a financial instrument, a market mechanism, a strategy. I adjust depth to your knowledge level automatically.'}
      </Step>
      <Step number="03" title="Review your playbook">
        {'Ask me to review your rules, spot contradictions, or suggest gaps. I read your Intercept history to give you pattern-aware feedback.'}
      </Step>

      <View style={s.divider} />

      <Para>
        {'I\'m not here to tell you what to buy. I\'m here to help you think more clearly about what you already believe.'}
      </Para>
    </View>
  );
}

function ResearchContent() {
  return (
    <View style={s.tabContent}>
      <Text style={s.tabHeading}>Structured analysis. Not noise.</Text>
      <Para>
        {'The Research tab gives you four specialist tools, each built around a specific analytical framework. They use live web data and take a few minutes to run properly.'}
      </Para>

      <View style={s.divider} />

      <Text style={s.subheading}>The four tools</Text>
      <Step number="01" title="Portfolio Reviewer">
        {'Pulls your Vault holdings directly and gives you a structured review: allocation, diversification, archetype fit, and rebalance suggestions.'}
      </Step>
      <Step number="02" title="Catalyst Scanner">
        {'Identifies and classifies market-moving events using the Five-Category framework: Institutional Flow, Consumer Shift, Technology Disruption, Policy Shift, Macro Regime.'}
      </Step>
      <Step number="03" title="ETF Analyzer">
        {'Evaluates any ETF using the MACE framework: Mandate, Assets, Composition, and Expense. Returns a scorecard you can save.'}
      </Step>
      <Step number="04" title="Stock Researcher">
        {'Eight-phase due diligence: Business Model, Financial Health, Competitive Moat, Management, Growth Catalysts, Risk, Valuation, and Investment Thesis.'}
      </Step>

      <View style={s.divider} />

      <Para>
        {'Every completed analysis can be saved to your Archive as a slide deck. Come back to it when you\'re making a decision.'}
      </Para>
    </View>
  );
}

function VaultContent() {
  return (
    <View style={s.tabContent}>
      <Text style={s.tabHeading}>Your portfolio, in context.</Text>
      <Para>
        {'The Vault is where you track what you hold. It\'s not a brokerage — it\'s a reference layer that makes the rest of the app aware of your actual positions.'}
      </Para>

      <View style={s.divider} />

      <Text style={s.subheading}>What it does</Text>
      <Step number="01" title="Holdings">
        {'Add any asset — stocks, ETFs, crypto, alternatives, cash. Enter the amount you hold and the app tracks the total picture.'}
      </Step>
      <Step number="02" title="Cash position">
        {'Log your available cash separately. This gives Portfolio Reviewer an accurate picture of your investable position, not just what\'s already deployed.'}
      </Step>
      <Step number="03" title="Context for Research">
        {'When you run Portfolio Reviewer, it reads directly from your Vault. You don\'t have to re-enter anything.'}
      </Step>
      <Step number="04" title="Intercept awareness">
        {'The Intercept can reference your Vault when you declare a trade, giving your Guide context on how the new position would change your overall structure.'}
      </Step>

      <View style={s.divider} />

      <Para>
        {'The Vault is intentionally simple. The complexity is in what it enables — not in itself.'}
      </Para>
    </View>
  );
}

const TAB_CONTENT: Record<TabId, React.ReactNode> = {
  playbook:  <PlaybookContent />,
  intercept: <InterceptContent />,
  chat:      <ChatContent />,
  research:  <ResearchContent />,
  vault:     <VaultContent />,
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HowItWorksScreen() {
  const { tab: initialTab } = useLocalSearchParams<{ tab?: string }>();
  const validInitial = TABS.some((t) => t.id === initialTab) ? (initialTab as TabId) : 'playbook';
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

      {/* Content */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        key={activeTab}
      >
        {TAB_CONTENT[activeTab]}

        {/* Footer tagline */}
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

  // ── Tab bar ──────────────────────────────────────────────────────────────────
  tabBar: {
    flexGrow: 0,
    marginBottom: 4,
  },
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
  tabPillActive: {
    backgroundColor: GOLD,
  },
  tabPillLabel: {
    fontSize: 13,
    fontFamily: SERIF_SEMI,
    color: G2,
    letterSpacing: 0.2,
  },
  tabPillLabelActive: {
    color: BG,
  },

  // ── Tab content ──────────────────────────────────────────────────────────────
  tabContent: {
    gap: 16,
  },
  tabHeading: {
    fontSize: 22,
    fontFamily: SERIF_BOLD,
    color: W,
    lineHeight: 30,
    letterSpacing: 0.2,
  },
  subheading: {
    fontSize: 13,
    fontFamily: BODY,
    color: G3,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    marginBottom: -4,
  },
  para: {
    fontSize: 15,
    fontFamily: BODY,
    fontStyle: 'italic',
    color: G1,
    lineHeight: 26,
  },

  // ── Steps ────────────────────────────────────────────────────────────────────
  step: {
    flexDirection: 'row',
    gap: 14,
  },
  stepLeft: {
    alignItems: 'center',
    gap: 4,
    width: 22,
  },
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
  stepRight: {
    flex: 1,
    gap: 4,
    paddingBottom: 16,
  },
  stepTitle: {
    fontSize: 15,
    fontFamily: SERIF_SEMI,
    color: W,
  },
  stepBody: {
    fontSize: 14,
    fontFamily: BODY,
    color: G2,
    lineHeight: 21,
  },

  // ── Divider ──────────────────────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: GOLD,
    opacity: 0.2,
    width: 32,
  },

  // ── Footer ───────────────────────────────────────────────────────────────────
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
