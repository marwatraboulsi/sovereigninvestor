/**
 * Learn Mode redirect — Phase 3
 *
 * The dedicated Learn Mode screen is retired. All learn sessions now live
 * inside the Nora (Chat) tab via the Chat/Learn mode toggle.
 *
 * This file redirects any existing deep-links (e.g. from intercept.tsx or
 * external sources) to the chat tab with the topic pre-loaded.
 */

import { useEffect } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

export default function LearnModeRedirect() {
  const { topic } = useLocalSearchParams<{ topic: string }>();

  useEffect(() => {
    router.replace({
      pathname: '/(tabs)/chat',
      params: { mode: 'learn', learnTopic: topic ?? '' },
    });
  }, []);

  return <View />;
}
