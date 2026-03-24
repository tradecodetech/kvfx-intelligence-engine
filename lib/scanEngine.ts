/**
 * KVFX Scan Engine — WhisperZonez × KVFX v3
 *
 * Scans multiple instruments and ranks setups based on combined
 * WhisperZonez liquidity logic + KVFX v3 structure methodology.
 *
 * Priority: Grade A = BOTH logics align. Grade D = no setup.
 */

// ── WhisperZonez Signal Definitions ──────────────────────────────────────────

export const WZ_SIGNALS = {
  liquidity: {
    label: "Liquidity",
    color: "violet",
    description: "Equal highs/lows, stop clusters, inducement zones present",
  },
  sweep: {
    label: "Sweep",
    color: "violet",
    description: "Liquidity swept — stops hunted before directional move",
  },
  expansion: {
    label: "Expansion",
    color: "violet",
    description: "Strong impulse move following zone breach",
  },
  compression: {
    label: "Compression",
    color: "violet",
    description: "Coiling / accumulation before next directional push",
  },
  imbalance: {
    label: "Imbalance",
    color: "violet",
    description: "Fair value gap / price inefficiency present",
  },
} as const;

// ── KVFX v3 Signal Definitions ────────────────────────────────────────────────

export const KVFX_SIGNALS = {
  bos: {
    label: "BOS",
    color: "sky",
    description: "Break of Structure — directional bias confirmed",
  },
  choch: {
    label: "CHoCH",
    color: "sky",
    description: "Change of Character — potential reversal detected",
  },
  structure: {
    label: "Structure",
    color: "sky",
    description: "Clear market structure (HH/HL or LH/LL chain)",
  },
  rejection: {
    label: "Rejection",
    color: "sky",
    description: "Price rejected at key zone or level",
  },
  trend: {
    label: "Trend",
    color: "sky",
    description: "Established directional bias on higher timeframe",
  },
} as const;

export type WZSignalKey = keyof typeof WZ_SIGNALS;
export type KVFXSignalKey = keyof typeof KVFX_SIGNALS;

// ── Result Types ──────────────────────────────────────────────────────────────

export interface ScanSetup {
  pair: string;
  bias: "Bullish" | "Bearish" | "Neutral";
  wzSignals: WZSignalKey[];
  kvfxSignals: KVFXSignalKey[];
  confidence: number;        // 0–10
  grade: "A" | "B" | "C" | "D";
  plan: string[];
  risks: string[];
  session: string | null;
  timeframe: string | null;
  alignmentNote: string;
  isBestSetup: boolean;
}

export interface ScanResults {
  setups: ScanSetup[];
  scanTime: string;
  topPair: string | null;
  summary: string;
  pairsScanned: string[];
}

// ── Command Detection ─────────────────────────────────────────────────────────

const SCAN_COMMANDS = [
  // Direct scan commands
  "scan market",
  "kvfx scan",
  "whisper scan",
  "engine scan",
  "best setup",
  "best setups",
  "scan pairs",
  "full scan",
  "market scan",
  "run scan",
  "scan now",
  "give me a scan",
  "what's the best",
  "what is the best",
  // Beta commands
  "bias board",
  "liquidity scan",
  "risk environment",
  "show me setups",
  "any setups",
  "what's setting up",
];

export function isScanCommand(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return SCAN_COMMANDS.some((cmd) => lower.includes(cmd));
}

// ── Default Instrument List ───────────────────────────────────────────────────

// Full engine default — only used when no tier restriction is applied
const DEFAULT_PAIRS = ["EURUSD", "GBPUSD", "USDJPY", "GOLD", "NASDAQ"];

const PAIR_REGEX =
  /\b(EURUSD|GBPUSD|USDJPY|AUDUSD|USDCAD|USDCHF|NZDUSD|GBPJPY|EURJPY|AUDJPY|EURAUD|NASDAQ|NAS100|SPX|DXY|GOLD|XAUUSD|SILVER|XAGUSD|BTCUSD)\b/gi;

