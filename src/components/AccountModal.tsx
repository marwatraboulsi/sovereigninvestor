import { View, Text, TouchableOpacity, Modal, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { BG, S1, LINE, W, GOLD, G1, G2, SERIF, BODY } from '@/theme';

interface AccountModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}

export function AccountModal({
  visible,
  onClose,
  title = 'Create an account',
  message = 'Sign up to unlock the full experience and keep your data across sessions.',
}: AccountModalProps) {
  function goToAuth(mode: 'signup' | 'login') {
    onClose();
    router.push({ pathname: '/auth', params: { initialMode: mode } });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <Text style={s.title}>{title}</Text>
          <Text style={s.message}>{message}</Text>

          <TouchableOpacity style={s.primaryBtn} onPress={() => goToAuth('signup')} activeOpacity={0.8}>
            <Text style={s.primaryBtnText}>Create Account</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.secondaryBtn} onPress={() => goToAuth('login')} activeOpacity={0.8}>
            <Text style={s.secondaryBtnText}>Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={s.cancelBtn}>
            <Text style={s.cancelText}>Maybe later</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: S1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 44,
    gap: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: W,
    fontFamily: SERIF,
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 2,
  },
  message: {
    fontSize: 14,
    color: G1,
    fontFamily: BODY,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 6,
  },
  primaryBtn: {
    backgroundColor: GOLD,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: BG,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: SERIF,
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  secondaryBtnText: {
    color: W,
    fontSize: 15,
    fontWeight: '500',
    fontFamily: BODY,
  },
  cancelBtn: { alignItems: 'center', paddingVertical: 4 },
  cancelText: { color: G2, fontSize: 13, fontFamily: BODY },
});
