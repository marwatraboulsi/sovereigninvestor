import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useAnalysisArchive } from '@/hooks/useAnalysisArchive';
import type { SavedAnalysis } from '@/types';
import { useGuest } from '@/contexts/GuestContext';
import { AccountModal } from '@/components/AccountModal';

import { BG, S1, LINE, W, G1, G2, SERIF, BODY } from '@/theme';

const SKILL_ACCENT: Record<string, string> = {
  'etf-analyzer':            '#8B5CF6',
  'portfolio-reviewer':      '#3B82F6',
  'stock-researcher':        '#F59E0B',
  'market-catalyst-scanner': '#10B981',
};

const SKILL_BG: Record<string, string> = {
  'etf-analyzer':            '#181428',
  'portfolio-reviewer':      '#0E1C2A',
  'stock-researcher':        '#251C08',
  'market-catalyst-scanner': '#0A2018',
};

function formatRelativeDate(ts: number): string {
  const diff = Date.now() - ts;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`;
}

function daysUntilExpiry(expiresAt: number): number {
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24)));
}

export default function ArchiveScreen() {
  const { isGuest } = useGuest();
  const [showAccountModal, setShowAccountModal] = useState(false);
  const { analyses, loaded, reload, remove } = useAnalysisArchive();

  // Reload every time the tab is focused (catches saves from other screens)
  useFocusEffect(useCallback(() => { if (!isGuest) reload(); }, [isGuest, reload]));

  const handleDelete = (item: SavedAnalysis) => {
    Alert.alert(
      'Delete slides',
      `Remove "${item.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => remove(item.id),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <AccountModal
        visible={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        title="Save Your Analyses"
        message="Create a free account to save research reports and come back to them for up to 90 days."
      />

      <View style={s.header}>
        <Text style={s.headerTitle}>Archive</Text>
        <Text style={s.headerSub}>Your saved analyses live here. Come back to any report, whenever you need it, for up to 90 days.</Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {isGuest && (
          <View style={s.empty}>
            <Ionicons name="albums-outline" size={40} color={G2} />
            <Text style={s.emptyTitle}>Your analyses will live here</Text>
            <Text style={s.emptyBody}>
              Create an account to save research reports and revisit them for up to 90 days.
            </Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => setShowAccountModal(true)} activeOpacity={0.8}>
              <Text style={s.emptyBtnText}>Create Account</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isGuest && loaded && analyses.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="albums-outline" size={40} color={G2} />
            <Text style={s.emptyTitle}>No saved analyses yet</Text>
            <Text style={s.emptyBody}>
              After running an analysis in Research, tap{' '}
              <Text style={{ color: G1 }}>Save as Slides</Text> to store it here.
            </Text>
          </View>
        )}

        {!isGuest && analyses.map((item) => {
          const accent = SKILL_ACCENT[item.skillId] ?? W;
          const bg     = SKILL_BG[item.skillId]     ?? S1;
          const expiry = daysUntilExpiry(item.expiresAt);

          return (
            <TouchableOpacity
              key={item.id}
              style={s.card}
              onPress={() => router.push(`/slides/${item.id}`)}
              activeOpacity={0.7}
            >
              {/* Skill badge */}
              <View style={[s.skillBadge, { backgroundColor: bg }]}>
                <Text style={[s.skillBadgeText, { color: accent }]}>
                  {item.skillName}
                </Text>
              </View>

              <View style={s.cardBody}>
                <View style={s.cardMain}>
                  <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={s.cardMeta}>
                    {item.slideCount} slides · {formatRelativeDate(item.createdAt)}
                  </Text>
                  <Text style={[s.cardExpiry, expiry <= 14 && s.cardExpiryWarn]}>
                    Expires in {expiry} day{expiry !== 1 ? 's' : ''}
                  </Text>
                </View>

                <View style={s.cardRight}>
                  <TouchableOpacity
                    style={s.deleteBtn}
                    onPress={() => handleDelete(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={16} color={G2} />
                  </TouchableOpacity>
                  <Ionicons name="chevron-forward" size={16} color={G2} style={{ marginTop: 'auto' }} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: BG },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  headerTitle: { fontSize: 28, fontWeight: '700', color: W, letterSpacing: -0.5, fontFamily: SERIF },
  headerSub:   { fontSize: 14, color: G1, marginTop: 4, fontFamily: BODY },

  scroll:  { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 48 },

  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: G1, marginTop: 8 },
  emptyBody:  { fontSize: 14, color: G2, textAlign: 'center', lineHeight: 20, fontFamily: BODY },
  emptyBtn:     { marginTop: 8, backgroundColor: '#c9a84c', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { color: '#0d1f1b', fontSize: 14, fontWeight: '700' },

  card: {
    backgroundColor: S1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    overflow: 'hidden',
  },
  skillBadge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  skillBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },

  cardBody: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  cardMain:  { flex: 1, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: W, lineHeight: 22 },
  cardMeta:  { fontSize: 13, color: G2, marginTop: 2 },
  cardExpiry:     { fontSize: 12, color: G2, marginTop: 4 },
  cardExpiryWarn: { color: '#F87171' },

  cardRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  deleteBtn: { padding: 2 },
});
