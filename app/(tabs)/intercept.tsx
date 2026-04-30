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
import { router, useFocusEffect } from 'expo-router';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';

import { useGuest } from '@/contexts/GuestContext';
import { AccountModal } from '@/components/AccountModal';
import { TickerSearch } from '@/components/TickerSearch';
import { RuleWizard } from '@/components/RuleWizard';
import { usePlaybook } from '@/hooks/usePlaybook';
import { useDecisionLog } from '@/hooks/useDecisionLog';
import { useVaultData } from '@/hooks/useVaultData';
import { useLivePrices } from '@/hooks/useLivePrices';
import type { TickerInfo } from '@/data/tickerSearch';
import type {
  InterceptSession,
  DecisionType,
  DecisionTrigger,
  PlaybookRule,
  RuleCategory,
} from '@/types';

import { BG, S1, S2, LINE, W, GOLD, G1, G2, G3, SERIF, BODY } from '@/theme';

// ─── Trigger definitions ──────────────────────────────────────────────────────

interface TriggerOption {
  label:   string;
  trigger: DecisionTrigger;
}

const BUY_TRIGGERS: TriggerOption[] = [
  { label: "I've seen strong recent price performance",  trigger: 'recent-performance' },
  { label: "People I know are making money on this",     trigger: 'social-comparison'  },
  { label: "I'm worried about missing out",              trigger: 'price-rise-fomo'    },
  { label: "I feel confident about this company",        trigger: 'overconfidence'      },
  { label: "I've been reading a lot about this",         trigger: 'news-reaction'       },
  { label: "I'm not sure — something just feels right",  trigger: 'unsure'             },
];

const SELL_TRIGGERS: TriggerOption[] = [
  { label: "The price has dropped and I'm worried",      trigger: 'price-drop-fear'    },
  { label: "I've seen bad news about this company",      trigger: 'news-reaction'       },
  { label: "I want to lock in my gains",                 trigger: 'overconfidence'      },
  { label: "I regret buying this and want out",          trigger: 'regret-avoidance'    },
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
  3: "Checking your playbook…",
  4: "Here's what your playbook says.",
};

// ─── Initial session ─────────────────────────────────────────────────────────

