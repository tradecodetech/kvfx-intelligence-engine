/**
 * /api/mcp/chart-state
 *
 * Proxies a live chart state read from the TradingView MCP server
 * running locally on the same machine.
 *
 * The MCP server exposes an HTTP bridge at localhost:3001 (see mcp-bridge.js).
 * This route is called from the WhisperZonez frontend to inject live
 * TradingView chart context into the KVFX intelligence engine.
 *
 * Returns:
 *   { success, symbol, resolution, timeframe, chartType, studies }
 */

import { NextResponse } from "next/server";

const MCP_BRIDGE_URL = process.env.MCP_BRIDGE_URL ?? "http://localhost:3001";

export async function GET() {
  try {
    const resp = await fetch(`${MCP_BRIDGE_URL}/chart-state`, {
      // Short timeout — this is a local call, should be instant
      signal: AbortSignal.timeout(3000),
    });

    if (!resp.ok) {
      return NextResponse.json(
        { success: false, error: `MCP bridge returned ${resp.status}` },
        { status: 502 }
      );
    }

    const data = await resp.json();
    return NextResponse.json(data);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";

    // Return a soft failure — the app continues without live chart data
    return NextResponse.json(
      {
        success: false,
        error: message,
        hint: "Is the MCP bridge running? Start it with: node mcp-bridge.js",
      },
      { status: 503 }
    );
  }
}
