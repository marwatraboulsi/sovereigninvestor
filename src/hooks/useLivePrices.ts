import { useState, useCallback, useEffect } from 'react';

export interface LivePriceData {
  prices:     Record<string, number>;  // keyed by display ticker
  currencies: Record<string, string>;  // keyed by display ticker - ISO 4217 from live source
  loading:    boolean;
  error:      boolean;
  refresh:    () => void;
}

export interface PriceItem {
  ticker:       string;   // display symbol (e.g. 'CSPX')
  quoteSymbol?: string;   // Finnhub /quote symbol (e.g. 'CSPX.L')
  currency?:    string;   // stored currency - used when price source doesn't report one
}

interface FetchResult { price: number; currency: string; }

// ── Yahoo Finance ─────────────────────────────────────────────────────────────
// When a European ETF symbol 404s on Yahoo Finance (not in their DB for that
// exchange), automatically try the same ticker on the other major EU exchanges -
// UCITS ETFs commonly cross-list on Paris (.PA), Amsterdam (.AS), Xetra (.DE)
// and London (.L).
const YAHOO_EU_FALLBACK_SUFFIXES: Record<string, string[]> = {
  '.PA': ['.AS', '.DE', '.L'],
  '.AS': ['.PA', '.DE', '.L'],
  '.DE': ['.PA', '.AS', '.L'],
  '.L':  ['.PA', '.AS', '.DE'],
};

async function fetchYahooV8(sym: string): Promise<FetchResult> {
  for (const range of ['1d', '5d']) {
    for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
      try {
        const url = `https://${host}/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=${range}`;
        const res = await fetch(url);
        if (res.status === 404) return { price: -404, currency: '' }; // signal: symbol unknown
        if (!res.ok) continue;
        const json = await res.json();
        const meta = json?.chart?.result?.[0]?.meta;
        if (!meta) continue;
        const price =
          (typeof meta.regularMarketPrice  === 'number' && meta.regularMarketPrice  > 0 ? meta.regularMarketPrice  : 0) ||
          (typeof meta.previousClose        === 'number' && meta.previousClose        > 0 ? meta.previousClose        : 0) ||
          (typeof meta.chartPreviousClose   === 'number' && meta.chartPreviousClose   > 0 ? meta.chartPreviousClose   : 0);
        if (price > 0) return normaliseCurrency(price, meta.currency ?? '');
      } catch {}
    }
  }
  return { price: 0, currency: '' };
}

async function fetchYahooPrice(symbol: string): Promise<FetchResult> {
  // Build ordered list of symbols to try: primary first, then EU exchange fallbacks
  const upper = symbol.toUpperCase();
  const matchedSuffix = Object.keys(YAHOO_EU_FALLBACK_SUFFIXES).find((s) => upper.endsWith(s));
  const symbolsToTry = matchedSuffix
    ? [symbol, ...YAHOO_EU_FALLBACK_SUFFIXES[matchedSuffix].map((sfx) => symbol.slice(0, -matchedSuffix.length) + sfx)]
    : [symbol];

  // v8/finance/chart - try each exchange variant
  for (const sym of symbolsToTry) {
    const r = await fetchYahooV8(sym);
    if (r.price > 0) { console.log(`[Yahoo v8] ${sym} → ${r.price} ${r.currency}`); return r; }
    if (r.price === -404) { console.log(`[Yahoo v8] ${sym} → 404, trying next`); continue; }
  }

  // v7/quote - tries all candidates in one batch
  for (const host of ['query2.finance.yahoo.com', 'query1.finance.yahoo.com']) {
    try {
      const url = `https://${host}/v7/finance/quote?symbols=${encodeURIComponent(symbolsToTry.join(','))}&fields=regularMarketPrice,currency,previousClose`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = await res.json();
      const results: unknown[] = json?.quoteResponse?.result ?? [];
      for (const r of results as Record<string, unknown>[]) {
        const price =
          (typeof r.regularMarketPrice === 'number' && r.regularMarketPrice > 0 ? r.regularMarketPrice : 0) ||
          (typeof r.previousClose      === 'number' && r.previousClose      > 0 ? r.previousClose      : 0);
        if (price > 0) {
          console.log(`[Yahoo v7] ${r.symbol} → ${price} ${r.currency}`);
          return normaliseCurrency(price, (r.currency as string) ?? '');
        }
      }
    } catch {}
  }

  return { price: 0, currency: '' };
}

// ── Stooq ─────────────────────────────────────────────────────────────────────
// Free CSV feed, no auth required. Covers US + major European exchanges.
// Stooq uses different exchange suffixes from Yahoo Finance / Finnhub:
//   Euronext Paris:  .PA  → .fr   (e.g. SPYL.PA → spyl.fr)
//   London:          .L   → .uk   (e.g. CSPX.L  → cspx.uk)
//   Amsterdam:       .AS  → .nl
//   Milan:           .MI  → .it
//   Swiss:           .SW  → .ch
//   Brussels:        .BR  → .be
//   Xetra (DE):      .DE  → .de   (same - stooq already uses .de)
// US symbols with no dot get .us appended.
const STOOQ_SUFFIX_MAP: Record<string, string> = {
  '.PA': '.fr', '.L': '.uk', '.AS': '.nl',
  '.MI': '.it', '.SW': '.ch', '.BR': '.be',
};

