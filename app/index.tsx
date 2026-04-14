import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useUserProfile } from '@/hooks/useUserProfile';
import { BG } from '@/theme';

export default function IndexScreen() {
  const { profile, loading } = useUserProfile();

  useEffect(() => {
    if (loading) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/auth');
      } else if (profile?.onboardingComplete) {
        router.replace('/(tabs)/chat');
      } else {
        router.replace('/welcome');
      }
    });
  }, [loading, profile]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={BG} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
