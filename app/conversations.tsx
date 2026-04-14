import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  listConversations,
  deleteConversation,
  requestConversationLoad,
  type ConversationSummary,
} from '@/hooks/useConversation';
import { BG, S1, LINE, W, GOLD, G1, G2, SERIF, BODY } from '@/theme';

// ─── Date formatting ──────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const date  = new Date(iso);
  const now   = new Date();
  const diff  = now.getTime() - date.getTime();
  const days  = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (days === 1) return 'Yesterday';
  if (days < 7)   return date.toLocaleDateString([], { weekday: 'long' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function groupByDate(convs: ConversationSummary[]): { label: string; items: ConversationSummary[] }[] {
  const groups: Record<string, ConversationSummary[]> = {};

  for (const c of convs) {
    const date = new Date(c.updatedAt);
    const now  = new Date();
    const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    let label: string;
    if (days === 0)       label = 'Today';
    else if (days === 1)  label = 'Yesterday';
    else if (days < 7)    label = 'This week';
    else if (days < 30)   label = 'This month';
    else                  label = 'Older';

    if (!groups[label]) groups[label] = [];
    groups[label].push(c);
  }

  const order = ['Today', 'Yesterday', 'This week', 'This month', 'Older'];
  return order
    .filter((l) => groups[l]?.length)
    .map((l) => ({ label: l, items: groups[l] }));
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ConversationsScreen() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading]             = useState(true);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    listConversations().then((data) => {
      setConversations(data);
      setLoading(false);
    });
  }, []));

  const handleSelect = (id: string) => {
    requestConversationLoad(id);
    router.back();
  };

  const handleDelete = (conv: ConversationSummary) => {
    Alert.alert(
      'Delete conversation',
      'This will permanently delete this conversation and all its messages.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setConversations((prev) => prev.filter((c) => c.id !== conv.id));
            await deleteConversation(conv.id);
          },
        },
      ],
    );
  };

  const grouped = groupByDate(conversations);

  return (
    <SafeAreaView style={s.safe}>
      <Stack.Screen
        options={{
          title: 'Past Conversations',
          headerStyle: { backgroundColor: BG },
          headerTintColor: W,
          headerShadowVisible: false,
        }}
      />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={G1} size="small" />
        </View>
      ) : conversations.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyText}>No past conversations yet.</Text>
        </View>
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {grouped.map((group) => (
            <View key={group.label} style={s.group}>
              <Text style={s.groupLabel}>{group.label}</Text>
              <View style={s.groupList}>
                {group.items.map((conv, i) => (
                  <TouchableOpacity
                    key={conv.id}
                    style={[s.row, i < group.items.length - 1 && s.rowBorder]}
                    onPress={() => handleSelect(conv.id)}
                    activeOpacity={0.6}
                  >
                    <View style={s.rowContent}>
                      <Text style={s.rowTitle} numberOfLines={1}>
                        {conv.title ?? 'New conversation'}
                      </Text>
                      <Text style={s.rowDate}>{formatDate(conv.updatedAt)}</Text>
                    </View>
                    <TouchableOpacity
                      style={s.deleteBtn}
                      onPress={() => handleDelete(conv)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="trash-outline" size={16} color={G2} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: BG },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: G2, fontSize: 15 },

  scroll:  { flex: 1 },
  content: { padding: 24, paddingBottom: 48, gap: 28 },

  group:     { gap: 10 },
  groupLabel: {
    fontSize: 11, fontWeight: '600', color: G2,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  groupList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  rowBorder:  { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE },
  rowContent: { flex: 1, gap: 3 },
  rowTitle:   { fontSize: 15, color: W, fontFamily: BODY, fontWeight: '500' },
  rowDate:    { fontSize: 12, color: G2, fontFamily: BODY },

  deleteBtn: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
