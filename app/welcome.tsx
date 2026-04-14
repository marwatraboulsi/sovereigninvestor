import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BG, LINE, W, GOLD, G1, G2, SERIF, BODY } from '@/theme';

const VALUE_PROPS = [
  { title: 'Tailored to your level', description: 'Beginner or advanced, the app adapts to where you are.' },
  { title: 'Real investing frameworks', description: 'MACE, 8-phase analysis, portfolio archetypes, and more.' },
  { title: 'Ask anything, anytime', description: 'Your personal investing knowledge base, always available.' },
];

export default function WelcomeScreen() {
  return (
    <View style={s.bg}>
      <SafeAreaView style={s.safe}>

        <View style={s.hero}>
          <Text style={s.appName}>Sovereign{'\n'}Investor</Text>
          <Text style={s.tagline}>Your investing education system</Text>
        </View>

        <View style={s.divider} />

        <View style={s.props}>
          {VALUE_PROPS.map((p, i) => (
            <View key={p.title} style={[s.prop, i < VALUE_PROPS.length - 1 && s.propBorder]}>
              <Text style={s.propTitle}>{p.title}</Text>
              <Text style={s.propDesc}>{p.description}</Text>
            </View>
          ))}
        </View>

        <View style={s.footer}>
          <TouchableOpacity style={s.cta} onPress={() => router.push('/onboarding')} activeOpacity={0.8}>
            <Text style={s.ctaText}>Get Started</Text>
          </TouchableOpacity>
          <Text style={s.legal}>Educational content only. Not investment advice.</Text>
        </View>

      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  bg:   { flex: 1, backgroundColor: BG },
  safe: { flex: 1, paddingHorizontal: 28 },

  hero: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 20,
  },
  appName: {
    fontSize: 52,
    fontWeight: '800',
    color: W,
    letterSpacing: -1.5,
    lineHeight: 58,
    marginBottom: 16,
    fontFamily: SERIF,
  },
  tagline: { fontSize: 17, color: G1, lineHeight: 24, fontFamily: BODY },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: LINE, marginVertical: 36 },

  props: { gap: 0 },
  prop: { paddingVertical: 20 },
  propBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE },
  propTitle:  { fontSize: 16, fontWeight: '600', color: W, marginBottom: 4 },
  propDesc:   { fontSize: 14, color: G1, lineHeight: 20, fontFamily: BODY },

  footer: { paddingBottom: 16, gap: 14 },
  cta: {
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
  },
  ctaText: { color: BG, fontSize: 17, fontWeight: '700' },
  legal:   { textAlign: 'center', fontSize: 12, color: G2 },
});
