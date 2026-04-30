/**
 * Extended Profile — Phase 6
 *
 * Four deferred questions surfaced after the user's first Intercept session:
 *   Step 1  Age range
 *   Step 2  Risk tolerance
 *   Step 3  Investment worldview
 *   Step 4  Response style
 *
 * Merges answers into the existing UserProfile (never overwrites the required
 * fields set during onboarding).  On completion, returns to the previous screen
 * via router.back().
 *
 * Old users who already have all 7 fields set will never see this screen
 * because intercept.tsx gates the prompt on !profile?.ageRange.
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
import { router } from 'expo-router';
import { useState } from 'react';

import { useUserProfile } from '@/hooks/useUserProfile';
import type { AgeRange, RiskTolerance, InvestmentWorldview, ResponseStyle } from '@/types';

import { BG, S1, S2, LINE, W, GOLD, G1, G2, SERIF, BODY } from '@/theme';

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  {
    id: 'ageRange',
    question: 'How old are you?',
    subtitle: 'Helps us calibrate time horizons and risk framing.',
    options: [
      { value: '18-25', label: '18–25', description: 'Early career, long runway ahead' },
      { value: '26-35', label: '26–35', description: 'Building wealth, compounding time' },
      { value: '36-45', label: '36–45', description: 'Peak earning, mid-horizon planning' },
      { value: '46-55', label: '46–55', description: 'Pre-retirement, protecting gains' },
      { value: '55+',   label: '55+',   description: 'Preservation and income focus' },
    ],
  },
  {
    id: 'riskTolerance',
    question: "What's your risk appetite?",
    subtitle: "How you feel when markets move — not just how you think you should feel.",
    options: [
      { value: 'conservative', label: 'Conservative', description: 'Capital preservation over growth; volatility is stressful' },
      { value: 'moderate',     label: 'Moderate',     description: 'Balanced approach; some volatility is acceptable' },
      { value: 'aggressive',   label: 'Aggressive',   description: 'Growth-focused; comfortable riding big swings' },
    ],
  },
  {
    id: 'worldview',
    question: 'What drives your investment thinking?',
    subtitle: 'Your underlying philosophy shapes which analysis resonates most.',
    options: [
      { value: 'long-term-growth', label: 'Long-term growth',    description: 'Compounding over decades; ignore short-term noise' },
      { value: 'income-stability', label: 'Income & stability',  description: 'Dividends, cash flow, and capital preservation' },
      { value: 'values-driven',    label: 'Values-driven',       description: 'ESG, sector ethics, or personal conviction filters' },
      { value: 'no-preference',    label: 'No strong preference', description: "Opportunistic — I go where the evidence leads" },
    ],
  },
  {
    id: 'responseStyle',
    question: 'How do you prefer analysis?',
    subtitle: 'You can always change this from your profile.',
    options: [
      { value: 'conversational',  label: 'Conversational',  description: 'Plain language, concise, easy to read fast' },
      { value: 'balanced',        label: 'Balanced',        description: 'Mix of narrative and structure — clear but complete' },
      { value: 'comprehensive',   label: 'Comprehensive',   description: 'Full depth — frameworks, data, and nuance' },
    ],
  },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ExtendedProfileScreen() {
  const { profile, saveProfile } = useUserProfile();

  const [step,    setStep]    = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving,  setSaving]  = useState(false);

  const current  = STEPS[step];
  const selected = answers[current.id];
  const isLast   = step === STEPS.length - 1;
  const progress = (step + 1) / STEPS.length;

  // ── Navigation ─────────────────────────────────────────────────────────────

  function handleContinue() {
    if (!selected) return;
    if (!isLast) { setStep((s) => s + 1); return; }
    handleSave();
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);

    try {
      // Merge extended fields into the existing profile.
      // Fall back to sane defaults so the upsert is always complete.
      const merged = {
        knowledgeLevel:     profile?.knowledgeLevel   ?? 'beginner',
        investmentStatus:   profile?.investmentStatus ?? 'just-exploring',
        primaryGoal:        profile?.primaryGoal      ?? 'understand-market',
        responseStyle:      (answers['responseStyle'] ?? profile?.responseStyle ?? 'balanced') as ResponseStyle,
        ageRange:           (answers['ageRange']      ?? profile?.ageRange)                    as AgeRange       | undefined,
        riskTolerance:      (answers['riskTolerance'] ?? profile?.riskTolerance)               as RiskTolerance  | undefined,
        worldview:          (answers['worldview']     ?? profile?.worldview)                   as InvestmentWorldview | undefined,
        macroConvictions:   profile?.macroConvictions ?? [],
        worldviewNote:      profile?.worldviewNote,
        onboardingComplete: true,
      };

      await saveProfile(merged);
    } finally {
      setSaving(false);
      router.back();
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe}>
      {/* Progress bar */}
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
                style={[
                  s.option,
                  i < current.options.length - 1 && s.optionBorder,
                  sel && s.optionSel,
                ]}
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
          style={[s.nextBtn, (!selected || saving) && s.nextBtnOff]}
          onPress={handleContinue}
          disabled={!selected || saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color={BG} />
          ) : (
            <Text style={[s.nextText, !selected && s.nextTextOff]}>
              {isLast ? 'Finish' : 'Continue'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={s.skipBtn}
          onPress={() => router.back()}
          activeOpacity={0.6}
        >
          <Text style={s.skipText}>Skip for now</Text>
        </TouchableOpacity>
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

  footer:      { paddingHorizontal: 24, paddingBottom: 28, paddingTop: 12, gap: 12 },
  nextBtn:     { backgroundColor: GOLD, borderRadius: 14, paddingVertical: 17, alignItems: 'center' },
  nextBtnOff:  { backgroundColor: S2 },
  nextText:    { color: BG, fontSize: 17, fontWeight: '700' },
  nextTextOff: { color: G2 },

  skipBtn:  { alignItems: 'center', paddingVertical: 8 },
  skipText: { fontSize: 14, color: G2, fontFamily: BODY },
});
