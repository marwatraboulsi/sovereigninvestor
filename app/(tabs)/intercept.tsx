import { StyleSheet, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BG, GOLD, G1, SERIF, BODY } from '@/theme';

/**
 * Intercept tab — placeholder (Phase 2A)
 * Full 4-step wizard implementation arrives in Phase 4.
 */
export default function InterceptScreen() {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}>
        <Text style={s.label}>INTERCEPT</Text>
        <Text style={s.sub}>Coming in Phase 4</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { fontSize: 22, fontWeight: '700', color: GOLD, letterSpacing: 1, fontFamily: SERIF },
  sub:   { fontSize: 14, color: G1, fontFamily: BODY },
});
