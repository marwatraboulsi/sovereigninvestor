/**
 * Live ticker search via Finnhub.
 * Free API key at finnhub.io - 60 req/min, all global exchanges.
 * Falls back to a static list if key is missing or request fails.
 */

export type AssetType = 'ETF' | 'Stock' | 'Commodity' | 'Crypto' | 'Bond' | 'Other';

export interface TickerInfo {
  ticker: string;
  name: string;
  exchange: string;
  assetType: AssetType;
  sector?: string;
  currency?: string;
  quoteSymbol?: string;  // exact Finnhub symbol for /quote (may include exchange suffix e.g. CSPX.L)
}

// ─── Type inference ───────────────────────────────────────────────────────────

function inferType(symbol: string, name: string, finnhubType?: string): AssetType {
  const n = name.toUpperCase();
  const s = symbol.toUpperCase();
  // Commodity exposure check runs first - economic exposure beats legal structure.
  if (
    n.includes('GOLD') || n.includes('SILVER') || n.includes('PLATINUM') || n.includes('PALLADIUM') ||
    n.includes('COPPER') || n.includes('OIL') || n.includes('NATURAL GAS') ||
    n.includes('COMMODITY') || n.includes('COMMODITIES') || n.includes('METAL') || n.includes('PRECIOUS') ||
    n.includes('PHYSICAL') || s === 'GLD' || s === 'SLV' || s === 'IAU' ||
    s === 'USO' || s === 'PDBC' || s === 'SGLN' || s === '8PSB'
  ) return 'Commodity';
  if (finnhubType === 'Crypto' || s.includes('-USD') || s.includes('BTC') || s.includes('ETH')) return 'Crypto';
  if (n.includes('BOND') || n.includes('TREASURY') || n.includes('NOTES') || n.includes('FIXED INCOME')) return 'Bond';
  if (finnhubType === 'ETP' || n.includes(' ETF') || n.includes('TRUST') || n.includes('FUND') || n.includes('INDEX') || n.includes('UCITS')) return 'ETF';
  if (finnhubType === 'Common Stock' || finnhubType === 'ADR') return 'Stock';
  return 'Stock';
}

// ─── Sector inference ─────────────────────────────────────────────────────────

const STOCK_SECTORS: Record<string, string> = {
  // Technology
  AAPL: 'Technology', MSFT: 'Technology', NVDA: 'Technology', AVGO: 'Technology',
  AMD:  'Technology', INTC: 'Technology', ADBE: 'Technology', ORCL: 'Technology',
  CRM:  'Technology', ASML: 'Technology', TSM:  'Technology', SAP:  'Technology',
  QCOM: 'Technology', TXN:  'Technology', MU:   'Technology', AMAT: 'Technology',
  NOW:  'Technology', INTU: 'Technology', SNOW: 'Technology', PLTR: 'Technology',
  // Communication Services
  GOOGL: 'Communication Services', GOOG: 'Communication Services',
  META:  'Communication Services', NFLX: 'Communication Services',
  DIS:   'Communication Services', SPOT: 'Communication Services',
  TMUS:  'Communication Services', VZ:   'Communication Services', T: 'Communication Services',
  // Consumer Discretionary
  AMZN: 'Consumer Discretionary', TSLA: 'Consumer Discretionary',
  NKE:  'Consumer Discretionary', SBUX: 'Consumer Discretionary',
  MCD:  'Consumer Discretionary', HD:   'Consumer Discretionary',
  BKNG: 'Consumer Discretionary', ABNB: 'Consumer Discretionary',
  SHOP: 'Consumer Discretionary',
  // Consumer Staples
  WMT: 'Consumer Staples', COST: 'Consumer Staples', PG: 'Consumer Staples',
  KO:  'Consumer Staples', PEP:  'Consumer Staples', PM: 'Consumer Staples',
  // Financials
  JPM: 'Financials', V:   'Financials', MA:   'Financials',
  BAC: 'Financials', GS:  'Financials', MS:   'Financials',
  BRK: 'Financials', AXP: 'Financials', COIN: 'Financials',
  BX:  'Financials', KKR: 'Financials', SCHW: 'Financials',
  LLOY:'Financials', BARC:'Financials', HSBA: 'Financials',
  BNP: 'Financials', AXA: 'Financials', DBK:  'Financials',
  // Healthcare
  LLY: 'Healthcare', UNH: 'Healthcare', JNJ: 'Healthcare',
  ABT: 'Healthcare', MRK: 'Healthcare', PFE: 'Healthcare',
  ABBV:'Healthcare', TMO: 'Healthcare', ISRG:'Healthcare',
  // Energy
  XOM: 'Energy', CVX: 'Energy', COP: 'Energy', SLB: 'Energy',
  // Industrials
  UBER: 'Industrials', CAT: 'Industrials', DE: 'Industrials',
  BA:   'Industrials', GE:  'Industrials', HON: 'Industrials',
  // Real Estate
  AMT: 'Real Estate', PLD: 'Real Estate', EQIX: 'Real Estate',
  // Materials
  LIN: 'Materials', FCX: 'Materials', NEM: 'Materials',
  // Utilities
  NEE: 'Utilities', DUK: 'Utilities',
};

