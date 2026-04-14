import { useState, useEffect } from 'react';

// Fetches USD-based exchange rates from a free, no-auth endpoint.
// rates['EUR'] = 0.923 means 1 USD = 0.923 EUR.
export function useFxRates(): Record<string, number> | null {
  const [rates, setRates] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    fetch('https://api.exchangerate-api.com/v4/latest/USD')
      .then((r) => r.json())
      .then((json) => { if (json?.rates) setRates(json.rates); })
      .catch(() => {});
  }, []);

  return rates;
}

// Convert an amount from one currency to another using USD-based rates.
export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>,
): number {
  if (from === to || amount === 0) return amount;
  const fromRate = rates[from] ?? 1;
  const toRate   = rates[to]   ?? 1;
  return (amount / fromRate) * toRate;
}
