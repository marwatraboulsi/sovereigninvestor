import {
  StyleSheet,
  View,
  Text,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { BG, S1, LINE, W, GOLD, G1, G2, SERIF, BODY } from '@/theme';

const SECTIONS = [
  {
    title: 'What we store',
    body: [
      'Your email address, used only to secure your account. We never use it for marketing or share it with anyone.',
      'Your profile preferences such as knowledge level, investment status, and risk tolerance. These exist solely to personalise your experience inside the app.',
      'Your vault holdings, stored as ticker symbols and share quantities only. No bank account numbers, no brokerage credentials, no financial account details of any kind.',
      'Your saved analyses from the Research tools, stored privately under your account.',
    ],
  },
  {
    title: 'What we never store',
    body: [
      'Bank account or brokerage login details.',
      'Credit card or payment information of any kind.',
      'Your real name, unless you choose to include it somewhere in a free-text field.',
      'Any data from financial institutions. The app has no connection to your bank or broker.',
    ],
  },
  {
    title: 'How your data is used',
    body: [
      'Your profile settings are used to personalise how your Fund Guide responds to you. They are never shared externally.',
      'Your vault holdings are used to give your Guide context when you ask portfolio-related questions. They are never shared or sold.',
      'We do not run advertising. Your data is not used to train AI models or shared with third parties.',
    ],
  },
  {
    title: 'Where your data lives',
    body: [
      'Your data is stored securely in the cloud. It is encrypted at rest and in transit.',
      'Each user\'s data is kept separate and private. No other user can access your information.',
    ],
  },
  {
    title: 'Your rights',
    body: [
      'You can delete your vault holdings at any time from inside the app.',
      'You can request full deletion of your account and all associated data by emailing us directly.',
      'You are never required to add holdings to use the app. The vault is entirely optional.',
    ],
  },
];

export default function PrivacyScreen() {
  return (
    <SafeAreaView style={s.safe}>
      <Stack.Screen
        options={{
          title: 'Privacy Policy',
          headerStyle: { backgroundColor: BG },
          headerTintColor: W,
          headerShadowVisible: false,
        }}
      />
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.headline}>Your data, plainly explained.</Text>
        <Text style={s.intro}>
          Sovereign Investor is a personal tool. We built it with the assumption that the less we know about you, the better. Here is exactly what we store and why.
        </Text>

        {SECTIONS.map((sec) => (
          <View key={sec.title} style={s.section}>
            <Text style={s.sectionTitle}>{sec.title}</Text>
            {sec.body.map((line, i) => (
              <View key={i} style={s.bulletRow}>
                <Text style={s.bullet}>·</Text>
                <Text style={s.bulletText}>{line}</Text>
              </View>
            ))}
          </View>
        ))}

        <Text style={s.footer}>Last updated April 2026</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: BG },
  scroll:  { flex: 1 },
  content: { padding: 24, paddingBottom: 60, gap: 32 },

  headline: { fontSize: 26, fontWeight: '700', color: W, fontFamily: SERIF, letterSpacing: -0.4, lineHeight: 34 },
  intro:    { fontSize: 15, color: G1, lineHeight: 24, fontFamily: BODY, marginTop: -16 },

  section:      { gap: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: GOLD, textTransform: 'uppercase', letterSpacing: 0.8 },
  bulletRow:    { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bullet:       { color: G2, fontSize: 18, lineHeight: 24, marginTop: -1 },
  bulletText:   { flex: 1, color: G1, fontSize: 15, lineHeight: 24, fontFamily: BODY },

  footer: { fontSize: 12, color: G2, textAlign: 'center', marginTop: -8 },
});
