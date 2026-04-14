import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { searchTickers, type TickerInfo, type AssetType } from '@/data/tickerSearch';

import { S1, S2, LINE, W, G1, G2 } from '@/theme';

const TYPE_COLORS: Record<AssetType, { bg: string; text: string }> = {
  Stock:     { bg: '#0E1C2A', text: '#3B82F6' },  // blue
  ETF:       { bg: '#181428', text: '#8B5CF6' },  // violet
  Crypto:    { bg: '#251A0A', text: '#F97316' },  // orange
  Commodity: { bg: '#241C08', text: '#F59E0B' },  // amber
  Bond:      { bg: '#0A2018', text: '#10B981' },  // emerald
  Other:     { bg: '#161E16', text: '#9CA3AF' },  // grey
};

interface Props {
  value: TickerInfo | null;
  onChange: (ticker: TickerInfo | null) => void;
  placeholder?: string;
}

export function TickerSearch({ value, onChange, placeholder = 'Search ticker or company name...' }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TickerInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setLoading(false); return; }

    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const found = await searchTickers(query);
      setResults(found);
      setLoading(false);
    }, 350);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const select = (t: TickerInfo) => {
    onChange(t);
    setQuery('');
    setResults([]);
    setOpen(false);
    inputRef.current?.blur();
  };

  if (value) {
    const colors = TYPE_COLORS[value.assetType] ?? TYPE_COLORS.Other;
    return (
      <TouchableOpacity style={s.selected} onPress={() => onChange(null)}>
        <View style={s.selectedLeft}>
          <Text style={s.selectedTicker}>{value.ticker}</Text>
          <View style={s.selectedRight}>
            <View style={s.selectedNameRow}>
              <Text style={s.selectedName} numberOfLines={1}>{value.name}</Text>
              <View style={[s.typeBadge, { backgroundColor: colors.bg }]}>
                <Text style={[s.typeBadgeText, { color: colors.text }]}>{value.assetType ?? 'Stock'}</Text>
              </View>
            </View>
            {value.exchange ? (
              <Text style={s.selectedExchange}>{value.exchange}</Text>
            ) : null}
          </View>
        </View>
        <Text style={s.clearBtn}>✕</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View>
      <View style={s.inputWrap}>
        <TextInput
          ref={inputRef}
          style={s.input}
          value={query}
          onChangeText={(t) => { setQuery(t); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          placeholderTextColor={G2}
          autoCorrect={false}
          autoCapitalize="characters"
        />
        {loading && <ActivityIndicator size="small" color={G2} style={s.spinner} />}
      </View>

      {open && results.length > 0 && (
        <View style={s.dropdown}>
          {results.map((item, i) => (
            <View key={`${item.ticker}_${i}`}>
              {i > 0 && <View style={s.sep} />}
              <TouchableOpacity style={s.row} onPress={() => select(item)} activeOpacity={0.7}>
                <Text style={s.rowTicker}>{item.ticker}</Text>
                <View style={s.rowRight}>
                  <View style={s.rowNameRow}>
                    <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
                    <View style={[s.typeBadge, { backgroundColor: TYPE_COLORS[item.assetType].bg }]}>
                      <Text style={[s.typeBadgeText, { color: TYPE_COLORS[item.assetType].text }]}>{item.assetType}</Text>
                    </View>
                  </View>
                  {item.exchange ? <Text style={s.rowExchange}>{item.exchange}</Text> : null}
                </View>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {open && !loading && query.trim().length > 1 && results.length === 0 && (
        <View style={s.dropdown}>
          <Text style={s.noResults}>No results for "{query}"</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  inputWrap: { position: 'relative' },
  input: {
    backgroundColor: S2,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    paddingRight: 40,
    color: W,
    fontSize: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  spinner: { position: 'absolute', right: 12, top: 12 },
  dropdown: {
    backgroundColor: S1,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    marginTop: 4,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10,
  },
  rowTicker: { color: W, fontSize: 13, fontWeight: '700', width: 60 },
  rowRight: { flex: 1 },
  rowName: { color: G1, fontSize: 13 },
  rowExchange: { color: G2, fontSize: 11, marginTop: 1 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: LINE },
  noResults: { color: G2, fontSize: 13, padding: 14 },
  selected: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: S2,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  selectedLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectedTicker: { color: W, fontSize: 14, fontWeight: '700', width: 60 },
  selectedRight: { flex: 1 },
  selectedNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectedName: { color: G1, fontSize: 13, flexShrink: 1 },
  selectedExchange: { color: G2, fontSize: 11, marginTop: 1 },
  clearBtn: { color: G2, fontSize: 14, paddingLeft: 8 },
  rowNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexShrink: 0,
  },
  typeBadgeText: { fontSize: 10, fontWeight: '600' },
});
