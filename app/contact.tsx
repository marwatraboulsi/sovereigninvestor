import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BG, S1, S2, LINE, W, GOLD, G1, G2, SERIF, BODY } from '@/theme';

const TOPICS = [
  { value: 'feedback',  label: 'App feedback' },
  { value: 'question',  label: 'Question' },
  { value: 'bug',       label: 'Bug report' },
  { value: 'deletion',  label: 'Account deletion request' },
  { value: 'other',     label: 'Something else' },
];

export default function ContactScreen() {
  const [topic, setTopic]         = useState('');
  const [message, setMessage]     = useState('');
  const [sending, setSending]     = useState(false);
  const [sent, setSent]           = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const topicLabel = TOPICS.find((t) => t.value === topic)?.label ?? '';

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const fullMessage = topic ? `[${topicLabel}]\n\n${message.trim()}` : message.trim();
      const { error: err } = await supabase.from('contact_messages').insert({
        user_id: user?.id ?? null,
        name:    topic || null,
        message: fullMessage,
      });
      if (err) throw err;
      setSent(true);
      setTopic('');
      setMessage('');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <Stack.Screen
        options={{
          title: 'Contact Us',
          headerStyle: { backgroundColor: BG },
          headerTintColor: W,
          headerShadowVisible: false,
        }}
      />
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.headline}>Get in touch.</Text>
          <Text style={s.intro}>
            Whether it is a question, a bug, or just a thought, send it through and we will get back to you.
          </Text>

          {/* Topic picker modal */}
          <Modal
            visible={showPicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowPicker(false)}
          >
            <Pressable style={s.overlay} onPress={() => setShowPicker(false)}>
              <Pressable style={s.sheet} onPress={() => {}}>
                <Text style={s.sheetTitle}>What is this about?</Text>
                {TOPICS.map((t) => {
                  const selected = t.value === topic;
                  return (
                    <TouchableOpacity
                      key={t.value}
                      style={[s.option, selected && s.optionActive]}
                      onPress={() => { setTopic(t.value); setShowPicker(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.optionText, selected && s.optionTextActive]}>{t.label}</Text>
                      {selected && <View style={s.optionDot} />}
                    </TouchableOpacity>
                  );
                })}
              </Pressable>
            </Pressable>
          </Modal>

          {sent ? (
            <View style={s.successBox}>
              <Text style={s.successTitle}>Message sent.</Text>
              <Text style={s.successBody}>We will get back to you as soon as possible.</Text>
            </View>
          ) : (
            <View style={s.form}>
              {/* Topic selector */}
              <TouchableOpacity
                style={s.topicRow}
                onPress={() => setShowPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={[s.topicText, !topic && s.topicPlaceholder]}>
                  {topic ? topicLabel : 'What is this about?'}
                </Text>
                <Text style={s.chevron}>›</Text>
              </TouchableOpacity>

              {/* Message */}
              <TextInput
                style={[s.input, s.inputMulti]}
                value={message}
                onChangeText={setMessage}
                placeholder="Your message"
                placeholderTextColor={G2}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                editable={!sending}
              />

              {error ? <Text style={s.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[s.btn, (!message.trim() || sending) && s.btnDisabled]}
                onPress={handleSend}
                disabled={!message.trim() || sending}
                activeOpacity={0.8}
              >
                {sending
                  ? <ActivityIndicator size="small" color={BG} />
                  : <Text style={s.btnText}>Send message</Text>
                }
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: BG },
  flex:    { flex: 1 },
  scroll:  { flex: 1 },
  content: { padding: 24, paddingBottom: 60, gap: 28 },

  headline: { fontSize: 26, fontWeight: '700', color: W, fontFamily: SERIF, letterSpacing: -0.4, lineHeight: 34 },
  intro:    { fontSize: 15, color: G1, lineHeight: 24, fontFamily: BODY, marginTop: -12 },

  form: { gap: 12 },

  topicRow: {
    backgroundColor: S1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topicText:        { fontSize: 15, color: W, fontFamily: BODY, flex: 1 },
  topicPlaceholder: { color: G2 },
  chevron:          { color: G2, fontSize: 20, lineHeight: 22 },

  input: {
    backgroundColor: S1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: W,
    fontSize: 15,
    fontFamily: BODY,
  },
  inputMulti: { minHeight: 140, paddingTop: 13 },
  errorText:  { color: '#F87171', fontSize: 13 },

  btn: {
    backgroundColor: GOLD,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText:     { color: BG, fontSize: 15, fontWeight: '700' },

  successBox:   { backgroundColor: S1, borderRadius: 16, padding: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: LINE, gap: 8 },
  successTitle: { fontSize: 18, fontWeight: '700', color: W, fontFamily: SERIF },
  successBody:  { fontSize: 15, color: G1, fontFamily: BODY, lineHeight: 22 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: S1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 20,
    gap: 4,
  },
  sheetTitle: { fontSize: 13, fontWeight: '600', color: G2, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  optionActive:     { backgroundColor: S2 },
  optionText:       { fontSize: 16, color: G1 },
  optionTextActive: { color: W, fontWeight: '600' },
  optionDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: GOLD },
});
