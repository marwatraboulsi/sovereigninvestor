/**
 * Decision Detail Screen — Phase 5C
 *
 * Full session recap for a single decision log entry.
 *
 * Sections:
 *   · Header   — ticker, asset name, date, decision type badge
 *   · Feelings — emotional triggers identified
 *   · Playbook — rules that matched (full text) or "no rule matched"
 *   · Decision — verdict, override reason, trade executed flag
 *   · Outcome  — price at decision vs current live price, P&L
 *
 * Live price is fetched via useLivePrices so the outcome is always fresh.
 * Counterfactual language adapts to verdict + actual P&L direction.
 */

import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { useDecisionLog } from '@/hooks/useDecisionLog';
import { useLivePrices } from '@/hooks/useLivePrices';
import { usePlaybook } from '@/hooks/usePlaybook';
import type { DecisionLog, DecisionTrigger, DecisionType, VerdictType } from '@/types';

import { BG, S1, S2, LINE, W, GOLD, G1, G2, SERIF, BODY } from '@/theme';

// ─── Label maps ───────────────────────────────────────────────────────────────

const TRIGGER_LABEL: Record<DecisionTrigger, string> = {
  'recent-performance': 'Strong recent price performance',
  'social-comparison':  'Social comparison / others profiting',
  'price-rise-fomo':    'Fear of missing out (FOMO)',
  'overconfidence':     'Overconfidence',
  'news-reaction':      'News reaction',
  'price-drop-fear':    'Fear from a price drop',
  'regret-avoidance':   'Regret avoidance',
  'boredom':            'Boredom',
  'unsure':             'Unclear — something just felt off',
};

const DECISION_LABEL: Record<DecisionType, string> = {
  buy:    'Buy',
  sell:   'Sell',
  hold:   'Hold',
  wait:   'Wait',
  unsure: 'Unsure',
};

const DT_BADGE: Record<DecisionType, { bg: string; text: string }> = {
  buy:   { bg: '#0A2018', text: '#34D399' },
  sell:  { bg: '#280D0D', text: '#F87171' },
  hold:  { bg: '#0E1C2A', text: '#60A5FA' },
  wait:  { bg: '#0E1C2A', text: '#60A5FA' },
  unsure:{ bg: '#1E1A0E', text: '#FCD34D' },
};

