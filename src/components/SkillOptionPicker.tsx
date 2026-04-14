import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SkillQuestion } from '@/utils/parseSkillOptions';
import { compileAnswers } from '@/utils/parseSkillOptions';

import { BG, S1, S2, LINE, W, GOLD, G1, G2 } from '@/theme';

interface Props {
  questions: SkillQuestion[];
  onSubmit: (answer: string) => void;
  disabled?: boolean;
}

export function SkillOptionPicker({ questions, onSubmit, disabled }: Props) {
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [freeTexts, setFreeTexts] = useState<Record<string, string>>({});

  const toggle = (questionId: string, option: string, multi: boolean) => {
    setSelections((prev) => {
      const current = prev[questionId] ?? [];
      if (multi) {
        return {
          ...prev,
          [questionId]: current.includes(option)
            ? current.filter((o) => o !== option)
            : [...current, option],
        };
      } else {
        return {
          ...prev,
          [questionId]: current[0] === option ? [] : [option],
        };
      }
    });
  };

  const handleSubmit = () => {
    const answer = compileAnswers(questions, selections, freeTexts);
    if (!answer.trim()) return;
    onSubmit(answer);
  };

  const hasAnswers = questions.every((q) => {
    if (q.freeText) return true; // optional
    return (selections[q.id]?.length ?? 0) > 0;
  });

  return (
    <View style={s.container}>
      {questions.map((q) => (
        <View key={q.id} style={s.questionBlock}>
          <View style={s.questionHeader}>
            <Text style={s.questionLabel}>{q.label}</Text>
            {q.multi && <Text style={s.multiHint}>pick multiple</Text>}
          </View>

          {q.freeText ? (
            <TextInput
              style={s.freeInput}
              placeholder="Type your answer (optional)"
              placeholderTextColor={G2}
              value={freeTexts[q.id] ?? ''}
              onChangeText={(t) => setFreeTexts((prev) => ({ ...prev, [q.id]: t }))}
              editable={!disabled}
            />
          ) : (
            <View style={s.optionsRow}>
              {q.options.map((opt) => {
                const selected = (selections[q.id] ?? []).includes(opt);
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[s.chip, selected && s.chipSelected]}
                    onPress={() => toggle(q.id, opt, q.multi)}
                    disabled={disabled}
                    activeOpacity={0.7}
                  >
                    {selected && (
                      <Ionicons
                        name={q.multi ? 'checkmark' : 'radio-button-on'}
                        size={12}
                        color={BG}
                        style={{ marginRight: 4 }}
                      />
                    )}
                    <Text style={[s.chipText, selected && s.chipTextSelected]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      ))}

      <TouchableOpacity
        style={[s.submitBtn, (!hasAnswers || disabled) && s.submitBtnOff]}
        onPress={handleSubmit}
        disabled={!hasAnswers || disabled}
        activeOpacity={0.8}
      >
        <Text style={[s.submitText, (!hasAnswers || disabled) && s.submitTextOff]}>
          Begin Research
        </Text>
        <Ionicons
          name="arrow-forward"
          size={15}
          color={hasAnswers && !disabled ? BG : G2}
        />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    gap: 20,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  questionBlock: { gap: 10 },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  questionLabel: {
    color: W,
    fontSize: 13,
    fontWeight: '600',
  },
  multiHint: {
    color: G2,
    fontSize: 11,
    fontStyle: 'italic',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    backgroundColor: S1,
  },
  chipSelected: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  chipText: {
    color: G1,
    fontSize: 13,
  },
  chipTextSelected: {
    color: BG,
    fontWeight: '600',
  },
  freeInput: {
    backgroundColor: S2,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: W,
    fontSize: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 4,
  },
  submitBtnOff: {
    backgroundColor: S1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  submitText: {
    color: BG,
    fontSize: 15,
    fontWeight: '600',
  },
  submitTextOff: {
    color: G2,
  },
});
