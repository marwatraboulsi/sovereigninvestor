import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { Lora_400Regular, Lora_600SemiBold, Lora_700Bold } from '@expo-google-fonts/lora';
import { Spectral_400Regular, Spectral_500Medium, Spectral_600SemiBold } from '@expo-google-fonts/spectral';
import { supabase } from '@/lib/supabase';
import { GuestProvider, useGuest } from '@/contexts/GuestContext';
import { BG, W } from '@/theme';

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
      </Stack>
    </>
  );
}
