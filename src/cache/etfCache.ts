/**
 * ETF data cache - 24-hour TTL per ticker.
 *
 * ETF data (AUM, expense ratio, top holdings) changes slowly. Caching
 * responses per ticker for 24 hours means repeated questions about the
 * same fund skip the web search step entirely, cutting latency and cost.
 *
 * Backed by AsyncStorage so cache survives app backgrounding.
 * The cache stores the full Claude response text, keyed by ticker.
 *
 * PRD reference: §4.4 Cost Management - "If 50 users ask about VOO today,
 * web search runs once."
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CacheEntry } from '@/types';

const CACHE_PREFIX = 'etf_cache_v1_';
const TTL_24H = 24 * 60 * 60 * 1000; // ms

// ─── Generic cache helpers ─────────────────────────────────────────────────────

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;

    const entry: CacheEntry<T> = JSON.parse(raw);
    const age = Date.now() - entry.cachedAt;

    if (age > entry.ttlMs) {
      // Expired - delete silently
      await AsyncStorage.removeItem(key);
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

async function writeCache<T>(key: string, data: T, ttlMs = TTL_24H): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, cachedAt: Date.now(), ttlMs };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Cache writes are best-effort - never block the user
  }
}

// ─── ETF-specific cache ────────────────────────────────────────────────────────

/**
 * Normalises a ticker to an uppercase cache key.
 * "voo" and "VOO" resolve to the same entry.
 */
function etfCacheKey(ticker: string): string {
  return `${CACHE_PREFIX}${ticker.toUpperCase().trim()}`;
}

/**
 * Returns a cached analysis response for a given ticker, or null if absent/expired.
 */
export async function getCachedEtfAnalysis(ticker: string): Promise<string | null> {
  return readCache<string>(etfCacheKey(ticker));
}

/**
 * Stores an analysis response for a given ticker with a 24h TTL.
 */
export async function setCachedEtfAnalysis(ticker: string, analysis: string): Promise<void> {
  return writeCache(etfCacheKey(ticker), analysis, TTL_24H);
}

/**
 * Extracts the first uppercase ticker symbol from a user message.
 * Returns null if no recognisable ticker is found.
 *
 * Examples:
 *   "Analyze VOO" → "VOO"
 *   "Compare VOO and QQQ" → "VOO" (first match)
 *   "What is an ETF?" → null
 */
export function extractTicker(message: string): string | null {
  // Match isolated uppercase 1-5 letter words that look like tickers
  const match = message.match(/\b([A-Z]{1,5})\b/);
  return match?.[1] ?? null;
}

/**
 * Returns age of a cached entry in human-readable form, or null if not cached.
 */
export async function getCacheAge(ticker: string): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(etfCacheKey(ticker));
    if (!raw) return null;

    const entry: CacheEntry<unknown> = JSON.parse(raw);
    const ageMs = Date.now() - entry.cachedAt;
    const ageH = Math.floor(ageMs / (1000 * 60 * 60));
    const ageM = Math.floor((ageMs % (1000 * 60 * 60)) / (1000 * 60));

    return ageH > 0 ? `${ageH}h ${ageM}m ago` : `${ageM}m ago`;
  } catch {
    return null;
  }
}

/**
 * Clears the cache for a specific ticker (e.g. when user wants fresh data).
 */
export async function invalidateEtfCache(ticker: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(etfCacheKey(ticker));
  } catch {
    // Ignore
  }
}

/**
 * Clears all ETF cache entries.
 */
export async function clearAllEtfCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const etfKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (etfKeys.length > 0) {
      await AsyncStorage.multiRemove(etfKeys);
    }
  } catch {
    // Ignore
  }
}
