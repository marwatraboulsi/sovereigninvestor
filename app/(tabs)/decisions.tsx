/**
 * Decisions Tab — Phase 5B
 *
 * Full behavioral record: every Intercept session logged.
 *
 * · Summary strip when ≥3 logs exist
 * · Decision cards: ticker, decision type, triggers, verdict, outcome
 * · Guest state (AccountModal)
 * · Empty state
 * · Tap → /decision/[id] detail screen
 */

import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { useDecisionLog } from '@/hooks/useDecisionLog';
import { snapshotOutcomes } from '@/utils/snapshotOutcomes';
import { useGuest } from '@/contexts/GuestContext';
import { AccountModal } from '@/components/AccountModal';
import type { DecisionLog, DecisionTrigger, DecisionType, VerdictType } from '@/types';

import { BG, S1, S2, LINE, W, GOLD, G1, G2, SERIF, BODY } from '@/theme';

// ─── Label maps ───────────────────────────────────────────────────────────────

const TRIGGER_LABEL: Record<DecisionTrigger, string> = {
  'recent-performance': 'Recent performance',
  'social-comparison':  'Social comparison',
  'price-rise-fomo':    'FOMO',
  'overconfidence':     'Overconfidence',
  'news-reaction':      'News reaction',
  'price-drop-fear':    'Price-drop fear',
  'regret-avoidance':   'Regret avoidance',
  'boredom':            'Boredom',
  'unsure':             'Unclear feeling',
};

const DECISION_LABEL: Record<DecisionType, string> = {
  buy:   'Buy',
  sell:  'Sell',
  hold:  'Hold',
  wait:  'Wait',
  unsure:'Unsure',
};

