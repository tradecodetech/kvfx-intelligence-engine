import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
const REDIS_KEY = "kvfx:chart-state";
export async function GET() {
  try {
    const raw = await redis.get(REDIS_KEY);
    if (!raw) return NextResponse.json({ success: false, error: "No chart state in Redis. Is the MCP bridge running?" }, { status: 404 });
    const state = typeof raw === "string" ? JSON.parse(raw) : raw;
    return NextResponse.json({ ...state, fromCache: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