export function inferSector(symbol: string, name: string, assetType: AssetType): string | undefined {
  const n = name.toUpperCase();
  const s = symbol.toUpperCase();

  if (assetType === 'Commodity') {
    if (n.includes('GOLD')     || s === 'GLD' || s === 'IAU' || s === 'SGLN') return 'Gold';
    if (n.includes('SILVER')   || s === 'SLV' || s === '8PSB')                return 'Silver';
    if (n.includes('PLATINUM'))                                                 return 'Platinum';
    if (n.includes('PALLADIUM'))                                                return 'Palladium';
    if (n.includes('COPPER'))                                                   return 'Copper';
    if (n.includes('OIL')      || s === 'USO')                                 return 'Oil';
    if (n.includes('NATURAL GAS'))                                              return 'Natural Gas';
    return 'Commodities';
  }

  if (assetType === 'Bond') {
    if (n.includes('TREASURY') || n.includes('GOVERNMENT')) return 'Government Bonds';
    if (n.includes('CORPORATE'))                             return 'Corporate Bonds';
    if (n.includes('HIGH YIELD'))                            return 'High Yield';
    if (n.includes('TOTAL BOND') || n.includes('AGGREGATE')) return 'Broad Bonds';
    return 'Fixed Income';
  }

  if (assetType === 'Crypto') return 'Cryptocurrency';

  if (assetType === 'ETF') {
    if (n.includes('BITCOIN') || n.includes('CRYPTO'))                                    return 'Cryptocurrency';
    if (n.includes('SEMICONDUCTOR'))                                                       return 'Semiconductors';
    if (n.includes('CLEAN ENERGY') || n.includes('SOLAR') || n.includes('RENEWABLE'))     return 'Clean Energy';
    if (n.includes('TECHNOLOG'))                                                           return 'Technology';
    if (n.includes('HEALTH') || n.includes('BIOTECH') || n.includes('PHARMA'))            return 'Healthcare';
    if (n.includes('DEFENCE') || n.includes('DEFENSE') || n.includes('AEROSPACE'))        return 'Defense';
    if (n.includes('REAL ESTATE') || n.includes('REIT'))                                  return 'Real Estate';
    if (n.includes('FINANC') || n.includes('BANK'))                                       return 'Financials';
    if (n.includes('ENERGY'))                                                              return 'Energy';
    if (n.includes('CONSUMER STAPLES'))                                                    return 'Consumer Staples';
    if (n.includes('CONSUMER'))                                                            return 'Consumer';
    if (n.includes('INFRASTRUCTURE'))                                                      return 'Infrastructure';
    if (n.includes('INNOVATION') || n.includes('ARK'))                                    return 'Disruptive Innovation';
    if (n.includes('DIVIDEND') || n.includes('INCOME'))                                   return 'Dividend';
    if (n.includes('NASDAQ') || n.includes('QQQ'))                                        return 'US Tech';
    if (n.includes('EMERGING MARKET') || n.includes('EM IMI') || n.includes('EMERGING'))  return 'Emerging Markets';
    if (n.includes('EUROPE') || n.includes('EUROPEAN'))                                   return 'European Equities';
    if (n.includes('JAPAN') || n.includes('JAPANESE'))                                    return 'Japanese Equities';
    if (n.includes('CHINA') || n.includes('CHINESE'))                                     return 'Chinese Equities';
    if (n.includes('S&P 500') || n.includes('TOTAL STOCK') || n.includes('TOTAL MARKET')) return 'Broad Market';
    if (n.includes('FTSE ALL') || n.includes('ALL-WORLD') || n.includes('ALL WORLD'))     return 'Global Equities';
    if (n.includes('WORLD') || n.includes('GLOBAL') || n.includes('INTERNATIONAL'))       return 'Global Equities';
    if (n.includes('MSCI') || n.includes('UCITS'))                                        return 'Global Equities';
    return 'Equities';
  }

  return undefined;
}

