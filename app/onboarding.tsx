import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { useUserProfile } from '@/hooks/useUserProfile';
import type { KnowledgeLevel, InvestmentStatus, PrimaryGoal, ResponseStyle, AgeRange, RiskTolerance, InvestmentWorldview, UserProfile } from '@/types';

import { BG, S2, LINE, W, GOLD, G1, G2, SERIF, BODY } from '@/theme';

const STEPS = [
  {
    id: 'knowledge',
    question: 'What\'s your investing knowledge level?',
    subtitle: 'Be honest , there\'s no wrong answer. This shapes everything.',
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
      { value: 'currently-invested', label: 'Yes, I have a portfolio', description: 'I already have investments I\'m managing' },
      { value: 'planning-to-start',  label: 'Planning to start',       description: 'Getting ready to make my first investments' },
      { value: 'just-exploring',     label: 'Just exploring',          description: 'Learning before I commit to anything' },
    ],
  },
  {
    id: 'goal',
    question: 'What\'s your main goal?',
    subtitle: 'You can always explore everything , this just tells us where to begin.',
    options: [
      { value: 'understand-market', label: 'Understand how markets work', description: 'Build a solid mental model of investing' },
      { value: 'build-portfolio',   label: 'Build and grow a portfolio',  description: 'Construct and manage my own investments' },
      { value: 'learn-strategies',  label: 'Learn specific strategies',   description: 'Go deep on ETFs, value investing, income strategies' },
    ],
  },
  {
    id: 'age',
    question: 'What is your age range?',
    subtitle: 'Your time horizon shapes which strategies and frameworks matter most for you.',
    options: [
      { value: '18-25', label: '18 – 25', description: 'Decades of compounding ahead , time is your greatest asset' },
      { value: '26-35', label: '26 – 35', description: 'Building wealth while balancing life milestones' },
      { value: '36-45', label: '36 – 45', description: 'Growing and protecting a maturing portfolio' },
      { value: '46-55', label: '46 – 55', description: 'Balancing growth with increasing income focus' },
      { value: '55+',   label: '55+',     description: 'Preserving wealth and optimising for income and security' },
    ],
  },
  {
    id: 'risk',
    question: 'How do you feel about risk?',
    subtitle: 'Be honest , this shapes every framework and recommendation you\'ll see.',
    options: [
      { value: 'conservative', label: 'Conservative', description: 'I prioritise protecting what I have over chasing higher returns' },
      { value: 'moderate',     label: 'Moderate',     description: 'I can handle some ups and downs in pursuit of steady growth' },
      { value: 'aggressive',   label: 'Aggressive',   description: 'I\'m comfortable with significant swings for the chance of bigger gains' },
    ],
  },
  {
    id: 'worldview',
    question: 'What drives your investment decisions?',
    subtitle: 'Your values shape your strategy. There\'s no right answer , only an honest one.',
    options: [
      { value: 'long-term-growth',  label: 'Long-term wealth building', description: 'Patient compounding , I think in decades, not quarters' },
      { value: 'income-stability',  label: 'Income & stability',        description: 'Cash flow, dividends, and predictability matter most to me' },
      { value: 'values-driven',     label: 'Values-driven',             description: 'Ethical alignment and ESG considerations are important to me' },
      { value: 'no-preference',     label: 'No strong preference yet',  description: 'Still exploring , I\'ll let the frameworks guide me' },
    ],
  },
  {
    id: 'style',
    question: 'How do you like to learn?',
    subtitle: 'This shapes how I respond. You can always ask me to switch mid-conversation.',
    options: [
      { value: 'conversational', label: 'Conversational', description: 'Short, focused answers , one idea at a time' },
      { value: 'balanced',       label: 'Balanced',       description: 'Clear explanations with enough context to be useful' },
      { value: 'comprehensive',  label: 'Comprehensive',  description: 'Full frameworks, detailed breakdowns, thorough depth' },
    ],
  },
];

export default function OnboardingScreen() {
  const { saveProfile } = useUserProfile();
  const [step, setStep]       = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving]   = useState(false);

  const current  = STEPS[step];
  const selected = answers[current.id];
  const isLast   = step === STEPS.length - 1;
  const progress = (step + 1) / STEPS.length;

  async function next() {
    if (!selected) return;
    if (!isLast) { setStep((s) => s + 1); return; }
    setSaving(true);
    await saveProfile({
      knowledgeLevel:     answers['knowledge'] as KnowledgeLevel,
      investmentStatus:   answers['status']    as InvestmentStatus,
      primaryGoal:        answers['goal']      as PrimaryGoal,
      ageRange:           answers['age']       as AgeRange,
      riskTolerance:      answers['risk']      as RiskTolerance,
      worldview:          answers['worldview'] as InvestmentWorldview,
      responseStyle:      answers['style']     as ResponseStyle,
      onboardingComplete: true,
    });
    router.replace('/(tabs)/intercept');
  }

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
          style={[s.nextBtn, !selected && s.nextBtnOff]}
          onPress={next}
          disabled={!selected || saving}
          activeOpacity={0.8}
        >
          <Text style={[s.nextText, !selected && s.nextTextOff]}>
            {saving ? 'Setting up…' : isLast ? 'Get Started' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  progressTrack: { height: 2, backgroundColor: S2 },
  progressFill:  { height: 2, backgroundColor: GOLD },

  scroll: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 },

  stepLabel: { fontSize: 12, color: G2, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 20 },
  question:  { fontSize: 28, fontWeight: '700', color: W, lineHeight: 36, letterSpacing: -0.4, marginBottom: 10, fontFamily: SERIF },
  subtitle:  { fontSize: 15, color: G1, lineHeight: 22, marginBottom: 36, fontFamily: BODY },

  options: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 16,
  },
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
});
