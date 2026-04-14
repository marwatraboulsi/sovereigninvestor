import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface VaultHolding {
  id: string;
  ticker: {
    ticker: string;
    name: string;
    exchange: string;
    assetType: string;
    sector?: string;
    currency?: string;
  };
  quantity?: string;
}

export interface VaultData {
  holdings: VaultHolding[];
  cash: { amount: string; currency: string };
  baseCurrency: string;
}

export function useVaultData(): VaultData | null {
  const [data, setData] = useState<VaultData | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [holdingsRes, profileRes] = await Promise.all([
        supabase.from('vault_holdings').select('*').eq('user_id', user.id),
        supabase.from('profiles').select('vault_cash, vault_base_currency').eq('id', user.id).single(),
      ]);

      const holdings: VaultHolding[] = (holdingsRes.data ?? []).map((row: any) => {
        let extra: any = {};
        try { extra = JSON.parse(row.notes || '{}'); } catch {}
        return {
          id: row.id,
          ticker: {
            ticker:    row.ticker,
            name:      row.name,
            exchange:  extra.exchange  ?? '',
            assetType: row.asset_type,
            sector:    extra.sector    ?? undefined,
            currency:  extra.currency  ?? undefined,
          },
          quantity: row.shares != null ? String(row.shares) : undefined,
        };
      });

      const prof = profileRes.data;
      setData({
        holdings,
        cash:         prof?.vault_cash ?? { amount: '', currency: 'USD' },
        baseCurrency: prof?.vault_base_currency ?? 'USD',
      });
    })();
  }, []);

  return data;
}

export function formatPortfolioForReview(data: VaultData): string {
  const lines: string[] = ['Here is my current portfolio:\n'];

  for (const h of data.holdings) {
    const qty      = h.quantity && parseFloat(h.quantity) > 0 ? ` (${h.quantity} shares)` : '';
    const currency = h.ticker.currency ? ` (${h.ticker.currency})` : '';
    const sector   = h.ticker.sector   ? `, ${h.ticker.sector}`    : '';
    lines.push(`• ${h.ticker.ticker} ${h.ticker.name} [${h.ticker.assetType}${sector}]${currency}${qty}`);
  }

  const cashAmt = parseFloat(data.cash.amount || '0');
  if (cashAmt > 0) {
    lines.push(`• Cash ${data.cash.currency} ${cashAmt.toLocaleString()}`);
  }

  if (lines.length === 1) return '';

  lines.push(`\nBase currency: ${data.baseCurrency}`);
  lines.push('\nPlease conduct a full Four-Dimension Portfolio Review.');

  return lines.join('\n');
}
