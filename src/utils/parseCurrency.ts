/**
 * parseCashAmount — safely parses a user-typed cash amount string into a number.
 *
 * Handles both European and US number formats:
 *   "20.000"     → 20000  (dot as thousands separator, EU)
 *   "20,000"     → 20000  (comma as thousands separator, US)
 *   "20.000,50"  → 20000.5 (EU: dot=thousands, comma=decimal)
 *   "20,000.50"  → 20000.5 (US: comma=thousands, dot=decimal)
 *   "1.5"        → 1.5    (standard decimal)
 *   "20000"      → 20000  (no separators)
 *
 * Rule of thumb: if a single dot is followed by exactly 3 digits and nothing
 * else, it is treated as a thousands separator rather than a decimal point.
 */
export function parseCashAmount(raw: string | undefined | null): number {
  const s = (raw ?? '').trim().replace(/\s/g, '');
  if (!s) return 0;

  const dotCount   = (s.match(/\./g) || []).length;
  const commaCount = (s.match(/,/g)  || []).length;

  // Multiple dots → all dots are thousands separators: "1.000.000"
  if (dotCount > 1) {
    return parseFloat(s.replace(/\./g, '')) || 0;
  }

  // Multiple commas → all commas are thousands separators: "1,000,000"
  if (commaCount > 1) {
    return parseFloat(s.replace(/,/g, '')) || 0;
  }

  // Both a dot and a comma → the one that appears last is the decimal separator
  if (dotCount === 1 && commaCount === 1) {
    const lastDot   = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastComma > lastDot) {
      // European: "20.000,50" → comma is decimal
      return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
    } else {
      // US: "20,000.50" → dot is decimal
      return parseFloat(s.replace(/,/g, '')) || 0;
    }
  }

  // One dot only — check if it is a thousands separator
  if (dotCount === 1 && commaCount === 0) {
    const afterDot = s.split('.')[1] ?? '';
    // Exactly 3 digits after the dot → thousands separator: "20.000"
    if (afterDot.length === 3 && /^\d+$/.test(afterDot)) {
      return parseFloat(s.replace('.', '')) || 0;
    }
    return parseFloat(s) || 0;
  }

  // One comma only — check if it is a thousands separator
  if (commaCount === 1 && dotCount === 0) {
    const afterComma = s.split(',')[1] ?? '';
    // Exactly 3 digits after the comma → thousands separator: "20,000"
    if (afterComma.length === 3 && /^\d+$/.test(afterComma)) {
      return parseFloat(s.replace(',', '')) || 0;
    }
    // Otherwise treat comma as European decimal: "20,5"
    return parseFloat(s.replace(',', '.')) || 0;
  }

  return parseFloat(s) || 0;
}
