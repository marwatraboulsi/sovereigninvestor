/**
 * Learn Mode — Phase 7
 *
 * Contextual education screen entered from the Intercept wizard when the user
 * has no matching Playbook rule for a pending decision.
 *
 * Flow:
 *   1. Mount → load FundManager context + RAG chunks for the topic (parallel)
 *   2. Auto-send opening message (user doesn't type to start)
 *   3. Focused Q&A conversation with a topic-specific system prompt
 *   4. After 3 assistant messages → closing card appears
 *   5a. "Yes, build a rule" → navigate back to Intercept with learnRuleCategory param
 *   5b. "Not yet" → router.back()
 *
 * No conversation persistence (sessions are single-use and ephemeral).
 */

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
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef, useCallback } from 'react';

import { useUserProfile } from '@/hooks/useUserProfile';
import { MessageBubble } from '@/components/MessageBubble';
import {
  streamClaude,
  loadFundManagerContext,
  retrieveKnowledgeChunks,
} from '@/api/claudeClient';
import {
  buildLearnModeContent,
  suggestCategoryForTopic,
} from '@/skills/learnMode';
import type { Message } from '@/types';

import { BG, S1, S2, LINE, W, GOLD, G1, G2, SERIF, BODY } from '@/theme';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LearnModeScreen() {
  // topic arrives URL-decoded from Expo Router
  const { topic: rawTopic } = useLocalSearchParams<{ topic: string }>();
  const topic = rawTopic ?? 'this type of investment';

  const { profile } = useUserProfile();

  // ── Conversation state ───────────────────────────────────────────────────
  const [messages,      setMessages]      = useState<Message[]>([]);
  const [streamingText, setStreaming]     = useState('');
  const [isStreaming,   setIsStreaming]   = useState(false);
  const [input,         setInput]        = useState('');
  const [error,         setError]        = useState<string | null>(null);

  // Count completed (non-streaming) assistant turns
  const assistantCount = messages.filter((m) => m.role === 'assistant').length;
  const showClosingPrompt = assistantCount >= 3 && !isStreaming;

  // ── Refs ──────────────────────────────────────────────────────────────────
  const scrollRef        = useRef<ScrollView>(null);
  const abortRef         = useRef<(() => void) | null>(null);
  const systemPromptRef  = useRef<string>('');
  const hasAutoSentRef   = useRef(false);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, streamingText]);

  // ── Core send function ────────────────────────────────────────────────────

  const send = useCallback((text: string, currentMessages: Message[]) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    setInput('');
    setError(null);
    setStreaming('');

    const userMsg: Message = { role: 'user', content: trimmed };
    const next = [...currentMessages, userMsg];
    setMessages(next);
    setIsStreaming(true);

    abortRef.current = streamClaude(
      {
        messages:             next,
        userProfile:          profile ?? undefined,
        systemPromptOverride: systemPromptRef.current,
      },
      {
        onChunk: (c) => setStreaming((p) => p + c),
        onDone:  (content) => {
          setStreaming('');
          setIsStreaming(false);
          setMessages((p) => [...p, { role: 'assistant', content }]);
        },
        onError: (err) => {
          setStreaming('');
          setIsStreaming(false);
          setError(err.message);
        },
      },
    );
  }, [isStreaming, profile]);

  // ── Mount: load context → auto-send opening message ───────────────────────

  useEffect(() => {
    if (hasAutoSentRef.current) return;
    hasAutoSentRef.current = true;

    async function init() {
      setIsStreaming(true); // show activity while loading

      // Load fund manager context + RAG chunks in parallel
      const [ctx, chunks] = await Promise.all([
        loadFundManagerContext().catch(() => ({})),
        retrieveKnowledgeChunks(topic).catch(() => ''),
      ]);

      const { systemPrompt, openingMessage } = buildLearnModeContent(
        topic,
        profile,
        (ctx as any).vaultSummary,
      );

      systemPromptRef.current = systemPrompt;

      // Inject RAG knowledge into context (same pattern as chat.tsx)
      const enrichedCtx = chunks ? { ...(ctx as any), knowledgeChunks: chunks } : ctx;

      setIsStreaming(false); // loading done; now actually stream

      // Auto-send the opening message
      const openingUserMsg: Message = { role: 'user', content: openingMessage };
      setMessages([openingUserMsg]);
      setIsStreaming(true);

      abortRef.current = streamClaude(
        {
          messages:             [openingUserMsg],
          userProfile:          profile ?? undefined,
          systemPromptOverride: systemPrompt,
          fundManagerContext:   enrichedCtx as any,
        },
        {
          onChunk: (c) => setStreaming((p) => p + c),
          onDone:  (content) => {
            setStreaming('');
            setIsStreaming(false);
            setMessages((p) => [...p, { role: 'assistant', content }]);
          },
          onError: (err) => {
            setStreaming('');
            setIsStreaming(false);
            setError(err.message);
          },
        },
      );
    }

    init();
    // profile may still be loading on mount; init once when available
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => { abortRef.current?.(); };
  }, []);

  // ── Closing prompt handlers ───────────────────────────────────────────────

  function handleBuildRule() {
    const suggestedCategory = suggestCategoryForTopic(topic);
    // Navigate to Intercept tab with the suggested category as a param.
    // InterceptWizard watches learnRuleCategory and opens the RuleWizard.
    router.push({
      pathname: '/(tabs)/intercept',
      params:   { learnRuleCategory: suggestedCategory },
    });
  }

  function handleNotYet() {
    router.back();
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const isLoading  = messages.length === 0 && isStreaming;
  const isEmpty    = messages.length === 0 && !isStreaming;

  return (
    <SafeAreaView style={s.safe}>

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={handleNotYet} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={W} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerLabel}>Learn Mode</Text>
          <Text style={s.headerTopic} numberOfLines={1}>{topic}</Text>
        </View>
        <View style={s.backBtn} />
      </View>

      {/* ── Message area ── */}
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Loading state while RAG + context prepares */}
          {isLoading && (
            <View style={s.loadingWrap}>
              <ActivityIndicator size="small" color={GOLD} />
              <Text style={s.loadingText}>Preparing your session…</Text>
            </View>
          )}

          {/* Empty guard — shouldn't normally show */}
          {isEmpty && !isLoading && (
            <View style={s.loadingWrap}>
              <Text style={s.loadingText}>Starting…</Text>
            </View>
          )}

          {/* Messages */}
          {messages.map((m, i) => (
            <MessageBubble key={i} role={m.role} content={m.content} />
          ))}

          {/* Streaming in-progress bubble */}
          {isStreaming && streamingText.length > 0 && (
            <MessageBubble role="assistant" content={streamingText} isStreaming />
          )}

          {/* Typing indicator while streaming but no text yet */}
          {isStreaming && streamingText.length === 0 && messages.length > 0 && (
            <View style={s.typingWrap}>
              <ActivityIndicator size="small" color={GOLD} />
              <Text style={s.typingText}>Thinking…</Text>
            </View>
          )}

          {/* Error */}
          {error && (
            <View style={s.errorWrap}>
              <Text style={s.errorText}>{error}</Text>
              <TouchableOpacity
                onPress={() => { setError(null); send(input || 'Continue.', messages); }}
                activeOpacity={0.7}
              >
                <Text style={s.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Closing prompt — appears after 3 assistant messages */}
          {showClosingPrompt && (
            <View style={s.closingCard}>
              <Text style={s.closingQuestion}>
                What do you think — does this change how you see{' '}
                <Text style={s.closingTopicBold}>{topic}</Text>?
              </Text>
              <View style={s.closingButtons}>
                <TouchableOpacity
                  style={s.closingBtnPrimary}
                  onPress={handleBuildRule}
                  activeOpacity={0.8}
                >
                  <Ionicons name="shield-checkmark-outline" size={16} color={BG} />
                  <Text style={s.closingBtnPrimaryText}>Yes — build a rule around this</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.closingBtnSecondary}
                  onPress={handleNotYet}
                  activeOpacity={0.7}
                >
                  <Text style={s.closingBtnSecondaryText}>Not yet, I'll think about it</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        {/* ── Input ── */}
        <View style={s.footer}>
          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask a follow-up question…"
              placeholderTextColor={G2}
              multiline
              returnKeyType="default"
              editable={!isStreaming}
            />
            <TouchableOpacity
              style={[s.sendBtn, (!input.trim() || isStreaming) && s.sendBtnOff]}
              onPress={() => send(input, messages)}
              disabled={!input.trim() || isStreaming}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-up" size={18} color={(!input.trim() || isStreaming) ? G2 : BG} />
            </TouchableOpacity>
          </View>
          <Text style={s.footerDisclaimer}>Educational content only — not investment advice.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: GOLD,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  headerTopic: {
    fontSize: 15,
    fontWeight: '600',
    color: W,
    fontFamily: SERIF,
    textAlign: 'center',
    maxWidth: 240,
  },

  // ── Messages ──────────────────────────────────────────────────────────────
  scroll:        { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 8 },

  loadingWrap: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    paddingVertical: 24,
    justifyContent: 'center',
  },
  loadingText: { fontSize: 14, color: G2, fontFamily: BODY },

  typingWrap: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    paddingVertical: 8,
  },
  typingText: { fontSize: 13, color: G2, fontFamily: BODY },

  errorWrap: {
    backgroundColor: '#2D0E0E',
    borderRadius:    10,
    padding:         14,
    gap:             8,
  },
  errorText:  { fontSize: 13, color: '#F87171', fontFamily: BODY, lineHeight: 18 },
  retryText:  { fontSize: 13, color: GOLD, fontWeight: '600' },

  // ── Closing prompt ────────────────────────────────────────────────────────
  closingCard: {
    backgroundColor: S1,
    borderRadius:    16,
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     GOLD + '55',
    padding:         20,
    gap:             16,
    marginTop:       8,
  },
  closingQuestion: {
    fontSize:   16,
    color:      G1,
    fontFamily: BODY,
    lineHeight: 24,
    textAlign:  'center',
  },
  closingTopicBold: {
    color:      W,
    fontWeight: '600',
  },
  closingButtons: {
    gap: 10,
  },
  closingBtnPrimary: {
    backgroundColor: GOLD,
    borderRadius:    12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
  },
  closingBtnPrimaryText: {
    color:      BG,
    fontSize:   15,
    fontWeight: '700',
    fontFamily: SERIF,
  },
  closingBtnSecondary: {
    backgroundColor: 'transparent',
    borderRadius:    12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems:      'center',
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     LINE,
  },
  closingBtnSecondaryText: {
    color:    G1,
    fontSize: 15,
  },

  // ── Input footer ──────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: 16,
    paddingTop:        10,
    paddingBottom:     20,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    LINE,
    gap:               8,
  },
  inputRow: {
    flexDirection:  'row',
    alignItems:     'flex-end',
    gap:            10,
  },
  input: {
    flex:            1,
    backgroundColor: S1,
    borderRadius:    14,
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     LINE,
    paddingHorizontal: 14,
    paddingVertical:   12,
    color:           W,
    fontSize:        15,
    fontFamily:      BODY,
    lineHeight:      22,
    maxHeight:       120,
  },
  sendBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: GOLD,
    alignItems:      'center',
    justifyContent:  'center',
  },
  sendBtnOff: {
    backgroundColor: S2,
  },
  footerDisclaimer: {
    fontSize:  11,
    color:     G2,
    fontFamily: BODY,
    textAlign: 'center',
  },
});
