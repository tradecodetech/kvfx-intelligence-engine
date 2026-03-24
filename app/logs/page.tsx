"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

type Trade = {
  id: string;
  created_at: string;
  pair: string;
  bias: string;
  structure: string | null;
  rr: number | null;
  result: string | null;
  notes: string | null;
  setup_type: string | null;
  session: string | null;
  timeframe: string | null;
};

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: number;
}

const EquityTooltip = ({ active, payload, label }: TooltipProps) => {
  if (active && payload && payload.length) {
    const val = payload[0].value;
    return (
      <div
        style={{
          background: "#0d1117",
          border: "1px solid #1a2540",
          padding: "8px 14px",
          borderRadius: 6,
          fontSize: 13,
        }}
      >
        <p style={{ color: "#718096", margin: "0 0 4px" }}>Trade #{label}</p>
        <p
          style={{
            color: val >= 0 ? "#22c55e" : "#ef4444",
            margin: 0,
            fontWeight: 600,
          }}
        >
          {val >= 0 ? "+" : ""}
          {val}R
        </p>
      </div>
    );
  }
  return null;
};

export default function LogsPage() {
  const [logs, setLogs] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterPair, setFilterPair] = useState("All");
  const [filterSession, setFilterSession] = useState("All");
  const [filterResult, setFilterResult] = useState("All");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("kvfx_trades")
      .select("*")
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("❌ FETCH ERROR:", fetchError);
      setError(fetchError.message || "Failed to load trades.");
      setLoading(false);
      return;
    }

    console.log("✅ FETCH SUCCESS:", data?.length ?? 0, "trades loaded");
    setLogs(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // ---- STATS ----
  const stats = useMemo(() => {
    const completed = logs.filter(
      (t) => t.result === "Win" || t.result === "Loss"
    );
    const winCount = completed.filter((t) => t.result === "Win").length;
    const lossCount = completed.filter((t) => t.result === "Loss").length;
    const total = logs.length;

    const winRate =
      completed.length > 0 ? (winCount / completed.length) * 100 : 0;

    const winRRs = logs
      .filter((t) => t.result === "Win")
      .map((t) => t.rr ?? 1);
    const totalWinR = winRRs.reduce((a, b) => a + b, 0);
    const avgWinRR = winRRs.length > 0 ? totalWinR / winRRs.length : 0;
    const totalLossR = lossCount;

    const expectancy =
      completed.length > 0
        ? (winCount / completed.length) * avgWinRR -
          (lossCount / completed.length) * 1
        : 0;

    const profitFactor =
      totalLossR > 0
        ? totalWinR / totalLossR
        : totalWinR > 0
        ? totalWinR
        : 0;

    // Running equity (final value)
    let equity = 0;
    for (const t of logs) {
      if (t.result === "Win") equity += t.rr ?? 1;
      else if (t.result === "Loss") equity -= 1;
    }

    return {
      total,
      winCount,
      lossCount,
      winRate: winRate.toFixed(1),
      avgRR: avgWinRR.toFixed(2),
      expectancy: expectancy.toFixed(2),
      profitFactor: profitFactor.toFixed(2),
      runningR: equity.toFixed(2),
    };
  }, [logs]);

  // ---- EQUITY CURVE ----
  const equityData = useMemo(() => {
    let equity = 0;
    return logs.map((trade, i) => {
      if (trade.result === "Win") equity += trade.rr ?? 1;
      else if (trade.result === "Loss") equity -= 1;
      return { trade: i + 1, equity: parseFloat(equity.toFixed(2)) };
    });
  }, [logs]);

  // ---- FILTER OPTIONS ----
  const uniquePairs = useMemo(
    () => ["All", ...Array.from(new Set(logs.map((t) => t.pair).filter(Boolean)))],
    [logs]
  );
  const uniqueSessions = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(logs.map((t) => t.session).filter(Boolean) as string[])
      ),
    ],
    [logs]
  );

  // ---- FILTERED LOGS (reversed = newest first) ----
  const filtered = useMemo(() => {
    return [...logs].reverse().filter((t) => {
      if (filterPair !== "All" && t.pair !== filterPair) return false;
      if (filterSession !== "All" && t.session !== filterSession) return false;
      if (filterResult !== "All" && t.result !== filterResult) return false;
      return true;
    });
  }, [logs, filterPair, filterSession, filterResult]);

  // ---- HELPERS ----
  const biasColor = (bias: string) => {
    if (bias?.toLowerCase().includes("bull")) return "#22c55e";
    if (bias?.toLowerCase().includes("bear")) return "#ef4444";
    return "#a0aec0";
  };

  const resultBg = (result: string | null) => {
    if (result === "Win") return "bg-green-900/40 text-green-400 border-green-800";
    if (result === "Loss") return "bg-red-900/40 text-red-400 border-red-800";
    return "bg-gray-800/50 text-gray-400 border-gray-700";
  };

  const selectClass =
    "bg-[#0d1117] border border-[#1a2540] text-gray-300 text-sm rounded px-3 py-1.5 focus:outline-none focus:border-[#c9a84c] cursor-pointer";

  // ---- RENDER ----
  return (
    <div
      className="min-h-screen text-white"
      style={{ background: "#07090f", fontFamily: "inherit" }}
    >
      {/* Header */}
      <div
        className="border-b flex items-center justify-between px-6 py-4"
        style={{ borderColor: "#1a2540" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-sm font-bold tracking-widest"
            style={{ color: "#c9a84c" }}
          >
            KVFX
          </span>
          <span className="text-gray-600 text-sm">|</span>
          <h1 className="text-white font-semibold text-sm tracking-wide">
            Intelligence Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/add-trade"
            className="text-xs px-3 py-1.5 rounded border transition-colors"
            style={{
              borderColor: "#c9a84c",
              color: "#c9a84c",
            }}
          >
            + Add Trade
          </Link>
          <Link
            href="/assistant"
            className="text-xs px-3 py-1.5 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          >
            ← Assistant
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-3">
              <div
                className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto"
                style={{ borderColor: "#c9a84c", borderTopColor: "transparent" }}
              />
              <p className="text-gray-500 text-sm">Loading trades...</p>
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div
            className="rounded-lg p-4 border flex items-start gap-3"
            style={{ background: "#1a0a0a", borderColor: "#7f1d1d" }}
          >
            <span className="text-red-400 text-lg">⚠</span>
            <div>
              <p className="text-red-400 font-medium text-sm">Failed to load trades</p>
              <p className="text-red-500/70 text-xs mt-0.5">{error}</p>
              <button
                onClick={fetchLogs}
                className="text-xs text-red-400 underline mt-2 hover:text-red-300"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* STATS PANEL */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Trades", value: stats.total, color: "#e2e8f0" },
                { label: "Win Rate", value: `${stats.winRate}%`, color: "#c9a84c" },
                { label: "Wins", value: stats.winCount, color: "#22c55e" },
                { label: "Losses", value: stats.lossCount, color: "#ef4444" },
                { label: "Avg Win RR", value: `${stats.avgRR}R`, color: "#60a5fa" },
                { label: "Expectancy", value: `${stats.expectancy}R`, color: parseFloat(stats.expectancy) >= 0 ? "#22c55e" : "#ef4444" },
                { label: "Profit Factor", value: stats.profitFactor, color: parseFloat(stats.profitFactor) >= 1.5 ? "#22c55e" : "#f59e0b" },
                { label: "Running R", value: `${parseFloat(stats.runningR) >= 0 ? "+" : ""}${stats.runningR}R`, color: parseFloat(stats.runningR) >= 0 ? "#22c55e" : "#ef4444" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-lg p-4 border"
                  style={{ background: "#0d1117", borderColor: "#1a2540" }}
                >
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">
                    {s.label}
                  </p>
                  <p className="text-xl font-bold" style={{ color: s.color }}>
                    {s.value}
                  </p>
                </div>
              ))}
            </div>

            {/* EQUITY CURVE */}
            <div
              className="rounded-lg border p-5"
              style={{ background: "#0d1117", borderColor: "#1a2540" }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-sm text-white tracking-wide">
                  Equity Curve
                </h2>
                <span className="text-xs text-gray-500">R-Multiple</span>
              </div>

              {equityData.length < 2 ? (
                <div className="flex items-center justify-center h-40 text-gray-600 text-sm">
                  Not enough data to plot curve
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart
                    data={equityData}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
                    <XAxis
                      dataKey="trade"
                      stroke="#2d3748"
                      tick={{ fill: "#4a5568", fontSize: 11 }}
                      label={{
                        value: "Trade #",
                        position: "insideBottom",
                        offset: -2,
                        fill: "#4a5568",
                        fontSize: 11,
                      }}
                    />
                    <YAxis
                      stroke="#2d3748"
                      tick={{ fill: "#4a5568", fontSize: 11 }}
                      tickFormatter={(v) => `${v}R`}
                    />
                    <Tooltip content={<EquityTooltip />} />
                    <ReferenceLine
                      y={0}
                      stroke="#2d3748"
                      strokeDasharray="4 4"
                    />
                    <Line
                      type="monotone"
                      dataKey="equity"
                      stroke={
                        parseFloat(stats.runningR) >= 0 ? "#22c55e" : "#ef4444"
                      }
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: "#c9a84c" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* FILTERS */}
            <div
              className="rounded-lg border p-4 flex flex-wrap gap-3 items-center"
              style={{ background: "#0d1117", borderColor: "#1a2540" }}
            >
              <span className="text-gray-500 text-xs uppercase tracking-wider mr-2">
                Filter
              </span>

              <select
                value={filterPair}
                onChange={(e) => setFilterPair(e.target.value)}
                className={selectClass}
              >
                {uniquePairs.map((p) => (
                  <option key={p} value={p}>
                    {p === "All" ? "All Pairs" : p}
                  </option>
                ))}
              </select>

              <select
                value={filterSession}
                onChange={(e) => setFilterSession(e.target.value)}
                className={selectClass}
              >
                {uniqueSessions.map((s) => (
                  <option key={s} value={s}>
                    {s === "All" ? "All Sessions" : s}
                  </option>
                ))}
              </select>

              <select
                value={filterResult}
                onChange={(e) => setFilterResult(e.target.value)}
                className={selectClass}
              >
                {["All", "Win", "Loss", "Open"].map((r) => (
                  <option key={r} value={r}>
                    {r === "All" ? "All Results" : r}
                  </option>
                ))}
              </select>

              {(filterPair !== "All" ||
                filterSession !== "All" ||
                filterResult !== "All") && (
                <button
                  onClick={() => {
                    setFilterPair("All");
                    setFilterSession("All");
                    setFilterResult("All");
                  }}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors ml-1"
                >
                  Clear filters
                </button>
              )}

              <span className="ml-auto text-gray-600 text-xs">
                {filtered.length} trade{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* TRADE LOG */}
            {filtered.length === 0 ? (
              <div
                className="rounded-lg border p-12 text-center"
                style={{ background: "#0d1117", borderColor: "#1a2540" }}
              >
                <p className="text-2xl mb-3">📊</p>
                <p className="text-gray-400 font-medium">No trades found</p>
                <p className="text-gray-600 text-sm mt-1">
                  {logs.length === 0
                    ? "Start trading to see your journal here."
                    : "Try adjusting your filters."}
                </p>
                {logs.length === 0 && (
                  <Link
                    href="/add-trade"
                    className="inline-block mt-4 text-sm px-4 py-2 rounded border transition-colors"
                    style={{ borderColor: "#c9a84c", color: "#c9a84c" }}
                  >
                    Log Your First Trade
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-lg border p-4 transition-colors"
                    style={{
                      background: "#0d1117",
                      borderColor: "#1a2540",
                    }}
                  >
                    {/* Top row */}
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-base">
                          {log.pair || "—"}
                        </span>
                        {log.bias && (
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded"
                            style={{
                              color: biasColor(log.bias),
                              background: `${biasColor(log.bias)}18`,
                              border: `1px solid ${biasColor(log.bias)}40`,
                            }}
                          >
                            {log.bias}
                          </span>
                        )}
                        {log.setup_type && (
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-900/30 text-blue-400 border border-blue-800/50">
                            {log.setup_type}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {log.rr && (
                          <span className="text-xs text-gray-400 font-mono">
                            {log.rr}R
                          </span>
                        )}
                        <span
                          className={`text-xs px-2.5 py-1 rounded border font-semibold ${resultBg(log.result)}`}
                        >
                          {log.result || "Open"}
                        </span>
                      </div>
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs text-gray-500">
                      <span>{new Date(log.created_at).toLocaleString()}</span>
                      {log.timeframe && <span>📐 {log.timeframe}</span>}
                      {log.session && <span>🕐 {log.session}</span>}
                      {log.structure && (
                        <span className="truncate max-w-xs">
                          Structure: {log.structure}
                        </span>
                      )}
                    </div>

                    {/* Notes */}
                    {log.notes && (
                      <p className="text-gray-400 text-sm leading-relaxed line-clamp-3">
                        {log.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
