/**
 * Parses skill option markers embedded in assistant messages.
 *
 * Markers are stripped from displayed text and rendered as interactive pickers.
 *
 * Single-select:  <<PICK:Label:Option A|Option B|Option C>>
 * Multi-select:   <<MULTIPICK:Label:Option A|Option B|Option C>>
 * Free text:      <<FREETEXT:Label>>
 */

export interface SkillQuestion {
  id: string;
  label: string;
  multi: boolean;
  freeText: boolean;
  options: string[];
}

export interface ParsedSkillMessage {
  displayText: string;
  questions: SkillQuestion[];
}

const PICK_RE = /<<(MULTI)?PICK:([^:]+):([^>]+)>>/g;
const FREETEXT_RE = /<<FREETEXT:([^>]+)>>/g;

export function parseSkillMessage(text: string): ParsedSkillMessage {
  const questions: SkillQuestion[] = [];
  let displayText = text;
  let idCounter = 0;

  // Parse PICK and MULTIPICK
  displayText = displayText.replace(PICK_RE, (_match, multi, label, optionsStr) => {
    const options = optionsStr.split('|').map((o: string) => o.trim()).filter(Boolean);
    questions.push({
      id: `q${idCounter++}`,
      label: label.trim(),
      multi: !!multi,
      freeText: false,
      options,
    });
    return ''; // strip from display text
  });

  // Parse FREETEXT
  displayText = displayText.replace(FREETEXT_RE, (_match, label) => {
    questions.push({
      id: `q${idCounter++}`,
      label: label.trim(),
      multi: false,
      freeText: true,
      options: [],
    });
    return '';
  });

  // Clean up extra blank lines left by stripped markers
  displayText = displayText.replace(/\n{3,}/g, '\n\n').trim();

  return { displayText, questions };
}

export function compileAnswers(
  questions: SkillQuestion[],
  selections: Record<string, string[]>,
  freeTexts: Record<string, string>,
): string {
  return questions
    .map((q) => {
      if (q.freeText) {
        const val = freeTexts[q.id]?.trim();
        return val ? `${q.label}: ${val}` : null;
      }
      const selected = selections[q.id] ?? [];
      if (!selected.length) return null;
      return `${q.label}: ${selected.join(', ')}`;
    })
    .filter(Boolean)
    .join('\n');
}
