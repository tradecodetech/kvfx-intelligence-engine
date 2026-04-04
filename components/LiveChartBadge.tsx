"use client";
import { useLiveChartHook } from "@/lib/liveChart.client";
export default function LiveChartBadge() {
  const { chart, loading, refresh } = useLiveChartHook(60_000);
  if (loading) return <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-500 animate-pulse"><span className="w-1.5 h-1.5 rounded-full bg-zinc-600" /><span className="font-mono text-[9px]">Chart...</span></div>;
  if (!chart?.isLive) return <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-500 cursor-pointer hover:border-zinc-600 transition-colors" onClick={refresh} title="No chart data"><span className="w-1.5 h-1.5 rounded-full bg-zinc-600" /><span className="font-mono text-[9px]">No chart</span></div>;
  const sym = chart.symbol.includes(":") ? chart.symbol.split(":")[1] : chart.symbol;
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs cursor-pointer transition-colors ${chart.isStale ? "hover:border-amber-500/50" : "hover:border-violet-500"}`} onClick={refresh}>
      <span className="relative flex h-1.5 w-1.5 flex-shrink-0">{!chart.isStale && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}<span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${chart.isStale ? "bg-amber-400" : "bg-emerald-500"}`} /></span>
      <span className="font-semibold text-white tracking-wide font-mono text-[11px]">{sym}</span>
      <span className="text-zinc-400 font-mono text-[10px]">{chart.timeframe || chart.resolution}</span>
      {chart.isStale && <span className="text-amber-500/70 font-mono text-[9px]">cached</span>}
    </div>
  );
}
