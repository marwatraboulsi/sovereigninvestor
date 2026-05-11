/**
 * Intercept Tab — Phase 4
 *
 * 4-step behavioral wizard:
 *   Step 1 Declare   — what decision + which ticker
 *   Step 2 Identify  — emotional triggers (multi-select)
 *   Step 3 Triage    — playbook check + vault context
 *   Step 4 Verdict   — follow or override
 *
 * Also implements:
 *   4B — Conscious Proceed bottom sheet
 *   4C — Decision logging (useDecisionLog)
 *   4D — Post-intercept gap-rule prompt
 *   4E — "Talk it through" → seeds chat with session context
 */

import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';

import { useGuest } from '@/contexts/GuestContext';
import { streamClaude } from '@/api/claudeClient';
import { AccountModal } from '@/components/AccountModal';
import { TickerSearch } from '@/components/TickerSearch';
import { RuleWizard } from '@/components/RuleWizard';
import { usePlaybook } from '@/hooks/usePlaybook';
import { useDecisionLog } from '@/hooks/useDecisionLog';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useVaultData } from '@/hooks/useVaultData';
import { useLivePrices } from '@/hooks/useLivePrices';
import { deriveTopicFromTicker } from '@/skills/learnMode';
import { useConvictions } from '@/hooks/useConvictions';
import { tickerToConvictionTheme, CONVICTION_THEME_LABEL } from '@/utils/convictionUtils';
import type { Conviction } from '@/types';
import type { TickerInfo } from '@/data/tickerSearch';
import type {
  InterceptSession,
  DecisionType,
  DecisionTrigger,
  PlaybookRule,
  RuleCategory,
} from '@/types';

import { BG, BG_DEEP, S1, S2, S_HIGH, LINE, W, GOLD, G1, G2, G3, ON_PRIMARY, R, R_SM, R_LG, TAB_BAR_HEIGHT, SERIF, SERIF_BOLD, SERIF_SEMI, BODY } from '@/theme';
import { RuleCard } from '@/components/RuleCard';

// ─── Trigger definitions ──────────────────────────────────────────────────────

interface TriggerOption {
  label:   string;
  trigger: DecisionTrigger;
}

const BUY_TRIGGERS: TriggerOption[] = [
  { label: "I've seen strong recent price performance",        trigger: 'recent-performance' },
  { label: "People I know are making money on this",           trigger: 'social-comparison'  },
  { label: "I'm worried about missing out",                    trigger: 'price-rise-fomo'    },
  { label: "I feel confident about this company",              trigger: 'overconfidence'      },
  { label: "I've been reading a lot about this",               trigger: 'news-reaction'       },
  { label: "I'm looking for something to do with my money",   trigger: 'boredom'            },
  { label: "I'm not sure — something just feels right",        trigger: 'unsure'             },
];

const SELL_TRIGGERS: TriggerOption[] = [
  { label: "The price has dropped and I'm worried",      trigger: 'price-drop-fear'    },
  { label: "I've seen bad news about this company",      trigger: 'news-reaction'       },
  { label: "I want to lock in my gains",                 trigger: 'overconfidence'      },
  { label: "I regret buying this and want out",          trigger: 'regret-avoidance'    },
  { label: "I want to free up cash for something else",  trigger: 'boredom'            },
  { label: "I'm not sure — something just feels off",    trigger: 'unsure'             },
];

// Deduplicated union for Hold / Unsure
const ALL_TRIGGERS: TriggerOption[] = [
  ...BUY_TRIGGERS,
  ...SELL_TRIGGERS.filter(
    (s) => !BUY_TRIGGERS.find((b) => b.trigger === s.trigger),
  ),
];

function triggersForDecision(dt: DecisionType | null): TriggerOption[] {
  if (dt === 'buy')  return BUY_TRIGGERS;
  if (dt === 'sell') return SELL_TRIGGERS;
  return ALL_TRIGGERS;
}

const TRIGGER_LABEL: Record<DecisionTrigger, string> = {
  'recent-performance': 'strong recent price performance',
  'social-comparison':  'others around me profiting',
  'price-rise-fomo':    'fear of missing out',
  'overconfidence':     'overconfidence',
  'news-reaction':      'a news reaction',
  'price-drop-fear':    'fear from a price drop',
  'regret-avoidance':   'regret avoidance',
  'boredom':            'boredom',
  'unsure':             'an unclear feeling',
};

// Maps decision trigger patterns to suggested rule categories
function suggestCategory(triggers: DecisionTrigger[]): RuleCategory {
  if (triggers.some((t) => ['price-drop-fear', 'price-rise-fomo', 'recent-performance'].includes(t)))
    return 'emotional-discipline';
  if (triggers.some((t) => ['social-comparison'].includes(t)))
    return 'information-discipline';
  if (triggers.some((t) => ['overconfidence'].includes(t)))
    return 'position-sizing';
  if (triggers.some((t) => ['news-reaction'].includes(t)))
    return 'information-discipline';
  return 'timing';
}

// ─── Step subtitles ───────────────────────────────────────────────────────────

const STEP_SUBTITLES: Record<number, string> = {
  1: "What are you thinking about doing?",
  2: "What's driving this?",
  3: "Here's what your playbook says.",
};

// ─── Nora coaching system prompt (intercept mode) ─────────────────────────────

const NORA_INTERCEPT_SYSTEM = `You are Nora, a behavioural finance coach for retail investors. A user is pausing to check an investment impulse against their playbook.

Write 2–3 short paragraphs that:
1. Acknowledge the emotional driver they identified
2. Connect it to the relevant rule(s) they've set for themselves, or note the gap if none exist
3. Give a clear, honest recommendation

Be direct. Use the user's specific situation. Avoid generic platitudes. Keep each paragraph to 2–3 sentences. Do not use bullet points or headers. Do not include suggestions or a SUGGESTIONS: line.`;

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildFullCoachingPrompt(sess: InterceptSession, matched: PlaybookRule[]): string {
  const dtLabel =
    sess.decisionType === 'buy'  ? 'buy'  :
    sess.decisionType === 'sell' ? 'sell' : 'transact in';
  const triggerList = sess.emotionalTriggers
    .map((t) => TRIGGER_LABEL[t])
    .join(', ');
  const rulesText = matched.length > 0
    ? matched.map((r) => `Rule "${r.title}": ${r.body}`).join('\n')
    : 'No rules in their playbook matched this situation.';

  return `The user is considering whether to ${dtLabel} ${sess.assetName || sess.ticker} (${sess.ticker}).

Emotional drivers they identified: ${triggerList || 'unclear — they weren\'t sure what\'s driving it'}

Their playbook rules for this moment:
${rulesText}

Coach them through this pause.`;
}

function buildPlannedTradeCoachingPrompt(sess: InterceptSession): string {
  const dtLabel =
    sess.decisionType === 'buy'  ? 'buy'  :
    sess.decisionType === 'sell' ? 'sell' : 'transact in';

  return `The user is executing a planned trade — they want to ${dtLabel} ${sess.assetName || sess.ticker} (${sess.ticker}). This was already part of their investment plan, not a fresh impulse.

Give a brief, grounding check-in (2 short paragraphs): acknowledge it's planned, offer one practical sizing or timing consideration they might want to confirm before acting, and encourage them to proceed with clarity. Keep it concise and affirming.`;
}

// ─── Initial session ─────────────────────────────────────────────────────────

