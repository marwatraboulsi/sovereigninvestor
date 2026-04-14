import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useVaultAuth } from '@/hooks/useVaultAuth';
import { useLivePrices } from '@/hooks/useLivePrices';
import type { PriceItem } from '@/hooks/useLivePrices';
import { useFxRates, convertCurrency } from '@/hooks/useFxRates';
import { TickerSearch } from '@/components/TickerSearch';
import { getSector, inferCurrency, getQuoteSymbol } from '@/data/tickerSearch';
import type { TickerInfo, AssetType } from '@/data/tickerSearch';

// ─── Design tokens ────────────────────────────────────────────────────────────

import { BG, S1, LINE, W, GOLD, G1, G2, SERIF } from '@/theme';
const ERR = '#F87171';

// Single source of truth - badge bg/text and chart slice color all come from here.
const ASSET_COLORS: Record<string, { bg: string; color: string }> = {
  Stock:     { bg: '#0E1C2A', color: '#3B82F6' },  // blue
  ETF:       { bg: '#181428', color: '#8B5CF6' },  // violet
  Crypto:    { bg: '#251A0A', color: '#F97316' },  // orange
  Commodity: { bg: '#241C08', color: '#F59E0B' },  // amber
  Bond:      { bg: '#0A2018', color: '#10B981' },  // emerald
  Other:     { bg: '#161E16', color: '#9CA3AF' },  // grey
  Cash:      { bg: '#08201E', color: '#06B6D4' },  // cyan
};

function assetColor(type: string) {
  return ASSET_COLORS[type] ?? ASSET_COLORS.Other;
}

const TICKER_PALETTE = [
  '#60A5FA', '#4ADE80', '#F472B6', '#FBBF24', '#A78BFA',
  '#34D399', '#FB923C', '#38BDF8', '#F87171', '#818CF8',
  '#2DD4BF', '#E879F9',
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'SGD', 'HKD'];

// ─── Types ────────────────────────────────────────────────────────────────────

interface CashData {
  amount: string;
  currency: string;
  allocation: string;
}

export interface Holding {
  id: string;
  ticker: TickerInfo;
  amount: string;
  allocation: string;
  quantity?: string;   // number of shares/units - used in live price mode
}

interface ChartSlice {
  label: string;
  value: number;
  color: string;
}

type ViewMode = 'type' | 'ticker' | 'sector';

const STORAGE_KEY       = 'vault_holdings';
const CASH_KEY          = 'vault_cash';
const PRIVACY_KEY       = 'vault_privacy_seen';
const BASE_CURRENCY_KEY = 'vault_base_currency';

// ─── Stored-data corrections ──────────────────────────────────────────────────
// Some tickers were stored with truncated/wrong symbols (Finnhub dedup artefact),
// or with wrong quoteSymbol/currency because Finnhub returned a same-named EU
// variant (e.g. SPYL.PA) instead of the intended US ticker.
// Full TickerInfo replacement preserves id + quantity while fixing all metadata.
const TICKER_CORRECTIONS: Record<string, TickerInfo> = {
  // Restore SPYL to its original EUR/Paris state - a previous auto-correction
  // wrongly changed quoteSymbol to 'SPYL' (US ticker) and currency to 'USD'.
  SPYL: { ticker: 'SPYL', name: 'SPDR S&P 500 ESG Leaders UCITS ETF',    exchange: 'Euronext',  assetType: 'ETF',   sector: 'Broad Market',           currency: 'EUR', quoteSymbol: 'SPYL.PA' },
  // ASML was stored with quoteSymbol 'ASML' (NASDAQ, USD) - fix to Euronext Amsterdam (EUR).
  ASML: { ticker: 'ASML', name: 'ASML Holding N.V.',                      exchange: 'Euronext',  assetType: 'Stock', sector: 'Technology',             currency: 'EUR', quoteSymbol: 'ASML.AS' },
  // AMD was stored with quoteSymbol 'AMD' (NASDAQ, USD) - fix to Xetra (EUR).
  AMD:  { ticker: 'AMD',  name: 'Advanced Micro Devices Inc.',             exchange: 'Xetra',     assetType: 'Stock', sector: 'Technology',             currency: 'EUR', quoteSymbol: 'AMD.DE'  },
};

// These UCITS ETFs trade as USD-denominated accumulating share classes even
// though they're listed on European exchanges - stored currency may be wrong.
const CURRENCY_CORRECTIONS: Record<string, string> = {
  CSPX: 'USD', VWRL: 'USD', EIMI: 'USD', SGLN: 'USD', IWDA: 'USD',
};