const BLANK_SESSION: InterceptSession = {
  ticker:               '',
  assetName:            '',
  decisionType:         null,
  emotionalTriggers:    [],
  rulesMatched:         [],
  playbookGapDetected:  false,
  currentStep:          1,
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
  const [tickerInfo,    setTickerInfo]    = useState<TickerInfo | null>(null);
  const [checkingRules, setCheckingRules] = useState(false);

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

  // ── Data hooks ─────────────────────────────────────────────────────────────
  const { rules, reload: reloadRules, addRule, matchRules } = usePlaybook();
  const { addLog }   = useDecisionLog();
  const vaultData    = useVaultData();

  // Reload playbook when tab comes into focus
  useFocusEffect(useCallback(() => {
    reloadRules();
  }, [reloadRules]));

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

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (successTimerRef.current) clearTimeout(successTimerRef.current); };
  }, []);

  // ── Wizard navigation ──────────────────────────────────────────────────────

  function resetWizard() {
    setSession(BLANK_SESSION);
    setTickerInfo(null);
    setCheckingRules(false);
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
    if (session.currentStep > 1) {
      setSession((prev) => ({
        ...prev,
        currentStep: (prev.currentStep - 1) as 1 | 2 | 3 | 4,
      }));
    }
  }

  function advanceToStep2() {
    setSession((prev) => ({ ...prev, currentStep: 2 }));
  }

  function advanceToStep3() {
    setSession((prev) => ({ ...prev, currentStep: 3 }));
    setCheckingRules(true);
    setTimeout(() => {
      const matched = matchRules(session.decisionType!, session.emotionalTriggers);
      setSession((prev) => ({
        ...prev,
        rulesMatched:        matched,
        playbookGapDetected: matched.length === 0,
      }));
      setCheckingRules(false);
    }, 900);
  }

  function advanceToStep4() {
    setSession((prev) => ({ ...prev, currentStep: 4 }));
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
    successTimerRef.current = setTimeout(() => {
      setShowSuccess(false);
      // No gap (rules matched) — just reset after success
      resetWizard();
    }, 2500);
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

    if (!session.playbookGapDetected) {
      // Rules existed but user overrode — auto-reset after success
      successTimerRef.current = setTimeout(() => {
        setShowSuccess(false);
        resetWizard();
      }, 2500);
    }
    // If gap detected, success state shows gap prompt link — user must tap
  }

  function handleSuccessDone() {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    setShowSuccess(false);
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
    });
    await reloadRules();
    setRuleWizardVisible(false);
    resetWizard();
  }

  function handleBuildRuleFirst() {
    const suggestedCat = suggestCategory(session.emotionalTriggers);
    setRuleWizardCategory(suggestedCat);
    setRuleWizardVisible(true);
  }

  // ── "Talk it through" → seeds chat ────────────────────────────────────────

  function handleTalkItThrough() {
    const dtLabel =
      session.decisionType === 'buy'  ? 'buying'  :
      session.decisionType === 'sell' ? 'selling' : 'a decision about';
    const triggerList = session.emotionalTriggers
      .map((t) => TRIGGER_LABEL[t])
      .join(', ');
    const msg = `I'm considering ${dtLabel} ${session.assetName} (${session.ticker}). The triggers I identified were: ${triggerList || 'unclear'}. Help me think through this.`;

    router.push({
      pathname: '/(tabs)/chat',
      params:   { seed: msg },
    });
  }

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
        existingRule={ruleWizardCategory
          ? { category: ruleWizardCategory } as any
          : undefined
        }
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
          {session.currentStep > 1 ? (
            <TouchableOpacity onPress={goBack} style={s.backBtn} activeOpacity={0.6}>
              <Ionicons name="chevron-back" size={22} color={W} />
            </TouchableOpacity>
          ) : (
            <View style={s.backBtn} />
          )}
          <Text style={s.headerTitle}>Intercept</Text>
          {session.currentStep > 1 ? (
            <TouchableOpacity onPress={resetWizard} style={s.backBtn} activeOpacity={0.6}>
              <Ionicons name="close" size={20} color={G2} />
            </TouchableOpacity>
          ) : (
            <View style={s.backBtn} />
          )}
        </View>

        {/* Progress dots */}
        <View style={s.dots}>
          {([1, 2, 3, 4] as const).map((n) => (
            <View
              key={n}
              style={[s.dot, session.currentStep === n && s.dotActive,
                             session.currentStep > n  && s.dotDone]}
            />
          ))}
        </View>

        <Text style={s.headerSub}>
          {checkingRules ? 'Checking your playbook…' : STEP_SUBTITLES[session.currentStep]}
        </Text>
      </View>

      {/* ── Step content ── */}
      {session.currentStep === 1 && (
        <Step1
          decisionType={session.decisionType}
          tickerInfo={tickerInfo}
          vaultHolding={vaultHolding}
          livePrice={livePrice}
          liveCurrency={liveCurrency}
          priceLoading={priceLoading}
          onSelectDecision={selectDecisionType}
          onSelectTicker={handleTickerChange}
          onNext={advanceToStep2}
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
          checkingRules={checkingRules}
          vaultHolding={vaultHolding}
          livePrice={livePrice}
          liveCurrency={liveCurrency}
          onNext={advanceToStep4}
          onTalkItThrough={handleTalkItThrough}
          onProceedNow={advanceToStep4}
        />
      )}

      {session.currentStep === 4 && (
        <Step4
          session={session}
          livePrice={livePrice}
          liveCurrency={liveCurrency}
          logging={logging}
          onFollowPlaybook={handleFollowPlaybook}
          onOverride={handleOverride}
          onBuildRuleFirst={handleBuildRuleFirst}
          onProceedAnyway={handleProceedAnyway}
        />
      )}
    </SafeAreaView>
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
// STEP 3 — TRIAGE
// ═══════════════════════════════════════════════════════════════════════════════

interface Step3Props {
  session:        InterceptSession;
  checkingRules:  boolean;
  vaultHolding:   any | null;
  livePrice:      number | null;
  liveCurrency:   string;
  onNext:         () => void;
  onTalkItThrough:() => void;
  onProceedNow:   () => void;
}