// Badge colours per decision type
const DT_BADGE: Record<DecisionType, { bg: string; text: string }> = {
  buy:   { bg: '#0A2018', text: '#34D399' },
  sell:  { bg: '#280D0D', text: '#F87171' },
  hold:  { bg: '#0E1C2A', text: '#60A5FA' },
  wait:  { bg: '#0E1C2A', text: '#60A5FA' },
  unsure:{ bg: '#1E1A0E', text: '#FCD34D' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeDate(ts: number): string {
  const diff = Date.now() - ts;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function daysSince(ts: number): number {
  return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
}

function mostCommonTrigger(logs: DecisionLog[]): DecisionTrigger | null {
  const counts: Partial<Record<DecisionTrigger, number>> = {};
  for (const log of logs) {
    for (const t of log.emotionalTriggers) {
      counts[t] = (counts[t] ?? 0) + 1;
    }
  }
  let best: DecisionTrigger | null = null;
  let bestCount = 0;
  for (const [t, c] of Object.entries(counts) as [DecisionTrigger, number][]) {
    if (c > bestCount) { best = t; bestCount = c; }
  }
  return best;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DecisionsScreen() {
  const { isGuest } = useGuest();
  const [showAccountModal, setShowAccountModal] = useState(false);
  const { logs, loaded, reload, getPlaybookValidated } = useDecisionLog();
  const [validatedCount, setValidatedCount] = useState(0);
  const [with30d,        setWith30d]        = useState(0);

  useFocusEffect(useCallback(() => {
    if (isGuest) { setShowAccountModal(true); return; }
    reload();
  }, [isGuest, reload]));

  // ── Part B: snapshot milestones whenever log list is fresh ─────────────────
  // ── Part D: compute "Playbook validated" count ─────────────────────────────
  useEffect(() => {
    if (!loaded || logs.length === 0) return;
    snapshotOutcomes(logs); // fire-and-forget; idempotent
    getPlaybookValidated(logs).then(({ validatedCount: vc, with30d: w }) => {
      setValidatedCount(vc);
      setWith30d(w);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, logs.length]);

  // ── Guest state ────────────────────────────────────────────────────────────
  if (isGuest) {
    return (
      <SafeAreaView style={s.safe}>
        <AccountModal
          visible={showAccountModal}
          onClose={() => setShowAccountModal(false)}
          title="Your Decision Log"
          message="Create a free account to log every Intercept session and track your behavioral patterns over time."
        />
        <View style={s.header}>
          <Text style={s.headerTitle}>Decisions</Text>
          <Text style={s.headerSub}>Every intercept session, logged.</Text>
        </View>
        <View style={s.emptyWrap}>
          <Ionicons name="journal-outline" size={40} color={G2} />
          <Text style={s.emptyTitle}>Your decision record lives here</Text>
          <Text style={s.emptyBody}>
            Create an account to start logging Intercept sessions and track your behavioral patterns.
          </Text>
          <TouchableOpacity
            style={s.emptyBtn}
            onPress={() => setShowAccountModal(true)}
            activeOpacity={0.8}
          >
            <Text style={s.emptyBtnText}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Stats for summary strip ────────────────────────────────────────────────
  const totalSessions   = logs.length;
  const followedCount   = logs.filter((l) => l.verdict === 'follow-playbook').length;
  const topTrigger      = mostCommonTrigger(logs);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Decisions</Text>
        <Text style={s.headerSub}>Every intercept session, logged.</Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Summary strip (≥3 logs) ── */}
        {loaded && totalSessions >= 3 && (
          <View style={s.summaryStrip}>
            <View style={s.summaryStat}>
              <Text style={s.summaryValue}>{totalSessions}</Text>
              <Text style={s.summaryLabel}>Sessions</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryStat}>
              <Text style={s.summaryValue}>{followedCount}</Text>
              <Text style={s.summaryLabel}>Followed playbook</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryStat}>
              <Text style={s.summaryValue} numberOfLines={1}>
                {topTrigger ? TRIGGER_LABEL[topTrigger].split(' ')[0] : '—'}
              </Text>
              <Text style={s.summaryLabel}>Top trigger</Text>
            </View>
            {/* 4th stat: only when ≥3 decisions have a 30-day snapshot */}
            {with30d >= 3 && (
              <>
                <View style={s.summaryDivider} />
                <View style={s.summaryStat}>
                  <Text style={s.summaryValue}>{validatedCount}</Text>
                  <Text style={s.summaryLabel}>Playbook{'\n'}validated</Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* ── Empty state ── */}
        {loaded && logs.length === 0 && (
          <View style={s.emptyWrap}>
            <Ionicons name="journal-outline" size={40} color={G2} />
            <Text style={s.emptyTitle}>No decisions logged yet</Text>
            <Text style={s.emptyBody}>
              Run your first Intercept session to start your record.
            </Text>
            <TouchableOpacity
              style={s.emptyBtn}
              onPress={() => router.push('/(tabs)/intercept')}
              activeOpacity={0.8}
            >
              <Text style={s.emptyBtnText}>Start an Intercept</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Decision cards ── */}
        {logs.map((log) => (
          <DecisionCard
            key={log.id}
            log={log}
            onPress={() => router.push(`/decision/${log.id}`)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Decision card ────────────────────────────────────────────────────────────

function DecisionCard({
  log,
  onPress,
}: {
  log:     DecisionLog;
  onPress: () => void;
}) {
  const dtBadge    = DT_BADGE[log.decisionType] ?? DT_BADGE.unsure;
  const days       = daysSince(log.createdAt);
  const triggerStr = log.emotionalTriggers
    .map((t) => TRIGGER_LABEL[t] ?? t)
    .join(', ');

  const verdictFollowed = log.verdict === 'follow-playbook';
  const verdictLabel    =
    log.verdict === 'follow-playbook'  ? 'Followed playbook' :
    log.verdict === 'conscious-proceed'? 'Overrode'          :
                                         'Proceeded (no rule)';

  return (
    <TouchableOpacity
      style={s.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Top row: ticker + decision badge + date */}
      <View style={s.cardTop}>
        <View style={s.cardTopLeft}>
          <View style={s.cardTickerRow}>
            <Text style={s.cardTicker}>{log.ticker}</Text>
            <View style={[s.dtBadge, { backgroundColor: dtBadge.bg }]}>
              <Text style={[s.dtBadgeText, { color: dtBadge.text }]}>
                {DECISION_LABEL[log.decisionType]}
              </Text>
            </View>
          </View>
          <Text style={s.cardAssetName} numberOfLines={1}>{log.assetName}</Text>
        </View>
        <Text style={s.cardDate}>{formatRelativeDate(log.createdAt)}</Text>
      </View>

      {/* Triggers */}
      {triggerStr.length > 0 && (
        <Text style={s.cardTriggers} numberOfLines={2}>{triggerStr}</Text>
      )}

      {/* Verdict row */}
      <View style={s.cardVerdictRow}>
        <View style={[s.verdictDot, verdictFollowed ? s.verdictDotGreen : s.verdictDotAmber]} />
        <Text style={[s.verdictText, verdictFollowed ? s.verdictTextGreen : s.verdictTextAmber]}>
          {verdictLabel}
        </Text>
        {log.priceAtDecision > 0 && (
          <Text style={s.priceAtDecision}>
            {' '}· {log.currency} {log.priceAtDecision.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        )}
      </View>

      {/* Outcome strip — shows tracking status; Phase 5 has only day-0 snapshots */}
      <View style={s.cardOutcomeRow}>
        <Ionicons name="time-outline" size={12} color={G2} />
        <Text style={s.trackingLabel}>
          Tracking · {days === 0 ? 'logged today' : `${days} day${days !== 1 ? 's' : ''} since decision`}
        </Text>
        <Ionicons name="chevron-forward" size={14} color={G2} style={{ marginLeft: 'auto' }} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: BG },

  header: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  headerTitle: { fontSize: 28, fontWeight: '700', color: W, letterSpacing: -0.5, fontFamily: SERIF },
  headerSub:   { fontSize: 14, color: G1, marginTop: 4, fontFamily: BODY, lineHeight: 20 },

  scroll:  { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 48 },

  // ── Summary strip ──────────────────────────────────────────────────────────
  summaryStrip: {
    flexDirection: 'row',
    backgroundColor: S1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    paddingVertical: 16,
  },
  summaryStat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
    color: W,
    fontFamily: SERIF,
    letterSpacing: -0.3,
  },
  summaryLabel: { fontSize: 11, color: G2, fontFamily: BODY, textAlign: 'center' },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: LINE,
    alignSelf: 'stretch',
    marginVertical: 4,
  },

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 64,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: G1, marginTop: 8, textAlign: 'center' },
  emptyBody:  { fontSize: 14, color: G2, textAlign: 'center', lineHeight: 20, fontFamily: BODY },
  emptyBtn:   {
    marginTop: 8,
    backgroundColor: GOLD,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnText: { color: BG, fontSize: 14, fontWeight: '700' },

  // ── Decision card ──────────────────────────────────────────────────────────
  card: {
    backgroundColor: S1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 16,
    gap: 10,
  },

  cardTop:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardTopLeft:  { flex: 1, gap: 3, marginRight: 12 },
  cardTickerRow:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTicker:   { fontSize: 18, fontWeight: '700', color: W, fontFamily: SERIF },
  cardAssetName:{ fontSize: 13, color: G1, fontFamily: BODY },
  cardDate:     { fontSize: 12, color: G2, flexShrink: 0 },

  dtBadge:     {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dtBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

  cardTriggers: { fontSize: 13, color: G2, fontFamily: BODY, lineHeight: 18 },

  cardVerdictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  verdictDot:       { width: 7, height: 7, borderRadius: 4 },
  verdictDotGreen:  { backgroundColor: '#34D399' },
  verdictDotAmber:  { backgroundColor: '#F59E0B' },
  verdictText:      { fontSize: 13, fontWeight: '600' },
  verdictTextGreen: { color: '#34D399' },
  verdictTextAmber: { color: '#F59E0B' },
  priceAtDecision:  { fontSize: 13, color: G2 },

  cardOutcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
  },
  trackingLabel: { fontSize: 12, color: G2, fontFamily: BODY },
});
