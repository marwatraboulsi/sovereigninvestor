/**
 * Welcome / Splash — Modern Archivist edition.
 *
 * "Sovereign Investor — A discipline, not a destination."
 * Ceremonial composition: centred, editorial serif, gold rule.
 */

import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BG, GOLD, GOLD_DEEP, W, G1, G2, ON_PRIMARY, SERIF, SERIF_BOLD, BODY, R_SM } from '@/theme';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.bg, { paddingTop: insets.top }]}>

      {/* ── Centred ceremonial composition ── */}
      <View style={s.center}>

        {/* Edition eyebrow */}
        <Text style={s.edition}>Volume I · First Edition</Text>

        {/* Logotype */}
        <Text style={s.logo}>
          Sovereign{'\n'}<Text style={s.logoAccent}>Investor</Text>
        </Text>

        {/* Gold rule */}
        <View style={s.rule}/>

        {/* Tagline */}
        <Text style={s.tagline}>
          A discipline, not a destination.{'\n'}For investors who answer to themselves.
        </Text>

      </View>

      {/* ── Footer ── */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 28) }]}>
        <TouchableOpacity
          style={s.btn}
          onPress={() => router.push('/onboarding')}
          activeOpacity={0.85}
        >
          <Text style={s.btnText}>Begin</Text>
        </TouchableOpacity>

        <Text style={s.signIn}>
          Already keep a Playbook?{' '}
          <Text style={s.signInLink} onPress={() => router.push('/auth')}>Sign in</Text>
        </Text>
      </View>

    </View>
  );
}

const s = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: BG,
  },

  // ── Centred area ───────────────────────────────────────────────────
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },

  edition: {
    fontSize: 10,
    letterSpacing: 3.2,         // 0.32em at 10px
    textTransform: 'uppercase',
    color: GOLD,
    marginBottom: 28,
    fontFamily: BODY,
  },

  logo: {
    fontFamily: SERIF_BOLD,
    fontSize: 38,
    letterSpacing: 0.8,
    color: W,
    lineHeight: 44,
    textAlign: 'center',
  },
  logoAccent: {
    color: GOLD,
  },

  rule: {
    width: 32,
    height: 1,
    backgroundColor: GOLD,
    marginVertical: 20,
  },

  tagline: {
    fontFamily: SERIF,
    fontStyle: 'italic',
    fontSize: 15,
    color: G1,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 280,
  },

  // ── Footer ────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: 40,
    paddingTop: 0,
    alignItems: 'center',
    gap: 18,
  },

  btn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: R_SM,
    backgroundColor: GOLD,
    // Gold gradient effect via shadow overlay approximation
    alignItems: 'center',
  },
  btnText: {
    fontFamily: SERIF_BOLD,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: ON_PRIMARY,
  },

  signIn: {
    fontSize: 12,
    color: G2,
  },
  signInLink: {
    color: GOLD,
  },
});