const BLANK_SESSION: InterceptSession = {
  ticker:               '',
  assetName:            '',
  decisionType:         null,
  emotionalTriggers:    [],
  rulesMatched:         [],
  playbookGapDetected:  false,
  currentStep:          1,
  isPlannedTrade:       null,
};

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// ─── Outer component (guest gate) ────────────────────────────────────────────

export default function InterceptScreen() {
  const { isGuest } = useGuest();
  const [showAccountModal, setShowAccountModal] = useState(false);

  useFocusEffect(useCallback(() => {
    if (isGuest) setShowAccountModal(true);
  }, [isGuest]));

  if (isGuest) {
    return (
      <SafeAreaView style={s.safe}>
        <AccountModal
          visible={showAccountModal}
          onClose={() => setShowAccountModal(false)}
          title="Intercept Your Decisions"
          message="Create a free account to build your Playbook and start intercepting impulsive trades before they happen."
        />
        <View style={s.center}>
          <Ionicons name="shield-checkmark-outline" size={40} color={G2} />
          <Text style={s.centerTitle}>The Intercept</Text>
          <Text style={s.centerBody}>
            Check every investment impulse against your personal Playbook before you act.
          </Text>
          <TouchableOpacity
            style={s.centerBtn}
            onPress={() => setShowAccountModal(true)}
            activeOpacity={0.8}
          >
            <Text style={s.centerBtnText}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return <InterceptWizard />;
}

// ─── Inner component (full wizard) ───────────────────────────────────────────

function InterceptWizard() {
  // ── Core wizard state ──────────────────────────────────────────────────────
  const [session,       setSession]       = useState<InterceptSession>(BLANK_SESSION);
  const [showGate,      setShowGate]      = useState(false);
  const [tickerInfo,    setTickerInfo]    = useState<TickerInfo | null>(null);

  // ── Nora streaming state ───────────────────────────────────────────────────
  const [noraStreamingText,    setNoraStreamingText]    = useState('');
  const [noraCoachingResponse, setNoraCoachingResponse] = useState('');
  const [noraStreaming,        setNoraStreaming]         = useState(false);
  const abortNoraRef = useRef<(() => void) | null>(null);

  // ── Conscious Proceed state ────────────────────────────────────────────────
  const [showConscious,  setShowConscious]  = useState(false);
  const [overrideRuleId, setOverrideRuleId] = useState<string>('none');
  const [overrideReason, setOverrideReason] = useState('');
  const [tradeExecuted,  setTradeExecuted]  = useState<boolean | undefined>(undefined);

  // ── Post-log state ─────────────────────────────────────────────────────────
  const [showSuccess,   setShowSuccess]   = useState(false);
  const [loggedId,      setLoggedId]      = useState<string | null>(null);
  const [logging,       setLogging]       = useState(false);

  // ── Rule wizard (for gap prompt + "Build a rule first") ───────────────────
  const [ruleWizardVisible,  setRuleWizardVisible]  = useState(false);
  const [ruleWizardCategory, setRuleWizardCategory] = useState<RuleCategory | undefined>(undefined);

  // Prevent multiple seed attempts
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tracks whether the completed session was the user's very first log
  const isFirstLogRef = useRef(false);

  // ── Data hooks ─────────────────────────────────────────────────────────────
  const { rules, reload: reloadRules, addRule, matchRules, matchRulesForPlannedTrade } = usePlaybook();
  const { addLog, logs, loaded: decisionsLoaded, reload: reloadDecisionLog } = useDecisionLog();
  const { profile } = useUserProfile();
  const { convictions, reload: reloadConvictions } = useConvictions();
  const vaultData   = useVaultData();

  // Reload playbook + decision log + convictions when tab comes into focus
  useFocusEffect(useCallback(() => {
    reloadRules();
    reloadDecisionLog();
    reloadConvictions();
  }, [reloadRules, reloadDecisionLog, reloadConvictions]));

  // Live price for the selected ticker
  const priceItems = useMemo(
    () => (session.ticker ? [{ ticker: session.ticker, quoteSymbol: tickerInfo?.quoteSymbol }] : []),
    [session.ticker, tickerInfo?.quoteSymbol],
  );
  const { prices: livePriceMap, currencies: liveCurrencies, loading: priceLoading } =
    useLivePrices(priceItems, priceItems.length > 0);

  const livePrice    = session.ticker ? (livePriceMap[session.ticker]    ?? null) : null;
  const liveCurrency = session.ticker ? (liveCurrencies[session.ticker]  ?? 'USD') : 'USD';

  // Vault holding for the selected ticker
  const vaultHolding = useMemo(
    () => vaultData?.holdings.find((h) => h.ticker.ticker === session.ticker) ?? null,
    [vaultData, session.ticker],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      abortNoraRef.current?.();
    };
  }, []);

  // ── Wizard navigation ──────────────────────────────────────────────────────

  function abortNora() {
    abortNoraRef.current?.();
    abortNoraRef.current = null;
    setNoraStreamingText('');
    setNoraCoachingResponse('');
    setNoraStreaming(false);
  }

  function resetWizard() {
    abortNora();
    setSession(BLANK_SESSION);
    setShowGate(false);
    setTickerInfo(null);
    setShowConscious(false);
    setOverrideRuleId('none');
    setOverrideReason('');
    setTradeExecuted(undefined);
    setShowSuccess(false);
    setLoggedId(null);
    setLogging(false);
    setRuleWizardVisible(false);
  }

  function goBack() {
    if (session.currentStep === 3) {
      abortNora();
      if (session.isPlannedTrade) {
        // Planned trade: back to gate
        setSession((prev) => ({ ...prev, currentStep: 1, isPlannedTrade: null }));
        setShowGate(true);
      } else {
        setSession((prev) => ({ ...prev, currentStep: 2 as 1 | 2 | 3 }));
      }
    } else if (session.currentStep > 1) {
      setSession((prev) => ({
        ...prev,
        currentStep: (prev.currentStep - 1) as 1 | 2 | 3,
      }));
    }
  }

  function handleGateBack() {
    setShowGate(false);
  }

  function handleStep1Continue() {
    setShowGate(true);
  }

  function advanceFromGateToStep2() {
    setShowGate(false);
    setSession((prev) => ({ ...prev, isPlannedTrade: false, currentStep: 2 }));
  }

  function streamNora(userMessage: string) {
    setNoraStreaming(true);
    setNoraStreamingText('');
    setNoraCoachingResponse('');
    abortNoraRef.current = streamClaude(
      {
        messages: [{ role: 'user', content: userMessage }],
        systemPromptOverride: NORA_INTERCEPT_SYSTEM,
        maxWebSearches: 0,
      },
      {
        onChunk: (text) => setNoraStreamingText((prev) => prev + text),
        onDone:  (content) => { setNoraCoachingResponse(content); setNoraStreaming(false); },
        onError: () => setNoraStreaming(false),
      },
    );
  }

  function advanceToStep3() {
    const matched = matchRules(session.decisionType!, session.emotionalTriggers);
    setSession((prev) => ({
      ...prev,
      currentStep:         3,
      rulesMatched:        matched,
      playbookGapDetected: matched.length === 0,
    }));
    streamNora(buildFullCoachingPrompt(session, matched));
  }

  function advanceFromGateToStep3Planned() {
    const matched = matchRulesForPlannedTrade(session.decisionType!);
    setShowGate(false);
    setSession((prev) => ({
      ...prev,
      isPlannedTrade:      true,
      currentStep:         3,
      rulesMatched:        matched,
      playbookGapDetected: matched.length === 0,
    }));
    streamNora(buildPlannedTradeCoachingPrompt(session));
  }

  function selectDecisionType(dt: DecisionType) {
    setSession((prev) => ({
      ...prev,
      decisionType:      dt,
      // Reset triggers if decision type changes
      emotionalTriggers: prev.decisionType !== dt ? [] : prev.emotionalTriggers,
    }));
  }

  function toggleTrigger(trigger: DecisionTrigger) {
    setSession((prev) => {
      const has = prev.emotionalTriggers.includes(trigger);
      return {
        ...prev,
        emotionalTriggers: has
          ? prev.emotionalTriggers.filter((t) => t !== trigger)
          : [...prev.emotionalTriggers, trigger],
      };
    });
  }

  function handleTickerChange(info: TickerInfo | null) {
    setTickerInfo(info);
    setSession((prev) => ({
      ...prev,
      ticker:    info?.ticker    ?? '',
      assetName: info?.name      ?? '',
    }));
  }

  // ── Logging ────────────────────────────────────────────────────────────────

  async function logAndShowSuccess(
    verdict: 'follow-playbook' | 'conscious-proceed' | 'no-rules-matched',
    overrideReason_?: string,
    tradeExecuted_?: boolean,
  ) {
    // Capture first-log status before the write so we can prompt after success.
    // decisionsLoaded ensures we have a reliable count (not an optimistic 0).
    isFirstLogRef.current = decisionsLoaded && logs.length === 0;

    setLogging(true);
    const id = await addLog({
      ticker:            session.ticker,
      assetName:         session.assetName,
      decisionType:      session.decisionType!,
      emotionalTriggers: session.emotionalTriggers,
      rulesMatched:      session.rulesMatched.map((r) => r.id),
      verdict,
      overrideReason:    overrideReason_,
      tradeExecuted:     tradeExecuted_,
      priceAtDecision:   livePrice ?? 0,
      currency:          liveCurrency,
    });
    setLogging(false);
    setLoggedId(id);
    setShowSuccess(true);
  }

  async function handleFollowPlaybook() {
    await logAndShowSuccess('follow-playbook');
    // Skip auto-dismiss on the first completed session so the user can tap
    // "Done" and reach the extended-profile prompt.
    const needsExtendedProfile = isFirstLogRef.current && !profile?.ageRange;
    if (!needsExtendedProfile) {
      successTimerRef.current = setTimeout(() => {
        setShowSuccess(false);
        // No gap (rules matched) — just reset after success
        resetWizard();
      }, 2500);
    }
  }

  function handleOverride() {
    setShowConscious(true);
  }

  function handleProceedAnyway() {
    setShowConscious(true);
  }

  async function handleConsciousConfirm() {
    if (overrideReason.trim().length < 20) return;
    setShowConscious(false);
    const verdict = session.rulesMatched.length > 0 ? 'conscious-proceed' : 'no-rules-matched';
    await logAndShowSuccess(verdict, overrideReason.trim(), tradeExecuted);

    // Skip auto-dismiss on the user's first session so they can tap "Done"
    // and reach the extended-profile prompt (same gate as handleFollowPlaybook).
    const needsExtendedProfile = isFirstLogRef.current && !profile?.ageRange;
    if (!needsExtendedProfile && !session.playbookGapDetected) {
      // Rules existed but user overrode — auto-reset after success
      successTimerRef.current = setTimeout(() => {
        setShowSuccess(false);
        resetWizard();
      }, 2500);
    }
    // If gap detected, or first-log extended profile pending, user must tap Done
  }

  function handleSuccessDone() {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    setShowSuccess(false);

    // After the user's very first completed Intercept, nudge them to finish
    // their profile — but only if the extended questions haven't been answered yet.
    if (isFirstLogRef.current && !profile?.ageRange) {
      Alert.alert(
        'Want to sharpen your profile?',
        'It takes 2 minutes. Four quick questions help personalise every future session.',
        [
          {
            text: 'Let\'s do it',
            onPress: () => {
              resetWizard();
              router.push('/extended-profile');
            },
          },
          {
            text: 'Maybe later',
            style: 'cancel',
            onPress: () => {
              if (session.playbookGapDetected) {
                showGapPrompt();
              } else {
                resetWizard();
              }
            },
          },
        ],
      );
      return;
    }

    if (session.playbookGapDetected) {
      showGapPrompt();
    } else {
      resetWizard();
    }
  }

  function showGapPrompt() {
    const suggestedCat = suggestCategory(session.emotionalTriggers);
    Alert.alert(
      "You don't have a rule for this yet",
      'Would you like to add one to your playbook now?',
      [
        {
          text: 'Add a rule',
          onPress: () => {
            setRuleWizardCategory(suggestedCat);
            setRuleWizardVisible(true);
          },
        },
        {
          text: 'Not now',
          style: 'cancel',
          onPress: resetWizard,
        },
      ],
    );
  }

  async function handleRuleWizardSave(partial: Partial<PlaybookRule>) {
    await addRule({
      category:      partial.category!,
      title:         partial.title!,
      body:          partial.body!,
      status:        partial.status ?? 'active',
      sourceTrigger: 'manual',
      decisionTypes: partial.decisionTypes ?? ['buy', 'sell', 'unsure'],
      triggerTags:   partial.triggerTags ?? [],
    });
    await reloadRules();
    setRuleWizardVisible(false);
    resetWizard();
  }

  function handleBuildRuleFirst() {
    const dtLabel =
      session.decisionType === 'buy'  ? 'buying'  :
      session.decisionType === 'sell' ? 'selling' : 'a decision about';
    const triggerList = session.emotionalTriggers.map((t) => TRIGGER_LABEL[t]).join(', ');
    const coachingBlock = noraCoachingResponse
      ? `\n\nNora's initial read:\n${noraCoachingResponse}`
      : '';
    const goalLine   = profile?.primaryGoal  ? `\nMy investment goal: ${profile.primaryGoal}`    : '';
    const worldLine  = profile?.worldview    ? `\nMy investing worldview: ${profile.worldview}`  : '';

    const noraSeed =
      `I want to build a Playbook rule based on what just came up. Here's the context:\n\n` +
      `I was considering ${dtLabel} ${session.assetName || session.ticker}` +
      (session.ticker ? ` (${session.ticker})` : '') + `.` +
      `\nTriggers I identified: ${triggerList || 'unclear'}.` +
      `${coachingBlock}` +
      `\n\nMy profile:${goalLine}${worldLine}` +
      `\n\nHelp me articulate this as a Playbook rule that reflects genuine investment discipline — ` +
      `not a rigid constraint, but a mirror of my values. Only suggest a rule if it actually makes sense ` +
      `given my situation. Ask me clarifying questions if needed before drafting anything.`;

    Alert.alert(
      'Build a rule',
      'Work on it with Nora, or write it yourself?',
      [
        {
          text: 'Work on it with Nora',
          onPress: () => router.push({ pathname: '/(tabs)/chat', params: { seed: noraSeed } }),
        },
        {
          text: 'Write it myself',
          onPress: () => {
            const suggestedCat = suggestCategory(session.emotionalTriggers);
            setRuleWizardCategory(suggestedCat);
            setRuleWizardVisible(true);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  // ── "Talk it through" → seeds chat with Nora coaching context ─────────────

  function handleTalkItThrough() {
    const dtLabel =
      session.decisionType === 'buy'  ? 'buying'  :
      session.decisionType === 'sell' ? 'selling' : 'a decision about';
    const triggerList = session.emotionalTriggers
      .map((t) => TRIGGER_LABEL[t])
      .join(', ');
    const coachingBlock = noraCoachingResponse
      ? `\n\nNora's initial coaching:\n${noraCoachingResponse}`
      : '';
    const msg =
      `I'm considering ${dtLabel} ${session.assetName} (${session.ticker}). ` +
      `The triggers I identified were: ${triggerList || 'unclear'}.${coachingBlock} ` +
      `Help me think through this further.`;

    router.push({ pathname: '/(tabs)/chat', params: { seed: msg } });
  }

  // ── Gap: proceed without ConsciousProceedSheet ────────────────────────────

  async function handleGapProceedAnyway() {
    await logAndShowSuccess('no-rules-matched');
  }

  // ── "Learn first" → Nora chat with context seed ──────────────────────────

  function handleLearnFirst() {
    const topic = deriveTopicFromTicker(session.ticker, session.assetName);
    const dtLabel =
      session.decisionType === 'buy'  ? 'buying'  :
      session.decisionType === 'sell' ? 'selling' : 'a decision about';
    const msg =
      `I want to understand ${topic} better before making this decision. ` +
      `I'm considering ${dtLabel} ${session.assetName || session.ticker}` +
      (session.ticker ? ` (${session.ticker})` : '') + `. ` +
      `Help me think through this.`;
    router.push({ pathname: '/(tabs)/chat', params: { seed: msg } });
  }

  // ── Return from Learn Mode: auto-open RuleWizard if category param present ─

  const { learnRuleCategory } = useLocalSearchParams<{ learnRuleCategory?: string }>();
  const lastLearnCategoryRef  = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!learnRuleCategory || learnRuleCategory === lastLearnCategoryRef.current) return;
    lastLearnCategoryRef.current = learnRuleCategory;
    setRuleWizardCategory(learnRuleCategory as RuleCategory);
    setRuleWizardVisible(true);
  }, [learnRuleCategory]);

  // ── Step 1 can-proceed check ───────────────────────────────────────────────

  const step1Ready = !!session.decisionType && !!session.ticker;
  const step2Ready = session.emotionalTriggers.length > 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <SafeAreaView style={s.safe}>

      {/* ── Rule wizard (gap prompt / "Build a rule first") ── */}
      <RuleWizard
        visible={ruleWizardVisible}
        onClose={() => { setRuleWizardVisible(false); resetWizard(); }}
        onSave={handleRuleWizardSave}
        preselectedCategory={ruleWizardCategory}
      />

      {/* ── Conscious Proceed sheet ── */}
      <ConsciousProceedSheet
        visible={showConscious}
        rulesMatched={session.rulesMatched}
        overrideRuleId={overrideRuleId}
        overrideReason={overrideReason}
        tradeExecuted={tradeExecuted}
        onSelectRule={setOverrideRuleId}
        onChangeReason={setOverrideReason}
        onToggleTrade={setTradeExecuted}
        onConfirm={handleConsciousConfirm}
        onCancel={() => setShowConscious(false)}
        loading={logging}
      />

      {/* ── Success overlay ── */}
      {showSuccess && (
        <SuccessOverlay
          loggedId={loggedId}
          gapDetected={session.playbookGapDetected}
          onViewDecisions={() => {
            if (successTimerRef.current) clearTimeout(successTimerRef.current);
            setShowSuccess(false);
            resetWizard();
            router.push('/(tabs)/decisions');
          }}
          onDone={handleSuccessDone}
        />
      )}

      {/* ── Wizard header ── */}
      <View style={s.header}>
        <View style={s.headerTop}>
          {session.currentStep > 1 || showGate ? (
            <TouchableOpacity
              onPress={showGate ? handleGateBack : goBack}
              style={s.backBtn}
              activeOpacity={0.6}
            >
              <Ionicons name="chevron-back" size={22} color={W} />
            </TouchableOpacity>
          ) : (
            <View style={s.backBtn} />
          )}
          <Text style={s.headerTitle}>Intercept</Text>
          {session.currentStep > 1 || showGate ? (
            <TouchableOpacity onPress={resetWizard} style={s.backBtn} activeOpacity={0.6}>
              <Ionicons name="close" size={20} color={G2} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => router.push({ pathname: '/how-it-works', params: { tab: 'intercept' } })} activeOpacity={0.6} style={s.backBtn}>
              <Text style={s.headerInfoText}>?</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Progress dots — 3 steps */}
        <View style={s.dots}>
          {([1, 2, 3] as const).map((n) => (
            <View
              key={n}
              style={[s.dot, session.currentStep === n && s.dotActive,
                             session.currentStep > n  && s.dotDone]}
            />
          ))}
        </View>

        <Text style={s.headerSub}>
          {session.currentStep === 3 && noraStreaming
            ? 'Checking your playbook…'
            : showGate
              ? 'Is this trade part of your plan?'
              : STEP_SUBTITLES[session.currentStep]}
        </Text>
      </View>

      {/* ── Step content ── */}
      {session.currentStep === 1 && showGate && (
        <PlannedTradeGate
          onPartOfPlan={advanceFromGateToStep3Planned}
          onJustCameUp={advanceFromGateToStep2}
        />
      )}

      {session.currentStep === 1 && !showGate && (
        <Step1
          decisionType={session.decisionType}
          tickerInfo={tickerInfo}
          vaultHolding={vaultHolding}
          livePrice={livePrice}
          liveCurrency={liveCurrency}
          priceLoading={priceLoading}
          onSelectDecision={selectDecisionType}
          onSelectTicker={handleTickerChange}
          onNext={handleStep1Continue}
          canNext={step1Ready}
        />
      )}

      {session.currentStep === 2 && (
        <Step2
          decisionType={session.decisionType}
          selectedTriggers={session.emotionalTriggers}
          onToggle={toggleTrigger}
          onNext={advanceToStep3}
          canNext={step2Ready}
        />
      )}

      {session.currentStep === 3 && (
        <Step3
          session={session}
          noraStreamingText={noraStreamingText}
          noraStreaming={noraStreaming}
          vaultHolding={vaultHolding}
          livePrice={livePrice}
          liveCurrency={liveCurrency}
          convictions={convictions}
          logging={logging}
          onFollowPlaybook={handleFollowPlaybook}
          onOverride={handleOverride}
          onTalkItThrough={handleTalkItThrough}
          onLearnFirst={handleLearnFirst}
          onBuildRuleNow={handleBuildRuleFirst}
          onProceedAnyway={handleGapProceedAnyway}
        />
      )}
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLANNED TRADE GATE (Step 1.5)
// ═══════════════════════════════════════════════════════════════════════════════

function PlannedTradeGate({
  onPartOfPlan, onJustCameUp,
}: { onPartOfPlan: () => void; onJustCameUp: () => void }) {
  return (
    <View style={s.stepFlex}>
      <View style={s.gateContent}>
        <Text style={s.gateQuestion}>
          Is this trade already part of your plan?
        </Text>
        <Text style={s.gateSub}>
          This changes how Nora coaches you through it.
        </Text>

        <TouchableOpacity style={s.gatePrimaryBtn} onPress={onPartOfPlan} activeOpacity={0.8}>
          <Ionicons name="checkmark-circle-outline" size={20} color={GOLD} />
          <View style={s.gateBtnBody}>
            <Text style={s.gatePrimaryBtnText}>Part of my plan</Text>
            <Text style={s.gateBtnSub}>I planned this — just need a sizing or timing check</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color={GOLD} />
        </TouchableOpacity>

        <TouchableOpacity style={s.gateSecondaryBtn} onPress={onJustCameUp} activeOpacity={0.8}>
          <Ionicons name="flash-outline" size={20} color={G1} />
          <View style={s.gateBtnBody}>
            <Text style={s.gateSecondaryBtnText}>Just came up</Text>
            <Text style={s.gateBtnSub}>This is a fresh impulse — run the full check</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color={G2} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 1 — DECLARE
// ═══════════════════════════════════════════════════════════════════════════════

interface Step1Props {
  decisionType:    DecisionType | null;
  tickerInfo:      TickerInfo | null;
  vaultHolding:    any | null;
  livePrice:       number | null;
  liveCurrency:    string;
  priceLoading:    boolean;
  onSelectDecision:(dt: DecisionType) => void;
  onSelectTicker:  (info: TickerInfo | null) => void;
  onNext:          () => void;
  canNext:         boolean;
}

const DECISION_OPTIONS: { type: DecisionType; label: string; sub: string; icon: string }[] = [
  { type: 'buy',   label: 'Buy',                   sub: 'I want to purchase this asset',   icon: 'trending-up-outline'   },
  { type: 'sell',  label: 'Sell',                   sub: 'I want to sell this asset',       icon: 'trending-down-outline' },
  { type: 'unsure', label: "I'm not sure what to do", sub: 'Help me think this through',     icon: 'help-circle-outline'   },
];

function Step1({
  decisionType, tickerInfo, vaultHolding, livePrice, liveCurrency,
  priceLoading, onSelectDecision, onSelectTicker, onNext, canNext,
}: Step1Props) {
  return (
    <ScrollView
      style={s.stepScroll}
      contentContainerStyle={s.stepContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Decision type selector */}
      <View style={s.decisionList}>
        {DECISION_OPTIONS.map((opt, i) => {
          const sel = decisionType === opt.type;
          return (
            <TouchableOpacity
              key={opt.type}
              style={[
                s.decisionCard,
                i < DECISION_OPTIONS.length - 1 && s.decisionCardBorder,
                sel && s.decisionCardSel,
              ]}
              onPress={() => onSelectDecision(opt.type)}
              activeOpacity={0.6}
            >
              <View style={[s.decisionAccent, sel && s.decisionAccentSel]} />
              <View style={s.decisionBody}>
                <Text style={[s.decisionLabel, sel && s.decisionLabelSel]}>{opt.label}</Text>
                <Text style={s.decisionSub}>{opt.sub}</Text>
              </View>
              <Ionicons
                name={opt.icon as any}
                size={20}
                color={sel ? GOLD : G2}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Ticker search */}
      <View style={s.tickerSection}>
        <Text style={s.sectionLabel}>Which asset?</Text>
        <TickerSearch
          value={tickerInfo}
          onChange={onSelectTicker}
          placeholder="Search ticker or company name…"
        />
      </View>

      {/* Vault context strip */}
      {tickerInfo && vaultHolding && (
        <VaultContextStrip
          holding={vaultHolding}
          livePrice={livePrice}
          liveCurrency={liveCurrency}
          loading={priceLoading}
        />
      )}

      {/* Next button */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.nextBtn, !canNext && s.nextBtnOff]}
          onPress={onNext}
          disabled={!canNext}
          activeOpacity={0.8}
        >
          <Text style={[s.nextBtnText, !canNext && s.nextBtnTextOff]}>Continue</Text>
          <Ionicons name="arrow-forward" size={18} color={canNext ? BG : G2} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 2 — IDENTIFY
// ═══════════════════════════════════════════════════════════════════════════════

interface Step2Props {
  decisionType:     DecisionType | null;
  selectedTriggers: DecisionTrigger[];
  onToggle:         (t: DecisionTrigger) => void;
  onNext:           () => void;
  canNext:          boolean;
}

function Step2({ decisionType, selectedTriggers, onToggle, onNext, canNext }: Step2Props) {
  const options = triggersForDecision(decisionType);
  return (
    <View style={s.stepFlex}>
      <ScrollView
        style={s.stepScroll}
        contentContainerStyle={[s.stepContent, { paddingBottom: 8 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.instructionText}>Select all that apply.</Text>
        <View style={s.triggerList}>
          {options.map((opt, i) => {
            const sel = selectedTriggers.includes(opt.trigger);
            return (
              <TouchableOpacity
                key={opt.trigger}
                style={[
                  s.triggerRow,
                  i < options.length - 1 && s.triggerRowBorder,
                  sel && s.triggerRowSel,
                ]}
                onPress={() => onToggle(opt.trigger)}
                activeOpacity={0.6}
              >
                <View style={[s.triggerDot, sel && s.triggerDotSel]}>
                  {sel && <View style={s.triggerDotFill} />}
                </View>
                <Text style={[s.triggerLabel, sel && s.triggerLabelSel]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.nextBtn, !canNext && s.nextBtnOff]}
          onPress={onNext}
          disabled={!canNext}
          activeOpacity={0.8}
        >
          <Text style={[s.nextBtnText, !canNext && s.nextBtnTextOff]}>Check my playbook</Text>
          <Ionicons name="arrow-forward" size={18} color={canNext ? BG : G2} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 3 — TRIAGE + VERDICT (combined)
// ═══════════════════════════════════════════════════════════════════════════════

interface Step3Props {
  session:          InterceptSession;
  noraStreamingText:string;
  noraStreaming:    boolean;
  vaultHolding:    any | null;
  livePrice:       number | null;
  liveCurrency:    string;
  convictions:     Conviction[];
  logging:         boolean;
  onFollowPlaybook:() => void;
  onOverride:      () => void;
  onTalkItThrough: () => void;
  onLearnFirst:    () => void;
  onBuildRuleNow:  () => void;
  onProceedAnyway: () => void;
}

function Step3({
  session, noraStreamingText, noraStreaming, vaultHolding, livePrice, liveCurrency,
  convictions, logging, onFollowPlaybook, onOverride, onTalkItThrough,
  onLearnFirst, onBuildRuleNow, onProceedAnyway,
}: Step3Props) {
  const { rulesMatched, playbookGapDetected } = session;

  const relevantConviction = useMemo(() => {
    const theme = tickerToConvictionTheme(session.ticker, session.assetName);
    if (!theme) return null;
    return convictions.find(
      (c) => c.theme === theme && (c.belief === 'yes' || c.belief === 'still-forming'),
    ) ?? null;
  }, [convictions, session.ticker, session.assetName]);

  return (
    <View style={s.stepFlex}>
      <ScrollView
        style={s.stepScroll}
        contentContainerStyle={[s.stepContent, { paddingBottom: 8 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Vault context strip */}
        {vaultHolding && (
          <VaultContextStrip
            holding={vaultHolding}
            livePrice={livePrice}
            liveCurrency={liveCurrency}
            loading={false}
          />
        )}

        {/* Nora coaching response (streaming) */}
        <View style={s.noraResponseCard}>
          {noraStreaming && noraStreamingText.length === 0 ? (
            <ActivityIndicator size="small" color={GOLD} />
          ) : (
            <Text style={s.noraResponseText}>{noraStreamingText}</Text>
          )}
          {noraStreaming && noraStreamingText.length > 0 && (
            <ActivityIndicator size="small" color={GOLD} style={{ marginTop: 8 }} />
          )}
        </View>

        {/* Rules matched case */}
        {!playbookGapDetected && (
          <>
            <Text style={s.triageSummary}>
              Your playbook has{' '}
              <Text style={s.triageSummaryBold}>
                {rulesMatched.length} rule{rulesMatched.length !== 1 ? 's' : ''}
              </Text>
              {' '}for this moment.
            </Text>
            {rulesMatched.map((rule) => (
              <RuleCard key={rule.id} rule={rule} />
            ))}
            {relevantConviction && (
              <View style={s.convictionRefCard}>
                <Ionicons name="bulb-outline" size={16} color={GOLD} />
                <View style={s.convictionRefBody}>
                  <Text style={s.convictionRefTitle}>Your worldview</Text>
                  <Text style={s.convictionRefText}>
                    You{relevantConviction.belief === 'still-forming' ? ' may believe' : ' believe'} in{' '}
                    <Text style={s.convictionRefBold}>{CONVICTION_THEME_LABEL[relevantConviction.theme]}</Text>.
                    {' '}Is this decision consistent with that?
                  </Text>
                </View>
              </View>
            )}
          </>
        )}

        {/* Gap case — 4 options */}
        {playbookGapDetected && (
          <View style={s.noRulesCard}>
            <Ionicons name="alert-circle-outline" size={32} color={GOLD} />
            <Text style={s.noRulesTitle}>You don't have a rule for this yet.</Text>
            <Text style={s.noRulesBody}>
              No rule in your playbook covers this exact situation. What would you like to do?
            </Text>

            <TouchableOpacity style={s.learnFirstBtn} onPress={onLearnFirst} activeOpacity={0.8}>
              <Ionicons name="school-outline" size={16} color={GOLD} />
              <Text style={s.learnFirstBtnText}>
                Learn about {session.assetName || session.ticker} first
              </Text>
              <Ionicons name="arrow-forward" size={14} color={GOLD} />
            </TouchableOpacity>

            <View style={s.noRulesActions}>
              <TouchableOpacity style={s.learnBtn} onPress={onTalkItThrough} activeOpacity={0.7}>
                <Text style={s.learnBtnText}>Talk it through</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.learnBtn} onPress={onBuildRuleNow} activeOpacity={0.7}>
                <Text style={s.learnBtnText}>Build a rule now</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.talkLink} onPress={onProceedAnyway} activeOpacity={0.6}>
              <Text style={s.talkLinkText}>Proceed anyway →</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Action buttons — rules matched case only */}
      {!playbookGapDetected && (
        <View style={s.footer}>
          <TouchableOpacity
            style={[s.nextBtn, logging && { opacity: 0.5 }]}
            onPress={onFollowPlaybook}
            disabled={logging}
            activeOpacity={0.8}
          >
            {logging
              ? <ActivityIndicator color={BG} />
              : <Text style={s.nextBtnText}>Follow Playbook</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity style={s.talkItThroughBtn} onPress={onTalkItThrough} activeOpacity={0.7}>
            <Text style={s.talkItThroughBtnText}>Talk it through with Nora</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.overrideBtn} onPress={onOverride} disabled={logging} activeOpacity={0.7}>
            <Text style={s.overrideBtnText}>Override and proceed</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VAULT CONTEXT STRIP
// ═══════════════════════════════════════════════════════════════════════════════

function VaultContextStrip({
  holding, livePrice, liveCurrency, loading,
}: {
  holding: any;
  livePrice: number | null;
  liveCurrency: string;
  loading: boolean;
}) {
  const qty = parseFloat(holding.quantity ?? '0');
  const value = livePrice && qty > 0 ? qty * livePrice : null;

  return (
    <View style={s.vaultStrip}>
      <Ionicons name="lock-closed-outline" size={13} color={GOLD} />
      <Text style={s.vaultStripText}>
        You hold{' '}
        <Text style={s.vaultStripBold}>{qty > 0 ? qty.toLocaleString() : '—'} shares</Text>
        {loading
          ? '  ·  fetching price…'
          : livePrice
            ? `  ·  ${liveCurrency} ${fmt(livePrice)}`
            : ''
        }
        {value && !loading ? `  ·  Total value: ${liveCurrency} ${fmt(value)}` : ''}
      </Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSCIOUS PROCEED SHEET (4B)
// ═══════════════════════════════════════════════════════════════════════════════

interface ConsciousProceedProps {
  visible:        boolean;
  rulesMatched:   PlaybookRule[];
  overrideRuleId: string;
  overrideReason: string;
  tradeExecuted:  boolean | undefined;
  onSelectRule:   (id: string) => void;
  onChangeReason: (r: string) => void;
  onToggleTrade:  (v: boolean | undefined) => void;
  onConfirm:      () => void;
  onCancel:       () => void;
  loading:        boolean;
}

function ConsciousProceedSheet({
  visible, rulesMatched, overrideRuleId, overrideReason, tradeExecuted,
  onSelectRule, onChangeReason, onToggleTrade, onConfirm, onCancel, loading,
}: ConsciousProceedProps) {
  const reasonReady = overrideReason.trim().length >= 20;
  const charsLeft   = Math.max(0, 20 - overrideReason.trim().length);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={s.sheetOverlay} onPress={onCancel}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <View style={s.sheetHandle} />

            <Text style={s.sheetTitle}>Override Your Playbook</Text>
            <Text style={s.sheetSub}>
              Proceeding consciously means you've seen your rules and chosen to set one aside.
              That's your right — but it should be a deliberate choice.
            </Text>

            {/* Which rule are you setting aside? */}
            {rulesMatched.length > 0 && (
              <View style={s.sheetSection}>
                <Text style={s.sheetSectionLabel}>Which rule are you setting aside?</Text>
                {rulesMatched.map((rule) => (
                  <TouchableOpacity
                    key={rule.id}
                    style={[s.rulePickRow, overrideRuleId === rule.id && s.rulePickRowSel]}
                    onPress={() => onSelectRule(rule.id)}
                    activeOpacity={0.6}
                  >
                    <View style={[s.miniRadio, overrideRuleId === rule.id && s.miniRadioSel]}>
                      {overrideRuleId === rule.id && <View style={s.miniRadioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rulePickLabel} numberOfLines={2}>{rule.title}</Text>
                      {rule.overrideCount > 0 && (
                        <Text style={s.ruleOverrideCount}>
                          Overridden {rule.overrideCount} time{rule.overrideCount !== 1 ? 's' : ''}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[s.rulePickRow, overrideRuleId === 'none' && s.rulePickRowSel]}
                  onPress={() => onSelectRule('none')}
                  activeOpacity={0.6}
                >
                  <View style={[s.miniRadio, overrideRuleId === 'none' && s.miniRadioSel]}>
                    {overrideRuleId === 'none' && <View style={s.miniRadioDot} />}
                  </View>
                  <Text style={s.rulePickLabel}>None — I just want to proceed</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Reasoned case */}
            <View style={s.sheetSection}>
              <Text style={s.sheetSectionLabel}>What's your reasoned case for proceeding?</Text>
              <TextInput
                style={s.reasonInput}
                value={overrideReason}
                onChangeText={onChangeReason}
                placeholder="Write out your reasoning. Be honest with yourself."
                placeholderTextColor={G2}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              {!reasonReady && overrideReason.length > 0 && (
                <Text style={s.charsHint}>{charsLeft} more character{charsLeft !== 1 ? 's' : ''} required</Text>
              )}
            </View>

            {/* Trade executed toggle */}
            <View style={s.sheetSection}>
              <Text style={s.sheetSectionLabel}>Did you (or will you) execute this trade?</Text>
              <View style={s.tradeToggle}>
                {([
                  { label: 'Yes',     value: true      },
                  { label: 'No',      value: false     },
                  { label: 'Not yet', value: undefined },
                ] as { label: string; value: boolean | undefined }[]).map((opt) => (
                  <TouchableOpacity
                    key={opt.label}
                    style={[s.tradeOption, tradeExecuted === opt.value && s.tradeOptionSel]}
                    onPress={() => onToggleTrade(opt.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.tradeOptionText, tradeExecuted === opt.value && s.tradeOptionTextSel]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[s.confirmBtn, !reasonReady && s.confirmBtnOff]}
              onPress={onConfirm}
              disabled={!reasonReady || loading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator color={BG} />
                : <Text style={[s.confirmBtnText, !reasonReady && s.confirmBtnTextOff]}>
                    Confirm &amp; Log Decision
                  </Text>
              }
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUCCESS OVERLAY
// ═══════════════════════════════════════════════════════════════════════════════

function SuccessOverlay({
  loggedId, gapDetected, onViewDecisions, onDone,
}: {
  loggedId:       string | null;
  gapDetected:    boolean;
  onViewDecisions:() => void;
  onDone:         () => void;
}) {
  return (
    <View style={s.successOverlay}>
      <View style={s.successCard}>
        <View style={s.successIcon}>
          <Ionicons name="checkmark" size={32} color={BG} />
        </View>
        <Text style={s.successTitle}>Decision logged.</Text>
        <Text style={s.successBody}>Your decision is on the record.</Text>

        {gapDetected && (
          <View style={s.successGapNote}>
            <Text style={s.successGapText}>
              You didn't have a rule for this. Tap Done to add one.
            </Text>
          </View>
        )}

        <TouchableOpacity style={s.successViewBtn} onPress={onViewDecisions} activeOpacity={0.7}>
          <Text style={s.successViewBtnText}>View in Decisions</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onDone} activeOpacity={0.6} style={s.successDoneBtn}>
          <Text style={s.successDoneBtnText}>{gapDetected ? 'Done → Add a rule' : 'Done'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  centerTitle: { fontSize: 22, fontFamily: SERIF_BOLD, color: W, letterSpacing: 0.2, textAlign: 'center' },
  centerBody:  { fontSize: 15, color: G1, fontFamily: BODY, fontStyle: 'italic', lineHeight: 22, textAlign: 'center' },
  centerBtn:   { marginTop: 8, backgroundColor: GOLD, paddingHorizontal: 28, paddingVertical: 14, borderRadius: R_SM },
  centerBtnText: { color: ON_PRIMARY, fontSize: 14, fontFamily: SERIF_BOLD },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn:        { width: 32, alignItems: 'center' },
  headerInfoText: { fontSize: 14, color: G2, fontFamily: BODY, fontWeight: '600' },
  headerTitle: { fontSize: 22, fontFamily: SERIF_BOLD, color: W, letterSpacing: 0.2 },
  headerSub:  { fontSize: 14, color: G1, fontFamily: BODY, fontStyle: 'italic', textAlign: 'center', lineHeight: 20 },

  // Progress dots
  dots:      { flexDirection: 'row', justifyContent: 'center', gap: 7 },
  dot:       { width: 7, height: 7, borderRadius: 2, backgroundColor: S2 },
  dotActive: { backgroundColor: GOLD, width: 20, borderRadius: 1 },
  dotDone:   { backgroundColor: G3 },

  // ── Shared step layout ────────────────────────────────────────────────────
  stepFlex:    { flex: 1 },
  stepScroll:  { flex: 1 },
  stepContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: TAB_BAR_HEIGHT, gap: 16 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: G2,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  instructionText: { fontSize: 14, color: G1, fontFamily: BODY, marginBottom: 4 },

  // ── Footer / next button ──────────────────────────────────────────────────
  footer:      { paddingHorizontal: 20, paddingBottom: TAB_BAR_HEIGHT, paddingTop: 12 },
  nextBtn:     {
    flexDirection: 'row',
    backgroundColor: GOLD,
    borderRadius: R_SM,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextBtnOff:     { backgroundColor: S2 },
  nextBtnText:    { color: ON_PRIMARY, fontSize: 15, fontFamily: SERIF_BOLD },
  nextBtnTextOff: { color: G2 },

  // ── Step 1: decision type cards ───────────────────────────────────────────
  decisionList: {
    borderRadius: R,
    overflow: 'hidden',
    gap: 2,
  },
  decisionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: S1,
    gap: 12,
    borderRadius: R,
  },
  decisionCardBorder: {},
  decisionCardSel:  { backgroundColor: S_HIGH },
  decisionAccent:   { width: 2, height: 32, borderRadius: 1, backgroundColor: 'transparent' },
  decisionAccentSel:{ backgroundColor: GOLD },
  decisionBody:     { flex: 1, gap: 3 },
  decisionLabel:    { fontSize: 16, fontFamily: SERIF, color: G1 },
  decisionLabelSel: { color: W },
  decisionSub:      { fontSize: 13, color: G2, fontFamily: BODY, fontStyle: 'italic' },

  // ── Ticker section ────────────────────────────────────────────────────────
  tickerSection: { gap: 8 },

  // ── Vault context strip ───────────────────────────────────────────────────
  vaultStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: S1,
    borderRadius: R,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderLeftWidth: 2,
    borderLeftColor: GOLD,
  },
  vaultStripText: { flex: 1, fontSize: 13, color: G1, lineHeight: 19, fontFamily: BODY },
  vaultStripBold: { color: W, fontFamily: SERIF_SEMI },

  // ── Step 2: triggers ──────────────────────────────────────────────────────
  triggerList: {
    gap: 2,
  },
  triggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 14,
    backgroundColor: S1,
    borderRadius: R,
  },
  triggerRowBorder: {},
  triggerRowSel:  { backgroundColor: S_HIGH },
  triggerDot:    {
    width: 18, height: 18, borderRadius: 2,
    borderWidth: 1.5, borderColor: G3,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  triggerDotSel:  { borderColor: GOLD, backgroundColor: 'transparent' },
  triggerDotFill: { width: 8, height: 8, borderRadius: 1, backgroundColor: GOLD },
  triggerLabel:    { flex: 1, fontSize: 15, color: G1, lineHeight: 21, fontFamily: BODY },
  triggerLabelSel: { color: W },

  // ── Gate (Step 1.5) ───────────────────────────────────────────────────────
  gateContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 16,
  },
  gateQuestion: { fontSize: 20, fontFamily: SERIF_BOLD, color: W, letterSpacing: 0.1, lineHeight: 28 },
  gateSub:      { fontSize: 14, color: G1, fontFamily: BODY, fontStyle: 'italic', marginBottom: 4 },
  gatePrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: S_HIGH,
    borderRadius: R,
    borderLeftWidth: 2,
    borderLeftColor: GOLD,
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 12,
  },
  gateSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: S1,
    borderRadius: R,
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 12,
  },
  gateBtnBody:         { flex: 1, gap: 3 },
  gatePrimaryBtnText:  { fontSize: 16, fontFamily: SERIF_SEMI, color: GOLD },
  gateSecondaryBtnText:{ fontSize: 16, fontFamily: SERIF_SEMI, color: W },
  gateBtnSub:          { fontSize: 13, color: G2, fontFamily: BODY, fontStyle: 'italic' },

  // ── Step 3: Nora response card ────────────────────────────────────────────
  noraResponseCard: {
    backgroundColor: S1,
    borderRadius: R,
    borderLeftWidth: 2,
    borderLeftColor: GOLD,
    padding: 16,
    minHeight: 48,
  },
  noraResponseText: {
    fontSize: 14,
    color: G1,
    fontFamily: BODY,
    fontStyle: 'italic',
    lineHeight: 21,
  },

  // ── Step 3: action buttons ────────────────────────────────────────────────
  talkItThroughBtn: {
    backgroundColor: S1,
    borderRadius: R_SM,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  talkItThroughBtnText: { color: G1, fontSize: 14, fontFamily: SERIF, fontStyle: 'italic' },

  // ── Step 3: triage ────────────────────────────────────────────────────────
  triageSummary:      { fontSize: 14, color: G1, fontFamily: BODY, lineHeight: 20 },
  triageSummaryBold:  { color: W, fontWeight: '600' },

  ruleCard: {
    flexDirection: 'row',
    backgroundColor: S1,
    borderRadius: R,
    overflow: 'hidden',
  },
  ruleCardAccent: { width: 2, backgroundColor: GOLD },
  ruleCardBody:   { flex: 1, padding: 14, gap: 5 },
  ruleCategoryTag:{ fontSize: 10, fontFamily: BODY, color: GOLD, textTransform: 'uppercase', letterSpacing: 0.8 },
  ruleTitle:      { fontSize: 15, fontFamily: SERIF_SEMI, color: W },
  ruleBody:       { fontSize: 13, color: G1, lineHeight: 19, fontFamily: BODY },

  noRulesCard: {
    backgroundColor: S1,
    borderRadius: R,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  noRulesTitle:   { fontSize: 17, fontFamily: SERIF_SEMI, color: W, textAlign: 'center' },
  noRulesBody:    { fontSize: 14, color: G1, fontFamily: BODY, fontStyle: 'italic', lineHeight: 21, textAlign: 'center' },

  learnFirstBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    width:           '100%',
    backgroundColor: S_HIGH,
    borderRadius:    R_SM,
    borderLeftWidth: 2,
    borderLeftColor: GOLD,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop:       2,
  },
  learnFirstBtnText: {
    flex:       1,
    fontSize:   14,
    fontFamily: SERIF,
    fontStyle:  'italic',
    color:      GOLD,
  },

  noRulesActions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  learnBtn:       {
    flex: 1, backgroundColor: S2, borderRadius: R_SM,
    paddingVertical: 13, alignItems: 'center',
  },
  learnBtnText:     { color: G1, fontSize: 14, fontFamily: SERIF },
  talkLink:     { alignSelf: 'center', paddingVertical: 6 },
  talkLinkText: { fontSize: 13, color: G2, textDecorationLine: 'underline', fontFamily: BODY },

  // ── Conviction reflection card (Step 3) ───────────────────────────────────
  convictionRefCard: {
    flexDirection:   'row',
    gap:             10,
    backgroundColor: S1,
    borderRadius:    R,
    borderLeftWidth: 2,
    borderLeftColor: GOLD,
    padding:         14,
    alignItems:      'flex-start',
  },
  convictionRefBody:  { flex: 1, gap: 3 },
  convictionRefTitle: { fontSize: 10, fontFamily: BODY, color: GOLD, textTransform: 'uppercase', letterSpacing: 0.8 },
  convictionRefText:  { fontSize: 13, color: G1, fontFamily: BODY, fontStyle: 'italic', lineHeight: 19 },
  convictionRefBold:  { color: W, fontFamily: SERIF_SEMI, fontStyle: 'normal' },

  overrideBtn: {
    backgroundColor: S1,
    borderRadius: R_SM,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  overrideBtnText: { color: G1, fontSize: 14, fontFamily: BODY },

  // ── Conscious Proceed sheet ───────────────────────────────────────────────
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: S1,
    borderTopLeftRadius: R_LG,
    borderTopRightRadius: R_LG,
    paddingHorizontal: 20,
    paddingBottom: 44,
    paddingTop: 16,
    maxHeight: '90%',
    gap: 4,
  },
  sheetHandle: {
    width: 32, height: 3, borderRadius: 2,
    backgroundColor: G3,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle:   { fontSize: 20, fontFamily: SERIF_BOLD, color: W, letterSpacing: 0.2 },
  sheetSub:     { fontSize: 13, color: G1, fontFamily: BODY, fontStyle: 'italic', lineHeight: 19, marginBottom: 8 },
  sheetSection: { gap: 8, marginTop: 12 },
  sheetSectionLabel: {
    fontSize: 10, fontFamily: BODY, color: G2,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },

  rulePickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  rulePickRowSel:    {},
  rulePickLabel:     { fontSize: 14, color: G1, fontFamily: BODY, lineHeight: 19 },
  ruleOverrideCount: { fontSize: 11, color: G2, fontFamily: BODY, marginTop: 2 },
  miniRadio: {
    width: 18, height: 18, borderRadius: 2,
    borderWidth: 1.5, borderColor: G3,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  miniRadioSel: { borderColor: GOLD },
  miniRadioDot: { width: 8, height: 8, borderRadius: 1, backgroundColor: GOLD },

  reasonInput: {
    backgroundColor: BG_DEEP,
    borderRadius: R,
    padding: 14,
    color: W,
    fontSize: 14,
    fontFamily: BODY,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charsHint: { fontSize: 12, color: G2, textAlign: 'right' },

  tradeToggle:       { flexDirection: 'row', gap: 8 },
  tradeOption:       {
    flex: 1, alignItems: 'center', paddingVertical: 11,
    borderRadius: R_SM, backgroundColor: S2,
  },
  tradeOptionSel:    { backgroundColor: S_HIGH },
  tradeOptionText:   { fontSize: 14, color: G1, fontFamily: BODY },
  tradeOptionTextSel:{ color: GOLD, fontFamily: SERIF, fontStyle: 'italic' },

  confirmBtn: {
    backgroundColor: GOLD,
    borderRadius: R_SM,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  confirmBtnOff:     { backgroundColor: S2 },
  confirmBtnText:    { color: ON_PRIMARY, fontSize: 14, fontFamily: SERIF_BOLD },
  confirmBtnTextOff: { color: G2 },

  // ── Success overlay ───────────────────────────────────────────────────────
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,22,16,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    paddingHorizontal: 32,
  },
  successCard: {
    backgroundColor: S1,
    borderRadius: R,
    padding: 28,
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  successIcon: {
    width: 56, height: 56, borderRadius: R,
    backgroundColor: GOLD,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  successTitle:      { fontSize: 22, fontFamily: SERIF_BOLD, color: W, letterSpacing: 0.2 },
  successBody:       { fontSize: 14, color: G1, fontFamily: BODY, fontStyle: 'italic', textAlign: 'center' },
  successGapNote:    { backgroundColor: S2, borderRadius: R, padding: 12, width: '100%' },
  successGapText:    { fontSize: 13, color: GOLD, fontFamily: BODY, fontStyle: 'italic', textAlign: 'center', lineHeight: 18 },
  successViewBtn:    {
    marginTop: 8, backgroundColor: S2,
    borderRadius: R_SM, paddingVertical: 14, paddingHorizontal: 24,
    width: '100%', alignItems: 'center',
  },
  successViewBtnText:{ color: W, fontSize: 14, fontFamily: SERIF_SEMI },
  successDoneBtn:    { paddingVertical: 8 },
  successDoneBtnText:{ color: GOLD, fontSize: 14, fontFamily: SERIF, fontStyle: 'italic' },
});
