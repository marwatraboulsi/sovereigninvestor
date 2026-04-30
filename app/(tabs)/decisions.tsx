import { StyleSheet, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BG, G1, W, SERIF, BODY } from '@/theme';

/**
 * Decisions tab — placeholder (Phase 2A)
 * Full Decision Log implementation arrives in Phase 5.
 */
export default function DecisionsScreen() {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}>
        <Text style={s.label}>Decisions</Text>
        <Text style={s.sub}>Coming in Phase 5</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  label:  { fontSize: 22, fontWeight: '700', color: W, letterSpacing: -0.3, fontFamily: SERIF },
  sub:    { fontSize: 14, color: G1, fontFamily: BODY },
});
