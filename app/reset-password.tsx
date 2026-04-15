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
import { supabase } from '@/lib/supabase';
import { BG, S1, LINE, W, GOLD, G2, SERIF, BODY } from '@/theme';

export default function ResetPasswordScreen() {
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function handleReset() {
    setError(null);
    if (!password.trim() || !confirm.trim()) {
      setError('Please fill in both fields.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
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
          <View style={s.header}>
            <Text style={s.title}>Set new password</Text>
            <Text style={s.subtitle}>Choose a new password for your account.</Text>
          </View>

          <View style={s.form}>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="New password"
              placeholderTextColor={G2}
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
            />
            <TextInput
              style={s.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Confirm new password"
              placeholderTextColor={G2}
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
            />

            {error ? <Text style={s.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[s.btn, loading && s.btnDisabled]}
              onPress={handleReset}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color={BG} />
              ) : (
                <Text style={s.btnText}>Update Password</Text>
              )}
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
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 32, gap: 40 },

  header:   { gap: 8 },
  title:    { fontSize: 22, fontWeight: '700', color: W, fontFamily: SERIF },
  subtitle: { fontSize: 14, color: G2, fontFamily: BODY },

  form: { gap: 14 },

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

  errorText: { color: '#F87171', fontSize: 13, lineHeight: 18 },

  btn: {
    backgroundColor: GOLD,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: BG, fontSize: 15, fontWeight: '700', letterSpacing: 0.5, fontFamily: SERIF },
});
