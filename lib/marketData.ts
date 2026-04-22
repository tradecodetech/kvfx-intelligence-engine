/**
 * Yahoo Finance market data fetcher (~15 min delayed)
 * Used by the macro-engine mode to inject live prices into the AI system prompt.
 */

const YAHOO_SYMBOLS = [
  "DX-Y.NYB",  // DXY
  "^TNX",      // US 10Y Yield
  "^FVX",      // US 5Y Yield (closest proxy for short end)
  "EURUSD=X",
  "GBPUSD=X",
  "JPY=X",     // USD/JPY
  "AUDUSD=X",
  "USDCAD=X",
  "USDCHF=X",
  "NZDUSD=X",
  "GC=F",      // Gold
  "CL=F",      // WTI Crude
  "^GSPC",     // S&P 500
  "^NDX",      // Nasdaq 100
  "^VIX",
].join(",");

export type PriceEntry = {
  price: number;
  change: number;
  changePct: number;
};

export type MarketSnapshot = Record<string, PriceEntry>;

export async function fetchMarketSnapshot(): Promise<MarketSnapshot | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${YAHOO_SYMBOLS}`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });

    if (!resp.ok) return null;

    const data = await resp.json();
    const quotes: Array<{
      symbol: string;
      regularMarketPrice?: number;
      regularMarketChange?: number;
      regularMarketChangePercent?: number;
    }> = data?.quoteResponse?.result ?? [];

    const snapshot: MarketSnapshot = {};
    for (const q of quotes) {
      if (q.regularMarketPrice != null) {
        snapshot[q.symbol] = {
          price: q.regularMarketPrice,
          change: q.regularMarketChange ?? 0,
          changePct: q.regularMarketChangePercent ?? 0,
        };
      }
    }

    return Object.keys(snapshot).length > 0 ? snapshot : null;
  } catch {
    return null;
  }
}

export function buildMarketDataBlock(snapshot: MarketSnapshot): string {
  const f = (sym: string, decimals = 2): string => {
    const e = snapshot[sym];
    if (!e) return "N/A";
    const sign = e.changePct >= 0 ? "+" : "";
    return `${e.price.toFixed(decimals)} (${sign}${e.changePct.toFixed(2)}%)`;
  };

  const usdjpy = snapshot["JPY=X"];
  const usdJpyStr = usdjpy
    ? `${usdjpy.price.toFixed(3)} (${usdjpy.changePct >= 0 ? "+" : ""}${usdjpy.changePct.toFixed(2)}%)`
    : "N/A";

  return `[LIVE MARKET DATA — Yahoo Finance, ~15min delay]
DXY:    ${f("DX-Y.NYB")}
US10Y:  ${f("^TNX", 3)}%
US5Y:   ${f("^FVX", 3)}%
EURUSD: ${f("EURUSD=X")}
GBPUSD: ${f("GBPUSD=X")}
USDJPY: ${usdJpyStr}
AUDUSD: ${f("AUDUSD=X")}
USDCAD: ${f("USDCAD=X")}
USDCHF: ${f("USDCHF=X")}
NZDUSD: ${f("NZDUSD=X")}
Gold:   ${f("GC=F")}
WTI:    ${f("CL=F")}
SPX:    ${f("^GSPC")}
NDX:    ${f("^NDX")}
VIX:    ${f("^VIX")}

Use these EXACT prices in your MARKET SNAPSHOT section. Do not substitute estimates or placeholders.`;
}
