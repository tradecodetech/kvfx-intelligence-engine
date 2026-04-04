import { NextResponse } from "next/server";

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL!;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN!;

async function redisGet(key: string) {
  const res = await fetch(`${REDIS_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = await res.json();
  const raw = json?.result;
  if (!raw) return null;
  try { return typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return null; }
}

export async function GET() {
  try {
    const [chart, structure] = await Promise.all([
      redisGet("kvfx:chart-state"),
      redisGet("kvfx:structure"),
    ]);
    if (!chart) return NextResponse.json({ success: false, error: "No chart state in Redis." }, { status: 404 });
    return NextResponse.json({ ...chart, structure: structure ?? null, fromCache: true });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
