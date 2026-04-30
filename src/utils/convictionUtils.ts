/**
 * convictionUtils.ts — Phase 8
 *
 * Shared utilities used across the Convictions system:
 *   · CONVICTION_THEME_LABEL — human-readable display strings
 *   · tickerToConvictionTheme — maps a ticker/asset to a ConvictionTheme
 *   · detectThemeFromText     — scans Catalyst Scanner output for macro themes
 */

import type { ConvictionTheme } from '@/types';

// ─── Display labels ───────────────────────────────────────────────────────────

export const CONVICTION_THEME_LABEL: Record<ConvictionTheme, string> = {
  'dollar-debasement':    'Dollar Debasement',
  'us-decline':           'US Decline',
  'ai-transformation':    'AI Transformation',
  'climate-transition':   'Climate Transition',
  'deglobalization':      'Deglobalization',
  'inflation-permanence': 'Persistent Inflation',
  'crypto-future':        'Crypto as the Future',
  'hard-assets':          'Hard Assets',
  'emerging-markets':     'Emerging Markets',
  'debt-reckoning':       'Debt Reckoning',
  'tech-supremacy':       'Tech Supremacy',
  'status-quo':           'Status Quo / No Strong Conviction',
};

// ─── Ticker → ConvictionTheme ─────────────────────────────────────────────────

/**
 * Maps a ticker symbol and asset name to the most relevant ConvictionTheme.
 * Used in Intercept Step 3 to surface relevant conviction cards.
 * Returns null if no conviction theme maps to this asset.
 */
export function tickerToConvictionTheme(
  ticker: string,
  assetName: string,
): ConvictionTheme | null {
  const t = ticker.toUpperCase();
  const a = (assetName ?? '').toLowerCase();

  // ── Crypto → crypto-future ───────────────────────────────────────────────
  const CRYPTO = new Set(['BTC','ETH','SOL','BNB','XRP','ADA','DOGE','AVAX','DOT','LINK','MATIC','ATOM','LTC','BCH','UNI','AAVE']);
  if (CRYPTO.has(t) || /crypto|bitcoin|ethereum|blockchain|defi|nft|web3/.test(a))
    return 'crypto-future';

  // ── Gold / commodities → hard-assets ─────────────────────────────────────
  const HARD = new Set(['GLD','SLV','IAU','PHYS','GDX','GDXJ','DBB','DBC','PDBC','GLDM','SGOL','SIVR']);
  if (HARD.has(t) || /gold|silver|precious metal|commodit|copper|oil|energy/.test(a))
    return 'hard-assets';

  // ── AI / semiconductors → ai-transformation ──────────────────────────────
  const AI = new Set(['NVDA','AMD','PLTR','AI','SMCI','ARM','MSFT','GOOGL','GOOG','META','AMZN','TSM','AMAT','KLAC','ASML']);
  if (AI.has(t) || /artificial intelligence|machine learning|semiconductor|chip|llm|neural|large language/.test(a))
    return 'ai-transformation';

  // ── Broad tech → tech-supremacy ───────────────────────────────────────────
  const TECH = new Set(['AAPL','NFLX','CRM','NOW','SHOP','ADBE','SNOW','CRWD','ZS','DDOG','NET','OKTA','HUBS','TEAM','TWLO']);
  if (TECH.has(t) || /software|cloud|saas|platform|digital/.test(a))
    return 'tech-supremacy';

  // ── Emerging markets ──────────────────────────────────────────────────────
  const EM = new Set(['EEM','VWO','INDA','EWZ','MCHI','FXI','EFA','KWEB','IEMG','GXC','PIN','EWY','EWT']);
  if (EM.has(t) || /emerging market|india|china|brazil|brics|developing world|asia/.test(a))
    return 'emerging-markets';

  // ── Clean energy / climate ────────────────────────────────────────────────
  const CLEAN = new Set(['ICLN','TAN','ENPH','SEDG','NEE','BEP','FSLR','RUN','PLUG','BLNK','CHPT','ARRY']);
  if (CLEAN.has(t) || /solar|clean energy|renewable|wind|electric vehicle|ev |battery|clean power/.test(a))
    return 'climate-transition';

  // ── Bonds → inflation-permanence ─────────────────────────────────────────
  const BONDS = new Set(['TLT','TIP','TIPS','AGG','BND','LQD','SCHP','VTIP','STIP','IEF','SHY','GOVT']);
  if (BONDS.has(t) || /bond|treasury|fixed income|tips|inflation protected/.test(a))
    return 'inflation-permanence';

  // ── Broad market indices → status-quo ────────────────────────────────────
  const INDEX = new Set(['VOO','SPY','VTI','IVV','QQQ','DIA','SCHB','VT','URTH','ACWI']);
  if (INDEX.has(t))
    return 'status-quo';

  return null;
}

// ─── Catalyst text → ConvictionTheme ─────────────────────────────────────────

/**
 * Scans Catalyst Scanner result text for the most prominent macro theme.
 * Returns the first match (ordered by priority), or null if none found.
 * Used in skill/[id].tsx to surface the conviction prompt after a scan.
 */
export function detectThemeFromText(text: string): ConvictionTheme | null {
  const t = text.toLowerCase();

  // Priority-ordered: most specific / newsworthy first
  if (/\bartificial intelligence\b|\bai\b.*?\bmarket|\bmachine learning\b|\bgenerative ai\b|\bllm\b|\bnvidia\b|\bsemiconductor.*?boom/.test(t))
    return 'ai-transformation';
  if (/\bcrypto\b|\bbitcoin\b|\bblockchain\b|\bdigital asset|\bdefi\b|\bweb3\b/.test(t))
    return 'crypto-future';
  if (/\binflation\b.*?\bpersist|\bsticky inflation\b|\bcpi\b|\bprice.*?rising|\bhigher.*?rate/.test(t))
    return 'inflation-permanence';
  if (/\bdeglobali|\bsupply chain.*?reshoring|\btariff|\bfriend.?shor|\btrade.*?fragm/.test(t))
    return 'deglobalization';
  if (/\bgold\b|\bcommodit|\bhard asset|\bprecious metal|\bsilver\b/.test(t))
    return 'hard-assets';
  if (/\bdebt.*?crisis|\bnational debt|\bfiscal deficit|\bdebt.?ceiling|\bsovereign debt/.test(t))
    return 'debt-reckoning';
  if (/\bclimate\b|\brenewable|\bclean energy|\bcarbon|\bnet zero|\benergy.?transition/.test(t))
    return 'climate-transition';
  if (/\bemerging market|\bbrics|\bindia\b.*\bgrowth|\bchina\b.*\bmarket|\bglobal south/.test(t))
    return 'emerging-markets';
  if (/\bdollar.*?weaken|\bcurrency.*?crisis|\bde.?dollarization|\bfiat.*?failure/.test(t))
    return 'dollar-debasement';
  if (/\btech.*?dominan|\bsoftware.*?sector|\bcloud.*?growth|\bdigital.*?transform/.test(t))
    return 'tech-supremacy';

  return null;
}
