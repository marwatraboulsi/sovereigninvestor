import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert, TextInput, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { supabase } from '@/lib/supabase';
import type { MacroConviction } from '@/types';

import { BG, S1, S2, LINE, W, GOLD, G1, G2, SERIF, BODY } from '@/theme';
import { AuthGate } from '@/components/AuthGate';

const LEVEL_LABEL:     Record<string, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
const STATUS_LABEL:    Record<string, string> = { 'currently-invested': 'Currently invested', 'planning-to-start': 'Planning to start', 'just-exploring': 'Just exploring' };
const GOAL_LABEL:      Record<string, string> = { 'understand-market': 'Understand how markets work', 'build-portfolio': 'Build a portfolio', 'learn-strategies': 'Learn specific strategies' };
const STYLE_LABEL:     Record<string, string> = { conversational: 'Conversational', balanced: 'Balanced', comprehensive: 'Comprehensive' };
const RISK_LABEL:      Record<string, string> = { conservative: 'Conservative', moderate: 'Moderate', aggressive: 'Aggressive' };
const WORLDVIEW_LABEL: Record<string, string> = { 'long-term-growth': 'Long-term wealth building', 'income-stability': 'Income & stability', 'values-driven': 'Values-driven', 'no-preference': 'No strong preference' };

const FIELD_OPTIONS: Record<string, { value: string; label: string }[]> = {
  knowledgeLevel:   [{ value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }],
  investmentStatus: [{ value: 'currently-invested', label: 'Currently invested' }, { value: 'planning-to-start', label: 'Planning to start' }, { value: 'just-exploring', label: 'Just exploring' }],
  primaryGoal:      [{ value: 'understand-market', label: 'Understand how markets work' }, { value: 'build-portfolio', label: 'Build a portfolio' }, { value: 'learn-strategies', label: 'Learn specific strategies' }],
  ageRange:         [{ value: '18-25', label: '18-25' }, { value: '26-35', label: '26-35' }, { value: '36-45', label: '36-45' }, { value: '46-55', label: '46-55' }, { value: '55+', label: '55+' }],
  riskTolerance:    [{ value: 'conservative', label: 'Conservative' }, { value: 'moderate', label: 'Moderate' }, { value: 'aggressive', label: 'Aggressive' }],
  worldview:        [{ value: 'long-term-growth', label: 'Long-term wealth building' }, { value: 'income-stability', label: 'Income & stability' }, { value: 'values-driven', label: 'Values-driven' }, { value: 'no-preference', label: 'No strong preference' }],
  responseStyle:    [{ value: 'conversational', label: 'Conversational' }, { value: 'balanced', label: 'Balanced' }, { value: 'comprehensive', label: 'Comprehensive' }],
};

const MACRO_CONVICTIONS: { id: MacroConviction; label: string; description: string }[] = [
  {
    id: 'dollar-debasement',
    label: 'Dollar Debasement',
    description: 'Fiat currency is being eroded. The dollar will lose its purchasing power and its status as the world\'s reserve currency.',
  },
  {
    id: 'us-decline',
    label: 'US Decline',
    description: 'US geopolitical and economic dominance is waning. The world is moving toward a multipolar order with new power centres.',
  },
  {
    id: 'ai-transformation',
    label: 'AI Transformation',
    description: 'Artificial intelligence will fundamentally reshape the economy, displacing entire industries and concentrating value in new ways.',
  },
  {
    id: 'climate-transition',
    label: 'Climate Transition',
    description: 'The shift away from fossil fuels is inevitable. Energy and infrastructure will be rebuilt around sustainability over the next decade.',
  },
  {
    id: 'deglobalization',
    label: 'Deglobalization',
    description: 'Global supply chains are fragmenting. Countries are prioritising self-sufficiency, and trade is regionalizing.',
  },
  {
    id: 'inflation-permanence',
    label: 'Structural Inflation',
    description: 'We are entering a prolonged era of higher inflation. The cost of living and doing business will keep rising.',
  },
  {
    id: 'crypto-future',
    label: 'Crypto as the Future',
    description: 'Decentralized finance and blockchain technology are building the financial infrastructure of the next generation.',
  },
  {
    id: 'hard-assets',
    label: 'Hard Assets Win',
    description: 'Real assets like gold, commodities, and land will outperform paper assets as the monetary system strains under debt.',
  },
  {
    id: 'emerging-markets',
    label: 'Emerging Market Rise',
    description: 'The centre of economic gravity is shifting toward Asia and the Global South. The West\'s century of dominance is ending.',
  },
  {
    id: 'debt-reckoning',
    label: 'Debt Reckoning',
    description: 'Global debt levels are unsustainable. A major reset or restructuring is coming that will shake financial markets.',
  },
  {
    id: 'tech-supremacy',
    label: 'Tech Supremacy',
    description: 'Software and technology companies will continue to dominate. The best returns will come from owning the builders of the digital world.',
  },
  {
    id: 'status-quo',
    label: 'Faith in the System',
    description: 'The existing financial system is more resilient than critics think. Diversified, patient investing in proven markets will keep rewarding.',
  },
];