function extractPairs(text: string): string[] {
  const found = text.match(PAIR_REGEX) ?? [];
  // Normalise NAS100 → NASDAQ etc.
  return [...new Set(found.map((p) => p.toUpperCase()))];
}

// ── Prompt Builder ────────────────────────────────────────────────────────────

export function buildScanPrompt(
  userMessage: string,
  tradingMode: string,
  allowedPairs?: string[]   // When provided, restricts scan to these pairs (beta tier)
): string {
  const mentioned = extractPairs(userMessage);
  let pairs = mentioned.length > 0 ? mentioned : DEFAULT_PAIRS;

  // Apply tier restriction: filter to allowed pairs, fallback to allowed list
  if (allowedPairs && allowedPairs.length > 0) {
    const upper = allowedPairs.map((p) => p.toUpperCase());
    const filtered = pairs.filter((p) => upper.includes(p.toUpperCase()));
    pairs = filtered.length > 0 ? filtered : allowedPairs;
  }
  const modeNote =
    tradingMode === "scalping"
      ? "Use strict scalping confirmation: M5-M15 structure required."
      : tradingMode === "macro"
      ? "Use macro confluence: weekly/daily structure must agree."
      : "Use swing confirmation: H1-H4 structure with HTF alignment.";

  return `You are the KVFX Scan Engine — combining WhisperZonez liquidity logic with KVFX Algo v3 structure methodology.

Scan the following instruments: ${pairs.join(", ")}

For EACH instrument output this EXACT block (no deviation):

---SCAN: [PAIR]---
BIAS: [Bullish / Bearish / Neutral]
WZ_SIGNALS: [comma-list of any present: liquidity, sweep, expansion, compression, imbalance]
KVFX_SIGNALS: [comma-list of any present: bos, choch, structure, rejection, trend]
CONFIDENCE: [0.0-10.0]
GRADE: [A / B / C / D]
TIMEFRAME: [primary execution timeframe]
SESSION: [London / NY / Asia / Any]
ALIGNMENT_NOTE: [one sentence — how WZ and KVFX signals relate to each other]
PLAN:
- [entry trigger]
- [target area]
- [stop/invalidation]
RISKS: [comma-list of risk factors, or "None identified"]
---END---

GRADING RULES (non-negotiable):
- Grade A: BOTH a WZ sweep/liquidity signal AND a KVFX BOS/CHoCH present, same direction → strong confluence
- Grade B: 2+ WZ signals OR 2+ KVFX signals with matching bias → partial alignment
- Grade C: Only one WZ or one KVFX signal → single-logic setup, lower conviction
- Grade D: No clear setup, conflicting signals, or choppy → STAND ASIDE

${modeNote}

After all scans, add:
BEST_SETUP: [PAIR — one-line reason]
SCAN_SUMMARY: [2-3 sentences — overall market condition and which sessions favour trading]

Be honest. Fabricate nothing. If an instrument has no setup, give Grade D.
Only Grade A and B are worth acting on. Grade A is where BOTH logics confirm.`;
}

// ── Response Parser ───────────────────────────────────────────────────────────

function extractField(block: string, field: string): string | undefined {
  const regex = new RegExp(`^${field}:\\s*(.+)`, "mi");
  return block.match(regex)?.[1]?.trim();
}

function parseSignalList<T extends string>(
  raw: string | undefined,
  validKeys: readonly T[]
): T[] {
  if (!raw || raw.toLowerCase() === "none") return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase() as T)
    .filter((s) => validKeys.includes(s));
}

function extractPlan(block: string): string[] {
  const planMatch = block.match(/^PLAN:\n([\s\S]*?)(?:\n[A-Z_]+:|---END)/m);
  if (!planMatch) return [];
  return planMatch[1]
    .split("\n")
    .map((l) => l.replace(/^[-•→*\s]+/, "").trim())
    .filter((l) => l.length > 3 && l.length < 160);
}