const CATEGORY_LABEL: Record<string, string> = {
  'timing':               'Timing',
  'position-sizing':      'Position sizing',
  'emotional-discipline': 'Emotional discipline',
  'new-asset-class':      'New asset class',
  'life-events':          'Life events',
  'tax-awareness':        'Tax awareness',
  'portfolio-structure':  'Portfolio structure',
  'information-discipline': 'Information discipline',
  'monitoring':           'Monitoring',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function pnlSign(n: number): string { return n >= 0 ? '+' : ''; }

/**
 * Generates counterfactual or direct outcome language depending on verdict
 * and whether the price went up or down since the decision.
 */
function outcomeNarrative(
  log: DecisionLog,
  currentPrice: number,
): string {
  const pnlPct      = ((currentPrice - log.priceAtDecision) / log.priceAtDecision) * 100;
  const priceUp     = currentPrice >= log.priceAtDecision;

  if (log.verdict === 'follow-playbook') {
    // User followed the playbook (did NOT make the trade)
    if (log.decisionType === 'sell') {
      // Held instead of selling
      return priceUp
        ? `By not selling, you held through a ${fmt(pnlPct, 1)}% gain. Your playbook was right.`
        : `The price fell ${fmt(Math.abs(pnlPct), 1)}% after your decision. You avoided further loss by selling — or held through a dip, depending on your view.`;
    }
    if (log.decisionType === 'buy') {
      // Didn't buy
      return priceUp
        ? `The price rose ${fmt(pnlPct, 1)}% since you paused. If you'd bought, that would have been a gain — but the playbook kept you disciplined.`
        : `The price fell ${fmt(Math.abs(pnlPct), 1)}% since you paused. Your playbook saved you from that loss.`;
    }
  }

  if (log.verdict === 'conscious-proceed' || log.verdict === 'no-rules-matched') {
    // User made the trade
    if (log.tradeExecuted === false) {
      return `You chose to proceed but didn't execute the trade. Price has moved ${pnlSign(currentPrice - log.priceAtDecision)}${fmt(pnlPct, 1)}% since then.`;
    }
    return priceUp
      ? `Price is up ${fmt(pnlPct, 1)}% since your decision. The override worked out — this time.`
      : `Price is down ${fmt(Math.abs(pnlPct), 1)}% since your decision. This is worth reflecting on.`;
  }

  return `Price has moved ${pnlSign(currentPrice - log.priceAtDecision)}${fmt(pnlPct, 1)}% since your decision.`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DecisionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { logs } = useDecisionLog();
  const { rules } = usePlaybook();

  const log = logs.find((l) => l.id === id) ?? null;

  // Live price for outcome section
  const priceItems = useMemo(
    () => (log ? [{ ticker: log.ticker }] : []),
    [log?.ticker],
  );
  const { prices, currencies, loading: priceLoading } =
    useLivePrices(priceItems, !!log);

  if (!log) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.notFoundWrap}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.6}>
            <Ionicons name="chevron-back" size={22} color={W} />
          </TouchableOpacity>
          <View style={s.notFoundCenter}>
            <Text style={s.notFoundText}>Decision not found.</Text>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={s.notFoundBack}>← Go back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const livePrice   = prices[log.ticker] ?? null;
  const currency    = currencies[log.ticker] ?? log.currency;
  const dtBadge     = DT_BADGE[log.decisionType] ?? DT_BADGE.unsure;
  const pnl         = livePrice ? livePrice - log.priceAtDecision : null;
  const pnlPct      = pnl !== null && log.priceAtDecision > 0
    ? (pnl / log.priceAtDecision) * 100
    : null;

  // Resolve matched rule objects from the playbook (rules might be loaded)
  const matchedRules = rules.filter((r) => log.rulesMatched.includes(r.id));

  const verdictFollowed = log.verdict === 'follow-playbook';
  const verdictLabel =
    log.verdict === 'follow-playbook'   ? 'Followed playbook'  :
    log.verdict === 'conscious-proceed' ? 'Overrode playbook'  :
                                          'Proceeded (no rule)';

  return (
    <SafeAreaView style={s.safe}>
      {/* ── Navigation header ── */}
      <View style={s.navHeader}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.6}>
          <Ionicons name="chevron-back" size={22} color={W} />
        </TouchableOpacity>
        <Text style={s.navTitle}>Decision</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero header ── */}
        <View style={s.heroCard}>
          <View style={s.heroTop}>
            <View style={s.heroLeft}>
              <Text style={s.heroTicker}>{log.ticker}</Text>
              <Text style={s.heroAsset} numberOfLines={1}>{log.assetName}</Text>
            </View>
            <View style={[s.dtBadge, { backgroundColor: dtBadge.bg }]}>
              <Text style={[s.dtBadgeText, { color: dtBadge.text }]}>
                {DECISION_LABEL[log.decisionType]}
              </Text>
            </View>
          </View>
          <Text style={s.heroDate}>{formatDate(log.createdAt)}</Text>

          {/* Verdict pill */}
          <View style={s.heroVerdict}>
            <View style={[s.verdictDot, verdictFollowed ? s.dotGreen : s.dotAmber]} />
            <Text style={[s.verdictLabel, verdictFollowed ? s.verdictGreen : s.verdictAmber]}>
              {verdictLabel}
            </Text>
          </View>
        </View>

        {/* ── What you were feeling ── */}
        <Section title="What you were feeling">
          {log.emotionalTriggers.length === 0 ? (
            <Text style={s.bodyText}>No triggers recorded.</Text>
          ) : (
            log.emotionalTriggers.map((t) => (
              <View key={t} style={s.triggerRow}>
                <View style={s.triggerBullet} />
                <Text style={s.triggerText}>{TRIGGER_LABEL[t] ?? t}</Text>
              </View>
            ))
          )}
        </Section>

        {/* ── Your playbook said ── */}
        <Section title="Your playbook said">
          {matchedRules.length === 0 && log.rulesMatched.length === 0 ? (
            <View style={s.noRuleNote}>
              <Ionicons name="alert-circle-outline" size={18} color={GOLD} />
              <Text style={s.noRuleText}>
                No playbook rule existed for this combination at the time.
              </Text>
            </View>
          ) : matchedRules.length > 0 ? (
            matchedRules.map((rule) => (
              <View key={rule.id} style={s.ruleCard}>
                <View style={s.ruleAccent} />
                <View style={s.ruleBody}>
                  <Text style={s.ruleCat}>{CATEGORY_LABEL[rule.category] ?? rule.category}</Text>
                  <Text style={s.ruleTitle}>{rule.title}</Text>
                  <Text style={s.ruleText}>{rule.body}</Text>
                </View>
              </View>
            ))
          ) : (
            // Rules were matched but no longer exist (deleted/removed since)
            <Text style={s.bodyText}>
              {log.rulesMatched.length} rule{log.rulesMatched.length !== 1 ? 's' : ''} fired — rules may have been removed since.
            </Text>
          )}
        </Section>

        {/* ── What you decided ── */}
        <Section title="What you decided">
          <View style={s.decidedRow}>
            <View style={[s.verdictDot, verdictFollowed ? s.dotGreen : s.dotAmber]} />
            <Text style={[s.verdictLabel, verdictFollowed ? s.verdictGreen : s.verdictAmber, { fontSize: 15 }]}>
              {verdictLabel}
            </Text>
          </View>

          {log.overrideReason ? (
            <View style={s.reasonCard}>
              <Text style={s.reasonLabel}>Your reasoned case</Text>
              <Text style={s.reasonText}>{log.overrideReason}</Text>
            </View>
          ) : null}

          {log.tradeExecuted !== undefined && (
            <Text style={s.tradeText}>
              Trade executed:{' '}
              <Text style={s.tradeValue}>
                {log.tradeExecuted === true ? 'Yes' : log.tradeExecuted === false ? 'No' : 'Not yet'}
              </Text>
            </Text>
          )}
        </Section>

        {/* ── Outcome ── */}
        <Section title="Outcome">
          {log.priceAtDecision > 0 ? (
            <>
              <View style={s.priceRow}>
                <View style={s.priceStat}>
                  <Text style={s.priceStatLabel}>At decision</Text>
                  <Text style={s.priceStatValue}>
                    {log.currency} {fmt(log.priceAtDecision)}
                  </Text>
                </View>
                <Ionicons name="arrow-forward" size={16} color={G2} style={{ marginTop: 18 }} />
                <View style={s.priceStat}>
                  <Text style={s.priceStatLabel}>Current price</Text>
                  {priceLoading ? (
                    <ActivityIndicator size="small" color={GOLD} />
                  ) : livePrice ? (
                    <Text style={s.priceStatValue}>{currency} {fmt(livePrice)}</Text>
                  ) : (
                    <Text style={[s.priceStatValue, { color: G2 }]}>—</Text>
                  )}
                </View>
              </View>

              {/* P&L bar */}
              {livePrice && pnl !== null && pnlPct !== null && (
                <>
                  <View style={[s.pnlRow, pnl >= 0 ? s.pnlRowPos : s.pnlRowNeg]}>
                    <Ionicons
                      name={pnl >= 0 ? 'trending-up' : 'trending-down'}
                      size={16}
                      color={pnl >= 0 ? '#34D399' : '#F87171'}
                    />
                    <Text style={[s.pnlText, pnl >= 0 ? s.pnlPos : s.pnlNeg]}>
                      {pnlSign(pnl)}{fmt(pnl)} ({pnlSign(pnlPct)}{fmt(pnlPct, 1)}%)
                    </Text>
                    <Text style={s.pnlSince}>since decision</Text>
                  </View>

                  {/* Narrative */}
                  <Text style={s.narrativeText}>
                    {outcomeNarrative(log, livePrice)}
                  </Text>
                </>
              )}

              {!livePrice && !priceLoading && (
                <View style={s.trackingNote}>
                  <Ionicons name="time-outline" size={14} color={G2} />
                  <Text style={s.trackingText}>Live price unavailable. Outcome tracking continues.</Text>
                </View>
              )}
            </>
          ) : (
            <Text style={s.bodyText}>No price was recorded at decision time.</Text>
          )}
        </Section>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.sectionBody}>{children}</View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  content:{ padding: 20, gap: 24, paddingBottom: 48 },

  // ── Nav header ────────────────────────────────────────────────────────────
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  backBtn:  { width: 40, alignItems: 'center', padding: 4 },
  navTitle: { fontSize: 17, fontWeight: '600', color: W },

  // ── Not found ─────────────────────────────────────────────────────────────
  notFoundWrap:   { flex: 1 },
  notFoundCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFoundText:   { fontSize: 16, color: G1 },
  notFoundBack:   { fontSize: 14, color: GOLD },

  // ── Hero card ─────────────────────────────────────────────────────────────
  heroCard: {
    backgroundColor: S1,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 20,
    gap: 10,
  },
  heroTop:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroLeft:  { gap: 3, flex: 1, marginRight: 12 },
  heroTicker:{ fontSize: 26, fontWeight: '700', color: W, fontFamily: SERIF, letterSpacing: -0.4 },
  heroAsset: { fontSize: 14, color: G1, fontFamily: BODY },
  heroDate:  { fontSize: 13, color: G2 },

  dtBadge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  dtBadgeText:{ fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },

  heroVerdict: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  verdictDot:  { width: 8, height: 8, borderRadius: 4 },
  dotGreen:    { backgroundColor: '#34D399' },
  dotAmber:    { backgroundColor: '#F59E0B' },
  verdictLabel:{ fontSize: 13, fontWeight: '600' },
  verdictGreen:{ color: '#34D399' },
  verdictAmber:{ color: '#F59E0B' },

  // ── Section ───────────────────────────────────────────────────────────────
  section: { gap: 12 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: G2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionBody: { gap: 8 },
  bodyText:    { fontSize: 14, color: G1, fontFamily: BODY, lineHeight: 20 },

  // ── Triggers ──────────────────────────────────────────────────────────────
  triggerRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  triggerBullet:{ width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD, marginTop: 7, flexShrink: 0 },
  triggerText:  { flex: 1, fontSize: 14, color: G1, fontFamily: BODY, lineHeight: 20 },

  // ── Rules ─────────────────────────────────────────────────────────────────
  noRuleNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: S1,
    borderRadius: 10,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  noRuleText: { flex: 1, fontSize: 13, color: G1, fontFamily: BODY, lineHeight: 19 },

  ruleCard: {
    flexDirection: 'row',
    backgroundColor: S1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    overflow: 'hidden',
  },
  ruleAccent: { width: 3, backgroundColor: GOLD },
  ruleBody:   { flex: 1, padding: 14, gap: 4 },
  ruleCat:    { fontSize: 10, fontWeight: '700', color: GOLD, textTransform: 'uppercase', letterSpacing: 0.6 },
  ruleTitle:  { fontSize: 14, fontWeight: '600', color: W },
  ruleText:   { fontSize: 13, color: G1, lineHeight: 19, fontFamily: BODY },

  // ── Verdict ───────────────────────────────────────────────────────────────
  decidedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reasonCard: {
    backgroundColor: S2,
    borderRadius: 10,
    padding: 14,
    gap: 5,
  },
  reasonLabel:{ fontSize: 11, fontWeight: '600', color: G2, textTransform: 'uppercase', letterSpacing: 0.6 },
  reasonText: { fontSize: 14, color: G1, fontFamily: BODY, lineHeight: 20 },
  tradeText:  { fontSize: 13, color: G2, fontFamily: BODY },
  tradeValue: { color: G1, fontWeight: '500' },

  // ── Outcome ───────────────────────────────────────────────────────────────
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  priceStat:       { flex: 1, gap: 4 },
  priceStatLabel:  { fontSize: 11, color: G2, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '600' },
  priceStatValue:  { fontSize: 18, fontWeight: '700', color: W, fontFamily: SERIF },

  pnlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  pnlRowPos:   { backgroundColor: '#0A2018' },
  pnlRowNeg:   { backgroundColor: '#280D0D' },
  pnlText:     { fontSize: 15, fontWeight: '700' },
  pnlPos:      { color: '#34D399' },
  pnlNeg:      { color: '#F87171' },
  pnlSince:    { fontSize: 12, color: G2, fontFamily: BODY },

  narrativeText: {
    fontSize: 14,
    color: G1,
    fontFamily: BODY,
    lineHeight: 21,
    fontStyle: 'italic',
  },

  trackingNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trackingText: { fontSize: 13, color: G2, fontFamily: BODY },
});
