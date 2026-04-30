/**
 * RuleWizard — Phase 3E
 *
 * Two-step modal for creating or editing a PlaybookRule.
 *
 * Step 1: Category picker
 * Step 2: Rule body text input
 *
 * Styled consistently with AccountModal (bottom sheet, S1 background,
 * borderTopLeftRadius/Right 24, SERIF/BODY fonts).
 */

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { PlaybookRule, RuleCategory } from '@/types';
import { BG, S1, S2, LINE, W, GOLD, G1, G2, SERIF, BODY } from '@/theme';

// ─── Category labels ──────────────────────────────────────────────────────────

const CATEGORIES: { value: RuleCategory; label: string }[] = [
  { value: 'timing',               label: 'When I buy or sell' },
  { value: 'position-sizing',      label: 'How much I invest' },
  { value: 'emotional-discipline', label: 'Managing my emotions' },
  { value: 'new-asset-class',      label: 'Trying something new' },
  { value: 'life-events',          label: 'Big life moments' },
  { value: 'tax-awareness',        label: 'Tax considerations' },
  { value: 'portfolio-structure',  label: 'How my portfolio is built' },
  { value: 'information-discipline', label: 'What information I act on' },
  { value: 'monitoring',           label: 'How I track my investments' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface RuleWizardProps {
  visible: boolean;
  onClose: () => void;
  onSave:  (rule: Partial<PlaybookRule>) => void;
  existingRule?: PlaybookRule;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RuleWizard({ visible, onClose, onSave, existingRule }: RuleWizardProps) {
  const [step,     setStep]     = useState<1 | 2>(1);
  const [category, setCategory] = useState<RuleCategory | null>(null);
  const [title,    setTitle]    = useState('');
  const [body,     setBody]     = useState('');

  // Pre-fill when editing an existing rule
  useEffect(() => {
    if (visible && existingRule) {
      setCategory(existingRule.category);
      setTitle(existingRule.title);
      setBody(existingRule.body);
      setStep(existingRule ? 2 : 1);
    } else if (visible && !existingRule) {
      setCategory(null);
      setTitle('');
      setBody('');
      setStep(1);
    }
  }, [visible, existingRule]);

  function handleClose() {
    onClose();
  }

  function handleCategorySelect(cat: RuleCategory) {
    setCategory(cat);
    setStep(2);
  }

  function handleBack() {
    if (step === 2 && !existingRule) {
      setStep(1);
    } else {
      handleClose();
    }
  }

  function handleSave() {
    if (!category || !body.trim()) return;
    onSave({
      category,
      title:  title.trim() || CATEGORIES.find((c) => c.value === category)!.label,
      body:   body.trim(),
      status: existingRule?.status ?? 'active',
    });
    handleClose();
  }

  const categoryLabel = category
    ? CATEGORIES.find((c) => c.value === category)?.label ?? ''
    : '';

  const canSave = !!category && body.trim().length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={s.overlay} onPress={handleClose}>
        <Pressable style={s.sheet} onPress={() => {}}>

          {/* Header row */}
          <View style={s.headerRow}>
            <TouchableOpacity onPress={handleBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.6}>
              <Ionicons
                name={step === 1 || existingRule ? 'close' : 'chevron-back'}
                size={22}
                color={G2}
              />
            </TouchableOpacity>
            <Text style={s.headerTitle}>
              {existingRule ? 'Edit Rule' : 'Add Rule'}
            </Text>
            <View style={{ width: 22 }} />
          </View>

          {/* Step indicator */}
          {!existingRule && (
            <View style={s.stepDots}>
              {([1, 2] as const).map((n) => (
                <View key={n} style={[s.dot, step === n && s.dotActive]} />
              ))}
            </View>
          )}

          {/* ─ Step 1: Category ─ */}
          {step === 1 && (
            <ScrollView
              style={s.stepScroll}
              contentContainerStyle={s.stepContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={s.stepLabel}>What kind of rule is this?</Text>
              {CATEGORIES.map((cat, i) => {
                const sel = category === cat.value;
                return (
                  <TouchableOpacity
                    key={cat.value}
                    style={[
                      s.categoryOption,
                      i < CATEGORIES.length - 1 && s.categoryBorder,
                      sel && s.categoryOptionSel,
                    ]}
                    onPress={() => handleCategorySelect(cat.value)}
                    activeOpacity={0.6}
                  >
                    <Text style={[s.categoryLabel, sel && s.categoryLabelSel]}>
                      {cat.label}
                    </Text>
                    {sel && <Ionicons name="checkmark" size={16} color={GOLD} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* ─ Step 2: Rule body ─ */}
          {step === 2 && (
            <View style={s.stepContent}>
              {/* Selected category badge */}
              {category && (
                <TouchableOpacity
                  style={s.categoryBadge}
                  onPress={() => !existingRule && setStep(1)}
                  activeOpacity={existingRule ? 1 : 0.6}
                >
                  <Text style={s.categoryBadgeText}>{categoryLabel}</Text>
                  {!existingRule && (
                    <Ionicons name="pencil-outline" size={12} color={G2} />
                  )}
                </TouchableOpacity>
              )}

              <Text style={s.stepLabel}>Give your rule a short name</Text>
              <TextInput
                style={s.titleInput}
                value={title}
                onChangeText={setTitle}
                placeholder={categoryLabel}
                placeholderTextColor={G2}
                returnKeyType="next"
                maxLength={60}
              />

              <Text style={[s.stepLabel, { marginTop: 16 }]}>Write your rule in your own words</Text>
              <TextInput
                style={s.bodyInput}
                value={body}
                onChangeText={setBody}
                placeholder="e.g. I won't buy a stock just because it's been going up."
                placeholderTextColor={G2}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                returnKeyType="done"
                blurOnSubmit
              />

              <TouchableOpacity
                style={[s.saveBtn, !canSave && s.saveBtnOff]}
                onPress={handleSave}
                disabled={!canSave}
                activeOpacity={0.8}
              >
                <Text style={[s.saveBtnText, !canSave && s.saveBtnTextOff]}>
                  {existingRule ? 'Save Changes' : 'Add to Playbook'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: S1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 44,
    paddingHorizontal: 20,
    maxHeight: '85%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: W,
    fontFamily: SERIF,
    letterSpacing: -0.2,
  },

  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
  },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: S2 },
  dotActive: { backgroundColor: GOLD },

  stepScroll:  { flexGrow: 0 },
  stepContent: { gap: 4 },

  stepLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: G2,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 6,
  },

  // Category list (Step 1)
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  categoryBorder:    { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE },
  categoryOptionSel: {},
  categoryLabel:     { fontSize: 16, color: G1, fontFamily: BODY },
  categoryLabelSel:  { color: W, fontWeight: '500' },

  // Category badge (Step 2)
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: S2,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
  },
  categoryBadgeText: { fontSize: 13, color: G1, fontFamily: BODY },

  // Inputs (Step 2)
  titleInput: {
    backgroundColor: S2,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: W,
    fontSize: 15,
    fontFamily: BODY,
  },
  bodyInput: {
    backgroundColor: S2,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: W,
    fontSize: 15,
    fontFamily: BODY,
    minHeight: 110,
  },

  // Save button
  saveBtn: {
    backgroundColor: GOLD,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnOff:      { backgroundColor: S2 },
  saveBtnText:     { color: BG, fontSize: 15, fontWeight: '700', fontFamily: SERIF, letterSpacing: 0.3 },
  saveBtnTextOff:  { color: G2 },
});
