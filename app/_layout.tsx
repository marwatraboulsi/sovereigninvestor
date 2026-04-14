import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useFonts } from 'expo-font';
import { Lora_400Regular, Lora_600SemiBold, Lora_700Bold } from '@expo-google-fonts/lora';
import { Spectral_400Regular, Spectral_500Medium, Spectral_600SemiBold } from '@expo-google-fonts/spectral';
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

  // Hold splash until fonts are ready - avoids font flash
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: BG }} />;
  }

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
        {/* These screens manage their own headers / chrome */}
        <Stack.Screen name="(tabs)"     options={{ headerShown: false, title: '' }} />
        <Stack.Screen name="index"      options={{ headerShown: false }} />
        <Stack.Screen name="auth"       options={{ headerShown: false }} />
        <Stack.Screen name="privacy"       options={{ headerShown: true }} />
        <Stack.Screen name="contact"       options={{ headerShown: true }} />
        <Stack.Screen name="conversations" options={{ headerShown: true }} />
        <Stack.Screen name="welcome"    options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        {/* skill/[id] uses Stack.Screen internally to set its own title */}
      </Stack>
    </>
  );
}