// ─── Donut chart ──────────────────────────────────────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, outerR: number, innerR: number, startDeg: number, endDeg: number) {
  const delta = endDeg - startDeg;
  const end   = delta >= 359.9 ? startDeg + 359.9 : endDeg;
  const o1 = polarToCartesian(cx, cy, outerR, startDeg);
  const o2 = polarToCartesian(cx, cy, outerR, end);
  const i1 = polarToCartesian(cx, cy, innerR, end);
  const i2 = polarToCartesian(cx, cy, innerR, startDeg);
  const lg = end - startDeg > 180 ? 1 : 0;
  return `M ${o1.x} ${o1.y} A ${outerR} ${outerR} 0 ${lg} 1 ${o2.x} ${o2.y} L ${i1.x} ${i1.y} A ${innerR} ${innerR} 0 ${lg} 0 ${i2.x} ${i2.y} Z`;
}

function DonutChart({ slices, size = 160 }: { slices: ChartSlice[]; size?: number }) {
  const cx     = size / 2;
  const cy     = size / 2;
  const outerR = size * 0.44;
  const innerR = size * 0.27;
  const total  = slices.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return null;

  let cursor = 0;
  const paths = slices.map((sl) => {
    const start = (cursor / total) * 360;
    cursor += sl.value;
    const end = (cursor / total) * 360;
    return { ...sl, d: arcPath(cx, cy, outerR, innerR, start, end) };
  });

  return (
    <Svg width={size} height={size}>
      {paths.map((p, i) => (
        <Path key={i} d={p.d} fill={p.color} />
      ))}
    </Svg>
  );
}

// ─── Portfolio summary ────────────────────────────────────────────────────────

const VIEW_OPTIONS: { key: ViewMode; label: string }[] = [
  { key: 'type',   label: 'By Type'   },
  { key: 'sector', label: 'By Sector' },
  { key: 'ticker', label: 'By Ticker' },
];

