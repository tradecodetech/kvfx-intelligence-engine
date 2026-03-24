/**
 * KVFX Live Price API — TwelveData Integration
 *
 * Two fetch strategies:
 *
 *   fetchLivePrice(pair)         — single-pair, 15-second in-memory cache.
 *                                  Used by the analysis path for conversational messages.
 *
 *   fetchLivePricesForScan(pairs) — multi-pair, parallel, NO cache.
 *                                   Always bypasses in-memory cache and disables Vercel
 *                                   HTTP data cache (cache: 'no-store'). Used by the
 *                                   command/scan path so every scan reflects the
 *                                   current market, not a prior request's prices.
 *
 * Env:  TWELVEDATA_API_KEY
 * Docs: https://twelvedata.com/docs#price
 */

// ── Symbol Map (KVFX internal → TwelveData format) ───────────────────────────

const SYMBOL_MAP: Record<string, string> = {
  // Major Forex
  EURUSD:  "EUR/USD",
  GBPUSD:  "GBP/USD",
  USDJPY:  "USD/JPY",
  AUDUSD:  "AUD/USD",
  USDCAD:  "USD/CAD",
  USDCHF:  "USD/CHF",
  NZDUSD:  "NZD/USD",
  // Cross pairs
  GBPJPY:  "GBP/JPY",
  EURJPY:  "EUR/JPY",
  AUDJPY:  "AUD/JPY",
  CADJPY:  "CAD/JPY",
  CHFJPY:  "CHF/JPY",
  EURAUD:  "EUR/AUD",
  EURGBP:  "EUR/GBP",
  NZDJPY:  "NZD/JPY",
  // Commodities
  GOLD:    "XAU/USD",
  XAUUSD:  "XAU/USD",
  SILVER:  "XAG/USD",
  XAGUSD:  "XAG/USD",
  OIL:     "WTI/USD",
  WTI:     "WTI/USD",
  USOIL:   "WTI/USD",
  // Indices
  NASDAQ:  "NDX",
  NAS100:  "NDX",
  SPX:     "SPX",
  SP500:   "SPX",
  US500:   "SPX",
  US30:    "DJI",
  DOW:     "DJI",
  DXY:     "DXY",
  // Crypto
  BTCUSD:  "BTC/USD",
  BTC:     "BTC/USD",
  ETHUSD:  "ETH/USD",
  ETH:     "ETH/USD",
};

// ── In-Memory Cache (analysis path only) ─────────────────────────────────────

interface CacheEntry {
  price:     number;
  fetchedAt: number;
}

const _cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15_000; // 15 seconds

function getCached(pair: string): number | null {
  const entry = _cache.get(pair);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    _cache.delete(pair);
    return null;
  }
  return entry.price;
}

function setCache(pair: string, price: number): void {
  _cache.set(pair, { price, fetchedAt: Date.now() });
}

// ── Shared Constants ──────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 5_000;
const BASE_URL = "https://api.twelvedata.com/price";

// ── Core fetch — always fresh, no-store ──────────────────────────────────────

/**
 * Fetches a single price directly from TwelveData with no caching.
 * - `cache: 'no-store'` disables Vercel's HTTP data cache so every call
 *   hits the upstream API and never returns a Vercel-cached response.
 * - Does NOT read or write the in-memory cache.
 */
async function fetchFreshPrice(pair: string): Promise<number | null> {
  const symbol = SYMBOL_MAP[pair.toUpperCase()];
  if (!symbol) return null;

  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const url = `${BASE_URL}?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;

    // cache: 'no-store' — opt out of Next.js/Vercel data cache entirely.
    // Every invocation reaches TwelveData's servers for a live quote.
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`⚠️ TwelveData HTTP ${res.status} for ${symbol}`);
      return null;
    }

    const data: unknown = await res.json();

    if (
      !data ||
      typeof data !== "object" ||
      !("price" in data) ||
      typeof (data as Record<string, unknown>).price !== "string"
    ) {
      console.warn(`⚠️ TwelveData unexpected response for ${symbol}:`, data);
      return null;
    }

    const price = parseFloat((data as { price: string }).price);
    if (!isFinite(price) || price <= 0) return null;

    return price;
  } catch (err) {
    clearTimeout(timer);
    const isAbort = err instanceof Error && err.name === "AbortError";
    console.warn(
      isAbort
        ? `⏱ TwelveData timeout for ${symbol}`
        : `⚠️ TwelveData error for ${symbol}: ${err}`
    );
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetches the live price for a single pair.
 * Uses a 15-second in-memory cache — suitable for the analysis path where
 * a conversational message triggers one price lookup per request.
 */
export async function fetchLivePrice(pair: string): Promise<number | null> {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ TWELVEDATA_API_KEY not configured — live prices disabled");
    return null;
  }

  // Return cached price if still fresh
  const cached = getCached(pair);
  if (cached !== null) {
    console.log(`💹 CACHED PRICE: ${pair} = ${cached}`);
    return cached;
  }

  const price = await fetchFreshPrice(pair);

  if (price !== null) {
    setCache(pair, price);
    console.log(`💹 LIVE PRICE: ${pair} (${SYMBOL_MAP[pair.toUpperCase()] ?? pair}) = ${price}`);
  }

  return price;
}

/**
 * Fetches live prices for multiple pairs in parallel.
 *
 * Always bypasses the in-memory cache and uses cache: 'no-store' on every
 * request. Designed for market scans where:
 *   - Each pair needs its own independent fresh quote
 *   - No price should be reused from a prior scan or analysis call
 *   - Vercel must not serve a cached response for any pair
 *
 * Returns a map of { PAIR_SYMBOL → price | null }.
 * Pairs with no TwelveData mapping, API errors, or timeouts return null —
 * the caller decides how to handle missing prices.
 */
export async function fetchLivePricesForScan(
  pairs: string[]
): Promise<Record<string, number | null>> {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ TWELVEDATA_API_KEY not configured — scan prices unavailable");
    return Object.fromEntries(pairs.map((p) => [p.toUpperCase(), null]));
  }

  const upperPairs = [...new Set(pairs.map((p) => p.toUpperCase()))];

  const results = await Promise.allSettled(
    upperPairs.map(async (pair) => {
      const price = await fetchFreshPrice(pair);
      return { pair, price };
    })
  );

  const prices: Record<string, number | null> = {};
  for (const result of results) {
    if (result.status === "fulfilled") {
      prices[result.value.pair] = result.value.price;
      if (result.value.price !== null) {
        console.log(
          `💹 SCAN PRICE: ${result.value.pair} (${SYMBOL_MAP[result.value.pair] ?? result.value.pair}) = ${result.value.price}`
        );
      }
    }
  }

  return prices;
}

/** Expose the symbol map so callers can check if a pair is supported. */
export function isSupportedPair(pair: string): boolean {
  return pair.toUpperCase() in SYMBOL_MAP;
}
