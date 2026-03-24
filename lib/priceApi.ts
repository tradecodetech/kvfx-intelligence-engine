/**
 * KVFX Live Price API — TwelveData Integration
 *
 * Fetches real-time prices for detected instruments.
 * Results are cached for 15 seconds to avoid hammering the API.
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

// ── In-Memory Cache ───────────────────────────────────────────────────────────

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

// ── Fetch ─────────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 5_000;
const BASE_URL = "https://api.twelvedata.com/price";

/**
 * Fetches the live price for an internal KVFX pair symbol.
 * Returns null on any failure (no key, unknown symbol, timeout, API error).
 */
export async function fetchLivePrice(pair: string): Promise<number | null> {
  const symbol = SYMBOL_MAP[pair.toUpperCase()];
  if (!symbol) return null;

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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const url = `${BASE_URL}?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`⚠️ TwelveData HTTP ${res.status} for ${symbol}`);
      return null;
    }

    const data: unknown = await res.json();

    // TwelveData returns { price: "1.08542" } on success
    // or { code: 404, message: "...", status: "error" } on failure
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

    setCache(pair, price);
    console.log(`💹 LIVE PRICE: ${pair} (${symbol}) = ${price}`);
    return price;
  } catch (err) {
    clearTimeout(timer);
    const isAbort = err instanceof Error && err.name === "AbortError";
    console.warn(isAbort ? `⏱ TwelveData timeout for ${symbol}` : `⚠️ TwelveData error: ${err}`);
    return null;
  }
}

/** Expose the symbol map so callers can check if a pair is supported. */
export function isSupportedPair(pair: string): boolean {
  return pair.toUpperCase() in SYMBOL_MAP;
}
