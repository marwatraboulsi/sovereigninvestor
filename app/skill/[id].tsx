import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { useRef, useEffect, useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useSkillSession } from '@/hooks/useSkillSession';
import { useSpeechInput } from '@/hooks/useSpeechInput';
import { useVaultData, formatPortfolioForReview } from '@/hooks/useVaultData';
import { useSlideGeneration } from '@/hooks/useSlideGeneration';
import { useConvictions } from '@/hooks/useConvictions';
import { saveAnalysisToArchive } from '@/hooks/useAnalysisArchive';
import { SKILL_METADATA } from '@/skills';
import { MessageBubble } from '@/components/MessageBubble';
import { SkillOptionPicker } from '@/components/SkillOptionPicker';
import { SkillProgress } from '@/components/SkillProgress';
import { TickerSearch } from '@/components/TickerSearch';
import { ScrollThumb } from '@/components/ScrollThumb';
import { parseSkillMessage } from '@/utils/parseSkillOptions';
import { detectThemeFromText, CONVICTION_THEME_LABEL } from '@/utils/convictionUtils';
import type { TickerInfo } from '@/data/tickerSearch';
import type { SkillId, ConvictionTheme, ConvictionBelief } from '@/types';

import { BG, S1, LINE, W, GOLD, G1, G2, R_SM, SERIF_SEMI } from '@/theme';

const VALID_SKILL_IDS: SkillId[] = [
  'etf-analyzer',
  'portfolio-reviewer',
  'market-catalyst-scanner',
  'stock-researcher',
];

function isValidSkillId(id: string): id is SkillId {
  return VALID_SKILL_IDS.includes(id as SkillId);
}

// ─── Small reusable form pieces ───────────────────────────────────────────────

function QuestionSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={qStyles.section}>
      <Text style={qStyles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function PillGroup({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={qStyles.pillRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[qStyles.pill, value === opt && qStyles.pillSelected]}
          onPress={() => onChange(opt)}
          activeOpacity={0.7}
        >
          <Text style={[qStyles.pillText, value === opt && qStyles.pillTextSelected]}>
            {opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function MultiPillGroup({
  options,
  values,
  onChange,
  max,
}: {
  options: string[];
  values: string[];
  onChange: (v: string[]) => void;
  max: number;
}) {
  const toggle = (opt: string) => {
    if (values.includes(opt)) {
      onChange(values.filter((v) => v !== opt));
    } else if (values.length < max) {
      onChange([...values, opt]);
    }
  };
  return (
    <View style={qStyles.pillRow}>
      {options.map((opt) => {
        const selected = values.includes(opt);
        const disabled = !selected && values.length >= max;
        return (
          <TouchableOpacity
            key={opt}
            style={[qStyles.pill, selected && qStyles.pillSelected, disabled && qStyles.pillDisabled]}
            onPress={() => toggle(opt)}
            activeOpacity={0.7}
            disabled={disabled}
          >
            <Text style={[qStyles.pillText, selected && qStyles.pillTextSelected, disabled && qStyles.pillTextDisabled]}>
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Compare picker form ──────────────────────────────────────────────────────
// Shown after ticker selection. User chooses whether to run a comparison session.

function ComparePickerForm({
  ticker,
  compareTicker,
  onCompareTicker,
  onBack,
  onNext,
}: {
  ticker: TickerInfo;
  compareTicker: TickerInfo | null;
  onCompareTicker: (t: TickerInfo | null) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [mode, setMode] = useState<'solo' | 'compare' | null>(null);

  const canProceed = mode === 'solo' || (mode === 'compare' && !!compareTicker);

  const handleNext = () => {
    if (mode === 'solo') onCompareTicker(null);
    onNext();
  };

  return (
    <View style={qStyles.container}>
      <TouchableOpacity onPress={onBack} style={qStyles.backBtn} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={14} color={G2} />
        <Text style={qStyles.backBtnText}>Change ticker</Text>
      </TouchableOpacity>

      <Text style={qStyles.tickerLabel}>{ticker.ticker} · {ticker.name}</Text>

      <QuestionSection label="Session type">
        <View style={qStyles.pillRow}>
          <TouchableOpacity
            style={[qStyles.pill, mode === 'solo' && qStyles.pillSelected]}
            onPress={() => { setMode('solo'); onCompareTicker(null); }}
            activeOpacity={0.7}
          >
            <Text style={[qStyles.pillText, mode === 'solo' && qStyles.pillTextSelected]}>
              Deep dive on {ticker.ticker}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[qStyles.pill, mode === 'compare' && qStyles.pillSelected]}
            onPress={() => setMode('compare')}
            activeOpacity={0.7}
          >
            <Text style={[qStyles.pillText, mode === 'compare' && qStyles.pillTextSelected]}>
              Compare against another stock
            </Text>
          </TouchableOpacity>
        </View>
      </QuestionSection>

      {mode === 'compare' && (
        <View style={{ marginTop: 16, gap: 8 }}>
          <Text style={qStyles.sectionLabel}>Compare against</Text>
          <TickerSearch
            value={compareTicker}
            onChange={onCompareTicker}
            placeholder="Search second ticker..."
          />
        </View>
      )}

      <TouchableOpacity
        style={[qStyles.submitBtn, !canProceed && qStyles.submitBtnDisabled]}
        onPress={handleNext}
        disabled={!canProceed}
        activeOpacity={0.8}
      >
        <Text style={qStyles.submitBtnText}>Next</Text>
        <Ionicons name="arrow-forward" size={16} color={BG} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Research questions form ──────────────────────────────────────────────────

function ResearchQuestionsForm({
  ticker,
  compareTicker,
  onBack,
  onSubmit,
}: {
  ticker: TickerInfo;
  compareTicker?: TickerInfo | null;
  onBack: () => void;
  onSubmit: (answers: string) => void;
}) {
  const [investmentStyle, setInvestmentStyle] = useState('');
  const [holdingPeriod,   setHoldingPeriod]   = useState('');
  const [riskTolerance,   setRiskTolerance]   = useState('');
  const [focusAreas,      setFocusAreas]      = useState<string[]>([]);
  const [researchDepth,   setResearchDepth]   = useState('');
  const [concerns,        setConcerns]        = useState('');

  const isValid =
    !!investmentStyle &&
    !!holdingPeriod &&
    !!riskTolerance &&
    focusAreas.length >= 1 &&
    !!researchDepth;

  const handleSubmit = () => {
    if (!isValid) return;
    const answers = [
      `Investment style: ${investmentStyle}`,
      `Holding period: ${holdingPeriod}`,
      `Risk tolerance: ${riskTolerance}`,
      `Focus areas: ${focusAreas.join(', ')}`,
      `Research depth: ${researchDepth}`,
      `Specific concerns: ${concerns.trim() || 'None'}`,
    ].join('\n');
    onSubmit(answers);
  };

  return (
    <View style={qStyles.container}>
      <TouchableOpacity onPress={onBack} style={qStyles.backBtn} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={14} color={G2} />
        <Text style={qStyles.backBtnText}>Back</Text>
      </TouchableOpacity>

      <Text style={qStyles.tickerLabel}>
        {compareTicker
          ? `${ticker.ticker} vs ${compareTicker.ticker}`
          : `${ticker.ticker} · ${ticker.name}`}
      </Text>

      <QuestionSection label="Investment Style">
        <PillGroup
          options={['Value', 'Growth', 'Turnaround', 'Dividend']}
          value={investmentStyle}
          onChange={setInvestmentStyle}
        />
      </QuestionSection>

      <QuestionSection label="Holding Period">
        <PillGroup
          options={['Short-term (<6 months)', 'Medium-term (6–18 months)', 'Long-term (1–3+ years)']}
          value={holdingPeriod}
          onChange={setHoldingPeriod}
        />
      </QuestionSection>

      <QuestionSection label="Risk Tolerance">
        <PillGroup
          options={['Conservative', 'Balanced', 'Aggressive']}
          value={riskTolerance}
          onChange={setRiskTolerance}
        />
      </QuestionSection>

      <QuestionSection label="Focus Areas (pick up to 3)">
        <MultiPillGroup
          options={['Business quality', 'Financial health', 'Industry dynamics', 'Governance', 'Valuation', 'Catalysts']}
          values={focusAreas}
          onChange={setFocusAreas}
          max={3}
        />
      </QuestionSection>

      <QuestionSection label="Research Depth">
        <PillGroup
          options={['Quick scan', 'Standard due diligence']}
          value={researchDepth}
          onChange={setResearchDepth}
        />
      </QuestionSection>

      <QuestionSection label="Specific Concerns (optional)">
        <TextInput
          style={qStyles.concernsInput}
          value={concerns}
          onChangeText={setConcerns}
          placeholder="Any red flags or specific areas to focus on?"
          placeholderTextColor={G2}
          multiline
          maxLength={300}
        />
      </QuestionSection>

      <TouchableOpacity
        style={[qStyles.submitBtn, !isValid && qStyles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={!isValid}
        activeOpacity={0.8}
      >
        <Text style={qStyles.submitBtnText}>Start Research</Text>
        <Ionicons name="arrow-forward" size={16} color={BG} />
      </TouchableOpacity>
    </View>
  );
}

const qStyles = StyleSheet.create({
  container: { width: '100%', paddingTop: 8, gap: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, alignSelf: 'flex-start' },
  backBtnText: { color: G2, fontSize: 13 },
  tickerLabel: { color: W, fontSize: 16, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  section: { gap: 8, marginTop: 16 },
  sectionLabel: { color: G2, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    backgroundColor: S1,
  },
  pillSelected: { backgroundColor: GOLD, borderColor: GOLD },
  pillDisabled: { opacity: 0.35 },
  pillText: { color: G1, fontSize: 13, fontWeight: '500' },
  pillTextSelected: { color: BG, fontWeight: '700' },
  pillTextDisabled: { color: G2 },
  concernsInput: {
    backgroundColor: S1,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    color: W,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 60,
    maxHeight: 100,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: GOLD,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 24,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: BG, fontSize: 15, fontWeight: '700' },
});




// ─── Outer component ──────────────────────────────────────────────────────────
export default function SkillScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id || !isValidSkillId(id)) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Unknown skill.</Text>
      </View>
    );
  }

  return <SkillScreenInner id={id} />;
}

// ─── Inner component ──────────────────────────────────────────────────────────
function SkillScreenInner({ id }: { id: SkillId }) {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [input, setInput] = useState('');
  const [selectedTicker, setSelectedTicker] = useState<TickerInfo | null>(null);
  const [compareTicker, setCompareTicker] = useState<TickerInfo | null>(null);
  const [screenPhase, setScreenPhase] = useState<'ticker' | 'compare' | 'questions'>('ticker');

  // ── Progress tracking ──────────────────────────────────────────────────────
  const [elapsedMs, setElapsedMs]   = useState(0);
  const elapsedIntervalRef          = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Scroll-to-bottom button + drag scrollbar ──────────────────────────────
  const [isAtBottom,     setIsAtBottom]     = useState(true);
  const [scrollY,        setScrollY]        = useState(0);
  const [contentHeight,  setContentHeight]  = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const skill     = SKILL_METADATA[id];
  const vaultData = useVaultData();
  const { messages, streamingText, isLoading, error, startedAt, phaseLabel, sendMessage, initResearch, clearSession, dismissError } =
    useSkillSession(id);
  const { isListening, isAvailable: micAvailable, toggle: toggleMic } = useSpeechInput({
    onResult: (text) => setInput((prev) => (prev ? prev + ' ' + text : text)),
  });
  const { isGenerating, generate: generateSlides } = useSlideGeneration();
  const { convictions, setConviction } = useConvictions();
  const [slideSaved,          setSlideSaved]          = useState(false);
  const [slideError,          setSlideError]          = useState<string | null>(null);
  const [showToast,           setShowToast]           = useState(false);
  const [convictionResponded, setConvictionResponded] = useState(false);
  const toastTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasLoading       = useRef(false);
  const autoSaveTriggered = useRef(false);

  // Reset ticker/questions phase when session is cleared
  useEffect(() => {
    if (messages.length === 0) {
      setScreenPhase('ticker');
      setSelectedTicker(null);
      setCompareTicker(null);
    }
  }, [messages.length]);

  useEffect(() => {
    if (isAtBottom) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length, isLoading, streamingText, isAtBottom]);

  // Reset auto-save flag only when the session is cleared
  useEffect(() => {
    if (messages.length === 0) {
      autoSaveTriggered.current = false;
      setSlideSaved(false);
      setSlideError(null);
    }
  }, [messages.length]);

  // Show toast only when the initial analysis starts (not follow-up questions)
  useEffect(() => {
    if (isLoading && !wasLoading.current && !autoSaveTriggered.current) {
      setShowToast(true);
      toastTimer.current = setTimeout(() => setShowToast(false), 7500);
    }
    wasLoading.current = isLoading;
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [isLoading]);

  // Auto-save slides for all skills when analysis completes
  useEffect(() => {
    if (isLoading) return;
    if (autoSaveTriggered.current) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant' || last.content.length < 400) return;
    autoSaveTriggered.current = true;
    (async () => {
      const result = await generateSlides(last.content, id);
      if (result) {
        await saveAnalysisToArchive({
          skillId: id,
          skillName: skill.name,
          title: result.title,
          slides: result.slides,
        });
        setSlideSaved(true);
      } else {
        setSlideError('Could not auto-save slides.');
      }
    })();
  }, [isLoading, messages]);

  // ── Elapsed time tracking ──────────────────────────────────────────────────
  useEffect(() => {
    if (isLoading && startedAt !== null) {
      setElapsedMs(Date.now() - startedAt);
      elapsedIntervalRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startedAt);
      }, 500);
    } else {
      if (elapsedIntervalRef.current) {
        clearInterval(elapsedIntervalRef.current);
        elapsedIntervalRef.current = null;
      }
    }
    return () => {
      if (elapsedIntervalRef.current) {
        clearInterval(elapsedIntervalRef.current);
        elapsedIntervalRef.current = null;
      }
    };
  }, [isLoading, startedAt]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    sendMessage(text);
  };

  const lastMessage = messages[messages.length - 1];
  const lastParsed =
    lastMessage?.role === 'assistant' && !isLoading
      ? parseSkillMessage(lastMessage.content)
      : null;
  const hasOptions = (lastParsed?.questions.length ?? 0) > 0;

  const handleScroll = useCallback((event: any) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    setIsAtBottom(distanceFromBottom < 40);
    setScrollY(contentOffset.y);
    setContentHeight(contentSize.height);
    setViewportHeight(layoutMeasurement.height);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      {showToast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>
            This will take a little while. Feel free to leave this page and come back. Your analysis will be here when you return.
          </Text>
        </View>
      )}
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom header — avoids native iOS button-group pill */}
      <View style={styles.customHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={W} />
        </TouchableOpacity>
        <Text style={styles.customHeaderTitle} numberOfLines={1}>{skill.name}</Text>
        <View style={styles.customHeaderActions}>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/research-history', params: { skillId: id } })}
            activeOpacity={0.6}
            style={styles.headerIconBtn}
          >
            <Ionicons name="time-outline" size={18} color={G2} />
          </TouchableOpacity>
          <TouchableOpacity onPress={clearSession} activeOpacity={0.6} style={styles.headerNewBtn}>
            <Text style={styles.headerNewBtnText}>New</Text>
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={54}
      >
        <View style={styles.flex}>
          <ScrollView
            ref={scrollRef}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {messages.length === 0 && !isLoading && (
              <View style={styles.emptyState}>
                {id === 'stock-researcher' ? (
                  screenPhase === 'ticker' ? (
                    <>
                      <Text style={styles.emptyPrompt}>{skill.placeholder}</Text>
                      <Text style={styles.emptyFramework}>{skill.framework}</Text>
                      <View style={styles.tickerSearchWrapper}>
                        <TickerSearch
                          value={selectedTicker}
                          onChange={setSelectedTicker}
                          placeholder="Search ticker or company name..."
                        />
                        {selectedTicker && (
                          <TouchableOpacity
                            style={styles.startResearchBtn}
                            onPress={() => setScreenPhase('compare')}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.startResearchBtnText}>Next</Text>
                            <Ionicons name="arrow-forward" size={16} color={BG} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <TouchableOpacity
                        style={styles.historyLink}
                        onPress={() => router.push({ pathname: '/research-history', params: { skillId: id } })}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="time-outline" size={14} color={G2} />
                        <Text style={styles.historyLinkText}>View past sessions</Text>
                      </TouchableOpacity>
                    </>
                  ) : screenPhase === 'compare' ? (
                    <ComparePickerForm
                      ticker={selectedTicker!}
                      compareTicker={compareTicker}
                      onCompareTicker={setCompareTicker}
                      onBack={() => setScreenPhase('ticker')}
                      onNext={() => setScreenPhase('questions')}
                    />
                  ) : (
                    <ResearchQuestionsForm
                      ticker={selectedTicker!}
                      compareTicker={compareTicker}
                      onBack={() => setScreenPhase('compare')}
                      onSubmit={(answers) => {
                        initResearch(selectedTicker!, compareTicker ?? undefined);
                        sendMessage(answers);
                      }}
                    />
                  )
                ) : (
                  <>
                    <Text style={styles.emptyPrompt}>{skill.placeholder}</Text>
                    <Text style={styles.emptyFramework}>{skill.framework}</Text>
                    {id === 'portfolio-reviewer' && vaultData && vaultData.holdings.length > 0 && (
                      <TouchableOpacity
                        style={styles.vaultBtn}
                        onPress={() => {
                          const text = formatPortfolioForReview(vaultData);
                          if (text) sendMessage(text);
                        }}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="wallet-outline" size={16} color={BG} />
                        <Text style={styles.vaultBtnText}>Analyse my Vault portfolio</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.historyLink}
                      onPress={() => router.push({ pathname: '/research-history', params: { skillId: id } })}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="time-outline" size={14} color={G2} />
                      <Text style={styles.historyLinkText}>View past sessions</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {messages.map((msg, i) => {
              const isLast = i === messages.length - 1;
              const parsed = msg.role === 'assistant' ? parseSkillMessage(msg.content) : null;
              const displayContent = parsed ? parsed.displayText : msg.content;

              return (
                <View key={i}>
                  <MessageBubble role={msg.role} content={displayContent} />
                  {isLast && parsed && parsed.questions.length > 0 && !isLoading && (
                    <SkillOptionPicker
                      questions={parsed.questions}
                      onSubmit={(answer) => sendMessage(answer)}
                      disabled={isLoading}
                    />
                  )}
                </View>
              );
            })}

            {/* Live streaming text + progress bar */}
            {isLoading && streamingText ? (
              <>
                <MessageBubble role="assistant" content={streamingText} />
                <SkillProgress
                  skillId={id}
                  streamingText={streamingText}
                  elapsedMs={elapsedMs}
                  phaseLabel={phaseLabel}
                />
              </>
            ) : isLoading ? (
              <SkillProgress
                skillId={id}
                streamingText={streamingText}
                elapsedMs={elapsedMs}
                phaseLabel={phaseLabel}
              />
            ) : null}

            {/* Auto-save status — shown for all skills after analysis completes */}
            {(() => {
              const last = messages[messages.length - 1];
              if (!last || last.role !== 'assistant' || isLoading || last.content.length < 400) return null;
              if (slideSaved) {
                return (
                  <View style={styles.slidesSavedBanner}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text style={styles.slidesSavedText}>Saved to Archive</Text>
                  </View>
                );
              }
              if (isGenerating || slideError) {
                return (
                  <View style={styles.slidesSavedBanner}>
                    {isGenerating
                      ? <ActivityIndicator size="small" color={G2} />
                      : <Ionicons name="alert-circle-outline" size={16} color="#F87171" />}
                    <Text style={[styles.slidesSavedText, slideError ? { color: '#F87171' } : { color: G2 }]}>
                      {isGenerating ? 'Saving to Archive…' : slideError}
                    </Text>
                  </View>
                );
              }
              return null;
            })()}

            {/* Conviction prompt — Catalyst Scanner only, once per session */}
            {(() => {
              if (id !== 'market-catalyst-scanner') return null;
              if (convictionResponded) return null;
              const last = messages[messages.length - 1];
              if (!last || last.role !== 'assistant' || isLoading || last.content.length < 200) return null;
              const detectedTheme: ConvictionTheme | null = detectThemeFromText(last.content);
              if (!detectedTheme) return null;
              if (convictions.some((c) => c.theme === detectedTheme)) return null;

              const themeLabel = CONVICTION_THEME_LABEL[detectedTheme];

              const respond = async (belief: ConvictionBelief) => {
                setConvictionResponded(true);
                const confidence = belief === 'no' ? 'low' : 'medium';
                await setConviction(detectedTheme, belief, confidence, undefined, 'catalyst-scanner');
              };

              return (
                <View style={styles.convictionPromptCard}>
                  <View style={styles.convictionPromptHeader}>
                    <Ionicons name="bulb-outline" size={14} color={GOLD} />
                    <Text style={styles.convictionPromptLabel}>Based on what you've read</Text>
                  </View>
                  <Text style={styles.convictionPromptQuestion}>
                    Do you believe in <Text style={styles.convictionPromptTheme}>{themeLabel}</Text>?
                  </Text>
                  <View style={styles.convictionPromptButtons}>
                    {(['yes', 'still-forming', 'no'] as ConvictionBelief[]).map((b) => (
                      <TouchableOpacity
                        key={b}
                        style={styles.convictionPromptBtn}
                        onPress={() => respond(b)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.convictionPromptBtnText}>
                          {b === 'yes' ? 'Yes' : b === 'no' ? 'No' : 'Still forming'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })()}

            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{error}</Text>
                <TouchableOpacity onPress={dismissError}>
                  <Text style={styles.errorDismiss}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* Drag scrollbar */}
          {messages.length > 0 && (
            <ScrollThumb
              scrollRef={scrollRef}
              contentHeight={contentHeight}
              viewportHeight={viewportHeight}
              scrollY={scrollY}
            />
          )}

          {/* Scroll-to-bottom button */}
          {!isAtBottom && messages.length > 0 && (
            <TouchableOpacity
              style={styles.scrollToBottomBtn}
              onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
              activeOpacity={0.8}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M6 9l6 6 6-6"
                  stroke={BG}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </TouchableOpacity>
          )}
        </View>

        {/* Hide input on stock researcher empty state (form handles input) and when option picker is active */}
        {!hasOptions && !(id === 'stock-researcher' && messages.length === 0) && (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder={
                id === 'portfolio-reviewer'      ? 'Describe your portfolio...' :
                id === 'market-catalyst-scanner' ? 'Ask about a market event...' :
                id === 'etf-analyzer'            ? 'Name an ETF to analyze...' :
                id === 'stock-researcher'        ? 'Name a stock or company...' :
                ''
              }
              placeholderTextColor={G2}
              multiline
              maxLength={2000}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={[styles.iconButton, isListening && styles.iconButtonActive]}
              onPress={micAvailable ? toggleMic : undefined}
              disabled={isLoading}
            >
              <Ionicons
                name={isListening ? 'mic' : 'mic-outline'}
                size={20}
                color={isListening ? W : isLoading ? G2 : G1}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendButton, (!input.trim() || isLoading) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={G2} />
              ) : (
                <Ionicons name="arrow-up" size={18} color={input.trim() ? BG : G2} />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG },
  errorText: { color: '#F87171', fontSize: 16 },

  messageList: { flex: 1 },
  messageListContent: { padding: 16, paddingBottom: 8, gap: 12 },

  emptyState: { paddingTop: 40, alignItems: 'center', gap: 10 },
  tickerSearchWrapper: { width: '100%', marginTop: 16, gap: 12 },
  startResearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: GOLD,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 24,
  },
  startResearchBtnText: { color: BG, fontSize: 15, fontWeight: '700' },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    alignSelf: 'center',
    paddingVertical: 6,
  },
  historyLinkText: { color: G2, fontSize: 13 },
  vaultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    backgroundColor: GOLD,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  vaultBtnText: { color: BG, fontSize: 14, fontWeight: '600' },
  emptyFramework: {
    fontSize: 11,
    color: G2,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  emptyPrompt: {
    fontSize: 14,
    color: G2,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
  },

  errorBanner: {
    backgroundColor: '#1A0A0A',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#3D1515',
  },
  errorBannerText: { color: '#FCA5A5', fontSize: 13, flex: 1 },
  errorDismiss: { color: '#F87171', fontSize: 13, fontWeight: '600', marginLeft: 12 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
    gap: 8,
    backgroundColor: BG,
  },
  input: {
    flex: 1,
    backgroundColor: S1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: W,
    fontSize: 15,
    maxHeight: 120,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: S1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  iconButtonActive: { backgroundColor: '#1A1A1A', borderColor: W },
  sendButton: {
    backgroundColor: GOLD,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: S1, borderWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: BG,
  },
  backBtn:             { padding: 8 },
  customHeaderTitle:   { flex: 1, color: W, fontSize: 17, fontFamily: SERIF_SEMI, textAlign: 'center' },
  customHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBtn:       { padding: 4 },
  headerNewBtn:        { paddingHorizontal: 8, paddingVertical: 4 },
  headerNewBtnText:    { color: G2, fontSize: 13, letterSpacing: 0.3 },

  toast: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    zIndex: 100,
    backgroundColor: S1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GOLD,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toastText: { color: G1, fontSize: 13, lineHeight: 19 },

  slidesSavedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  slidesSavedText: { color: '#10B981', fontSize: 13, fontWeight: '500' },

  // ── Conviction prompt (Catalyst Scanner) ──────────────────────────────────
  convictionPromptCard: {
    backgroundColor: GOLD + '12',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GOLD + '44',
    padding: 16,
    gap: 10,
    marginTop: 4,
  },
  convictionPromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  convictionPromptLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: GOLD,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  convictionPromptQuestion: {
    fontSize: 15,
    color: '#CBD5E1',
    lineHeight: 22,
  },
  convictionPromptTheme: {
    color: '#F1F5F9',
    fontWeight: '600',
  },
  convictionPromptButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  convictionPromptBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: S1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: 'center',
  },
  convictionPromptBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#CBD5E1',
  },

  // ── Scroll-to-bottom button ───────────────────────────────────────────────
  scrollToBottomBtn: {
    position: 'absolute',
    bottom: 70,
    right: 16,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
});