export function parseScanResponse(content: string): ScanResults | null {
  // Split on ---SCAN: delimiter
  const rawBlocks = content.split(/---SCAN:\s*/i).slice(1);
  if (rawBlocks.length === 0) return null;

  const wzKeys = Object.keys(WZ_SIGNALS) as WZSignalKey[];
  const kvfxKeys = Object.keys(KVFX_SIGNALS) as KVFXSignalKey[];
  const setups: ScanSetup[] = [];
  const pairsScanned: string[] = [];

  for (const block of rawBlocks) {
    try {
      // Pair comes right before ---
      const pairMatch = block.match(/^([A-Z0-9]+)[\s\S]*?---/);
      if (!pairMatch) continue;
      const pair = pairMatch[1].trim();
      pairsScanned.push(pair);

      const biasRaw = extractField(block, "BIAS") ?? "";
      const bias: ScanSetup["bias"] = biasRaw.toLowerCase().includes("bull")
        ? "Bullish"
        : biasRaw.toLowerCase().includes("bear")
        ? "Bearish"
        : "Neutral";

      const wzSignals = parseSignalList(extractField(block, "WZ_SIGNALS"), wzKeys);
      const kvfxSignals = parseSignalList(extractField(block, "KVFX_SIGNALS"), kvfxKeys);

      const confRaw = extractField(block, "CONFIDENCE") ?? "0";
      const confidence = Math.min(10, Math.max(0, parseFloat(confRaw) || 0));

      const gradeRaw = (extractField(block, "GRADE") ?? "D").trim().toUpperCase()[0];
      const grade = (["A", "B", "C", "D"].includes(gradeRaw)
        ? gradeRaw
        : "D") as ScanSetup["grade"];

      const timeframe = extractField(block, "TIMEFRAME") ?? null;
      const session = extractField(block, "SESSION") ?? null;
      const alignmentNote = extractField(block, "ALIGNMENT_NOTE") ?? "";
      const plan = extractPlan(block);

      const risksRaw = extractField(block, "RISKS") ?? "";
      const risks =
        risksRaw.toLowerCase() === "none identified" || risksRaw.toLowerCase() === "none"
          ? []
          : risksRaw
              .split(",")
              .map((r) => r.trim())
              .filter(Boolean);

      setups.push({
        pair,
        bias,
        wzSignals,
        kvfxSignals,
        confidence,
        grade,
        plan,
        risks,
        session: session?.toLowerCase() === "any" ? null : session,
        timeframe: timeframe ?? null,
        alignmentNote,
        isBestSetup: false,
      });
    } catch {
      // Skip malformed block
    }
  }

  if (setups.length === 0) return null;

  // Mark best setup from AI's BEST_SETUP field
  const bestMatch = content.match(/BEST_SETUP:\s*([A-Z0-9]+)/i);
  const bestPairName = bestMatch?.[1]?.toUpperCase();
  if (bestPairName) {
    const found = setups.find((s) => s.pair === bestPairName);
    if (found) found.isBestSetup = true;
  }
  // Fallback: highest-grade + confidence
  if (!setups.some((s) => s.isBestSetup)) {
    const gradeOrder = { A: 4, B: 3, C: 2, D: 1 };
    const top = setups.reduce((a, b) =>
      gradeOrder[b.grade] !== gradeOrder[a.grade]
        ? gradeOrder[b.grade] > gradeOrder[a.grade]
          ? b
          : a
        : b.confidence > a.confidence
        ? b
        : a
    );
    top.isBestSetup = true;
  }

  // Sort: A→B→C→D then by confidence
  const gradeOrder = { A: 4, B: 3, C: 2, D: 1 };
  setups.sort((a, b) => {
    const gd = gradeOrder[b.grade] - gradeOrder[a.grade];
    return gd !== 0 ? gd : b.confidence - a.confidence;
  });

  const summaryMatch = content.match(/SCAN_SUMMARY:\s*([\s\S]*?)(?:\n\n|$)/i);
  const summary = summaryMatch?.[1]?.trim().replace(/\n/g, " ") ?? "";

  return {
    setups,
    scanTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    topPair: setups.find((s) => s.isBestSetup)?.pair ?? setups[0]?.pair ?? null,
    summary,
    pairsScanned,
  };
}