export default function ProfileScreen() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useFocusEffect(useCallback(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
    });
  }, []));

  if (hasSession === null) return <View style={{ flex: 1, backgroundColor: BG }} />;
  if (!hasSession) return (
    <AuthGate
      title="Your Profile"
      message="Set your investment mandate once and the entire app personalises around it. Create a free account to get started."
    />
  );

  return <ProfileContent />;
}

function ProfileContent() {
  const { profile, saveProfile, clearProfile } = useUserProfile();
  const [convictions, setConvictions]   = useState<MacroConviction[]>([]);
  const [note, setNote]                 = useState('');
  const [noteDirty, setNoteDirty]       = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    if (profile) {
      setConvictions(profile.macroConvictions ?? []);
      setNote(profile.worldviewNote ?? '');
      setNoteDirty(false);
    }
  }, [profile]));

  async function toggleConviction(id: MacroConviction) {
    const next = convictions.includes(id)
      ? convictions.filter((c) => c !== id)
      : [...convictions, id];
    setConvictions(next);
    if (profile) await saveProfile({ ...profile, macroConvictions: next });
  }

  async function saveField(field: string, value: string) {
    if (profile) {
      await saveProfile({ ...profile, [field]: value });
    }
    setEditingField(null);
  }

  async function saveNote() {
    if (profile) {
      await saveProfile({ ...profile, worldviewNote: note });
      setNoteDirty(false);
    }
  }

  async function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.rpc('delete_user_account');
              if (error) throw error;
              await supabase.auth.signOut();
              router.replace('/auth');
            } catch (err: any) {
              Alert.alert('Error', err.message ?? 'Failed to delete account. Please contact support.');
            }
          },
        },
      ]
    );
  }

  async function confirmReset() {
    Alert.alert(
      'Reset profile',
      'This clears your settings and takes you back through onboarding.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: async () => { await clearProfile(); router.replace('/onboarding'); } },
      ],
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><Text style={s.centerText}>Loading...</Text></View>
      </SafeAreaView>
    );
  }

  const rows = [
    { label: 'Knowledge level',   value: LEVEL_LABEL[profile.knowledgeLevel],              field: 'knowledgeLevel' },
    { label: 'Investment status', value: STATUS_LABEL[profile.investmentStatus],            field: 'investmentStatus' },
    { label: 'Primary goal',      value: GOAL_LABEL[profile.primaryGoal],                  field: 'primaryGoal' },
    ...(profile.ageRange      ? [{ label: 'Age range',        value: profile.ageRange,                         field: 'ageRange' }] : []),
    ...(profile.riskTolerance ? [{ label: 'Risk tolerance',   value: RISK_LABEL[profile.riskTolerance],        field: 'riskTolerance' }] : []),
    ...(profile.worldview     ? [{ label: 'Investment values', value: WORLDVIEW_LABEL[profile.worldview],      field: 'worldview' }] : []),
    { label: 'Response style',    value: STYLE_LABEL[profile.responseStyle ?? 'balanced'],  field: 'responseStyle' },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Profile</Text>
        <Text style={s.headerSub}>This is your mandate. The more I know about you, the better I can guide you in a way that actually fits your life.</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Field picker modal */}
        <Modal
          visible={editingField !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingField(null)}
        >
          <Pressable style={s.modalOverlay} onPress={() => setEditingField(null)}>
            <Pressable style={s.modalSheet} onPress={() => {}}>
              <Text style={s.modalTitle}>
                {rows.find((r) => r.field === editingField)?.label}
              </Text>
              {(FIELD_OPTIONS[editingField ?? ''] ?? []).map((opt) => {
                const currentValue = profile[editingField as keyof typeof profile] as string;
                const isSelected = opt.value === currentValue;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[s.modalOption, isSelected && s.modalOptionActive]}
                    onPress={() => saveField(editingField!, opt.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.modalOptionText, isSelected && s.modalOptionTextActive]}>
                      {opt.label}
                    </Text>
                    {isSelected && <View style={s.modalOptionDot} />}
                  </TouchableOpacity>
                );
              })}
            </Pressable>
          </Pressable>
        </Modal>

        {/* Preferences */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Your Mandate</Text>
          <View style={s.list}>
            {rows.map((row, i) => (
              <TouchableOpacity
                key={row.label}
                style={[s.row, i < rows.length - 1 && s.rowBorder]}
                onPress={() => setEditingField(row.field)}
                activeOpacity={0.6}
              >
                <Text style={s.rowLabel}>{row.label}</Text>
                <View style={s.rowRight}>
                  <Text style={s.rowValue}>{row.value}</Text>
                  <Text style={s.rowChevron}>›</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Worldview */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Your Worldview</Text>
          <Text style={s.sectionSub}>
            Entirely optional. Select any convictions that resonate with how you see the world right now. Your Guide holds these lightly as background context and may draw connections where relevant, without validating or opposing them. Your worldview can evolve, and so can this.
          </Text>
          <View style={s.convictionGrid}>
            {MACRO_CONVICTIONS.map((c) => {
              const active = convictions.includes(c.id);
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[s.convictionCard, active && s.convictionCardActive]}
                  onPress={() => toggleConviction(c.id)}
                  activeOpacity={0.7}
                >
                  <View style={s.convictionHeader}>
                    <Text style={[s.convictionLabel, active && s.convictionLabelActive]}>{c.label}</Text>
                    {active && <View style={s.convictionDot} />}
                  </View>
                  <Text style={s.convictionDesc}>{c.description}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Free-text note */}
          <View style={s.noteWrap}>
            <Text style={s.noteLabel}>Anything else shaping how you see the world?</Text>
            <TextInput
              style={s.noteInput}
              value={note}
              onChangeText={(t) => { setNote(t); setNoteDirty(true); }}
              onBlur={saveNote}
              placeholder="Write it in your own words..."
              placeholderTextColor={G2}
              multiline
              numberOfLines={4}
              returnKeyType="done"
            />
            {noteDirty && (
              <TouchableOpacity style={s.noteSaveBtn} onPress={saveNote} activeOpacity={0.7}>
                <Text style={s.noteSaveBtnText}>Save</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* How it works */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>How your profile shapes responses</Text>
          <View style={s.infoList}>
            {[
              'Knowledge level adjusts depth, terminology, and pacing. From foundational explanations to assumed fluency.',
              'Investment status and primary goal help your Guide understand where you are in your journey and what kind of guidance is most useful right now.',
              'Age range and risk tolerance inform how your Guide frames trade-offs, time horizons, and the balance between growth and capital preservation.',
              'Response style controls length and structure. From concise conversational answers to thorough, structured deep dives.',
              'Worldview convictions are held as background context. Your Guide may connect relevant analysis to them, but stays objective and does not build every response around them.',
            ].map((text, i, arr) => (
              <View key={i} style={[s.infoRow, i < arr.length - 1 && s.rowBorder]}>
                <Text style={s.infoText}>{text}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.footerLinks}>
          <TouchableOpacity onPress={() => router.push('/privacy')} activeOpacity={0.6}>
            <Text style={s.footerLinkText}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={s.footerDivider}>·</Text>
          <TouchableOpacity onPress={() => router.push('/contact')} activeOpacity={0.6}>
            <Text style={s.footerLinkText}>Contact Us</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={s.signOutBtn}
          activeOpacity={0.7}
          onPress={() =>
            Alert.alert('Sign out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: async () => {
                  await supabase.auth.signOut();
                  router.replace('/auth');
                }
              },
            ])
          }
        >
          <Text style={s.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.deleteAccountBtn}
          activeOpacity={0.7}
          onPress={handleDeleteAccount}
        >
          <Text style={s.deleteAccountText}>Delete Account</Text>
        </TouchableOpacity>

        <Text style={s.disclaimer}>Sovereign Investor · Educational content only · Not investment advice</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { color: G1, fontSize: 15 },

  header: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  headerTitle: { fontSize: 28, fontWeight: '700', color: W, letterSpacing: -0.5, fontFamily: SERIF },
  headerSub:   { fontSize: 14, color: G1, marginTop: 4, fontFamily: BODY, lineHeight: 20 },

  scroll:   { flex: 1 },
  content:  { padding: 24, gap: 36, paddingBottom: 48 },

  section:    { gap: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: G2, textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionSub:   { fontSize: 14, color: G1, lineHeight: 20, fontFamily: BODY, marginTop: -4 },

  list: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, gap: 16,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE },
  rowLabel:  { fontSize: 15, color: G1 },
  rowValue:  { fontSize: 15, color: W, fontWeight: '500', textAlign: 'right', flex: 1 },

  // Conviction cards
  convictionGrid: { gap: 10 },
  convictionCard: {
    backgroundColor: S1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 14,
    gap: 6,
  },
  convictionCardActive: {
    borderColor: GOLD,
    backgroundColor: S2,
  },
  convictionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  convictionLabel:  { fontSize: 15, fontWeight: '600', color: G1, fontFamily: BODY },
  convictionLabelActive: { color: GOLD },
  convictionDot:    { width: 7, height: 7, borderRadius: 4, backgroundColor: GOLD },
  convictionDesc:   { fontSize: 13, color: G2, lineHeight: 19, fontFamily: BODY },

  // Free-text note
  noteWrap:  { gap: 8, marginTop: 4 },
  noteLabel: { fontSize: 13, color: G1, fontFamily: BODY },
  noteInput: {
    backgroundColor: S1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 14,
    color: W,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: BODY,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  noteSaveBtn:     { alignSelf: 'flex-end', backgroundColor: GOLD, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  noteSaveBtnText: { color: BG, fontSize: 13, fontWeight: '600' },

  infoList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE },
  infoRow:  { paddingVertical: 16 },
  infoText: { fontSize: 14, color: G1, lineHeight: 21, fontFamily: BODY },

  rowRight:   { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' },
  rowChevron: { color: G2, fontSize: 20, lineHeight: 22 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: S1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 20,
    gap: 4,
  },
  modalTitle: { fontSize: 13, fontWeight: '600', color: G2, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  modalOptionActive:     { backgroundColor: S2 },
  modalOptionText:       { fontSize: 16, color: G1 },
  modalOptionTextActive: { color: W, fontWeight: '600' },
  modalOptionDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: GOLD },

  footerLinks:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  footerLinkText: { fontSize: 13, color: G2, textDecorationLine: 'underline' },
  footerDivider:  { fontSize: 13, color: G2 },

  signOutBtn:  { alignItems: 'center', paddingVertical: 4 },
  signOutText: { fontSize: 13, color: '#E05555' },

  deleteAccountBtn:  { alignItems: 'center', paddingVertical: 4 },
  deleteAccountText: { fontSize: 13, color: G2, textDecorationLine: 'underline' },

  disclaimer: { fontSize: 11, color: G2, textAlign: 'center', lineHeight: 16 },
});
