import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { BG, W, G1, G2, GOLD, LINE, S1, SERIF, BODY } from '@/theme';

interface AuthGateProps {
  title: string;
  message: string;
}

export function AuthGate({ title, message }: AuthGateProps) {
  return (
    <View style={s.container}>
      <View style={s.inner}>
        <Text style={s.title}>{title}</Text>
        <Text style={s.message}>{message}</Text>
        <TouchableOpacity
          style={s.btn}
          onPress={() => router.replace('/auth')}
          activeOpacity={0.8}
        >
          <Text style={s.btnText}>Create Account</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.replace('/auth')}
          activeOpacity={0.7}
        >
          <Text style={s.signInText}>Already have an account? Sign in</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  inner: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: W,
    fontFamily: SERIF,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 15,
    color: G1,
    fontFamily: BODY,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  btn: {
    width: '100%',
    backgroundColor: GOLD,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnText: {
    color: BG,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: SERIF,
    letterSpacing: 0.5,
  },
  signInText: {
    fontSize: 14,
    color: G2,
    fontFamily: BODY,
  },
});
