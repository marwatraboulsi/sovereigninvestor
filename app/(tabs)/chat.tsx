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
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
const ORIENTATION_KEY = 'orientation_seen';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRef, useEffect, useState, useCallback } from 'react';
import Markdown from 'react-native-markdown-display';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useGuest } from '@/contexts/GuestContext';
import { useSpeechInput } from '@/hooks/useSpeechInput';
import { useConversation, consumePendingConversation } from '@/hooks/useConversation';
import { streamClaude, loadFundManagerContext, retrieveKnowledgeChunks } from '@/api/claudeClient';
import type { Message, FundManagerContext } from '@/types';

// ─── Tokens ───────────────────────────────────────────────────────────────────

import { BG, BG_DEEP, S1, S2, S_HIGH, S_HIGHEST, LINE, W, GOLD, ON_PRIMARY, G1, G2, G3, SERIF, SERIF_BOLD, BODY, R, R_SM, R_LG, TAB_BAR_HEIGHT } from '@/theme';

// ─── Content ──────────────────────────────────────────────────────────────────

const STARTERS = [
  'What is the stock market and how does it work?',
  "Explain ETFs to me like I'm a beginner",
  "What's the difference between growth and value investing?",
  'How do I evaluate an ETF using MACE?',
  'What is dollar-cost averaging?',
  'Walk me through how to build a portfolio',
];