// Name-based fallback - covers ticker variants (AMZ, MSF, etc.) returned by Finnhub
const COMPANY_NAME_SECTORS: Array<[string, string]> = [
  ['AMAZON',             'Consumer Discretionary'],
  ['MICROSOFT',          'Technology'],
  ['APPLE',              'Technology'],
  ['NVIDIA',             'Technology'],
  ['ALPHABET',           'Communication Services'],
  ['GOOGLE',             'Communication Services'],
  ['META PLATFORMS',     'Communication Services'],
  ['META INC',           'Communication Services'],
  ['TESLA',              'Consumer Discretionary'],
  ['BROADCOM',           'Technology'],
  ['ORACLE',             'Technology'],
  ['SALESFORCE',         'Technology'],
  ['ADVANCED MICRO',     'Technology'],
  ['INTEL',              'Technology'],
  ['ADOBE',              'Technology'],
  ['NETFLIX',            'Communication Services'],
  ['ASML',               'Technology'],
  ['TAIWAN SEMICONDUCTOR','Technology'],
  ['SAP SE',             'Technology'],
  ['QUALCOMM',           'Technology'],
  ['TEXAS INSTRUMENTS',  'Technology'],
  ['MICRON',             'Technology'],
  ['APPLIED MATERIALS',  'Technology'],
  ['SERVICENOW',         'Technology'],
  ['INTUIT',             'Technology'],
  ['SNOWFLAKE',          'Technology'],
  ['PALANTIR',           'Technology'],
  ['JPMORGAN',           'Financials'],
  ['JP MORGAN',          'Financials'],
  ['LLOYDS',             'Financials'],
  ['BARCLAYS',           'Financials'],
  ['HSBC',               'Financials'],
  ['BNP PARIBAS',        'Financials'],
  ['DEUTSCHE BANK',      'Financials'],
  ['VISA INC',           'Financials'],
  ['MASTERCARD',         'Financials'],
  ['BANK OF AMERICA',    'Financials'],
  ['GOLDMAN SACHS',      'Financials'],
  ['MORGAN STANLEY',     'Financials'],
  ['COINBASE',           'Financials'],
  ['ELI LILLY',          'Healthcare'],
  ['UNITEDHEALTH',       'Healthcare'],
  ['JOHNSON & JOHNSON',  'Healthcare'],
  ['EXXON',              'Energy'],
  ['CHEVRON',            'Energy'],
  ['WALMART',            'Consumer Staples'],
  ['COSTCO',             'Consumer Staples'],
  ['UBER',               'Industrials'],
  ['NIKE',               'Consumer Discretionary'],
  ['STARBUCKS',          'Consumer Discretionary'],
  ['MCDONALD',           'Consumer Discretionary'],
  ['HOME DEPOT',         'Consumer Discretionary'],
  ['BOOKING',            'Consumer Discretionary'],
  ['AIRBNB',             'Consumer Discretionary'],
  ['SHOPIFY',            'Consumer Discretionary'],
];

export function getSector(symbol: string, name: string, assetType: AssetType): string | undefined {
  if (assetType === 'Stock') {
    const bySym = STOCK_SECTORS[symbol.toUpperCase()];
    if (bySym) return bySym;
    // Fall back to name-based lookup - handles ticker variants like AMZ, MSF, etc.
    const n = name.toUpperCase();
    for (const [pattern, sector] of COMPANY_NAME_SECTORS) {
      if (n.includes(pattern)) return sector;
    }
    return inferSector(symbol, name, assetType);
  }
  return inferSector(symbol, name, assetType);
}

// ─── Currency inference ───────────────────────────────────────────────────────

// Primary-listing currencies for well-known non-US companies.
// These override the default USD assumption for clean (no-suffix) symbols.
const COMPANY_CURRENCIES: Record<string, string> = {
  // EUR - Eurozone
  // (ASML removed - its clean symbol is the NASDAQ/USD listing; EUR comes from quoteSymbol: 'ASML.AS' in FALLBACK)
  SAP: 'EUR', LVMH: 'EUR', TTE: 'EUR', SAN: 'EUR',
  BNP: 'EUR',  AXA: 'EUR', ALV: 'EUR',  DTE: 'EUR', BAYN: 'EUR',
  SIE: 'EUR',  MBG: 'EUR', BMW: 'EUR',  VOW3: 'EUR', AIR: 'EUR',
  MC: 'EUR',   OR: 'EUR',  KER: 'EUR',
  // GBP - UK
  SHEL: 'GBP', BP: 'GBP', HSBA: 'GBP', ULVR: 'GBP', GSK: 'GBP',
  AZN: 'GBP',  LLOY: 'GBP', BARC: 'GBP', RIO: 'GBP', BHP: 'GBP',
  // CHF - Switzerland
  NESN: 'CHF', ROG: 'CHF', NOVN: 'CHF', ABBN: 'CHF', UBSG: 'CHF',
  // JPY - Japan
  '7203': 'JPY', '6758': 'JPY', '9984': 'JPY', '6861': 'JPY',
  // CAD - Canada
  SHOP: 'CAD', RY: 'CAD', TD: 'CAD', CNR: 'CAD', ENB: 'CAD',
};

