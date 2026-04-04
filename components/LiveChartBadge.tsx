"use client";

/**
 * components/LiveChartBadge.tsx
 *
 * Shows the currently active TradingView chart symbol and timeframe
 * in the WhisperZonez UI. Green dot = MCP connected, grey = offline.
 *
 * Drop this anywhere in your layout — Sidebar, ChatUI header, etc.
 *
 * Usage:
 *   import LiveChartBadge from "@/components/LiveChartBadge";
 *   <LiveChartBadge />
 */

import { useLiveChartHook } from "@/lib/liveChart.client";

export default function LiveChartBadge() {
  const { chart, loading, refresh } = useLiveChartHook(30_000);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-500 animate-pulse">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
        Connecting to chart...
      </div>
    );
  }

  if (!chart?.isLive) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-500 cursor-pointer hover:border-zinc-600 transition-colors"
        onClick={refresh}
        title="MCP bridge offline — click to retry"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
        No chart connected
      </div>
    );
  }

  // Strip exchange prefix for display: "OANDA:EURUSD" → "EURUSD"
  const displaySymbol = chart.symbol.includes(":")
    ? chart.symbol.split(":")[1]
    : chart.symbol;

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs cursor-pointer hover:border-violet-500 transition-colors group"
      onClick={refresh}
      title={`Live chart: ${chart.symbol} · Click to refresh`}
    >
      {/* Live indicator dot */}
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
      </span>

      {/* Symbol */}
      <span className="font-semibold text-white tracking-wide">
        {displaySymbol}
      </span>

      {/* Timeframe */}
      <span className="text-zinc-400">
        {chart.timeframe || chart.resolution}
      </span>

      {/* Indicators (if any beyond default) */}
      {chart.studies.length > 0 && (
        <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors hidden sm:inline">
          · {chart.studies.map((s) => s.name).join(", ")}
        </span>
      )}
    </div>
  );
}
