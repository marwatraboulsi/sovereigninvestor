/**
 * Sovereign Investor — Modern Archivist Design System
 *
 * "Surface tiers, type scale, motion. No lines anywhere."
 *
 * Palette: deep emerald-black + warm parchment gold.
 * Typography: Lora (serif editorial) + system sans + system mono.
 * Corners: sharp and architectural (2–4 px).
 */

// ─── Background & Depth ───────────────────────────────────────────────────────

export const BG       = '#071610';  // base background — deep emerald black
export const BG_DEEP  = '#03110b';  // bg-deeper — for inset / avatar wells

// ─── Surface Tiers ────────────────────────────────────────────────────────────
// Used as tonal separators instead of lines. Alternate between tiers to create
// visual rhythm without borders.

export const S1        = '#0f1f18';  // surface-low   — cards, list rows
export const S2        = '#16261f';  // surface-mid   — elevated surfaces
export const S_HIGH    = '#1d2d27';  // surface-high  — selected / active
export const S_HIGHEST = '#243933';  // surface-highest — inputs, text areas
export const S_BRIGHT  = '#2a4039';  // surface-bright — strongest surface

// ─── Primary / Gold ───────────────────────────────────────────────────────────

export const GOLD      = '#e1cca6';  // primary — warm parchment gold
export const GOLD_DEEP = '#c4b18c';  // primary-deep — gradient start
export const GOLD_SOFT = '#efe1c2';  // primary-soft — hover state

export const ON_PRIMARY = '#1a1206'; // text on gold backgrounds

// ─── Text Scale ───────────────────────────────────────────────────────────────

export const W  = '#ece6da';  // on-bg — soft white (never pure white)
export const G1 = '#cec5b8';  // on-variant — secondary text
export const G2 = '#8e8779';  // on-muted — tertiary / labels
export const G3 = '#5a5a52';  // on-faint — ghost / chevrons

// ─── Signal Colours ───────────────────────────────────────────────────────────

export const BUY    = '#88a890';  // signal-buy  — muted sage green
export const SELL   = '#c89090';  // signal-sell — muted rose
export const WARN   = '#e1cca6';  // signal-warn — same as primary
export const BROKEN = '#b07672';  // signal-broken — stale / error

// ─── Ghost Borders (accessibility fallback only — use sparingly) ───────────────

export const GHOST_15 = 'rgba(206, 197, 184, 0.10)';
export const GHOST_20 = 'rgba(206, 197, 184, 0.16)';
export const LINE     = 'rgba(206, 197, 184, 0.10)'; // kept for backward compat

// ─── Border Radii — sharp, architectural ─────────────────────────────────────

export const R_SM = 2;   // buttons, tags
export const R    = 4;   // cards, list rows, surfaces
export const R_MD = 8;   // modals, bottom sheets (inner)
export const R_LG = 12;  // bottom sheet top corners

// ─── Typography ───────────────────────────────────────────────────────────────
//
// Serif  → Lora (loaded via expo-google-fonts/lora)
//           weight 400 for editorial body; 600/700 for display headings.
// Sans   → system default (no fontFamily needed — React Native default)
// Mono   → system monospace for prices, tickers, dates, stats.

/** Lora Regular — editorial serif for narrative / body / labels */
export const SERIF      = 'Lora_400Regular';

/** Lora SemiBold — subheadings and emphasis */
export const SERIF_SEMI = 'Lora_600SemiBold';

/** Lora Bold — large display headings */
export const SERIF_BOLD = 'Lora_700Bold';

/** Spectral Regular — retained for longer body passages */
export const BODY = 'Spectral_400Regular';

/** System monospace — for prices, tickers, dates, numeric data */
export const MONO = undefined as string | undefined;
// undefined → React Native system default; add fontVariant: ['tabular-nums']
// alongside for proper tabular figure alignment.
