/**
 * Market data fetcher for macro-engine mode.
 *
 * Sources:
 *  - Frankfurter API (api.frankfurter.app) — ECB FX rates, free, no auth, very reliable
 *  - Yahoo Finance chart API (query2) — equities, commodities, DXY, yields
 *    Uses individual chart endpoints which are far less restricted than batch quote API.
 *
 * Data is ~15 min delayed for Yahoo symbols; ECB FX rates update once daily ~4pm Frankfurt.
 */

export type PriceEntry = { price: number; changePct: number };
export type MarketSnapshot = Record<string, PriceEntry>;

// ─── Yahoo Finance chart API ───────────────────────────────────────────────

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://finance.yahoo.com/",
  Origin: "https://finance.yahoo.com",
};

async function fetchYahoo(symbol: string): Promise<PriceEntry | null> {
  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const resp = await fetch(url, {
      headers: YAHOO_HEADERS,
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;
    const price = meta.regularMarketPrice as number;
    const prev = (meta.chartPreviousClose ?? meta.previousClose ?? price) as number;
    const changePct = prev ? ((price - prev) / prev) * 100 : 0;
    return { price, changePct };
  } catch {
    return null;
  }
}

// ─── Frankfurter FX rates (ECB) ────────────────────────────────────────────

async function fetchFXRates(): Promise<Record<string, number> | null> {
  try {
    const resp = await fetch(
      "https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,AUD,CAD,CHF,NZD",
      { signal: AbortSignal.timeout(5000), cache: "no-store" }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.rates ?? null;
  } catch {
    return null;
  }
}

// ─── Main fetcher ──────────────────────────────────────────────────────────

export async function fetchMarketSnapshot(): Promise<MarketSnapshot | null> {
  // Fetch FX and Yahoo data in parallel
  const [fxRates, dxy, us10y, us5y, gold, wti, spx, ndx, vix] = await Promise.all([
    fetchFXRates(),
    fetchYahoo("DX-Y.NYB"),
    fetchYahoo("^TNX"),
    fetchYahoo("^FVX"),
    fetchYahoo("GC=F"),
    fetchYahoo("CL=F"),
    fetchYahoo("^GSPC"),
    fetchYahoo("^NDX"),
    fetchYahoo("^VIX"),
  ]);

  const snapshot: MarketSnapshot = {};

  // FX pairs derived from USD base rates (Frankfurter)
  if (fxRates) {
    const add = (key: string, price: number) => {
      snapshot[key] = { price, changePct: 0 }; // ECB rates don't include intraday change
    };
    if (fxRates.EUR) add("EURUSD", parseFloat((1 / fxRates.EUR).toFixed(5)));
    if (fxRates.GBP) add("GBPUSD", parseFloat((1 / fxRates.GBP).toFixed(5)));
    if (fxRates.JPY) add("USDJPY", parseFloat(fxRates.JPY.toFixed(3)));
    if (fxRates.AUD) add("AUDUSD", parseFloat((1 / fxRates.AUD).toFixed(5)));
    if (fxRates.CAD) add("USDCAD", parseFloat(fxRates.CAD.toFixed(5)));
    if (fxRates.CHF) add("USDCHF", parseFloat(fxRates.CHF.toFixed(5)));
    if (fxRates.NZD) add("NZDUSD", parseFloat((1 / fxRates.NZD).toFixed(5)));
  }

  // Yahoo Finance data
  if (dxy)   snapshot["DXY"]   = dxy;
  if (us10y) snapshot["US10Y"] = us10y;
  if (us5y)  snapshot["US5Y"]  = us5y;
  if (gold)  snapshot["GOLD"]  = gold;
  if (wti)   snapshot["WTI"]   = wti;
  if (spx)   snapshot["SPX"]   = spx;
  if (ndx)   snapshot["NDX"]   = ndx;
  if (vix)   snapshot["VIX"]   = vix;

  return Object.keys(snapshot).length > 0 ? snapshot : null;
}

// ─── System prompt block ───────────────────────────────────────────────────

export function buildMarketDataBlock(snapshot: MarketSnapshot): string {
  const fmt = (key: string, decimals = 2, suffix = ""): string => {
    const e = snapshot[key];
    if (!e) return "N/A";
    const sign = e.changePct >= 0 ? "+" : "";
    const chg = e.changePct !== 0 ? ` (${sign}${e.changePct.toFixed(2)}%)` : "";
    return `${e.price.toFixed(decimals)}${suffix}${chg}`;
  };

  return `[LIVE MARKET DATA — Frankfurter/Yahoo Finance]
DXY:    ${fmt("DXY")}
US10Y:  ${fmt("US10Y", 3)}%
US5Y:   ${fmt("US5Y", 3)}%
EURUSD: ${fmt("EURUSD")}
GBPUSD: ${fmt("GBPUSD")}
USDJPY: ${fmt("USDJPY", 3)}
AUDUSD: ${fmt("AUDUSD")}
USDCAD: ${fmt("USDCAD")}
USDCHF: ${fmt("USDCHF")}
NZDUSD: ${fmt("NZDUSD")}
Gold:   ${fmt("GOLD")}
WTI:    ${fmt("WTI")}
SPX:    ${fmt("SPX")}
NDX:    ${fmt("NDX")}
VIX:    ${fmt("VIX", 2)}

CRITICAL: Use ONLY the values above in your MARKET SNAPSHOT output. Do NOT use your training data estimates or any other prices. These are real current prices.`;
}
