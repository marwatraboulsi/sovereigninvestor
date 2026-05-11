/**
 * Onboarding — Phase 6
 *
 * Reduced from 7 steps to 3 required questions + a fork screen:
 *   Step 1  Knowledge level
 *   Step 2  Investment status
 *   Step 3  Primary goal
 *   Fork    Add holdings now (→ Vault) or later (→ Intercept)
 *
 * Steps 4–7 (age, risk, worldview, response style) are deferred to
 * app/extended-profile.tsx, surfaced after the user's first Intercept session.
 *
 * Seed rules are triggered at fork-screen completion so they're ready
 * immediately rather than waiting for the user to open Profile.
 */

import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';

import { useUserProfile } from '@/hooks/useUserProfile';
import { seedPlaybookOnFirstLogin } from '@/utils/seedPlaybookOnFirstLogin';
import type { KnowledgeLevel, InvestmentStatus, PrimaryGoal, InvestmentWorldview, UserProfile } from '@/types';

import { BG, S1, S2, LINE, W, GOLD, G1, G2, SERIF, BODY } from '@/theme';

// ─── Required onboarding steps ────────────────────────────────────────────────

const STEPS = [
  {
    id: 'knowledge',
    question: "What's your investing knowledge level?",
    subtitle: "Be honest — there's no wrong answer. This shapes everything.",
    options: [
      { value: 'beginner',     label: 'Beginner',     description: 'Just starting to learn about investing' },
      { value: 'intermediate', label: 'Intermediate', description: 'I understand the basics and have some experience' },
      { value: 'advanced',     label: 'Advanced',     description: 'Experienced investor with a solid foundation' },
    ],
  },
  {
    id: 'status',
    question: 'Are you currently investing?',
    subtitle: 'This helps us focus on what matters most right now.',
    options: [
      { value: 'currently-invested', label: 'Yes, I have a portfolio', description: "I already have investments I'm managing" },
      { value: 'planning-to-start',  label: 'Planning to start',       description: 'Getting ready to make my first investments' },
      { value: 'just-exploring',     label: 'Just exploring',          description: 'Learning before I commit to anything' },
    ],
  },
  {
    id: 'goal',
    question: "What's your main goal?",
    subtitle: "You can always explore everything — this just tells us where to begin.",
    options: [
      { value: 'understand-market', label: 'Understand how markets work', description: 'Build a solid mental model of investing' },
      { value: 'build-portfolio',   label: 'Build and grow a portfolio',  description: 'Construct and manage my own investments' },
      { value: 'learn-strategies',  label: 'Learn specific strategies',   description: 'Go deep on ETFs, value investing, income strategies' },
    ],
  },
  {
    id: 'worldview',
    question: 'What drives your investment thinking?',
    subtitle: 'Optional — shapes the rules Nora suggests. You can set or change this any time.',
    options: [
      { value: 'long-term-growth', label: 'Long-term growth',     description: 'Compounding over decades; ignore short-term noise' },
      { value: 'income-stability', label: 'Income & stability',   description: 'Dividends, cash flow, and capital preservation' },
      { value: 'values-driven',    label: 'Values-driven',        description: 'ESG, sector ethics, or personal conviction filters' },
      { value: 'no-preference',    label: 'No strong preference', description: "Opportunistic — I go where the evidence leads" },
    ],
  },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const { saveProfile } = useUserProfile();

  const [step,     setStep]     = useState(0);
  const [answers,  setAnswers]  = useState<Record<string, string>>({});
  const [showFork, setShowFork] = useState(false);
  const [saving,   setSaving]   = useState(false);

  const current       = STEPS[step];
  const selected      = answers[current?.id ?? ''];
  const isWorldview   = current?.id === 'worldview';
  const isLast        = step === STEPS.length - 1;
  // Progress: steps fill 90% of bar; fork fills the remaining 10%
  const progress = showFork ? 1 : (step + 1) / (STEPS.length + 1);

  // ── Step progression ──────────────────────────────────────────────────────

  function handleContinue() {
    if (!selected && !isWorldview) return;
    if (!isLast) { setStep((s) => s + 1); return; }
    setShowFork(true);
  }

  function handleSkipWorldview() {
    setShowFork(true);
  }

  // ── Fork completion ───────────────────────────────────────────────────────

  async function completeFork(destination: 'vault' | 'intercept') {
    setSaving(true);

    const profile: UserProfile = {
      knowledgeLevel:     answers['knowledge']  as KnowledgeLevel,
      investmentStatus:   answers['status']     as InvestmentStatus,
      primaryGoal:        answers['goal']        as PrimaryGoal,
      worldview:          answers['worldview']  as InvestmentWorldview | undefined,
      responseStyle:      'balanced',
      onboardingComplete: true,
    };

    await saveProfile(profile);

    // Seed rules immediately so they're ready at first Intercept session.
    // seedPlaybookOnFirstLogin is idempotent — safe to call from Profile too.
    await seedPlaybookOnFirstLogin(profile);

    router.replace(destination === 'vault' ? '/(tabs)/vault' : '/(tabs)/intercept');
  }

  // ── Fork screen ───────────────────────────────────────────────────────────

  if (showFork) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: '100%' }]} />
        </View>

        <ScrollView
          contentContainerStyle={[s.scroll, { justifyContent: 'center', flex: 1 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.forkWrap}>
            <View style={s.forkIconCircle}>
              <Ionicons name="lock-closed" size={26} color={GOLD} />
            </View>

            <Text style={s.forkHeading}>One last thing</Text>
            <Text style={s.forkBody}>
              Your Vault gives the Intercept real context about what you actually hold — position size, allocation, and live price — when you're deciding. You can add holdings now or any time from The Vault tab.
            </Text>

            <View style={s.forkButtons}>
              <TouchableOpacity
                style={[s.forkPrimary, saving && s.forkBtnOff]}
                onPress={() => completeFork('vault')}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color={BG} />
                ) : (
                  <>
                    <Text style={s.forkPrimaryText}>Add my current holdings</Text>
                    <Text style={s.forkPrimaryHint}>See real context in every Intercept session</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.forkSecondary, saving && s.forkBtnOff]}
                onPress={() => completeFork('intercept')}
                disabled={saving}
                activeOpacity={0.7}
              >
                <Text style={s.forkSecondaryText}>I'll add them as I go</Text>
                <Text style={s.forkSecondaryHint}>Head straight to your first Intercept session</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.forkDisclaimer}>
              You can always add or update your holdings from The Vault tab.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Wizard steps ──────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${progress * 100}%` as any }]} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.stepLabel}>Step {step + 1} of {STEPS.length}</Text>
        <Text style={s.question}>{current.question}</Text>
        <Text style={s.subtitle}>{current.subtitle}</Text>

        <View style={s.options}>
          {current.options.map((opt, i) => {
            const sel = selected === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[s.option, i < current.options.length - 1 && s.optionBorder, sel && s.optionSel]}
                onPress={() => setAnswers((p) => ({ ...p, [current.id]: opt.value }))}
                activeOpacity={0.6}
              >
                <View style={s.optBody}>
                  <Text style={[s.optLabel, sel && s.optLabelSel]}>{opt.label}</Text>
                  <Text style={s.optDesc}>{opt.description}</Text>
                </View>
                <View style={[s.radio, sel && s.radioSel]}>
                  {sel && <View style={s.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.nextBtn, (!selected && !isWorldview) && s.nextBtnOff]}
          onPress={handleContinue}
          disabled={!selected && !isWorldview}
          activeOpacity={0.8}
        >
          <Text style={[s.nextText, (!selected && !isWorldview) && s.nextTextOff]}>Continue</Text>
        </TouchableOpacity>
        {isWorldview && (
          <TouchableOpacity style={s.skipBtn} onPress={handleSkipWorldview} activeOpacity={0.6}>
            <Text style={s.skipBtnText}>Skip for now</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  progressTrack: { height: 2, backgroundColor: S2 },
  progressFill:  { height: 2, backgroundColor: GOLD },

  scroll: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 },

  stepLabel: { fontSize: 12, color: G2, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 20 },
  question:  { fontSize: 28, fontWeight: '700', color: W, lineHeight: 36, letterSpacing: -0.4, marginBottom: 10, fontFamily: SERIF },
  subtitle:  { fontSize: 15, color: G1, lineHeight: 22, marginBottom: 36, fontFamily: BODY },

  options:      { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE },
  option:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 20, gap: 16 },
  optionBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE },
  optionSel:    {},
  optBody:      { flex: 1, gap: 4 },
  optLabel:     { fontSize: 16, fontWeight: '500', color: G1 },
  optLabelSel:  { color: W },
  optDesc:      { fontSize: 13, color: G2, lineHeight: 18, fontFamily: BODY },

  radio:    { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: G2, alignItems: 'center', justifyContent: 'center' },
  radioSel: { borderColor: GOLD },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: GOLD },

  footer:      { paddingHorizontal: 24, paddingBottom: 28, paddingTop: 12 },
  nextBtn:     { backgroundColor: GOLD, borderRadius: 14, paddingVertical: 17, alignItems: 'center' },
  nextBtnOff:  { backgroundColor: S2 },
  nextText:    { color: BG, fontSize: 17, fontWeight: '700' },
  nextTextOff: { color: G2 },

  skipBtn:     { alignItems: 'center', paddingVertical: 14 },
  skipBtnText: { fontSize: 14, color: G2, fontFamily: BODY },

  // ── Fork screen ────────────────────────────────────────────────────────────
  forkWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 16,
  },
  forkIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: S1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GOLD + '55',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  forkHeading: {
    fontSize: 30,
    fontWeight: '700',
    color: W,
    fontFamily: SERIF,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  forkBody: {
    fontSize: 15,
    color: G1,
    lineHeight: 23,
    fontFamily: BODY,
    textAlign: 'center',
    paddingHorizontal: 8,
  },

  forkButtons: {
    width: '100%',
    gap: 12,
    marginTop: 12,
  },

  forkPrimary: {
    backgroundColor: GOLD,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 5,
  },
  forkPrimaryText: {
    color: BG,
    fontSize: 17,
    fontWeight: '700',
    fontFamily: SERIF,
  },
  forkPrimaryHint: {
    color: BG + 'CC',
    fontSize: 13,
    fontFamily: BODY,
  },

  forkSecondary: {
    backgroundColor: S1,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  forkSecondaryText: {
    color: W,
    fontSize: 17,
    fontWeight: '600',
  },
  forkSecondaryHint: {
    color: G2,
    fontSize: 13,
    fontFamily: BODY,
  },

  forkBtnOff:  { opacity: 0.5 },

  forkDisclaimer: {
    fontSize: 12,
    color: G2,
    fontFamily: BODY,
    textAlign: 'center',
    marginTop: 4,
  },
});
