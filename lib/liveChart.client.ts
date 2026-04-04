"use client";

/**
 * lib/liveChart.client.ts
 *
 * Client-side React hook for live TradingView chart state.
 * Polls the MCP bridge every 30s and updates the UI automatically.
 *
 * Usage in any client component:
 *   import { useLiveChartHook } from "@/lib/liveChart.client";
 *   const { chart, loading } = useLiveChartHook();
 */

import { useState, useEffect, useCallback } from "react";
import { getLiveChartContext, type LiveChartState } from "./liveChart";

interface UseLiveChartResult {
  chart:   LiveChartState | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useLiveChartHook(pollIntervalMs = 30_000): UseLiveChartResult {
  const [chart, setChart]     = useState<LiveChartState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const state = await getLiveChartContext();
      setChart(state);
    } catch {
      // Silently fail — MCP bridge may not be running
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, pollIntervalMs);
    return () => clearInterval(interval);
  }, [refresh, pollIntervalMs]);

  return { chart, loading, refresh };
}