function Step3({
  session, checkingRules, vaultHolding, livePrice, liveCurrency,
  onNext, onTalkItThrough, onProceedNow,
}: Step3Props) {
  const { rulesMatched, playbookGapDetected } = session;

  if (checkingRules) {
    return (
      <View style={[s.stepFlex, s.center]}>
        <ActivityIndicator size="large" color={GOLD} />
        <Text style={s.checkingText}>Scanning your playbook…</Text>
      </View>
    );
  }

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

        {/* Rules matched */}
        {!playbookGapDetected ? (
          <>
            <Text style={s.triageSummary}>
              Your playbook has{' '}
              <Text style={s.triageSummaryBold}>
                {rulesMatched.length} rule{rulesMatched.length !== 1 ? 's' : ''}
              </Text>
              {' '}for this moment.
            </Text>

            {rulesMatched.map((rule) => (
              <TriageRuleCard key={rule.id} rule={rule} />
            ))}
          </>
        ) : (
          /* No rules matched */
          <View style={s.noRulesCard}>
            <Ionicons name="alert-circle-outline" size={32} color={GOLD} />
            <Text style={s.noRulesTitle}>You don't have a rule for this yet.</Text>
            <Text style={s.noRulesBody}>
              Would you like to understand {session.assetName || session.ticker} better before you decide?
            </Text>
            <View style={s.noRulesActions}>
              <TouchableOpacity
                style={s.learnBtn}
                onPress={onTalkItThrough}
                activeOpacity={0.7}
              >
                <Text style={s.learnBtnText}>Talk it through</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.decideNowBtn}
                onPress={onProceedNow}
                activeOpacity={0.7}
              >
                <Text style={s.decideNowBtnText}>Decide now</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* "Talk it through" secondary link */}
        {!playbookGapDetected && (
          <TouchableOpacity style={s.talkLink} onPress={onTalkItThrough} activeOpacity={0.6}>
            <Text style={s.talkLinkText}>Talk it through with your Guide →</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity style={s.nextBtn} onPress={onNext} activeOpacity={0.8}>
          <Text style={s.nextBtnText}>See verdict</Text>
          <Ionicons name="arrow-forward" size={18} color={BG} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function TriageRuleCard({ rule }: { rule: PlaybookRule }) {
  const CATEGORY_SHORT: Record<string, string> = {
    'timing':               'Timing',
    'position-sizing':      'Position sizing',
    'emotional-discipline': 'Emotional discipline',
    'new-asset-class':      'New asset class',
    'life-events':          'Life events',
    'tax-awareness':        'Tax awareness',
    'portfolio-structure':  'Portfolio structure',
    'information-discipline': 'Information discipline',
    'monitoring':           'Monitoring',
  };
  return (
    <View style={s.ruleCard}>
      <View style={s.ruleCardAccent} />
      <View style={s.ruleCardBody}>
        <Text style={s.ruleCategoryTag}>{CATEGORY_SHORT[rule.category] ?? rule.category}</Text>
        <Text style={s.ruleTitle}>{rule.title}</Text>
        <Text style={s.ruleBody}>{rule.body}</Text>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 4 — VERDICT
// ═══════════════════════════════════════════════════════════════════════════════

interface Step4Props {
  session:          InterceptSession;
  livePrice:        number | null;
  liveCurrency:     string;
  logging:          boolean;
  onFollowPlaybook: () => void;
  onOverride:       () => void;
  onBuildRuleFirst: () => void;
  onProceedAnyway:  () => void;
}

function Step4({
  session, livePrice, liveCurrency, logging,
  onFollowPlaybook, onOverride, onBuildRuleFirst, onProceedAnyway,
}: Step4Props) {
  const { rulesMatched, playbookGapDetected, ticker, assetName, decisionType } = session;
  const hasRules = !playbookGapDetected && rulesMatched.length > 0;

  const verdictAction =
    decisionType === 'buy'  ? "Don't buy yet." :
    decisionType === 'sell' ? "Don't sell yet." :
                              "Don't act yet.";

  const dtLabel =
    decisionType === 'buy'  ? 'Buy'  :
    decisionType === 'sell' ? 'Sell' : 'Unsure';

  return (
    <ScrollView
      style={s.stepScroll}
      contentContainerStyle={[s.stepContent, { paddingBottom: 8 }]}
      showsVerticalScrollIndicator={false}
    >
      {hasRules ? (
        <>
          {/* Verdict hero card */}
          <View style={s.verdictCard}>
            <View style={s.verdictCardHeader}>
              <Ionicons name="shield-checkmark" size={22} color={GOLD} />
              <Text style={s.verdictCardHeaderText}>Follow your playbook</Text>
            </View>

            <View style={s.verdictMeta}>
              <View style={s.verdictMetaRow}>
                <Text style={s.verdictTicker}>{ticker}</Text>
                <View style={s.verdictDtBadge}>
                  <Text style={s.verdictDtBadgeText}>{dtLabel}</Text>
                </View>
              </View>
              <Text style={s.verdictAssetName}>{assetName}</Text>
              {livePrice && (
                <Text style={s.verdictPrice}>
                  {liveCurrency} {fmt(livePrice)}
                </Text>
              )}
            </View>

            <View style={s.verdictRuleSummary}>
              <Text style={s.verdictRuleCount}>
                {rulesMatched.length} rule{rulesMatched.length !== 1 ? 's' : ''} triggered
              </Text>
              <Text style={s.verdictRecommendation}>
                Your playbook says: <Text style={s.verdictRecommendationBold}>{verdictAction}</Text>
              </Text>
            </View>
          </View>

          {/* Action buttons */}
          <TouchableOpacity
            style={[s.followBtn, logging && s.followBtnOff]}
            onPress={onFollowPlaybook}
            disabled={logging}
            activeOpacity={0.8}
          >
            {logging
              ? <ActivityIndicator color={BG} />
              : <Text style={s.followBtnText}>Follow Playbook</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={s.overrideBtn}
            onPress={onOverride}
            disabled={logging}
            activeOpacity={0.7}
          >
            <Text style={s.overrideBtnText}>Override and proceed</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {/* No rules */}
          <View style={s.noRulesVerdictCard}>
            <Ionicons name="compass-outline" size={32} color={GOLD} style={{ marginBottom: 12 }} />
            <Text style={s.noRulesVerdictTitle}>You're in new territory.</Text>
            <Text style={s.noRulesVerdictBody}>
              Your playbook doesn't have a rule for this combination yet. You have two options.
            </Text>
          </View>

          <TouchableOpacity
            style={s.buildRuleBtn}
            onPress={onBuildRuleFirst}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={18} color={GOLD} />
            <Text style={s.buildRuleBtnText}>Build a rule first</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.overrideBtn, { marginTop: 0 }]}
            onPress={onProceedAnyway}
            disabled={logging}
            activeOpacity={0.7}
          >
            {logging
              ? <ActivityIndicator color={G1} />
              : <Text style={s.overrideBtnText}>Proceed anyway</Text>
            }
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
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
                    <Text style={s.rulePickLabel} numberOfLines={2}>{rule.title}</Text>
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
  centerTitle: { fontSize: 22, fontWeight: '700', color: W, fontFamily: SERIF, letterSpacing: -0.3, textAlign: 'center' },
  centerBody:  { fontSize: 15, color: G1, fontFamily: BODY, lineHeight: 22, textAlign: 'center' },
  centerBtn:   { marginTop: 8, backgroundColor: GOLD, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12 },
  centerBtnText: { color: BG, fontSize: 15, fontWeight: '700' },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
    gap: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn:    { width: 32, alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: W, fontFamily: SERIF, letterSpacing: -0.3 },
  headerSub:  { fontSize: 14, color: G1, fontFamily: BODY, textAlign: 'center', lineHeight: 20 },

  // Progress dots
  dots:      { flexDirection: 'row', justifyContent: 'center', gap: 7 },
  dot:       { width: 7, height: 7, borderRadius: 4, backgroundColor: S2 },
  dotActive: { backgroundColor: GOLD, width: 20 },
  dotDone:   { backgroundColor: G3 },

  // ── Shared step layout ────────────────────────────────────────────────────
  stepFlex:    { flex: 1 },
  stepScroll:  { flex: 1 },
  stepContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, gap: 16 },

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
  footer:      { paddingHorizontal: 20, paddingBottom: 24, paddingTop: 12 },
  nextBtn:     {
    flexDirection: 'row',
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextBtnOff:     { backgroundColor: S2 },
  nextBtnText:    { color: BG, fontSize: 16, fontWeight: '700', fontFamily: SERIF },
  nextBtnTextOff: { color: G2 },

  // ── Step 1: decision type cards ───────────────────────────────────────────
  decisionList: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    borderRadius: 14,
    overflow: 'hidden',
  },
  decisionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: S1,
    gap: 12,
  },
  decisionCardBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  decisionCardSel:  { backgroundColor: S2 },
  decisionAccent:   { width: 3, height: 36, borderRadius: 2, backgroundColor: 'transparent' },
  decisionAccentSel:{ backgroundColor: GOLD },
  decisionBody:     { flex: 1, gap: 3 },
  decisionLabel:    { fontSize: 17, fontWeight: '600', color: G1 },
  decisionLabelSel: { color: W },
  decisionSub:      { fontSize: 13, color: G2, fontFamily: BODY },

  // ── Ticker section ────────────────────────────────────────────────────────
  tickerSection: { gap: 8 },

  // ── Vault context strip ───────────────────────────────────────────────────
  vaultStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: S1,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GOLD + '44',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  vaultStripText: { flex: 1, fontSize: 13, color: G1, lineHeight: 19, fontFamily: BODY },
  vaultStripBold: { color: W, fontWeight: '600' },

  // ── Step 2: triggers ──────────────────────────────────────────────────────
  triggerList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
  },
  triggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    gap: 14,
  },
  triggerRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  triggerRowSel:  {},
  triggerDot:    {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: G2,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  triggerDotSel:  { borderColor: GOLD },
  triggerDotFill: { width: 9, height: 9, borderRadius: 5, backgroundColor: GOLD },
  triggerLabel:    { flex: 1, fontSize: 15, color: G1, lineHeight: 21, fontFamily: BODY },
  triggerLabelSel: { color: W },

  // ── Step 3: triage ────────────────────────────────────────────────────────
  checkingText:   { fontSize: 16, color: G1, fontFamily: BODY, marginTop: 16, textAlign: 'center' },

  triageSummary:      { fontSize: 14, color: G1, fontFamily: BODY, lineHeight: 20 },
  triageSummaryBold:  { color: W, fontWeight: '600' },

  ruleCard: {
    flexDirection: 'row',
    backgroundColor: S1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    overflow: 'hidden',
  },
  ruleCardAccent: { width: 3, backgroundColor: GOLD },
  ruleCardBody:   { flex: 1, padding: 14, gap: 5 },
  ruleCategoryTag:{ fontSize: 10, fontWeight: '700', color: GOLD, textTransform: 'uppercase', letterSpacing: 0.6 },
  ruleTitle:      { fontSize: 15, fontWeight: '600', color: W },
  ruleBody:       { fontSize: 13, color: G1, lineHeight: 19, fontFamily: BODY },

  noRulesCard: {
    backgroundColor: S1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  noRulesTitle:   { fontSize: 17, fontWeight: '600', color: W, textAlign: 'center' },
  noRulesBody:    { fontSize: 14, color: G1, fontFamily: BODY, lineHeight: 21, textAlign: 'center' },
  noRulesActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  learnBtn:       {
    flex: 1, backgroundColor: GOLD, borderRadius: 10,
    paddingVertical: 13, alignItems: 'center',
  },
  learnBtnText:     { color: BG, fontSize: 14, fontWeight: '700' },
  decideNowBtn:     {
    flex: 1, borderWidth: StyleSheet.hairlineWidth, borderColor: LINE,
    borderRadius: 10, paddingVertical: 13, alignItems: 'center',
  },
  decideNowBtnText: { color: G1, fontSize: 14 },

  talkLink:     { alignSelf: 'center', paddingVertical: 6 },
  talkLinkText: { fontSize: 13, color: G2, textDecorationLine: 'underline', fontFamily: BODY },

  // ── Step 4: verdict ───────────────────────────────────────────────────────
  verdictCard: {
    backgroundColor: S1,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GOLD + '55',
    overflow: 'hidden',
  },
  verdictCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: S2,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  verdictCardHeaderText: { fontSize: 14, fontWeight: '700', color: GOLD, letterSpacing: 0.3 },
  verdictMeta:    { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 4, gap: 4 },
  verdictMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  verdictTicker:  { fontSize: 22, fontWeight: '700', color: W, fontFamily: SERIF },
  verdictDtBadge: {
    backgroundColor: S2, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  verdictDtBadgeText: { fontSize: 12, fontWeight: '600', color: G1 },
  verdictAssetName:   { fontSize: 14, color: G1, fontFamily: BODY },
  verdictPrice:       { fontSize: 13, color: G2 },

  verdictRuleSummary: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 6,
  },
  verdictRuleCount:          { fontSize: 12, color: G2 },
  verdictRecommendation:     { fontSize: 16, color: G1, fontFamily: BODY, lineHeight: 22 },
  verdictRecommendationBold: { color: W, fontWeight: '700' },

  followBtn: {
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 16,
  },
  followBtnOff:  { opacity: 0.5 },
  followBtnText: { color: BG, fontSize: 16, fontWeight: '700', fontFamily: SERIF },

  overrideBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  overrideBtnText: { color: G1, fontSize: 15 },

  noRulesVerdictCard: {
    backgroundColor: S1,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  noRulesVerdictTitle: { fontSize: 19, fontWeight: '700', color: W, fontFamily: SERIF, textAlign: 'center' },
  noRulesVerdictBody:  { fontSize: 14, color: G1, fontFamily: BODY, lineHeight: 21, textAlign: 'center' },

  buildRuleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: S1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GOLD + '88',
    borderRadius: 14,
    paddingVertical: 17,
    marginTop: 16,
  },
  buildRuleBtnText: { color: GOLD, fontSize: 15, fontWeight: '600' },

  // ── Conscious Proceed sheet ───────────────────────────────────────────────
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: S1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 44,
    paddingTop: 16,
    maxHeight: '90%',
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: G3,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle:   { fontSize: 20, fontWeight: '700', color: W, fontFamily: SERIF, letterSpacing: -0.3 },
  sheetSub:     { fontSize: 13, color: G1, fontFamily: BODY, lineHeight: 19, marginBottom: 8 },
  sheetSection: { gap: 8, marginTop: 12 },
  sheetSectionLabel: {
    fontSize: 11, fontWeight: '600', color: G2,
    textTransform: 'uppercase', letterSpacing: 0.7,
  },

  rulePickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  rulePickRowSel: {},
  rulePickLabel:  { flex: 1, fontSize: 14, color: G1, fontFamily: BODY, lineHeight: 19 },
  miniRadio: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 1.5, borderColor: G2,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  miniRadioSel: { borderColor: GOLD },
  miniRadioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: GOLD },

  reasonInput: {
    backgroundColor: S2,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
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
    borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: LINE,
    backgroundColor: S2,
  },
  tradeOptionSel:    { borderColor: GOLD, backgroundColor: S1 },
  tradeOptionText:   { fontSize: 14, color: G1 },
  tradeOptionTextSel:{ color: GOLD, fontWeight: '600' },

  confirmBtn: {
    backgroundColor: GOLD,
    borderRadius: 13,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  confirmBtnOff:     { backgroundColor: S2 },
  confirmBtnText:    { color: BG, fontSize: 15, fontWeight: '700', fontFamily: SERIF },
  confirmBtnTextOff: { color: G2 },

  // ── Success overlay ───────────────────────────────────────────────────────
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13,31,27,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    paddingHorizontal: 32,
  },
  successCard: {
    backgroundColor: S1,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    width: '100%',
  },
  successIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: GOLD,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  successTitle:      { fontSize: 22, fontWeight: '700', color: W, fontFamily: SERIF, letterSpacing: -0.3 },
  successBody:       { fontSize: 14, color: G1, fontFamily: BODY, textAlign: 'center' },
  successGapNote:    { backgroundColor: S2, borderRadius: 10, padding: 12, width: '100%' },
  successGapText:    { fontSize: 13, color: GOLD, fontFamily: BODY, textAlign: 'center', lineHeight: 18 },
  successViewBtn:    {
    marginTop: 8, backgroundColor: S2,
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24,
    width: '100%', alignItems: 'center',
  },
  successViewBtnText:{ color: W, fontSize: 14, fontWeight: '600' },
  successDoneBtn:    { paddingVertical: 8 },
  successDoneBtnText:{ color: GOLD, fontSize: 14, fontWeight: '600' },
});