async function fetchStooqPrice(symbol: string): Promise<number> {
  // Build candidate list: remapped suffix first, original second, .us fallback for bare symbols
  let candidates: string[];
  const upper = symbol.toUpperCase();
  const matchedSuffix = Object.keys(STOOQ_SUFFIX_MAP).find((sfx) => upper.endsWith(sfx));
  if (matchedSuffix) {
    const base     = symbol.slice(0, -matchedSuffix.length);
    const remapped = base + STOOQ_SUFFIX_MAP[matchedSuffix];
    candidates = [remapped, symbol]; // try remapped first, original as fallback
  } else if (!symbol.includes('.')) {
    candidates = [symbol + '.US'];
  } else {
    candidates = [symbol];
  }

  for (const candidate of candidates) {
    try {
      const s   = candidate.toLowerCase();
      const url = `https://stooq.com/q/l/?s=${encodeURIComponent(s)}&f=sd2t2ohlcv&h&e=csv`;
      const res = await fetch(url);
      if (!res.ok) continue;
      // Normalise line endings (stooq sometimes returns CRLF)
      const lines = (await res.text()).replace(/\r/g, '').trim().split('\n');
      // Header: Symbol,Date,Time,Open,High,Low,Close,Volume  → Close at index 6
      if (lines.length < 2) continue;
      const cols  = lines[1].split(',');
      const close = parseFloat(cols[6] ?? '');
      if (!isNaN(close) && close > 0) { console.log(`[Stooq] ${s} → ${close}`); return close; }
    } catch {}
  }
  return 0;
}

// ── GBp / GBX normalisation ───────────────────────────────────────────────────
// Yahoo Finance (and some other sources) quote UK stocks in pence (GBp / GBX),
// not pounds. E.g. LLOY.L = 67.xx GBp → divide by 100 → £0.67 GBP.
function normaliseCurrency(price: number, currency: string): FetchResult {
  if (currency === 'GBp' || currency === 'GBX') {
    return { price: price / 100, currency: 'GBP' };
  }
  return { price, currency };
}

// ── Main fetch ────────────────────────────────────────────────────────────────
async function fetchOnePrice(symbol: string, apiKey: string, storedCurrency: string): Promise<FetchResult> {
  // 1. Finnhub /quote - real-time for US, delayed for other exchanges
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`,
    );
    if (res.ok) {
      const json = await res.json();
      const c  = typeof json.c  === 'number' ? json.c  : 0;
      const pc = typeof json.pc === 'number' ? json.pc : 0;
      if (c  > 0) return { price: c,  currency: storedCurrency };
      if (pc > 0) return { price: pc, currency: storedCurrency };
    }
  } catch {}

  // 2. Finnhub /stock/candle - often has data when /quote returns 0
  try {
    const to   = Math.floor(Date.now() / 1000);
    const from = to - 10 * 24 * 60 * 60;
    const url  = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}&token=${apiKey}`;
    const res  = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      if (json?.s === 'ok' && Array.isArray(json.c) && json.c.length > 0) {
        const price = json.c[json.c.length - 1];
        if (price > 0) return { price, currency: storedCurrency };
      }
    }
  } catch {}

  // 3. Yahoo Finance - returns actual exchange currency when available
  const yahoo = await fetchYahooPrice(symbol);
  if (yahoo.price > 0) return { price: yahoo.price, currency: yahoo.currency || storedCurrency };

  // 4. Stooq - plain CSV, no crumbs, reliable for EU ETFs
  const stooq = await fetchStooqPrice(symbol);
  if (stooq > 0) return { price: stooq, currency: storedCurrency };

  return { price: 0, currency: storedCurrency };
}

export function useLivePrices(items: PriceItem[], enabled: boolean): LivePriceData {
  const [prices,     setPrices]     = useState<Record<string, number>>({});
  const [currencies, setCurrencies] = useState<Record<string, string>>({});
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(false);

  const key = enabled
    ? items.map((i) => i.quoteSymbol ?? i.ticker).sort().join(',')
    : '';

  const fetchPrices = useCallback(async () => {
    if (!enabled || items.length === 0) return;
    const apiKey = process.env.EXPO_PUBLIC_FINNHUB_API_KEY;
    if (!apiKey) {
      console.warn('[useLivePrices] No Finnhub API key found (EXPO_PUBLIC_FINNHUB_API_KEY)');
      setError(true);
      return;
    }

    setLoading(true);
    setError(false);

    const results = await Promise.all(
      items.map(async ({ ticker, quoteSymbol, currency: stored }) => {
        const symbol = quoteSymbol ?? ticker;
        console.log(`[useLivePrices] fetching "${symbol}" (ticker: ${ticker}, currency: ${stored})`);
        const { price, currency } = await fetchOnePrice(symbol, apiKey, stored ?? 'USD');
        if (price === 0) console.warn(`[useLivePrices] No price for "${symbol}"`);
        else             console.log(`[useLivePrices] ${symbol} = ${price} ${currency}`);
        return { ticker, price, currency };
      }),
    );

    const newPrices: Record<string, number> = {};
    const newCurr:   Record<string, string> = {};
    for (const { ticker, price, currency } of results) {
      if (price    > 0) newPrices[ticker] = price;
      if (currency)     newCurr[ticker]   = currency;
    }
    setPrices(newPrices);
    setCurrencies(newCurr);
    setLoading(false);
    if (results.some((r) => r.price === 0)) setError(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { fetchPrices(); }, [fetchPrices]);

  return { prices, currencies, loading, error, refresh: fetchPrices };
}