const TOOLS = [
  { icon: 'remove-outline' as const,      label: 'Simpler',       prompt: 'Can you explain that more simply?' },
  { icon: 'arrow-forward-outline' as const,label: 'Example',      prompt: 'Give me a real-world example of that.' },
  { icon: 'list-outline' as const,        label: 'Key points',    prompt: 'What are the key takeaways?' },
  { icon: 'telescope-outline' as const,   label: 'Go deeper',     prompt: 'Can you go deeper on that topic?' },
  { icon: 'help-circle-outline' as const, label: 'What do I do?', prompt: 'What should I practically consider doing with this?' },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { isGuest }                         = useGuest();
  const { profile }                         = useUserProfile();
  const { loadConversation, loadConversationById, startNewConversation, saveMessage } = useConversation();
  const [messages, setMessages]             = useState<Message[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [streamingText, setStreaming]       = useState('');
  const [isStreaming, setIsStreaming]       = useState(false);
  const [input, setInput]                   = useState('');
  const [error, setError]                   = useState<string | null>(null);
  const [toolsOpen, setToolsOpen]           = useState(false);
  const [fmContext, setFmContext]           = useState<FundManagerContext>({});
  const [showPrivacy, setShowPrivacy]       = useState(false);
  const scrollRef                           = useRef<ScrollView>(null);
  const abortRef                            = useRef<(() => void) | null>(null);

  // ── Intercept seed (4E) ────────────────────────────────────────────────────
  // When the user taps "Talk it through" in the Intercept wizard, the chat tab
  // receives a `seed` param and auto-sends it as the opening message.
  const { seed } = useLocalSearchParams<{ seed?: string }>();
  const lastSeedRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    loadFundManagerContext().then(setFmContext).catch(() => {});
    AsyncStorage.getItem('privacy_notice_seen').then((seen) => {
      if (!seen) setShowPrivacy(true);
    });
    loadConversation().then((msgs) => {
      setMessages(msgs);
      setHistoryLoading(false);
    }).catch(() => setHistoryLoading(false));
  }, []);

  // Auto-send seed message from Intercept "Talk it through" (4E)
  useEffect(() => {
    if (!seed || seed === lastSeedRef.current) return;
    if (historyLoading || isStreaming) return;
    lastSeedRef.current = seed;
    send(seed);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, historyLoading]);

  // Pick up conversation switches from the browser
  // Show orientation once on first open
  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem(ORIENTATION_KEY).then((seen) => {
      if (!seen) router.push('/orientation');
    });
  }, []));

  useFocusEffect(useCallback(() => {
    const pendingId = consumePendingConversation();
    if (pendingId) {
      setHistoryLoading(true);
      setMessages([]);
      setStreaming('');
      setIsStreaming(false);
      setError(null);
      loadConversationById(pendingId).then((msgs) => {
        setMessages(msgs);
        setHistoryLoading(false);
      }).catch(() => setHistoryLoading(false));
    }
  }, [loadConversationById]));

  const { isListening, isAvailable: micAvailable, toggle: toggleMic } = useSpeechInput({
    onResult: (text) => setInput((prev) => (prev ? prev + ' ' + text : text)),
  });

  // Guest: clear messages every time the tab is focused (fresh session)
  useFocusEffect(useCallback(() => {
    if (isGuest) {
      setMessages([]);
      setStreaming('');
      setIsStreaming(false);
      setError(null);
      setHistoryLoading(false);
    }
  }, [isGuest]));

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, streamingText]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    setInput('');
    setError(null);
    setStreaming('');
    setToolsOpen(false);

    const userMsg: Message = { role: 'user', content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setIsStreaming(true);

    // Persist user message immediately (skip for guests)
    if (!isGuest) saveMessage(userMsg);

    // Retrieve relevant knowledge chunks before streaming (falls back silently)
    const chunks = await retrieveKnowledgeChunks(trimmed);
    const enrichedContext = chunks ? { ...fmContext, knowledgeChunks: chunks } : fmContext;

    // Trim history sent to Claude to last 100 messages (full history stays in UI + Supabase)
    const CLAUDE_MSG_LIMIT = 100;
    const messagesForClaude = next.length > CLAUDE_MSG_LIMIT
      ? next.slice(next.length - CLAUDE_MSG_LIMIT)
      : next;

    abortRef.current = streamClaude(
      { messages: messagesForClaude, userProfile: profile ?? undefined, fundManagerContext: enrichedContext },
      {
        onChunk:  (c) => setStreaming((p) => p + c),
        onDone:   (content, suggestions) => {
          setStreaming('');
          setIsStreaming(false);
          const assistantMsg: Message = { role: 'assistant', content, suggestions };
          setMessages((p) => [...p, assistantMsg]);
          // Persist assistant message (skip for guests)
          if (!isGuest) saveMessage(assistantMsg);
        },
        onError:  (err) => {
          setStreaming('');
          setIsStreaming(false);
          setError(err.message);
        },
      },
    );
  }, [messages, isStreaming, profile, fmContext, saveMessage, isGuest]);

  const reset = () => {
    abortRef.current?.();
    setMessages([]);
    setStreaming('');
    setIsStreaming(false);
    setError(null);
    setToolsOpen(false);
    if (!isGuest) startNewConversation();
  };

  const isEmpty     = messages.length === 0 && !isStreaming;
  const hasMessages = messages.length > 0 || isStreaming;

  const dismissPrivacy = () => {
    AsyncStorage.setItem('privacy_notice_seen', 'true');
    setShowPrivacy(false);
  };

  return (
    <SafeAreaView style={s.safe}>

      {/* One-time privacy notice */}
      <Modal visible={showPrivacy} transparent animationType="fade">
        <View style={s.privacyOverlay}>
          <View style={s.privacySheet}>
            <Text style={s.privacyTitle}>A quick note on your data</Text>
            <Text style={s.privacyBody}>
              Your vault stores ticker symbols and share quantities only. No bank details, no account numbers, nothing sensitive.{'\n\n'}
              Your email secures your account and nothing else. We never use it for marketing or share it with anyone.{'\n\n'}
              Your profile and analyses are private to you. We can't see them.
            </Text>
            <TouchableOpacity style={s.privacyBtn} onPress={dismissPrivacy} activeOpacity={0.8}>
              <Text style={s.privacyBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Guest banner */}
      {isGuest && (
        <View style={s.guestBanner}>
          <Text style={s.guestBannerText}>
            You're exploring as a guest. Your conversation won't be saved.
          </Text>
        </View>
      )}

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerRow}>
          <View style={s.headerLeft}>
            <Text style={s.headerEyebrow}>Counsel</Text>
            <Text style={s.headerTitle}>Nora.</Text>
          </View>
          <View style={s.headerActions}>
            <TouchableOpacity onPress={() => router.push({ pathname: '/how-it-works', params: { tab: 'chat' } })} activeOpacity={0.6} style={s.headerIconBtn}>
              <Text style={s.headerInfoText}>?</Text>
            </TouchableOpacity>
            {!isGuest && (
              <TouchableOpacity onPress={() => router.push('/conversations')} activeOpacity={0.6} style={s.headerIconBtn}>
                <Ionicons name="time-outline" size={18} color={G2} />
              </TouchableOpacity>
            )}
            {hasMessages && (
              <TouchableOpacity onPress={reset} activeOpacity={0.6} style={s.newChatBtn}>
                <Text style={s.newChatText}>New</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <Text style={s.headerSub}>A thinking partner, not an oracle. She knows what you said you would do.</Text>
      </View>

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={s.scroll}
          contentContainerStyle={[s.scrollContent, isEmpty && s.scrollEmpty]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={() => setToolsOpen(false)}
        >
          {historyLoading ? (
            <View style={s.historyLoading}>
              <ActivityIndicator color={G1} size="small" />
            </View>
          ) : isEmpty ? (
            <EmptyState onSelect={send} />
          ) : (
            <>
              {messages.map((msg, i) => (
                <Bubble
                  key={i}
                  msg={msg}
                  isLast={i === messages.length - 1 && !isStreaming}
                  onSuggest={send}
                />
              ))}
              {isStreaming && <StreamBubble text={streamingText} />}
            </>
          )}

          {error && (
            <View style={s.errorBar}>
              <Text style={s.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => setError(null)}>
                <Text style={s.errorDismiss}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Input area */}
        <View style={s.inputArea}>
          {/* Tools menu */}
          {toolsOpen && hasMessages && !isStreaming && (
            <View style={s.toolsMenu}>
              {TOOLS.map((t, i) => (
                <TouchableOpacity
                  key={t.label}
                  style={[s.toolItem, i < TOOLS.length - 1 && s.toolItemBorder]}
                  onPress={() => send(t.prompt)}
                  activeOpacity={0.6}
                >
                  <Text style={s.toolLabel}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={s.disclaimer}>Educational only. Not investment advice.</Text>

          {/* Input card */}
          <View style={s.inputCard}>
            <TextInput
              style={s.inputField}
              value={input}
              onChangeText={setInput}
              placeholder="Ask anything about investing…"
              placeholderTextColor={G2}
              multiline
              maxLength={2000}
              returnKeyType="send"
              onSubmitEditing={() => send(input)}
              blurOnSubmit={false}
              onFocus={() => setToolsOpen(false)}
            />
            <View style={s.toolbar}>
              <View style={s.toolbarLeft}>
                {hasMessages && !isStreaming && (
                  <TouchableOpacity
                    style={s.toolsBtn}
                    onPress={() => setToolsOpen((o) => !o)}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="flash-outline" size={14} color={toolsOpen ? W : G1} />
                    <Text style={[s.toolsBtnText, toolsOpen && { color: W }]}>Tools</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={s.toolbarRight}>
                <TouchableOpacity
                  style={[s.micBtn, isListening && s.micBtnActive]}
                  onPress={micAvailable ? toggleMic : undefined}
                  activeOpacity={0.6}
                >
                  <Ionicons name={isListening ? 'mic' : 'mic-outline'} size={17} color={isListening ? W : G1} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.sendBtn, (!input.trim() || isStreaming) && s.sendBtnOff]}
                  onPress={() => send(input)}
                  disabled={!input.trim() || isStreaming}
                  activeOpacity={0.8}
                >
                  {isStreaming
                    ? <ActivityIndicator color={BG} size="small" />
                    : <Ionicons name="arrow-up" size={16} color={BG} />
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onSelect }: { onSelect: (t: string) => void }) {
  return (
    <View style={s.empty}>
      <View style={s.starters}>
        {STARTERS.map((q, i) => (
          <TouchableOpacity
            key={q}
            style={[s.starter, i < STARTERS.length - 1 && s.starterBorder]}
            onPress={() => onSelect(q)}
            activeOpacity={0.5}
          >
            <Text style={s.starterText}>{q}</Text>
            <Ionicons name="chevron-forward" size={14} color={G2} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Bubble ───────────────────────────────────────────────────────────────────

function Bubble({ msg, isLast, onSuggest }: { msg: Message; isLast: boolean; onSuggest: (t: string) => void }) {
  if (msg.role === 'user') {
    return (
      <View style={s.userWrap}>
        <View style={s.userBubble}>
          <Text style={s.userText}>{msg.content}</Text>
        </View>
      </View>
    );
  }

  const sections = toSections(msg.content);

  return (
    <View style={s.asstWrap}>
      {/* Nora identifier — left rule + italic name */}
      <View style={s.noraIdent}>
        <View style={s.noraRule}/>
        <Text style={s.noraLabel}>Nora</Text>
      </View>

      {sections.length > 1 ? (
        sections.map((sec, i) => (
          <View key={i} style={s.section}>
            {sec.heading ? <Text style={s.secHeading}>{sec.heading}</Text> : null}
            <Markdown style={md}>{sec.body}</Markdown>
          </View>
        ))
      ) : (
        <Markdown style={md}>{msg.content}</Markdown>
      )}

      {isLast && msg.suggestions && msg.suggestions.length > 0 && (
        <View style={s.chips}>
          {msg.suggestions.map((sg, i) => (
            <TouchableOpacity key={i} style={s.chip} onPress={() => onSuggest(sg)} activeOpacity={0.6}>
              <Text style={s.chipText}>{sg}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Streaming bubble ─────────────────────────────────────────────────────────

function StreamBubble({ text }: { text: string }) {
  return (
    <View style={s.asstWrap}>
      {text.length === 0 ? (
        <View style={s.thinking}>
          <ActivityIndicator color={G1} size="small" />
          <Text style={s.thinkingText}>Thinking…</Text>
        </View>
      ) : (
        <Markdown style={md}>{text + '▍'}</Markdown>
      )}
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface Section { heading: string; body: string }
function toSections(text: string): Section[] {
  const lines = text.split('\n');
  const out: Section[] = [];
  let heading = '';
  let body: string[] = [];
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (body.join('').trim()) out.push({ heading, body: body.join('\n').trim() });
      heading = line.replace(/^##\s*/, '');
      body = [];
    } else { body.push(line); }
  }
  if (body.join('').trim()) out.push({ heading, body: body.join('\n').trim() });
  return out.length > 0 ? out : [{ heading: '', body: text }];
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },

  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeft:    { flex: 1 },
  headerEyebrow: { fontSize: 10, letterSpacing: 1.8, textTransform: 'uppercase', color: GOLD, fontFamily: BODY, fontWeight: '500', marginBottom: 4 },
  headerTitle:   { fontFamily: SERIF, fontSize: 28, fontWeight: '400', color: W, letterSpacing: -0.3, lineHeight: 32 },
  headerSub:     { fontFamily: SERIF, fontStyle: 'italic', fontSize: 13, color: G1, marginTop: 8, lineHeight: 20, maxWidth: 290 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 },
  headerIconBtn: { padding: 4 },
  headerInfoText: { fontSize: 14, color: G2, fontFamily: BODY, fontWeight: '600' },
  newChatBtn:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: R_SM, borderWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  newChatText:   { fontSize: 11, color: G2, letterSpacing: 0.5 },

  scroll:        { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 12, gap: 20 },
  scrollEmpty:   { flex: 1 },

  historyLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  guestBanner: {
    backgroundColor: '#1a2e28',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a4038',
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  guestBannerText: { fontSize: 12, color: G2, fontFamily: BODY, textAlign: 'center' },

  // Empty state
  empty:         { flex: 1, paddingTop: 12 },
  emptyTitle: {
    fontSize: 30, fontWeight: '700', color: W,
    lineHeight: 38, letterSpacing: -0.6, marginBottom: 12,
    fontFamily: SERIF,
  },
  emptySub: { fontSize: 15, color: G1, lineHeight: 22, marginBottom: 36, fontFamily: BODY },
  starters:      { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE },
  starter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, gap: 12,
  },
  starterBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE },
  starterText:   { flex: 1, color: G1, fontSize: 15, lineHeight: 21, fontFamily: BODY },

  // User
  userWrap:   { alignItems: 'flex-end' },
  userBubble: {
    backgroundColor: S_HIGH, borderRadius: R,
    paddingHorizontal: 18, paddingVertical: 14, maxWidth: '82%',
  },
  userText: { color: W, fontSize: 14, lineHeight: 22, fontFamily: BODY },

  // Nora identifier
  noraIdent: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  noraRule:  { width: 14, height: 1, backgroundColor: GOLD },
  noraLabel: { fontFamily: SERIF, fontStyle: 'italic', fontSize: 11, color: GOLD, letterSpacing: 0.4 },

  // Assistant
  asstWrap: { gap: 10 },
  section:  { gap: 6 },
  secHeading: {
    fontSize: 12, fontWeight: '600', color: G2,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4,
    fontFamily: BODY,
  },

  // Chips — suggestion buttons
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    borderRadius: R_SM, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: LINE,
    backgroundColor: 'transparent',
  },
  chipText: { color: GOLD, fontSize: 12, fontFamily: BODY },

  // Thinking
  thinking:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thinkingText: { color: G1, fontSize: 14 },

  // Error
  errorBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#3A1A1A',
    backgroundColor: '#1A0A0A',
  },
  errorText:    { color: '#FF6B6B', fontSize: 13, flex: 1 },
  errorDismiss: { color: G1, fontSize: 13, marginLeft: 12 },

  // Input area — glass composer
  inputArea: {
    paddingHorizontal: 20,
    paddingBottom: TAB_BAR_HEIGHT,
    paddingTop: 14,
    gap: 6,
    backgroundColor: 'rgba(7, 22, 16, 0.78)',
  },
  disclaimer: { textAlign: 'center', fontSize: 10, color: G3, fontFamily: SERIF, fontStyle: 'italic' },

  // Tools menu
  toolsMenu: {
    backgroundColor: S1, borderRadius: R,
    overflow: 'hidden', marginBottom: 4,
  },
  toolItem:       { paddingHorizontal: 18, paddingVertical: 14 },
  toolItemBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE },
  toolLabel:      { color: G1, fontSize: 14, fontFamily: BODY },

  // Input card — sharp, tonal
  inputCard: {
    backgroundColor: S_HIGHEST, borderRadius: R,
    paddingTop: 4, paddingBottom: 4, paddingHorizontal: 4,
    // Ghost bottom border — the one permitted line
    shadowColor: 'rgba(206, 197, 184, 0.16)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  inputField: {
    color: W, fontSize: 15, lineHeight: 22, fontFamily: BODY,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6,
    maxHeight: 130, minHeight: 44,
  },
  toolbar: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 2,
  },
  toolbarLeft:  { flexDirection: 'row', alignItems: 'center' },
  toolbarRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  toolsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: R_SM,
  },
  toolsBtnText: { color: G2, fontSize: 12, fontFamily: BODY },

  micBtn: {
    width: 34, height: 34, borderRadius: R_SM,
    alignItems: 'center', justifyContent: 'center',
  },
  micBtnActive: {
    backgroundColor: S2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: W,
  },
  sendBtn: {
    width: 34, height: 34, borderRadius: R_SM,
    backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnOff: { backgroundColor: S2 },

  privacyOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  privacySheet: {
    backgroundColor: S1,
    borderTopLeftRadius: R_LG,
    borderTopRightRadius: R_LG,
    padding: 28,
    paddingBottom: 44,
    gap: 16,
  },
  privacyTitle:   { fontFamily: SERIF, fontSize: 18, fontWeight: '400', color: W },
  privacyBody:    { fontSize: 14, color: G1, lineHeight: 22, fontFamily: BODY },
  privacyBtn: {
    backgroundColor: GOLD,
    borderRadius: R_SM,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  privacyBtnText: { color: ON_PRIMARY, fontSize: 15, fontWeight: '700', fontFamily: SERIF },
});

const md = StyleSheet.create({
  body:        { color: W, fontSize: 15, lineHeight: 25, fontFamily: BODY },
  heading1:    { color: W, fontSize: 22, fontWeight: '400', marginBottom: 6, marginTop: 10, fontFamily: SERIF },
  heading2:    { color: W, fontSize: 18, fontWeight: '400', marginBottom: 4, marginTop: 8, fontFamily: SERIF },
  heading3:    { color: G1, fontSize: 15, fontWeight: '600', marginBottom: 4, marginTop: 6, fontFamily: BODY },
  strong:      { color: W, fontWeight: '600' },
  em:          { color: G1, fontStyle: 'italic', fontFamily: SERIF },
  bullet_list: { marginVertical: 4 },
  list_item:   { color: W, fontSize: 15, lineHeight: 24, fontFamily: BODY },
  // Pull-quote: gold left border — the one permitted line in the system
  blockquote: {
    borderLeftColor: GOLD, borderLeftWidth: 2,
    paddingLeft: 18, paddingVertical: 4, marginVertical: 8,
  },
  code_inline: {
    backgroundColor: S2, color: G1, borderRadius: R_SM,
    paddingHorizontal: 4, fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fence:       { backgroundColor: S2, borderRadius: R, padding: 14, marginVertical: 6 },
  code_block:  { color: G1, fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  hr:          { backgroundColor: LINE, height: StyleSheet.hairlineWidth, marginVertical: 12 },
  link:        { color: GOLD, textDecorationLine: 'underline' },
  table:       { borderWidth: StyleSheet.hairlineWidth, borderColor: LINE, borderRadius: R, marginVertical: 8 },
  thead:       { backgroundColor: S2 },
  th:          { color: G1, fontWeight: '600', padding: 8, fontSize: 13, fontFamily: BODY },
  td:          { color: W, padding: 8, fontSize: 13, fontFamily: BODY },
  tr:          { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE },
});
