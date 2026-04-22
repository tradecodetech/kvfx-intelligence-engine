import { NextResponse } from "next/server";
import { fetchMarketSnapshot } from "@/lib/marketData";

export async function GET() {
  const snapshot = await fetchMarketSnapshot();
  if (!snapshot) {
    return NextResponse.json({ success: false, error: "Failed to fetch market data" }, { status: 502 });
  }
  return NextResponse.json({ success: true, snapshot, fetchedAt: new Date().toISOString() });
}