export function inferCurrency(originalSymbol: string, exchangeName?: string): string {
  const s = originalSymbol.toUpperCase();
  const base = s.split('.')[0];

  // Exchange suffix → currency (most reliable signal)
  if (s.endsWith('.DE') || s.endsWith('.F') || s.endsWith('.ETR'))              return 'EUR';
  if (s.endsWith('.PA') || s.endsWith('.AS') || s.endsWith('.BR') ||
      s.endsWith('.MI') || s.endsWith('.MC') || s.endsWith('.VI'))              return 'EUR';
  if (s.endsWith('.L') || s.endsWith('.LON'))                                   return 'GBP';
  if (s.endsWith('.SW') || s.endsWith('.VX'))                                   return 'CHF';
  if (s.endsWith('.TO') || s.endsWith('.TSX') || s.endsWith('.V'))              return 'CAD';
  if (s.endsWith('.AX'))                                                         return 'AUD';
  if (s.endsWith('.T'))                                                          return 'JPY';
  if (s.endsWith('.HK'))                                                         return 'HKD';
  if (s.endsWith('.SI'))                                                         return 'SGD';

  // Exchange name fallback
  if (exchangeName) {
    const e = exchangeName.toUpperCase();
    if (e.includes('XETRA') || e.includes('EURONEXT') || e.includes('FRANKFURT') ||
        e.includes('AMSTERDAM') || e.includes('PARIS') || e.includes('MILAN'))  return 'EUR';
    if (e.includes('LSE') || e.includes('LONDON'))                              return 'GBP';
    if (e.includes('SIX') || e.includes('SWISS'))                               return 'CHF';
    if (e.includes('TSX') || e.includes('TORONTO'))                             return 'CAD';
    if (e.includes('ASX') || e.includes('AUSTRALIA'))                           return 'AUD';
    if (e.includes('TOKYO') || e.includes('TSE') || e.includes('JAPAN'))        return 'JPY';
    if (e.includes('HONG KONG') || e.includes('HKEX'))                          return 'HKD';
    if (e.includes('SINGAPORE') || e.includes('SGX'))                           return 'SGD';
  }

  // Known European/non-US companies with clean symbols
  if (COMPANY_CURRENCIES[base]) return COMPANY_CURRENCIES[base];

  return 'USD';
}

// ─── Fallback lookup map (built once at module load) ─────────────────────────
// Used as a guaranteed safety net for sector/currency on Finnhub results.
// Populated after FALLBACK is defined below, but referenced here via closure.
let FALLBACK_MAP: Map<string, TickerInfo> | null = null;
function getFallbackMap(): Map<string, TickerInfo> {
  if (!FALLBACK_MAP) FALLBACK_MAP = new Map(FALLBACK.map((t) => [t.ticker.toUpperCase(), t]));
  return FALLBACK_MAP;
}

// Returns the correct Finnhub /quote symbol for a holding.
// Used to backfill old holdings that pre-date the quoteSymbol field.
export function getQuoteSymbol(ticker: string, exchange: string, currency: string): string {
  const fallback = getFallbackMap().get(ticker.toUpperCase());
  if (fallback?.quoteSymbol) return fallback.quoteSymbol;

  const e = (exchange || '').toUpperCase();
  if (e.includes('LSE') || e.includes('LONDON'))            return ticker + '.L';
  if (e.includes('XETRA'))                                   return ticker + '.DE';
  if (e.includes('FRANKFURT'))                               return ticker + '.F';
  if (e.includes('AMSTERDAM'))                               return ticker + '.AS';
  if (e.includes('EURONEXT'))                                return ticker + '.AS'; // default Euronext → Amsterdam
  if (e.includes('PARIS'))                                   return ticker + '.PA';
  if (e.includes('MILAN'))                                   return ticker + '.MI';
  if (e.includes('SIX') || e.includes('SWISS'))              return ticker + '.SW';
  if (e.includes('TORONTO') || e.includes('TSX'))            return ticker + '.TO';

  // Currency-based last resort (for Finnhub-sourced holdings where exchange = Finnhub type string)
  if (currency === 'GBP') return ticker + '.L';
  if (currency === 'CHF') return ticker + '.SW';
  if (currency === 'CAD') return ticker + '.TO';

  return ticker; // USD or unknown → use clean symbol
}

// ─── Main search ──────────────────────────────────────────────────────────────