function PortfolioSummary({ holdings, cash }: { holdings: Holding[]; cash: CashData }) {
  const [viewMode,     setViewMode]     = useState<ViewMode>('type');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const cashAlloc = parseFloat(cash.allocation) || 0;
  const hasData   = holdings.some((h) => parseFloat(h.allocation) > 0) || cashAlloc > 0;
  if (!hasData) return null;

  let slices: ChartSlice[] = [];

  if (viewMode === 'ticker') {
    holdings.forEach((h, i) => {
      const v = parseFloat(h.allocation) || 0;
      if (v > 0) slices.push({ label: h.ticker.ticker, value: v, color: TICKER_PALETTE[i % TICKER_PALETTE.length] });
    });
    if (cashAlloc > 0) slices.push({ label: 'Cash', value: cashAlloc, color: assetColor('Cash').color });
  } else if (viewMode === 'sector') {
    const groups: Record<string, number> = {};
    holdings.forEach((h) => {
      const key = h.ticker.sector ?? (h.ticker.assetType ?? 'Other');
      const v   = parseFloat(h.allocation) || 0;
      groups[key] = (groups[key] || 0) + v;
    });
    if (cashAlloc > 0) groups['Cash'] = (groups['Cash'] || 0) + cashAlloc;
    const sorted = Object.entries(groups).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    slices = sorted.map(([label, value], i) => ({
      label, value, color: TICKER_PALETTE[i % TICKER_PALETTE.length],
    }));
  } else {
    const groups: Record<string, number> = {};
    holdings.forEach((h) => {
      const type = h.ticker.assetType ?? 'Stock';
      const v    = parseFloat(h.allocation) || 0;
      groups[type] = (groups[type] || 0) + v;
    });
    if (cashAlloc > 0) groups['Cash'] = (groups['Cash'] || 0) + cashAlloc;
    slices = Object.entries(groups)
      .filter(([, v]) => v > 0)
      .map(([label, value]) => ({ label, value, color: assetColor(label).color }));
  }

  slices.sort((a, b) => b.value - a.value);
  const currentLabel = VIEW_OPTIONS.find((o) => o.key === viewMode)?.label ?? 'By Type';

  return (
    <View style={ch.container}>
      <View style={ch.topRow}>
        <Text style={ch.title}>Allocation</Text>
        <TouchableOpacity style={ch.dropdown} onPress={() => setDropdownOpen((o) => !o)} activeOpacity={0.7}>
          <Text style={ch.dropdownText}>{currentLabel}</Text>
          <Ionicons name={dropdownOpen ? 'chevron-up' : 'chevron-down'} size={12} color={G2} />
        </TouchableOpacity>
      </View>

      {dropdownOpen && (
        <View style={ch.dropdownMenu}>
          {VIEW_OPTIONS.map((opt, i) => (
            <TouchableOpacity
              key={opt.key}
              style={[ch.dropdownItem, i > 0 && ch.dropdownItemBorder]}
              onPress={() => { setViewMode(opt.key); setDropdownOpen(false); }}
              activeOpacity={0.7}
            >
              <Text style={[ch.dropdownItemText, opt.key === viewMode && { color: W }]}>{opt.label}</Text>
              {opt.key === viewMode && <Ionicons name="checkmark" size={13} color={W} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={ch.body}>
        <DonutChart slices={slices} size={160} />
        <View style={ch.legend}>
          {slices.map((sl) => (
            <View key={sl.label} style={ch.legendRow}>
              <View style={[ch.legendDot, { backgroundColor: sl.color }]} />
              <Text style={ch.legendLabel} numberOfLines={1}>{sl.label}</Text>
              <Text style={ch.legendValue}>{sl.value.toFixed(1)}%</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Lock screen ──────────────────────────────────────────────────────────────

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  return (
    <View style={lock.container}>
      <View style={lock.iconWrap}>
        <Ionicons name="lock-closed" size={36} color={G2} />
      </View>
      <Text style={lock.title}>The Vault</Text>
      <Text style={lock.sub}>Your portfolio is protected.{'\n'}Authenticate to continue.</Text>
      <TouchableOpacity style={lock.btn} onPress={onUnlock} activeOpacity={0.8}>
        <Ionicons name="finger-print" size={18} color={BG} />
        <Text style={lock.btnText}>Unlock with Face ID / Passcode</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Holding row ──────────────────────────────────────────────────────────────

function HoldingRow({
  holding,
  onChange,
  onDelete,
  livePrice,
  liveAllocation,
  liveCurrency,
  pricesLoading = false,
}: {
  holding: Holding;
  onChange: (updated: Holding) => void;
  onDelete: () => void;
  livePrice?: number;
  liveAllocation?: number;
  liveCurrency?: string;
  pricesLoading?: boolean;
}) {
  const c        = assetColor(holding.ticker.assetType ?? 'Stock');
  const label    = holding.ticker.assetType ?? 'Stock';
  const sector   = holding.ticker.sector ?? getSector(holding.ticker.ticker, holding.ticker.name, holding.ticker.assetType ?? 'Stock');
  const currency = liveCurrency || holding.ticker.currency || 'USD';

  return (
    <View style={row.container}>
      {/* Top row: ticker + badge (left) | delete (right) */}
      <View style={row.topRow}>
        <View style={row.tickerBadgeRow}>
          <Text style={row.ticker}>{holding.ticker.ticker}</Text>
          <View style={[row.badge, { backgroundColor: c.bg }]}>
            <Text style={[row.badgeText, { color: c.color }]}>{label}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={16} color={G2} />
        </TouchableOpacity>
      </View>
      {/* Name + sector */}
      <View style={row.nameWrap}>
        <Text style={row.name} numberOfLines={1}>{holding.ticker.name}</Text>
        {sector ? <Text style={row.sector} numberOfLines={1}>{sector}</Text> : null}
      </View>

      {/* Quantity input + live price & allocation */}
      <View style={row.fields}>
        <View style={row.fieldWrap}>
          <Text style={row.label}>Quantity of shares</Text>
          <View style={row.inputWrap}>
            <TextInput
              style={row.input}
              value={holding.quantity ?? ''}
              onChangeText={(v) => onChange({ ...holding, quantity: v.replace(/[^0-9.,]/g, '').replace(',', '.') })}
              placeholder="0"
              placeholderTextColor={G2}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
        <View style={row.fieldWrap}>
          <Text style={row.label}>Total value</Text>
          <View style={[row.inputWrap, { backgroundColor: S1 }]}>
            {parseFloat(holding.quantity || '0') <= 0 ? (
              <Text style={[row.input, { color: G2 }]}>Enter quantity first</Text>
            ) : pricesLoading ? (
              <Text style={[row.input, { color: G2 }]}>Loading…</Text>
            ) : livePrice != null && livePrice > 0 ? (
              <>
                <Text style={[row.prefix, { color: G1 }]}>{currency}</Text>
                <Text
                  style={[row.input, { color: W }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                >
                  {(livePrice * parseFloat(holding.quantity || '0')).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                {liveAllocation != null && (
                  <Text style={row.suffix}>{liveAllocation.toFixed(1)}%</Text>
                )}
              </>
            ) : (
              <Text style={[row.input, { color: G2 }]}>Price unavailable</Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Total value card ─────────────────────────────────────────────────────────

function TotalValueCard({
  totalValue,
  baseCurrency,
  onChangeCurrency,
}: {
  totalValue: number | null;
  baseCurrency: string;
  onChangeCurrency: (c: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const formatted = totalValue != null
    ? totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : null;

  return (
    <View style={tv.container}>
      <View style={tv.topRow}>
        <Text style={tv.label}>Total Portfolio Value</Text>
        <TouchableOpacity style={tv.currencyBtn} onPress={() => setOpen((o) => !o)} activeOpacity={0.7}>
          <Text style={tv.currencyText}>{baseCurrency}</Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color={G2} />
        </TouchableOpacity>
      </View>
      {open && (
        <View style={tv.dropdown}>
          {CURRENCIES.map((c, i) => (
            <TouchableOpacity
              key={c}
              style={[tv.option, i > 0 && tv.optionBorder]}
              onPress={() => { onChangeCurrency(c); setOpen(false); }}
              activeOpacity={0.7}
            >
              <Text style={[tv.optionText, c === baseCurrency && { color: W }]}>{c}</Text>
              {c === baseCurrency && <Ionicons name="checkmark" size={13} color={W} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
      <Text style={tv.value}>
        {formatted != null
          ? `${baseCurrency} ${formatted}`
          : '-'}
      </Text>
    </View>
  );
}

// ─── Supabase mapping helpers ─────────────────────────────────────────────────

function rowToHolding(row: any): Holding {
  let extra: any = {};
  try { extra = JSON.parse(row.notes || '{}'); } catch {}
  return {
    id:         row.id,
    ticker: {
      ticker:      row.ticker,
      name:        row.name,
      exchange:    extra.exchange    ?? '',
      assetType:   row.asset_type   as AssetType,
      sector:      extra.sector     ?? undefined,
      currency:    extra.currency   ?? undefined,
      quoteSymbol: extra.quoteSymbol ?? undefined,
    },
    amount:     '',
    allocation: '',
    quantity:   row.shares != null ? String(row.shares) : '',
  };
}

function holdingToRow(h: Holding, userId: string) {
  return {
    user_id:    userId,
    ticker:     h.ticker.ticker,
    name:       h.ticker.name,
    shares:     parseFloat(h.quantity || '0'),
    avg_cost:   0,
    asset_type: h.ticker.assetType,
    notes:      JSON.stringify({
      exchange:    h.ticker.exchange,
      sector:      h.ticker.sector,
      currency:    h.ticker.currency,
      quoteSymbol: h.ticker.quoteSymbol,
    }),
  };
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function VaultScreen() {
  const { authState, authenticate, lock } = useVaultAuth();
  const [holdings,      setHoldings]      = useState<Holding[]>([]);
  const [cash,          setCash]          = useState<CashData>({ amount: '', currency: 'USD', allocation: '' });
  const [currencyOpen,  setCurrencyOpen]  = useState(false);
  const [adding,        setAdding]        = useState(false);
  const [newTicker,     setNewTicker]     = useState<TickerInfo | null>(null);
  const [saved,         setSaved]         = useState(false);
  const [baseCurrency,  setBaseCurrency]  = useState('USD');

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Load holdings from Supabase
        const { data: rows } = await supabase
          .from('vault_holdings')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });

        if (rows && rows.length > 0) {
          const loaded = rows.map(rowToHolding);
          const backfilled = loaded.map((h) => {
            const tickerFix = TICKER_CORRECTIONS[h.ticker.ticker.toUpperCase()];
            if (tickerFix) return { ...h, ticker: tickerFix };
            const correctedCurrency = CURRENCY_CORRECTIONS[h.ticker.ticker.toUpperCase()];
            const currency    = correctedCurrency ?? h.ticker.currency ?? inferCurrency(h.ticker.ticker, h.ticker.exchange);
            const quoteSymbol = h.ticker.quoteSymbol ?? getQuoteSymbol(h.ticker.ticker, h.ticker.exchange, currency);
            return {
              ...h,
              ticker: {
                ...h.ticker,
                sector: h.ticker.sector ?? getSector(h.ticker.ticker, h.ticker.name, h.ticker.assetType ?? 'Stock'),
                currency,
                quoteSymbol,
              },
            };
          });
          setHoldings(backfilled);
        }

        // Load cash + baseCurrency from profiles
        const { data: prof } = await supabase
          .from('profiles')
          .select('vault_cash, vault_base_currency')
          .eq('id', user.id)
          .single();

        if (prof?.vault_cash)           setCash(prof.vault_cash as CashData);
        if (prof?.vault_base_currency)  setBaseCurrency(prof.vault_base_currency);

        // Privacy notice (UI-only flag, stays local)
        AsyncStorage.getItem(PRIVACY_KEY).then((seen) => {
          if (!seen) {
            Alert.alert(
              'Live Prices',
              'Your holdings will be looked up online to get live prices. Only stock symbols are shared, never your name, amounts, or personal details.',
              [{ text: 'Got it', onPress: () => AsyncStorage.setItem(PRIVACY_KEY, 'true') }],
            );
          }
        });
      })();
      return () => lock();
    }, [lock]),
  );

  // ── Live prices (always on) ───────────────────────────────────────────────────
  const priceItems: PriceItem[] = holdings.map((h) => ({
    ticker:      h.ticker.ticker,
    quoteSymbol: h.ticker.quoteSymbol,
    currency:    h.ticker.currency,   // passed to fetchOnePrice for Finnhub paths
  }));
  const { prices, currencies, loading: pricesLoading, refresh: refreshPrices } =
    useLivePrices(priceItems, true);

  // ── FX rates for total portfolio value ────────────────────────────────────────
  const fxRates = useFxRates();

  const totalValue = useMemo<number | null>(() => {
    if (!fxRates) return null;
    let total = 0;
    let hasValue = false;
    for (const h of holdings) {
      const qty   = parseFloat(h.quantity || '0');
      const price = prices[h.ticker.ticker] ?? 0;
      if (qty <= 0 || price <= 0) continue;
      const currency = currencies[h.ticker.ticker] || h.ticker.currency || 'USD';
      total += convertCurrency(qty * price, currency, baseCurrency, fxRates);
      hasValue = true;
    }
    const cashAmt = parseFloat(cash.amount || '0');
    if (cashAmt > 0) {
      total += convertCurrency(cashAmt, cash.currency, baseCurrency, fxRates);
      hasValue = true;
    }
    return hasValue ? total : null;
  }, [holdings, prices, currencies, fxRates, baseCurrency, cash.amount, cash.currency]);

  const changeBaseCurrency = async (c: string) => {
    setBaseCurrency(c);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ vault_base_currency: c }).eq('id', user.id);
    }
  };

  const liveAllocations = useMemo<Record<string, number>>(() => {
    // Do NOT gate on prices being non-empty - cash must always show in the chart
    let total = 0;
    const values: Record<string, number> = {};
    for (const h of holdings) {
      const qty   = parseFloat(h.quantity || '0');
      const price = prices[h.ticker.ticker] ?? 0;
      if (qty <= 0 || price <= 0) { values[h.id] = 0; continue; }
      // Convert to USD for apples-to-apples allocation % across currencies
      const currency = currencies[h.ticker.ticker] || h.ticker.currency || 'USD';
      const valueUSD = fxRates
        ? convertCurrency(qty * price, currency, 'USD', fxRates)
        : qty * price;
      values[h.id] = valueUSD;
      total        += valueUSD;
    }
    const cashAmt = parseFloat(cash.amount || '0');
    const cashUSD = cashAmt > 0 && fxRates
      ? convertCurrency(cashAmt, cash.currency, 'USD', fxRates)
      : cashAmt;
    total += cashUSD;
    if (total <= 0) return {};
    const result: Record<string, number> = {};
    for (const h of holdings) result[h.id] = ((values[h.id] ?? 0) / total) * 100;
    result['__cash__'] = (cashUSD / total) * 100;
    return result;
  }, [holdings, prices, currencies, cash.amount, cash.currency, fxRates]);

  const displayHoldings = useMemo(() =>
    holdings.map((h) => ({
      ...h,
      allocation: liveAllocations[h.id] != null ? liveAllocations[h.id].toFixed(1) : '0',
    })),
  [holdings, liveAllocations]);

  const displayCash = useMemo<CashData>(() => ({
    ...cash,
    allocation: liveAllocations['__cash__'] != null ? liveAllocations['__cash__'].toFixed(1) : '0',
  }), [cash, liveAllocations]);

  const saveHoldings = async (updated: Holding[], userId: string) => {
    await supabase.from('vault_holdings').delete().eq('user_id', userId);
    if (updated.length > 0) {
      await supabase.from('vault_holdings').insert(updated.map((h) => holdingToRow(h, userId)));
    }
    setHoldings(updated);
  };

  const saveCash = async (updated: CashData, userId: string) => {
    await supabase.from('profiles').update({ vault_cash: updated }).eq('id', userId);
  };

  const updateCash = (patch: Partial<CashData>) => {
    const updated = { ...cash, ...patch };
    setCash(updated);
    saveCash(updated);
  };

  const addHolding = () => {
    if (!newTicker) return;
    // Apply known ticker corrections immediately so the holding is never stored wrong
    // (e.g. Finnhub returns 'AMZ' for Amazon - correct it to AMZN/USD at add time,
    // not just on the next load via useFocusEffect).
    const corrected = TICKER_CORRECTIONS[newTicker.ticker.toUpperCase()];
    if (corrected) {
      setHoldings((prev) => [...prev, { id: Date.now().toString(), ticker: corrected, amount: '', allocation: '', quantity: '' }]);
      setNewTicker(null);
      setAdding(false);
      return;
    }
    const currency    = newTicker.currency    ?? inferCurrency(newTicker.ticker, newTicker.exchange);
    const quoteSymbol = newTicker.quoteSymbol ?? getQuoteSymbol(newTicker.ticker, newTicker.exchange, currency);
    const ticker: TickerInfo = {
      ...newTicker,
      sector: newTicker.sector ?? getSector(newTicker.ticker, newTicker.name, newTicker.assetType),
      currency,
      quoteSymbol,
    };
    setHoldings((prev) => [...prev, { id: Date.now().toString(), ticker, amount: '', allocation: '', quantity: '' }]);
    setNewTicker(null);
    setAdding(false);
  };

  const updateHolding = (id: string, updated: Holding) =>
    setHoldings((prev) => prev.map((h) => (h.id === id ? updated : h)));

  const deleteHolding = (id: string) => {
    Alert.alert('Remove holding', 'Remove this position from your vault?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setHoldings((prev) => prev.filter((h) => h.id !== id)) },
    ]);
  };

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const sorted = [...holdings].sort((a, b) => {
      const aAlloc = liveAllocations[a.id] ?? 0;
      const bAlloc = liveAllocations[b.id] ?? 0;
      return bAlloc - aAlloc;
    });
    await saveHoldings(sorted, user.id);
    await saveCash(cash, user.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (authState === 'locked') {
    return (
      <SafeAreaView style={s.safe}>
        <LockScreen onUnlock={authenticate} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={88}
      >
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerRow}>
            <Text style={s.headerTitle}>The Vault</Text>
            <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.8}>
              <Text style={s.saveBtnText}>{saved ? 'Saved' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.headerSub}>Add your holdings here and I'll keep track of everything. Your portfolio, your way.</Text>
        </View>
        {holdings.length > 0 && (
          <View style={s.liveBar}>
            <Ionicons name="pulse-outline" size={13} color='#10B981' />
            <Text style={s.liveBarText}>
              {pricesLoading ? 'Fetching live prices…' : 'Live prices active'}
            </Text>
            {!pricesLoading && (
              <TouchableOpacity onPress={refreshPrices} hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}>
                <Ionicons name="refresh-outline" size={13} color='#10B981' />
              </TouchableOpacity>
            )}
          </View>
        )}

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Summary chart */}
          <PortfolioSummary holdings={displayHoldings} cash={displayCash} />

          {/* Total portfolio value */}
          {(holdings.length > 0 || parseFloat(cash.amount) > 0) && (
            <TotalValueCard
              totalValue={totalValue}
              baseCurrency={baseCurrency}
              onChangeCurrency={changeBaseCurrency}
            />
          )}

          {/* Cash card */}
          <View style={s.cashCard}>
            <View style={s.cashTopRow}>
              <Text style={s.cashCardTitle}>Cash & equivalents</Text>
              <View style={s.cashBadge}>
                <Text style={s.cashBadgeText}>Cash</Text>
              </View>
            </View>

            {/* Currency */}
            <View>
              <Text style={s.fieldLabel}>Currency</Text>
              <TouchableOpacity style={s.currencySelector} onPress={() => setCurrencyOpen((o) => !o)} activeOpacity={0.7}>
                <Text style={s.currencyValue}>{cash.currency}</Text>
                <Ionicons name={currencyOpen ? 'chevron-up' : 'chevron-down'} size={14} color={G2} />
              </TouchableOpacity>
              {currencyOpen && (
                <View style={s.currencyDropdown}>
                  {CURRENCIES.map((c, i) => (
                    <TouchableOpacity
                      key={c}
                      style={[s.currencyOption, i > 0 && s.currencyOptionBorder]}
                      onPress={() => { updateCash({ currency: c }); setCurrencyOpen(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.currencyOptionText, c === cash.currency && { color: W }]}>{c}</Text>
                      {c === cash.currency && <Ionicons name="checkmark" size={14} color={W} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Amount + Allocation */}
            <View style={s.cashFields}>
              <View style={s.cashFieldWrap}>
                <Text style={s.fieldLabel}>
                  Amount <Text style={s.optionalTag}>(optional)</Text>
                </Text>
                <View style={s.cashInputWrap}>
                  <Text style={s.cashPrefix}>{cash.currency}</Text>
                  <TextInput
                    style={s.cashInput}
                    value={cash.amount}
                    onChangeText={(v) => updateCash({ amount: v.replace(/[^0-9.]/g, '') })}
                    placeholder="0.00"
                    placeholderTextColor={G2}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <View style={s.cashFieldWrap}>
                <Text style={s.fieldLabel}>Allocation %</Text>
                <View style={[s.cashInputWrap, { backgroundColor: S1 }]}>
                  <Text style={[s.cashInput, { color: displayCash.allocation !== '0' ? W : G2 }]}>
                    {displayCash.allocation !== '0' ? displayCash.allocation : '-'}
                  </Text>
                  {displayCash.allocation !== '0' && <Text style={s.cashSuffix}>%</Text>}
                </View>
              </View>
            </View>
          </View>

          {/* Holdings */}
          {holdings.map((h) => (
            <HoldingRow
              key={h.id}
              holding={h}
              onChange={(updated) => updateHolding(h.id, updated)}
              onDelete={() => deleteHolding(h.id)}
              livePrice={prices[h.ticker.ticker]}
              liveAllocation={liveAllocations[h.id]}
              liveCurrency={currencies[h.ticker.ticker]}
              pricesLoading={pricesLoading}
            />
          ))}

          {/* Add holding */}
          {adding ? (
            <View style={s.addCard}>
              <Text style={s.addCardLabel}>Search for a ticker</Text>
              <TickerSearch value={newTicker} onChange={setNewTicker} />
              <View style={s.addCardActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => { setAdding(false); setNewTicker(null); }}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.confirmBtn, !newTicker && s.confirmBtnOff]}
                  onPress={addHolding}
                  disabled={!newTicker}
                >
                  <Text style={[s.confirmBtnText, !newTicker && { color: G2 }]}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={s.addBtn} onPress={() => setAdding(true)} activeOpacity={0.7}>
              <Ionicons name="add" size={18} color={G1} />
              <Text style={s.addBtnText}>Add position</Text>
            </TouchableOpacity>
          )}

          {holdings.length === 0 && !adding && (
            <Text style={s.emptyHint}>
              Add your holdings to unlock portfolio analysis across all skills.
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: BG },
  flex:  { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 12, paddingBottom: 48 },

  header: {
    paddingHorizontal: 24, paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 28, fontWeight: '700', color: W, letterSpacing: -0.5, fontFamily: SERIF },
  headerSub:   { fontSize: 14, color: G1, marginTop: 4, lineHeight: 20, fontFamily: 'Spectral_400Regular' },
  saveBtn:     { backgroundColor: GOLD, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  saveBtnText: { color: BG, fontSize: 14, fontWeight: '600' },

  liveBar:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 24, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE },
  liveBarText: { flex: 1, color: '#10B981', fontSize: 12 },

  addCard:        { backgroundColor: S1, borderRadius: 14, padding: 16, gap: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  addCardLabel:   { color: G2, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  addCardActions: { flexDirection: 'row', gap: 10 },
  cancelBtn:      { flex: 1, paddingVertical: 11, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: LINE, alignItems: 'center' },
  cancelBtnText:  { color: G2, fontSize: 14 },
  confirmBtn:     { flex: 1, backgroundColor: GOLD, paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  confirmBtnOff:  { backgroundColor: S1, borderWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  confirmBtnText: { color: BG, fontSize: 14, fontWeight: '600' },
  addBtn:         { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: LINE, backgroundColor: S1 },
  addBtnText:     { color: G1, fontSize: 15 },
  emptyHint:      { color: G2, fontSize: 13, lineHeight: 19, textAlign: 'center', paddingHorizontal: 20, paddingTop: 8 },

  // Cash card
  cashCard:       { backgroundColor: S1, borderRadius: 14, padding: 14, gap: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  cashTopRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cashBadge:      { backgroundColor: '#042228', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  cashBadgeText:  { color: '#06B6D4', fontSize: 12, fontWeight: '700' },
  cashCardTitle:  { color: G1, fontSize: 14, fontWeight: '500' },
  fieldLabel:     { color: G2, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  optionalTag:    { color: G2, fontSize: 10, fontWeight: '400', textTransform: 'none' },
  cashFields:     { flexDirection: 'row', gap: 10 },
  cashFieldWrap:  { flex: 1 },
  cashInputWrap:  { flexDirection: 'row', alignItems: 'center', backgroundColor: BG, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: LINE, paddingHorizontal: 10 },
  cashPrefix:     { color: G2, fontSize: 11, marginRight: 6 },
  cashSuffix:     { color: G2, fontSize: 14, marginLeft: 4 },
  cashInput:      { flex: 1, color: W, fontSize: 14, paddingVertical: 9 },

  currencySelector:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: BG, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: LINE, paddingHorizontal: 10, paddingVertical: 10 },
  currencyValue:         { color: W, fontSize: 14, fontWeight: '600' },
  currencyDropdown:      { backgroundColor: S1, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: LINE, marginTop: 4, overflow: 'hidden' },
  currencyOption:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  currencyOptionBorder:  { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE },
  currencyOptionText:    { color: G1, fontSize: 14 },
});

const lock = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 40 },
  iconWrap:  { width: 72, height: 72, borderRadius: 36, backgroundColor: S1, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: LINE, marginBottom: 8 },
  title:     { fontSize: 26, fontWeight: '700', color: W, letterSpacing: -0.5 },
  sub:       { color: G2, fontSize: 14, textAlign: 'center', lineHeight: 21 },
  btn:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: GOLD, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, marginTop: 12 },
  btnText:   { color: BG, fontSize: 15, fontWeight: '600' },
});

const tv = StyleSheet.create({
  container:   { backgroundColor: S1, borderRadius: 14, padding: 16, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  topRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label:       { color: G2, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  currencyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: BG, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  currencyText:{ color: G1, fontSize: 12, fontWeight: '600' },
  dropdown:    { backgroundColor: BG, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: LINE, overflow: 'hidden' },
  option:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  optionBorder:{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE },
  optionText:  { color: G1, fontSize: 13 },
  value:       { color: W, fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
});

const row = StyleSheet.create({
  container: { backgroundColor: S1, borderRadius: 14, padding: 14, gap: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  topRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tickerBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge:          { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, flexShrink: 0 },
  badgeText:      { fontSize: 12, fontWeight: '700' },
  nameWrap:       { gap: 2 },
  ticker:    { color: W, fontSize: 14, fontWeight: '700' },
  name:      { color: G2, fontSize: 12 },
  sector:    { color: G2, fontSize: 11, fontStyle: 'italic' },
  fields:    { flexDirection: 'row', gap: 10 },
  fieldWrap: { flex: 1, gap: 6 },
  label:     { color: G2, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: BG, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: LINE, paddingHorizontal: 10 },
  input:     { flex: 1, color: W, fontSize: 14, paddingVertical: 9 },
  prefix:    { color: G2, fontSize: 14, marginRight: 4 },
  suffix:    { color: G2, fontSize: 14, marginLeft: 4 },
});

const ch = StyleSheet.create({
  container:         { backgroundColor: S1, borderRadius: 16, padding: 16, gap: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  topRow:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:             { color: W, fontSize: 15, fontWeight: '600' },
  dropdown:          { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: BG, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  dropdownText:      { color: G1, fontSize: 12 },
  dropdownMenu:      { backgroundColor: BG, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: LINE, overflow: 'hidden', alignSelf: 'flex-end' },
  dropdownItem:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, gap: 24 },
  dropdownItemBorder:{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE },
  dropdownItemText:  { color: G1, fontSize: 13 },
  body:              { flexDirection: 'row', alignItems: 'center', gap: 16 },
  legend:            { flex: 1, gap: 8 },
  legendRow:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot:         { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  legendLabel:       { flex: 1, color: G1, fontSize: 12 },
  legendValue:       { color: W, fontSize: 12, fontWeight: '600' },
});
