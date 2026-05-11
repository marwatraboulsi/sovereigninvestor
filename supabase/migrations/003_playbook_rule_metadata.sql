-- Add decision_types and trigger_tags to playbook_rules.
-- Existing rows get empty arrays; rowToRule in usePlaybook.ts treats an empty
-- decision_types as ['buy','sell','unsure'] (matches all) and empty trigger_tags
-- as [] (no trigger specificity), preserving current stub behaviour for legacy rules.

ALTER TABLE playbook_rules
  ADD COLUMN IF NOT EXISTS decision_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trigger_tags   text[] NOT NULL DEFAULT '{}';
