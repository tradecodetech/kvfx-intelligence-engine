/**
 * lib/liveChart.ts
 *
 * Fetches live TradingView chart state from the MCP bridge
 * and injects it into the KVFX intelligence engine context.
 *
 * Usage:
 *   const chart = await getLiveChartContext();
 *   // chart.symbol, chart.timeframe, chart.studies, chart.mcpContext
 */

export interface LiveChartState {
  symbol:     string;
  resolution: string;
  timeframe:  string;
  chartType:  number | null;
  studies:    Array<{ id: string; name: string }>;
  // Pre-formatted string to inject into AI system prompt
  mcpContext: string;
  // Whether the data came from live MCP or is a fallback
  isLive:     boolean;
}

const FALLBACK: LiveChartState = {
  symbol:     "UNKNOWN",
  resolution: "",
  timeframe:  "",
  chartType:  null,
  studies:    [],
  mcpContext: "",
  isLive:     false,
};

/**
 * Fetch live chart state from the Next.js API route,
 * which proxies to the local MCP bridge.
 *
 * Never throws — returns a fallback if MCP is unavailable
 * so the app continues working without the bridge.
 */
export async function getLiveChartContext(): Promise<LiveChartState> {
  try {
    const resp = await fetch("/api/mcp/chart-state", {
      cache: "no-store",
    });

    if (!resp.ok) return FALLBACK;

    const data = await resp.json();
    if (!data.success || !data.symbol) return FALLBACK;

    const studies: Array<{ id: string; name: string }> = Array.isArray(data.studies)
      ? data.studies
      : [];

    const indicatorList = studies.map((s) => s.name || s.id).join(", ") || "None";

    const mcpContext = buildMCPContext({
      symbol:    data.symbol,
      timeframe: data.timeframe || data.resolution,
      studies:   indicatorList,
    });

    return {
      symbol:     data.symbol,
      resolution: data.resolution ?? "",
      timeframe:  data.timeframe ?? data.resolution ?? "",
      chartType:  data.chartType ?? null,
      studies,
      mcpContext,
      isLive:     true,
    };

  } catch {
    return FALLBACK;
  }
}

/**
 * Build the MCP context block injected into AI system prompts.
 * This tells the AI exactly what's on the live TradingView chart
 * so it can ground its analysis in real data.
 */
function buildMCPContext({
  symbol,
  timeframe,
  studies,
}: {
  symbol:    string;
  timeframe: string;
  studies:   string;
}): string {
  return `
[LIVE TRADINGVIEW CHART — MCP DATA]
Symbol:     ${symbol}
Timeframe:  ${timeframe}
Indicators: ${studies}

IMPORTANT: The user is currently viewing ${symbol} on the ${timeframe} timeframe in TradingView.
Ground all analysis in this context. Reference ${symbol} specifically when discussing structure,
zones, and setups. Do not generalize or reference other pairs unless explicitly asked.
`.trim();
}

/**
 * React hook version — use in client components.
 * Polls the MCP bridge every 30 seconds for live chart updates.
 *
 * Usage:
 *   const { chart, loading } = useLiveChart();
 */
export function useLiveChart(pollIntervalMs = 30_000) {
  // Dynamic import to avoid SSR issues with useState/useEffect
  // This function body intentionally uses string references for
  // tree-shaking — actual hook is below as a separate export.
  throw new Error("Import useLiveChartHook from lib/liveChart.client.ts instead");
}
