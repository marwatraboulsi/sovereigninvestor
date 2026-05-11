import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert, TextInput, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { usePlaybook } from '@/hooks/usePlaybook';
import { useConvictions } from '@/hooks/useConvictions';
import { supabase } from '@/lib/supabase';
import type { MacroConviction, PlaybookRule, RuleCategory, Conviction, ConvictionBelief, ConvictionConfidence } from '@/types';
import { seedPlaybookOnFirstLogin, reseedPlaybook } from '@/utils/seedPlaybookOnFirstLogin';
import { CONVICTION_THEME_LABEL } from '@/utils/convictionUtils';
import { RuleWizard } from '@/components/RuleWizard';
import { RuleCard } from '@/components/RuleCard';

import { BG, BG_DEEP, S1, S2, S_HIGH, LINE, W, GOLD, ON_PRIMARY, G1, G2, G3, SERIF, SERIF_BOLD, SERIF_SEMI, BODY, R, R_SM, R_LG, TAB_BAR_HEIGHT } from '@/theme';
import { useGuest } from '@/contexts/GuestContext';
import { AccountModal } from '@/components/AccountModal';

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
  const { isGuest } = useGuest();
  const [showAccountModal, setShowAccountModal] = useState(false);

  // Show sign-up modal immediately when a guest visits Profile
  useFocusEffect(useCallback(() => {
    if (isGuest) setShowAccountModal(true);
  }, [isGuest]));

  if (isGuest) {
    return (
      <SafeAreaView style={s.safe}>
        <AccountModal
          visible={showAccountModal}
          onClose={() => setShowAccountModal(false)}
          title="Your Profile"
          message="Create a free account to set your investment mandate and personalise every response you receive."
        />
        <View style={s.center}>
          <Text style={s.centerText}>Create an account to access your profile.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { profile, saveProfile, clearProfile } = useUserProfile();
  const { rules, loaded: rulesLoaded, reload: reloadRules, addRule, updateRule, pauseRule, removeRule } = usePlaybook();
  const { convictions: convictionRecords, loaded: convictionsLoaded, reload: reloadConvictions, setConviction, removeConviction } = useConvictions();

  // ── Conviction edit state ───────────────────────────────────────────────────
  const [editingConviction,  setEditingConviction]  = useState<Conviction | null>(null);
  const [editBelief,         setEditBelief]         = useState<ConvictionBelief>('yes');
  const [editConfidence,     setEditConfidence]     = useState<ConvictionConfidence>('medium');
  const [editNote,           setEditNote]           = useState('');

  const [convictions, setConvictions]   = useState<MacroConviction[]>([]);
  const [note, setNote]                 = useState('');
  const [noteDirty, setNoteDirty]       = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);

  // Playbook wizard state
  const [wizardVisible,   setWizardVisible]   = useState(false);
  const [editingRule,     setEditingRule]      = useState<PlaybookRule | undefined>(undefined);
  // Track expanded rule bodies
  const [expandedRules,   setExpandedRules]    = useState<Set<string>>(new Set());

  // Seed rules once on first load if user has none
  const seedAttempted = useRef(false);

  useFocusEffect(useCallback(() => {
    if (profile) {
      setConvictions(profile.macroConvictions ?? []);
      setNote(profile.worldviewNote ?? '');
      setNoteDirty(false);
    }
    reloadRules();
    reloadConvictions(profile); // triggers Phase 8B migration on first load
  }, [profile, reloadRules, reloadConvictions]));

  useEffect(() => {
    if (profile?.onboardingComplete && rulesLoaded && rules.length === 0 && !seedAttempted.current) {
      seedAttempted.current = true;
      seedPlaybookOnFirstLogin(profile).then((seeded) => {
        if (seeded) reloadRules();
      });
    }
  }, [profile, rulesLoaded, rules.length, reloadRules]);

  // ─── Playbook helpers ──────────────────────────────────────────────────────

  function toggleExpanded(id: string) {
    setExpandedRules((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function openAddRule() {
    setEditingRule(undefined);
    setWizardVisible(true);
  }

  function openEditRule(rule: PlaybookRule) {
    setEditingRule(rule);
    setWizardVisible(true);
  }

  function handleRuleTap(rule: PlaybookRule) {
    Alert.alert(
      rule.title,
      undefined,
      [
        {
          text: 'Edit',
          onPress: () => openEditRule(rule),
        },
        {
          text: rule.status === 'paused' ? 'Resume' : 'Pause',
          onPress: () => pauseRule(rule.id),
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Remove rule',
              `Remove "${rule.title}" from your playbook?`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => removeRule(rule.id) },
              ],
            ),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  async function handleWizardSave(partial: Partial<PlaybookRule>) {
    if (editingRule) {
      await updateRule(editingRule.id, partial);
    } else {
      await addRule({
        category:      partial.category!,
        title:         partial.title!,
        body:          partial.body!,
        status:        partial.status ?? 'active',
        sourceTrigger: 'manual',
        decisionTypes: partial.decisionTypes ?? ['buy', 'sell', 'unsure'],
        triggerTags:   partial.triggerTags ?? [],
      });
    }
    reloadRules();
  }

  async function handleReseedRules() {
    if (!profile) return;
    Alert.alert(
      'Refresh seed rules',
      'This will regenerate your onboarding-seed rules based on your current profile and convictions. Rules you added manually are preserved.',
      [
        {
          text: 'Refresh',
          onPress: async () => {
            await reseedPlaybook(profile);
            reloadRules();
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  // Group active + paused rules by category (removed rules filtered by hook)
  const CATEGORY_LABEL: Record<RuleCategory, string> = {
    'timing':               'When I buy or sell',
    'position-sizing':      'How much I invest',
    'emotional-discipline': 'Managing my emotions',
    'new-asset-class':      'Trying something new',
    'life-events':          'Big life moments',
    'tax-awareness':        'Tax considerations',
    'portfolio-structure':  'How my portfolio is built',
    'information-discipline': 'What information I act on',
    'monitoring':           'How I track my investments',
  };

  const visibleRules = rules; // hook already excludes 'removed'

  const rulesByCategory = visibleRules.reduce<Record<string, PlaybookRule[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  function formatRelativeDate(ts: number): string {
    const diff = Date.now() - ts;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7)  return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  }

  // ─── Convictions helpers ────────────────────────────────────────────────────

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

  // ─── Conviction helpers ────────────────────────────────────────────────────

  function handleConvictionTap(conviction: Conviction) {
    Alert.alert(
      CONVICTION_THEME_LABEL[conviction.theme],
      undefined,
      [
        {
          text: 'Edit',
          onPress: () => {
            setEditBelief(conviction.belief);
            setEditConfidence(conviction.confidence);
            setEditNote(conviction.note ?? '');
            setEditingConviction(conviction);
          },
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Remove conviction',
              `Remove your conviction about "${CONVICTION_THEME_LABEL[conviction.theme]}"?`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => removeConviction(conviction.id) },
              ],
            ),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  async function handleConvictionSave() {
    if (!editingConviction) return;
    await setConviction(
      editingConviction.theme,
      editBelief,
      editConfidence,
      editNote.trim() || undefined,
      'manual',
    );
    setEditingConviction(null);
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
      <RuleWizard
        visible={wizardVisible}
        onClose={() => setWizardVisible(false)}
        onSave={handleWizardSave}
        existingRule={editingRule}
      />

      <View style={s.header}>
        <View style={s.headerRow}>
          <Text style={s.headerTitle}>Profile</Text>
          <TouchableOpacity onPress={() => router.push('/how-it-works')} activeOpacity={0.6} style={s.headerInfoBtn}>
            <Text style={s.headerInfoBtnText}>?</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.headerSub}>Your mandate, your rules, your worldview. The more defined this is, the sharper Nora becomes.</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ── Conviction edit modal ── */}
        <Modal
          visible={editingConviction !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setEditingConviction(null)}
        >
          <Pressable style={s.modalOverlay} onPress={() => setEditingConviction(null)}>
            <Pressable style={s.modalSheet} onPress={() => {}}>
              <Text style={s.modalTitle}>
                {editingConviction ? CONVICTION_THEME_LABEL[editingConviction.theme] : ''}
              </Text>

              {/* Belief */}
              <Text style={s.convEditSectionLabel}>Do you believe this?</Text>
              <View style={s.convEditRow}>
                {(['yes', 'still-forming', 'no'] as ConvictionBelief[]).map((b) => (
                  <TouchableOpacity
                    key={b}
                    style={[s.convEditBtn, editBelief === b && s.convEditBtnActive]}
                    onPress={() => setEditBelief(b)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.convEditBtnText, editBelief === b && s.convEditBtnTextActive]}>
                      {b === 'yes' ? 'Yes' : b === 'no' ? 'No' : 'Still forming'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Confidence */}
              <Text style={[s.convEditSectionLabel, { marginTop: 16 }]}>How confident?</Text>
              <View style={s.convEditRow}>
                {(['low', 'medium', 'high'] as ConvictionConfidence[]).map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[s.convEditBtn, editConfidence === c && s.convEditBtnActive]}
                    onPress={() => setEditConfidence(c)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.convEditBtnText, editConfidence === c && s.convEditBtnTextActive]}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Note */}
              <Text style={[s.convEditSectionLabel, { marginTop: 16 }]}>Note (optional)</Text>
              <TextInput
                style={s.convEditNote}
                value={editNote}
                onChangeText={setEditNote}
                placeholder="Why do you hold this view?"
                placeholderTextColor={G2}
                multiline
                numberOfLines={3}
              />

              {/* Actions */}
              <View style={s.convEditActions}>
                <TouchableOpacity
                  style={s.convEditCancel}
                  onPress={() => setEditingConviction(null)}
                  activeOpacity={0.7}
                >
                  <Text style={s.convEditCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.convEditSave}
                  onPress={handleConvictionSave}
                  activeOpacity={0.8}
                >
                  <Text style={s.convEditSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

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

        {/* ── 1. How it works — top card ───────────────────────────────────── */}
        <TouchableOpacity
          style={s.howItWorksCard}
          onPress={() => router.push('/how-it-works')}
          activeOpacity={0.75}
        >
          <View style={s.howItWorksCardAccent} />
          <View style={s.howItWorksCardInner}>
            <Text style={s.howItWorksCardEyebrow}>The System</Text>
            <Text style={s.howItWorksCardTitle}>How it works</Text>
            <Text style={s.howItWorksCardSub}>
              The Playbook, the Intercept, the Decision Log — explained in plain language.
            </Text>
          </View>
          <Text style={s.howItWorksCardChevron}>›</Text>
        </TouchableOpacity>

        {/* ── 2. My Playbook ───────────────────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.playbookHeader}>
            <Text style={s.sectionLabel}>My Playbook</Text>
            <TouchableOpacity onPress={openAddRule} activeOpacity={0.6} style={s.addRuleBtn}>
              <Text style={s.addRuleBtnText}>+ Add Rule</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.sectionSub}>
            Tap a rule to see its origin and the bias it guards against. Long-press to edit or pause.
          </Text>

          {rulesLoaded && visibleRules.length === 0 ? (
            <View style={s.playbookEmpty}>
              <Text style={s.playbookEmptyText}>
                Your playbook is empty. Run your first Intercept session to start building it automatically, or tap + Add Rule to write one now.
              </Text>
            </View>
          ) : (
            <View style={s.ruleList}>
              {Object.entries(rulesByCategory).map(([cat, catRules]) => (
                <View key={cat} style={s.playbookGroup}>
                  <Text style={s.playbookGroupLabel}>
                    {CATEGORY_LABEL[cat as RuleCategory] ?? cat}
                  </Text>
                  {catRules.map((rule) => (
                    <RuleCard
                      key={rule.id}
                      rule={rule}
                      expanded={expandedRules.has(rule.id)}
                      onPress={() => toggleExpanded(rule.id)}
                      onLongPress={() => handleRuleTap(rule)}
                      dimmed={rule.status === 'paused'}
                    />
                  ))}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Decision Log link ────────────────────────────────────────────── */}
        <TouchableOpacity
          style={s.decisionLogRow}
          onPress={() => router.push('/(tabs)/decisions')}
          activeOpacity={0.7}
        >
          <View style={s.decisionLogLeft}>
            <Text style={s.decisionLogLabel}>Decision Log</Text>
            <Text style={s.decisionLogSub}>Every Intercept session, logged. Your behavioral record over time.</Text>
          </View>
          <Text style={s.decisionLogChevron}>›</Text>
        </TouchableOpacity>

        {/* ── 3. Worldview ─────────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Worldview</Text>
          <Text style={s.sectionSub}>
            Your beliefs about the world. Nora holds these as background context.
          </Text>

          {/* Macro conviction cards */}
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

        {/* ── 4. Your Mandate ──────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Your Mandate</Text>
          <Text style={s.sectionSub}>
            Shapes how Nora responds — depth, framing, time horizons, and tone.
          </Text>
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

        {/* ── Footer links ─────────────────────────────────────────────────── */}
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

        <TouchableOpacity style={s.deleteAccountBtn} activeOpacity={0.7} onPress={handleDeleteAccount}>
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
    paddingTop: 20,
    paddingBottom: 16,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 11, fontWeight: '500', color: G2, textTransform: 'uppercase', letterSpacing: 2.2, fontFamily: BODY },
  headerSub:   { fontFamily: SERIF, fontStyle: 'italic', fontSize: 14, color: G1, lineHeight: 21 },
  headerInfoBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: S1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfoBtnText: {
    fontSize: 13,
    color: G2,
    fontFamily: BODY,
    fontWeight: '600',
  },

  scroll:   { flex: 1 },
  content:  { padding: 24, gap: 36, paddingBottom: TAB_BAR_HEIGHT },

  section:    { gap: 12 },
  sectionLabel: { fontFamily: SERIF, fontStyle: 'italic', fontSize: 13, color: GOLD, letterSpacing: 0.2, marginBottom: 2 },
  sectionSub:   { fontSize: 13, color: G1, lineHeight: 20, fontFamily: BODY, marginTop: -4 },

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
    borderRadius: R,
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

  // Reseed rules button
  reseedBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    alignSelf: 'flex-start',
    paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: R_SM,
    borderWidth: StyleSheet.hairlineWidth, borderColor: LINE,
    marginTop: 4,
  },
  reseedBtnText: { fontSize: 12, color: G2, fontFamily: BODY },

  // Free-text note
  noteWrap:  { gap: 8, marginTop: 4 },
  noteLabel: { fontSize: 13, color: G1, fontFamily: BODY },
  noteInput: {
    backgroundColor: S1,
    borderRadius: R,
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
  noteSaveBtn:     { alignSelf: 'flex-end', backgroundColor: GOLD, paddingHorizontal: 16, paddingVertical: 8, borderRadius: R_SM },
  noteSaveBtnText: { color: ON_PRIMARY, fontSize: 13, fontWeight: '600' },

  infoList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE },
  infoRow:  { paddingVertical: 16 },
  infoText: { fontSize: 14, color: G1, lineHeight: 21, fontFamily: BODY },

  rowRight:   { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' },
  rowChevron: { color: G2, fontSize: 20, lineHeight: 22 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: S1,
    borderTopLeftRadius: R_LG,
    borderTopRightRadius: R_LG,
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
    borderRadius: R,
  },
  modalOptionActive:     { backgroundColor: S2 },
  modalOptionText:       { fontSize: 16, color: G1 },
  modalOptionTextActive: { color: W, fontWeight: '600' },
  modalOptionDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: GOLD },

  // ── Playbook ──────────────────────────────────────────────────────────────
  playbookHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addRuleBtn:        { paddingHorizontal: 12, paddingVertical: 4, borderRadius: R_SM, borderWidth: StyleSheet.hairlineWidth, borderColor: GOLD },
  addRuleBtnText:    { fontSize: 12, color: GOLD, fontWeight: '600' },

  playbookEmpty: {
    backgroundColor: S1,
    borderRadius: R,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 20,
  },
  playbookEmptyText: { fontSize: 14, color: G2, lineHeight: 20, fontFamily: BODY, textAlign: 'center' },

  playbookGroup:      { gap: 8, marginTop: 4 },
  playbookGroupLabel: { fontSize: 11, color: G2, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 8 },

  ruleCard: {
    backgroundColor: S1,
    borderRadius: R,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 14,
    gap: 6,
  },
  ruleCardTop:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  ruleTitle:       { flex: 1, fontSize: 15, fontWeight: '600', color: W },
  ruleTitlePaused: { color: G1 },
  ruleMeta:        { alignItems: 'flex-end', gap: 4 },
  ruleDate:        { fontSize: 11, color: G2 },
  ruleBody:        { fontSize: 13, color: G1, lineHeight: 19, fontFamily: BODY },
  overrideCount:   { fontSize: 11, color: G2, marginTop: 2 },

  pausedBadge:     { backgroundColor: '#3D2F00', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  pausedBadgeText: { fontSize: 10, fontWeight: '700', color: '#F59E0B', letterSpacing: 0.3 },

  // ── Conviction edit modal ─────────────────────────────────────────────────
  convEditSectionLabel: { fontSize: 12, color: G2, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  convEditRow:   { flexDirection: 'row', gap: 8 },
  convEditBtn:   { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: LINE, alignItems: 'center', backgroundColor: 'transparent' },
  convEditBtnActive:     { backgroundColor: GOLD + '22', borderColor: GOLD },
  convEditBtnText:       { fontSize: 14, color: G1 },
  convEditBtnTextActive: { color: GOLD, fontWeight: '600' },
  convEditNote:  { backgroundColor: BG, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: LINE, padding: 12, color: W, fontSize: 14, fontFamily: BODY, minHeight: 70, textAlignVertical: 'top' },
  convEditActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  convEditCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: LINE, alignItems: 'center' },
  convEditCancelText: { fontSize: 15, color: G1 },
  convEditSave:  { flex: 2, paddingVertical: 14, borderRadius: R_SM, backgroundColor: GOLD, alignItems: 'center' },
  convEditSaveText: { fontSize: 15, fontWeight: '700', color: ON_PRIMARY },

  // ── Conviction record cards ───────────────────────────────────────────────
  convRecordCard: {
    backgroundColor: S1, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: LINE,
    padding: 14, gap: 6,
  },
  convRecordTop:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  convRecordLabel:{ flex: 1, fontSize: 14, fontWeight: '600', color: W },
  convRecordNote: { fontSize: 12, color: G2, fontFamily: BODY, lineHeight: 17 },

  beliefDot:       { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  beliefDotGreen:  { backgroundColor: '#34D399' },
  beliefDotAmber:  { backgroundColor: '#F59E0B' },
  beliefDotRed:    { backgroundColor: '#9CA3AF' },

  confBadge:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  confBadgeHigh: { backgroundColor: GOLD + '30' },
  confBadgeMed:  { backgroundColor: S2 },
  confBadgeLow:  { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  confBadgeText: { fontSize: 10, fontWeight: '700', color: G2, textTransform: 'uppercase', letterSpacing: 0.4 },

  // ── How it works card ─────────────────────────────────────────────────────
  howItWorksCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: S1,
    borderRadius: R,
    overflow: 'hidden',
  },
  howItWorksCardAccent: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: GOLD,
  },
  howItWorksCardInner: {
    flex: 1,
    padding: 16,
    paddingLeft: 14,
    gap: 3,
  },
  howItWorksCardEyebrow: {
    fontSize: 9,
    fontFamily: BODY,
    color: GOLD,
    textTransform: 'uppercase',
    letterSpacing: 1.8,
  },
  howItWorksCardTitle: {
    fontSize: 17,
    fontFamily: SERIF_BOLD,
    color: W,
    letterSpacing: 0.2,
  },
  howItWorksCardSub: {
    fontSize: 12,
    fontFamily: BODY,
    fontStyle: 'italic',
    color: G2,
    lineHeight: 17,
    marginTop: 2,
  },
  howItWorksCardChevron: {
    fontSize: 22,
    color: G3,
    fontFamily: BODY,
    paddingRight: 14,
  },

  // ── Decision Log row ──────────────────────────────────────────────────────
  decisionLogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: S1,
    borderRadius: R,
    padding: 16,
    paddingHorizontal: 18,
  },
  decisionLogLeft: { flex: 1, gap: 3 },
  decisionLogLabel: { fontSize: 15, fontFamily: SERIF_SEMI, color: W },
  decisionLogSub:   { fontSize: 12, fontFamily: BODY, fontStyle: 'italic', color: G2 },
  decisionLogChevron: { fontSize: 20, color: G3, fontFamily: BODY },

  // ── Rule list ─────────────────────────────────────────────────────────────
  ruleList: { gap: 0 },

  // ─────────────────────────────────────────────────────────────────────────
  footerLinks:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  footerLinkText: { fontSize: 13, color: G2, textDecorationLine: 'underline' },
  footerDivider:  { fontSize: 13, color: G2 },

  signOutBtn:  { alignItems: 'center', paddingVertical: 4 },
  signOutText: { fontSize: 13, color: '#E05555' },
  deleteAccountBtn:  { alignItems: 'center', paddingVertical: 4 },
  deleteAccountText: { fontSize: 12, color: G2, textDecorationLine: 'underline' },
  disclaimer: { fontSize: 11, color: G2, textAlign: 'center', lineHeight: 16 },
});
