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
import { useLocalSearchParams, Stack } from 'expo-router';
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
import { parseSkillMessage } from '@/utils/parseSkillOptions';
import { detectThemeFromText, CONVICTION_THEME_LABEL } from '@/utils/convictionUtils';
import type { SkillId, ConvictionTheme, ConvictionBelief } from '@/types';

import { BG, S1, LINE, W, GOLD, G1, G2 } from '@/theme';

const VALID_SKILL_IDS: SkillId[] = [
  'etf-analyzer',
  'portfolio-reviewer',
  'market-catalyst-scanner',
  'stock-researcher',
];

function isValidSkillId(id: string): id is SkillId {
  return VALID_SKILL_IDS.includes(id as SkillId);
}

// ─── Outer component ──────────────────────────────────────────────────────────
// Validates the route param BEFORE any hooks are called.
// React requires hooks to be called the same number of times on every render,
// so we must never call hooks before a conditional return.
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
// Only rendered when `id` is a valid SkillId. All hooks live here so they are
// called unconditionally on every render of this component.
function SkillScreenInner({ id }: { id: SkillId }) {
  const scrollRef = useRef<ScrollView>(null);
  const [input, setInput] = useState('');

  // ── Progress tracking ──────────────────────────────────────────────────────
  const [elapsedMs, setElapsedMs]   = useState(0);
  const startTimeRef                = useRef<number | null>(null);
  const elapsedIntervalRef          = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Scroll-to-bottom button ────────────────────────────────────────────────
  const [isAtBottom, setIsAtBottom] = useState(true);

  const skill     = SKILL_METADATA[id];
  const vaultData = useVaultData();
  const { messages, streamingText, isLoading, error, sendMessage, clearSession, dismissError } =
    useSkillSession(id);
  const { isListening, isAvailable: micAvailable, toggle: toggleMic } = useSpeechInput({
    onResult: (text) => setInput((prev) => (prev ? prev + ' ' + text : text)),
  });
  const { isGenerating, generate: generateSlides } = useSlideGeneration();
  const { convictions, setConviction } = useConvictions();
  const [slideSaved,          setSlideSaved]          = useState(false);
  const [slideError,          setSlideError]          = useState<string | null>(null);
  const [showToast,           setShowToast]           = useState(false);
  // Conviction prompt — fires once per session for the first detected theme
  const [convictionResponded, setConvictionResponded] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasLoading = useRef(false);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length, isLoading, streamingText]);

  // Show toast when loading starts (not when restoring a completed session)
  useEffect(() => {
    if (isLoading && !wasLoading.current) {
      setShowToast(true);
      toastTimer.current = setTimeout(() => setShowToast(false), 7500);
    }
    wasLoading.current = isLoading;
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [isLoading]);

  // ── Elapsed time tracking ──────────────────────────────────────────────────
  useEffect(() => {
    if (isLoading) {
      startTimeRef.current = Date.now();
      setElapsedMs(0);
      elapsedIntervalRef.current = setInterval(() => {
        if (startTimeRef.current !== null) {
          setElapsedMs(Date.now() - startTimeRef.current);
        }
      }, 500);
    } else {
      // Loading complete — stop tracking
      if (elapsedIntervalRef.current) {
        clearInterval(elapsedIntervalRef.current);
        elapsedIntervalRef.current = null;
      }
      startTimeRef.current = null;
    }
    return () => {
      if (elapsedIntervalRef.current) {
        clearInterval(elapsedIntervalRef.current);
        elapsedIntervalRef.current = null;
      }
    };
  }, [isLoading]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    sendMessage(text);
  };

  // Check if the last assistant message contains option pickers
  const lastMessage = messages[messages.length - 1];
  const lastParsed =
    lastMessage?.role === 'assistant' && !isLoading
      ? parseSkillMessage(lastMessage.content)
      : null;
  const hasOptions = (lastParsed?.questions.length ?? 0) > 0;

  // ── Scroll event handler for scroll-to-bottom button ──────────────────────
  const handleScroll = useCallback((event: any) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    setIsAtBottom(distanceFromBottom < 40);
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
      <Stack.Screen
        options={{
          title: skill.name,
          headerStyle: { backgroundColor: BG },
          headerTintColor: W,
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity onPress={clearSession} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>New</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
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

            {/* Progress indicator replaces raw streaming text */}
            {isLoading && (
              <SkillProgress
                skillId={id}
                streamingText={streamingText}
                elapsedMs={elapsedMs}
              />
            )}

            {/* Save as Slides - appears after a long completed analysis */}
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
              return (
                <View style={styles.saveSlideRow}>
                  {slideError ? (
                    <Text style={styles.slideErrorText}>{slideError}</Text>
                  ) : null}
                  <TouchableOpacity
                    style={[styles.saveSlidesBtn, isGenerating && styles.saveSlidesBtnDisabled]}
                    onPress={async () => {
                      setSlideError(null);
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
                        setSlideError('Could not generate slides. Try again.');
                      }
                    }}
                    disabled={isGenerating}
                    activeOpacity={0.75}
                  >
                    {isGenerating ? (
                      <ActivityIndicator size="small" color={G2} />
                    ) : (
                      <Ionicons name="albums-outline" size={15} color={W} />
                    )}
                    <Text style={styles.saveSlidesBtnText}>
                      {isGenerating ? 'Generating slides…' : 'Save as Slides'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })()}

            {/* Conviction prompt — Catalyst Scanner only, once per session */}
            {(() => {
              if (id !== 'market-catalyst-scanner') return null;
              if (convictionResponded) return null;
              const last = messages[messages.length - 1];
              if (!last || last.role !== 'assistant' || isLoading || last.content.length < 200) return null;
              const detectedTheme: ConvictionTheme | null = detectThemeFromText(last.content);
              if (!detectedTheme) return null;
              // Skip if user already has a conviction for this theme
              if (convictions.some((c) => c.theme === detectedTheme)) return null;

              const themeLabel = CONVICTION_THEME_LABEL[detectedTheme];

              const respond = async (belief: ConvictionBelief) => {
                setConvictionResponded(true);
                // 'no' → low confidence (user actively disbelieves, not uncertain)
                // 'still-forming' / 'yes' → medium confidence
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

        {/* Hide text input when a picker is active */}
        {!hasOptions && (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder={
                id === 'portfolio-reviewer'        ? 'Describe your portfolio...' :
                id === 'market-catalyst-scanner'   ? 'Ask about a market event...' :
                id === 'etf-analyzer'              ? 'Name an ETF to analyze...' :
                id === 'stock-researcher'           ? 'Name a stock or company...' :
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
  clearButton: { paddingHorizontal: 4 },
  clearButtonText: { color: G2, fontSize: 14 },

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

  saveSlideRow: {
    alignItems: 'flex-end',
    paddingHorizontal: 4,
    paddingBottom: 4,
    gap: 6,
  },
  saveSlidesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: S1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
  },
  saveSlidesBtnDisabled: { opacity: 0.5 },
  saveSlidesBtnText: { color: W, fontSize: 13, fontWeight: '600' },
  slidesSavedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  slidesSavedText: { color: '#10B981', fontSize: 13, fontWeight: '500' },
  slideErrorText:  { color: '#F87171', fontSize: 12 },

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