export async function searchTickers(query: string, limit = 8): Promise<TickerInfo[]> {
  if (!query.trim()) return [];

  const apiKey = process.env.EXPO_PUBLIC_FINNHUB_API_KEY;

  if (apiKey) {
    try {
      const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const results: any[] = json?.result ?? [];

      // Deduplicate: prefer clean tickers (no dot) over exchange-suffixed ones
      const seen = new Map<string, TickerInfo>();
      for (const r of results) {
        if (!r.symbol || !r.description) continue;
        const base     = r.symbol.split('.')[0];
        const isClean  = !r.symbol.includes('.');
        if (!seen.has(base) || isClean) {
          const staticEntry = getFallbackMap().get(base.toUpperCase());
          const assetType   = inferType(r.symbol, r.description, r.type);
          const sector      = getSector(base, r.description, assetType) ?? staticEntry?.sector;
          // Currency: only use FALLBACK when there is NO quoteSymbol override -
          // if FALLBACK has a quoteSymbol it's a different listing shown separately below.
          const currency = (!staticEntry?.quoteSymbol && staticEntry?.currency)
            ? staticEntry.currency
            : (inferCurrency(r.symbol) !== 'USD' ? inferCurrency(r.symbol) : 'USD');
          seen.set(base, {
            ticker:    base,
            name:      r.description,
            exchange:  r.type || '',
            assetType,
            sector,
            currency,
            quoteSymbol: r.symbol,
          });
        }
      }

      // For any ticker where FALLBACK has a distinct EU listing (different quoteSymbol),
      // inject it as a second result so the user can choose between the US and EU versions.
      const extra: TickerInfo[] = [];
      for (const [base, liveResult] of seen) {
        const staticEntry = getFallbackMap().get(base.toUpperCase());
        if (
          staticEntry?.quoteSymbol &&
          staticEntry.quoteSymbol !== liveResult.quoteSymbol
        ) {
          extra.push(staticEntry);
        }
      }

      return [...seen.values(), ...extra]
        .sort((a, b) => {
          // Sort: exact-match tickers first, then alphabetically by ticker
          const qA = (a.quoteSymbol ?? a.ticker).toUpperCase();
          const qB = (b.quoteSymbol ?? b.ticker).toUpperCase();
          const queryUp = query.trim().toUpperCase();
          const aExact = a.ticker.toUpperCase() === queryUp;
          const bExact = b.ticker.toUpperCase() === queryUp;
          if (aExact !== bExact) return aExact ? -1 : 1;
          return qA < qB ? -1 : qA > qB ? 1 : 0;
        })
        .slice(0, limit);
    } catch {
      // fall through to static list
    }
  }

  return fallbackSearch(query, limit);
}

// ─── Static fallback ─────────────────────────────────────────────────────────

