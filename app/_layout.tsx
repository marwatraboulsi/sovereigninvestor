import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useFonts } from 'expo-font';
import { useEffect, useRef, useState } from 'react';
import { Lora_400Regular, Lora_600SemiBold, Lora_700Bold } from '@expo-google-fonts/lora';
import { Spectral_400Regular, Spectral_500Medium, Spectral_600SemiBold } from '@expo-google-fonts/spectral';
import { supabase } from '@/lib/supabase';
import { GuestProvider, useGuest } from '@/contexts/GuestContext';
import { subscribeToSkillCompletion } from '@/hooks/useSkillSession';
import type { SkillId } from '@/types';
import { BG, W, GOLD, S1, LINE } from '@/theme';

const SKILL_NAMES: Record<SkillId, string> = {
  'stock-researcher': 'Stock Research',
  'etf-analyzer': 'ETF Analysis',
  'portfolio-reviewer': 'Portfolio Review',
  'market-catalyst-scanner': 'Catalyst Scan',
};

function SkillCompletionBanner() {
  const [visible, setVisible] = useState(false);
  const [completedSkill, setCompletedSkill] = useState<SkillId | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToSkillCompletion((skillId) => {
      setCompletedSkill(skillId);
      setVisible(true);
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      dismissTimer.current = setTimeout(dismiss, 8000);
    });
    return () => {
      unsubscribe();
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  function dismiss() {
    Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
      setVisible(false);
    });
  }

  if (!visible || !completedSkill) return null;

  return (
    <Animated.View style={[bannerStyles.banner, { opacity }]}>
      <TouchableOpacity
        style={bannerStyles.content}
        onPress={() => {
          dismiss();
          router.push(`/skill/${completedSkill}`);
        }}
        activeOpacity={0.85}
      >
        <View style={bannerStyles.dot} />
        <Text style={bannerStyles.text}>
          {SKILL_NAMES[completedSkill]} complete — tap to view
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={dismiss} style={bannerStyles.close}>
        <Text style={bannerStyles.closeText}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const bannerStyles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    zIndex: 9999,
    backgroundColor: S1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GOLD,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GOLD,
  },
  text: {
    color: W,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  close: {
    paddingLeft: 12,
    paddingVertical: 2,
  },
  closeText: {
    color: LINE,
    fontSize: 13,
  },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Lora_400Regular,
    Lora_600SemiBold,
    Lora_700Bold,
    Spectral_400Regular,
    Spectral_500Medium,
    Spectral_600SemiBold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: BG }} />;
  }

  return (
    <GuestProvider>
      <RootLayoutInner />
    </GuestProvider>
  );
}

function RootLayoutInner() {
  const { setIsGuest } = useGuest();

  // Clear guest mode on sign-in; handle password recovery deep link
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') setIsGuest(false);
      if (event === 'PASSWORD_RECOVERY') router.push('/reset-password');
    });
    return () => subscription.unsubscribe();
  }, [setIsGuest]);

  return (
    <>
      <StatusBar style="light" />
      <SkillCompletionBanner />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: BG },
          headerTintColor: W,
          headerTitleStyle: { fontWeight: '600', color: W, fontFamily: 'Lora_600SemiBold' },
          headerBackTitle: '',
          contentStyle: { backgroundColor: BG },
        }}
      >
        <Stack.Screen name="(tabs)"         options={{ headerShown: false, title: '' }} />
        <Stack.Screen name="index"          options={{ headerShown: false }} />
        <Stack.Screen name="auth"           options={{ headerShown: false }} />
        <Stack.Screen name="privacy"        options={{ headerShown: true }} />
        <Stack.Screen name="contact"        options={{ headerShown: true }} />
        <Stack.Screen name="conversations"  options={{ headerShown: true }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="welcome"        options={{ headerShown: false }} />
        <Stack.Screen name="onboarding"     options={{ headerShown: false }} />
        <Stack.Screen name="learn/[topic]"    options={{ headerShown: false }} />
        <Stack.Screen name="extended-profile"  options={{ headerShown: false }} />
        <Stack.Screen name="orientation"       options={{ headerShown: false }} />
        <Stack.Screen name="how-it-works"      options={{ headerShown: false }} />
        <Stack.Screen name="saved-research"      options={{ headerShown: true, title: 'Saved Research' }} />
        <Stack.Screen name="research-history"   options={{ headerShown: true, title: 'Session History' }} />
        <Stack.Screen name="skill/[id]"        options={{ headerShown: false, gestureEnabled: true }} />
      </Stack>
    </>
  );
}
