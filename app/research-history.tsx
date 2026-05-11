import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState, useCallback, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useResearchHistory, ResearchHistoryEntry } from '@/hooks/useResearchHistory';
import { MessageBubble } from '@/components/MessageBubble';
import { ScrollThumb } from '@/components/ScrollThumb';
import { BG, S1, S2, W, G1, G2, G3, GOLD, LINE } from '@/theme';
import type { SkillId } from '@/types';

// ─── Skill display config ─────────────────────────────────────────────────────

const SKILL_LABEL: Record<SkillId, string> = {
  'stock-researcher':        'Stock Research',
  'etf-analyzer':            'ETF Analysis',
  'portfolio-reviewer':      'Portfolio Review',
  'market-catalyst-scanner': 'Catalyst Scan',
};

const SKILL_ICON: Record<SkillId, string> = {
  'stock-researcher':        'bar-chart-outline',
  'etf-analyzer':            'pie-chart-outline',
  'portfolio-reviewer':      'wallet-outline',
  'market-catalyst-scanner': 'flash-outline',
};

const SKILL_COLOR: Record<SkillId, string> = {
  'stock-researcher':        '#F59E0B',
  'etf-analyzer':            '#8B5CF6',
  'portfolio-reviewer':      '#3B82F6',
  'market-catalyst-scanner': '#10B981',
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ResearchHistoryScreen() {
  const { skillId: skillIdParam } = useLocalSearchParams<{ skillId?: string }>();
  const filterSkillId = (skillIdParam && skillIdParam in SKILL_LABEL) ? skillIdParam as SkillId : undefined;
  const { entries, loading, deleteEntry, clearAll } = useResearchHistory(filterSkillId);
  const [selected, setSelected] = useState<ResearchHistoryEntry | null>(null);

  // Scroll thumb state for detail view
  const detailScrollRef   = useRef<ScrollView>(null);
  const [detailScrollY,        setDetailScrollY]        = useState(0);
  const [detailContentHeight,  setDetailContentHeight]  = useState(0);
  const [detailViewportHeight, setDetailViewportHeight] = useState(0);

  const handleDelete = useCallback((entry: ResearchHistoryEntry) => {
    Alert.alert(
      'Delete session',
      `Remove "${entry.title}" from history?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteEntry(entry.id);
            if (selected?.id === entry.id) setSelected(null);
          },
        },
      ],
    );
  }, [deleteEntry, selected]);

  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Clear all history',
      'Remove all sessions? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear all', style: 'destructive', onPress: () => { clearAll(); setSelected(null); } },
      ],
    );
  }, [clearAll]);

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selected) {
    const accent = SKILL_COLOR[selected.skillId] ?? GOLD;
    return (
      <SafeAreaView style={s.safe}>
        <Stack.Screen
          options={{
            title: selected.title,
            headerStyle: { backgroundColor: BG },
            headerTintColor: W,
            headerShadowVisible: false,
            headerLeft: () => (
              <TouchableOpacity onPress={() => setSelected(null)} style={s.headerBtn}>
                <Ionicons name="arrow-back" size={20} color={W} />
              </TouchableOpacity>
            ),
            headerRight: () => (
              <TouchableOpacity onPress={() => handleDelete(selected)} style={s.headerBtn}>
                <Ionicons name="trash-outline" size={18} color={G2} />
              </TouchableOpacity>
            ),
          }}
        />
        <View style={s.chatContainer}>
        <ScrollView
          ref={detailScrollRef}
          style={s.chatScroll}
          contentContainerStyle={s.chatContent}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(e) => {
            const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
            setDetailScrollY(contentOffset.y);
            setDetailContentHeight(contentSize.height);
            setDetailViewportHeight(layoutMeasurement.height);
          }}
        >
          <View style={s.sessionMeta}>
            <Text style={s.sessionMetaTitle}>{selected.subtitle || selected.title}</Text>
            <Text style={s.sessionMetaDate}>{formatDate(selected.date)}</Text>
            <View style={s.badgeRow}>
              <View style={[s.skillBadge, { backgroundColor: accent + '22', borderColor: accent + '44' }]}>
                <Text style={[s.skillBadgeText, { color: accent }]}>
                  {SKILL_LABEL[selected.skillId]}
                </Text>
              </View>
              {(selected.skillId === 'stock-researcher' || selected.isComparison) && (
                <View style={s.depthBadge}>
                  <Text style={s.depthBadgeText}>
                    {selected.isComparison ? 'Comparison · ' : ''}
                    {selected.depth === 'quick' ? 'Quick Scan' : 'Standard'}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {selected.messages
            .filter((m) => !(m.role === 'assistant' && m.content.includes('<<PICK:')))
            .map((msg, i) => (
              <MessageBubble key={i} role={msg.role} content={msg.content} />
            ))}

          <View style={{ height: 40 }} />
        </ScrollView>
        <ScrollThumb
          scrollRef={detailScrollRef}
          contentHeight={detailContentHeight}
          viewportHeight={detailViewportHeight}
          scrollY={detailScrollY}
        />
        </View>
      </SafeAreaView>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <Stack.Screen
        options={{
          title: filterSkillId ? SKILL_LABEL[filterSkillId] + ' History' : 'Session History',
          headerStyle: { backgroundColor: BG },
          headerTintColor: W,
          headerShadowVisible: false,
          headerRight: entries.length > 0
            ? () => (
                <TouchableOpacity onPress={handleClearAll} style={s.headerBtn}>
                  <Text style={s.clearAllText}>Clear all</Text>
                </TouchableOpacity>
              )
            : undefined,
        }}
      />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={GOLD} />
        </View>
      ) : entries.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="time-outline" size={40} color={G3} />
          <Text style={s.emptyTitle}>No sessions yet</Text>
          <Text style={s.emptyBody}>
            {filterSkillId
              ? `Completed ${SKILL_LABEL[filterSkillId]} sessions will appear here automatically.`
              : 'Completed sessions from any skill will appear here automatically.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.id}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const accent = SKILL_COLOR[item.skillId] ?? GOLD;
            const icon = item.isComparison ? 'git-compare-outline' : SKILL_ICON[item.skillId] ?? 'document-outline';
            return (
              <TouchableOpacity style={s.row} onPress={() => setSelected(item)} activeOpacity={0.7}>
                <View style={s.rowLeft}>
                  <View style={[s.rowIconWrap, { backgroundColor: accent + '18' }]}>
                    <Ionicons name={icon as any} size={18} color={accent} />
                  </View>
                  <View style={s.rowText}>
                    <Text style={s.rowTitle}>{item.title}</Text>
                    {!!item.subtitle && (
                      <Text style={s.rowSub} numberOfLines={1}>{item.subtitle}</Text>
                    )}
                    <Text style={s.rowMeta}>
                      {SKILL_LABEL[item.skillId]} · {formatDate(item.date)}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={G3} />
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={s.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (isToday) return `Today ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  if (isYesterday) return `Yesterday ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: BG },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  headerBtn:    { paddingHorizontal: 4, paddingVertical: 4 },
  clearAllText: { color: G2, fontSize: 14 },

  emptyTitle: { color: W, fontSize: 17, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  emptyBody:  { color: G2, fontSize: 14, lineHeight: 21, textAlign: 'center' },

  listContent: { paddingVertical: 8 },
  separator:   { height: 1, backgroundColor: LINE, marginLeft: 72 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: BG,
  },
  rowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText:  { flex: 1 },
  rowTitle: { color: W, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  rowSub:   { color: G1, fontSize: 13, marginBottom: 3 },
  rowMeta:  { color: G2, fontSize: 12 },

  // Detail view
  chatContainer: { flex: 1 },
  chatScroll:  { flex: 1 },
  chatContent: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  sessionMeta: {
    backgroundColor: S1,
    borderRadius: 10,
    padding: 16,
    marginBottom: 8,
    gap: 6,
  },
  sessionMetaTitle: { color: W, fontSize: 17, fontWeight: '700' },
  sessionMetaDate:  { color: G2, fontSize: 13 },
  badgeRow:         { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 2 },
  skillBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  skillBadgeText: { fontSize: 11, fontWeight: '600' },
  depthBadge: {
    alignSelf: 'flex-start',
    backgroundColor: S2,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  depthBadgeText: { color: GOLD, fontSize: 11, fontWeight: '600' },
});
