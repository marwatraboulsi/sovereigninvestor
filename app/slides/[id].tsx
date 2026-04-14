import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack } from 'expo-router';
import { getAnalysisById } from '@/hooks/useAnalysisArchive';
import { SlideViewer } from '@/components/SlideViewer';
import type { SavedAnalysis } from '@/types';

import { BG, W, G2 } from '@/theme';

export default function SlidesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [analysis, setAnalysis] = useState<SavedAnalysis | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return; }
    getAnalysisById(id).then((result) => {
      if (result) setAnalysis(result);
      else        setNotFound(true);
      setLoading(false);
    });
  }, [id]);

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: analysis?.title ?? 'Slides',
          headerStyle: { backgroundColor: BG },
          headerTintColor: W,
          headerShadowVisible: false,
        }}
      />

      {loading && (
        <View style={s.center}>
          <ActivityIndicator color={G2} />
        </View>
      )}

      {notFound && !loading && (
        <View style={s.center}>
          <Text style={s.notFound}>Slides not found or expired.</Text>
        </View>
      )}

      {analysis && !loading && (
        <SlideViewer slides={analysis.slides} skillId={analysis.skillId} />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: BG },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { color: G2, fontSize: 15 },
});