const FALLBACK: TickerInfo[] = [
  { ticker: 'AAPL',  name: 'Apple Inc.',                 exchange: 'NASDAQ',    assetType: 'Stock',     sector: 'Technology',               currency: 'USD' },
  { ticker: 'MSFT',  name: 'Microsoft Corporation',      exchange: 'NASDAQ',    assetType: 'Stock',     sector: 'Technology',               currency: 'USD' },
  { ticker: 'NVDA',  name: 'NVIDIA Corporation',         exchange: 'NASDAQ',    assetType: 'Stock',     sector: 'Technology',               currency: 'USD' },
  { ticker: 'AMZN',  name: 'Amazon.com Inc.',            exchange: 'NASDAQ',    assetType: 'Stock',     sector: 'Consumer Discretionary',   currency: 'USD' },
  { ticker: 'GOOGL', name: 'Alphabet Inc. Class A',      exchange: 'NASDAQ',    assetType: 'Stock',     sector: 'Communication Services',   currency: 'USD' },
  { ticker: 'GOOG',  name: 'Alphabet Inc. Class C',      exchange: 'NASDAQ',    assetType: 'Stock',     sector: 'Communication Services',   currency: 'USD' },
  { ticker: 'META',  name: 'Meta Platforms Inc.',        exchange: 'NASDAQ',    assetType: 'Stock',     sector: 'Communication Services',   currency: 'USD' },
  { ticker: 'TSLA',  name: 'Tesla Inc.',                 exchange: 'NASDAQ',    assetType: 'Stock',     sector: 'Consumer Discretionary',   currency: 'USD' },
  { ticker: 'AVGO',  name: 'Broadcom Inc.',              exchange: 'NASDAQ',    assetType: 'Stock',     sector: 'Technology',               currency: 'USD' },
  { ticker: 'ORCL',  name: 'Oracle Corporation',         exchange: 'NYSE',      assetType: 'Stock',     sector: 'Technology',               currency: 'USD' },
  { ticker: 'CRM',   name: 'Salesforce Inc.',            exchange: 'NYSE',      assetType: 'Stock',     sector: 'Technology',               currency: 'USD' },
  { ticker: 'AMD',   name: 'Advanced Micro Devices',     exchange: 'Xetra',     assetType: 'Stock',     sector: 'Technology',               currency: 'EUR', quoteSymbol: 'AMD.DE'  },
  { ticker: 'AMZ',   name: 'Amazon.com Inc.',            exchange: 'Frankfurt',  assetType: 'Stock',     sector: 'Consumer Discretionary',   currency: 'EUR', quoteSymbol: 'AMZ.F'   },
  { ticker: 'MSF',   name: 'Microsoft Corporation',      exchange: 'Frankfurt',  assetType: 'Stock',     sector: 'Technology',               currency: 'EUR', quoteSymbol: 'MSF.F'   },
  { ticker: 'INTC',  name: 'Intel Corporation',          exchange: 'NASDAQ',    assetType: 'Stock',     sector: 'Technology',               currency: 'USD' },
  { ticker: 'ADBE',  name: 'Adobe Inc.',                 exchange: 'NASDAQ',    assetType: 'Stock',     sector: 'Technology',               currency: 'USD' },
  { ticker: 'NFLX',  name: 'Netflix Inc.',               exchange: 'NASDAQ',    assetType: 'Stock',     sector: 'Communication Services',   currency: 'USD' },
  { ticker: 'ASML',  name: 'ASML Holding N.V.',          exchange: 'Euronext',  assetType: 'Stock',     sector: 'Technology',               currency: 'EUR', quoteSymbol: 'ASML.AS' },
  { ticker: 'JPM',   name: 'JPMorgan Chase & Co.',       exchange: 'NYSE',      assetType: 'Stock',     sector: 'Financials',               currency: 'USD' },
  { ticker: 'V',     name: 'Visa Inc.',                  exchange: 'NYSE',      assetType: 'Stock',     sector: 'Financials',               currency: 'USD' },
  { ticker: 'MA',    name: 'Mastercard Inc.',            exchange: 'NYSE',      assetType: 'Stock',     sector: 'Financials',               currency: 'USD' },
  { ticker: 'BAC',   name: 'Bank of America Corp.',      exchange: 'NYSE',      assetType: 'Stock',     sector: 'Financials',               currency: 'USD' },
  { ticker: 'GS',    name: 'Goldman Sachs Group',        exchange: 'NYSE',      assetType: 'Stock',     sector: 'Financials',               currency: 'USD' },
  { ticker: 'LLY',   name: 'Eli Lilly and Company',      exchange: 'NYSE',      assetType: 'Stock',     sector: 'Healthcare',               currency: 'USD' },
  { ticker: 'UNH',   name: 'UnitedHealth Group',         exchange: 'NYSE',      assetType: 'Stock',     sector: 'Healthcare',               currency: 'USD' },
  { ticker: 'JNJ',   name: 'Johnson & Johnson',          exchange: 'NYSE',      assetType: 'Stock',     sector: 'Healthcare',               currency: 'USD' },
  { ticker: 'XOM',   name: 'Exxon Mobil Corporation',    exchange: 'NYSE',      assetType: 'Stock',     sector: 'Energy',                   currency: 'USD' },
  { ticker: 'WMT',   name: 'Walmart Inc.',               exchange: 'NYSE',      assetType: 'Stock',     sector: 'Consumer Staples',         currency: 'USD' },
  { ticker: 'COST',  name: 'Costco Wholesale',           exchange: 'NASDAQ',    assetType: 'Stock',     sector: 'Consumer Staples',         currency: 'USD' },
  { ticker: 'UBER',  name: 'Uber Technologies',          exchange: 'NYSE',      assetType: 'Stock',     sector: 'Industrials',              currency: 'USD' },
  { ticker: 'COIN',  name: 'Coinbase Global',            exchange: 'NASDAQ',    assetType: 'Stock',     sector: 'Financials',               currency: 'USD' },
  // US ETFs
  { ticker: 'SPY',   name: 'SPDR S&P 500 ETF Trust',               exchange: 'NYSE Arca', assetType: 'ETF',       sector: 'Broad Market',       currency: 'USD' },
  { ticker: 'VOO',   name: 'Vanguard S&P 500 ETF',                  exchange: 'NYSE Arca', assetType: 'ETF',       sector: 'Broad Market',       currency: 'USD' },
  { ticker: 'IVV',   name: 'iShares Core S&P 500 ETF',             exchange: 'NYSE Arca', assetType: 'ETF',       sector: 'Broad Market',       currency: 'USD' },
  { ticker: 'VTI',   name: 'Vanguard Total Stock Market ETF',       exchange: 'NYSE Arca', assetType: 'ETF',       sector: 'Broad Market',       currency: 'USD' },
  { ticker: 'QQQ',   name: 'Invesco QQQ Trust (NASDAQ 100)',        exchange: 'NASDAQ',    assetType: 'ETF',       sector: 'US Tech',            currency: 'USD' },
  { ticker: 'SPYL',  name: 'SPDR S&P 500 ESG Leaders UCITS ETF',            exchange: 'Euronext',  assetType: 'ETF', sector: 'Broad Market',    currency: 'EUR', quoteSymbol: 'SPYL.PA' },
  { ticker: 'SPYI',  name: 'SPDR MSCI ACWI IMI UCITS ETF',                  exchange: 'Euronext',  assetType: 'ETF', sector: 'Global Equities', currency: 'EUR', quoteSymbol: 'SPYI.PA' },
  { ticker: 'SCHD',  name: 'Schwab US Dividend Equity ETF',         exchange: 'NYSE Arca', assetType: 'ETF',       sector: 'Dividend',           currency: 'USD' },
  { ticker: 'VYM',   name: 'Vanguard High Dividend Yield ETF',      exchange: 'NYSE Arca', assetType: 'ETF',       sector: 'Dividend',           currency: 'USD' },
  { ticker: 'ARKK',  name: 'ARK Innovation ETF',                    exchange: 'NYSE Arca', assetType: 'ETF',       sector: 'Disruptive Innovation', currency: 'USD' },
  { ticker: 'SMH',   name: 'VanEck Semiconductor ETF',              exchange: 'NASDAQ',    assetType: 'ETF',       sector: 'Semiconductors',     currency: 'USD' },
  { ticker: 'XLK',   name: 'Technology Select Sector SPDR',         exchange: 'NYSE Arca', assetType: 'ETF',       sector: 'Technology',         currency: 'USD' },
  { ticker: 'GLD',   name: 'SPDR Gold Shares',                      exchange: 'NYSE Arca', assetType: 'Commodity', sector: 'Gold',               currency: 'USD' },
  { ticker: 'IAU',   name: 'iShares Gold Trust',                    exchange: 'NYSE Arca', assetType: 'Commodity', sector: 'Gold',               currency: 'USD' },
  { ticker: 'SLV',   name: 'iShares Silver Trust',                  exchange: 'NYSE Arca', assetType: 'Commodity', sector: 'Silver',             currency: 'USD' },
  { ticker: 'IBIT',  name: 'iShares Bitcoin Trust ETF',             exchange: 'NASDAQ',    assetType: 'ETF',       sector: 'Cryptocurrency',     currency: 'USD' },
  // Bond ETFs
  { ticker: 'BND',   name: 'Vanguard Total Bond Market ETF',              exchange: 'NASDAQ',    assetType: 'Bond',  sector: 'Broad Bonds',          currency: 'USD' },
  { ticker: 'AGG',   name: 'iShares Core US Aggregate Bond ETF',          exchange: 'NYSE Arca', assetType: 'Bond',  sector: 'Broad Bonds',          currency: 'USD' },
  { ticker: 'BNDX',  name: 'Vanguard Total International Bond ETF',       exchange: 'NASDAQ',    assetType: 'Bond',  sector: 'Broad Bonds',          currency: 'USD' },
  { ticker: 'TLT',   name: 'iShares 20+ Year Treasury Bond ETF',          exchange: 'NASDAQ',    assetType: 'Bond',  sector: 'Government Bonds',     currency: 'USD' },
  { ticker: 'IEF',   name: 'iShares 7-10 Year Treasury Bond ETF',         exchange: 'NASDAQ',    assetType: 'Bond',  sector: 'Government Bonds',     currency: 'USD' },
  { ticker: 'SHY',   name: 'iShares 1-3 Year Treasury Bond ETF',          exchange: 'NASDAQ',    assetType: 'Bond',  sector: 'Government Bonds',     currency: 'USD' },
  { ticker: 'VGLT',  name: 'Vanguard Long-Term Treasury ETF',              exchange: 'NASDAQ',    assetType: 'Bond',  sector: 'Government Bonds',     currency: 'USD' },
  { ticker: 'TIP',   name: 'iShares TIPS Bond ETF',                        exchange: 'NYSE Arca', assetType: 'Bond',  sector: 'Inflation-Protected',  currency: 'USD' },
  { ticker: 'LQD',   name: 'iShares iBoxx $ Investment Grade Corporate',   exchange: 'NYSE Arca', assetType: 'Bond',  sector: 'Corporate Bonds',      currency: 'USD' },
  { ticker: 'HYG',   name: 'iShares iBoxx $ High Yield Corporate Bond',    exchange: 'NYSE Arca', assetType: 'Bond',  sector: 'Corporate Bonds',      currency: 'USD' },
  // Crypto - quoteSymbol uses Yahoo Finance format (BTC-USD etc.) for price fetching
  { ticker: 'BTC',   name: 'Bitcoin',       exchange: 'Crypto', assetType: 'Crypto', sector: 'Cryptocurrency', currency: 'USD', quoteSymbol: 'BTC-USD'  },
  { ticker: 'ETH',   name: 'Ethereum',      exchange: 'Crypto', assetType: 'Crypto', sector: 'Cryptocurrency', currency: 'USD', quoteSymbol: 'ETH-USD'  },
  { ticker: 'SOL',   name: 'Solana',        exchange: 'Crypto', assetType: 'Crypto', sector: 'Cryptocurrency', currency: 'USD', quoteSymbol: 'SOL-USD'  },
  { ticker: 'BNB',   name: 'BNB',           exchange: 'Crypto', assetType: 'Crypto', sector: 'Cryptocurrency', currency: 'USD', quoteSymbol: 'BNB-USD'  },
  { ticker: 'XRP',   name: 'XRP',           exchange: 'Crypto', assetType: 'Crypto', sector: 'Cryptocurrency', currency: 'USD', quoteSymbol: 'XRP-USD'  },
  { ticker: 'ADA',   name: 'Cardano',       exchange: 'Crypto', assetType: 'Crypto', sector: 'Cryptocurrency', currency: 'USD', quoteSymbol: 'ADA-USD'  },
  { ticker: 'AVAX',  name: 'Avalanche',     exchange: 'Crypto', assetType: 'Crypto', sector: 'Cryptocurrency', currency: 'USD', quoteSymbol: 'AVAX-USD' },
  { ticker: 'DOGE',  name: 'Dogecoin',      exchange: 'Crypto', assetType: 'Crypto', sector: 'Cryptocurrency', currency: 'USD', quoteSymbol: 'DOGE-USD' },
  { ticker: 'DOT',   name: 'Polkadot',      exchange: 'Crypto', assetType: 'Crypto', sector: 'Cryptocurrency', currency: 'USD', quoteSymbol: 'DOT-USD'  },
  { ticker: 'LINK',  name: 'Chainlink',     exchange: 'Crypto', assetType: 'Crypto', sector: 'Cryptocurrency', currency: 'USD', quoteSymbol: 'LINK-USD' },
  // EU-listed
  { ticker: '8PSB',  name: 'Invesco Physical Silver ETC',                       exchange: 'Xetra',    assetType: 'Commodity', sector: 'Silver',           currency: 'EUR', quoteSymbol: '8PSB.DE'  },
  { ticker: 'LSMC',  name: 'Amundi MSCI Semiconductors ESG Screened UCITS ETF', exchange: 'Euronext', assetType: 'ETF',       sector: 'Semiconductors',   currency: 'EUR', quoteSymbol: 'LSMC.PA'  },
  { ticker: 'CSPX',  name: 'iShares Core S&P 500 UCITS ETF USD (Acc)',          exchange: 'LSE',      assetType: 'ETF',       sector: 'Broad Market',     currency: 'USD', quoteSymbol: 'CSPX.L'   },
  { ticker: 'VWRL',  name: 'Vanguard FTSE All-World UCITS ETF',                 exchange: 'LSE',      assetType: 'ETF',       sector: 'Global Equities',  currency: 'USD', quoteSymbol: 'VWRL.L'   },
  { ticker: 'IWDA',  name: 'iShares Core MSCI World UCITS ETF USD (Acc)',       exchange: 'Euronext', assetType: 'ETF',       sector: 'Global Equities',  currency: 'USD', quoteSymbol: 'IWDA.AS'  },
  { ticker: 'EIMI',  name: 'iShares Core MSCI EM IMI UCITS ETF USD (Acc)',      exchange: 'LSE',      assetType: 'ETF',       sector: 'Emerging Markets', currency: 'USD', quoteSymbol: 'EIMI.L'   },
  { ticker: 'SGLN',  name: 'Invesco Physical Gold ETC',                         exchange: 'LSE',      assetType: 'Commodity', sector: 'Gold',             currency: 'USD', quoteSymbol: 'SGLN.L'   },
  { ticker: 'IS3N',  name: 'iShares Core MSCI EM IMI UCITS ETF (DE)',           exchange: 'Xetra',    assetType: 'ETF',       sector: 'Emerging Markets', currency: 'EUR', quoteSymbol: 'IS3N.DE'  },
  { ticker: '4GLD',  name: 'Invesco Physical Gold ETC (DE)',                    exchange: 'Xetra',    assetType: 'Commodity', sector: 'Gold',             currency: 'EUR', quoteSymbol: '4GLD.DE'  },
];

function fallbackSearch(query: string, limit: number): TickerInfo[] {
  const q = query.toUpperCase().trim();
  const exact: TickerInfo[] = [];
  const starts: TickerInfo[] = [];
  const nameMatch: TickerInfo[] = [];
  for (const t of FALLBACK) {
    if (t.ticker === q) exact.push(t);
    else if (t.ticker.startsWith(q)) starts.push(t);
    else if (t.name.toUpperCase().includes(q)) nameMatch.push(t);
  }
  return [...exact, ...starts, ...nameMatch].slice(0, limit);
}
