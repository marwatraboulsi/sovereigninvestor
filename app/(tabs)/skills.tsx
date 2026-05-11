import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useGuest } from '@/contexts/GuestContext';
import { AccountModal } from '@/components/AccountModal';

import { BG, S1, LINE, W, G1, G2, G3, GOLD, ON_PRIMARY, R, R_SM, TAB_BAR_HEIGHT, SERIF, SERIF_BOLD, SERIF_SEMI, BODY } from '@/theme';

const SKILL_ACCENT: Record<string, string> = {
  'portfolio-reviewer':      '#3B82F6',
  'market-catalyst-scanner': '#10B981',
  'etf-analyzer':            '#8B5CF6',
  'stock-researcher':        '#F59E0B',
};

const SKILLS = [
  {
    id: 'portfolio-reviewer',
    title: 'Portfolio Reviewer',
    description: 'Pull your vault holdings directly and get a thorough review across allocation, diversification, and risk.',
    detail: 'Archetype fit · Rebalance guide',
  },
  {
    id: 'market-catalyst-scanner',
    title: 'Catalyst Scanner',
    description: 'Identify and classify market-moving events using the Five-Category Catalyst Framework: Institutional Flow, Consumer Behaviour Shift, Technology Disruption, Policy & Regulatory Shift, Macro Regime Shift.',
    detail: 'Live data · Macro signals',
  },
  {
    id: 'etf-analyzer',
    title: 'ETF Analyzer',
    description: 'Evaluate any ETF using the MACE framework: Mandate, Assets, Composition, and Expense.',
    detail: 'Live web data · Full scorecard',
  },
  {
    id: 'stock-researcher',
    title: 'Stock Researcher',
    description: 'Deep due diligence on any publicly traded company across eight phases: Business Model, Financial Health, Competitive Moat, Management & Governance, Growth Catalysts, Risk Assessment, Valuation, Investment Thesis.',
    detail: 'Live web data · Deep 8 phase analysis',
  },
];

export default function SkillsScreen() {
  const { isGuest } = useGuest();
  const [showModal, setShowModal] = useState(false);

  return (
    <SafeAreaView style={s.safe}>
      <AccountModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        title="Research Tools"
        message="Create a free account to access Portfolio Reviewer, Catalyst Scanner, ETF Analyzer, and more."
      />

      <View style={s.header}>
        <View style={s.headerRow}>
          <Text style={s.headerTitle}>Research</Text>
          <View style={s.headerActions}>
            <TouchableOpacity onPress={() => router.push({ pathname: '/how-it-works', params: { tab: 'research' } })} activeOpacity={0.6} style={s.infoBtn}>
              <Text style={s.infoBtnText}>?</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/saved-research')} activeOpacity={0.6}>
              <Text style={s.savedBtn}>Saved Research</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={s.headerSub}>Pick a tool and tell me what you want to analyse. I'll run a deep, structured research session tailored to your question.</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.list}>
          {SKILLS.map((skill, i) => (
            <TouchableOpacity
              key={skill.id}
              style={[s.item, i < SKILLS.length - 1 && s.itemBorder]}
              onPress={() => isGuest ? setShowModal(true) : router.push(`/skill/${skill.id}`)}
              activeOpacity={0.5}
            >
              <View style={[s.colorStrip, { backgroundColor: SKILL_ACCENT[skill.id] }]} />
              <View style={s.itemRow}>
                <View style={s.itemBody}>
                  <Text style={s.itemTitle}>{skill.title}</Text>
                  <Text style={s.itemDesc}>{skill.description}</Text>
                  <Text style={s.itemDetail}>{skill.detail}</Text>
                </View>
                <Ionicons name={isGuest ? 'lock-closed-outline' : 'chevron-forward'} size={16} color={G2} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.note}>
          Each skill uses Claude with live web search to deliver real time, structured analysis.
        </Text>

        <Text style={s.disclaimer}>
          Educational analysis only. Not investment advice.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: BG },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 28, fontFamily: SERIF_BOLD, color: W, letterSpacing: 0.2 },
  savedBtn:    { fontSize: 12, color: G2, fontFamily: BODY },
  infoBtn:     { padding: 2 },
  infoBtnText: { fontSize: 14, color: G2, fontFamily: BODY, fontWeight: '600' },
  headerSub:   { fontSize: 14, color: G1, marginTop: 6, lineHeight: 22, fontFamily: BODY, fontStyle: 'italic' },

  scroll:  { flex: 1 },
  content: { padding: 24, gap: 20, paddingBottom: TAB_BAR_HEIGHT },

  list: {
    gap: 2,
  },
  item: {
    backgroundColor: S1,
    borderRadius: R,
    overflow: 'hidden',
  },
  colorStrip: {
    height: 4,
    width: '100%',
  },
  itemBorder: {},
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 16,
  },
  itemBody: { flex: 1, gap: 6 },
  itemTitle:  { fontSize: 16, fontFamily: SERIF_SEMI, color: W },
  itemDesc:   { fontSize: 13, color: G1, lineHeight: 20, fontFamily: BODY },
  itemDetail: { fontSize: 11, color: GOLD, fontFamily: BODY, textTransform: 'uppercase', letterSpacing: 0.5 },

  note: {
    fontSize: 13,
    color: G2,
    lineHeight: 19,
    paddingTop: 4,
    fontFamily: BODY,
    fontStyle: 'italic',
  },
  disclaimer: {
    fontSize: 11,
    color: G3,
    lineHeight: 16,
    paddingBottom: 8,
    fontFamily: BODY,
  },
});
