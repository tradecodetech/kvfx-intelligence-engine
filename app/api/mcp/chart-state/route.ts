import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
export async function GET() {
  try {
    const [rawChart, rawStructure] = await Promise.all([redis.get("kvfx:chart-state"), redis.get("kvfx:structure")]);
    if (!rawChart) return NextResponse.json({ success: false, error: "No chart state in Redis." }, { status: 404 });
    const chart = typeof rawChart === "string" ? JSON.parse(rawChart) : rawChart;
    const structure = rawStructure ? (typeof rawStructure === "string" ? JSON.parse(rawStructure) : rawStructure) : null;
    return NextResponse.json({ ...chart, structure: structure ?? null, fromCache: true });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
