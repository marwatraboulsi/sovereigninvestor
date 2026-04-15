import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '@/lib/supabase';
import { BG, S1, LINE, W, GOLD, G1, G2, G3, SERIF, BODY } from '@/theme';

export default function AuthScreen() {
  const [mode, setMode]         = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState<string | null>(null);

  // ── Apple Sign In ────────────────────────────────────────────────────────────

  async function handleAppleSignIn() {
    setError(null);
    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('No identity token from Apple.');
      const { error: err } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (err) throw err;
      router.replace('/');
    } catch (err: any) {
      if (err.code !== 'ERR_REQUEST_CANCELED') {
        setError(err.message ?? 'Apple sign in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Forgot Password ──────────────────────────────────────────────────────────

  async function handleForgotPassword() {
    setError(null);
    setSuccess(null);
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'sovereigninvestor://reset-password',
      });
      if (err) throw err;
      setSuccess('Check your email for a password reset link.');
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Email / Password ─────────────────────────────────────────────────────────

  async function handleSubmit() {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
      }
      router.replace('/');
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.container}>

          {/* ── Logo ── */}
          <View style={s.logoArea}>
            <View style={s.wordmark}>
              <Text style={s.wordmarkTop}>SOVEREIGN</Text>
              <View style={s.wordmarkDivider} />
              <Text style={s.wordmarkBottom}>INVESTOR</Text>
            </View>
            <Text style={s.slogan}>Your personal fund manager.{'\n'}Built to educate and empower.</Text>
          </View>

          {/* ── Auth options ── */}
          <View style={s.form}>

            {/* Apple Sign In */}
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={12}
              style={s.appleBtn}
              onPress={handleAppleSignIn}
            />

            {/* Divider */}
            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>or</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Email */}
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={G2}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            {/* Password — hidden in forgot mode */}
            {mode !== 'forgot' && (
              <TextInput
                style={s.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={G2}
                secureTextEntry
                autoCapitalize="none"
                editable={!loading}
              />
            )}

            {/* Forgot password link — login mode only */}
            {mode === 'login' && (
              <TouchableOpacity
                onPress={() => { setMode('forgot'); setError(null); setSuccess(null); }}
                disabled={loading}
              >
                <Text style={s.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            )}

            {error   ? <Text style={s.errorText}>{error}</Text>   : null}
            {success ? <Text style={s.successText}>{success}</Text> : null}

            <TouchableOpacity
              style={[s.btn, loading && s.btnDisabled]}
              onPress={mode === 'forgot' ? handleForgotPassword : handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color={BG} />
              ) : (
                <Text style={s.btnText}>
                  {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={s.toggle}
              onPress={() => { setMode(mode === 'signup' ? 'login' : mode === 'forgot' ? 'login' : 'signup'); setError(null); setSuccess(null); }}
              disabled={loading}
            >
              <Text style={s.toggleText}>
                {mode === 'login'
                  ? "Don't have an account? Sign up"
                  : mode === 'signup'
                  ? 'Already have an account? Sign in'
                  : 'Back to sign in'}
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: BG },
  flex:      { flex: 1 },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 32, gap: 48 },

  // ── Logo ──
  logoArea: { alignItems: 'center', gap: 24 },

  wordmark:        { alignItems: 'center', gap: 8 },
  wordmarkTop: {
    fontSize: 18,
    fontWeight: '700',
    color: W,
    letterSpacing: 8,
    fontFamily: SERIF,
  },
  wordmarkDivider: {
    width: 40,
    height: StyleSheet.hairlineWidth,
    backgroundColor: GOLD,
  },
  wordmarkBottom: {
    fontSize: 18,
    fontWeight: '400',
    color: G1,
    letterSpacing: 8,
    fontFamily: SERIF,
  },
  slogan: {
    fontSize: 14,
    color: G2,
    fontFamily: BODY,
    fontStyle: 'italic',
    letterSpacing: 0.2,
    textAlign: 'center',
  },

  // ── Form ──
  form:     { gap: 14 },

  appleBtn: { width: '100%', height: 52 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: G3 },
  dividerText: { fontSize: 12, color: G2, fontFamily: BODY, letterSpacing: 0.5 },

  input: {
    backgroundColor: S1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: W,
    fontSize: 15,
    fontFamily: BODY,
  },

  errorText:   { color: '#F87171', fontSize: 13, lineHeight: 18 },
  successText: { color: '#4ADE80', fontSize: 13, lineHeight: 18 },
  forgotText:  { color: G2, fontSize: 13, fontFamily: BODY, textAlign: 'right' },

  btn: {
    backgroundColor: GOLD,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: BG, fontSize: 15, fontWeight: '700', letterSpacing: 0.5, fontFamily: SERIF },

  toggle:     { alignItems: 'center', paddingVertical: 8 },
  toggleText: { color: G2, fontSize: 14, fontFamily: BODY },
});
