export interface LiveChartState { symbol: string; resolution: string; timeframe: string; chartType: number | null; studies: Array<{ id: string; name: string }>; mcpContext: string; isLive: boolean; isStale: boolean; pushedAt: string | null; }
const FALLBACK: LiveChartState = { symbol: "UNKNOWN", resolution: "", timeframe: "", chartType: null, studies: [], mcpContext: "", isLive: false, isStale: false, pushedAt: null };
const STALE_MS = 5 * 60 * 1000;
export async function getLiveChartContext(): Promise<LiveChartState> {
  try {
    const resp = await fetch("/api/mcp/chart-state", { cache: "no-store" });
    if (!resp.ok) return FALLBACK;
    const data = await resp.json();
    if (!data.success || !data.symbol) return FALLBACK;
    const studies: Array<{ id: string; name: string }> = Array.isArray(data.studies) ? data.studies : [];
    const indicatorList = studies.map((s) => s.name || s.id).join(", ") || "None";
    const pushedAt = data.pushedAt ?? null;
    const isStale = pushedAt ? Date.now() - new Date(pushedAt).getTime() > STALE_MS : false;
    const mcpContext = `[LIVE TRADINGVIEW CHART — MCP DATA]\nSymbol:     ${data.symbol}\nTimeframe:  ${data.timeframe || data.resolution}\nIndicators: ${indicatorList}${pushedAt ? `\nLast updated: ${new Date(pushedAt).toLocaleTimeString()}` : ""}\n\nIMPORTANT: The user is currently viewing ${data.symbol} on the ${data.timeframe || data.resolution} timeframe in TradingView. Ground all analysis in this context.`;
    return { symbol: data.symbol, resolution: data.resolution ?? "", timeframe: data.timeframe ?? data.resolution ?? "", chartType: data.chartType ?? null, studies, mcpContext, isLive: true, isStale, pushedAt };
  } catch { return FALLBACK; }
}
